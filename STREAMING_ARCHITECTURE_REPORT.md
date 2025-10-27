# Cloud Observability System - Video Streaming Architecture Report

## Executive Summary

This is a sophisticated multi-camera observability and AI analysis system that streams video from IP cameras through a real-time WebRTC pipeline, analyzes them with AI and YOLO object detection, and ranks them by engagement. The system uses go2rtc as the primary RTSP-to-WebRTC conversion layer.

**Current Streaming Technologies:**
- **RTSP Ingestion**: Reolink IP cameras via RTSP protocol
- **Stream Conversion**: go2rtc (RTSP → WebRTC proxy)
- **WebRTC Streaming**: LiveKit for peer-to-peer video distribution
- **Browser Rendering**: Canvas-based video display with overlay processing
- **AI Processing**: OpenAI GPT-4o-mini Vision API for frame analysis
- **Object Detection**: YOLO11n (ONNX runtime) for real-time detection

---

## 1. CURRENT STREAMING ARCHITECTURE

### 1.1 High-Level Data Flow

```
IP Cameras (RTSP)
    ↓
go2rtc (RTSP Parser + WebRTC Server)
    ↓
Browser WebSocket to go2rtc API
    ↓
WebRTC Peer Connection (RTCPeerConnection)
    ↓
MediaStream with Video Track
    ↓
LiveKit Room (WebRTC Broadcaster)
    ↓
Other Browser Clients (via LiveKit)
    ↓
Video Display + Analysis
```

### 1.2 Camera Configuration

**File**: `/Users/nadavshanun/Downloads/cloud-obs-main/go2rtc.yaml`

**Configured Cameras (6 total)**:
- Camera 1: `10.39.12.110:554` - RTSP (admin:Password03%21)
- Camera 2: `10.39.12.107:554` - RTSP (admin:Password03%21)
- Camera 3: `10.39.12.104:554` - RTSP (admin:Password03%21)
- Camera 4: `10.39.12.106:554` - RTSP (admin:zSQ6e9MB&03!)
- Camera 5: `10.39.12.109:554` - RTSP (admin:zSQ6e9MB&03!)
- Camera 6: `10.39.12.108:554` - RTSP (admin:zSQ6e9MB&03!)

Each camera is configured with both:
- Substream (lower quality/bandwidth): `h264Preview_01_sub`
- Main stream (higher quality): `h264Preview_01_main`

**go2rtc Configuration** (lines 1-54 of go2rtc.yaml):
```yaml
streams:
  camera_1:
    - rtsp://admin:Password03%21@10.39.12.110:554/h264Preview_01_sub
  camera_1_hd:
    - rtsp://admin:Password03%21@10.39.12.110:554/h264Preview_01_main

# ... (repeated for all 6 cameras)

webrtc:
  listen: ":8555"

api:
  listen: ":1984"
  origin: "*"
```

---

## 2. STREAMING TECHNOLOGY STACK

### 2.1 go2rtc (Stream Conversion Engine)

**Role**: Converts RTSP streams to WebRTC and provides API

**Configuration**:
- Docker container: `alexxit/go2rtc:latest`
- Bound to localhost port `1984` (API/WebSocket)
- Bound to localhost port `8554` (RTSP server)
- WebRTC listener on `:8555` (internal)

**Key Features**:
- RTSP stream ingestion with credential handling
- WebRTC offer/answer signaling via WebSocket API
- ICE candidate exchange
- Automatic reconnection on disconnect

**How It Works**:
1. Browser initiates RTCPeerConnection
2. Browser sends WebRTC offer via WebSocket to go2rtc API
3. go2rtc receives offer on `/api/ws?src=camera_1`
4. go2rtc sends answer back to browser
5. ICE candidates exchanged bidirectionally
6. MediaStream flows to browser

### 2.2 WebRTC in Browser

**Primary Components**:

#### CameraAutoConnect.tsx (Lines 21-164)
- **File**: `/Users/nadavshanun/Downloads/cloud-obs-main/frontend/lib/CameraAutoConnect.tsx`
- **Purpose**: Auto-connect all 6 cameras when room is ready
- **Execution**: 2 seconds after LiveKit room connection

**Key Implementation Details**:

