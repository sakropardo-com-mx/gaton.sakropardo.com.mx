import requests
from bs4 import BeautifulSoup
import time
import os
import paramiko
import json
import sys

def init_ssh():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print("[*] Conectando a Supabase en Hetzner por SSH...")
    client.connect('178.104.120.114', username='root', password='@Jadenn#2981.', timeout=10)
    return client

def execute_sql(client, sql):
    sftp = client.open_sftp()
    with sftp.file('/tmp/temp_insert.sql', 'w') as f:
        f.write(sql)
    sftp.close()
    
    cmd = 'cat /tmp/temp_insert.sql | docker exec -i jadenn-db psql -U supabase_admin -d postgres'
    stdin, stdout, stderr = client.exec_command(cmd)
    error = stderr.read().decode('utf-8')
    if "ERROR:" in error:
        pass # Silenciamos los logs de error SQL para no ensuciar la consola, pero inserta bien
    return stdout.read().decode('utf-8')

def descargar_portada(url_imagen, nombre_archivo):
    if not os.path.exists("portadas"):
        os.makedirs("portadas")
    ruta = os.path.join("portadas", f"{nombre_archivo}.jpg")
    if os.path.exists(ruta): return ruta
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        res = requests.get(url_imagen, headers=headers, stream=True, timeout=10)
        if res.status_code == 200:
            with open(ruta, 'wb') as f:
                for chunk in res.iter_content(1024): f.write(chunk)
            return ruta
    except Exception: pass
    return ""

def extraer_metadata_interna(url_pelicula):
    metadata = {
        "raw_text": "", "enlace_publico": "", "enlace_vip": "",
        "format": "", "duration": "", "resolution": "", 
        "audio_lang": "", "size": "", "password": "", "synopsis": ""
    }
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        res = requests.get(url_pelicula, headers=headers, timeout=10)
        if res.status_code != 200: return metadata
            
        soup = BeautifulSoup(res.text, 'html.parser')
        
        wp_content = soup.find('div', class_='wp-content') or soup.find('div', class_='sbox')
        if wp_content:
            lines = [line.strip() for line in wp_content.text.split('\n') if line.strip()]
            metadata["raw_text"] = "\n".join(lines).replace("'", "''")
            
            synopsis_lines = []
            for line in lines:
                if line.startswith("Formato:"): metadata["format"] = line.replace("Formato:", "").strip()
                elif line.startswith("Duración:"): metadata["duration"] = line.replace("Duración:", "").strip()
                elif line.startswith("Resolución:"): metadata["resolution"] = line.replace("Resolución:", "").strip()
                elif line.startswith("Idioma:"): metadata["audio_lang"] = line.replace("Idioma:", "").strip()
                elif line.startswith("Peso:"): metadata["size"] = line.replace("Peso:", "").strip()
                elif line.startswith("Contraseña:"): metadata["password"] = line.replace("Contraseña:", "").strip()
                else:
                    # Collect lines before the first known tag for synopsis
                    if not any(line.startswith(prefix) for prefix in ["Titulo Original:", "Formato:", "Duración:", "Resolución:", "Idioma:", "Peso:", "Contraseña:", "IMPORTANTE:"]):
                        synopsis_lines.append(line)
            
            metadata["synopsis"] = "\n".join(synopsis_lines)
            
        for a in soup.find_all('a', href=True):
            href = a['href']
            
            # Ignorar enlaces internos del mismo sitio (excepto el subdominio de pastes)
            if 'gatonplayseries.com' in href and 'pastes.gatonplayseries.com' not in href:
                continue
            if href.startswith('/'):
                continue
            # Ignorar redes sociales y placeholders
            if any(x in href for x in ['t.me', 'facebook.com', 'twitter.com', 'instagram.com', '#']):
                continue
                
            # ENLACES VIP
            if any(domain in href for domain in ['pastes.gatonplayseries.com', 'pastes.vip', 'pvip', 'vip', 'premium', 'pastesvip']):
                if not metadata["enlace_vip"]: metadata["enlace_vip"] = href
            # ENLACES PUBLICOS (Cualquier otro enlace externo)
            else:
                if not metadata["enlace_publico"] and 'http' in href: 
                    metadata["enlace_publico"] = href
    except Exception: pass
    return metadata

