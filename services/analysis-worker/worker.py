"""
AI Video Analysis Worker
Samples video frames from LiveKit streams and scores them using OpenAI GPT-4o-mini
"""

import asyncio
import base64
import json
import logging
import os
import time
from io import BytesIO
from typing import Dict, Optional

import cv2
import numpy as np
import redis.asyncio as redis
from dotenv import load_dotenv
from livekit import rtc
from openai import AsyncOpenAI
from PIL import Image

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=getattr(logging, os.getenv('LOG_LEVEL', 'INFO').upper()),
    format='[%(levelname)s] %(asctime)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Configuration
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')
LIVEKIT_URL = os.getenv('LIVEKIT_URL', 'ws://livekit-server:7880')
LIVEKIT_API_KEY = os.getenv('LIVEKIT_API_KEY', 'devkey')
LIVEKIT_API_SECRET = os.getenv('LIVEKIT_API_SECRET', 'secret')
REDIS_URL = os.getenv('REDIS_URL', 'redis://redis:6379')
FRAME_SAMPLE_INTERVAL = float(os.getenv('FRAME_SAMPLE_INTERVAL', '3.0'))
ROOM_NAME = os.getenv('ROOM_NAME', 'geome-hackathon')

# Initialize clients
openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)


class VideoAnalyzer:
    """Analyzes video frames using OpenAI Vision API"""

    ANALYSIS_PROMPT = """Analyze this video frame and rate the level of interest/engagement on a scale of 0.0 to 1.0.

Scoring Guidelines:
- 0.9-1.0: Exceptional - Multiple people, dynamic action, clear engagement
- 0.8-0.9: High interest - Speaking, gesturing, visible emotions
- 0.6-0.8: Good interest - People visible, some movement
- 0.4-0.6: Moderate - People present but static, low energy
- 0.2-0.4: Low interest - Distant people, minimal activity
- 0.0-0.2: No interest - Empty scene, static background

Consider:
1. Number of people visible
2. Engagement level (speaking, gesturing, eye contact)
3. Movement and dynamics
4. Composition and framing
5. Context (meeting, presentation, casual)

Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{"score": 0.75, "reason": "Brief description of what you see"}"""

    def __init__(self):
        self.client = openai_client
        logger.info(f"VideoAnalyzer initialized with model: {OPENAI_MODEL}")

    async def analyze_frame(self, frame: np.ndarray) -> Dict[str, any]:
        """
        Analyze a video frame and return engagement score

        Args:
            frame: OpenCV frame (numpy array)

        Returns:
            Dict with 'score' (float 0.0-1.0) and 'reason' (str)
        """
        try:
            # Convert frame to JPEG with optimization
            # Resize to 640x480 to reduce token usage
            frame_resized = cv2.resize(frame, (640, 480))

            # Encode as JPEG with 80% quality
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 80]
            _, buffer = cv2.imencode('.jpg', frame_resized, encode_param)

            # Convert to base64
            base64_image = base64.b64encode(buffer).decode('utf-8')

            logger.debug(f"Analyzing frame: {frame_resized.shape}, {len(base64_image)} bytes")

            # Call OpenAI Vision API
            response = await self.client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": self.ANALYSIS_PROMPT},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}",
                                    "detail": "low"  # Use low detail for faster/cheaper analysis
                                }
                            }
                        ]
                    }
                ],
                max_tokens=100,
                temperature=0.3  # Lower temperature for more consistent scoring
            )

            # Parse response
            content = response.choices[0].message.content.strip()

            # Remove markdown code blocks if present
            if content.startswith('```'):
                content = content.split('\n', 1)[1]
                content = content.rsplit('\n', 1)[0]
                if content.startswith('json'):
                    content = content[4:].strip()

            result = json.loads(content)

            # Validate response
            if 'score' not in result or 'reason' not in result:
                raise ValueError(f"Invalid response format: {result}")

            # Ensure score is in valid range
            score = float(result['score'])
            if not 0.0 <= score <= 1.0:
                logger.warning(f"Score {score} out of range, clamping to [0.0, 1.0]")
                score = max(0.0, min(1.0, score))

            logger.info(f"Analysis complete: score={score:.2f}, reason={result['reason']}")

            return {
                'score': score,
                'reason': result['reason']
            }

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse OpenAI response: {e}, content: {content}")
            return {'score': 0.5, 'reason': 'Analysis failed (JSON parse error)'}
        except Exception as e:
            logger.error(f"Frame analysis error: {e}", exc_info=True)
            return {'score': 0.5, 'reason': f'Analysis failed: {str(e)}'}


