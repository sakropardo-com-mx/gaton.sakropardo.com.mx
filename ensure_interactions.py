import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('178.104.120.114', username='root', password='@Jadenn#2981.')

sql_query = """
CREATE TABLE IF NOT EXISTS gatonplayseries.interactions (
    profile_id TEXT NOT NULL,
    media_id BIGINT NOT NULL,
    is_in_list BOOLEAN DEFAULT false,
    rating INT DEFAULT 0,
    episode_progress JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (profile_id, media_id)
);

GRANT ALL PRIVILEGES ON SCHEMA gatonplayseries TO anon, authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA gatonplayseries TO anon, authenticated;
"""

command = f'cat << "EOF" | docker exec -i jadenn-db psql -U supabase_admin -d postgres\n{sql_query}\nEOF'

stdin, stdout, stderr = client.exec_command(command)
print("STDOUT:", stdout.read().decode())
print("STDERR:", stderr.read().decode())
client.close()
