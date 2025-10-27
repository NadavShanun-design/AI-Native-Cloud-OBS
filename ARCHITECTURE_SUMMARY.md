# Cloud Observability System - Architecture Summary

## Quick Navigation

This document provides a comprehensive map of the entire codebase. For quick reference:

- **Complete Architecture Details**: See `CODEBASE_ARCHITECTURE_MAP.md`
- **YOLO Setup Instructions**: See `/frontend/public/models/SETUP_INSTRUCTIONS.md`
- **Quick Start**: See `QUICK_START_YOLO.md`

---

## System at a Glance

### What This System Does
1. **Live Video Conferencing**: WebRTC-based video conferencing with LiveKit
2. **AI Ranking**: Uses GPT-4o-mini to analyze video frames and score engagement (0.0-1.0)
3. **Object Detection**: YOLO11n running in browser (via ONNX Runtime) for real-time detection
4. **Combined Analysis**: Can rank videos by AI score, object detection counts, or both

### Key Technologies
- **Frontend**: Next.js 15.2 + React 18 + TypeScript
- **WebRTC**: LiveKit + livekit-client SDK
- **AI Analysis**: OpenAI GPT-4o-mini Vision API
- **Object Detection**: YOLO11n (ONNX format) + ONNXRuntime WebAssembly
- **Backend**: Node.js (Fastify) + Python (Asyncio)
- **Messaging**: Redis Pub/Sub
- **Deployment**: Docker Compose

---

## The Three Main Views

### 1. Live View (`LiveVideoConference.tsx`)
Shows all participants in a grid layout with AI rank badges:
- 🥇 Gold badge for 1st place (highest AI score)
- 🥈 Silver badge for 2nd place
- 🥉 Bronze badge for 3rd place
- #N for other ranks
- Press 'T' to test with mock scores

### 2. Ranked View (`RankedView.tsx`)
AI score-based ranking:
- Top video displayed large with full score explanation
- Grid of other videos with compact score badges
- Updates in real-time as new AI scores arrive

### 3. YOLO View (`YOLOView.tsx`)
Object detection with combined ranking:
- **Three view modes**: Detections Only | Ranked Only | Combined View
- **Toggles**: Show/hide YOLO boxes and AI scores independently
- **Ranking**: By AI score (primary) → person count → total detections
- **Performance**: FPS, inference time, object counts displayed

---

## Data Flow: AI Analysis Pipeline

```
Participant joins room with camera
        ↓
Python Analysis Worker subscribes to video track
        ↓
Every 3 seconds: Sample one video frame
        ↓
Resize frame + encode to JPEG base64
        ↓
Send to OpenAI GPT-4o-mini Vision API
        ↓
Parse response: {"score": 0.75, "reason": "..."}
        ↓
Publish to Redis pub/sub channel: scores.stream
        ↓
API Gateway (Fastify) receives score
        ↓
Broadcast to all WebSocket clients
        ↓
Frontend receives via ws://backend:3000/ws
        ↓
Update aiScores Map<participantId, AIScore>
        ↓
React components re-render with new rankings
```

---

## Menu Structure (Sidebar)

The hamburger menu (top-left) has these options:

| Tab | Component | Purpose |
|-----|-----------|---------|
| Live | `LiveVideoConference` | Grid of all participants with rank badges |
| View | `RankedView` or `YOLOView` | AI ranking or object detection view |
| Dashboard | `DashboardView` | Upload local video files and rank them |
| Personalize | Placeholder | Settings (not yet implemented) |
| Add Stream | `ExternalStreamModal` | Add RTSP/streaming URLs |

---

## File Organization

