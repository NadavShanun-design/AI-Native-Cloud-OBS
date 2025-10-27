# Video Streaming Architecture - Quick Reference Guide

## Technology Stack at a Glance

| Component | Technology | Purpose | Port/URL |
|-----------|-----------|---------|----------|
| RTSP Ingestion | Reolink IP Cameras | 6 high-def surveillance cameras | 10.39.12.x:554 |
| Stream Conversion | go2rtc | RTSP → WebRTC proxy | localhost:1984 |
| WebRTC Server | LiveKit | Peer-to-peer video distribution | ws://livekit-server:7880 |
| Message Bus | Redis | Score pub/sub | redis:6379 |
| API Gateway | Fastify + Node.js | WebSocket broadcast | http://localhost:3000 |
| AI Analysis | OpenAI GPT-4o-mini | Frame scoring (0-1.0) | Cloud API |
| Object Detection | YOLO11n (ONNX) | Real-time detection in browser | `/models/yolo11n_256.onnx` |

---

## Critical Connection Points

### Camera → Browser Video Flow

```
Camera (RTSP)
    ↓ [go2rtc WebSocket bridge]
Browser RTCPeerConnection
    ↓ [SDP + ICE candidates via ws://localhost:1984/api/ws]
MediaStream Object
    ↓ [publish to LiveKit]
LiveKit Room
    ↓ [auto-subscribe]
All Browser Clients
    ↓ [display in UI]
Video Grid with Analysis Overlays
```

**Key Files**:
- `/frontend/lib/CameraAutoConnect.tsx` - Browser-side WebRTC connection (lines 34, 62-82)
- `/go2rtc.yaml` - Camera RTSP endpoints (lines 4-46)
- `/docker-compose.yml` - go2rtc service config (lines 81-93)

### Analysis Pipeline

```
Video Track (LiveKit)
    ↓ [Python worker]
Sample Frame (every 3 seconds)
    ↓ [convert I420→RGB, resize, JPEG encode]
OpenAI Vision API
    ↓ [score 0.0-1.0 + reason]
Redis Pub/Sub
    ↓ [channel: scores.stream]
API Gateway (WebSocket)
    ↓ [broadcast to all clients]
Frontend aiScores Map
    ↓ [React re-render]
Score Badges on Video Tiles
```

**Key Files**:
- `/services/analysis-worker/worker.py` - Frame sampling (lines 304-385)
- `/services/api-gateway/src/server.ts` - WebSocket broadcast (lines 181-207)
- `/frontend/app/custom/VideoConferenceClientImpl.tsx` - Frontend listener (lines 169-239)

---

## File Structure Map

### Frontend Video Components

```
/frontend/lib/
├── CameraAutoConnect.tsx       [Lines 21-164]    Auto-connect cameras via go2rtc
├── ExternalStreamModal.tsx     [Lines 117-244]   Manual camera addition
├── LiveVideoConference.tsx     [Lines 24-242]    Grid view with rank badges
├── YOLOView.tsx                [Lines 35-352]    Object detection + ranking
├── DashboardView.tsx           [Lines 33-356]    Video uploads
├── AIScoreOverlay.tsx          [Lines 14-71]     Score badge component
├── convertForLiveKit.ts        [Lines 323-434]   Color space conversion
└── yolo/
    ├── YOLOService.ts          [Lines 50-200+]   ONNX inference engine
    └── DetectionOverlay.tsx    [Lines 1-100+]    Draw bounding boxes
```

### Backend Services

```
/services/
├── api-gateway/
│   └── src/server.ts           [Lines 181-257]   WebSocket + Redis listener
└── analysis-worker/
    └── worker.py               [Lines 48-473]    Video analysis main
        ├── VideoAnalyzer       [Lines 48-156]    OpenAI integration
        └── LiveKitVideoWorker  [Lines 158-411]   Track processing
```

### Configuration

```
/
├── go2rtc.yaml                 RTSP camera definitions + WebRTC config
├── docker-compose.yml          Service orchestration
├── livekit.yaml                LiveKit server configuration
└── .env                        API keys and environment variables
```

---

## CRITICAL HARDCODED VALUES

### Issue #1: go2rtc URL Hardcoded to localhost

