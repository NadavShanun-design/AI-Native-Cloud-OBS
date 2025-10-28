#!/bin/bash

###############################################################################
# Detailed VLM and TTS Testing Script
# Comprehensive testing of Vision Language Model and Text-to-Speech systems
###############################################################################

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}========================================================================"
echo -e "🔬 Detailed VLM + TTS Testing Suite"
echo -e "========================================================================${NC}"
echo ""

# Create test directory
TEST_DIR="./tmp/vlm_tts_test"
mkdir -p "$TEST_DIR"

###############################################################################
# PART 1: TTS (Text-to-Speech) Testing
###############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "🎙️  PART 1: Text-to-Speech (TTS) Testing"
echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test 1.1: Check Piper binary exists
echo -e "${BLUE}Test 1.1: Piper Binary Availability${NC}"
if docker-compose exec -T stream-narrator test -f /usr/local/bin/piper; then
    echo -e "${GREEN}✅ PASS${NC} - Piper binary exists in container"

    # Check binary architecture
    echo -e "   Checking binary architecture..."
    ARCH=$(docker-compose exec -T stream-narrator file /usr/local/bin/piper)
    echo -e "   ${CYAN}Architecture: $ARCH${NC}"
else
    echo -e "${RED}❌ FAIL${NC} - Piper binary not found"
fi
echo ""

# Test 1.2: Test TTS with simple text
echo -e "${BLUE}Test 1.2: TTS Synthesis Test${NC}"
TEST_TEXT="Hello, this is a test of the text to speech system."
echo -e "   Testing with: \"${TEST_TEXT}\""

# Execute TTS test inside container
docker-compose exec -T stream-narrator python3 << 'PYTHON_EOF'
import sys
sys.path.insert(0, '/app')
from tts_processor import TTSProcessor
import asyncio
import os

