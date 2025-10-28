#!/bin/bash

###############################################################################
# Stream Narrator Test Script
# Quick tests to verify narration pipeline is working
###############################################################################

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================================================"
echo -e "🧪 Stream Narrator Test Suite"
echo -e "========================================================================${NC}"
echo ""

# Test 1: Check if container is running
echo -e "${BLUE}Test 1: Container Status${NC}"
if docker ps | grep -q "stream-narrator"; then
    echo -e "${GREEN}✅ PASS${NC} - Container is running"
else
    echo -e "${RED}❌ FAIL${NC} - Container is not running"
    echo "   Run: docker-compose up -d stream-narrator"
    exit 1
fi
echo ""

# Test 2: Check if Redis is healthy
echo -e "${BLUE}Test 2: Redis Connection${NC}"
if docker exec cloud-obs-redis redis-cli ping | grep -q "PONG"; then
    echo -e "${GREEN}✅ PASS${NC} - Redis is responding"
else
    echo -e "${RED}❌ FAIL${NC} - Redis is not responding"
    exit 1
fi
echo ""

# Test 3: Check if Moondream2 loaded
echo -e "${BLUE}Test 3: Moondream2 VLM Loading${NC}"
if docker-compose logs stream-narrator | grep -q "Moondream2 VLM loaded successfully"; then
    echo -e "${GREEN}✅ PASS${NC} - Moondream2 loaded successfully"
elif docker-compose logs stream-narrator | grep -q "Loading Moondream2"; then
    echo -e "${YELLOW}⏳ PENDING${NC} - Moondream2 is still loading..."
    echo "   This can take 2-5 minutes on first run"
else
    echo -e "${RED}❌ FAIL${NC} - Moondream2 loading failed"
    echo "   Check logs: docker-compose logs stream-narrator"
fi
echo ""

# Test 4: Check if TTS initialized
echo -e "${BLUE}Test 4: Piper TTS Initialization${NC}"
if docker-compose logs stream-narrator | grep -q "TTS Processor initialized"; then
    echo -e "${GREEN}✅ PASS${NC} - Piper TTS initialized"
elif docker-compose logs stream-narrator | grep -q "Initializing TTS"; then
    echo -e "${YELLOW}⏳ PENDING${NC} - TTS is initializing..."
else
    echo -e "${RED}❌ FAIL${NC} - TTS initialization failed"
fi
echo ""

# Test 5: Check LiveKit connection
echo -e "${BLUE}Test 5: LiveKit Connection${NC}"
if docker-compose logs stream-narrator | grep -q "Connected to LiveKit room"; then
    echo -e "${GREEN}✅ PASS${NC} - Connected to LiveKit room"
elif docker-compose logs stream-narrator | grep -q "Connecting to LiveKit"; then
    echo -e "${YELLOW}⏳ PENDING${NC} - Connecting to LiveKit..."
else
    echo -e "${RED}❌ FAIL${NC} - LiveKit connection failed"
fi
echo ""

# Test 6: Check audio directory
echo -e "${BLUE}Test 6: Audio Output Directory${NC}"
if [ -d "tmp/narration_audio" ]; then
    file_count=$(ls -1 tmp/narration_audio/*.wav 2>/dev/null | wc -l)
    echo -e "${GREEN}✅ PASS${NC} - Audio directory exists"
    echo "   Generated audio files: $file_count"
else
    echo -e "${RED}❌ FAIL${NC} - Audio directory not found"
fi
echo ""

# Test 7: Check voice model
echo -e "${BLUE}Test 7: Piper Voice Model${NC}"
if [ -f "dependencies/voices/en_US-lessac-medium.onnx" ]; then
    size=$(ls -lh dependencies/voices/en_US-lessac-medium.onnx | awk '{print $5}')
    echo -e "${GREEN}✅ PASS${NC} - Voice model exists ($size)"
else
    echo -e "${RED}❌ FAIL${NC} - Voice model not found"
fi
echo ""

# Test 8: Check API Gateway subscription
echo -e "${BLUE}Test 8: API Gateway Narration Subscription${NC}"
if docker-compose logs api-gateway | grep -q "Subscribed to Redis narration.stream"; then
    echo -e "${GREEN}✅ PASS${NC} - API Gateway subscribed to narration channel"
else
    echo -e "${YELLOW}⚠️  WARNING${NC} - API Gateway may not be subscribed"
fi
echo ""

# Summary
echo -e "${BLUE}========================================================================"
echo -e "📊 Test Summary"
echo -e "========================================================================${NC}"
echo ""

# Count passes
passes=$(grep -c "✅ PASS" <<< "$(docker ps | grep -q "stream-narrator" && echo "✅ PASS")")

if docker-compose logs stream-narrator | grep -q "Moondream2 VLM loaded successfully" && \
   docker-compose logs stream-narrator | grep -q "TTS Processor initialized" && \
   docker-compose logs stream-narrator | grep -q "Connected to LiveKit room"; then
    echo -e "${GREEN}🎉 All critical systems operational!${NC}"
    echo ""
    echo "📝 Next Steps:"
    echo "  1. Open http://localhost:3001"
    echo "  2. Go to the 🎙️ 'Stream' tab"
    echo "  3. Move in front of a camera"
    echo "  4. Listen for AI narration"
    echo ""
else
    echo -e "${YELLOW}⚠️  System is still initializing or has errors${NC}"
    echo ""
    echo "📝 Troubleshooting:"
    echo "  • Check full logs: docker-compose logs stream-narrator"
    echo "  • Monitor real-time: docker-compose logs -f stream-narrator"
    echo "  • Restart service: docker-compose restart stream-narrator"
    echo ""
fi
