#!/usr/bin/env python3
"""Test OpenAI Vision API scoring system."""
import asyncio
import json
import base64
import io
import os
import sys
from PIL import Image, ImageDraw
from openai import AsyncOpenAI

async def test_openai_vision():
    print("=" * 60)
    print("AI-OBS OpenAI Vision API Test")
    print("=" * 60)

    api_key = os.getenv("OPENAI_API_KEY", "")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    print(f"\n1. Configuration:")
    print(f"   API Key: {api_key[:15]}...{api_key[-8:]}")
    print(f"   Model: {model}")

    # Create test image with simple person
    img = Image.new("RGB", (640, 480), color=(100, 120, 150))
    draw = ImageDraw.Draw(img)

    # Draw person
    draw.rectangle([220, 180, 420, 400], fill=(255, 200, 150))
    draw.ellipse([270, 200, 370, 300], fill=(255, 220, 180))
    draw.ellipse([295, 230, 315, 250], fill=(50, 50, 50))
    draw.ellipse([325, 230, 345, 250], fill=(50, 50, 50))
    draw.arc([300, 255, 340, 280], 0, 180, fill=(200, 50, 50), width=3)

    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=85)
    img_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

    print(f"\n2. Testing OpenAI Vision API...")

    try:
        client = AsyncOpenAI(api_key=api_key)

        prompt = """Analyze this video frame for broadcast. Rate 0-100 for interestingness.
Respond ONLY with JSON: {"score": <number>, "reason": "<text>", "people_count": <number>}"""

        print("   Sending request...")

        response = await client.chat.completions.create(
            model=model,
            messages=[{
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
            }],
            max_tokens=150,
            temperature=0.3
        )

        result_text = response.choices[0].message.content.strip()
        print(f"\n3. API Response:")
        print(f"   {result_text}")

        # Handle markdown code blocks
        if result_text.startswith("```"):
            # Extract JSON from markdown code block
            lines = result_text.split("\n")
            json_lines = [l for l in lines if not l.startswith("```")]
            result_text = "\n".join(json_lines).strip()
            print(f"\n   Cleaned JSON: {result_text}")

        result = json.loads(result_text)
        normalized_score = result["score"] / 100.0

        print(f"\n4. Parsed Results:")
        print(f"   Raw Score: {result['score']}/100")
        print(f"   Normalized: {normalized_score:.2f}")
        print(f"   Reason: {result['reason']}")
        print(f"   People Count: {result['people_count']}")

        score_data = {
            "cam_id": "test-cam-1",
            "score": normalized_score,
            "reason": result["reason"],
            "people_count": result["people_count"],
            "features": {"raw_score": result["score"]}
        }

        print(f"\n5. Score Payload:")
        print(json.dumps(score_data, indent=2))

        print(f"\n{'=' * 60}")
        print("SUCCESS: OpenAI Vision API + Scoring Working!")
        print("=" * 60)

        return True

    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_openai_vision())
    sys.exit(0 if success else 1)
