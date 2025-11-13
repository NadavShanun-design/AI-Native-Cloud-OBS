#!/bin/bash

echo "========================================="
echo "VLM API Quick Test"
echo "========================================="
echo ""

# Create a simple red test image
python3 -c "
from PIL import Image
import base64
import io

# Create a simple red 320x240 image with text
img = Image.new('RGB', (320, 240), color=(255, 0, 0))
buffer = io.BytesIO()
img.save(buffer, format='JPEG', quality=80)
img_bytes = buffer.getvalue()
b64 = base64.b64encode(img_bytes).decode('utf-8')
print(b64)
" > /tmp/test_red.b64

BASE64_IMAGE=$(cat /tmp/test_red.b64)

echo "🧪 Testing VLM API with simple red image..."
echo "📤 Sending POST to http://localhost:3001/api/vlm-analyze"
echo ""

START_TIME=$(date +%s)

curl -s -X POST http://localhost:3001/api/vlm-analyze \
  -H "Content-Type: application/json" \
  -d "{
    \"image\": \"$BASE64_IMAGE\",
    \"camId\": \"test_simple\",
    \"model\": \"moondream\"
  }" | python3 -m json.tool

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "⏱️  Request took: ${DURATION} seconds"
echo ""

rm -f /tmp/test_red.b64
