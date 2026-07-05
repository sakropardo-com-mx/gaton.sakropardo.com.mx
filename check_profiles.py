import paramiko
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('178.104.120.114', username='root', password='@Jadenn#2981.')
command = 'cat << "EOF" | docker exec -i jadenn-db psql -U supabase_admin -d postgres\n\\d gatonplayseries.profiles\nEOF'
stdin, stdout, stderr = client.exec_command(command)
print("STDOUT:\n", stdout.read().decode())
client.close()
