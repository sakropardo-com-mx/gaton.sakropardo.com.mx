import paramiko
import json
import base64

# Read local config
with open(r'C:\server\_nginx\nginx.conf', 'r') as f:
    config = f.read()

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('178.104.120.114', username='root', password='@Jadenn#2981.')

# Find where nginx is mounted
stdin, stdout, stderr = client.exec_command('docker inspect jadenn-nginx')
data = stdout.read().decode()
try:
    inspect_data = json.loads(data)
    mounts = inspect_data[0].get('Mounts', [])
    conf_path = None
    for m in mounts:
        if m.get('Destination') == '/etc/nginx/nginx.conf':
            conf_path = m.get('Source')
            break
    
    if not conf_path:
        print("Could not find mount path for nginx.conf. Defaulting to /opt/jadenn-stack/nginx/nginx.conf")
        conf_path = "/opt/jadenn-stack/nginx/nginx.conf"
    
    print(f"Deploying to {conf_path}")
    
    b64_config = base64.b64encode(config.encode('utf-8')).decode('utf-8')
    cmd = f"echo {b64_config} | base64 -d > {conf_path} && docker restart jadenn-nginx"
    stdin, stdout, stderr = client.exec_command(cmd)
    print("STDOUT:", stdout.read().decode())
    print("STDERR:", stderr.read().decode())
    
except Exception as e:
    print("Error:", e)

client.close()
