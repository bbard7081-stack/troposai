import paramiko
import sys

def verify_restore():
    ip = "74.208.170.62"
    user = "root"
    password = "8455381718"
    
    print(f"Connecting to {ip} for final verification...")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(ip, username=user, password=password, timeout=30)
        
        commands = [
            "docker ps --filter name=crm_app",
            "curl -s http://localhost:3000/api/health || echo 'Health check failed'",
            "docker exec careq-crm_app-1 ls -la /app/dist/assets/index-Wb1IysKA.js || echo 'JS bundle missing in container'"
        ]
        
        for cmd in commands:
            print(f"\n--- RUNNING: {cmd} ---")
            stdin, stdout, stderr = ssh.exec_command(cmd)
            print(stdout.read().decode('utf-8'))
            print(stderr.read().decode('utf-8'))
            
    finally:
        ssh.close()

if __name__ == "__main__":
    verify_restore()
