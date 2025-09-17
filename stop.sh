#!/bin/bash

PID_FILE="whatsapp.pid"
LOG_FILE="whatsapp.log"

echo "🛑 Stopping WhatsApp Clone"
echo "=========================="

if [ ! -f "$PID_FILE" ]; then
    echo "❌ PID file not found. Application may not be running."
    exit 1
fi

PID=$(cat $PID_FILE)

if ps -p $PID > /dev/null 2>&1; then
    echo "🔄 Stopping application (PID: $PID)..."
    kill $PID
    
    # Wait for process to stop
    for i in {1..10}; do
        if ! ps -p $PID > /dev/null 2>&1; then
            break
        fi
        sleep 1
    done
    
    # Force kill if still running
    if ps -p $PID > /dev/null 2>&1; then
        echo "⚠️  Force killing application..."
        kill -9 $PID
    fi
    
    rm -f $PID_FILE
    echo "✅ Application stopped successfully!"
else
    echo "❌ Process not found (PID: $PID)"
    rm -f $PID_FILE
fi