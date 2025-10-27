# File Locations Quick Reference

## Frontend Components (Main UI)

### Views/Pages
- **Live View**: `/frontend/lib/LiveVideoConference.tsx` (grid with rank badges)
- **Ranked View**: `/frontend/lib/RankedView.tsx` (AI score ranking)
- **YOLO View**: `/frontend/lib/YOLOView.tsx` (object detection + combined)
- **Dashboard**: `/frontend/lib/DashboardView.tsx` (video uploads)

### Core App
- **Main Component**: `/frontend/app/rooms/[roomName]/PageClientImpl.tsx`
  - WebSocket connection setup (line 235-304)
  - View state management (line 115)
  - View rendering (line 307-335)

- **Navigation/Menu**: `/frontend/lib/Sidebar.tsx`
  - Tab definitions (line 27-33)
  - Click handlers (line 43-58)

### Overlays/Badges
- **AI Score Overlay**: `/frontend/lib/AIScoreOverlay.tsx`
- **Live Rank Badge**: `/frontend/lib/LiveRankBadge.tsx`
- **Rank Badge Injection**: `/frontend/lib/LiveVideoConference.tsx` (RankBadgeOverlay, line 142-244)

---

## YOLO Object Detection

### Service & Models
- **YOLO Service**: `/frontend/lib/yolo/YOLOService.ts`
  - Model initialization (line 74-114)
  - Preprocessing (line 120-143)
  - Inference (line 148-156)
  - Postprocessing (line 163-224)
  - NMS (line 230-258)
  - Main detect method (line 286-340)

- **Detection Overlay**: `/frontend/lib/yolo/DetectionOverlay.tsx`
  - Bounding box rendering (line 20-84)
  - Detection badge component (line 129-189)
  - Performance overlay (line 194-223)

- **YOLO Model File Location**: `/frontend/public/models/yolo11n_256.onnx`
  - YOU MUST ADD THIS FILE for YOLO to work
  - 256x256 input size, ~12 MB file size

---

## Backend Services

### API Gateway (REST + WebSocket)
- **Main File**: `/services/api-gateway/src/server.ts`
  - REST endpoints (line 112-178)
    - GET /health
    - POST /token (LiveKit token generation)
    - GET /rankings
  - WebSocket setup (line 181-207)
  - Redis subscription (line 213-257)
  - Server startup (line 262-315)

- **Package**: `/services/api-gateway/package.json`
  - Fastify, ws, redis-client

### Analysis Worker (Python)
- **Main File**: `/services/analysis-worker/worker.py`
  - VideoAnalyzer class (line 48-155)
    - ANALYSIS_PROMPT (line 51-69)
    - analyze_frame method (line 75-155)
  - LiveKitVideoWorker class (line 158-403)
    - connect method (line 170-215)
    - on_participant_connected (line 217-221)
    - on_track_subscribed (line 252-279)
    - process_video_track (line 297-378)
    - publish_score (line 380-403)
  - main() function (line 423-466)

---

## Configuration Files

### Frontend Config
- **Next.js Config**: `/frontend/next.config.js`
  - ONNX/WASM setup (line 25-66)
  - Copy plugins (line 28-46)
  - WASM configuration (line 49-53)
  - CORS headers (line 70-86)

- **Environment**: `/frontend/.env.local`
  - NEXT_PUBLIC_MAIN_BACKEND_URL

- **Package**: `/frontend/package.json`
  - Dependencies: onnxruntime-web, ndarray, ndarray-ops, livekit-client, etc.

### Backend Config
- **Docker Compose**: `/docker-compose.yml`
  - Service definitions (redis, livekit-server, analysis-worker, api-gateway, go2rtc)
  - Port mappings and environment vars

- **Environment**: `/.env` (main directory)
  - OPENAI_API_KEY
  - LIVEKIT_API_KEY, LIVEKIT_API_SECRET
  - REDIS_URL
  - FRAME_SAMPLE_INTERVAL

---

## Type Definitions

### AI Types
- **Location**: `/frontend/lib/types/ai.ts`
  - AIScore (line 5-11)
  - ScoreMessage (line 13-16)
  - VideoUploadStatus (line 18-22)
  - ParticipantWithScore (line 24-29)

### General Types
- **Location**: `/frontend/lib/types.ts`
  - SessionProps
  - TokenResult
  - ConnectionDetails

### YOLO Types
- **Location**: `/frontend/lib/yolo/YOLOService.ts` (line 25-48)
  - Detection interface
  - YOLOConfig interface
  - YOLOPerformance interface
  - YOLO_CLASSES array (80 COCO classes)

---

## Styles/CSS

### CSS Modules
- **YOLO View**: `/styles/YOLOView.module.css`
- **Ranked View**: `/styles/RankedView.module.css`
- **Dashboard View**: `/styles/DashboardView.module.css`
- **AI Score Overlay**: `/styles/AIScoreOverlay.module.css`
- **Live Video Conference**: `/styles/LiveVideoConference.module.css`
- **Sidebar**: `/styles/Sidebar.module.css`
- **Live Rank Badge**: `/styles/LiveRankBadge.module.css`

### Global Styles
- `/styles/globals.css`

---

## Utilities & Helpers

