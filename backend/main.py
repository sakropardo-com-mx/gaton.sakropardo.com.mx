from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import subprocess
import requests
from bs4 import BeautifulSoup
import uuid

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

        # Find the video file
        video_file = None
        for root, dirs, files in os.walk(extract_dir):
            for file in files:
                if file.lower().endswith(('.mkv', '.mp4', '.avi')):
                    video_file = os.path.join(root, file)
                    break
            if video_file:
                break

        if not video_file:
            JOBS[job_id] = {"status": "error", "message": "No se encontró ningún archivo de video en el rar"}
            return

        # Clean up rar to save space
        os.remove(rar_path)

        # Assuming Nginx will serve /downloads directly, we just return the relative path
        relative_path = os.path.relpath(video_file, DOWNLOAD_DIR)
        JOBS[job_id] = {
            "status": "ready",
            "video_path": f"/streams/{relative_path}",
            "local_path": video_file
        }

    except Exception as e:
        JOBS[job_id] = {"status": "error", "message": str(e)}


@app.post("/api/prepare")
async def prepare_stream(payload: dict, background_tasks: BackgroundTasks):
    url = payload.get("url")
    password = payload.get("password", "")
    
    if not url:
        raise HTTPException(status_code=400, detail="Falta URL")
        
    job_id = str(uuid.uuid4())
    background_tasks.add_task(process_download, job_id, url, password)
    
    return {"job_id": job_id, "status": "started"}

@app.get("/api/status/{job_id}")
async def get_status(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job no encontrado")
    return JOBS[job_id]

@app.delete("/api/clean/{job_id}")
async def clean_job(job_id: str):
    if job_id in JOBS:
        job = JOBS[job_id]
        if "local_path" in job and os.path.exists(job.get("local_path")):
            try:
                # Remove entire directory
                import shutil
                shutil.rmtree(os.path.dirname(job["local_path"]))
            except Exception as e:
                print(e)
        del JOBS[job_id]
    return {"status": "cleaned"}

@app.get("/health")
async def health():
    return {"status": "ok"}
