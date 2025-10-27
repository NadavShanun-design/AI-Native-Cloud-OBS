#!/bin/bash

# Cloud Observability System - Quick Start with Auto-Connect Cameras
# This script starts all services and the frontend with camera auto-connect

set -e

echo "=================================================="
echo "🚀 Cloud Observability System - Starting"
echo "=================================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Starting Docker Desktop..."
    open -a Docker
    echo "⏳ Waiting for Docker to start (15 seconds)..."
    sleep 15
fi

# Check Docker again
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker failed to start. Please start Docker Desktop manually."
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Start Docker Compose services
echo "📦 Starting backend services (go2rtc, LiveKit, Redis, API Gateway, Analysis Worker)..."
docker-compose up -d

echo "⏳ Waiting for services to initialize (5 seconds)..."
sleep 5

# Check service status
echo ""
echo "📊 Service Status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep cloud-obs

echo ""
echo "✅ Backend services started successfully!"
echo ""

# Test go2rtc
echo "🎥 Testing go2rtc camera configuration..."
if curl -s http://localhost:1984/api/streams > /dev/null; then
    CAMERA_COUNT=$(curl -s http://localhost:1984/api/streams | python3 -c "import sys, json; print(len(json.load(sys.stdin)))")
    echo "✅ go2rtc is running with $CAMERA_COUNT streams configured"
else
    echo "⚠️  Warning: go2rtc may not be ready yet"
fi

echo ""
echo "=================================================="
echo "🌐 Service URLs:"
echo "=================================================="
echo "  • Frontend:      http://localhost:3001"
echo "  • API Gateway:   http://localhost:3000"
echo "  • go2rtc Web UI: http://localhost:1984"
echo "  • LiveKit:       ws://localhost:7880"
echo ""

# Ask if user wants to start frontend
read -p "Start frontend dev server? [Y/n] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo ""
    echo "📱 Starting frontend on port 3001..."
    echo ""
    echo "=================================================="
    echo "📝 How to Use:"
    echo "=================================================="
    echo "  1. Open http://localhost:3001 in your browser"
    echo "  2. Join a room (any name)"
    echo "  3. Click hamburger menu (☰) on the left"
    echo "  4. Click 'Live' tab"
    echo "  5. Cameras will auto-connect within 5 seconds!"
    echo "  6. Look for status indicator in top-right corner"
    echo ""
    echo "📹 Camera Status: See top-right corner for connection status"
    echo "🔧 Troubleshooting: Check CAMERA_AUTO_CONNECT_GUIDE.md"
    echo ""
    echo "Press Ctrl+C to stop the frontend server"
    echo "=================================================="
    echo ""

    cd frontend
    PORT=3001 pnpm dev
else
    echo ""
    echo "✅ Backend is running. Start frontend manually with:"
    echo "   cd frontend && PORT=3001 pnpm dev"
    echo ""
fi
