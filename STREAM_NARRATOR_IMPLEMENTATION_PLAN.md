# Stream Narrator Implementation Plan
## VLM + TTS Real-Time Video Narration System

---

## Executive Summary

This document outlines a **simple, practical, and real working approach** to implement an AI-powered live stream narrator that:
- Monitors the #1 ranked video from YOLO scoring system
- Generates real-time visual descriptions using a local VLM (Vision Language Model)
- Converts descriptions to natural speech using TTS (Text-to-Speech)
- Displays synchronized text overlay on video
- Automatically switches to new #1 ranked videos as rankings change

**Key Principle: Keep It Simple**
- Use proven, lightweight models
- Leverage existing architecture (LiveKit, Redis, WebSocket)
- Minimize latency with efficient processing
- No overcomplicated pipelines

---

## Part 1: Model Selection & Justification

### VLM (Vision Language Model): **Moondream2**

**Selected Model:** `vikhyatk/moondream2`

**Why Moondream2?**
✅ **Tiny Size**: Only 1.86B parameters (smallest viable VLM)
✅ **Fast Inference**: ~4-5 FPS on RTX 3080, faster on better GPUs
✅ **Low Memory**: Runs on 4-8GB VRAM
✅ **Edge-Optimized**: Designed for resource-constrained devices
✅ **Simple API**: Easy Python integration via transformers
✅ **Good Quality**: Decent descriptions for real-time narration
✅ **Local Hosting**: Fully offline, no API costs

**Alternatives Considered:**
- ❌ LLaVA 7B/13B: Too heavy, slower inference
- ❌ Qwen-VL: Better quality but 2-3x slower
- ❌ GPT-4 Vision: Cloud-based, expensive, latency issues

**Hardware Requirements:**
- Minimum: 8GB RAM, 4GB VRAM (CPU/GPU)
- Recommended: 16GB RAM, 6-8GB VRAM (GPU)
- Optimal: 24GB RAM, 8GB+ VRAM (GPU)

---

### TTS (Text-to-Speech): **Piper TTS**

**Selected Model:** `Piper TTS` (various voice models available)

**Why Piper TTS?**
✅ **Fastest**: Streaming with <100ms latency
✅ **Local-First**: Runs entirely offline
✅ **CPU-Friendly**: Runs on Raspberry Pi (optimized C++ core)
✅ **ONNX Runtime**: Hardware-accelerated inference
✅ **Multiple Voices**: 30+ high-quality voice models
✅ **Small Footprint**: Voice models 5-32MB each
✅ **Streaming Support**: Real-time audio generation
✅ **MIT License**: Free for commercial use

**Alternatives Considered:**
- ❌ Coqui XTTS: Better quality but slower (~200ms latency), CPML license
- ❌ Bark: Very natural but too slow for real-time
- ❌ Edge-TTS: Cloud-dependent, privacy concerns

**Recommended Voice:**
- `en_US-lessac-medium` or `en_US-amy-medium` for clear narration
- File size: ~20-30MB per voice model

---

## Part 2: System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    YOLO Analysis Worker                             │
│  - Analyzes all cameras                                             │
│  - Publishes scores to Redis: "scores.stream"                       │
│  - Rankings: camera_1 (0.75), camera_2 (0.45), camera_3 (0.30)...  │
└────────────┬───────────────────────────────────────────────────────┘
             │
             │ Redis Pub/Sub (scores.stream)
             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    NEW: Stream Narrator Worker                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ 1. Rankings Monitor                                        │    │
│  │    - Subscribes to Redis "scores.stream"                   │    │
│  │    - Identifies #1 ranked video (highest score)            │    │
│  │    - Detects ranking changes                               │    │
│  └────────────────────────────────────────────────────────────┘    │
│                         │                                            │
│                         ▼                                            │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ 2. Video Track Subscriber                                  │    │
│  │    - Connects to LiveKit room                              │    │
│  │    - Subscribes to #1 ranked video track                   │    │
│  │    - Auto-switches when #1 changes                         │    │
│  └────────────────────────────────────────────────────────────┘    │
│                         │                                            │
│                         ▼                                            │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ 3. Frame Sampler                                           │    │
│  │    - Samples frames every 3-5 seconds                      │    │
│  │    - Converts frame to PIL Image                           │    │
│  │    - Queues frame for VLM processing                       │    │
│  └────────────────────────────────────────────────────────────┘    │
│                         │                                            │
│                         ▼                                            │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ 4. VLM Processor (Moondream2)                              │    │
│  │    - Loads Moondream2 model on startup                     │    │
│  │    - Processes frame with prompt:                          │    │
│  │      "Describe what's happening in this scene in 1-2       │    │
│  │       sentences, focusing on actions and context."         │    │
│  │    - Generates natural language description                │    │
│  └────────────────────────────────────────────────────────────┘    │
│                         │                                            │
│                         ▼                                            │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ 5. TTS Generator (Piper)                                   │    │
│  │    - Converts text to speech audio                         │    │
│  │    - Generates WAV file (streaming chunks)                 │    │
│  │    - Saves audio to /tmp/narration_audio/                  │    │
│  │    - Returns audio file URL                                │    │
│  └────────────────────────────────────────────────────────────┘    │
│                         │                                            │
│                         ▼                                            │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ 6. Narration Publisher                                     │    │
│  │    - Publishes to Redis: "narration.stream"                │    │
│  │    - Message format:                                       │    │
│  │      {                                                      │    │
│  │        type: 'narration',                                  │    │
│  │        cam_id: 'camera_1',                                 │    │
│  │        text: 'A person is standing...',                    │    │
│  │        audio_url: '/audio/narration_12345.wav',            │    │
│  │        timestamp: 1698901234567                            │    │
│  │      }                                                      │    │
│  └────────────────────────────────────────────────────────────┘    │
└────────────┬───────────────────────────────────────────────────────┘
             │
             │ Redis Pub/Sub (narration.stream)
             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        API Gateway (UPDATED)                        │
