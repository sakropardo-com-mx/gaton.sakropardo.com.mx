import paramiko
import time

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('178.104.120.114', username='root', password='@Jadenn#2981.', timeout=10)

sql = """
DROP VIEW IF EXISTS public.v_active_years;
DROP VIEW IF EXISTS public.v_media;
DROP VIEW IF EXISTS gatonplayseries.v_active_years;
DROP VIEW IF EXISTS gatonplayseries.v_media;

CREATE VIEW gatonplayseries.v_media AS
  SELECT 
    m.id, m.title, m.cover_image_url, m.rating, m.release_date, 'pelicula'::text as type,
    m.pgratis_url, m.pvip_url, m.raw_metadata, m.format, m.duration, m.resolution, m.audio_lang, m.size, m.password, m.synopsis
  FROM gatonplayseries.movies m
  UNION ALL
  SELECT 
    s.id, s.title, s.cover_image_url, s.rating, s.release_date, 'serie'::text as type,
    sl.pgratis_url, sl.pvip_url, s.raw_metadata, s.format, s.duration, s.resolution, s.audio_lang, s.size, s.password, s.synopsis
  FROM gatonplayseries.series s
  LEFT JOIN LATERAL (
    SELECT sl_sub.pgratis_url, sl_sub.pvip_url FROM gatonplayseries.series_links sl_sub WHERE sl_sub.series_id = s.id LIMIT 1
  ) sl ON true;

GRANT SELECT ON gatonplayseries.v_media TO anon, authenticated, authenticator;

CREATE VIEW gatonplayseries.v_active_years AS
  SELECT DISTINCT release_date as year FROM gatonplayseries.v_media
  WHERE release_date IS NOT NULL AND release_date != ''
  ORDER BY release_date DESC;

GRANT SELECT ON gatonplayseries.v_active_years TO anon, authenticated, authenticator;

NOTIFY pgrst, 'reload schema';
"""

sftp = client.open_sftp()
with sftp.file('/tmp/temp_views_schema.sql', 'w') as f:
    f.write(sql)
sftp.close()

cmd = 'cat /tmp/temp_views_schema.sql | docker exec -i jadenn-db psql -U supabase_admin -d postgres'
stdin, stdout, stderr = client.exec_command(cmd)
print("OUT:", stdout.read().decode('utf-8'))
print("ERR:", stderr.read().decode('utf-8'))

time.sleep(2)
client.exec_command('docker exec jadenn-db kill -SIGUSR1 1')

client.close()
