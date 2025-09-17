#!/bin/bash

PID_FILE="whatsapp.pid"
LOG_FILE="whatsapp.log"

echo "📊 WhatsApp Clone Status"
echo "======================="

if [ -f "$PID_FILE" ]; then
    PID=$(cat $PID_FILE)
    if ps -p $PID > /dev/null 2>&1; then
        echo "✅ Application is running"
        echo "📍 PID: $PID"
        echo "🌐 URL: http://localhost:5001"
        echo "📄 Log file: $LOG_FILE"
        echo ""
        echo "📊 Process info:"
        ps -p $PID -o pid,ppid,cmd,etime,pcpu,pmem
        echo ""
        echo "📈 Recent logs (last 10 lines):"
        if [ -f "$LOG_FILE" ]; then
            tail -10 $LOG_FILE
        else
            echo "No log file found"
        fi
    else
        echo "❌ Application is not running (stale PID file)"
        rm -f $PID_FILE
    fi
else
    echo "❌ Application is not running"
fi

echo ""
echo "Commands:"
echo "  ./start.sh  - Start application"
echo "  ./stop.sh   - Stop application"
echo "  ./status.sh - Show this status"