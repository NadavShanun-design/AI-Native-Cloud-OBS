# Cloud Observability System - Comprehensive Codebase Analysis

**Date**: 2025-10-27  
**Status**: Very Thorough Analysis  
**Project**: Cloud Observability System with YOLO Object Detection  

---

## 1. CURRENT YOLO IMPLEMENTATION

### Overview
The system uses **YOLOv11n (nano model)** for real-time object detection, running exclusively on the backend (Python service).

#### Location: `/Users/nadavshanun/Downloads/cloud-obs-main/services/analysis-worker/worker.py` (Lines 48-182)

**Key Implementation Details**:

- **Class**: `YOLOPersonAnalyzer` (Lines 48-182)
- **Model**: `yolo11n.pt` (YOLOv11 nano - auto-downloads on first use)
- **Processing Location**: Backend Python service (Docker container)
- **Framework**: Ultralytics PyTorch implementation

### YOLO Configuration
```python
# Lines 93-98
results = self.model(
    inference_frame,
    conf=0.15,      # Very low confidence threshold (15%)
    iou=0.45,       # Standard Ultralytics NMS threshold
    max_det=300,    # Maximum detections per image
    classes=[0],    # Detect ONLY people (class 0 in COCO)
    verbose=False
)
```

### Frame Processing (FPS/Frame Rate)
- **Sampling Interval**: `FRAME_SAMPLE_INTERVAL = 1.0 seconds` (Line 41)
- **Update Frequency**: ~1 frame per second (3x faster than previous 3-second interval)
- **Frame Size Handling** (Lines 77-91):
  - Frames < 320px upscaled to 640x640 for optimal YOLO detection
  - Coordinates scaled back to original frame dimensions
  - Better detection for small camera feeds
  
**Real numbers**:
- With 1-second interval + LiveKit stream processing: approximately **0.5-1 FPS effective**
- Backend inference time: ~100-200ms per frame (CPU)
- Network overhead: ~50-100ms

### Object Detection Capabilities
- **Detects ONLY**: People (COCO class 0)
- **Coverage Calculation**: Percentage of frame covered by bounding boxes
- **Output Format**:
  - Person count
  - Person coverage percentage (0-100%)
  - Normalized score (0.0-1.0)
  - Bounding box coordinates (x0, y0, x1, y1)
  - Confidence scores

### Detection Output (Lines 166-172)
```python
return {
    'score': normalized_score,              # 0.0-1.0
    'person_percentage': person_percentage, # 0-100%
    'person_count': person_count,
    'reason': f"{person_count} person(s), {person_percentage:.1f}% coverage",
    'detections': detections  # Full detection data with bounding boxes
}
```

### Handling Different Camera Streams
- **Input Sources** (from mediamtx.yml):
  - 6 Reolink RLC-820A cameras (10.39.12.104-110, etc.)
  - Both SD (sub) and HD (main) streams per camera
  - RTSP streams converted to WebRTC via MediaMTX
  
- **Stream Processing Flow**:
  1. Camera → RTSP → MediaMTX (streaming server)
  2. MediaMTX → WebRTC → LiveKit
  3. LiveKit → Analysis Worker (subscribes to video tracks)
  4. Analysis Worker → YOLO inference
  5. Results → Redis → API Gateway → WebSocket → Frontend

### Backend Services Involved
1. **Analysis Worker** (`/services/analysis-worker/worker.py`)
   - Runs YOLO inference
   - Publishes scores to Redis
   - Uses Python + Ultralytics + OpenAI Vision API (optional)

2. **API Gateway** (`/services/api-gateway/src/server.ts`)
   - Receives scores from Redis
   - Broadcasts via WebSocket to frontend
   - Provides REST endpoint `/rankings`

3. **Redis** (Docker service)
   - Pub/Sub channel: `scores.stream`
   - Message format: JSON with score + detections

4. **LiveKit** (Docker service)
   - WebRTC conferencing
   - Room: `geome-hackathon`
   - Worker subscribes as viewer-only participant

---

## 2. FRONTEND STRUCTURE

### Framework
- **Next.js 15.2.4** (React 18.3.1)
- **TypeScript 5.9.2**
- **Component Library**: LiveKit Components React 2.9.15
- **Build Tool**: Next.js (Webpack)
- **Package Manager**: pnpm 10.18.2

