#!/bin/bash

# Configuration
EC2_USER="${EC2_USER:-ubuntu}"
REMOTE_DIR="/home/ubuntu/whatsapp_clone"

echo "📤 Copying WhatsApp Clone to EC2..."

# Create remote directory
ssh "$EC2_USER" "mkdir -p $REMOTE_DIR"

# Create tar excluding unwanted files
tar --exclude='.git' --exclude='*.log' --exclude='__pycache__' --exclude='.env' --exclude='uploads' -czf whatsapp_clone.tar.gz .

# Copy tar to EC2
scp whatsapp_clone.tar.gz "$EC2_USER:$REMOTE_DIR/"

# Extract on EC2
ssh "$EC2_USER" "cd $REMOTE_DIR && tar -xzf whatsapp_clone.tar.gz && rm whatsapp_clone.tar.gz"

# Clean up local tar
rm whatsapp_clone.tar.gz

echo "✅ Files copied to EC2!"
echo "🔗 SSH: ssh $EC2_USER"
echo "📁 Location: $REMOTE_DIR"
