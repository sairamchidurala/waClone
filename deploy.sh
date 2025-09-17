#!/bin/bash

# WhatsApp Clone Deploy Script
# Syncs all files to EC2 instance

SOURCE_DIR="/Users/sairamchidurala/MyCodes/repo/rtc_demo/whatsapp"
EC2_HOST="killer"
DEPLOY_DIR="/disk1/deploy/whatsapp"

echo "Deploying WhatsApp Clone to EC2..."
echo "Source: $SOURCE_DIR"
echo "Target: $EC2_HOST:$DEPLOY_DIR"

# Create deploy directory on EC2
ssh $EC2_HOST "mkdir -p $DEPLOY_DIR"

# Sync all files to EC2 (excluding .git, __pycache__, node_modules)
rsync -av --delete \
  --exclude='.git' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='node_modules' \
  --exclude='.env' \
  --exclude='uploads' \
  -e ssh \
  "$SOURCE_DIR/" "$EC2_HOST:$DEPLOY_DIR/"

echo "Deployment completed!"
echo "Files synced to EC2: $DEPLOY_DIR"