```typescript
// Line 34: Connect to go2rtc WebRTC stream
const go2rtcUrl = `ws://localhost:1984/api/ws?src=${camera.streamName}`;

// Lines 37-39: Create WebRTC peer connection
const pc = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
});

// Lines 42-56: Handle incoming video track
pc.ontrack = async (event) => {
  const stream = event.streams[0];
  const videoTrack = stream.getVideoTracks()[0];
  
  // Publish to LiveKit room
  await room.localParticipant.publishTrack(videoTrack, {
    name: camera.name,
    source: Track.Source.Camera
  });
};

// Lines 59-60: Request video/audio tracks
pc.addTransceiver('video', { direction: 'recvonly' });
pc.addTransceiver('audio', { direction: 'recvonly' });

// Lines 62-64: Create and send offer
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);

// Lines 76-82: Send offer to go2rtc via WebSocket
ws.send(JSON.stringify({
  type: 'webrtc/offer',
  value: offer.sdp
}));

// Lines 90-103: Handle answer and ICE candidates
if (msg.type === 'webrtc/answer' && msg.value) {
  await pc.setRemoteDescription({
    type: 'answer',
    sdp: msg.value
  });
}
```

**Connection Flow**:
1. Room connection confirmed (isConnected = true)
2. CameraAutoConnect triggers (2 second delay)
3. For each of 6 cameras:
   - Create RTCPeerConnection
   - Create offer
   - Open WebSocket to go2rtc
   - Exchange SDP and ICE candidates
   - Wait for ontrack callback
   - Publish video track to LiveKit
   - 500ms delay before next camera

#### ExternalStreamModal.tsx (Lines 117-244)
- **File**: `/Users/nadavshanun/Downloads/cloud-obs-main/frontend/lib/ExternalStreamModal.tsx`
- **Purpose**: Manual camera connection via UI dialog
- **Similar implementation** to CameraAutoConnect but user-triggered

### 2.3 LiveKit WebRTC Distribution

**Role**: Peer-to-peer video distribution to all connected clients

**Configuration**:
- Docker container: `livekit/livekit-server:latest`
- API port: `7880` (WebSocket for clients)
- TCP port: `7881`
- UDP media ports: `50000-50020`
- Redis backend for state coordination

**How Video Gets to Other Clients**:
1. Camera stream published to LiveKit room (via CameraAutoConnect)
2. LiveKit tracks all participants and their published tracks
3. New participants auto-subscribe to all video tracks
4. LiveKit routes video via UDP (media) and TCP fallback

### 2.4 Video Analysis Pipeline

**Backend: Analysis Worker** (`/services/analysis-worker/worker.py`)

**Purpose**: Sample video frames and score them with OpenAI Vision API

**Frame Flow**:
```
VideoTrack (from LiveKit)
    ↓
LiveKitVideoWorker.on_track_subscribed() [Line 259-286]
    ↓
process_video_track() [Line 304-385]
    ↓
VideoStream async iterator [Line 325]
    ↓
Every 3 seconds (FRAME_SAMPLE_INTERVAL) [Line 376]:
    - Receive frame event
    - Convert I420/YUV to RGB [Lines 330-363]
    - Resize to 640x480
    - JPEG encode (80% quality)
    - Base64 encode
    ↓
OpenAI Vision API Call [Line 100-119]
    - Prompt: Engagement scoring (0.0-1.0)
    - Detail: "low" for faster/cheaper analysis
    - Max tokens: 100
    ↓
Parse Response [Lines 121-148]
    - Extract score (0.0-1.0)
    - Extract reason (string)
    ↓
Publish to Redis [Line 405]
    - Channel: "scores.stream"
    - Message: JSON with score + reason
    ↓
API Gateway [/services/api-gateway/src/server.ts]
    - Subscribes to Redis channel [Line 225]
    - Stores in memory [Line 233]
    - Broadcasts via WebSocket [Lines 243-249]
    ↓
Frontend WebSocket [VideoConferenceClientImpl.tsx, Line 170-239]
    - Receives score updates
    - Updates aiScores Map
    - Components re-render with rankings
