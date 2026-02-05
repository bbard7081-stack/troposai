import paramiko
from scp import SCPClient
import os

ip = "74.208.170.62"
user = "root"
password = "8455381718"
local_file = "dist/index.html"
remote_path = "/root/careq/dist/index.html"

print(f"Connecting to {user}@{ip}...", flush=True)

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(ip, username=user, password=password)

print(f"Removing remote file to prevent overlap...", flush=True)
ssh.exec_command(f"rm -f {remote_path}")

print(f"Uploading {local_file}...", flush=True)
with SCPClient(ssh.get_transport()) as scp:
    scp.put(local_file, remote_path=remote_path)

print("Verifying file size on server...", flush=True)
stdin, stdout, stderr = ssh.exec_command(f"ls -l {remote_path}")
print(stdout.read().decode())

print("Restarting crm_app container...", flush=True)
ssh.exec_command("cd /root/careq && docker compose restart crm_app")

print("SUCCESS! index.html redeployed.", flush=True)
ssh.close()