│  - Subscribes to "narration.stream"                                 │
│  - Forwards narration messages to WebSocket clients                 │
│  - Serves audio files via /audio/:filename endpoint                 │
└────────────┬───────────────────────────────────────────────────────┘
             │
             │ WebSocket (ws://localhost:3000/ws)
             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Frontend: NEW "Stream" Page                       │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Rankings Subscriber                                        │    │
│  │  - Listens to WebSocket for score updates                  │    │
│  │  - Identifies #1 ranked video                              │    │
│  │  - Switches video display when #1 changes                  │    │
│  └────────────────────────────────────────────────────────────┘    │
│                         │                                            │
│                         ▼                                            │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Video Display                                              │    │
│  │  - Shows ONLY #1 ranked video (full-screen or large)       │    │
│  │  - LiveKit VideoTrack rendering                            │    │
│  │  - Auto-switches video source when #1 changes              │    │
│  └────────────────────────────────────────────────────────────┘    │
│                         │                                            │
│                         ▼                                            │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Narration Overlay                                          │    │
│  │  - Listens to WebSocket for narration updates              │    │
│  │  - Displays text overlay on video                          │    │
│  │  - Animated typing effect (optional)                       │    │
│  │  - Shows text for 5-8 seconds then fades                   │    │
│  └────────────────────────────────────────────────────────────┘    │
│                         │                                            │
│                         ▼                                            │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Audio Player                                               │    │
│  │  - Fetches audio file from API Gateway                     │    │
│  │  - Plays audio narration with HTML5 Audio element          │    │
│  │  - Auto-plays new narrations                               │    │
│  │  - Volume control                                          │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Data Flow Diagram

### Detailed Flow Sequence

```
TIME: T0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 1: YOLO publishes scores
    Redis "scores.stream": {camera_1: 0.75, camera_2: 0.45, camera_3: 0.30}

Step 2: Stream Narrator identifies #1
    #1 = camera_1 (score: 0.75)

Step 3: Subscribe to LiveKit track
    Narrator subscribes to "Camera 1" video track

Step 4: Wait for frame interval (3-5 seconds)
    ...waiting...

TIME: T+3s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 5: Sample frame
    Extract frame from video stream → PIL Image (1280x720)

Step 6: Run VLM inference
    Moondream2 processes image
    Prompt: "Describe what's happening in this scene in 1-2 sentences"
    Output: "A person is standing in a conference room, gesturing with their hands while presenting."
    Inference time: ~200-500ms

Step 7: Generate TTS audio
    Piper TTS converts text to speech
    Output: narration_12345.wav (saved to /tmp/narration_audio/)
    Generation time: ~100-300ms

Step 8: Publish narration
    Redis "narration.stream": {
        type: 'narration',
        cam_id: 'camera_1',
        text: 'A person is standing in a conference room...',
        audio_url: '/audio/narration_12345.wav',
        timestamp: 1698901234567
    }

Step 9: API Gateway forwards to WebSocket
    All connected browser clients receive narration message

Step 10: Frontend displays & plays
    - Text overlay appears on video
    - Audio plays automatically
    - Text visible for 5 seconds, then fades out

TIME: T+6s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 11: Next frame sample
    Repeat steps 5-10...

TIME: T+15s (Rankings Change!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 12: YOLO publishes new scores
    Redis "scores.stream": {camera_3: 0.85, camera_1: 0.65, camera_2: 0.40}

Step 13: Stream Narrator detects #1 change
    Previous #1: camera_1 (0.65)
    New #1: camera_3 (0.85)

Step 14: Unsubscribe from old track
    Unsubscribe from "Camera 1" track

Step 15: Subscribe to new track
    Subscribe to "Camera 3" video track

Step 16: Frontend auto-switches video
    Stream page switches from Camera 1 → Camera 3 display

Step 17: Continue narration cycle
    Now narrating Camera 3 video...
```

---

## Part 4: Detailed Implementation Steps

### Phase 1: Backend - Stream Narrator Worker

#### Step 1.1: Create New Service Directory

**Location:** `services/stream-narrator/`

**Files to Create:**
```
services/stream-narrator/
├── Dockerfile
├── requirements.txt
├── narrator.py (main file)
├── vlm_processor.py (Moondream2 handler)
├── tts_processor.py (Piper TTS handler)
└── .env (environment variables)
```

---

#### Step 1.2: Setup Dockerfile

**Base Image:** Python 3.11
**Key Dependencies:**
- PyTorch (for Moondream2)
- Transformers (Hugging Face)
- LiveKit SDK
- Redis client
- Piper TTS
- OpenCV (frame processing)
- Pillow (image handling)

**Dockerfile Strategy:**
```dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download Piper TTS voice model during build
RUN mkdir -p /app/voices && \
    wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx \
    -O /app/voices/en_US-lessac-medium.onnx

# Copy application code
COPY . /app
WORKDIR /app

CMD ["python", "narrator.py"]
```

---

#### Step 1.3: Requirements.txt

```txt
# Core
asyncio==3.4.3
python-dotenv==1.0.0

# LiveKit
livekit==0.11.0
livekit-api==0.7.0

# Redis
redis==5.0.1
aioredis==2.0.1

# VLM (Moondream2)
torch==2.1.2
torchvision==0.16.2
transformers==4.36.2
accelerate==0.25.0
einops==0.7.0

# Image processing
opencv-python-headless==4.9.0.80
Pillow==10.2.0
numpy==1.26.3

# TTS (Piper)
piper-tts==1.2.0
# OR if using from source:
# onnxruntime==1.16.3
# piper-phonemize==1.1.0

# Audio processing
soundfile==0.12.1
wave==0.0.2
```

---

#### Step 1.4: Main Narrator Worker Logic

**File:** `services/stream-narrator/narrator.py`

**Key Components:**

1. **RankingsMonitor Class**
   - Subscribes to Redis `scores.stream` channel
   - Maintains current rankings in memory
   - Identifies #1 ranked camera
   - Detects when #1 ranking changes
   - Triggers video track switch

2. **VideoTrackManager Class**
   - Connects to LiveKit room
   - Subscribes to specific video track by camera ID
   - Handles track switching when #1 changes
   - Unsubscribes from old tracks
   - Manages track lifecycle

3. **FrameSampler Class**
   - Receives video frames from LiveKit VideoStream
   - Samples frames at configured interval (3-5 seconds)
   - Converts LiveKit VideoFrame → numpy array → PIL Image
   - Queues frames for VLM processing
   - Handles frame buffering

4. **NarrationPipeline Class**
   - Orchestrates entire workflow
   - Receives frames from FrameSampler
   - Calls VLMProcessor for description
   - Calls TTSProcessor for audio generation
   - Publishes narration to Redis
   - Handles errors and retries

**Main Loop:**
```python
async def main():
    # Initialize components
    redis_client = await connect_redis()
    rankings_monitor = RankingsMonitor(redis_client)
    track_manager = VideoTrackManager()
    vlm_processor = VLMProcessor()
    tts_processor = TTSProcessor()
    narration_pipeline = NarrationPipeline(...)

    # Start rankings monitoring
    asyncio.create_task(rankings_monitor.monitor())

    # Main narration loop
    while True:
        # Get current #1 ranked camera
        top_camera = rankings_monitor.get_top_camera()

        # Subscribe to video track if changed
        if track_manager.current_camera != top_camera:
            await track_manager.switch_to_camera(top_camera)

        # Sample frame
        frame = await track_manager.get_next_frame()

        # Process frame → text description
        description = await vlm_processor.describe(frame)

        # Generate audio
        audio_path = await tts_processor.synthesize(description)

        # Publish narration
        await publish_narration(redis_client, {
            'cam_id': top_camera,
            'text': description,
            'audio_url': f'/audio/{audio_path}',
            'timestamp': time.time()
        })

        # Wait for next sample interval
        await asyncio.sleep(FRAME_SAMPLE_INTERVAL)
```

---

#### Step 1.5: VLM Processor (Moondream2)

**File:** `services/stream-narrator/vlm_processor.py`

**Key Responsibilities:**
1. Load Moondream2 model on initialization
2. Handle GPU/CPU device selection
3. Process PIL Image → text description
4. Optimize prompt for real-time narration
5. Handle inference errors gracefully

**Model Loading:**
```python
from transformers import AutoModelForCausalLM, AutoTokenizer
from PIL import Image

class VLMProcessor:
    def __init__(self):
        self.model_id = "vikhyatk/moondream2"
        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        # Load model
        self.model = AutoModelForCausalLM.from_pretrained(
            self.model_id,
            trust_remote_code=True,
            device_map=self.device,
            torch_dtype=torch.float16 if self.device == "cuda" else torch.float32
        )
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_id)

        # Optimization
        self.model.eval()
        if self.device == "cuda":
            self.model = self.model.half()  # FP16 for speed

    async def describe(self, image: Image.Image) -> str:
        # Optimized prompt for narration
        prompt = "Describe what's happening in this scene in 1-2 clear sentences, focusing on the main action or activity."

        # Run inference
        with torch.no_grad():
            # Moondream2 specific API
            encoded_image = self.model.encode_image(image)
            response = self.model.answer_question(
                encoded_image,
                prompt,
                self.tokenizer
            )

        return response.strip()
```

**Performance Optimizations:**
- Use FP16 (half precision) on GPU for 2x speedup
- Cache model on first load
- Use `torch.no_grad()` to disable gradient computation
- Batch processing if multiple frames queued (optional)

---

#### Step 1.6: TTS Processor (Piper)

**File:** `services/stream-narrator/tts_processor.py`

**Key Responsibilities:**
1. Load Piper TTS model on initialization
2. Convert text → audio (WAV format)
3. Save audio files to shared volume
4. Return audio file path/URL
5. Cleanup old audio files

**Piper TTS Integration:**
```python
import wave
from piper import PiperVoice
import uuid
import os

class TTSProcessor:
    def __init__(self):
        self.voice_model_path = "/app/voices/en_US-lessac-medium.onnx"
        self.audio_output_dir = "/tmp/narration_audio"
        os.makedirs(self.audio_output_dir, exist_ok=True)

        # Load Piper voice
        self.voice = PiperVoice.load(self.voice_model_path)

    async def synthesize(self, text: str) -> str:
        # Generate unique filename
        audio_id = str(uuid.uuid4())
        audio_filename = f"narration_{audio_id}.wav"
        audio_path = os.path.join(self.audio_output_dir, audio_filename)

        # Synthesize speech
        with wave.open(audio_path, 'wb') as wav_file:
            wav_file.setparams((1, 2, 22050, 0, 'NONE', 'NONE'))

            # Stream audio chunks from Piper
            for audio_bytes in self.voice.synthesize_stream_raw(text):
                wav_file.writeframes(audio_bytes)

        return audio_filename

    def cleanup_old_files(self, max_age_seconds=300):
        # Delete audio files older than 5 minutes
        now = time.time()
        for filename in os.listdir(self.audio_output_dir):
            filepath = os.path.join(self.audio_output_dir, filename)
            if now - os.path.getmtime(filepath) > max_age_seconds:
                os.remove(filepath)
```

**Audio File Management:**
- Save files to shared volume: `/tmp/narration_audio/`
- Mount this directory in docker-compose
- API Gateway serves files from this directory
- Cleanup old files periodically (5-10 minute TTL)

---

#### Step 1.7: Redis Narration Publishing

**Channel:** `narration.stream`

**Message Format:**
```json
{
  "type": "narration",
  "cam_id": "camera_1",
  "text": "A person is standing in a conference room, gesturing with their hands while presenting to a small audience.",
  "audio_url": "/audio/narration_a3f29c1d-4e8b-4d9e-9c5a-f8d7e6c5b4a3.wav",
  "timestamp": 1698901234567
}
```

**Publishing Code:**
```python
async def publish_narration(redis_client, narration_data):
    message = json.dumps({
        'type': 'narration',
        'payload': narration_data
    })
    await redis_client.publish('narration.stream', message)
```

---

#### Step 1.8: Docker Compose Integration

**File:** `docker-compose.yml`

**Add New Service:**
```yaml
services:
  # ... existing services ...

  stream-narrator:
    build: ./services/stream-narrator
    container_name: cloud-obs-stream-narrator
    depends_on:
      - redis
      - livekit-server
    environment:
      - LIVEKIT_URL=${LIVEKIT_URL}
      - LIVEKIT_API_KEY=${LIVEKIT_API_KEY}
      - LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET}
      - REDIS_URL=${REDIS_URL}
      - ROOM_NAME=${ROOM_NAME}
      - FRAME_SAMPLE_INTERVAL=3  # 3 seconds between frames
      - DEVICE=cuda  # or 'cpu'
    volumes:
      - ./tmp/narration_audio:/tmp/narration_audio
    networks:
      - cloud-obs-network
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]  # Enable GPU access
```

**Shared Volume:**
- Create shared directory: `./tmp/narration_audio/`
- Mount in both `stream-narrator` and `api-gateway` services
- API Gateway serves audio files from this directory

---

### Phase 2: Backend - API Gateway Updates

#### Step 2.1: Subscribe to Narration Channel

**File:** `services/api-gateway/src/server.ts`

**Add Redis Subscription:**
```typescript
// Subscribe to narration channel
await redisSubscriber.subscribe('narration.stream', (message) => {
  const narrationMessage = JSON.parse(message);

  // Broadcast to all WebSocket clients
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(narrationMessage));
    }
  });
});
```

---

#### Step 2.2: Serve Audio Files

**Add Static File Serving:**
```typescript
import fastifyStatic from '@fastify/static';
import path from 'path';

// Serve audio files
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../../tmp/narration_audio'),
  prefix: '/audio/',
  decorateReply: false
});

// Or manual endpoint:
fastify.get('/audio/:filename', async (request, reply) => {
  const { filename } = request.params;
  const audioPath = path.join('/tmp/narration_audio', filename);

  // Security check: prevent directory traversal
  if (!filename.startsWith('narration_')) {
    return reply.code(403).send({ error: 'Forbidden' });
  }

  return reply.sendFile(filename, '/tmp/narration_audio');
});
```

---

#### Step 2.3: Update Docker Compose

**File:** `docker-compose.yml`

**Update API Gateway Service:**
```yaml
services:
  api-gateway:
    # ... existing config ...
    volumes:
      - ./tmp/narration_audio:/tmp/narration_audio:ro  # Read-only access
```

---

### Phase 3: Frontend - Stream Page

#### Step 3.1: Create Stream Page Component

**Location:** `frontend/lib/StreamView.tsx`

**Key Features:**
1. Display ONLY #1 ranked video
2. Subscribe to rankings via WebSocket
3. Auto-switch video when #1 changes
4. Subscribe to narration updates via WebSocket
5. Display text overlay on video
6. Play audio narration
7. Volume control

**Component Structure:**
```typescript
// StreamView.tsx (structure only, not full code)

interface Narration {
  cam_id: string;
  text: string;
  audio_url: string;
  timestamp: number;
}

export function StreamView({ aiScores, room }) {
  // State
  const [topCamera, setTopCamera] = useState<string | null>(null);
  const [currentNarration, setCurrentNarration] = useState<Narration | null>(null);
  const [audioVolume, setAudioVolume] = useState(0.8);

  // Find #1 ranked camera
  useEffect(() => {
    const sorted = Array.from(aiScores.entries())
      .sort((a, b) => b[1].score - a[1].score);

    if (sorted.length > 0) {
      const newTopCamera = sorted[0][0];
      if (newTopCamera !== topCamera) {
        setTopCamera(newTopCamera);
        setCurrentNarration(null); // Clear old narration
      }
    }
  }, [aiScores]);

  // Subscribe to narrations via WebSocket
  useEffect(() => {
    // WebSocket is already connected in parent component
    // Listen for narration messages
    const handleNarration = (message) => {
      if (message.type === 'narration') {
        setCurrentNarration(message.payload);
      }
    };

    // Add listener (implementation depends on WebSocket setup)
    addWebSocketListener('narration', handleNarration);

    return () => removeWebSocketListener('narration', handleNarration);
  }, []);

  // Get top video track
  const topVideoTrack = useMemo(() => {
    if (!topCamera || !room) return null;

    // Find track by camera ID
    const participants = Array.from(room.participants.values());
    for (const participant of participants) {
      const videoTrack = participant.getTrack(Track.Source.Camera);
      if (videoTrack && participant.identity === topCamera) {
        return videoTrack;
      }
    }
    return null;
  }, [topCamera, room]);

  return (
    <div className={styles.streamContainer}>
      {/* Video Display */}
      <div className={styles.videoWrapper}>
        {topVideoTrack ? (
          <VideoTrack track={topVideoTrack} />
        ) : (
          <div className={styles.placeholder}>
            Waiting for top-ranked video...
          </div>
        )}

        {/* Text Overlay */}
        {currentNarration && (
          <div className={styles.textOverlay}>
            <p className={styles.narrationText}>
              {currentNarration.text}
            </p>
          </div>
        )}
      </div>

      {/* Audio Player (hidden) */}
      {currentNarration && (
        <AudioPlayer
          src={`http://localhost:3000${currentNarration.audio_url}`}
          volume={audioVolume}
          autoPlay
        />
      )}

      {/* Volume Control */}
      <div className={styles.controls}>
        <VolumeControl
          volume={audioVolume}
          onChange={setAudioVolume}
        />
      </div>

      {/* Debug Info (optional) */}
      {process.env.NODE_ENV === 'development' && (
        <div className={styles.debugInfo}>
          <p>Top Camera: {topCamera}</p>
          <p>Narration: {currentNarration?.text}</p>
        </div>
      )}
    </div>
  );
}
```

---

#### Step 3.2: Audio Player Component

**Location:** `frontend/lib/AudioPlayer.tsx`

**Features:**
- HTML5 Audio element
- Auto-play new narrations
- Volume control
- Loading state
- Error handling

**Component:**
```typescript
interface AudioPlayerProps {
  src: string;
  volume: number;
  autoPlay?: boolean;
}

