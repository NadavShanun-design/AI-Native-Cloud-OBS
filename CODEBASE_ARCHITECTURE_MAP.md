# Cloud Observability System - Complete Codebase Map

## Overview

This is a real-time video conferencing and analysis platform built on:
- **Frontend**: Next.js (React) with TypeScript
- **Backend**: Node.js (Fastify) + Python (AI worker)
- **Infrastructure**: LiveKit WebRTC, Redis, Docker
- **AI/ML**: GPT-4o-mini (OpenAI Vision) + YOLO11n object detection

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                       │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Sidebar (Hamburger Menu)                                │   │
│  │  - Live    → LiveVideoConference (with rank badges)      │   │
│  │  - View    → RankedView OR YOLOView (object detection)   │   │
│  │  - Combine → YOLOView (combined AI + YOLO)               │   │
│  │  - Dashboard → DashboardView (video uploads + AI ranking)│   │
│  │  - Personalize → Settings                                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  LiveKit Integration                                     │   │
│  │  - WebRTC video streaming                                │   │
│  │  - Real-time participant management                      │   │
│  │  - Track publishing/subscribing                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  YOLO Detection (Browser-based)                          │   │
│  │  - ONNX Runtime (WebAssembly)                            │   │
│  │  - YOLOv11n model inference (~10 FPS)                    │   │
│  │  - Bounding box rendering with confidence scores        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket
                              │ (AI Scores)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  BACKEND (Node.js + Python)                      │
│                                                                   │
│  ┌──────────────────────────────┐  ┌──────────────────────────┐ │
│  │  API Gateway (Fastify)       │  │  Analysis Worker (Python)│ │
│  │  - REST API endpoints        │  │  - LiveKit room monitor  │ │
│  │  - WebSocket /ws endpoint    │  │  - Frame sampling (3s)   │ │
│  │  - LiveKit token generation  │  │  - GPT-4o-mini analysis  │ │
│  │  - Rankings API              │  │  - Redis score publishing│ │
│  └──────────────────────────────┘  └──────────────────────────┘ │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Redis Pub/Sub                                           │   │
│  │  - scores.stream channel                                 │   │
│  │  - Real-time score broadcasting                          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ WebRTC
                              │ (Video Streams)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  LiveKit Server (WebRTC)                         │
│  - Manages participant connections                              │
│  - Routes video/audio streams                                   │
│  - Provides track publications/subscriptions                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Frontend Structure

### 1. View Modes (Hamburger Menu - Sidebar.tsx)

The **Sidebar component** implements the hamburger menu with 5 main tabs:

```
Sidebar Items:
├── "Live" (live)
│   └── LiveVideoConference
│       - Shows all participants in grid
│       - Displays AI rank badges (🥇🥈🥉 + #ranking)
│       - Test mode: Press 'T' to generate mock scores
│
├── "View" (view)
│   └── RankedView
│       - Top ranked video (largest)
│       - Grid of all other ranked videos
│       - Shows AI scores and reasoning
│
├── "Dashboard" (dashboard)
│   └── DashboardView
│       - Video upload interface
│       - File-to-MediaStream conversion
│       - Top ranked display
│       - Grid view of all videos
│
├── "Personalize" (personalize)
│   └── Settings placeholder
│
└── "Add Stream" (external-stream)
    └── ExternalStreamModal
        - Add RTSP/streaming URLs
```

**File**: `/frontend/lib/Sidebar.tsx` (lines 27-33)

### 2. Main View Components

#### A. LiveVideoConference.tsx
**Location**: `/frontend/lib/LiveVideoConference.tsx`

**Responsibilities**:
- Integrates LiveKit's `VideoConference` component
- Manages AI score state (Map<participantId, AIScore>)
- Ranks participants by AI score
- Injects rank badges into participant tiles via DOM manipulation
- Test mode: Press 'T' to generate mock AI scores

**Key Methods**:
- `ParticipantTileWithBadge`: Custom tile renderer with badges
- `RankBadgeOverlay`: DOM-based badge injection (runs every 500ms)
- Medal assignment: 🥇 (1st), 🥈 (2nd), 🥉 (3rd), #N (other)

**Score Display Format**:
```
- Border color: Gold (#ffd700), Silver (#c0c0c0), Bronze (#cd7f32), Gray (#6b7280)
- Shows: "Rank #X" + "% score"
- Updates: Live as AIScores Map changes
```

