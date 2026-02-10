import paramiko
import sys

def diagnose():
    ip = "74.208.170.62"
    user = "root"
    password = "8455381718"
    
    print(f"Connecting to {ip} for emergency diagnosis...")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(ip, username=user, password=password, timeout=30)
        
        commands = [
            "docker ps -a",
            "docker compose -f /root/careq/docker-compose.yml logs --tail=50",
            "ls -la /root/careq/",
            "docker inspect careq-crm_app-1 --format '{{.State.Status}} {{.State.Error}}'"
        ]
        
        for cmd in commands:
            print(f"\n--- RUNNING: {cmd} ---")
            stdin, stdout, stderr = ssh.exec_command(cmd)
            print(stdout.read().decode('utf-8'))
            print(stderr.read().decode('utf-8'))
            
    finally:
        ssh.close()

if __name__ == "__main__":
    diagnose()