**Location**: `/frontend/lib/CameraAutoConnect.tsx:34` and `/frontend/lib/ExternalStreamModal.tsx:130`

```typescript
const go2rtcUrl = `ws://localhost:1984/api/ws?src=${camera.streamName}`;
```

**Problem**: Only works on same machine. Docker/cloud deployments will fail.

**Fix**: 
```typescript
const go2rtcUrl = `ws://${process.env.NEXT_PUBLIC_GO2RTC_URL || 'localhost:1984'}/api/ws?src=${camera.streamName}`;
```

---

### Issue #2: Room Name Hardcoded in Worker

**Location**: `/services/analysis-worker/worker.py:42`

```python
ROOM_NAME = os.getenv('ROOM_NAME', 'geome-hackathon')
```

**Problem**: Worker only analyzes one room. Frontend can join any room via URL.

**Flow of the Problem**:
1. Frontend: URL = `/rooms/mytest` → joins room `"mytest"`
2. Worker: ROOM_NAME = `"geome-hackathon"` → joins room `"geome-hackathon"`
3. Result: Worker doesn't see any participants → No AI analysis

**Fix Options**:
- Option A: Worker discovers and subscribes to all rooms
- Option B: Frontend sends room name to token endpoint, worker gets it from there
- Option C: Use environment variable that must match URL parameter

**Current Workaround**: Always use `/rooms/geome-hackathon` in URL

---

## Performance Metrics

### AI Analysis (OpenAI)
- **Frequency**: Every 3.0 seconds per camera
- **Per-frame Time**: 2-5 seconds
- **Cost**: ~$0.05 per analysis
- **For 6 cameras**: $25/hour continuous

### YOLO Detection (Browser)
- **Frequency**: Every 100ms (10 FPS)
- **Per-frame Time**: 40-60ms
- **Model Size**: 4.3 MB
- **CPU Usage**: 15-20% per core for 6 cameras

### Network Latency
- Frame capture to desktop: <10ms
- Analysis time: 2-5 seconds
- Redis pub/sub: <1ms
- WebSocket delivery: 50-200ms
- Frontend render: <50ms
- **Total**: ~2.5-5.2 seconds end-to-end

---

## Known Issues Summary

| Issue | Severity | Status | Root Cause | Impact |
|-------|----------|--------|-----------|--------|
| RTSP disabled on cameras | CRITICAL | NOT FIXED | Reolink default settings | Black video feeds |
| Room name mismatch | CRITICAL | NOT FIXED | Hardcoded worker room | No AI scores (0 ranked) |
| go2rtc URL hardcoded | MODERATE | NOT FIXED | localhost:1984 in code | Docker/cloud fails |
| No stream reconnection | MODERATE | NOT FIXED | ws.onclose() empty | Manual refresh needed |
| Color space overhead | MODERATE | MITIGATED | Canvas fallback method | High CPU during uploads |
| AI error handling | MINOR | MITIGATED | Returns 0.5 on failure | Bad rankings on API outage |

---

## Environment Variables Reference

### Backend (.env)

```bash
# CRITICAL - Required for operation
OPENAI_API_KEY=sk-proj-...                  # OpenAI API key (required for AI analysis)
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_URL=ws://livekit-server:7880        # Must match docker-compose
REDIS_URL=redis://redis:6379                # Must match docker-compose
ROOM_NAME=geome-hackathon                   # HARDCODED - frontend must use same room

# Optional - Tuning
OPENAI_MODEL=gpt-4o-mini
FRAME_SAMPLE_INTERVAL=3.0                   # Seconds between analysis
LOG_LEVEL=info
```

### Frontend (.env.local)

```bash
# Backend API URL
NEXT_PUBLIC_MAIN_BACKEND_URL=http://localhost:3000