export function AudioPlayer({ src, volume, autoPlay = true }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Play new audio
  useEffect(() => {
    if (audioRef.current && autoPlay) {
      audioRef.current.play().catch(err => {
        console.error('Audio playback failed:', err);
      });
    }
  }, [src]);

  return (
    <audio
      ref={audioRef}
      src={src}
      preload="auto"
      style={{ display: 'none' }}
    />
  );
}
```

---

#### Step 3.3: Text Overlay with Fade Animation

**CSS Module:** `frontend/styles/StreamView.module.css`

**Features:**
- Text appears at bottom of video
- Semi-transparent background
- Fade in/out animation
- Typewriter effect (optional)

**Styles:**
```css
.streamContainer {
  width: 100%;
  height: 100vh;
  background: #000;
  display: flex;
  flex-direction: column;
}

.videoWrapper {
  position: relative;
  flex: 1;
  width: 100%;
  overflow: hidden;
}

.videoWrapper video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.textOverlay {
  position: absolute;
  bottom: 40px;
  left: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.75);
  padding: 20px 30px;
  border-radius: 12px;
  backdrop-filter: blur(10px);
  animation: fadeIn 0.5s ease-in;
}

.narrationText {
  color: #fff;
  font-size: 18px;
  line-height: 1.5;
  margin: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  font-weight: 500;
}

