#!/bin/bash

echo "=============================================="
echo "VLM Model Testing Script"
echo "=============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test image URL
TEST_IMAGE_URL="https://images.unsplash.com/photo-1551963831-b3b1ca40c98e"

echo -e "${BLUE}Step 1: Checking Ollama service status...${NC}"
if docker ps | grep -q cloud-obs-ollama; then
    echo -e "${GREEN}✓ Ollama container is running${NC}"
else
    echo -e "${RED}✗ Ollama container is not running${NC}"
    echo "Starting Ollama container..."
    docker-compose up -d ollama
    sleep 5
fi
echo ""

echo -e "${BLUE}Step 2: Listing available models...${NC}"
docker exec cloud-obs-ollama ollama list
echo ""

echo -e "${BLUE}Step 3: Downloading test image...${NC}"
curl -s -o /tmp/vlm_test_image.jpg "$TEST_IMAGE_URL"
if [ -f /tmp/vlm_test_image.jpg ]; then
    echo -e "${GREEN}✓ Test image downloaded${NC}"
    IMAGE_SIZE=$(ls -lh /tmp/vlm_test_image.jpg | awk '{print $5}')
    echo "Image size: $IMAGE_SIZE"
else
    echo -e "${RED}✗ Failed to download test image${NC}"
    exit 1
fi
echo ""

# Function to test a model
test_model() {
    local model_name=$1
    local model_display=$2

    echo -e "${BLUE}================================================${NC}"
    echo -e "${YELLOW}Testing: $model_display${NC}"
    echo -e "${BLUE}================================================${NC}"

    # Convert image to base64
    BASE64_IMAGE=$(base64 -i /tmp/vlm_test_image.jpg | tr -d '\n')

    # Prepare JSON payload
    PAYLOAD=$(cat <<EOF
{
  "model": "$model_name",
  "prompt": "Describe what you see in this image in one detailed sentence.",
  "images": ["$BASE64_IMAGE"],
  "stream": false
}
EOF
)

    echo "Sending request to Ollama API..."
    START_TIME=$(date +%s)

    # Make API request
    RESPONSE=$(curl -s -X POST http://localhost:11434/api/generate \
        -H "Content-Type: application/json" \
        -d "$PAYLOAD")

    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))

    # Extract response
    if echo "$RESPONSE" | grep -q "response"; then
        INSIGHT=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['response'])")
        echo -e "${GREEN}✓ Success!${NC}"
        echo ""
        echo -e "${GREEN}Model:${NC} $model_display"
        echo -e "${GREEN}Duration:${NC} ${DURATION}s"
        echo -e "${GREEN}Response:${NC}"
        echo "$INSIGHT"
        echo ""
    else
        echo -e "${RED}✗ Failed${NC}"
        echo "Error: $RESPONSE"
        echo ""
    fi
}

echo -e "${YELLOW}=============================================="
echo "Starting Model Tests"
echo "==============================================${NC}"
echo ""

# Test all three models
test_model "moondream:latest" "Moondream (1.7GB - Fast)"
test_model "llava:7b" "LLaVA 7B (4.7GB - Balanced)"
test_model "llama3.2-vision:11b" "Llama 3.2 Vision 11B (7.8GB - Best Quality)"

echo -e "${GREEN}=============================================="
echo "All tests complete!"
echo "==============================================${NC}"
echo ""
echo "Summary:"
echo "- Moondream: Best for quick analysis, runs fast"
echo "- LLaVA 7B: Balanced performance and accuracy"
echo "- Llama 3.2 Vision: Highest quality, more detailed"
echo ""
echo "You can now use the VLM Analysis page in the frontend to analyze video streams!"