### Frontend
```
frontend/
├── app/
│   ├── page.tsx (home)
│   ├── layout.tsx
│   ├── rooms/[roomName]/
│   │   ├── page.tsx
│   │   └── PageClientImpl.tsx (core app component)
│   ├── api/
│   │   ├── connection-details/ (get LiveKit token)
│   │   └── external-stream/ (add RTSP streams)
│   └── custom/
│
├── lib/ (main components)
│   ├── Sidebar.tsx (hamburger menu)
│   ├── LiveVideoConference.tsx (live grid with badges)
│   ├── RankedView.tsx (AI ranking view)
│   ├── YOLOView.tsx (object detection + combined)
│   ├── DashboardView.tsx (video uploads)
│   ├── AIScoreOverlay.tsx (score badge component)
│   │
│   ├── yolo/ (object detection)
│   │   ├── YOLOService.ts (ONNX inference)
│   │   └── DetectionOverlay.tsx (bounding box rendering)
│   │
│   ├── types/
│   │   └── ai.ts (AIScore, ScoreMessage interfaces)
│   │
│   └── (other utilities)
│
├── styles/ (CSS modules)
│   ├── YOLOView.module.css
│   ├── RankedView.module.css
│   ├── DashboardView.module.css
│   └── AIScoreOverlay.module.css
│
├── public/
│   └── models/ (YOLO ONNX model location)
│       └── yolo11n_256.onnx (YOU MUST ADD THIS)
│
├── next.config.js (ONNX/WASM configuration)
└── package.json (dependencies)
```

### Backend
```
services/
├── api-gateway/
│   ├── src/server.ts
│   │   ├── REST endpoints (/token, /rankings, /health)
│   │   ├── WebSocket endpoint (/ws)
│   │   └── Redis subscriber (scores.stream)
│   │
│   └── package.json (Fastify, ws, redis-client)
│
└── analysis-worker/
    ├── worker.py
    │   ├── VideoAnalyzer class (GPT-4o-mini)
    │   └── LiveKitVideoWorker class (frame sampling)
    │
    └── Dockerfile (Python 3.11)
```

---

## Data Types

### AIScore (from backend → frontend)
```typescript
{
  cam_id: string;           // "participant-123"
  camId: string;            // Same (backward compat)
  score: number;            // 0.0 to 1.0
  reason: string;           // "Person speaking with engagement"
  timestamp: number;        // milliseconds since epoch
}
```

### Detection (YOLO output)
```typescript
{
  x0, y0, x1, y1: number;   // Bounding box pixels
  confidence: number;        // 0.0 to 1.0
  classId: number;           // 0-79 (COCO dataset)
  className: string;         // "person", "car", "dog", etc.
}
```

---

## How to Get It Running

### 1. Install YOLO Model (Required!)
```bash
cd frontend/public/models

# Option A: Export from ultralytics
pip3 install ultralytics
python3 -c "from ultralytics import YOLO; YOLO('yolo11n.pt').export(format='onnx', imgsz=256)"
mv yolo11n.onnx yolo11n_256.onnx

# Option B: Download pre-built
# https://github.com/AndreyGermanov/rtod/tree/main/public/models
# (Place as yolo11n_256.onnx)
```

### 2. Start Services
```bash
docker-compose up -d  # Starts Redis, LiveKit, Analysis Worker, API Gateway

# In another terminal:
cd frontend
pnpm install
pnpm dev  # Starts Next.js dev server on http://localhost:3000
```

### 3. Test the System
- Open http://localhost:3000
- Join a room with your name
- Select "View" from sidebar to see YOLO detections
- Look for green status badges:
  - YOLO Active (green)
  - AI Ranking Active (green)

---

## Integration Points: How Everything Connects

### 1. User Joins Room
```
Browser → /api/connection-details → API Gateway (/token)
        → Get LiveKit token + server URL
        → Browser connects to LiveKit WebRTC server
```

### 2. Video Analysis Starts
```
Browser publishes camera track
        → Analysis Worker subscribes to track
        → Every 3 seconds: analyze one frame
        → Publish score to Redis
        → API Gateway broadcasts to all browsers
```

### 3. Frontend Receives Scores
```
PageClientImpl.tsx opens WebSocket to api-gateway
        → Receives initial score list
        → Receives live score updates
        → Updates aiScores state
        → All view components re-render
```

### 4. YOLO Detection Runs
```
YOLOView.tsx initializes YOLO model
        → For each video track: attach to video element
        → Every 100ms: capture frame, run YOLO inference
        → Store detections in participantData state
        → DetectionOverlay renders bounding boxes
```

---

## Key Configuration Values

### Frontend (.env.local)
```
NEXT_PUBLIC_MAIN_BACKEND_URL=http://localhost:3000
```

### Backend (.env)
```
OPENAI_API_KEY=sk-...                    (required for AI analysis)
OPENAI_MODEL=gpt-4o-mini
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_URL=ws://livekit-server:7880
REDIS_URL=redis://redis:6379
FRAME_SAMPLE_INTERVAL=3.0                (seconds between analysis)
```

