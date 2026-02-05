import os
import paramiko
from scp import SCPClient
import sys

def deploy(ip, user, password, package_path):
    print(f"Connecting to {user}@{ip}...", flush=True)
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(ip, username=user, password=password, timeout=30, banner_timeout=30)
    
    print("Uploading package...", flush=True)
    with SCPClient(ssh.get_transport()) as scp:
        scp.put(package_path, remote_path='~/')
        
    print("Upload complete. Configuring server...", flush=True)
    
    remote_commands = """
    # Install Docker if missing
    if ! command -v docker > /dev/null 2>&1; then
        echo 'Installing Docker (AlmaLinux/RHEL)...'
        dnf -y install dnf-plugins-core
        dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
        dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
        systemctl start docker
        systemctl enable docker
    fi

    # Prepare Directory
    mkdir -p ~/careq
    
    # STOP existing containers first
    cd ~/careq
    if [ -f "docker-compose.yml" ]; then
        echo 'Stopping existing containers...'
        docker compose down
    fi
    
    # CLEANUP old files (Preserve 'data' folder!)
    echo 'Cleaning old application files...'
    find . -maxdepth 1 ! -name 'data' ! -name '.' ! -name '..' -exec rm -rf {} +
    
    # Extract new package
    echo 'Extracting new package...'
    tar -xzf ~/careq_deploy.tar.gz -C ~/careq
    
    # Enter and Launch
    cd ~/careq
    echo 'Pruning old images...'
    docker system prune -af
    
    echo 'Building and Starting Containers (NO-CACHE)...'
    # Force fresh image and fresh container
    docker compose build --no-cache
    docker compose up -d --force-recreate
    
    echo 'Deployment Complete!'
    """
    
    stdin, stdout, stderr = ssh.exec_command(remote_commands, get_pty=True)
    
    # Stream output
    for line in stdout:
        # Avoid UnicodeEncodeError on Windows console (e.g., braille spinners)
        try:
            print(line.strip(), flush=True)
        except UnicodeEncodeError:
            print(line.encode('ascii', 'replace').decode('ascii').strip(), flush=True)
        
    exit_status = stdout.channel.recv_exit_status()
    if exit_status == 0:
        print(f"\nSUCCESS! Your CRM is live at: http://{ip}:3000", flush=True)
    else:
        print(f"\nDeployment failed with exit code {exit_status}", flush=True)
    
    ssh.close()

if __name__ == "__main__":
    ip = "74.208.170.62"
    user = "root"
    # Hardcoding simply because I'm running this for the user right now in this context.
    # In a real script, we'd use getpass or env vars.
    password = "8455381718" 
    package = "careq_deploy.tar.gz"
    
    if not os.path.exists(package):
        print(f"Error: {package} not found.")
        sys.exit(1)
        
    deploy(ip, user, password, package)
