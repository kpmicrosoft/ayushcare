#!/bin/bash

# Set Node 18 for compatibility
export PATH="/usr/local/opt/node@18/bin:$PATH"

# Start AyushCare development servers
echo "Starting AyushCare backend and frontend..."

# Kill any existing processes on the ports
echo "Stopping any existing servers on ports 5000 and 19006..."
lsof -ti:5000 | xargs kill -9 2>/dev/null || true
lsof -ti:19006 | xargs kill -9 2>/dev/null || true

# Start backend in background
echo "Starting Python Flask backend..."
cd ~/git/ayushcare/api_py && python3 -m pip install -r requirements.txt && python3 app.py &
BACKEND_PID=$!

# Start frontend in background
echo "Starting Expo web frontend..."
cd ~/git/ayushcare/app && npm run web &
FRONTEND_PID=$!

echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Both servers are starting in the background. Use 'kill $BACKEND_PID $FRONTEND_PID' to stop them."