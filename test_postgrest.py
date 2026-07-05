import paramiko
import requests

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('178.104.120.114', username='root', password='@Jadenn#2981.')
command = 'cat << "EOF" | docker exec -i jadenn-db psql -U supabase_admin -d postgres -t\nSELECT id FROM gatonplayseries.profiles LIMIT 1;\nEOF'
stdin, stdout, stderr = client.exec_command(command)
out = stdout.read().decode().strip()
client.close()

print('Valid profile_id:', out)

if out:
    service_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UtZGVtbyIsImlhdCI6MTY0MTc2OTIwMCwiZXhwIjoxNzk5NTM1NjAwfQ.eIomGyjYR_23MmMw-9JOMk805VFHBUkxHh6qg2JEfMk'
    url = 'https://supabase.jadenn.com.mx/rest/v1/interactions?on_conflict=profile_id,media_id'

    headers = {
        'apikey': service_key,
        'Authorization': f'Bearer {service_key}',
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation',
        'Accept-Profile': 'gatonplayseries',
        'Content-Profile': 'gatonplayseries'
    }

    payload = {
        'profile_id': out,
        'media_id': 1,
        'is_in_list': True
    }

    response = requests.post(url, headers=headers, json=payload)
    print('Status Code:', response.status_code)
    print('Response:', response.text)
