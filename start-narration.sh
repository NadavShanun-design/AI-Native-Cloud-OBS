#!/bin/bash

###############################################################################
# Stream Narrator Startup Script
# Starts the AI narration system and monitors its health
###############################################################################

set -e

echo "========================================================================"
echo "🎙️  Starting Stream Narrator System"
echo "========================================================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ docker-compose not found. Please install Docker Compose.${NC}"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from template...${NC}"
    cat > .env << EOF
# LiveKit Configuration
LIVEKIT_URL=wss://geo-yjl7q4ad.livekit.cloud
LIVEKIT_API_KEY=APInZ2h3PwkMyPT
LIVEKIT_API_SECRET=2fJN3INJzJcxKhP6I6oWmP89ja4Dy1SFkSX6URaKMYX

# Redis Configuration
REDIS_URL=redis://redis:6379

# Room Configuration
ROOM_NAME=geome-hackathon

# Frame Processing
FRAME_SAMPLE_INTERVAL=5

# TTS Configuration
TTS_VOICE_MODEL=/app/voices/en_US-lessac-medium.onnx
AUDIO_OUTPUT_DIR=/tmp/narration_audio

# Logging
LOG_LEVEL=INFO
EOF
    echo -e "${GREEN}✅ Created .env file${NC}"
fi

# Create audio output directory if it doesn't exist
mkdir -p tmp/narration_audio
echo -e "${GREEN}✅ Audio output directory ready${NC}"

# Build services if needed
echo ""
echo "Building services..."
docker-compose build stream-narrator
echo -e "${GREEN}✅ Build complete${NC}"

# Start all services
echo ""
echo "Starting all services..."
docker-compose up -d

# Wait for services to be healthy
echo ""
echo "Waiting for services to be ready..."
sleep 5

# Check service status
echo ""
echo "========================================================================"
echo "📊 Service Status"
echo "========================================================================"

docker-compose ps

# Check stream-narrator logs
echo ""
echo "========================================================================"
echo "🎙️  Stream Narrator Logs (last 20 lines)"
echo "========================================================================"

docker-compose logs --tail=20 stream-narrator

# Check if stream-narrator is running
if docker ps | grep -q "stream-narrator"; then
    echo ""
    echo -e "${GREEN}========================================================================"
    echo -e "✅ Stream Narrator is RUNNING!"
    echo -e "========================================================================${NC}"
    echo ""
    echo "📝 Next Steps:"
    echo "  1. Open http://localhost:3001 in your browser"
    echo "  2. Navigate to the 🎙️ 'Stream' tab"
    echo "  3. Move in front of a camera"
    echo "  4. Wait 5 seconds for narration to appear"
    echo ""
    echo "📊 Monitor logs with:"
    echo "  docker-compose logs -f stream-narrator"
    echo ""
    echo "🛑 Stop services with:"
    echo "  docker-compose down"
    echo ""
else
    echo ""
    echo -e "${RED}========================================================================"
    echo -e "❌ Stream Narrator failed to start"
    echo -e "========================================================================${NC}"
    echo ""
    echo "📝 Troubleshooting:"
    echo "  1. Check logs: docker-compose logs stream-narrator"
    echo "  2. Check resources: docker stats stream-narrator"
    echo "  3. Restart: docker-compose restart stream-narrator"
    echo ""
fi
