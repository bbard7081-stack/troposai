import paramiko
from scp import SCPClient
import os

ip = "74.208.170.62"
user = "root"
password = "8455381718"
local_db = "crm_data.db"
remote_path = "~/careq/data/crm_data.db"

print(f"Connecting to {user}@{ip}...", flush=True)

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(ip, username=user, password=password)

print(f"Backing up existing DB...", flush=True)
ssh.exec_command("cp ~/careq/data/crm_data.db ~/careq/data/crm_data.db.bak")

print(f"Uploading {local_db} to {remote_path}...", flush=True)
with SCPClient(ssh.get_transport()) as scp:
    scp.put(local_db, remote_path=remote_path)

print("Restarting container to reload DB...", flush=True)
stdin, stdout, stderr = ssh.exec_command("cd ~/careq && docker compose restart crm_app")
print(stdout.read().decode())

print("SUCCESS! Data synced to production.", flush=True)
ssh.close()
