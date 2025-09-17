#!/bin/bash

PID_FILE="whatsapp.pid"
LOG_FILE="whatsapp.log"

echo "🚀 Starting WhatsApp Clone (Background)"
echo "======================================"

# Check if already running
if [ -f "$PID_FILE" ]; then
    PID=$(cat $PID_FILE)
    if ps -p $PID > /dev/null 2>&1; then
        echo "❌ Application is already running (PID: $PID)"
        echo "Use ./stop.sh to stop it first"
        exit 1
    else
        rm -f $PID_FILE
    fi
fi

source ../../v_webrtc/bin/activate

# Install dependencies
echo "📦 Installing dependencies..."
pip install -r requirements.txt

# Setup database
echo "🗄️ Setting up database..."
python setup.py

# Start application in background
echo "🌐 Starting application in background..."
nohup python app.py > $LOG_FILE 2>&1 &
echo $! > $PID_FILE

echo "✅ Application started successfully!"
echo "📋 PID: $(cat $PID_FILE)"
echo "📄 Log file: $LOG_FILE"
echo "🌐 Access at: http://localhost:5001"
echo "📊 Monitor logs: tail -f $LOG_FILE"
echo "🛑 Stop with: ./stop.sh"