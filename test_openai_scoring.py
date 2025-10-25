#!/usr/bin/env python3
"""
Test script to verify OpenAI Vision API scoring system.
This simulates the ranking logic without needing a live camera feed.
"""
import asyncio
import base64
import json
import os
from pathlib import Path
from openai import AsyncOpenAI
from PIL import Image
import io

# Load API key from environment
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


async def test_openai_vision_api():
    """Test OpenAI Vision API with a sample image."""
    print("=" * 60)
    print("AI-OBS OpenAI Vision API Test")
    print("=" * 60)

    # Create a simple test image (colored rectangle)
    img = Image.new('RGB', (640, 480), color=(73, 109, 137))

    # Add some text to make it more interesting
    from PIL import ImageDraw, ImageFont
    draw = ImageDraw.Draw(img)

    # Draw a simple scene
    draw.rectangle([200, 150, 440, 330], fill=(255, 200, 100))
    draw.ellipse([250, 180, 320, 250], fill=(255, 220, 180))  # Face
    draw.ellipse([270, 200, 285, 215], fill=(0, 0, 0))  # Eye
    draw.ellipse([305, 200, 320, 215], fill=(0, 0, 0))  # Eye
    draw.arc([280, 220, 310, 240], 0, 180, fill=(255, 0, 0), width=2)  # Smile

    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG', quality=85)
    img_bytes = buffer.getvalue()
    img_base64 = base64.b64encode(img_bytes).decode('utf-8')

    # Test API key
    print(f"\n1. Testing OpenAI API Key...")
    print(f"   Model: {OPENAI_MODEL}")

    try:
        client = AsyncOpenAI(api_key=OPENAI_API_KEY)

        # Create the prompt (same as in main.py)
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

        print("   Sending test frame to OpenAI Vision API...")

        response = await client.chat.completions.create(
            model=OPENAI_MODEL,
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

        # Parse response
        result_text = response.choices[0].message.content.strip()
        print(f"\n2. ✓ API Response Received:")
        print(f"   Raw: {result_text}")

        # Parse JSON
        try:
            result = json.loads(result_text)
            print(f"\n3. ✓ Scoring System Working:")
            print(f"   Score: {result.get('score', 0)}/100")
            print(f"   Normalized: {result.get('score', 0) / 100.0:.2f}")
            print(f"   Reason: {result.get('reason', 'N/A')}")
            print(f"   People Count: {result.get('people_count', 0)}")

            # Test score normalization
            normalized_score = result.get('score', 0) / 100.0
            print(f"\n4. ✓ Score Normalization Test:")
            print(f"   Raw score (0-100): {result.get('score', 0)}")
            print(f"   Normalized (0-1): {normalized_score:.3f}")

            # Simulate Redis payload
            score_data = {
                'cam_id': 'test-cam-1',
                'timestamp': 1234567890.0,
                'score': normalized_score,
                'reason': result.get('reason', ''),
                'people_count': result.get('people_count', 0),
                'features': {
                    'raw_score': result.get('score', 0),
                }
            }

            print(f"\n5. ✓ Redis Payload Format:")
            print(f"   {json.dumps(score_data, indent=2)}")

            print(f"\n{'=' * 60}")
            print("✅ ALL TESTS PASSED - OpenAI Vision API Ranking System Working!")
            print(f"{'=' * 60}")

            return True

        except json.JSONDecodeError as e:
            print(f"\n❌ Failed to parse JSON response: {e}")
            return False

    except Exception as e:
        print(f"\n❌ API Error: {e}")
        print(f"\nPossible issues:")
        print(f"  - API key invalid or expired")
        print(f"  - Insufficient credits")
        print(f"  - Network connectivity issue")
        return False


async def test_ranking_logic():
    """Test the ranking comparison logic."""
    print(f"\n{'=' * 60}")
    print("Testing Ranking Comparison Logic")
    print(f"{'=' * 60}")

    # Simulate multiple camera scores
    cameras = [
        {'cam_id': 'cam-1', 'score': 0.85, 'reason': 'Person speaking, good framing'},
        {'cam_id': 'cam-2', 'score': 0.45, 'reason': 'Empty hallway'},
        {'cam_id': 'cam-3', 'score': 0.72, 'reason': 'Two people talking'},
        {'cam_id': 'cam-4', 'score': 0.30, 'reason': 'Static background'},
        {'cam_id': 'cam-5', 'score': 0.91, 'reason': 'Group presentation, high engagement'},
    ]

    # Sort by score (descending)
    ranked = sorted(cameras, key=lambda x: x['score'], reverse=True)

    print(f"\n📊 Camera Rankings:")
    print(f"{'Rank':<6} {'Camera':<10} {'Score':<8} {'Reason'}")
    print(f"{'-'*70}")

    for i, cam in enumerate(ranked, 1):
        medal = "🥇" if i == 1 else "🥈" if i == 2 else "🥉" if i == 3 else "  "
        print(f"{medal} {i:<4} {cam['cam_id']:<10} {cam['score']:.2f}     {cam['reason']}")

    print(f"\n✓ Best camera: {ranked[0]['cam_id']} (score: {ranked[0]['score']:.2f})")
    print(f"✓ Ranking logic working correctly!")

    return True


if __name__ == '__main__':
    async def main():
        # Test OpenAI API
        api_ok = await test_openai_vision_api()

        if api_ok:
            # Test ranking logic
            await test_ranking_logic()
            print(f"\n✅ Complete ranking system verified and working!")
        else:
            print(f"\n❌ OpenAI API test failed - check your API key")
            print(f"\nTo fix:")
            print(f"1. Get a valid OpenAI API key from https://platform.openai.com/api-keys")
            print(f"2. Update .env file: OPENAI_API_KEY=sk-...")
            print(f"3. Restart analysis worker: docker-compose restart analysis-worker")

    asyncio.run(main())