/* Fade in animation */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Fade out after 5 seconds */
.textOverlay.fadeOut {
  animation: fadeOut 0.5s ease-out forwards;
}

@keyframes fadeOut {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(20px);
  }
}

.controls {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 10;
}
```

---

#### Step 3.4: Add to Sidebar Navigation

**File:** `frontend/lib/Sidebar.tsx`

**Update Menu Items:**
```typescript
const menuItems = [
  { id: 'live', label: 'Live2' },
  { id: 'ranked', label: 'Ranked' },
  { id: 'view', label: 'YOLO' },
  { id: 'yolo-dev', label: 'YOLO DEV' },
  { id: 'stream', label: 'Stream', icon: '🎙️' },  // NEW
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'personalize', label: 'Personalize' },
  { id: 'external-stream', label: 'Add Stream' }
];
```

---

#### Step 3.5: Integrate into Main App

**File:** `frontend/app/custom/VideoConferenceClientImpl.tsx`

**Add Stream View:**
```typescript
// Add state for narrations
const [currentNarration, setCurrentNarration] = useState<Narration | null>(null);

// Update WebSocket handler
useEffect(() => {
  if (!ws) return;

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);

    if (message.type === 'score' || message.type === 'yolo-dev-score') {
      // Handle scores (existing code)
      ...
    }

    // NEW: Handle narration messages
    if (message.type === 'narration') {
      setCurrentNarration(message.payload);

      // Auto-hide after 5 seconds
      setTimeout(() => {
        setCurrentNarration(null);
      }, 5000);
    }
  };
}, [ws]);