#### B. RankedView.tsx
**Location**: `/frontend/lib/RankedView.tsx`

**Responsibilities**:
- Displays videos ranked by AI score
- **Top ranked video**: Large display with full AI score overlay
- **Other videos**: Grid layout with compact score overlays
- Handles multiple tracks per participant (e.g., multiple camera angles)

**Track Identification**:
```javascript
// New format: participant_trackSid (for multi-camera support)
let score = aiScores.get(`${participant.identity}_${trackSid}`);
// Fallback to old format if only one track
if (!score && participant.videoTrackPublications.size === 1) {
  score = aiScores.get(participant.identity);
}
```

**Ranking Logic**:
1. Collect all video tracks with scores
2. Sort by score (descending)
3. Filter out unscored tracks
4. Assign rank numbers (1, 2, 3, ...)

#### C. DashboardView.tsx
**Location**: `/frontend/lib/DashboardView.tsx`

**Responsibilities**:
- Upload video files from local disk
- Convert videos to MediaStream (WebCodecs or Canvas fallback)
- Publish streams to room
- Display uploaded videos in ranked grid
- Same ranking logic as RankedView

**Video Processing Pipeline**:
```
File → VideoElement → convertForLiveKit() → MediaStream → publishTrack()
     ↓
  Video metadata detection
     ↓
  Canvas-based frame capture + encoding (H.264/VP9)
     ↓
  LiveKit track publication
```

#### D. YOLOView.tsx
**Location**: `/frontend/lib/YOLOView.tsx`

**Responsibilities**:
- Real-time YOLO object detection on video feeds
- Browser-based inference (ONNX Runtime + WebAssembly)
- Combined ranking: AI scores + YOLO detection counts
- Multiple view modes:
  - **Detections Only**: Show YOLO boxes only
  - **Ranked Only**: Show AI ranking only
  - **Combined View**: Both YOLO + AI scores

**Key Features**:
- **YOLO Processing**: ~10 FPS (100ms intervals)
- **Performance Metrics**: FPS, inference time, object count
- **Detection Categories**: Persons 👤, Vehicles 🚗, Animals 🐾, Other 📦
- **Ranking Logic**:
  1. Primary: AI score (if available)
  2. Secondary: Person detection count
  3. Tertiary: Total detection count

**View Mode Controls** (lines 287-325):
```typescript
<button onClick={() => setViewMode('detections')}>Detections Only</button>
<button onClick={() => setViewMode('ranked')}>Ranked Only</button>
<button onClick={() => setViewMode('combined')}>Combined View</button>

<label><input onChange={(e) => setShowDetections(e.target.checked)} />Show YOLO Boxes</label>
<label><input onChange={(e) => setShowScores(e.target.checked)} />Show AI Scores</label>
```

### 3. AI Score Integration

#### PageClientImpl.tsx
**Location**: `/frontend/app/rooms/[roomName]/PageClientImpl.tsx`

**State Management**:
```typescript
const [aiScores, setAiScores] = React.useState<Map<string, AIScore>>(new Map());
const [aiConnected, setAiConnected] = React.useState(false);
const [activeView, setActiveView] = React.useState<'live' | 'view' | 'dashboard' | 'personalize'>('live');
```

**WebSocket Connection** (lines 235-304):
```typescript
// Connects to backend WebSocket: ws://localhost:3000/ws
const wsUrl = BACKEND_URL.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws';

ws.onmessage = (event) => {
  const message: ScoreMessage = JSON.parse(event.data);
  
  if (message.type === 'initial') {
    // Load all current scores
    const newScores = new Map<string, AIScore>();
    message.payload.forEach((score: AIScore) => {
      newScores.set(score.camId || score.cam_id, score);
    });
    setAiScores(newScores);
  } else if (message.type === 'score') {
    // Update single score
    const score = message.payload as AIScore;
    setAiScores((prev) => {
      const updated = new Map(prev);
      updated.set(score.camId || score.cam_id, score);
      return updated;
    });
  }
};
```

**Auto-reconnect**: 3-second retry on disconnect

### 4. YOLO Detection Service

#### YOLOService.ts
**Location**: `/frontend/lib/yolo/YOLOService.ts`