### Video Processing
- **Convert for LiveKit**: `/frontend/lib/convertForLiveKit.ts`
  - Converts video files to MediaStream
  - WebCodecs (hardware) or Canvas (fallback)

### Client Utilities
- **Client Utils**: `/frontend/lib/client-utils.ts`
  - Utility functions

### Other Components
- **Keyboard Shortcuts**: `/frontend/lib/KeyboardShortcuts.tsx`
- **Debug Mode**: `/frontend/lib/Debug.tsx`
- **Settings Menu**: `/frontend/lib/SettingsMenu.tsx`
- **Microphone Settings**: `/frontend/lib/MicrophoneSettings.tsx`
- **Camera Settings**: `/frontend/lib/CameraSettings.tsx`
- **Recording Button**: `/frontend/lib/RecordingButton.tsx`
- **Recording Indicator**: `/frontend/lib/RecordingIndicator.tsx`
- **External Stream Modal**: `/frontend/lib/ExternalStreamModal.tsx`

---

## Documentation Files

### In Repository
- `/README.md` - Project overview
- `/SETUP.md` - Initial setup instructions
- `/QUICK-START-GUIDE.md` - Quick start guide
- `/YOLO_IMPLEMENTATION_COMPLETE.md` - YOLO implementation details
- `/QUICK_START_YOLO.md` - YOLO quick start
- `/AI-RANKING-GUIDE.md` - AI ranking documentation
- `/REOLINK-CAMERAS-SETUP.md` - IP camera setup

### Newly Created (by this exploration)
- `/CODEBASE_ARCHITECTURE_MAP.md` - Complete architectural overview
- `/ARCHITECTURE_SUMMARY.md` - Quick reference summary
- `/FILE_LOCATIONS_REFERENCE.md` - This file

---

## API Routes

### Frontend API Routes (Next.js)
- **GET** `/api/connection-details`
  - Location: `/frontend/app/api/connection-details/route.ts`
  - Returns: LiveKit token and connection details

- **POST** `/api/external-stream`
  - Location: `/frontend/app/api/external-stream/route.ts`
  - Adds external RTSP streams

- **POST** `/api/generate-token`
  - Location: `/frontend/app/api/generate-token/route.ts`
  - Generates WebRTC tokens

### Backend API Routes (Fastify)
- **GET** `http://localhost:3000/health`
  - Server health check

- **POST** `http://localhost:3000/token`
  - Request: `{ identity, room?, role?, name? }`
  - Response: `{ token, url }`

- **GET** `http://localhost:3000/rankings`
  - Returns: Ranked list of all scores

- **WebSocket** `ws://localhost:3000/ws`
  - Real-time score updates
  - Initial score list on connect
  - Live score messages

---

## Entry Points for Development

### Understanding the Code
1. Start here: `/frontend/app/rooms/[roomName]/PageClientImpl.tsx`
2. Then: `/frontend/lib/Sidebar.tsx`
3. Then: `/frontend/lib/YOLOView.tsx` or `/frontend/lib/RankedView.tsx`
4. Backend: `/services/api-gateway/src/server.ts`
5. Worker: `/services/analysis-worker/worker.py`

### Adding New Features
- **New menu tab**: Edit `Sidebar.tsx` defaultItems (line 27-33)
- **New ranking logic**: Edit `YOLOView.tsx` rankedParticipants useMemo (line 182-211)
- **New AI prompt**: Edit `worker.py` ANALYSIS_PROMPT (line 51-69)
- **New UI overlay**: Create component in `/lib/` and import in views

### Modifying Existing Features
- **Score display colors**: `/frontend/lib/AIScoreOverlay.tsx` (line 22-26)
- **Rank badge colors**: `/frontend/lib/LiveVideoConference.tsx` (line 182-187)
- **YOLO settings**: `/frontend/lib/YOLOView.tsx` (line 41-46)
- **Detection categories**: `/frontend/lib/yolo/DetectionOverlay.tsx` (line 139-147)
- **WebSocket message handling**: `/frontend/app/rooms/[roomName]/PageClientImpl.tsx` (line 249-271)

---

## File Size Reference

| Component | Size | Purpose |
|-----------|------|---------|
| YOLOv11n ONNX | 12 MB | Object detection model |
| YOLO Service | 12 KB | Inference wrapper |
| YOLO View | 18 KB | Component |
| RankedView | 8 KB | Ranking display |
| Analysis Worker | 15 KB | GPT-4o-mini integration |
| API Gateway | 10 KB | WebSocket + REST |

---

## Common File Paths (Absolute)

Frontend:
- `/Users/nadavshanun/Downloads/cloud-obs-main/frontend/lib/YOLOView.tsx`
- `/Users/nadavshanun/Downloads/cloud-obs-main/frontend/lib/Sidebar.tsx`
- `/Users/nadavshanun/Downloads/cloud-obs-main/frontend/app/rooms/[roomName]/PageClientImpl.tsx`

Backend:
- `/Users/nadavshanun/Downloads/cloud-obs-main/services/api-gateway/src/server.ts`
- `/Users/nadavshanun/Downloads/cloud-obs-main/services/analysis-worker/worker.py`

Config:
- `/Users/nadavshanun/Downloads/cloud-obs-main/docker-compose.yml`
- `/Users/nadavshanun/Downloads/cloud-obs-main/frontend/next.config.js`

---

End of File Locations Reference
