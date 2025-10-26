#!/bin/bash

# AI-OBS Startup Script with LiveKit Cloud
# This script starts all services with the correct environment variables

echo "🚀 Starting AI-OBS with LiveKit Cloud..."

# Export environment variables from .env file
export LIVEKIT_URL="wss://buildathon-bo96a3yr.livekit.cloud"
export LIVEKIT_API_KEY="API4DQvo9UNTZtR"
export LIVEKIT_API_SECRET="XbBzd81iuyFfz6iQWeWlHpYSz4weK6S2kdaUGeSkdQCD"
export OPENAI_API_KEY="${OPENAI_API_KEY}"
export OPENAI_MODEL="gpt-4o-mini"
export FRAME_SAMPLE_INTERVAL="3.0"

# Start Docker Compose
docker-compose up -d

echo "⏳ Waiting for services to be ready..."
sleep 5

# Check services
echo ""
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "✅ AI-OBS is ready!"
echo ""
echo "📱 Camera Links (via ngrok):"
echo "   Camera 1: https://patriotic-untimidly-miya.ngrok-free.dev/camera?id=cam-1"
echo "   Camera 2: https://patriotic-untimidly-miya.ngrok-free.dev/camera?id=cam-2"
echo "   Camera 3: https://patriotic-untimidly-miya.ngrok-free.dev/camera?id=cam-3"
echo "   Camera 4: https://patriotic-untimidly-miya.ngrok-free.dev/camera?id=cam-4"
echo "   Camera 5: https://patriotic-untimidly-miya.ngrok-free.dev/camera?id=cam-5"
echo ""
echo "📺 Dashboard: http://localhost:3002"
echo ""
echo "🌩️  Using LiveKit Cloud (no local server needed!)"
echo ""