### YOLO Configuration (YOLOView.tsx line 41)
```typescript
modelPath: '/models/yolo11n_256.onnx'
inputSize: [256, 256]                 // or [640, 640] for accuracy
confidenceThreshold: 0.25              // Lower = more detections
iouThreshold: 0.4                      // NMS threshold
```

---

## Scoring Logic

### AI Score Ranges (GPT-4o-mini)
- **0.9-1.0**: Exceptional (multiple people, dynamic engagement)
- **0.8-0.9**: High interest (speaking, gestures, clear engagement)
- **0.6-0.8**: Good interest (people visible, some movement)
- **0.4-0.6**: Moderate (people present but static)
- **0.2-0.4**: Low interest (distant people, minimal activity)
- **0.0-0.2**: No interest (empty scene or static background)

### Ranking Logic (YOLOView Combined Mode)
1. Primary: AI score (if available)
2. Secondary: Number of "person" detections
3. Tertiary: Total number of detections

Example:
```
Video A: AI score 0.85, 3 persons, 5 total objects → Rank 1
Video B: AI score 0.75, 2 persons, 4 total objects → Rank 2
Video C: AI score 0.75, 1 person,  2 total objects → Rank 3 (tied on score, loses on person count)
```

---

## Troubleshooting

### "YOLO Offline" (orange/red badge)
**Cause**: Model file not found at `/public/models/yolo11n_256.onnx`
**Fix**: Follow the YOLO model installation steps above

### No AI Scores Appearing
**Cause**: Analysis Worker not running or WebSocket not connected
**Fix**: 
```bash
docker-compose logs analysis-worker  # Check worker logs
docker-compose logs api-gateway      # Check gateway logs
# Verify OPENAI_API_KEY is set in .env
```

### Videos Not Showing
**Cause**: LiveKit connection failed
**Fix**:
```bash
docker-compose logs livekit-server
# Check that livekit-server is running on port 7880
```

### Slow Performance
**Cause**: YOLO inference is CPU-intensive
**Fix**:
- Use lower resolution input (128x128 instead of 256x256)
- Increase frame sample interval (200ms instead of 100ms)
- Reduce confidence threshold (0.1 instead of 0.25) to simplify NMS

---

## Performance Benchmarks

| Operation | Time |
|-----------|------|
| YOLO inference (256x256) | 40-60ms |
| YOLO inference (640x640) | 200-400ms |
| GPT-4o-mini analysis | 2-5 seconds |
| WebSocket latency | 50-200ms |
| Browser memory (all running) | 300-500 MB |

---

## Code Entry Points

### For Understanding the Flow
1. Start: `/frontend/app/rooms/[roomName]/PageClientImpl.tsx` (main component)
2. Menu: `/frontend/lib/Sidebar.tsx` (tab selection)
3. Views: `/frontend/lib/YOLOView.tsx` (object detection view)
4. Scores: `/frontend/app/rooms/[roomName]/PageClientImpl.tsx` lines 235-304 (WebSocket listener)
5. Backend: `/services/api-gateway/src/server.ts` lines 181-207 (WebSocket broadcast)

### For Modifying
- **Add new menu tab**: Edit `Sidebar.tsx` defaultItems array
- **Change score ranges**: Edit `Analysis Prompt` in `/services/analysis-worker/worker.py`
- **Adjust YOLO settings**: Edit `/frontend/lib/YOLOView.tsx` line 41 config
- **Modify UI colors**: Edit CSS modules in `/styles/`

---

## Architecture Highlights

### Why This Architecture?
1. **Browser-based YOLO**: No server GPU needed; runs in WebAssembly
2. **Real-time scores**: Redis pub/sub ensures instant updates to all clients
3. **Modular views**: Easy to swap between different ranking/detection modes
4. **Scalable**: Multiple participants, multiple tracks, independent analysis
5. **Fault-tolerant**: WebSocket auto-reconnects on disconnect

### What Makes It Special
- **Combined AI + Computer Vision**: Uses both GPT-4o for semantic understanding and YOLO for object detection
- **Real-time**: ~100ms latency from frame to detection (YOLO only)
- **Browser-native**: YOLO runs in browser; no additional API calls needed
- **Production-ready**: Error handling, reconnection logic, fallbacks

---

Complete detailed documentation is available in `CODEBASE_ARCHITECTURE_MAP.md`