### Root Layout
**File**: `/Users/nadavshanun/Downloads/cloud-obs-main/frontend/app/layout.tsx`

```typescript
// Uses LiveKit theme
<body data-lk-theme="default">
  <Toaster />  // React Hot Toast for notifications
  {children}
</body>
```

### Hamburger Menu/Navigation
**File**: `/Users/nadavshanun/Downloads/cloud-obs-main/frontend/lib/Sidebar.tsx` (Lines 27-34)

**Navigation Items** (in order):
```typescript
const defaultItems: SidebarItem[] = [
  { id: 'live', label: 'Live2', icon: <LiveIcon /> },      // Main video conference
  { id: 'ranked', label: 'Ranked', icon: <ViewIcon /> },    // Ranked by YOLO score
  { id: 'view', label: 'YOLO', icon: <ViewIcon /> },        // YOLO detection view
  { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { id: 'personalize', label: 'Personalize', icon: <PersonalizeIcon /> },
  { id: 'external-stream', label: 'Add Stream', icon: <ExternalStreamIcon /> },
];
```

**Sidebar Features**:
- Collapsible (hamburger menu button)
- Icons visible in collapsed state
- Tab-based navigation
- External Stream Modal for adding RTMP/WHIP sources

### Current Pages/Routes

#### 1. **Home Page** (`/frontend/app/page.tsx`)
- Login/Connection form
- Participant name input
- Meeting password input
- Joins fixed room: `geome-hackathon`
- **Entry point**: All users start here

#### 2. **Custom Room Connection** (`/frontend/app/custom/page.tsx`)
- Receives LiveKit URL and token via search params
- Routes to `VideoConferenceClientImpl`

#### 3. **Rooms/[roomName]** (`/frontend/app/rooms/[roomName]/page.tsx`)
- Alternative room-based routing (not currently used)

#### 4. **API Routes** (`/frontend/app/api/`)
- `/api/generate-token`: Generate LiveKit access tokens
- `/api/connection-details`: Get server connection info
- `/api/external-stream`: Handle external stream ingestion

### Main Component Tree

**VideoConferenceClientImpl** (`/frontend/app/custom/VideoConferenceClientImpl.tsx`)
```
├── RoomContext.Provider
├── CameraAutoConnectEnhanced (auto-connect 6 cameras)
├── Active View (conditional rendering):
│   ├── 'live' → LiveVideoConference
│   ├── 'ranked' → RankedView
│   ├── 'view' → YOLOView
│   ├── 'dashboard' → DashboardView
│   └── 'personalize' → Placeholder
└── Sidebar (navigation)
```

### Page Implementations

#### Live Video Conference (`/frontend/lib/LiveVideoConference.tsx`)
- Grid display of all participants
- Shows participant video tiles
- Displays AI scores via `LiveRankBadge`
- Test mode: Press 'T' to toggle mock scores
- **Score Badge**: Shows ranking badge for each participant

