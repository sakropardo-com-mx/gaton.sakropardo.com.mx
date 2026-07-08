from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import subprocess
import requests
from bs4 import BeautifulSoup
import uuid
import hashlib

app = FastAPI(title="Gaton Streamer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

JOBS = {}
DOWNLOAD_DIR = "/downloads"

os.makedirs(DOWNLOAD_DIR, exist_ok=True)

def scrape_mediafire(url: str) -> str:
    """Scrape the direct download link from a Mediafire URL."""
    try:
        response = requests.get(url, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        download_btn = soup.find('a', id='downloadButton')
        if download_btn and 'href' in download_btn.attrs:
            return download_btn['href']
    except Exception as e:
        print(f"Error scraping mediafire: {e}")
    return None

def process_download(job_id: str, mediafire_url: str, password: str):
    JOBS[job_id] = {"status": "scraping", "progress": 0}
    
    direct_link = scrape_mediafire(mediafire_url)
    if not direct_link:
        JOBS[job_id] = {"status": "error", "message": "No se pudo obtener el link directo"}
        return

    JOBS[job_id]["status"] = "downloading"
    rar_path = os.path.join(DOWNLOAD_DIR, f"{job_id}.rar")
    extract_dir = os.path.join(DOWNLOAD_DIR, job_id)
    os.makedirs(extract_dir, exist_ok=True)

    try:
        # Download file
        with requests.get(direct_link, stream=True) as r:
            r.raise_for_status()
            total_size = int(r.headers.get('content-length', 0))
            downloaded = 0
            with open(rar_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total_size:
                            JOBS[job_id]["progress"] = int((downloaded / total_size) * 100)

        JOBS[job_id]["status"] = "extracting"
        JOBS[job_id]["progress"] = 0

        # Unrar file with password
        cmd = ["unrar", "x", "-y"]
        if password and password.strip():
            cmd.append(f"-p{password.strip()}")
        else:
            cmd.append("-p-") # Do not ask for password
            
        cmd.extend([rar_path, extract_dir + "/"])
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            JOBS[job_id] = {"status": "error", "message": f"Error descomprimiendo: {result.stderr}"}
            return

        # Find all video files
        video_files = []
        for root, dirs, files in os.walk(extract_dir):
            for file in files:
                if file.lower().endswith(('.mkv', '.mp4', '.avi')):
                    video_files.append(os.path.join(root, file))

        if not video_files:
            JOBS[job_id] = {"status": "error", "message": "No se encontró ningún archivo de video en el rar"}
            return
            
        video_files.sort()
        video_file = video_files[0]

        # Clean up rar to save space
        os.remove(rar_path)

        # Prepare multiple video payload
        multiple_videos = []
        for vf in video_files:
            multiple_videos.append({
                "path": f"/streams/{os.path.relpath(vf, DOWNLOAD_DIR)}",
                "name": os.path.basename(vf)
            })

        relative_path = os.path.relpath(video_file, DOWNLOAD_DIR)
        JOBS[job_id] = {
            "status": "ready",
            "video_path": f"/streams/{relative_path}",
            "local_path": video_file,
            "multiple_videos": multiple_videos
        }

    except Exception as e:
        JOBS[job_id] = {"status": "error", "message": str(e)}


def get_job_id(url: str) -> str:
    return hashlib.md5(url.encode()).hexdigest()

def check_local_cache(job_id: str) -> dict:
    if job_id in JOBS and JOBS[job_id].get("status") == "ready":
        return JOBS[job_id]
        
    extract_dir = os.path.join(DOWNLOAD_DIR, job_id)
    if os.path.exists(extract_dir):
        video_files = []
        for root, dirs, files in os.walk(extract_dir):
            for file in files:
                if file.lower().endswith(('.mkv', '.mp4', '.avi')):
                    video_files.append(os.path.join(root, file))
                    
        if video_files:
            video_files.sort()
            multiple_videos = []
            for vf in video_files:
                multiple_videos.append({
                    "path": f"/streams/{os.path.relpath(vf, DOWNLOAD_DIR)}",
                    "name": os.path.basename(vf)
                })
            
            job_data = {
                "status": "ready",
                "video_path": multiple_videos[0]["path"],
                "local_path": video_files[0],
                "multiple_videos": multiple_videos
            }
            JOBS[job_id] = job_data
            return job_data
    return None

@app.post("/api/prepare")
async def prepare_stream(payload: dict, background_tasks: BackgroundTasks):
    url = payload.get("url")
    password = payload.get("password", "")
    
    if not url:
        raise HTTPException(status_code=400, detail="Falta URL")
        
    job_id = get_job_id(url)
    
    # Check if already processed
    cached_job = check_local_cache(job_id)
    if cached_job:
        payload = {"job_id": job_id, "status": "ready", "video_path": cached_job["video_path"]}
        if "multiple_videos" in cached_job:
            payload["multiple_videos"] = cached_job["multiple_videos"]
        return payload
        
    # Prevent starting multiple parallel downloads for the same job
    if job_id in JOBS and JOBS[job_id].get("status") not in ["error", "ready"]:
        return {"job_id": job_id, "status": "started"}
        
    background_tasks.add_task(process_download, job_id, url, password)
    
    return {"job_id": job_id, "status": "started"}

@app.post("/api/check_cache")
async def check_cache(payload: dict):
    urls = payload.get("urls", [])
    result = {}
    for url in urls:
        job_id = get_job_id(url)
        cached_job = check_local_cache(job_id)
        if cached_job:
            result[url] = cached_job["video_path"]
    return {"cached_urls": result}

@app.get("/api/status/{job_id}")
async def get_status(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job no encontrado")
    return JOBS[job_id]

@app.delete("/api/clean/{job_id}")
async def clean_job(job_id: str):
    if job_id in JOBS:
        job = JOBS[job_id]
        if "local_path" in job:
            try:
                import shutil
                extract_dir = os.path.join(DOWNLOAD_DIR, job_id)
                if os.path.exists(extract_dir):
                    shutil.rmtree(extract_dir)
            except Exception as e:
                print(e)
        del JOBS[job_id]
    return {"status": "cleaned"}

@app.get("/health")
async def health():
    return {"status": "ok"}