class LiveKitVideoWorker:
    """Connects to LiveKit room and processes video tracks"""

    def __init__(self, analyzer: VideoAnalyzer, redis_client: redis.Redis):
        self.analyzer = analyzer
        self.redis = redis_client
        self.room = rtc.Room()
        # Changed: Track tasks per track (participant_id + track_sid), not per participant
        # This allows multiple video tracks from the same participant to be analyzed simultaneously
        self.track_tasks: Dict[str, asyncio.Task] = {}
        logger.info("LiveKitVideoWorker initialized")

    async def connect(self, url: str, token: str):
        """Connect to LiveKit room"""
        try:
            # Set up event handlers BEFORE connecting to avoid race conditions
            def track_subscribed_wrapper(track, publication, participant):
                asyncio.create_task(self.on_track_subscribed(track, publication, participant))

            self.room.on("track_subscribed", track_subscribed_wrapper)
            self.room.on("track_unsubscribed", self.on_track_unsubscribed)
            self.room.on("participant_connected", self.on_participant_connected)
            self.room.on("participant_disconnected", self.on_participant_disconnected)

            logger.info(f"Connecting to LiveKit: {url}")
            await self.room.connect(url, token)
            logger.info(f"✅ Connected to room: {self.room.name}")

            # Small delay to let LiveKit populate participant list
            await asyncio.sleep(1.0)

            # Subscribe to existing participants (if any)
            # Use participants_by_identity (correct attribute name for remote participants)
            try:
                # Get all participants except self (local_participant)
                all_participants = self.room.participants_by_identity
                # Filter out the AI worker itself
                remote_participants = {
                    identity: p for identity, p in all_participants.items()
                    if identity != "analysis-worker"
                }

                remote_count = len(remote_participants)
                logger.info(f"Found {remote_count} remote participant(s) in room")

                if remote_count > 0:
                    for identity, participant in remote_participants.items():
                        logger.info(f"👤 Found existing participant: {identity}")
                        await self.subscribe_to_participant(participant)
                else:
                    logger.info("No remote participants in room yet - waiting for participants to join...")

            except Exception as e:
                logger.error(f"Error subscribing to existing participants: {e}", exc_info=True)

        except Exception as e:
            logger.error(f"Failed to connect to LiveKit: {e}", exc_info=True)
            raise

    def on_participant_connected(self, participant: rtc.RemoteParticipant):
        """Handle new participant joining"""
        logger.info(f"👤 Participant connected: {participant.identity}")
        # Subscribe to the participant's video tracks
        asyncio.create_task(self.subscribe_to_participant(participant))

    def on_participant_disconnected(self, participant: rtc.RemoteParticipant):
        """Handle participant leaving"""
        logger.info(f"👋 Participant disconnected: {participant.identity}")

        # Cancel all processing tasks for this participant
        tasks_to_cancel = [
            task_key for task_key in self.track_tasks.keys()
            if task_key.startswith(f"{participant.identity}:")
        ]
        for task_key in tasks_to_cancel:
            self.track_tasks[task_key].cancel()
            del self.track_tasks[task_key]

    async def subscribe_to_participant(self, participant: rtc.RemoteParticipant):
        """Subscribe to participant's video track"""
        # The attribute is simply 'tracks' - a dict of track publications
        if not hasattr(participant, 'tracks'):
            logger.error(f"Participant has no 'tracks' attribute. Available: {dir(participant)}")
            return

        for track_sid, publication in participant.tracks.items():
            # Only subscribe to video tracks that have an actual track object
            if publication.kind == rtc.TrackKind.KIND_VIDEO and publication.track:
                await self.on_track_subscribed(
                    publication.track,
                    publication,
                    participant
                )

    async def on_track_subscribed(
        self,
        track: rtc.Track,
        publication: rtc.TrackPublication,
        participant: rtc.RemoteParticipant
    ):
        """Handle new track subscription"""
        if track.kind == rtc.TrackKind.KIND_VIDEO:
            # Create unique key for this track: participant_id:track_sid
            track_key = f"{participant.identity}:{track.sid}"
            track_name = getattr(publication, 'name', 'unknown')

            logger.info(f"🎥 Subscribed to video track: {participant.identity} - Track: {track_name} (SID: {track.sid})")

            # Explicitly request track to be enabled and subscribed
            try:
                publication.set_subscribed(True)
                logger.info(f"✓ Explicitly enabled subscription for {track_name}")
            except Exception as e:
                logger.warning(f"Could not set subscribed: {e}")

            # Start processing task for this specific track
            task = asyncio.create_task(
                self.process_video_track(track, participant.identity, track.sid, track_name)
            )
            self.track_tasks[track_key] = task

            logger.info(f"📊 Now tracking {len(self.track_tasks)} video track(s) total")

    def on_track_unsubscribed(
        self,
        track: rtc.Track,
        publication: rtc.TrackPublication,
        participant: rtc.RemoteParticipant
    ):
        """Handle track unsubscription"""
        if track.kind == rtc.TrackKind.KIND_VIDEO:
            track_key = f"{participant.identity}:{track.sid}"
            logger.info(f"🎥 Unsubscribed from video track: {participant.identity} (SID: {track.sid})")

            # Cancel processing task for this specific track
            if track_key in self.track_tasks:
                self.track_tasks[track_key].cancel()
                del self.track_tasks[track_key]

    async def process_video_track(self, track: rtc.VideoTrack, participant_id: str, track_sid: str, track_name: str = ""):
        """Process video frames from a track"""
        track_identifier = f"{participant_id} - {track_name}" if track_name else participant_id
        logger.info(f"Starting video processing for: {track_identifier} (Track SID: {track_sid})")

        # Debug: Check track state
        logger.info(f"Track state - SID: {track.sid}, Kind: {track.kind}")
        logger.info(f"Track muted: {track.muted}, Stream state: {track.stream_state}")
        logger.info(f"Track type: {type(track)}")

        video_stream = rtc.VideoStream(track)
        logger.info(f"VideoStream created for {track_identifier}")

        try:
            logger.info(f"Waiting for frames from {track_identifier}...")
            frame_count = 0

            # Add timeout check
            timeout_seconds = 30
            start_time = asyncio.get_event_loop().time()

            async for frame_event in video_stream:
                frame_count += 1
                logger.info(f"📹 Received frame #{frame_count} from {track_identifier}")
                logger.debug(f"Received frame from {track_identifier}")
                try:
                    # Convert LiveKit VideoFrame to numpy array
                    frame = frame_event.frame

                    # Get frame dimensions
                    height = frame.height
                    width = frame.width

                    # Convert I420 format to RGB using the frame's conversion method
                    # LiveKit frames are typically in I420 (YUV) format
                    try:
                        # Try to convert using built-in method if available
                        rgb_frame = frame.to_rgb()
                        buffer = rgb_frame.data.tobytes()
                        img_array = np.frombuffer(buffer, dtype=np.uint8)
                        img_array = img_array.reshape((height, width, 3))
                    except AttributeError:
                        # Fallback: Manual I420 to RGB conversion
                        buffer = frame.data.tobytes()

                        # I420 format has 1.5 bytes per pixel
                        # Y plane: height * width
                        # U plane: (height/2) * (width/2)
                        # V plane: (height/2) * (width/2)
                        yuv_data = np.frombuffer(buffer, dtype=np.uint8)

                        # Reshape I420 to YUV format for cv2
                        yuv_img = yuv_data.reshape((int(height * 1.5), width))

                        # Convert YUV (I420) to BGR
                        img_array = cv2.cvtColor(yuv_img, cv2.COLOR_YUV2BGR_I420)
                        frame_bgr = img_array
                    else:
                        # Convert RGB to BGR for OpenCV
                        frame_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)

                    logger.debug(f"Processing frame for {track_identifier}: {frame_bgr.shape}")

                    # Analyze frame
                    result = await self.analyzer.analyze_frame(frame_bgr)

                    # Publish score to Redis using participant ID
                    # Frontend looks up scores by participant identity
                    score_id = participant_id
                    await self.publish_score(score_id, result, track_name=track_name)

                    # Wait before processing next frame
                    await asyncio.sleep(FRAME_SAMPLE_INTERVAL)

                except Exception as e:
                    logger.error(f"Error processing frame for {track_identifier}: {e}", exc_info=True)
                    await asyncio.sleep(1)  # Backoff on errors

        except asyncio.CancelledError:
            logger.info(f"Video processing cancelled for: {track_identifier}")
        except Exception as e:
            logger.error(f"Fatal error in video processing for {track_identifier}: {e}", exc_info=True)

    async def publish_score(self, score_id: str, result: Dict[str, any], track_name: str = ""):
        """Publish score to Redis pub/sub"""
        try:
            display_name = track_name if track_name else score_id

            message = {
                'type': 'score',
                'payload': {
                    'cam_id': score_id,
                    'camId': score_id,
                    'score': result['score'],
                    'reason': result['reason'],
                    'timestamp': int(time.time() * 1000),
                    'track_name': track_name  # Include track name for better identification
                }
            }

            # Publish to Redis channel
            await self.redis.publish('scores.stream', json.dumps(message))

            logger.info(f"📊 Published score for {display_name}: {result['score']:.2f}")

        except Exception as e:
            logger.error(f"Failed to publish score: {e}", exc_info=True)


