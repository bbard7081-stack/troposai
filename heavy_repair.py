import paramiko
import sys

def heavy_repair():
    ip = "74.208.170.62"
    user = "root"
    password = "8455381718"
    
    print(f"Connecting to {ip} for heavy repair...")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(ip, username=user, password=password, timeout=30)
        
        # 1. Explicitly check for .env and create it if .env.local exists
        # 2. Check docker compose version
        # 3. Pull/Build and UP with verbose logging
        repair_commands = """
        cd /root/careq
        echo "Check .env files:"
        ls -la .env*
        
        if [ ! -f ".env" ] && [ -f ".env.local" ]; then
            echo "Repairing .env from .env.local..."
            cp .env.local .env
        fi
        
        if [ ! -f ".env" ]; then
             echo "ERROR: .env STILL MISSING! Creating dummy .env to allow startup..."
             echo "NODE_ENV=production" > .env
             echo "PORT=3000" >> .env
        fi

        echo "Detecting docker-compose..."
        if command -v docker-compose > /dev/null 2>&1; then
            DOCKER_CMD="docker-compose"
        else
            DOCKER_CMD="docker compose"
        fi
        echo "Using command: $DOCKER_CMD"
        
        echo "Starting containers..."
        $DOCKER_CMD down || true
        $DOCKER_CMD up -d --build crm_app
        
        echo "Verifying startup..."
        sleep 5
        docker ps --filter name=tropos
        $DOCKER_CMD logs --tail=20 crm_app
        """
        
        stdin, stdout, stderr = ssh.exec_command(repair_commands, get_pty=True)
        for line in stdout:
            print(line.strip())
            
    finally:
        ssh.close()

if __name__ == "__main__":
    heavy_repair()