**Configuration**:
```typescript
interface YOLOConfig {
  modelPath: string;              // '/models/yolo11n_256.onnx'
  inputSize: [number, number];    // [256, 256] or [640, 640]
  confidenceThreshold: number;    // 0.25 (default)
  iouThreshold: number;           // 0.4 (NMS threshold)
}
```

**Pipeline**:
1. **Initialize**: Load ONNX model via WebAssembly
   ```javascript
   await ort.InferenceSession.create(modelPath, { executionProviders: ['wasm'] })
   ```

2. **Preprocess**: Convert video frame to tensor
   ```
   VideoFrame → Canvas → ImageData → Tensor (NCHW format, normalized 0-1)
   ```

3. **Inference**: Run YOLO11 model
   ```
   Input: [1, 3, 256, 256] (batch, channels, height, width)
   Output: [1, 84, anchors] (4 bbox coords + 80 class probabilities)
   ```

4. **Postprocess**: Extract detections and apply NMS
   ```
   - Parse bbox coords and class probabilities
   - Filter by confidence threshold
   - Apply Non-Maximum Suppression (class-aware)
   - Return array of Detection objects
   ```

**Detection Output**:
```typescript
interface Detection {
  x0: number;        // Top-left x
  y0: number;        // Top-left y
  x1: number;        // Bottom-right x
  y1: number;        // Bottom-right y
  confidence: number; // 0.0-1.0
  classId: number;    // 0-79 (COCO classes)
  className: string;  // e.g., 'person', 'car'
}
```

**COCO Classes** (80 total): person, bicycle, car, dog, cat, bird, horse, sheep, cow, etc.

#### DetectionOverlay.tsx
**Location**: `/frontend/lib/yolo/DetectionOverlay.tsx`

**Components**:
1. **DetectionOverlay**: Main bounding box renderer
   - Canvas-based drawing
   - Color gradient: Red (low confidence) → Green (high confidence)
   - Labels with confidence % (configurable)
   - Semi-transparent box fills

2. **DetectionBadge**: Object count summary
   - Position: Top-left of video
   - Shows: 👤 persons, 🚗 vehicles, 🐾 animals, 📦 other

3. **PerformanceOverlay**: Metrics display
   - Position: Top-right of video
   - Shows: FPS, inference time (ms), object count

### 5. AI Score Overlay

#### AIScoreOverlay.tsx
**Location**: `/frontend/lib/AIScoreOverlay.tsx`

**Props**:
```typescript
interface AIScoreOverlayProps {
  score?: AIScore;      // Score data
  rank?: number;        // Ranking position
  showReason?: boolean; // Show AI analysis text
  compact?: boolean;    // Compact vs. full layout
}
```

