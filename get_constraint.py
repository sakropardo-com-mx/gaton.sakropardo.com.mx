import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('178.104.120.114', username='root', password='@Jadenn#2981.')

sql_query = """
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_schema = 'gatonplayseries' AND table_name = 'interactions' AND constraint_type = 'PRIMARY KEY';
"""

command = f'cat << "EOF" | docker exec -i jadenn-db psql -U supabase_admin -d postgres -t\n{sql_query}\nEOF'

stdin, stdout, stderr = client.exec_command(command)
print("STDOUT:", stdout.read().decode())
print("STDERR:", stderr.read().decode())
client.close()
