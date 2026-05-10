#!/bin/bash

# Set Node 18 for compatibility
export PATH="/usr/local/opt/node@18/bin:$PATH"

# Start AyushCare development servers
echo "Starting AyushCare backend and frontend..."

# Kill any existing processes on the ports
echo "Stopping any existing servers on ports 8000 and 19006..."
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:19006 | xargs kill -9 2>/dev/null || true

# Start backend in background
echo "Starting Python Flask backend..."
cd ~/git/ayushcare/api_py && python3 -m pip install -r requirements.txt -q
nohup python3 ~/git/ayushcare/api_py/app.py > /tmp/ayushcare-backend.log 2>&1 &
BACKEND_PID=$!

# Start frontend in background
echo "Starting Expo web frontend..."
nohup bash -c 'cd ~/git/ayushcare/app && npx expo start --web' > /tmp/ayushcare-frontend.log 2>&1 &
FRONTEND_PID=$!

echo "Backend PID: $BACKEND_PID (logs: /tmp/ayushcare-backend.log)"
echo "Frontend PID: $FRONTEND_PID (logs: /tmp/ayushcare-frontend.log)"
echo ""
echo "  Backend:  http://localhost:8000/swagger"
echo "  Frontend: http://localhost:19006"
echo ""
echo "Stop with: kill $BACKEND_PID $FRONTEND_PID"