// Render Stream view
{activeView === 'stream' && (
  <StreamView
    aiScores={aiScores}
    room={room}
    currentNarration={currentNarration}
  />
)}
```

---

## Part 5: Technical Specifications

### Performance Targets

**Frame Processing:**
- Sample interval: 3-5 seconds per frame
- VLM inference: 200-500ms per frame
- TTS generation: 100-300ms per sentence
- **Total latency: <1 second** (frame → narration)

**Narration Delivery:**
- WebSocket latency: 50-100ms
- Audio file loading: 100-200ms
- **Total delivery: <500ms** (server → browser)

**End-to-End Latency:**
- **Target: 1.5-2 seconds** (action happens → you hear it)

---

### Hardware Requirements

**Stream Narrator Service:**
- **Minimum (CPU only):**
  - 8GB RAM
  - 4-core CPU
  - Performance: ~1-2 FPS VLM processing

- **Recommended (GPU):**
  - 16GB RAM
  - NVIDIA GPU with 6-8GB VRAM (RTX 3060 or better)
  - Performance: ~4-5 FPS VLM processing

- **Optimal (GPU):**
  - 24GB RAM
  - NVIDIA GPU with 8GB+ VRAM (RTX 3080 or better)
  - Performance: ~8-10 FPS VLM processing

---

### Disk Space

**Models:**
- Moondream2: ~3.5GB (downloaded on first run)
- Piper voice model: ~30MB
- Total: ~4GB

**Audio Files:**
- Average: 50-200KB per narration
- Retention: 5-10 minutes (auto-cleanup)
- Max storage: ~50MB (with cleanup)

---

### Network Bandwidth

**Per Client:**
- Video stream: 1-3 Mbps (existing)
- WebSocket: ~5-10 KB/s (scores + narrations)
- Audio files: 50-200 KB per narration (~10-40 KB/s average)
- **Total: 1-3.5 Mbps per client**

---

## Part 6: Configuration & Environment Variables

### Stream Narrator Worker

**.env file:**
```bash
# LiveKit
LIVEKIT_URL=wss://geo-yjl7q4ad.livekit.cloud
LIVEKIT_API_KEY=APInZ2h3PwkMyPT
LIVEKIT_API_SECRET=2fJN3INJzJcxKhP6I6oWmP89ja4Dy1SFkSX6URaKMYX

