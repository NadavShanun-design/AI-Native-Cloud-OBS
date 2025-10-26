#!/bin/bash

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║          Cloud OBS - AI Video Ranking System                  ║"
echo "║                    Starting Services...                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running"
    echo "   Please start Docker Desktop and try again"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "   Please create .env file with your OpenAI API key"
    exit 1
fi

echo "📦 Starting backend services (Redis, LiveKit, API Gateway, Analysis Worker)..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check service health
echo ""
echo "🔍 Checking service status..."
docker-compose ps

echo ""
echo "✅ Backend services started!"
echo ""
echo "🚀 Starting frontend..."
cd frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

# Start frontend in background
npm run dev &
FRONTEND_PID=$!

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                      🎉 System Ready!                          ║"
echo "╠════════════════════════════════════════════════════════════════╣"
echo "║                                                                ║"
echo "║  Frontend:        http://localhost:3000                       ║"
echo "║  Ranked View:     http://localhost:3000/ranked                ║"
echo "║  API Gateway:     http://localhost:3000 (backend)             ║"
echo "║  LiveKit Server:  ws://localhost:7880                         ║"
echo "║                                                                ║"
echo "║  Password:        goodvibesonly                               ║"
echo "║                                                                ║"
echo "╠════════════════════════════════════════════════════════════════╣"
echo "║                                                                ║"
echo "║  To view logs:    ./logs.sh                                   ║"
echo "║  To stop:         ./stop.sh                                   ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Press Ctrl+C to stop the frontend..."

# Wait for frontend process
wait $FRONTEND_PID
