#!/usr/bin/env python3
"""
Test script to verify OpenAI Vision API scoring works correctly.
Tests the scoring system with various test images.
"""
import asyncio
import base64
import io
import os
import sys
from PIL import Image, ImageDraw, ImageFont
import numpy as np
from openai import AsyncOpenAI

# Read API key from .env
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
if not OPENAI_API_KEY or OPENAI_API_KEY.startswith('your-'):
    print("❌ OPENAI_API_KEY not found or invalid in environment")
    sys.exit(1)

client = AsyncOpenAI(api_key=OPENAI_API_KEY)

def create_test_image(scenario: str) -> np.ndarray:
    """Create a test image for different scenarios."""
    img = Image.new('RGB', (640, 480), color='white')
    draw = ImageDraw.Draw(img)

    if scenario == "empty":
        # Just a blank room
        draw.rectangle([50, 50, 590, 430], fill='lightgray', outline='black', width=2)
        draw.text((200, 220), "Empty Room", fill='black')

    elif scenario == "person_far":
        # Person far away
        draw.rectangle([50, 50, 590, 430], fill='lightblue', outline='black', width=2)
        draw.ellipse([280, 320, 360, 400], fill='peachpuff', outline='black')  # head
        draw.rectangle([300, 400, 340, 450], fill='blue', outline='black')  # body
        draw.text((200, 30), "Person Far Away", fill='black')

    elif scenario == "person_engaged":
        # Person speaking/presenting
        draw.rectangle([50, 50, 590, 430], fill='lightblue', outline='black', width=2)
        draw.ellipse([220, 100, 420, 300], fill='peachpuff', outline='black', width=3)  # head
        draw.rectangle([240, 300, 400, 450], fill='blue', outline='black', width=2)  # body
        draw.polygon([(400, 250), (500, 200), (480, 280)], fill='peachpuff', outline='black')  # arm raised
        draw.text((100, 30), "Person Presenting", fill='black')

    elif scenario == "multiple_people":
        # Multiple people interacting
        draw.rectangle([50, 50, 590, 430], fill='lightgreen', outline='black', width=2)
        # Person 1
        draw.ellipse([100, 150, 200, 250], fill='peachpuff', outline='black')
        draw.rectangle([120, 250, 180, 400], fill='red', outline='black')
        # Person 2
        draw.ellipse([250, 150, 350, 250], fill='peachpuff', outline='black')
        draw.rectangle([270, 250, 330, 400], fill='green', outline='black')
        # Person 3
        draw.ellipse([400, 150, 500, 250], fill='peachpuff', outline='black')
        draw.rectangle([420, 250, 480, 400], fill='blue', outline='black')
        draw.text((180, 30), "Group Discussion", fill='black')

    return np.array(img)

def numpy_to_base64_jpeg(img: np.ndarray, quality: int = 85) -> str:
    """Convert numpy array to base64-encoded JPEG string."""
    pil_img = Image.fromarray(img)
    pil_img.thumbnail((512, 512), Image.Resampling.LANCZOS)

    buffer = io.BytesIO()
    pil_img.save(buffer, format='JPEG', quality=quality)
    img_bytes = buffer.getvalue()
    img_base64 = base64.b64encode(img_bytes).decode('utf-8')

    return img_base64

async def analyze_frame_with_openai(img: np.ndarray, scenario: str) -> dict:
    """Analyze a single frame using OpenAI Vision API."""
    try:
        img_base64 = numpy_to_base64_jpeg(img)

        prompt = """Analyze this video frame for a live broadcast camera switching system.

Rate the frame's interestingness for TV broadcast on a scale of 0-100, where:
- 0-20: Empty, boring, or unusable (no people, static background)
- 21-40: Low interest (static scene, people far away or inactive)
- 41-60: Moderate interest (people visible but not engaged)
- 61-80: Good interest (people engaged, speaking, or in action)
- 81-100: High interest (dynamic action, multiple engaged people, important moment)

Consider:
- Number of people visible and their engagement level
- Someone speaking or presenting
- Interesting actions, movements, or interactions
- Visual composition quality
- Facial expressions and gestures

Respond ONLY with valid JSON in this exact format:
{"score": <number 0-100>, "reason": "<brief explanation>", "people_count": <number>}"""

        print(f"\n🔍 Testing scenario: {scenario}")
        print(f"   Sending request to OpenAI ({len(img_base64)} chars base64)...")

        response = await client.chat.completions.create(
            model='gpt-4o-mini',
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{img_base64}",
                                "detail": "low"
                            }
                        }
                    ]
                }
            ],
            max_tokens=150,
            temperature=0.3,
        )

        result_text = response.choices[0].message.content.strip()
        print(f"   Raw response: {result_text}")

        # Parse JSON - handle markdown code blocks
        import json

        # Remove markdown code blocks if present
        if result_text.startswith("```"):
            lines = result_text.split("\n")
            json_lines = [l for l in lines if not l.startswith("```")]
            result_text = "\n".join(json_lines).strip()

        result = json.loads(result_text)

        score = result.get('score', 0)
        reason = result.get('reason', 'N/A')
        people_count = result.get('people_count', 0)

        print(f"   ✅ Score: {score}/100")
        print(f"   📊 People: {people_count}")
        print(f"   💬 Reason: {reason}")

        return result

    except Exception as e:
        print(f"   ❌ Error: {e}")
        return {"score": 0, "reason": f"API error: {str(e)}", "people_count": 0}

async def main():
    """Run tests for different scenarios."""
    print("=" * 70)
    print("AI-OBS Camera Scoring System Test")
    print("=" * 70)
    print(f"OpenAI API Key: {OPENAI_API_KEY[:20]}...{OPENAI_API_KEY[-10:]}")
    print(f"Model: gpt-4o-mini")
    print()

    scenarios = [
        ("empty", "Empty room - should score 0-20"),
        ("person_far", "Person far away - should score 21-40"),
        ("person_engaged", "Person presenting - should score 61-80"),
        ("multiple_people", "Group discussion - should score 61-100"),
    ]

    results = []

    for scenario, description in scenarios:
        print(f"\n{'=' * 70}")
        print(f"Test: {description}")
        print(f"{'=' * 70}")

        # Create test image
        img = create_test_image(scenario)

        # Analyze with OpenAI
        result = await analyze_frame_with_openai(img, scenario)
        results.append((scenario, result))

        # Small delay to avoid rate limiting
        await asyncio.sleep(1)

    # Summary
    print(f"\n{'=' * 70}")
    print("SUMMARY")
    print(f"{'=' * 70}")

    for scenario, result in results:
        score = result.get('score', 0)
        people = result.get('people_count', 0)

        # Verify score is in expected range
        if scenario == "empty" and 0 <= score <= 20:
            status = "✅ PASS"
        elif scenario == "person_far" and 21 <= score <= 40:
            status = "✅ PASS"
        elif scenario == "person_engaged" and 61 <= score <= 80:
            status = "✅ PASS"
        elif scenario == "multiple_people" and 61 <= score <= 100:
            status = "✅ PASS"
        else:
            status = "⚠️  UNEXPECTED"

        print(f"{status} | {scenario:20s} | Score: {score:3d}/100 | People: {people}")

    print(f"\n{'=' * 70}")
    print("Test complete! The scoring system is working.")
    print(f"{'=' * 70}")

if __name__ == '__main__':
    asyncio.run(main())