```

---

## 3. KEY FILE LOCATIONS AND COMPONENTS

### 3.1 Frontend Components

| File | Location | Purpose | Key Lines |
|------|----------|---------|-----------|
| CameraAutoConnect | `/frontend/lib/CameraAutoConnect.tsx` | Auto-connect cameras via go2rtc | 21-164 |
| ExternalStreamModal | `/frontend/lib/ExternalStreamModal.tsx` | Manual camera/stream addition UI | 117-244 |
| LiveVideoConference | `/frontend/lib/LiveVideoConference.tsx` | Main grid view with rank badges | 24-242 |
| YOLOView | `/frontend/lib/YOLOView.tsx` | Object detection + AI ranking | 35-352 |
| DashboardView | `/frontend/lib/DashboardView.tsx` | Video file upload + ranking | 33-356 |
| VideoConferenceClientImpl | `/frontend/app/custom/VideoConferenceClientImpl.tsx` | Room connection + WebSocket setup | 79-239 |
| AIScoreOverlay | `/frontend/lib/AIScoreOverlay.tsx` | Score badge rendering | 14-71 |
| convertForLiveKit | `/frontend/lib/convertForLiveKit.ts` | Video color space conversion | 323-434 |

### 3.2 Backend Services

| Component | Location | Purpose | Key Lines |
|-----------|----------|---------|-----------|
| API Gateway | `/services/api-gateway/src/server.ts` | WebSocket score broadcast | 181-257 |
| Analysis Worker | `/services/analysis-worker/worker.py` | Video frame analysis | 48-473 |
| VideoAnalyzer | `/services/analysis-worker/worker.py` | OpenAI Vision integration | 48-156 |
| LiveKitVideoWorker | `/services/analysis-worker/worker.py` | Track subscription & processing | 158-411 |

### 3.3 Configuration Files

| File | Purpose | Key Lines |
|------|---------|-----------|
| `go2rtc.yaml` | RTSP camera definitions | 1-59 |
| `docker-compose.yml` | Service orchestration | 1-101 |
| `livekit.yaml` | LiveKit server config | 1-44 |
| `.env` | API keys and URLs | 1-27 |

---

## 4. IDENTIFIED ISSUES & WORKAROUNDS

### 4.1 CRITICAL ISSUE #1: RTSP Disabled on Cameras

**Symptom**: Black screens for camera streams

**Root Cause**: Reolink cameras ship with RTSP disabled by default

**Evidence**: go2rtc logs show 30-second timeout:
```
00:56:25.324 DBG [streams] start producer url=rtsp://...
00:56:55.488 DBG [streams] stop producer  // Timeout!
```

**Fix Required** (Manual):
1. Open browser to each camera IP (10.39.12.110, etc.)
2. Login with admin credentials
3. Navigate: Settings → Network → Advanced → Port
4. Enable RTSP toggle
5. Verify port 554
6. Save and restart camera

**Status**: NOT YET FIXED - requires manual camera configuration

### 4.2 CRITICAL ISSUE #2: Room Mismatch (AI Scoring)

**Symptom**: "0 ranked" - no AI scores generated despite worker running

**Root Cause**: Frontend joins dynamic room (e.g., `/rooms/test`) but worker is hardcoded to `"geome-hackathon"`

**Evidence** (worker.py, lines 42, 89, 420):
```python
ROOM_NAME = os.getenv('ROOM_NAME', 'geome-hackathon')  # Hardcoded!
token.with_grants(VideoGrants(room=ROOM_NAME, ...))
```

**How It Works Correctly**:
1. Frontend joins room from URL parameter
2. Worker connects to same room
3. Worker subscribes to video tracks
4. Worker samples frames every 3 seconds
5. Sends to OpenAI for analysis
6. Publishes scores to Redis
7. API Gateway broadcasts to all clients

**How It's Currently Broken**:
- URL: `localhost:3000/rooms/myroom`
- Frontend joins: `"myroom"`
- Worker joins: `"geome-hackathon"`
- Worker sees 0 remote participants
- No AI analysis happens

**Partial Workaround**: 
- Always use room name `"geome-hackathon"` in URL
- Not scalable for production

**Proper Fix Needed**:
- Frontend sends room name to backend token endpoint
- Backend passes to worker OR
- Worker subscribes to all rooms OR
- Environment-based room routing

### 4.3 MODERATE ISSUE #3: Go2rtc WebSocket Hardcoded

**Symptom**: Camera connection fails in production deployments

**Root Cause**: CameraAutoConnect.tsx hardcodes localhost:

**Code** (Line 34):
```typescript
const go2rtcUrl = `ws://localhost:1984/api/ws?src=${camera.streamName}`;
```

**Problem**:
- Won't work when running in Docker containers
- Won't work in cloud deployments
- Needs to be configurable

**Proper Fix**:
- Read from environment variable
- Use relative URL or config
- Example: `ws://${process.env.NEXT_PUBLIC_GO2RTC_URL || 'localhost:1984'}/api/ws?src=${camera.streamName}`