async def test_tts():
    try:
        print("   Initializing TTS processor...")
        tts = TTSProcessor()

        print("   Synthesizing test speech...")
        audio_file = await tts.synthesize("Hello, this is a test of the text to speech system.")

        audio_path = os.path.join(tts.audio_output_dir, audio_file)
        if os.path.exists(audio_path):
            size = os.path.getsize(audio_path)
            print(f"   ✅ TTS TEST PASSED: Generated {audio_file} ({size} bytes)")
            return 0
        else:
            print(f"   ❌ TTS TEST FAILED: Audio file not created")
            return 1
    except Exception as e:
        print(f"   ❌ TTS TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        return 1

sys.exit(asyncio.run(test_tts()))
PYTHON_EOF

TTS_RESULT=$?
if [ $TTS_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ PASS${NC} - TTS synthesis successful"

    # Check if audio file was created
    AUDIO_COUNT=$(ls -1 tmp/narration_audio/*.wav 2>/dev/null | wc -l | tr -d ' ')
    echo -e "   Total audio files generated: ${AUDIO_COUNT}"

    if [ $AUDIO_COUNT -gt 0 ]; then
        LATEST_AUDIO=$(ls -t tmp/narration_audio/*.wav 2>/dev/null | head -1)
        if [ -n "$LATEST_AUDIO" ]; then
            SIZE=$(ls -lh "$LATEST_AUDIO" | awk '{print $5}')
            echo -e "   Latest audio: $(basename "$LATEST_AUDIO") (${SIZE})"

            # Try to get audio duration
            if command -v ffprobe &> /dev/null; then
                DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$LATEST_AUDIO" 2>/dev/null)
                if [ -n "$DURATION" ]; then
                    echo -e "   Duration: ${DURATION}s"
                fi
            fi
        fi
    fi
else
    echo -e "${RED}❌ FAIL${NC} - TTS synthesis failed"
    echo -e "   ${YELLOW}Check logs above for error details${NC}"
fi
echo ""

# Test 1.3: Check audio quality
echo -e "${BLUE}Test 1.3: Audio Quality Check${NC}"
LATEST_AUDIO=$(ls -t tmp/narration_audio/*.wav 2>/dev/null | head -1)
if [ -n "$LATEST_AUDIO" ]; then
    # Check file size (should be > 1KB for real audio)
    SIZE_BYTES=$(stat -f%z "$LATEST_AUDIO" 2>/dev/null || stat -c%s "$LATEST_AUDIO" 2>/dev/null)
    if [ "$SIZE_BYTES" -gt 1000 ]; then
        echo -e "${GREEN}✅ PASS${NC} - Audio file size is reasonable (${SIZE_BYTES} bytes)"
    else
        echo -e "${YELLOW}⚠️  WARNING${NC} - Audio file seems too small (${SIZE_BYTES} bytes)"
    fi

    # Try to play audio (if afplay is available on macOS)
    if command -v afplay &> /dev/null; then
        echo -e "   ${CYAN}You can play the audio with: afplay \"$LATEST_AUDIO\"${NC}"
    fi
else
    echo -e "${RED}❌ FAIL${NC} - No audio files found"
fi
echo ""

###############################################################################
# PART 2: VLM (Vision Language Model) Testing
###############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "👁️  PART 2: Vision Language Model (VLM) Testing"
echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test 2.1: Check Moondream2 model loading
echo -e "${BLUE}Test 2.1: Moondream2 Model Loading${NC}"
if docker-compose logs stream-narrator | grep -q "Moondream2 VLM loaded successfully"; then
    echo -e "${GREEN}✅ PASS${NC} - Moondream2 loaded successfully"

    # Check device (CPU or GPU)
    if docker-compose logs stream-narrator | grep -q "Using CPU"; then
        echo -e "   ${CYAN}Device: CPU (slower but stable)${NC}"
    elif docker-compose logs stream-narrator | grep -q "GPU:"; then
        GPU_INFO=$(docker-compose logs stream-narrator | grep "GPU:" | tail -1)
        echo -e "   ${CYAN}Device: ${GPU_INFO}${NC}"
    fi
else
    echo -e "${RED}❌ FAIL${NC} - Moondream2 failed to load"
    echo -e "   ${YELLOW}Check logs: docker-compose logs stream-narrator | grep VLM${NC}"
fi
echo ""

# Test 2.2: Create test image
echo -e "${BLUE}Test 2.2: VLM Image Description Test${NC}"
echo -e "   Creating test image..."

# Create a simple test image with text using Python
docker-compose exec -T stream-narrator python3 << 'PYTHON_EOF'
from PIL import Image, ImageDraw, ImageFont
import os

# Create test directory
os.makedirs('/tmp/test_images', exist_ok=True)

# Create a test image with text
img = Image.new('RGB', (640, 480), color='white')
draw = ImageDraw.Draw(img)

# Draw some shapes and text
draw.rectangle([50, 50, 250, 150], fill='red', outline='black', width=3)
draw.ellipse([350, 50, 550, 250], fill='blue', outline='black', width=3)
draw.rectangle([150, 300, 450, 400], fill='green', outline='black', width=3)

# Add text (use default font)
draw.text((100, 200), "TEST IMAGE", fill='black')
draw.text((100, 250), "Red square, blue circle, green rectangle", fill='black')

# Save
img.save('/tmp/test_images/test_scene.jpg')
print("   ✅ Test image created: /tmp/test_images/test_scene.jpg")
PYTHON_EOF

echo ""

# Test 2.3: Test VLM with test image
echo -e "${BLUE}Test 2.3: VLM Description Generation${NC}"
docker-compose exec -T stream-narrator python3 << 'PYTHON_EOF'
import sys
sys.path.insert(0, '/app')
from vlm_processor import VLMProcessor
from PIL import Image
import asyncio

async def test_vlm():
    try:
        print("   Loading test image...")
        image = Image.open('/tmp/test_images/test_scene.jpg')
        print(f"   Image size: {image.size}")

        print("   Initializing VLM processor...")
        vlm = VLMProcessor()

        print("   Generating description...")
        description = await vlm.describe(image)

        print(f"   ✅ VLM TEST PASSED")
        print(f"   📝 Description: \"{description}\"")
        return 0
    except Exception as e:
        print(f"   ❌ VLM TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        return 1

sys.exit(asyncio.run(test_vlm()))
PYTHON_EOF

VLM_RESULT=$?
if [ $VLM_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ PASS${NC} - VLM successfully generated description"
else
    echo -e "${RED}❌ FAIL${NC} - VLM description generation failed"
    echo -e "   ${YELLOW}Check logs above for error details${NC}"
fi
echo ""

# Test 2.4: Check for common VLM errors in logs
echo -e "${BLUE}Test 2.4: VLM Error Analysis${NC}"
if docker-compose logs stream-narrator | grep -q "addmm_impl_cpu.*not implemented for 'Half'"; then
    echo -e "${RED}❌ CRITICAL${NC} - FP16/Half precision error detected on CPU"
    echo -e "   ${YELLOW}Issue: Model is trying to use FP16 on CPU (not supported)${NC}"
    echo -e "   ${CYAN}Fix: Model should use float32 on CPU${NC}"
elif docker-compose logs stream-narrator | grep -q "VLM inference error"; then
    echo -e "${YELLOW}⚠️  WARNING${NC} - VLM inference errors detected in logs"
    echo -e "   ${CYAN}Latest error:${NC}"
    docker-compose logs stream-narrator | grep "VLM inference error" | tail -1
else
    echo -e "${GREEN}✅ PASS${NC} - No critical VLM errors detected"
fi
echo ""

###############################################################################
# PART 3: End-to-End Integration Testing
###############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "🔄 PART 3: End-to-End Integration (VLM → TTS)"
echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${BLUE}Test 3.1: Full Pipeline Test (Image → Description → Audio)${NC}"
docker-compose exec -T stream-narrator python3 << 'PYTHON_EOF'
import sys
sys.path.insert(0, '/app')
from vlm_processor import VLMProcessor
from tts_processor import TTSProcessor
from PIL import Image, ImageDraw
import asyncio
import os

async def test_full_pipeline():
    try:
        # Create a more interesting test image
        print("   Creating test scene...")
        img = Image.new('RGB', (640, 480), color='lightblue')
        draw = ImageDraw.Draw(img)

        # Draw a person-like figure
        draw.ellipse([250, 100, 390, 240], fill='peachpuff', outline='black', width=2)  # Head
        draw.rectangle([270, 240, 370, 380], fill='red', outline='black', width=2)  # Body

        img.save('/tmp/test_images/person_scene.jpg')

        # VLM: Describe the image
        print("   🤖 Running VLM...")
        vlm = VLMProcessor()
        description = await vlm.describe(img)
        print(f"   📝 VLM Output: \"{description}\"")

        # TTS: Convert description to speech
        print("   🎙️  Running TTS...")
        tts = TTSProcessor()
        audio_file = await tts.synthesize(description)

        # Verify output
        audio_path = os.path.join(tts.audio_output_dir, audio_file)
        if os.path.exists(audio_path):
            size = os.path.getsize(audio_path)
            print(f"   🔊 Audio Output: {audio_file} ({size} bytes)")
            print(f"   ✅ FULL PIPELINE TEST PASSED")
            return 0
        else:
            print(f"   ❌ FULL PIPELINE TEST FAILED: Audio not created")
            return 1

    except Exception as e:
        print(f"   ❌ FULL PIPELINE TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        return 1

sys.exit(asyncio.run(test_full_pipeline()))
PYTHON_EOF

PIPELINE_RESULT=$?
if [ $PIPELINE_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ PASS${NC} - Full pipeline working correctly"
else
    echo -e "${RED}❌ FAIL${NC} - Full pipeline has issues"
fi
echo ""

# Test 3.2: Check Redis pub/sub
echo -e "${BLUE}Test 3.2: Redis Narration Channel${NC}"
if docker exec cloud-obs-redis redis-cli PUBSUB CHANNELS | grep -q "narration.stream"; then
    echo -e "${GREEN}✅ PASS${NC} - Narration channel is active"

    # Check for recent narrations
    echo -e "   Checking for recent narrations..."
    RECENT_NARRATIONS=$(docker-compose logs stream-narrator | grep "Published narration" | tail -3)
    if [ -n "$RECENT_NARRATIONS" ]; then
        echo -e "   ${CYAN}Recent narrations:${NC}"
        echo "$RECENT_NARRATIONS" | sed 's/^/     /'
    fi
else
    echo -e "${YELLOW}⚠️  WARNING${NC} - No active subscribers to narration channel"
fi
echo ""

###############################################################################
# SUMMARY
###############################################################################

echo -e "${CYAN}========================================================================"
echo -e "📊 Test Summary"
echo -e "========================================================================${NC}"
echo ""

# Count results
PASS_COUNT=0
FAIL_COUNT=0

if [ $TTS_RESULT -eq 0 ]; then
    ((PASS_COUNT++))
else
    ((FAIL_COUNT++))
fi

if [ $VLM_RESULT -eq 0 ]; then
    ((PASS_COUNT++))
else
    ((FAIL_COUNT++))
fi

if [ $PIPELINE_RESULT -eq 0 ]; then
    ((PASS_COUNT++))
else
    ((FAIL_COUNT++))
fi

echo -e "Results:"
echo -e "  ${GREEN}✅ Passed: $PASS_COUNT${NC}"
echo -e "  ${RED}❌ Failed: $FAIL_COUNT${NC}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! Both VLM and TTS are working correctly.${NC}"
    echo ""
    echo -e "${CYAN}The narration system is fully operational:${NC}"
    echo -e "  • Vision: Moondream2 can describe video frames"
    echo -e "  • Speech: Piper TTS can generate natural audio"
    echo -e "  • Integration: Full VLM → TTS pipeline works"
    echo ""
    echo -e "📝 Next steps:"
    echo -e "  1. Open http://localhost:3001"
    echo -e "  2. Go to the Stream tab"
    echo -e "  3. Ensure a camera has a high score"
    echo -e "  4. Listen for AI narration"
else
    echo -e "${RED}⚠️  Some tests failed. Review the output above for details.${NC}"
    echo ""
    echo -e "${YELLOW}Common Issues:${NC}"
    echo -e "  • VLM FP16 error: Model needs to use float32 on CPU"
    echo -e "  • TTS Rosetta error: Piper binary architecture mismatch"
    echo -e "  • Check: docker-compose logs stream-narrator"
fi
echo ""

# Cleanup
echo -e "${CYAN}Cleaning up test files...${NC}"
docker-compose exec -T stream-narrator rm -rf /tmp/test_images 2>/dev/null || true
echo ""
