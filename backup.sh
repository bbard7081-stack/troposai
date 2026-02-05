#!/bin/bash

# Configuration
BACKUP_DIR="./backups"
DB_IMAGE_NAME="careq_crm"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="crm_backup_$TIMESTAMP.db"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

echo "🎬 Starting backup: $BACKUP_NAME..."

# Perform safe live backup using sqlite3 inside the container
# This works even while users are active!
docker exec $DB_IMAGE_NAME sqlite3 /app/data/crm_data.db ".backup /app/backups/$BACKUP_NAME"

if [ $? -eq 0 ]; then
    echo "✅ Backup successful: $BACKUP_DIR/$BACKUP_NAME"
    # Optional: Keep only the last 7 days of backups
    find $BACKUP_DIR -name "crm_backup_*.db" -mtime +7 -delete
    echo "🧹 Cleaned up backups older than 7 days."
else
    echo "❌ Backup failed!"
fi
