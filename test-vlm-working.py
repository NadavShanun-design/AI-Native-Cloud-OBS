#!/usr/bin/env python3
"""
Test VLM models with actual image analysis
"""
import requests
import base64
import json
import time
from PIL import Image
import io

print("=" * 60)
print("VLM Model Testing - Full Integration Test")
print("=" * 60)
print()

# Create a simple test image
print("📸 Creating test image...")
img = Image.new('RGB', (640, 480), color='blue')
buffer = io.BytesIO()
img.save(buffer, format='JPEG')
img_bytes = buffer.getvalue()
base64_image = base64.b64encode(img_bytes).decode('utf-8')
print(f"✓ Test image created ({len(base64_image)} chars base64)")
print()

# Test each model
models = [
    ("moondream", "Moondream (Fast)"),
    ("llava:7b", "LLaVA 7B (Balanced)"),
    ("llama3.2-vision:11b", "Llama 3.2 Vision (Best)")
]

print("Testing models via Frontend API...")
print()

for model_id, model_name in models:
    print("-" * 60)
    print(f"Testing: {model_name}")
    print("-" * 60)

    payload = {
        "image": base64_image,
        "camId": "test_camera",
        "model": model_id,
        "prompt": "What color is this image?"
    }

    print(f"Sending request to http://localhost:3001/api/vlm-analyze...")
    start_time = time.time()

    try:
        response = requests.post(
            "http://localhost:3001/api/vlm-analyze",
            json=payload,
            timeout=180  # 3 minutes timeout
        )

        elapsed = time.time() - start_time

        if response.status_code == 200:
            data = response.json()
            print(f"✅ SUCCESS!")
            print(f"   Model: {data.get('model', 'unknown')}")
            print(f"   Processing Time: {data.get('processingTime', 0) / 1000:.1f}s")
            print(f"   Total Time: {elapsed:.1f}s")
            print(f"   Response: {data.get('insight', 'No response')[:100]}...")
        else:
            print(f"❌ FAILED: HTTP {response.status_code}")
            print(f"   Error: {response.text[:200]}")

    except requests.exceptions.Timeout:
        print(f"❌ TIMEOUT after {elapsed:.1f}s")
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")

    print()

print("=" * 60)
print("Test Complete!")
print("=" * 60)
print()
print("If all tests passed, the VLM system is working correctly!")
print("You can now use it in the frontend at http://localhost:3001")
