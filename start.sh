#!/bin/bash

echo "🚀 Starting WhatsApp Clone (No Docker)"
echo "======================================"
source ../../v_webrtc/bin/activate
# Install dependencies
echo "📦 Installing dependencies..."
pip install -r requirements.txt

# Setup database
echo "🗄️ Setting up database..."
python setup.py

# Start application
echo "🌐 Starting application..."
echo "Access at: http://localhost:5001"
echo "Demo login: +1234567890 / demo123"
python app.py