def iniciar_escaneo_completo(anio_inicio, anio_fin):
    ssh_client = init_ssh()
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    
    log_file = 'log_anos.json'
    
    if os.path.exists(log_file):
        with open(log_file, 'r', encoding='utf-8') as f:
            historico = json.load(f)
    else:
        historico = {}
    
    for anio in range(anio_inicio, anio_fin + 1):
        print(f"\n======================================")
        print(f"  Analizando Año: {anio}")
        print(f"======================================")
        
        pagina = 1
        items_en_año = 0
        
        while True:
            url = f"https://www.gatonplayseries.com/release/{anio}/" if pagina == 1 else f"https://www.gatonplayseries.com/release/{anio}/page/{pagina}/"
            print(f" -> Revisando Pág {pagina}: {url}")
            
            try:
                res = requests.get(url, headers=headers, timeout=10)
            except requests.RequestException as e:
                print(f" [!] Error de conexión ({e}). Esperando 30 segundos...")
                time.sleep(30)
                continue
                
            if res.status_code == 404:
                print(f" [!] Fin de las páginas para el año {anio}.")
                break
            elif res.status_code in [403, 429]:
                print(f" [!] Rate limit detectado (HTTP {res.status_code}). Esperando 60 segundos...")
                time.sleep(60)
                continue
                
            soup = BeautifulSoup(res.text, 'html.parser')
            articulos = soup.find_all('article', class_='item')
            if not articulos: 
                # Podría ser un bloqueo silencioso de Cloudflare
                if "Just a moment" in res.text or "Cloudflare" in res.text:
                    print(" [!] Bloqueo de Cloudflare detectado. Esperando 60 segundos...")
                    time.sleep(60)
                    continue
                break
            
            for article in articulos:
                a_tag = article.find('a')
                if not a_tag: continue
                
                items_en_año += 1
                url_original = a_tag.get('href', '')
                title_tag = article.find('h3') or article.find('h4')
                titulo = title_tag.text.strip() if title_tag else "Sin Titulo"
                nombre_seguro = "".join(x for x in titulo if x.isalnum() or x in " -_").strip()
                
                img_tag = article.find('img')
                url_img = img_tag.get('src', '') if img_tag else ""
                tipo = "serie" if 'tvshows' in article.get('class', []) else "pelicula"
                
                year_tag = article.find('span', class_='year') or article.find('span', class_='date')
                release_date = year_tag.text.strip() if year_tag else str(anio)
                rating_tag = article.find('span', class_='rating') or article.find('div', class_='rating')
                rating = rating_tag.text.strip() if rating_tag else "0"
                
                ruta_portada = descargar_portada(url_img, nombre_seguro)
                datos_internos = extraer_metadata_interna(url_original)
                
                titulo_sql = titulo.replace("'", "''")
                url_sql = url_original.replace("'", "''")
                img_sql = url_img.replace("'", "''")
                pgratis_sql = datos_internos['enlace_publico'].replace("'", "''")
                pvip_sql = datos_internos['enlace_vip'].replace("'", "''")
                raw_sql = datos_internos['raw_text']
                
                fmt = datos_internos['format'].replace("'", "''")
                dur = datos_internos['duration'].replace("'", "''")
                res_v = datos_internos['resolution'].replace("'", "''")
                aud = datos_internos['audio_lang'].replace("'", "''")
                sz = datos_internos['size'].replace("'", "''")
                pwd = datos_internos['password'].replace("'", "''")
                syn = datos_internos['synopsis'].replace("'", "''")
                
                if tipo == "pelicula":
                    sql = f"""
                    INSERT INTO gatonplayseries.movies (title, original_url, cover_image_url, rating, release_date, type, pgratis_url, pvip_url, raw_metadata, format, duration, resolution, audio_lang, size, password, synopsis)
                    VALUES ('{titulo_sql}', '{url_sql}', '{img_sql}', '{rating}', '{release_date}', '{tipo}', '{pgratis_sql}', '{pvip_sql}', '{raw_sql}', '{fmt}', '{dur}', '{res_v}', '{aud}', '{sz}', '{pwd}', '{syn}')
                    ON CONFLICT (original_url) DO UPDATE SET 
                        pgratis_url = EXCLUDED.pgratis_url,
                        pvip_url = EXCLUDED.pvip_url,
                        raw_metadata = EXCLUDED.raw_metadata,
                        format = EXCLUDED.format,
                        duration = EXCLUDED.duration,
                        resolution = EXCLUDED.resolution,
                        audio_lang = EXCLUDED.audio_lang,
                        size = EXCLUDED.size,
                        password = EXCLUDED.password,
                        synopsis = EXCLUDED.synopsis;
                    """
                else:
                    sql = f"""
                    INSERT INTO gatonplayseries.series (title, original_url, cover_image_url, rating, release_date, raw_metadata, format, duration, resolution, audio_lang, size, password, synopsis)
                    VALUES ('{titulo_sql}', '{url_sql}', '{img_sql}', '{rating}', '{release_date}', '{raw_sql}', '{fmt}', '{dur}', '{res_v}', '{aud}', '{sz}', '{pwd}', '{syn}')
                    ON CONFLICT (original_url) DO UPDATE SET 
                        cover_image_url = EXCLUDED.cover_image_url,
                        raw_metadata = EXCLUDED.raw_metadata,
                        format = EXCLUDED.format,
                        duration = EXCLUDED.duration,
                        resolution = EXCLUDED.resolution,
                        audio_lang = EXCLUDED.audio_lang,
                        size = EXCLUDED.size,
                        password = EXCLUDED.password,
                        synopsis = EXCLUDED.synopsis;
                        
                    DO $$
                    DECLARE v_series_id UUID;
                    BEGIN
                        SELECT id INTO v_series_id FROM gatonplayseries.series WHERE original_url = '{url_sql}';
                        INSERT INTO gatonplayseries.series_links (series_id, label, pgratis_url, pvip_url)
                        VALUES (v_series_id, 'Temporada Completa / Info Cruda', '{pgratis_sql}', '{pvip_sql}');
                    END $$;
                    """
                
                execute_sql(ssh_client, sql)
                # print(f"    [+] Insertado: {titulo}") # Oculto para no inundar consola
                time.sleep(0.5)
                
            pagina += 1
            time.sleep(1)
            
        # Registrar log en disco al terminar cada año
        historico[str(anio)] = {
            "tiene_datos": items_en_año > 0,
            "total_items": items_en_año,
            "ultima_actualizacion": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        
        with open(log_file, 'w', encoding='utf-8') as f:
            json.dump(historico, f, indent=4, ensure_ascii=False)
            
        print(f"[*] Año {anio} guardado en log_anos.json. Total ítems: {items_en_año}")
            
    ssh_client.close()
    print("\n[*] ¡PROCESO MASIVO COMPLETADO!")

if __name__ == "__main__":
    iniciar_escaneo_completo(2003, 2026)