**Color Scheme**:
- 0.8-1.0: Green (#10b981)
- 0.6-0.8: Orange (#f59e0b)
- 0.0-0.6: Red (#ef4444)

**Compact Layout**:
- Small badge: Medal + Score%
- Used in grid views

**Full Layout**:
- Large header: Medal/Rank + Score%
- Optional: AI analysis reason
- Used in top ranked display

### 6. Type Definitions

#### types/ai.ts
**Location**: `/frontend/lib/types/ai.ts`

```typescript
interface AIScore {
  cam_id: string;      // Participant ID
  camId: string;       // Alternative field (backward compat)
  score: number;       // 0.0-1.0
  reason: string;      // Human-readable explanation
  timestamp: number;   // Milliseconds since epoch
}

interface ScoreMessage {
  type: 'score' | 'initial';
  payload: AIScore | AIScore[];
}
```

---

## Backend Structure

### 1. API Gateway (Node.js/Fastify)

**Location**: `/services/api-gateway/src/server.ts`

#### Key Endpoints

**REST API**:
```
GET /health
  → { status: 'ok', timestamp }

POST /token
  Body: { identity: string, room?: string, role?: 'camera' | 'viewer', name?: string }
  → { success: true, data: { token: string, url: string } }

GET /rankings
  → { success: true, data: RankingEntry[] }
```

**WebSocket**:
```
GET /ws (WebSocket upgrade)
  - On connect: Send all current scores (initial message)
  - On score update: Broadcast score message to all clients
  - Message format: { type: 'score', payload: ScoreData }
```

#### Score Broadcasting Pipeline

```
Redis Pub/Sub (scores.stream)
       ↓
API Gateway listens on 'scores.stream' channel
       ↓
For each score message:
  1. Update in-memory scores Map
  2. Broadcast to all connected WebSocket clients
       ↓
Frontend receives via WebSocket onmessage
```

#### Configuration
```
PORT = 3000
LIVEKIT_API_KEY = 'devkey'
LIVEKIT_API_SECRET = 'secret'
LIVEKIT_URL = 'ws://livekit-server:7880'
REDIS_URL = 'redis://redis:6379'
```

### 2. Analysis Worker (Python)

**Location**: `/services/analysis-worker/worker.py`

#### Architecture

**VideoAnalyzer Class** (lines 48-155):
```python
async def analyze_frame(frame: np.ndarray) -> Dict[str, any]:
    # 1. Resize frame to 640x480 (reduce API costs)
    # 2. Encode as JPEG with 80% quality
    # 3. Convert to base64
    # 4. Call OpenAI Vision API
    # 5. Parse JSON response
    # 6. Validate score (0.0-1.0)
    # 7. Return { score, reason }
```

**Analysis Prompt** (lines 51-69):
```
Scoring Guidelines:
- 0.9-1.0: Exceptional (multiple people, dynamic action)
- 0.8-0.9: High interest (speaking, gesturing)
- 0.6-0.8: Good interest (people visible, movement)
- 0.4-0.6: Moderate (static people, low energy)
- 0.2-0.4: Low interest (distant people, minimal activity)
- 0.0-0.2: No interest (empty/static)

Consider: People count, engagement, movement, composition, context
Response format: JSON only (no markdown): {"score": 0.75, "reason": "..."}
```

**LiveKitVideoWorker Class** (lines 158-403):
```
Responsibilities:
  1. Connect to LiveKit room as "analysis-worker"
  2. Subscribe to all remote participants' video tracks
  3. Process each track independently (supports multi-camera)
  4. Sample frames at 3-second intervals (configurable)
  5. Analyze frames using VideoAnalyzer
  6. Publish scores to Redis pub/sub
```

#### Event Handlers

**on_participant_connected** (line 217-221):
```python
def on_participant_connected(self, participant: rtc.RemoteParticipant):
    logger.info(f"👤 Participant connected: {participant.identity}")
    asyncio.create_task(self.subscribe_to_participant(participant))
```

**on_track_subscribed** (line 252-279):
```python
async def on_track_subscribed(track, publication, participant):
    # Create unique track key: participant_id:track_sid
    track_key = f"{participant.identity}:{track.sid}"
    # Start processing task for this specific track
    task = asyncio.create_task(
        self.process_video_track(track, participant.identity, track.sid)
    )
    self.track_tasks[track_key] = task
```

**process_video_track** (line 297-378):
```python
async def process_video_track(track, participant_id, track_sid):
    video_stream = rtc.VideoStream(track)
    
    async for frame_event in video_stream:
        # 1. Convert LiveKit frame to numpy array
        # 2. Analyze using GPT-4o-mini
        # 3. Publish score to Redis
        # 4. Wait 3 seconds before next frame
```

#### Score Publishing

```python
async def publish_score(self, score_id: str, result: Dict, track_name: str = ""):
    message = {
        'type': 'score',
        'payload': {
            'cam_id': score_id,
            'camId': score_id,
            'score': result['score'],
            'reason': result['reason'],
            'timestamp': int(time.time() * 1000),
            'track_name': track_name
        }
    }
    await self.redis.publish('scores.stream', json.dumps(message))
```

#### Configuration
```python
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
OPENAI_MODEL = 'gpt-4o-mini'
LIVEKIT_URL = 'ws://livekit-server:7880'
REDIS_URL = 'redis://redis:6379'
FRAME_SAMPLE_INTERVAL = 3.0 seconds
ROOM_NAME = 'geome-hackathon'
```

### 3. Data Flow: Score to Frontend

```
Analysis Worker (Python)
    ↓ (analyze frame + publish to Redis)
Redis Channel: scores.stream
    ↓ (publish)
API Gateway (Fastify)
    ↓ (receive on Redis subscriber, update in-memory map)
WebSocket Clients
    ↓ (broadcast to all connected WS clients)
Frontend Browser
    ↓ (receive in PageClientImpl.tsx)
State: aiScores Map<string, AIScore>
    ↓ (prop pass-through)
View Components (RankedView, YOLOView, LiveVideoConference)
    ↓ (render score overlays + ranking)
UI Display
```

---

## Docker Infrastructure

**File**: `/docker-compose.yml`

```yaml
Services:
  1. redis:6379
     - Pub/sub messaging for scores
     - Health check: redis-cli ping

  2. livekit-server:7880
     - WebRTC media server
     - Manages participant connections
     - Routes video/audio streams

  3. analysis-worker
     - Python service
     - Connects to LiveKit + Redis
     - Analyzes video frames with OpenAI

  4. api-gateway:3000
     - Node.js/Fastify server
     - REST API + WebSocket endpoint
     - Broadcasts scores to frontend

  5. go2rtc:1984
     - RTSP to WebRTC proxy
     - Supports IP cameras
```

---

## Configuration Files

### Frontend Configuration

**next.config.js** (lines 1-89):
```javascript
// ONNX Runtime WASM Setup
- Copy WASM files: node_modules/onnxruntime-web/dist/*.wasm
- Copy model files: public/models → static/chunks/models
- Enable asyncWebAssembly + layers experiments
- Set Cross-Origin-Opener-Policy headers (required for SharedArrayBuffer)
- Set Cross-Origin-Embedder-Policy headers (required for Web Workers)
```

**Environment Variables**:
```
NEXT_PUBLIC_CONN_DETAILS_ENDPOINT = '/api/connection-details'
NEXT_PUBLIC_SHOW_SETTINGS_MENU = 'true'
NEXT_PUBLIC_MAIN_BACKEND_URL = 'http://localhost:3000'
```

### Backend Configuration

**API Gateway** (.env):
```
PORT=3000
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_URL=ws://livekit-server:7880
REDIS_URL=redis://redis:6379
```

**Analysis Worker** (.env):
```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
LIVEKIT_URL=ws://livekit-server:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
REDIS_URL=redis://redis:6379
FRAME_SAMPLE_INTERVAL=3.0
ROOM_NAME=geome-hackathon
```

---

## What the "Combined" View Should Show

The **YOLOView component** (accessible via "View" menu when YOLO is loaded) provides **three modes**:

### 1. **Detections Only**
- YOLO bounding boxes with confidence scores
- Detection badges (object counts)
- Performance metrics (FPS, inference time)
- No AI ranking scores

### 2. **Ranked Only**
- AI ranking scores only
- No YOLO detection boxes
- Standard ranked display

### 3. **Combined View** (Default)
- YOLO detection boxes (with labels + confidence)
- AI ranking scores overlay
- Detection count badges
- Performance metrics
- **Ranking Logic**:
  1. Primary: AI score (if available)
  2. Secondary: Person detection count (if AI scores tied)
  3. Tertiary: Total detection count

**Visual Layout**:
```
┌─ Top-Ranked Video (Large) ─────────────────────┐
│  [Video Feed]                                   │
│    - YOLO boxes (red→green by confidence)      │
│    - Detection badge (👤 2 persons)             │
│    - AI score overlay (🥇 Rank 1 | 89%)         │
│    - Performance: 8.5 FPS, 45ms, 5 objects     │
└─────────────────────────────────────────────────┘

┌─ Grid: All Other Videos ───────────────────────┐
│  ┌─ Video 2 ──┐  ┌─ Video 3 ──┐  ┌─ Video 4 ──┐
│  │ [YOLO+Score]  │ [YOLO+Score]  │ [YOLO+Score]
│  │ 👤 1 person   │ 🚗 1 vehicle   │ 📦 2 objects
│  │ Rank 2: 76%   │ Rank 3: 62%   │ Rank 4: 51%
│  └────────────┘  └────────────┘  └────────────┘
└─────────────────────────────────────────────────┘
```

### Toggles
- **Show YOLO Boxes**: Toggle detection box rendering
- **Show AI Scores**: Toggle score overlay rendering
- **View Mode**: Switch between Detections Only / Ranked Only / Combined

---

## Key Integration Points

### 1. Menu Navigation
```
Sidebar.tsx (lines 92-102)
  → onTabChange callback
  → PageClientImpl.tsx: handleTabChange
  → setActiveView('live' | 'view' | 'dashboard' | 'personalize')
  → renderView() conditionally renders component
```

### 2. AI Score Propagation
```
PageClientImpl.tsx (WebSocket listener)
  → setAiScores(Map)
  → Pass to: LiveVideoConference, RankedView, YOLOView, DashboardView
  → Each view renders scoring UI
```

### 3. YOLO Model Loading
```
YOLOView.tsx (useEffect line 62-87)
  → yoloService.initialize()
  → Load /public/models/yolo11n_256.onnx
  → Set yoloReady = true
  → Begin video processing
```

### 4. Video Track Attachment
```
RankedView.tsx / YOLOView.tsx / DashboardView.tsx
  → useParticipants() → Get all Participant objects
  → For each participant: participant.videoTrackPublications
  → For each track: publication.track.attach(videoElement)
  → Renders video in HTML video element
```

---

## File Reference Quick Lookup

### Frontend UI Components
| File | Purpose |
|------|---------|
| `/lib/Sidebar.tsx` | Hamburger menu (5 tabs) |
| `/lib/LiveVideoConference.tsx` | Live grid with rank badges |
| `/lib/RankedView.tsx` | AI ranking ranked grid |
| `/lib/YOLOView.tsx` | YOLO detection + combined ranking |
| `/lib/DashboardView.tsx` | Video upload + AI ranking |
| `/lib/AIScoreOverlay.tsx` | Score badge renderer |

### Backend Services
| File | Purpose |
|------|---------|
| `/services/api-gateway/src/server.ts` | REST API + WebSocket |
| `/services/analysis-worker/worker.py` | Frame analysis + GPT-4o-mini |

### Configuration
| File | Purpose |
|------|---------|
| `/frontend/next.config.js` | ONNX/WASM/model bundling |
| `/docker-compose.yml` | Infrastructure setup |
| `/frontend/package.json` | Dependencies |

### Styles
| File | Purpose |
|------|---------|
| `/styles/YOLOView.module.css` | YOLO view styling |
| `/styles/RankedView.module.css` | Ranked view styling |
| `/styles/DashboardView.module.css` | Dashboard styling |
| `/styles/AIScoreOverlay.module.css` | Score overlay styling |

---

## Data Structures

### AIScore
```typescript
{
  cam_id: string;       // Participant identity
  camId: string;        // Duplicate field (backward compat)
  score: number;        // 0.0-1.0 (engagement level)
  reason: string;       // "2 people visible, engaged in discussion"
  timestamp: number;    // milliseconds since epoch
}
```

### Detection (YOLO)
```typescript
{
  x0: number;          // Left pixel
  y0: number;          // Top pixel
  x1: number;          // Right pixel
  y1: number;          // Bottom pixel
  confidence: number;  // 0.0-1.0
  classId: number;     // 0-79 (COCO index)
  className: string;   // "person", "car", etc.
}
```

### Ranking Entry
```typescript
{
  participantId: string;
  participantName: string;
  score: number;       // 0.0-1.0
  reason: string;      // AI analysis
  timestamp: number;   // milliseconds
}
```

---

## Performance Characteristics

| Component | Performance |
|-----------|-------------|
| **YOLO Inference** | ~10 FPS (100ms per frame) at 256x256 input |
| **GPT-4o-mini Analysis** | ~2-5 seconds per frame |
| **WebSocket Latency** | ~50-200ms |
| **YOLO Model Size** | ~12 MB (yolo11n.onnx) |
| **Browser Memory** | 200-400 MB (ONNX runtime + models) |

---

## Testing & Debug

### Test Mode (Live View)
Press **'T'** in LiveVideoConference component to:
- Generate mock AI scores for all participants
- Descending scores: 0.9, 0.8, 0.7, ...
- Useful for UI testing without backend

### Developer Tools
- **Console (F12)**: WebSocket logs, score updates, YOLO init
- **Network Tab**: WebSocket message inspection
- **Performance**: FPS monitoring, inference time tracking

### Common Issues

1. **"YOLO Offline"** → Model file missing at `/public/models/yolo11n_256.onnx`
2. **No AI scores** → Backend not running or WebSocket not connected
3. **Slow YOLO** → CPU-bound; use lower `confidenceThreshold` or larger `iouThreshold`
4. **Memory issues** → Run fewer concurrent video streams or reduce model size

---

End of Codebase Map