#### Ranked View (`/frontend/lib/RankedView.tsx`)
- Top-ranked participant: Large tile (#1)
- Other participants: Smaller grid below
- Sorts by YOLO person coverage percentage
- Highest coverage = highest rank

#### YOLO View (`/frontend/lib/YOLOView.tsx`)
- Displays all videos with detection overlays
- Shows bounding boxes from backend YOLO
- Detection summary: Person count, vehicle count, etc.
- Grid layout with info panels
- Backend status indicator

#### Dashboard View (`/frontend/lib/DashboardView.tsx`)
- Statistics dashboard (not fully implemented)
- Placeholder for analytics

### Camera Feed Display

#### Current Implementation
1. **LiveKit Native Video** (all pages):
   - Uses `ParticipantTile` component
   - Rendered via LiveKit's video renderer
   - Auto-subscribes to participants

2. **Camera Auto-Connect** (`/frontend/lib/CameraAutoConnectEnhanced.tsx`):
   - Automatically connects 6 Reolink cameras on room ready
   - Uses MediaMTX WHEP (WebRTC HTTP Egress Protocol) endpoint
   - Endpoint: `http://localhost:8889/{camera_id}/whep`
   - Publishes as tracks to LiveKit

3. **YOLO Detection Overlay** (`/frontend/lib/yolo/DetectionOverlay.tsx`):
   - Canvas-based rendering on top of video
   - Draws bounding boxes with color-coded confidence
   - Labels show class name and confidence percentage
   - Only shows when detections available

#### Detection Rendering
```typescript
// From YOLOView.tsx
<DetectionOverlay
  detections={data.detections}
  width={videoDimensions.width}
  height={videoDimensions.height}
  showLabels={true}
  showConfidence={true}
  lineWidth={2}
/>
```

### Styling
- **Modules**: CSS Modules in `/frontend/styles/`
  - `Home.module.css`
  - `Sidebar.module.css`
  - `LiveVideoConference.module.css`
  - `RankedView.module.css`
  - `YOLOView.module.css`
  
- **Global Styles**: `/frontend/styles/globals.css`
- **Theme**: Dark theme by default (LiveKit default)

---

## 3. STREAMING ARCHITECTURE

### MediaMTX Integration
**Location**: `/Users/nadavshanun/Downloads/cloud-obs-main/mediamtx.yml`

**Purpose**: Advanced RTSP/RTMP/WebRTC streaming server

**Configured Streams** (6 Reolink cameras):
```yaml
paths:
  camera_1: rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_sub
  camera_1_hd: rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_main
  # ... (cameras 2-6 with different IPs)
```

**Ports**:
- 8889: WebRTC server
- 8888: HLS server
- 9997: API server
- 8554: RTSP server
- 1935: RTMP server
- 8890: SRT server

### Stream Types

1. **Camera RTSP Streams**
   - Source: Reolink cameras (6 total)
   - URL format: `rtsp://admin:password@ip:554/h264Preview_01_sub|main`
   - Two streams per camera: SD (sub) and HD (main)

2. **MediaMTX WebRTC Streams**
   - Endpoint: `http://localhost:8889/{camera_id}/whep`
   - Used by frontend to connect cameras to LiveKit
   - Low latency (<1 second)

3. **MediaMTX RTSP Output**
   - Port 8554
   - Available for external consumers
   - Used by go2rtc as fallback

4. **LiveKit Streams**
   - WebRTC from clients
   - Both camera feeds and participant videos
   - Distributed to all subscribers

5. **HLS Streams** (Fallback)
   - Port 8888
   - Browser-compatible fallback
   - ~2-3 second latency

### Stream Flow Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    CAMERA STREAMS                           │
└─────────────────┬───────────────────────────────────────────┘
                  │
        ┌─────────▼──────────┐
        │    MediaMTX        │  (Streaming Server)
        │  8889 (WebRTC)     │
        │  8888 (HLS)        │
        │  9997 (API)        │
        └──────┬──────┬──────┘
               │      │
        ┌──────▼──┐   │
        │ LiveKit │◀──┘  (WHEP)
        │ Room    │
        └──┬───┬──┘
           │   │
    ┌──────▼─┐ └─────────┬─────────┐
    │Frontend│           │Backend  │
    │Videos  │      Analysis Worker│
    │        │      (YOLO Inference)
    └────────┘           │
                    ┌────▼────┐
                    │  Redis  │
                    └────┬────┘
                         │
                    ┌────▼──────────┐
                    │  API Gateway  │
                    │   WebSocket   │
                    └───────────────┘
                         │
                    ┌────▼─────────┐
                    │   Frontend   │
                    │  (Detection  │
                    │   Overlay)   │
                    └──────────────┘
```

### Frontend Stream Consumption

**Video Elements**:
- LiveKit native video component (primary)
- `<video>` element with track attachment
- Real-time H.264/VP8/VP9 codec negotiation

**Code** (`/frontend/lib/YOLOView.tsx`, Lines 204-214):
```typescript
// Attach LiveKit track to video element
if (videoRef.current && data.videoTrack) {
  const videoElement = data.videoTrack.attach(videoRef.current);
  
  const handleMetadata = () => {
    setVideoDimensions({
      width: videoElement.videoWidth,
      height: videoElement.videoHeight,
    });
  };
```

### Backend Stream Consumption

**Analysis Worker** (`/services/analysis-worker/worker.py`, Lines 441-513):
- Subscribes to LiveKit room as participant
- Receives video tracks from room participants
- Creates `VideoStream` object from each track
- Iterates through frames via async generator
- Processes frames with YOLO
- Publishes results to Redis

```python
async for frame_event in video_stream:
    frame = frame_event.frame
    height = frame.height
    width = frame.width
    
    # Convert I420 to BGR for OpenCV/YOLO
    rgb_frame = frame.to_rgb()
    # ... process with YOLO
```

---

## 4. BACKEND SERVICES

### Services Overview

#### Service 1: Analysis Worker (Python)
**Location**: `/services/analysis-worker/`
**Port**: Internal (no external port)
**Tech Stack**: 
- Python 3.11
- Ultralytics YOLO11
- OpenAI API (optional for vision)
- LiveKit SDK
- Redis client

**File**: `worker.py` (617 lines)

**Components**:
1. `YOLOPersonAnalyzer` - YOLO inference engine
2. `VideoAnalyzer` - OpenAI Vision API analyzer (secondary)
3. `LiveKitVideoWorker` - LiveKit room connection & video processing
4. Main event loop with Redis pub/sub

**Key Functions**:
- `__init__()`: Loads YOLO model with warm-up
- `analyze_frame()`: Runs inference on single frame
- `process_video_track()`: Async frame processing loop
- `publish_score()`: Sends results to Redis

**Environment Variables**:
```python
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini
FRAME_SAMPLE_INTERVAL=1.0  # seconds
LIVEKIT_URL=wss://geo-yjl7q4ad.livekit.cloud
LIVEKIT_API_KEY=APInZ2h3PwkMyPT
LIVEKIT_API_SECRET=2fJN3INJzJcxKhP6I6oWmP89ja4Dy1SFkSX6URaKMYX
REDIS_URL=redis://redis:6379
ROOM_NAME=geome-hackathon
```

#### Service 2: API Gateway (Node.js/TypeScript)
**Location**: `/services/api-gateway/`
**Port**: 3000 (exposed)
**Tech Stack**:
- Node.js / TypeScript
- Fastify (web framework)
- Redis client
- LiveKit Server SDK

**File**: `src/server.ts` (330 lines)

**Components**:
1. REST API server (Fastify)
2. WebSocket server (Fastify WebSocket)
3. Redis subscriber
4. Token generator

**Endpoints**:
- `GET /health`: Health check
- `POST /token`: Generate LiveKit access token
- `GET /rankings`: Get current score rankings
- `GET /ws` (WebSocket): Real-time score streaming

**Key Functions**:
- `generateLiveKitToken()`: Creates JWT tokens for clients
- `setupRoutes()`: Register REST endpoints
- `setupRedis()`: Subscribe to scores.stream channel
- Broadcasts received scores to all connected WebSocket clients

**Communication Pattern**:
```
LiveKit Room
    ↓
Analysis Worker (subscribes to video)
    ↓
    YOLO Inference
    ↓
    Publishes to Redis: 'scores.stream'
    ↓
API Gateway (subscribed to 'scores.stream')
    ↓
    Broadcasts to WebSocket clients
    ↓
Frontend (WebSocket connection)
    ↓
    Updates UI with scores
```

#### Service 3: Redis (Docker)
**Port**: 6379 (internal), 6380 (exposed)
**Purpose**: Pub/Sub messaging
**Channel**: `scores.stream`
**Message Format**:
```json
{
  "type": "score",
  "payload": {
    "cam_id": "participant-id",
    "camId": "participant-id",
    "score": 0.75,
    "reason": "3 person(s), 45.2% coverage",
    "timestamp": 1698901234567,
    "track_name": "camera_1",
    "detections": [
      {
        "x0": 100, "y0": 150,
        "x1": 200, "y1": 300,
        "confidence": 0.92,
        "classId": 0,
        "className": "person"
      }
    ]
  }
}
```

#### Service 4: LiveKit Server (Docker)
**Port**: 7880 (WebSocket), 7881 (HTTPS)
**Config**: Local dev mode with dev keys
**Room**: geome-hackathon
**Purpose**: WebRTC conferencing, track distribution

#### Service 5: MediaMTX (Docker)
**Ports**: 8889 (WebRTC), 8888 (HLS), 9997 (API), etc.
**Purpose**: Stream ingest from cameras, conversion, re-distribution
**Handles**: RTSP → WebRTC conversion

#### Service 6: go2rtc (Docker)
**Port**: 1984 (web UI), 8554 (RTSP)
**Purpose**: Fallback RTSP streaming, multi-protocol support

### Service Communication

```
Analysis Worker → Redis (pub)
API Gateway → Redis (sub) + WebSocket (pub)
Frontend → API Gateway (WebSocket)
Frontend → LiveKit
Cameras → MediaMTX → LiveKit
```

### Configuration Storage

**Docker Compose**: `/docker-compose.yml`
- Service definitions
- Port mappings
- Volume mounts
- Network configuration
- Health checks

**Environment Variables**: `/.env`
- API keys (OpenAI, LiveKit)
- URLs and credentials
- Room configuration
- Frame sampling rate

**MediaMTX Config**: `/mediamtx.yml`
- Camera RTSP streams
- Protocol servers
- Authentication rules
- Recording settings

**go2rtc Config**: `/go2rtc.yaml`
- Camera stream definitions
- WebRTC/API settings
- Logging

---

## 5. CAMERA CONFIGURATION

### Camera Details
**Location**: `/frontend/lib/CameraAutoConnectEnhanced.tsx` (Lines 15-22)
**Configuration**: 
```typescript
const CAMERAS = [
  { id: 'camera_1', name: 'Camera 1', ip: '10.39.12.110', streamName: 'camera_1' },
  { id: 'camera_2', name: 'Camera 2', ip: '10.39.12.107', streamName: 'camera_2' },
  { id: 'camera_3', name: 'Camera 3', ip: '10.39.12.104', streamName: 'camera_3' },
  { id: 'camera_4', name: 'Camera 4', ip: '10.39.12.106', streamName: 'camera_4' },
  { id: 'camera_5', name: 'Camera 5', ip: '10.39.12.109', streamName: 'camera_5' },
  { id: 'camera_6', name: 'Camera 6', ip: '10.39.12.108', streamName: 'camera_6' },
];
```

### Hardware Specifications
**Camera Model**: Reolink RLC-820A  
**Total Count**: 6 cameras

### Stream Credentials
**Default Cameras (1-3)**: 
- Username: `admin`
- Password: `Password03!`

**Advanced Cameras (4-6)**:
- Username: `admin`
- Password: `zSQ6e9MB&03!`

### RTSP URLs

**Camera 1 (10.39.12.110)**:
- SD: `rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_sub`
- HD: `rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_main`

**Camera 2 (10.39.12.107)**:
- SD: `rtsp://admin:Password03!@10.39.12.107:554/h264Preview_01_sub`
- HD: `rtsp://admin:Password03!@10.39.12.107:554/h264Preview_01_main`

**Camera 3 (10.39.12.104)**:
- SD: `rtsp://admin:Password03!@10.39.12.104:554/h264Preview_01_sub`
- HD: `rtsp://admin:Password03!@10.39.12.104:554/h264Preview_01_main`

**Camera 4 (10.39.12.106)**:
- SD: `rtsp://admin:zSQ6e9MB&03!@10.39.12.106:554/h264Preview_01_sub`
- HD: `rtsp://admin:zSQ6e9MB&03!@10.39.12.106:554/h264Preview_01_main`

**Camera 5 (10.39.12.109)**:
- SD: `rtsp://admin:zSQ6e9MB&03!@10.39.12.109:554/h264Preview_01_sub`
- HD: `rtsp://admin:zSQ6e9MB&03!@10.39.12.109:554/h264Preview_01_main`

**Camera 6 (10.39.12.108)**:
- SD: `rtsp://admin:zSQ6e9MB&03!@10.39.12.108:554/h264Preview_01_sub`
- HD: `rtsp://admin:zSQ6e9MB&03!@10.39.12.108:554/h264Preview_01_main`

### Auto-Connection Logic
**File**: `/frontend/lib/CameraAutoConnectEnhanced.tsx` (Lines 27-150)

1. Triggered when room is ready
2. Connects cameras sequentially with 5-second delays
3. 3 retry attempts per camera
4. Uses MediaMTX WHEP endpoint: `http://localhost:8889/{streamName}/whep`
5. Publishes to LiveKit as tracks
6. Tracks are named: `camera_1`, `camera_2`, etc.

### Status Tracking
- Connection status per camera: disconnected, connecting, connected, failed
- Error logging for troubleshooting
- Retry mechanism with exponential backoff

---

## CRITICAL FILE REFERENCES

### Backend (Python)
```
/services/analysis-worker/
├── worker.py (617 lines) - Main YOLO inference engine
├── Dockerfile - Python 3.11 container config
├── requirements.txt - Dependencies
│   └── ultralytics==8.3.0
└── .env (in root)
```

### API Gateway (Node.js)
```
/services/api-gateway/
├── src/
│   └── server.ts (330 lines) - FastIFy + WebSocket
├── package.json
├── tsconfig.json
└── Dockerfile
```

### Frontend (React/Next.js)
```
/frontend/
├── app/
│   ├── page.tsx (login page)
│   ├── custom/
│   │   ├── page.tsx (room connection)
│   │   └── VideoConferenceClientImpl.tsx (main component)
│   ├── api/
│   │   ├── generate-token/route.ts
│   │   ├── connection-details/route.ts
│   │   └── external-stream/route.ts
│   └── layout.tsx (root layout)
├── lib/
│   ├── Sidebar.tsx (navigation)
│   ├── LiveVideoConference.tsx (main view)
│   ├── RankedView.tsx (ranked view)
│   ├── YOLOView.tsx (YOLO detection view)
│   ├── DashboardView.tsx (dashboard)
│   ├── CameraAutoConnectEnhanced.tsx (camera connection)
│   ├── yolo/
│   │   └── DetectionOverlay.tsx (canvas rendering)
│   ├── types/
│   │   └── ai.ts (TypeScript interfaces)
│   └── [other components]
├── styles/
│   ├── globals.css
│   ├── Home.module.css
│   ├── Sidebar.module.css
│   ├── LiveVideoConference.module.css
│   ├── RankedView.module.css
│   ├── YOLOView.module.css
│   └── [others]
├── package.json
├── tsconfig.json
└── next.config.js
```

### Configuration Files
```
/
├── docker-compose.yml (all services)
├── mediamtx.yml (camera streaming server)
├── go2rtc.yaml (RTSP fallback)
├── .env (environment variables - SECRETS!)
└── livekit.yaml (LiveKit dev mode)
```

---

## KEY INSIGHTS FOR YOLO DEV FEATURE

### What NOT to Touch
1. ✅ **Working Live View** - Don't modify `LiveVideoConference.tsx`
2. ✅ **Working Rankings** - Don't modify `RankedView.tsx`
3. ✅ **Working Camera Autoconnect** - Don't modify `CameraAutoConnectEnhanced.tsx`
4. ✅ **Backend YOLO** - Already optimized, runs once only
5. ✅ **API Gateway WebSocket** - Stable message passing

### YOLO System Characteristics
- Backend-only processing (Python)
- 1-second frame sampling interval
- Outputs bounding box + confidence + class for EACH detection
- Publishes via Redis → WebSocket pipeline
- Frontend renders detection overlay on received data
- 80 COCO classes available (but only detects people for ranking)

### Where to Add YOLO DEV Feature
- **New route**: `/dev/yolo` or `/yolo-dev`
- **New component**: `frontend/lib/YOLODev.tsx` or `frontend/lib/dev/YOLODev.tsx`
- **New sidebar item**: Add to `Sidebar.tsx` defaultItems
- **Environment flag**: Add `NEXT_PUBLIC_SHOW_YOLO_DEV=true`
- **New test mode**: Can use existing test mode infrastructure (`testMode` in LiveVideoConference)

### Current YOLO Settings (Optimized)
- Model: yolo11n (nano - 5MB, ~100ms inference)
- Confidence: 0.15 (very low for maximum detection)
- IOU: 0.45 (standard NMS threshold)
- Max detections: 300 per frame
- Detection classes: [0] (person only for ranking)
- Frame sampling: 1.0 second
- Frame upscaling: To 640x640 if smaller for better detection

### Potential DEV Features
1. **Parameter tuning interface**:
   - Adjust confidence threshold in real-time
   - Toggle different YOLO classes (80 COCO classes available)
   - Adjust IOU threshold
   - Test different frame sizes

2. **Detection visualization**:
   - Heat map of detection confidence
   - Per-class detection counts
   - Bounding box accuracy visualization
   - FPS/latency monitoring

3. **Model comparison**:
   - Test different YOLO versions (11s, 11m, 11l)
   - Compare inference times
   - Accuracy vs speed tradeoff

4. **Stream comparison**:
   - Side-by-side detection comparison
   - Multiple confidence threshold displays
   - Overlay toggle

---

**Total System Size**:
- Backend: ~650 lines Python
- Frontend: ~5,000+ lines TypeScript/React
- Services: 6 major components
- Dependencies: 50+ npm packages (excluding node_modules), 11 Python packages