### 4.4 MODERATE ISSUE #4: Video Color Space Conversion Overhead

**Symptom**: High CPU usage during live streaming

**Root Cause**: Canvas-based color space conversion (convertForLiveKit.ts)

**Details** (Lines 343-434):
- Fallback method uses canvas.drawImage()
- Per-pixel color correction applied
- Runs on every frame for uploaded videos
- ~40-60ms per frame overhead

**Performance Impact**:
- H.265 Main 10 correction adds 15-20% CPU overhead
- Better for quality but slower

**Workaround**:
- Use H.264 input instead of H.265
- Reduce resolution (720p instead of 1080p)
- The system tries WebCodecs first (faster) and falls back to canvas

### 4.5 MODERATE ISSUE #5: No Reconnection Logic for go2rtc Streams

**Symptom**: Camera stream stops if go2rtc restarts

**Root Cause**: WebSocket closed but no automatic reconnection

**Code** (CameraAutoConnect.tsx, Line 125-127):
```typescript
ws.onclose = () => {
  console.log(`[Camera Connection] WebSocket closed for ${camera.name} (${camera.ip})`);
  // No reconnection attempt!
};
```

**Impact**:
- Manual page refresh required
- Stream interruption not transparent

**Workaround**: Browser refresh reconnects cameras

**Proper Fix Needed**:
- Implement exponential backoff reconnection
- Track connection state per camera
- Show UI indicator for disconnected cameras

### 4.6 MINOR ISSUE #6: No Error Recovery for AI Analysis

**Symptom**: If OpenAI API fails, no fallback

**Root Cause**: Error returns score=0.5 with error message

**Code** (worker.py, Lines 150-155):
```python
except json.JSONDecodeError as e:
    return {'score': 0.5, 'reason': 'Analysis failed (JSON parse error)'}
except Exception as e:
    return {'score': 0.5, 'reason': f'Analysis failed: {str(e)}'}
```

**Impact**: 
- Scores become meaningless during API outages
- No distinction between actual scores and errors
- Rankings based on error responses

**Proper Fix**:
- Add retry with exponential backoff
- Skip frame if analysis fails
- Return null/None instead of 0.5
- Handle differently in frontend

---

## 5. VIDEO STREAMING PIPELINE DETAILS

### 5.1 Frame Sampling and Analysis

**Time-based Sampling** (worker.py, Line 376):
```python
await asyncio.sleep(FRAME_SAMPLE_INTERVAL)  # Default: 3.0 seconds
```

**Why Every 3 Seconds?**
- OpenAI Vision API is expensive (~0.05-0.07 cents per call)
- 3 second interval = 20 calls/minute/camera = ~$0.07/camera/minute
- For 6 cameras: ~$0.42/minute = ~$25/hour (if continuous)

**Frame Processing**:
1. Receive frame from LiveKit video track
2. Convert from I420 YUV to RGB (Lines 337-363)
3. Resize to 640x480 for bandwidth
4. JPEG encode at 80% quality (Line 91-92)
5. Base64 encode (Line 95)
6. Send to OpenAI with detail="low" (Line 111)

**Performance**: ~2-5 seconds per frame analysis

### 5.2 Score Distribution

**Message Flow**:
```
Analysis Worker → Redis pub/sub
                    ↓
                API Gateway (subscribes)
                    ↓
                WebSocket broadcast to all clients
                    ↓
                Frontend WebSocket listener
                    ↓
                Update aiScores Map
                    ↓
                React component re-render
```

