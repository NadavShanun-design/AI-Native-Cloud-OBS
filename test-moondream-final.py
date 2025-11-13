#!/usr/bin/env python3
"""
Final test: Verify Moondream VLM works end-to-end
"""
import requests
import base64
import json
from PIL import Image, ImageDraw, ImageFont
import io

print("=" * 70)
print("FINAL TEST: Moondream VLM Integration")
print("=" * 70)
print()

# Create a more interesting test image with text
print("📸 Creating test image with visual content...")
img = Image.new('RGB', (800, 600), color=(70, 130, 180))  # Steel blue
draw = ImageDraw.Draw(img)

# Draw some shapes
draw.rectangle([100, 100, 300, 300], fill=(255, 0, 0), outline=(0, 0, 0), width=3)
draw.ellipse([400, 200, 600, 400], fill=(0, 255, 0), outline=(0, 0, 0), width=3)
draw.polygon([(700, 100), (750, 200), (650, 200)], fill=(255, 255, 0), outline=(0, 0, 0))

# Convert to base64
buffer = io.BytesIO()
img.save(buffer, format='JPEG', quality=85)
img_bytes = buffer.getvalue()
base64_image = base64.b64encode(img_bytes).decode('utf-8')
print(f"✓ Test image created: {img.size[0]}x{img.size[1]} ({len(img_bytes)} bytes)")
print()

# Test Moondream via frontend API
print("-" * 70)
print("Testing Moondream via Frontend API")
print("-" * 70)

payload = {
    "image": base64_image,
    "camId": "final_test_camera",
    "model": "moondream",
    "prompt": "Describe the shapes and colors you see in this image."
}

print(f"📤 Sending request to http://localhost:3001/api/vlm-analyze...")
print(f"   Payload size: {len(json.dumps(payload))} bytes")
print(f"   Waiting for Moondream analysis (this takes ~90 seconds)...")
print()

try:
    import time
    start_time = time.time()

    response = requests.post(
        "http://localhost:3001/api/vlm-analyze",
        json=payload,
        timeout=180
    )

    elapsed = time.time() - start_time

    if response.status_code == 200:
        data = response.json()
        print("=" * 70)
        print("✅ SUCCESS! Moondream VLM is working perfectly!")
        print("=" * 70)
        print()
        print(f"📊 Results:")
        print(f"   Model: {data.get('model', 'unknown')}")
        print(f"   Camera ID: {data.get('camId', 'unknown')}")
        print(f"   Processing Time: {data.get('processingTime', 0) / 1000:.1f}s")
        print(f"   Total Time: {elapsed:.1f}s")
        print(f"   Timestamp: {data.get('timestamp', 0)}")
        print()
        print(f"💬 VLM Insight:")
        print(f"   \"{data.get('insight', 'No response')}\"")
        print()
        print("=" * 70)
        print("🎉 VLM System is FULLY OPERATIONAL!")
        print("=" * 70)
        print()
        print("Next steps:")
        print("  1. Open http://localhost:3001 in your browser")
        print("  2. Navigate to VLM Analysis page")
        print("  3. Select 'moondream' from the model dropdown")
        print("  4. Connect your video cameras")
        print("  5. Watch it analyze frames automatically every 5 seconds!")
        print()
        print("✨ The system will now continuously analyze video frames and provide")
        print("   real-time insights about what's happening in your camera feeds.")
        print()

    else:
        print("❌ FAILED")
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {response.text[:500]}")
        print()
        print("Troubleshooting:")
        print("  - Make sure frontend is running: cd frontend && pnpm dev")
        print("  - Check Ollama: docker logs cloud-obs-ollama")
        print("  - Verify API: curl http://localhost:3001/api/vlm-analyze")

except requests.exceptions.Timeout:
    print("❌ TIMEOUT")
    print("   The request took longer than 3 minutes.")
    print("   This might mean Moondream is slower than expected or not responding.")

except requests.exceptions.ConnectionError:
    print("❌ CONNECTION ERROR")
    print("   Could not connect to http://localhost:3001")
    print("   Make sure the frontend is running:")
    print("     cd frontend && pnpm dev")

except Exception as e:
    print(f"❌ ERROR: {str(e)}")

print()
