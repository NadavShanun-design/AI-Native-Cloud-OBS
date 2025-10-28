"""
Stream Narrator Worker
Monitors #1 ranked video, generates VLM descriptions, and publishes TTS narrations
"""

import asyncio
import os
import json
import logging
import time
from typing import Optional
from collections import defaultdict

import redis.asyncio as redis
from livekit import rtc
from PIL import Image
import cv2
import numpy as np
from dotenv import load_dotenv

from vlm_processor import VLMProcessor
from tts_processor import TTSProcessor

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(levelname)s] %(asctime)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


class StreamNarrator:
    """Main Stream Narrator orchestrator"""

    def __init__(self):
        # Configuration
        self.livekit_url = os.getenv('LIVEKIT_URL')
        self.livekit_api_key = os.getenv('LIVEKIT_API_KEY')
        self.livekit_api_secret = os.getenv('LIVEKIT_API_SECRET')
        self.redis_url = os.getenv('REDIS_URL', 'redis://redis:6379')
        self.room_name = os.getenv('ROOM_NAME', 'geome-hackathon')
        self.frame_interval = float(os.getenv('FRAME_SAMPLE_INTERVAL', '5.0'))

        # State
        self.current_scores = {}
        self.current_top_camera = None
        self.room = None
        self.redis_client = None
        self.vlm_processor = None
        self.tts_processor = None
        self.current_video_stream = None
        self.running = True

        logger.info("🎙️ Stream Narrator Worker Starting")
        logger.info(f"   LiveKit URL: {self.livekit_url}")
        logger.info(f"   Room: {self.room_name}")
        logger.info(f"   Frame interval: {self.frame_interval}s")

    async def initialize(self):
        """Initialize all components"""
        try:
            # Connect to Redis
            logger.info("📡 Connecting to Redis...")
            self.redis_client = await redis.from_url(self.redis_url, decode_responses=True)
            await self.redis_client.ping()
            logger.info("✅ Connected to Redis")

            # Initialize VLM
            logger.info("🤖 Initializing VLM processor...")
            self.vlm_processor = VLMProcessor()

            # Initialize TTS
            logger.info("🎙️ Initializing TTS processor...")
            self.tts_processor = TTSProcessor()

            # Connect to LiveKit room
            logger.info(f"📹 Connecting to LiveKit room: {self.room_name}...")
            self.room = rtc.Room()
            await self.room.connect(
                self.livekit_url,
                self.generate_token()
            )
            logger.info("✅ Connected to LiveKit room")

        except Exception as e:
            logger.error(f"❌ Initialization failed: {e}")
            raise

    def generate_token(self) -> str:
        """Generate LiveKit access token"""
        from livekit import api
        token = api.AccessToken(self.livekit_api_key, self.livekit_api_secret)
        token.with_identity("stream-narrator")
        token.with_name("Stream Narrator")
        token.with_grants(api.VideoGrants(
            room_join=True,
            room=self.room_name,
            can_subscribe=True
        ))
        return token.to_jwt()

    async def monitor_rankings(self):
        """Monitor Redis scores channel and track #1 ranked camera"""
        pubsub = self.redis_client.pubsub()
        await pubsub.subscribe('scores.stream')

        logger.info("👀 Monitoring rankings...")

        async for message in pubsub.listen():
            if message['type'] != 'message':
                continue

            try:
                data = json.loads(message['data'])
                if data.get('type') == 'score':
                    payload = data['payload']
                    cam_id = payload.get('cam_id') or payload.get('camId')
                    score = payload.get('score', 0)

                    # Update scores
                    self.current_scores[cam_id] = score

                    # Find top camera
                    if self.current_scores:
                        top_camera = max(self.current_scores, key=self.current_scores.get)
                        top_score = self.current_scores[top_camera]

                        # Check if top camera changed
                        if top_camera != self.current_top_camera:
                            logger.info(f"🏆 New #1: {top_camera} (score: {top_score:.2f})")
                            self.current_top_camera = top_camera

            except Exception as e:
                logger.error(f"❌ Error processing score: {e}")

    async def process_video_stream(self):
        """Process video frames from current top-ranked camera"""
        logger.info("🎥 Starting video processing loop...")

        while self.running:
            try:
                # Wait if no top camera yet
                if not self.current_top_camera:
                    await asyncio.sleep(1)
                    continue

                # Find the video track for current top camera
                video_track = None
                # self.room.participants is a dict of {participant_id: participant}
                for participant_id, participant in self.room.participants.items():
                    # Skip the narrator itself (local participant)
                    if participant.identity == "stream-narrator":
                        continue

                    # Log all participants for debugging
                    logger.debug(f"🔍 Checking participant: {participant.identity} (tracks: {len(participant.tracks)})")

                    # Iterate through track publications to find video tracks
                    # The correct attribute is 'tracks' (not 'track_publications')
                    for track_sid, track_pub in participant.tracks.items():
                        if track_pub.track and track_pub.kind == rtc.TrackKind.KIND_VIDEO:
                            # Check if this track matches our top camera
                            # The top camera is identified by track_sid (e.g., TR_VCPMx3D4DjrKrr)
                            if track_sid == self.current_top_camera or track_pub.track.sid == self.current_top_camera:
                                video_track = track_pub.track
                                logger.info(f"✅ Found video track for {self.current_top_camera} (participant: {participant.identity})")
                                break
                    if video_track:
                        break

                if not video_track:
                    logger.debug(f"⏳ Waiting for {self.current_top_camera} video track...")
                    await asyncio.sleep(2)
                    continue

                # Create video stream
                video_stream = rtc.VideoStream(video_track)

                logger.info(f"📹 Processing video from: {self.current_top_camera}")

                # Process frames
                current_camera = self.current_top_camera
                async for frame_event in video_stream:
                    frame = frame_event.frame

                    # Check if top camera changed
                    if self.current_top_camera != current_camera:
                        logger.info("🔄 Top camera changed, switching...")
                        break

                    # Convert frame to PIL Image
                    try:
                        pil_image = self.frame_to_pil_image(frame)
                    except Exception as e:
                        logger.error(f"❌ Frame conversion error: {e}")
                        continue

                    # Generate description with VLM
                    try:
                        description = await self.vlm_processor.describe(pil_image)
                    except Exception as e:
                        logger.error(f"❌ VLM error: {e}")
                        continue

                    # Generate audio with TTS
                    try:
                        audio_filename = await self.tts_processor.synthesize(description)
                    except Exception as e:
                        logger.error(f"❌ TTS error: {e}")
                        continue

                    # Publish narration to Redis
                    try:
                        await self.publish_narration(
                            self.current_top_camera,
                            description,
                            audio_filename
                        )
                    except Exception as e:
                        logger.error(f"❌ Publish error: {e}")

                    # Cleanup old audio files
                    self.tts_processor.cleanup_old_files()

                    # Wait before next frame
                    await asyncio.sleep(self.frame_interval)

            except Exception as e:
                logger.error(f"❌ Video processing error: {e}")
                await asyncio.sleep(2)

    def frame_to_pil_image(self, frame: rtc.VideoFrame) -> Image.Image:
        """Convert LiveKit VideoFrame to PIL Image"""
        height = frame.height
        width = frame.width

        # Try to convert using built-in to_rgb() method, with fallback for I420 format
        try:
            # Try to convert using built-in method if available
            rgb_frame = frame.to_rgb()
            buffer = rgb_frame.data.tobytes()
            img_array = np.frombuffer(buffer, dtype=np.uint8)
            img_array = img_array.reshape((height, width, 3))
        except AttributeError:
            # Fallback: Manual I420 to RGB conversion
            buffer = frame.data.tobytes()
            yuv_data = np.frombuffer(buffer, dtype=np.uint8)
            yuv_img = yuv_data.reshape((int(height * 1.5), width))
            # Convert YUV (I420) to RGB
            img_array = cv2.cvtColor(yuv_img, cv2.COLOR_YUV2RGB_I420)

        # Convert to PIL Image
        pil_image = Image.fromarray(img_array, 'RGB')

        return pil_image

    async def publish_narration(self, cam_id: str, text: str, audio_filename: str):
        """Publish narration to Redis"""
        message = json.dumps({
            'type': 'narration',
            'payload': {
                'cam_id': cam_id,
                'text': text,
                'audio_url': f'/audio/{audio_filename}',
                'timestamp': int(time.time() * 1000)
            }
        })

        await self.redis_client.publish('narration.stream', message)
        logger.info(f"📤 Published narration for {cam_id}")

    async def run(self):
        """Main run loop"""
        try:
            await self.initialize()

            # Start monitoring and processing tasks
            await asyncio.gather(
                self.monitor_rankings(),
                self.process_video_stream()
            )

        except Exception as e:
            logger.error(f"❌ Fatal error: {e}")
            raise
        finally:
            if self.redis_client:
                await self.redis_client.close()
            if self.room:
                await self.room.disconnect()


async def main():
    """Entry point"""
    narrator = StreamNarrator()
    await narrator.run()


if __name__ == "__main__":
    asyncio.run(main())