**Latency**:
- Frame capture: <10ms
- Analysis: 2-5 seconds
- Redis publish: <1ms
- WebSocket broadcast: 50-200ms (network dependent)
- Frontend render: <50ms
- **Total**: ~2.5-5.2 seconds end-to-end

### 5.3 YOLO Object Detection

**Browser-based Detection** (YOLOView.tsx, Lines 92-182):

```typescript
// Load YOLO model (Lines 40-47)
const yoloService = useMemo(() => {
  return new YOLOService({
    modelPath: '/models/yolo11n_256.onnx',
    inputSize: [256, 256],
    confidenceThreshold: 0.25,
    iouThreshold: 0.4,
  });
}, []);

// Process at 10 FPS (Lines 153-154)
const interval = setInterval(processFrame, 100);

// For each frame:
const detections = await yoloService.detect(videoElement);
```

**Performance**:
- Model size: ~4.3 MB (yolo11n_256)
- Inference: 40-60ms per frame
- FPS: ~10 FPS per video
- With 6 cameras: Total ~15-20% CPU per core

**Comparison to AI Analysis**:
- YOLO: Real-time (100ms), in-browser, free
- GPT-4o-mini: 2-5 seconds, cloud-based, expensive

---

## 6. CONFIGURATION SUMMARY

### 6.1 Environment Variables

```bash
# OpenAI
OPENAI_API_KEY=sk-proj-...        # Required for AI analysis
OPENAI_MODEL=gpt-4-mini           # Or gpt-4o-mini

# LiveKit
LIVEKIT_URL=ws://livekit-server:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret

# Redis
REDIS_URL=redis://redis:6379

# Sampling
FRAME_SAMPLE_INTERVAL=3.0          # Seconds between frame analysis

# Room
ROOM_NAME=geome-hackathon          # HARDCODED - problematic

# Frontend
NEXT_PUBLIC_MAIN_BACKEND_URL=http://localhost:3000
```

### 6.2 Port Mappings

```
3000   - API Gateway (WebSocket + REST)
1984   - go2rtc API and WebSocket
8554   - go2rtc RTSP server
7880   - LiveKit WebSocket
7881   - LiveKit TCP
50000-50020 - LiveKit UDP media
6380   - Redis (external port, internal is 6379)
```

---

## 7. SUMMARY OF ARCHITECTURE STRENGTHS & WEAKNESSES

### Strengths:
1. **Real-time Detection**: YOLO in browser = instant, no server GPU needed
2. **Cost-effective Hybrid**: YOLO for speed, GPT-4o for semantics
3. **Modular Views**: Easy to swap views (Live, Ranked, YOLO, Dashboard)
4. **Scalable to 100+ participants**: LiveKit can handle it
5. **Robust WebRTC**: Proper SDP/ICE candidate handling
6. **Error Resilience**: Fallback color space conversion methods

### Weaknesses:
1. **Hardcoded Room Names**: Worker only analyzes one room
2. **Hardcoded go2rtc URL**: Won't work in Docker/cloud
3. **No Stream Reconnection**: Manual refresh needed
4. **No API Error Handling**: Failed analysis returns dummy scores
5. **Manual Camera Setup**: RTSP must be enabled on each camera
6. **Expensive per-frame Analysis**: $25/hour for 6 continuous cameras
7. **No Bandwidth Optimization**: All cameras start at substream only

---

## 8. RECOMMENDATIONS FOR IMPROVEMENTS

### Immediate Fixes (Critical):
1. **Fix Room Mismatch**: Accept room name as query parameter or environment variable
2. **Enable RTSP on Cameras**: Manual setup on each camera (lines 88-95 of COMPLETE_DIAGNOSIS_AND_FIXES.md)
3. **Make go2rtc URL Configurable**: Use environment variable instead of hardcoded localhost

### Medium-term (Important):
1. Add automatic reconnection for go2rtc WebSocket
2. Implement stream health monitoring
3. Add visual indicators for stream status
4. Cache OpenAI analysis responses to reduce API calls
5. Implement adaptive frame sampling (skip if no motion detected)

### Long-term (Nice to Have):
1. Docker compose networking fixes
2. Kubernetes deployment support
3. Multi-room support with routing
4. Hardware-accelerated video encoding
5. Stream quality adaptation based on bandwidth
6. Persistent score history and trends

---