# NOT SET - Need to add:
# NEXT_PUBLIC_GO2RTC_URL=ws://localhost:1984
```

---

## Quick Diagnosis Guide

### Symptom: "Black screen on camera feeds"

**Check**: Is RTSP enabled on camera?
```
1. Open http://[CAMERA_IP] in browser
2. Settings → Network → Advanced
3. Look for "RTSP" toggle → Must be ON
4. Port should be 554
```

**Check**: Is go2rtc running?
```bash
docker-compose logs go2rtc
docker-compose ps | grep go2rtc
```

**Check**: Can you reach go2rtc API?
```bash
curl http://localhost:1984/api/version
```

---

### Symptom: "0 ranked - no AI scores"

**Check**: Are you using the right room name?
```
Current URL: http://localhost:3000/rooms/[ROOMNAME]
Worker joins: geome-hackathon (from .env)
[ROOMNAME] must equal geome-hackathon
```

**Check**: Is analysis worker running?
```bash
docker-compose logs analysis-worker
# Look for "Found N remote participant(s)"
```

**Check**: Is Redis connected?
```bash
docker-compose exec redis redis-cli ping
# Response: PONG
```

---

### Symptom: "YOLO offline - orange badge"

**Check**: Model file exists?
```bash
ls -la frontend/public/models/yolo11n_256.onnx
# If missing, download from ultralytics or export
```

**Check**: Browser console errors?
```
Press F12 → Console
Look for "Failed to initialize YOLO"
```

---

## Stream Health Monitoring

### Docker Command to Monitor Streams

```bash
# Watch all container logs with timestamps
docker-compose logs --follow --timestamps

# Filter by service
docker-compose logs --follow --timestamps go2rtc
docker-compose logs --follow --timestamps analysis-worker
docker-compose logs --follow --timestamps livekit-server

# Check Redis scores in real-time
docker-compose exec redis redis-cli SUBSCRIBE scores.stream
```

### Browser DevTools Checklist

```
1. Network tab:
   - WebSocket ws://localhost:3000/ws → Status 101 (Switching Protocols)
   - WebSocket ws://localhost:1984/api/ws?src=... → Status 101

2. Console:
   - No "Failed to connect" errors
   - Look for "AI WebSocket connected" message
   - Check for YOLO initialization success

3. Application tab:
   - sessionStorage/localStorage for tokens
   - Check room name in URL matches ROOM_NAME env var
```

---

## Port Checklist

All these ports must be accessible for the system to work:

| Port | Service | Protocol | Check |
|------|---------|----------|-------|
| 3000 | API Gateway | HTTP/WS | `curl http://localhost:3000/health` |
| 1984 | go2rtc API | HTTP/WS | `curl http://localhost:1984/api/version` |
| 8554 | go2rtc RTSP | RTSP | (camera connection only) |
| 7880 | LiveKit | WS | (check browser DevTools Network) |
| 7881 | LiveKit | TCP | (check browser connection) |
| 50000-50020 | LiveKit Media | UDP | (check browser media flowing) |
| 6379 | Redis | TCP | `docker-compose exec redis redis-cli ping` |

---

## Deployment Notes

### Docker Compose Issues

The system assumes:
- All services on same Docker network
- Host.docker.internal works for reaching host services (macOS/Windows)
- go2rtc can reach camera IPs (10.39.12.x)

### Production Readiness

**NOT PRODUCTION READY** because:
1. go2rtc URL hardcoded (won't work in Kubernetes)
2. Room name hardcoded (single-tenant only)
3. No stream reconnection logic (manual restart needed)
4. No error handling for API outages
5. RTSP credentials in plain YAML file
6. No HTTPS/TLS configuration
7. No authentication for admin endpoints
8. Single API Gateway instance (no scaling)

---

## Quick Start Checklist

- [ ] Enable RTSP on all 6 cameras (Settings → Network → RTSP)
- [ ] Set `ROOM_NAME=geome-hackathon` in .env
- [ ] Set `OPENAI_API_KEY` in .env
- [ ] Run `docker-compose up -d`
- [ ] Download YOLO model to `/frontend/public/models/yolo11n_256.onnx`
- [ ] Run `cd frontend && pnpm install && pnpm dev`
- [ ] Visit `http://localhost:3000/rooms/geome-hackathon`
- [ ] Wait 2 seconds for cameras to connect
- [ ] Check browser console for "AI WebSocket connected"
- [ ] Press 'T' on Live view to test AI scores

---

## References

For detailed information, see:
- **Full Architecture**: `STREAMING_ARCHITECTURE_REPORT.md`
- **Issues & Diagnosis**: `COMPLETE_DIAGNOSIS_AND_FIXES.md`
- **System Overview**: `ARCHITECTURE_SUMMARY.md`
- **Codebase Map**: `CODEBASE_ARCHITECTURE_MAP.md`

