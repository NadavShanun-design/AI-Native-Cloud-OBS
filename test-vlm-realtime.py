#!/usr/bin/env python3
"""
Test improved VLM with better prompts and timeout handling
"""
import requests
import base64
from PIL import Image, ImageDraw, ImageFont
import io
import time

print("=" * 70)
print("VLM Real-Time Analysis Test - With Improvements")
print("=" * 70)
print()

def create_test_image(text, color):
    """Create a unique test image"""
    img = Image.new('RGB', (640, 480), color=color)
    draw = ImageDraw.Draw(img)

    # Draw text
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 60)
    except:
        font = ImageFont.load_default()

    draw.text((50, 200), text, fill=(255, 255, 255), font=font)

    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG', quality=85)
    img_bytes = buffer.getvalue()
    return base64.b64encode(img_bytes).decode('utf-8')

# Test 3 different images
test_cases = [
    ("RED IMAGE", (255, 0, 0), "A red background"),
    ("BLUE IMAGE", (0, 0, 255), "A blue background"),
    ("GREEN IMAGE", (0, 255, 0), "A green background"),
]

print("Testing VLM with 3 different colored images...")
print("This will verify if the VLM actually sees different frames")
print()

results = []

for text, color, expected in test_cases:
    print("-" * 70)
    print(f"Test: {text} - {expected}")
    print("-" * 70)

    base64_image = create_test_image(text, color)

    payload = {
        "image": base64_image,
        "camId": f"test_{text.lower().replace(' ', '_')}",
        "model": "moondream"
    }

    print(f"Sending request...")
    start_time = time.time()

    try:
        response = requests.post(
            "http://localhost:3001/api/vlm-analyze",
            json=payload,
            timeout=300  # 5 minute timeout
        )

        elapsed = time.time() - start_time

        if response.status_code == 200:
            data = response.json()
            result = {
                'test': text,
                'expected': expected,
                'insight': data.get('insight', 'No response'),
                'time': f"{elapsed:.1f}s",
                'success': True
            }
            results.append(result)

            print(f"✅ SUCCESS ({elapsed:.1f}s)")
            print(f"Response: \"{data.get('insight', 'No response')}\"")
            print()
        else:
            print(f"❌ FAILED: HTTP {response.status_code}")
            print(f"Response: {response.text[:200]}")
            results.append({
                'test': text,
                'success': False,
                'error': f"HTTP {response.status_code}"
            })
            print()

    except requests.exceptions.Timeout:
        print(f"❌ TIMEOUT after {time.time() - start_time:.1f}s")
        results.append({
            'test': text,
            'success': False,
            'error': 'Timeout'
        })
        print()
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        results.append({
            'test': text,
            'success': False,
            'error': str(e)
        })
        print()

print("=" * 70)
print("TEST RESULTS SUMMARY")
print("=" * 70)
print()

successful = [r for r in results if r.get('success')]
failed = [r for r in results if not r.get('success')]

print(f"Successful: {len(successful)}/{len(results)}")
print(f"Failed: {len(failed)}/{len(results)}")
print()

if successful:
    print("Successful Tests:")
    for r in successful:
        print(f"  {r['test']}: {r['insight'][:80]}...")
    print()

# Check if responses are actually different
if len(successful) >= 2:
    insights = [r['insight'] for r in successful]
    unique_insights = set(insights)

    print(f"Unique responses: {len(unique_insights)}/{len(insights)}")

    if len(unique_insights) == len(insights):
        print("✅ EXCELLENT: VLM is generating different responses for different images!")
    elif len(unique_insights) > 1:
        print("⚠️  PARTIAL: Some responses are different, but some may be repeated")
    else:
        print("❌ PROBLEM: VLM is giving identical responses for different images")
        print("   This suggests the VLM might not be properly analyzing new frames")

print()
print("=" * 70)
print("Refresh your browser to see the updated analysis!")
print("=" * 70)
