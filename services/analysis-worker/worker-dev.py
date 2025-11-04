"""
YOLO Person Detection Worker
Samples video frames from LiveKit streams and ranks them by person count using YOLO
Publishes to Redis channel (scores.stream) for main ranking system
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
FRAME_SAMPLE_INTERVAL = float(os.getenv('FRAME_SAMPLE_INTERVAL', '1.0'))  # 1 FPS for accurate detection
ROOM_NAME = os.getenv('ROOM_NAME', 'geome-hackathon')

# Initialize clients
openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)


class YOLOPersonAnalyzer:
    """Analyzes video frames using YOLO to detect all objects and calculate person coverage percentage"""

    def __init__(self):
        from ultralytics import YOLO
        # Use YOLOv11 nano for speed - it will auto-download on first use
        self.model = YOLO('yolo11n.pt')

        # Warm up model with a dummy prediction for faster first inference
        import numpy as np
        dummy_frame = np.zeros((640, 640, 3), dtype=np.uint8)
        self.model(dummy_frame, verbose=False)

        logger.info("YOLOPersonAnalyzer initialized with yolo11n.pt (warmed up)")

    async def analyze_frame(self, frame: np.ndarray) -> Dict[str, any]:
        """
        Detect all objects and calculate person coverage percentage for ranking

        Args:
            frame: OpenCV frame (numpy array)

        Returns:
            Dict with 'score', 'person_percentage', 'person_count', 'reason', 'detections'
        """
        try:
            # Get original frame dimensions
            original_height, original_width = frame.shape[:2]

            # CRITICAL FIX: Upscale small frames for better YOLO detection
            # Small frames (< 320px) cause YOLO to miss people
            # We resize to 640x640 for optimal detection, then scale coordinates back
            min_dimension = min(original_height, original_width)
            if min_dimension < 320:
                # Upscale to 640x640 for optimal YOLO performance
                inference_frame = cv2.resize(frame, (640, 640), interpolation=cv2.INTER_LINEAR)
                scale_x = original_width / 640
                scale_y = original_height / 640
                logger.info(f"🔍 Upscaled frame from {original_width}x{original_height} to 640x640 for detection")
            else:
                # Frame is already good size, use as-is
                inference_frame = frame
                scale_x = 1.0
                scale_y = 1.0

            # Run YOLO inference on properly-sized frame
            # conf=0.15 (VERY LOW for maximum person detection sensitivity)
            # iou=0.45 (NMS threshold - Ultralytics standard)
            # max_det=300 (maximum detections)
            # classes=[0] - ONLY detect people (class 0), ignore all other objects
            results = self.model(inference_frame, conf=0.15, iou=0.45, max_det=300, classes=[0], verbose=False)

            # Calculate original frame area (for coverage percentage)
            frame_area = original_height * original_width

            # Initialize counters
            total_person_area = 0
            person_count = 0
            detections = []

            # Process all detections
            for result in results:
                for box in result.boxes:
                    # Get bounding box coordinates from inference frame (xyxy format)
                    x1_inference, y1_inference, x2_inference, y2_inference = box.xyxy[0].cpu().numpy()
                    confidence = float(box.conf[0].cpu().numpy())
                    class_id = int(box.cls[0].cpu().numpy())
                    class_name = self.model.names[class_id]

                    # Scale coordinates back to original frame size
                    x1 = x1_inference * scale_x
                    y1 = y1_inference * scale_y
                    x2 = x2_inference * scale_x
                    y2 = y2_inference * scale_y

                    # FACE-ONLY MODE: Estimate face region from person detection
                    # Face is typically in the top 25-30% of person height, centered horizontally
                    if class_id == 0:  # Only for person class
                        person_width = x2 - x1
                        person_height = y2 - y1

                        # Face region: top 30% of height, center 70% of width
                        face_height = person_height * 0.30
                        face_width = person_width * 0.70

                        # Center the face horizontally
                        face_x0 = x1 + (person_width - face_width) / 2
                        face_x1 = face_x0 + face_width

                        # Face at top of person bbox
                        face_y0 = y1
                        face_y1 = y1 + face_height

                        # Use face bbox instead of full person bbox
                        detection = {
                            'x0': float(face_x0),
                            'y0': float(face_y0),
                            'x1': float(face_x1),
                            'y1': float(face_y1),
                            'confidence': confidence,
                            'classId': class_id,
                            'className': 'face'  # Mark as face detection
                        }
                    else:
                        # Non-person objects: use original bbox
                        detection = {
                            'x0': float(x1),
                            'y0': float(y1),
                            'x1': float(x2),
                            'y1': float(y2),
                            'confidence': confidence,
                            'classId': class_id,
                            'className': class_name
                        }

                    detections.append(detection)

                    # Calculate person coverage for ranking (only for person class)
                    if class_id == 0:  # person class
                        box_width = x2 - x1
                        box_height = y2 - y1
                        box_area = box_width * box_height
                        total_person_area += box_area
                        person_count += 1

            # Calculate percentage of screen covered by people (for ranking)
            person_percentage = (total_person_area / frame_area) * 100 if frame_area > 0 else 0

            # Normalize to 0.0-1.0 for compatibility with existing score system
            normalized_score = min(person_percentage / 100.0, 1.0)

            # Summary for reason
            total_objects = len(detections)
            if person_count > 0:
                reason = f"{person_count} person(s), {person_percentage:.1f}% coverage"
            else:
                reason = f"No people detected"

            # DETAILED LOGGING for debugging
            logger.info(f"🎯 YOLO DEV RESULT: {reason}, score={normalized_score:.3f}")
            logger.info(f"   📐 Frame: {original_width}x{original_height}, Detections: {total_objects}")
            if person_count > 0:
                logger.info(f"   👤 Found {person_count} person(s) covering {person_percentage:.1f}% of frame")
                for i, det in enumerate([d for d in detections if d['classId'] == 0][:3]):  # Log first 3 people
                    logger.info(f"      Person {i+1}: confidence={det['confidence']:.2f}, bbox=({det['x0']:.0f},{det['y0']:.0f})-({det['x1']:.0f},{det['y1']:.0f})")
            else:
                logger.warning(f"   ⚠️  NO PEOPLE DETECTED in {original_width}x{original_height} frame")

            return {
                'score': normalized_score,
                'person_percentage': person_percentage,
                'person_count': person_count,
                'reason': reason,
                'detections': detections  # Include full detection data
            }

        except Exception as e:
            logger.error(f"YOLO frame analysis error: {e}", exc_info=True)
            return {
                'score': 0.0,
                'person_percentage': 0.0,
                'person_count': 0,
                'reason': f'YOLO analysis failed: {str(e)}',
                'detections': []
            }


class LiveKitVideoWorker:
    """Connects to LiveKit room and processes video tracks"""

    def __init__(self, analyzer: YOLOPersonAnalyzer, redis_client: redis.Redis):
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

            # Handler for when a track is published (triggers subscription)
            def track_published_wrapper(publication, participant):
                asyncio.create_task(self.on_track_published(publication, participant))

            self.room.on("track_published", track_published_wrapper)
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

                # DEBUG: Log all participants
                logger.info(f"DEBUG: Total participants in room: {len(all_participants)}")
                logger.info(f"DEBUG: All participant identities: {list(all_participants.keys())}")
                logger.info(f"DEBUG: Local participant identity: {self.room.local_participant.identity}")

                # Filter out the AI worker itself
                remote_participants = {
                    identity: p for identity, p in all_participants.items()
                    if identity != self.room.local_participant.identity
                }

                remote_count = len(remote_participants)
                logger.info(f"Found {remote_count} remote participant(s) in room")

                if remote_count > 0:
                    for identity, participant in remote_participants.items():
                        logger.info(f"👤 Found existing participant: {identity}")
                        logger.info(f"DEBUG: Participant {identity} has {len(participant.tracks)} tracks")
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

    async def on_track_published(
        self,
        publication: rtc.TrackPublication,
        participant: rtc.RemoteParticipant
    ):
        """Handle new track publication - explicitly subscribe to it"""
        if publication.kind == rtc.TrackKind.KIND_VIDEO:
            logger.info(f"📢 Track published: {publication.name or 'unnamed'} from {participant.identity}")
            logger.info(f"   Track SID: {publication.sid}, Subscribed: {publication.subscribed}")

            # Explicitly set subscription to true to ensure we receive frames
            try:
                publication.set_subscribed(True)
                logger.info(f"✓ Requested subscription for newly published track: {publication.sid}")
            except Exception as e:
                logger.error(f"Failed to subscribe to published track: {e}")

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

            # CRITICAL: Check if we're already processing this track
            if track_key in self.track_tasks:
                logger.info(f"⏭️  Already processing track {track.sid}, skipping duplicate subscription")
                return

            # CRITICAL FIX: Get track name from publication.name
            # If empty, use participant.name or participant.identity as fallback
            # This ensures frontend can match the score by participant identity
            if publication.name:
                track_name = publication.name
            elif participant.name:
                track_name = participant.name
            else:
                track_name = participant.identity

            # Log all identifiers for debugging
            logger.info(f"🎥 Subscribed to video track:")
            logger.info(f"   Participant: {participant.identity} ({participant.name})")
            logger.info(f"   Track Name: {track_name}")
            logger.info(f"   Track SID: {track.sid}")
            logger.info(f"   Publication Name: {publication.name}")

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
                    # Frontend looks up scores by participant identity, track_name, AND track_sid
                    score_id = participant_id
                    await self.publish_score(score_id, result, track_name=track_name, track_sid=track_sid)

                    # Wait before processing next frame (1 FPS = 1 second interval)
                    await asyncio.sleep(FRAME_SAMPLE_INTERVAL)

                except Exception as e:
                    logger.error(f"Error processing frame for {track_identifier}: {e}", exc_info=True)
                    await asyncio.sleep(1)  # Backoff on errors

        except asyncio.CancelledError:
            logger.info(f"Video processing cancelled for: {track_identifier}")
        except Exception as e:
            logger.error(f"Fatal error in video processing for {track_identifier}: {e}", exc_info=True)

    async def publish_score(self, score_id: str, result: Dict[str, any], track_name: str = "", track_sid: str = ""):
        """Publish score and detection data to Redis pub/sub (main ranking channel)"""
        try:
            display_name = track_name if track_name else score_id

            # Ensure track_sid is a string (convert if needed)
            track_sid_str = str(track_sid) if track_sid else ""

            message = {
                'type': 'score',  # Main ranking score
                'payload': {
                    'cam_id': score_id,
                    'camId': score_id,
                    'score': result['score'],
                    'reason': result['reason'],
                    'timestamp': int(time.time() * 1000),
                    'track_name': track_name,
                    'track_sid': track_sid_str,
                    'detections': result.get('detections', []),
                    'person_count': result.get('person_count', 0),
                    'person_percentage': result.get('person_percentage', 0.0)
                }
            }

            # Publish to main Redis ranking channel
            await self.redis.publish('scores.stream', json.dumps(message))

            detection_count = len(result.get('detections', []))
            logger.info(f"📊 Published YOLO score for {display_name}: {result['score']:.2f} ({detection_count} detections)")
            logger.info(f"   Keys in payload: cam_id={score_id}, track_name={track_name}, track_sid={track_sid_str}")

        except Exception as e:
            logger.error(f"Failed to publish score: {e}", exc_info=True)


async def generate_worker_token() -> str:
    """Generate LiveKit access token for worker"""
    from livekit.api import AccessToken, VideoGrants

    token = AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    token.with_identity("analysis-worker-dev")  # Different identity for dev worker
    token.with_name("AI Analysis Worker (DEV)")
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
    logger.info("🤖 YOLO Person Detection Worker Starting")
    logger.info("=" * 80)
    logger.info(f"LiveKit URL: {LIVEKIT_URL}")
    logger.info(f"Redis URL: {REDIS_URL}")
    logger.info(f"Redis Channel: scores.stream (MAIN RANKING)")
    logger.info(f"Room: {ROOM_NAME}")
    logger.info(f"Frame Sample Interval: {FRAME_SAMPLE_INTERVAL}s")
    logger.info(f"Ranking Method: YOLO Person Detection Count")
    logger.info("=" * 80)

    # Initialize Redis
    redis_client = await redis.from_url(REDIS_URL, encoding="utf-8", decode_responses=True)
    logger.info("✅ Connected to Redis")

    # Initialize YOLO analyzer
    analyzer = YOLOPersonAnalyzer()

    # Initialize LiveKit worker with YOLO analyzer
    worker = LiveKitVideoWorker(analyzer, redis_client)

    # Generate worker token
    token = await generate_worker_token()

    # Connect to room
    await worker.connect(LIVEKIT_URL, token)

    logger.info("🚀 YOLO DEV Worker is running. Press Ctrl+C to stop.")

    # Keep running
    try:
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        logger.info("Shutting down...")
    finally:
        await worker.room.disconnect()
        await redis_client.close()
        logger.info("👋 YOLO DEV Worker stopped")


if __name__ == "__main__":
    asyncio.run(main())