# Redis
REDIS_URL=redis://redis:6379

# Room
ROOM_NAME=geome-hackathon

# Frame Processing
FRAME_SAMPLE_INTERVAL=3  # seconds between frames (3-5 recommended)

# VLM Settings
VLM_MODEL=vikhyatk/moondream2
VLM_PROMPT="Describe what's happening in this scene in 1-2 clear sentences, focusing on the main action or activity."
DEVICE=cuda  # or 'cpu'

# TTS Settings
TTS_VOICE_MODEL=/app/voices/en_US-lessac-medium.onnx
TTS_SAMPLE_RATE=22050

# Audio Storage
AUDIO_OUTPUT_DIR=/tmp/narration_audio
AUDIO_CLEANUP_INTERVAL=300  # seconds (5 minutes)

# Logging
LOG_LEVEL=INFO
```

---

## Part 7: Testing Strategy

### Phase 1: Unit Testing

**Test VLM Processor:**
1. Load model successfully
2. Process sample image → text description
3. Handle invalid images gracefully
4. Measure inference time

**Test TTS Processor:**
1. Load Piper voice model
2. Generate audio from sample text
3. Verify audio file format (WAV, 22050 Hz)
4. Measure synthesis time

**Test Rankings Monitor:**
1. Subscribe to Redis scores channel
2. Identify #1 ranked camera correctly
3. Detect ranking changes
4. Handle edge cases (no scores, tie scores)

---

### Phase 2: Integration Testing

**Test Backend Pipeline:**
1. Start all Docker services
2. Verify stream-narrator connects to LiveKit
3. Verify stream-narrator subscribes to #1 video
4. Sample frame and process with VLM
5. Generate audio with TTS
6. Publish narration to Redis
7. Verify API Gateway receives narration
8. Verify WebSocket broadcasts narration

**Test Auto-Switching:**
1. Simulate ranking change (publish new scores to Redis)
2. Verify narrator switches to new #1 camera
3. Verify frontend switches video display
4. Verify narration continues on new camera

---

### Phase 3: Frontend Testing

**Test Stream Page:**
1. Open Stream page in browser
2. Verify #1 ranked video displays
3. Wait for narration to appear
4. Verify text overlay shows correct text
5. Verify audio plays automatically
6. Verify text fades out after 5 seconds
7. Test volume control
8. Simulate ranking change → verify video switches

---

### Phase 4: Performance Testing

**Measure Latencies:**
1. Frame sampling → VLM inference: Target <500ms
2. TTS generation: Target <300ms
3. WebSocket delivery: Target <100ms
4. Total end-to-end: Target <2 seconds

**Load Testing:**
1. Test with multiple clients viewing Stream page
2. Verify single narrator instance handles load
3. Check CPU/GPU usage
4. Check memory usage
5. Check audio file cleanup

---

## Part 8: Troubleshooting Guide

### Common Issues

**Issue 1: VLM inference is too slow**
- **Symptom:** Narrations lag behind video by >5 seconds
- **Solutions:**
  - Enable GPU if available (set `DEVICE=cuda`)
  - Use FP16 precision (model.half())
  - Increase `FRAME_SAMPLE_INTERVAL` to 5-7 seconds
  - Reduce image resolution before inference
  - Consider lighter VLM (e.g., SmolVLM)

**Issue 2: Audio playback issues**
- **Symptom:** Audio not playing in browser
- **Solutions:**
  - Check browser console for errors
  - Verify audio file URL is correct
  - Check CORS headers in API Gateway
  - Test audio file directly in browser
  - Check browser autoplay policies (may need user interaction)

**Issue 3: Video not switching**
- **Symptom:** Stream page stuck on old camera when rankings change
- **Solutions:**
  - Check WebSocket connection is active
  - Verify rankings monitor is detecting changes
  - Check React state updates in StreamView
  - Verify LiveKit track switching logic
  - Check browser console for errors

**Issue 4: Narration text doesn't match video**
- **Symptom:** Description is wrong or outdated
- **Solutions:**
  - Check frame sampling timestamp
  - Verify correct video track is subscribed
  - Check if rankings changed mid-processing
  - Increase `FRAME_SAMPLE_INTERVAL` for more context
  - Improve VLM prompt for better descriptions

**Issue 5: Out of memory errors**
- **Symptom:** Docker container crashes or freezes
- **Solutions:**
  - Increase Docker memory limit
  - Enable GPU to offload processing
  - Reduce model size (CPU mode)
  - Check for memory leaks (audio file cleanup)
  - Monitor memory usage with docker stats

---

## Part 9: Optimization Opportunities

### Short-Term (Immediate)

1. **Batch Frame Processing:**
   - Queue multiple frames and process in batch
   - Amortize model loading overhead
   - Increase throughput by 20-30%

2. **Audio Caching:**
   - Cache common phrases/descriptions
   - Reduce TTS calls for repetitive content
   - Save ~30% on TTS processing

3. **Prompt Optimization:**
   - Fine-tune VLM prompt for better descriptions
   - Experiment with different prompt styles
   - A/B test prompt variations

---

### Medium-Term (Future Enhancements)

1. **Multi-Language Support:**
   - Add language selection in frontend
   - Use Piper multi-language voices
   - Translate VLM output if needed

2. **Voice Customization:**
   - Allow users to select different voices
   - Male/female voice options
   - Speed/pitch adjustments

3. **Contextual Narration:**
   - Remember previous descriptions
   - Provide continuity ("The person is still presenting...")
   - Detect scene changes

4. **Smart Sampling:**
   - Only process frames when scene changes significantly
   - Use motion detection or frame difference
   - Save compute on static scenes

---

### Long-Term (Advanced Features)

1. **Custom VLM Fine-Tuning:**
   - Fine-tune Moondream2 on your specific domain
   - Improve accuracy for conference scenarios
   - Train on your own video dataset

2. **Emotion Detection:**
   - Add sentiment analysis to narration
   - Detect emotions in faces/voices
   - Adjust narration tone accordingly

3. **Multi-Camera Narration:**
   - Narrate multiple cameras simultaneously
   - Compare scenes across cameras
   - "Meanwhile, on camera 2..."

4. **Interactive Narration:**
   - Allow users to ask questions about the video
   - Voice commands to control narration
   - Personalized commentary

---

## Part 10: Implementation Checklist

### Phase 1: Backend Setup (Days 1-2)

- [ ] Create `services/stream-narrator/` directory
- [ ] Write `Dockerfile` for stream-narrator
- [ ] Create `requirements.txt` with all dependencies
- [ ] Download Piper voice model during Docker build
- [ ] Implement `vlm_processor.py` (Moondream2 integration)
- [ ] Implement `tts_processor.py` (Piper integration)
- [ ] Implement `narrator.py` main worker logic
- [ ] Test VLM + TTS locally (outside Docker)
- [ ] Add stream-narrator service to `docker-compose.yml`
- [ ] Create shared volume for audio files
- [ ] Test Docker build and service startup

### Phase 2: API Gateway Updates (Day 3)

- [ ] Subscribe to `narration.stream` Redis channel
- [ ] Add audio file serving endpoint (`/audio/:filename`)
- [ ] Mount audio files volume in API Gateway
- [ ] Test WebSocket narration broadcasting
- [ ] Update API Gateway Dockerfile if needed

### Phase 3: Frontend Development (Days 4-5)

- [ ] Create `frontend/lib/StreamView.tsx`
- [ ] Implement rankings monitoring logic
- [ ] Implement video track switching
- [ ] Create `frontend/lib/AudioPlayer.tsx`
- [ ] Implement text overlay component
- [ ] Create CSS styles for Stream view
- [ ] Add "Stream" to Sidebar navigation
- [ ] Integrate StreamView into main app
- [ ] Update WebSocket message handling
- [ ] Add volume control component

### Phase 4: Testing & Debugging (Days 6-7)

- [ ] Test VLM inference speed and accuracy
- [ ] Test TTS audio quality and latency
- [ ] Test WebSocket narration delivery
- [ ] Test audio playback in browser
- [ ] Test video auto-switching on ranking change
- [ ] Test text overlay appearance and timing
- [ ] Test with multiple concurrent clients
- [ ] Measure end-to-end latency
- [ ] Check CPU/GPU/memory usage
- [ ] Test audio file cleanup

### Phase 5: Polish & Deploy (Day 8)

- [ ] Optimize VLM prompt for best descriptions
- [ ] Fine-tune text overlay styling
- [ ] Add error handling and fallbacks
- [ ] Add loading states in frontend
- [ ] Implement retry logic for failures
- [ ] Add logging and monitoring
- [ ] Write user documentation
- [ ] Create demo video
- [ ] Deploy to production
- [ ] Monitor performance metrics

---

## Summary: Why This Approach Works

### ✅ **Simplicity:**
- Uses proven, stable models (Moondream2, Piper)
- Leverages existing infrastructure (LiveKit, Redis, WebSocket)
- No complex pipelines or custom training required
- Straightforward architecture with clear data flow

### ✅ **Real & Practical:**
- All components are tested and production-ready
- Local hosting = no API costs or cloud dependencies
- Runs on commodity hardware (GPU recommended but optional)
- Low latency (<2 seconds end-to-end)

### ✅ **Actually Works:**
- Moondream2: 4-5 FPS on RTX 3080, proven for video analysis
- Piper TTS: <100ms latency, battle-tested in Rhasspy/Home Assistant
- LiveKit + Redis: Already working in your system
- WebSocket broadcasting: Already implemented for scores

### ✅ **Scalable:**
- Single narrator instance handles all processing
- Audio files are lightweight (50-200KB each)
- Frontend only receives text + audio URL
- Can add multiple narrator instances if needed

### ✅ **Extensible:**
- Easy to swap VLM models (LLaVA, Qwen-VL, etc.)
- Easy to swap TTS voices (different Piper voices)
- Easy to customize prompts and narration style
- Easy to add features (multi-language, emotions, etc.)

---

## Estimated Timeline

**Total Time: 6-8 days** (for experienced developer)

| Phase | Task | Duration |
|-------|------|----------|
| 1 | Backend: Stream Narrator Worker | 2 days |
| 2 | Backend: API Gateway Updates | 1 day |
| 3 | Frontend: Stream Page | 2 days |
| 4 | Testing & Debugging | 2 days |
| 5 | Polish & Deploy | 1 day |

---

## Final Recommendations

1. **Start with Moondream2 + Piper TTS** - Don't overthink model selection. These work.

2. **Use GPU if available** - 2-4x speedup for VLM inference. Worth it.

3. **Sample frames every 3-5 seconds** - Sweet spot for narration pacing. Not too frequent, not too sparse.

4. **Keep prompts simple** - "Describe what's happening in 1-2 sentences" works great.

5. **Test audio playback early** - Browser autoplay policies can be tricky. Get this working first.

6. **Monitor latency** - Add timestamps throughout pipeline to identify bottlenecks.

7. **Cleanup audio files** - Implement TTL to prevent disk space issues.

8. **Handle ranking changes gracefully** - Don't interrupt mid-narration. Finish current narration, then switch.

---

## Next Steps

Once you approve this plan, we can proceed with implementation in this order:

1. **Backend First:** Build stream-narrator worker (VLM + TTS)
2. **API Updates:** Add narration channel and audio serving
3. **Frontend:** Create Stream page and integrate
4. **Test:** End-to-end testing and optimization

Ready to start building! 🚀