async def generate_worker_token() -> str:
    """Generate LiveKit access token for worker"""
    from livekit.api import AccessToken, VideoGrants

    token = AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    token.with_identity("analysis-worker")
    token.with_name("AI Analysis Worker")
    token.with_grants(VideoGrants(
        room_join=True,
        room=ROOM_NAME,
        can_subscribe=True,
        can_publish=False
    ))

    return token.to_jwt()


async def main():
    """Main worker loop"""
    logger.info("=" * 80)
    logger.info("🤖 AI Video Analysis Worker Starting")
    logger.info("=" * 80)
    logger.info(f"OpenAI Model: {OPENAI_MODEL}")
    logger.info(f"LiveKit URL: {LIVEKIT_URL}")
    logger.info(f"Redis URL: {REDIS_URL}")
    logger.info(f"Room: {ROOM_NAME}")
    logger.info(f"Frame Sample Interval: {FRAME_SAMPLE_INTERVAL}s")
    logger.info("=" * 80)

    # Initialize Redis
    redis_client = await redis.from_url(REDIS_URL, encoding="utf-8", decode_responses=True)
    logger.info("✅ Connected to Redis")

    # Initialize analyzer
    analyzer = VideoAnalyzer()

    # Initialize LiveKit worker
    worker = LiveKitVideoWorker(analyzer, redis_client)

    # Generate worker token
    token = await generate_worker_token()

    # Connect to room
    await worker.connect(LIVEKIT_URL, token)

    logger.info("🚀 Worker is running. Press Ctrl+C to stop.")

    # Keep running
    try:
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        logger.info("Shutting down...")
    finally:
        await worker.room.disconnect()
        await redis_client.close()
        logger.info("👋 Worker stopped")


if __name__ == "__main__":
    asyncio.run(main())
