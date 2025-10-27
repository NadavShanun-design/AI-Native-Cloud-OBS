# Complete System Diagnosis & Fixes

**Date**: October 26, 2025
**Status**: Critical Issues Identified - Fixes Required

---

## Executive Summary

### Issues from Screenshots

1. ✅ **Your webcam IS working** - YOLO detected you at 84% confidence
2. ❌ **Camera 1 & 2 showing black screens** - No video feed
3. ❌ **AI Ranking showing "0 ranked"** - No AI scores being generated
4. ❌ **Console errors** - YOLO model initialization, track dimensions
5. ❌ **AI reasoning not visible** - Code exists but no scores to display

---

## Root Cause Analysis

### Issue #1: AI Ranking Not Working (CRITICAL)

**Symptom**: "0 ranked" despite AI Analysis Active badge
**Root Cause**: AI worker sees 0 remote participants

**Evidence from logs**:
```
[INFO] Found 0 remote participant(s) in room
[INFO] No remote participants in room yet - waiting for participants to join...
```

**Why this happens**:
- Frontend joins room from URL: `/rooms/[roomName]`
- AI worker is hardcoded to: `"geome-hackathon"`
- **If you joined a different room name, they're in separate rooms!**

**Example**:
- You visit: `http://localhost:3001/rooms/test`
- You join room: `"test"`
- AI worker is in room: `"geome-hackathon"`
- Result: Worker never sees you → No AI scores generated

**How AI Ranking SHOULD Work**:
1. User publishes video track to LiveKit room
2. AI worker subscribes to the track
3. Worker samples frames every 3 seconds
4. Sends frames to OpenAI GPT-4o-mini Vision API
5. Receives score (0.0-1.0) and reasoning
6. Publishes to Redis pub/sub
7. API Gateway broadcasts to all WebSocket clients
8. Frontend displays score + reasoning in UI

**Current Status**: ❌ Step 2 fails - worker never subscribes because it doesn't see participants

---

### Issue #2: Camera Feeds Showing Black Screens

**Symptom**: Camera 1, Camera 2 appear in UI but show no video
**Root Cause**: RTSP streams timeout after 30 seconds

**Evidence from go2rtc logs**:
```
00:56:25.324 DBG [streams] start producer url=rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_sub
00:56:55.488 DBG [streams] stop producer  // 30 seconds later - timeout!
```

**Why cameras 4, 5, 6 also fail**:
```
00:56:26.745 DBG [webrtc] add consumer error="streams: wrong user/pass"
```
- Password encoding issue was fixed in go2rtc.yaml
- BUT RTSP is likely still disabled on these cameras

**Reolink Camera Requirement**:
⚠️ **CRITICAL**: Reolink cameras ship with **RTSP DISABLED by default**

You MUST enable RTSP on each camera:
1. Open browser: `http://10.39.12.110` (camera IP)
2. Login: `admin` / `Password03!` (or `zSQ6e9MB&03!` for cameras 4-6)
3. Navigate: Settings → Network → Advanced → Port
4. **Enable RTSP** toggle
5. Verify port is **554**
6. Click Save
7. **Repeat for all 6 cameras**

**Camera IPs**:
- Camera 1: http://10.39.12.110
- Camera 2: http://10.39.12.107
- Camera 3: http://10.39.12.104
- Camera 4: http://10.39.12.106
- Camera 5: http://10.39.12.109
- Camera 6: http://10.39.12.108

---

### Issue #3: Console Errors

#### Error 1: "could not determine track dimensions, using defaults {}"
**Impact**: Low - LiveKit uses default dimensions, video still works
**Cause**: Video track metadata not immediately available
**Fix**: Not critical - this is expected for some track types

#### Error 2: "Error: [YOLO] Model not initialized"
**Impact**: Medium - YOLO detection fails to start
**Cause**: Model file might be missing or async initialization race condition
**Fix**: Check `/frontend/public/models/yolo11n_256.onnx` exists

#### Error 3: "Failed to load resource: 404 (Not Found) - index.css.map"
**Impact**: None - source maps are optional dev tools
**Cause**: Next.js CSS map file not generated
**Fix**: Ignore - doesn't affect functionality

---

## Complete System Architecture

### How Everything Connects

```
┌─────────────────────┐
│   Reolink Cameras   │
│  (10.39.12.104-110) │
│                     │
│ RTSP Port 554       │
└──────────┬──────────┘
           │ RTSP Stream (H.264)
           ↓
┌──────────────────────┐
│      go2rtc          │
│   (Port 1984)        │
│  RTSP → WebRTC       │
└──────────┬───────────┘
           │ WebSocket + WebRTC
           ↓
┌──────────────────────┐
│   Browser Frontend   │
│   (Port 3001)        │
│  CameraAutoConnect   │
└──────────┬───────────┘
           │ Publish video tracks
           ↓
┌──────────────────────┐
│   LiveKit Server     │
│   (Port 7880)        │
│   Room: "geome-      │
│    hackathon"        │
└───┬────────────┬─────┘
    │            │
    │            └──────────────┐
    ↓                           ↓
┌───────────────┐     ┌──────────────────┐
│ AI Analysis   │     │   All Browsers   │
│   Worker      │     │   (Viewers)      │
│  (Python)     │     │                  │
└───────┬───────┘     └──────────────────┘
        │
        │ Every 3 seconds:
        │ Sample frame → OpenAI API
        │
        ↓
┌───────────────┐
│  OpenAI GPT   │
│   4o-mini     │
│  Vision API   │
└───────┬───────┘
        │ Returns: {score: 0.75, reason: "..."}
        ↓
┌───────────────┐
│     Redis     │
│   Pub/Sub     │
└───────┬───────┘
        │ Broadcast scores
        ↓
┌───────────────┐
│ API Gateway   │
│  WebSocket    │
└───────┬───────┘
        │ Push to all clients
        ↓
┌───────────────┐
│   Frontend    │
│   Displays:   │
│   • AI Score  │
│   • Reasoning │
│   • Rankings  │
└───────────────┘
```

---

## AI Reasoning Display - Already Implemented!

### Where AI Reasoning Appears

**Good news**: AI reasoning is ALREADY displayed in the code! You just need AI scores to be generated.

**YOLOView Combined Mode** (lines 450-456):
```typescript
{data.score && (
  <div className={styles.scoreDetails}>
    <div className={styles.scoreValue}>AI Score: {Math.round(data.score.score * 100)}%</div>
    <div className={styles.reason}>{data.score.reason}</div>  // ← AI REASONING HERE
    <div className={styles.timestamp}>Updated {new Date(data.score.timestamp).toLocaleTimeString()}</div>
  </div>
)}
```

**RankedView** - Also shows reasoning (needs verification)

**What reasoning looks like**:
```json
{
  "score": 0.85,
  "reason": "Person speaking with clear engagement, good eye contact and animated gestures"
}
```

**Example scores from VLM**:
- 0.9-1.0: "Multiple people engaged in lively discussion with dynamic movement"
- 0.7-0.8: "Single person visible, speaking to camera with moderate engagement"
- 0.3-0.4: "Person in background, minimal movement, low engagement"
- 0.0-0.2: "Empty room, no people visible, static scene"

**For black camera screens**:
The VLM would analyze and return:
```json
{
  "score": 0.05,
  "reason": "Black screen, no visible content or activity"
}
```

This is EXPECTED behavior - the system will still rank cameras, just with low scores.

---

## Step-by-Step Fixes

### Fix #1: Ensure You're in the Correct Room (CRITICAL)

**Option A: Join the worker's room**
1. Open browser
2. Navigate to: `http://localhost:3001/rooms/geome-hackathon`
3. Enter your name and join
4. **AI ranking should start working within 3 seconds**

**Option B: Change worker to join your room**
1. Edit `.env` file:
   ```bash
   ROOM_NAME=your-room-name
   ```
2. Restart analysis worker:
   ```bash
   docker-compose restart analysis-worker
   ```

**How to verify it's working**:
1. Open browser console (F12)
2. Within 3-10 seconds you should see:
   ```
   📊 Published score for YourName: 0.75
   ```
3. Check analysis worker logs:
   ```bash
   docker logs -f cloud-obs-analysis-worker
   ```
4. Should see:
   ```
   [INFO] 🎥 Subscribed to video track: YourName__abc1 - Track: Video
   [INFO] 📹 Received frame #1 from YourName
   [INFO] Analysis complete: score=0.75, reason=...
   [INFO] 📊 Published score for YourName: 0.75
   ```

---

### Fix #2: Enable RTSP on All Cameras

**For EACH camera (all 6)**:

1. **Access camera web interface**:
   - Open: `http://10.39.12.110` (use camera's IP)
   - Login:
     - Cameras 1-3: `admin` / `Password03!`
     - Cameras 4-6: `admin` / `zSQ6e9MB&03!`

2. **Enable RTSP**:
   - Settings → Network → Advanced → Port
   - Toggle **RTSP** to ON
   - Verify port: **554**
   - Click **Save**

3. **Test RTSP stream** (optional but recommended):
   ```bash
   vlc "rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_sub"
   ```

4. **Repeat for all cameras**:
   - http://10.39.12.107
   - http://10.39.12.104
   - http://10.39.12.106
   - http://10.39.12.109
   - http://10.39.12.108

5. **Restart go2rtc to retry connections**:
   ```bash
   docker-compose restart go2rtc
   ```

6. **Check go2rtc logs**:
   ```bash
   docker logs -f cloud-obs-go2rtc
   ```

   Look for:
   ✅ `[streams] start producer url=rtsp://...`
   ❌ Should NOT see: `[streams] stop producer` after 30 seconds

---

### Fix #3: Verify YOLO Model Exists

1. **Check model file**:
   ```bash
   ls -lh /Users/nadavshanun/Downloads/cloud-obs-main/frontend/public/models/yolo11n_256.onnx
   ```

2. **If missing, download/generate it**:
   ```bash
   cd /Users/nadavshanun/Downloads/cloud-obs-main/frontend/public/models

   # Option A: Export from ultralytics
   pip3 install ultralytics
   python3 -c "from ultralytics import YOLO; YOLO('yolo11n.pt').export(format='onnx', imgsz=256)"
   mv yolo11n.onnx yolo11n_256.onnx
   ```

3. **Restart frontend** (if it was running during download):
   ```bash
   # In frontend directory
   # Ctrl+C to stop
   pnpm dev
   ```

---

## Testing the Complete Flow

### Test 1: Your Webcam with AI Ranking

**Goal**: Verify AI ranking works with your webcam
**Expected**: AI score appears within 3-10 seconds

1. Navigate to: `http://localhost:3001/rooms/geome-hackathon`
2. Enter your name, enable camera
3. Join room
4. Click hamburger menu → **View** tab
5. Select **Combined View**
6. **Expected results within 10 seconds**:
   - AI score badge appears (e.g., "75%")
   - Reasoning text shows below: "Person visible, speaking to camera with good engagement"
   - Timestamp updates every 3 seconds
   - YOLO detections show green box around you with "person 84%"

### Test 2: Cameras (After Enabling RTSP)

**Goal**: Verify all 6 cameras load with video
**Expected**: All cameras show live video, not black screens

1. Navigate to: `http://localhost:3001/rooms/geome-hackathon`
2. Join room
3. Wait 2-3 seconds for auto-connect
4. **Expected**: 6 camera tiles appear with names "Camera 1" through "Camera 6"
5. **Video should be visible**, not black
6. Click any camera → should see live RTSP feed
7. **AI scores should appear** within 3-10 seconds for each camera
8. Reasoning might say:
   - "Empty hallway, no people visible, low engagement" (score: ~0.1)
   - "Person walking through frame, moderate activity" (score: ~0.5)
   - "Multiple people in conference room, active discussion" (score: ~0.9)

### Test 3: AI Reasoning Visibility

**Goal**: Verify AI explanations are visible in UI
**Location**: YOLOView Combined mode

1. Join room with your webcam
2. Hamburger menu → **View** tab
3. Ensure **Combined View** is selected (white background button)
4. Wait for AI score to appear
5. **Check the info panel at bottom of your video tile**:
   ```
   YourName
   1 person(s)
   AI Score: 75%
   Person visible with clear engagement and good lighting  ← REASONING
   Updated 8:53:42 PM
   ```

**If you DON'T see reasoning**:
- Check browser console for WebSocket errors
- Verify analysis worker logs show scores being published
- Check API Gateway logs show scores being broadcast

---

## Diagnostic Commands

### Check All Services
```bash
docker ps
```
Expected: All 5 containers running (go2rtc, livekit, redis, api-gateway, analysis-worker)

### Monitor AI Worker Real-Time
```bash
docker logs -f cloud-obs-analysis-worker
```
Look for:
- `✅ Connected to room: geome-hackathon`
- `🎥 Subscribed to video track`
- `📹 Received frame #N`
- `Analysis complete: score=0.XX`
- `📊 Published score`

### Monitor go2rtc Camera Streams
```bash
docker logs -f cloud-obs-go2rtc
```
Look for:
- `[streams] start producer url=rtsp://...`
- Should NOT stop after 30 seconds (indicates RTSP enabled)

### Test Camera RTSP Directly
```bash
# Test if RTSP is enabled and streaming
vlc "rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_sub"
```

### Check OpenAI API Key
```bash
docker exec cloud-obs-analysis-worker python3 -c "import os; print('API Key:', 'CONFIGURED' if os.getenv('OPENAI_API_KEY') else 'MISSING')"
```

### Test WebSocket Connection
```bash
# In browser console:
const ws = new WebSocket('ws://localhost:3000/ws');
ws.onmessage = (e) => console.log('Received:', JSON.parse(e.data));
```

---

## Expected Behavior After Fixes

### Scenario: Everything Working Correctly

**When you join the room**:
1. ✅ Your webcam appears immediately
2. ✅ 6 cameras auto-load within 2-3 seconds (names: "Camera 1" - "Camera 6")
3. ✅ All cameras show live video (not black)
4. ✅ YOLO detections appear (green boxes around people/objects)
5. ✅ AI scores appear within 3-10 seconds
6. ✅ AI reasoning text visible below each video
7. ✅ Rankings update in real-time as scores change
8. ✅ Top video in Combined view has detailed reasoning

**Example Combined View**:
```
Top Ranked:
━━━━━━━━━━━━━━━━━━━━━━━━
│  🎥 Camera 3           │
│  [Live video feed]     │
│                        │
│  🥇 Rank 1             │
│  AI Score: 92%         │
│  Reasoning: "Conference│
│  room with 5 people    │
│  actively engaged in   │
│  presentation. Dynamic │
│  movement and clear    │
│  speaker visible."     │
│                        │
│  2 person(s) detected  │
│  Updated: 8:54:12 PM   │
━━━━━━━━━━━━━━━━━━━━━━━━
```

### Scenario: Cameras Still Black (RTSP Not Enabled)

**What you'll see**:
- Camera tiles appear with names
- Video area is black/empty
- AI analysis STILL WORKS:
  - Score: ~0.01-0.05
  - Reasoning: "Black screen, no visible content"
  - Ranked last (6th place)

This is CORRECT behavior - the VLM analyzes black frames and scores them appropriately.

---

## Troubleshooting

### Problem: AI Ranking Still Shows "0 ranked"

**Checklist**:
1. ✅ Are you in room "geome-hackathon"? Check URL
2. ✅ Is analysis-worker running? `docker ps | grep analysis`
3. ✅ Check worker logs: `docker logs cloud-obs-analysis-worker`
   - Should see: "Subscribed to video track"
4. ✅ Is OpenAI API key valid? Check worker logs for API errors
5. ✅ Is WebSocket connected? Check browser console
6. ✅ Is your camera actually publishing? Check LiveKit logs

### Problem: Cameras Load but Show Black

**Solution**: Enable RTSP on each camera (see Fix #2 above)

**Verify RTSP is enabled**:
```bash
# Test direct RTSP access
vlc "rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_sub"
```

If VLC shows video → RTSP works → Issue is with go2rtc or WebRTC
If VLC shows error → RTSP disabled → Enable in camera settings

### Problem: YOLO Errors Persist

**Check model file exists**:
```bash
ls -lh frontend/public/models/yolo11n_256.onnx
```

**Expected output**:
```
-rw-r--r-- 1 user staff 6.2M Oct 26 19:30 yolo11n_256.onnx
```

**If missing**: Download/generate model (see Fix #3)

### Problem: AI Reasoning Not Visible in UI

**Verify scores are being received**:
1. Open browser console (F12)
2. Check for WebSocket messages:
   ```
   AI WebSocket connected
   ```
3. Look for score objects in console

**Check YOLOView component**:
- Must be in **Combined View** mode
- AI score must exist for that participant
- Reasoning appears in the info panel at bottom

---

## Performance Expectations

### AI Analysis
- **First score**: 3-10 seconds after joining
- **Update frequency**: Every 3 seconds
- **API cost**: ~$0.60/hour per video stream
- **Latency**: 2-5 seconds per analysis

### YOLO Detection
- **FPS**: 10-30 FPS (depends on CPU)
- **Inference time**: 40-60ms (256x256 model)
- **Accuracy**: Good for people, vehicles, animals
- **Browser memory**: 300-500 MB total

### Camera Streams
- **Auto-load delay**: 2 seconds after room join
- **Delay between cameras**: 500ms each
- **Total time for 6 cameras**: ~5 seconds
- **Video quality**: 720p (sub-stream)
- **Bandwidth**: ~6 Mbps total (1 Mbps per camera)

---

## Files Reference

### Configuration Files
- `.env` - Room name, API keys, LiveKit URL
- `go2rtc.yaml` - Camera RTSP URLs and credentials
- `docker-compose.yml` - Service definitions
- `livekit.yaml` - LiveKit server config

### Frontend Key Files
- `PageClientImpl.tsx` - Main app, WebSocket connection
- `YOLOView.tsx` - Object detection + AI ranking combined view
- `RankedView.tsx` - AI-only ranking view
- `CameraAutoConnect.tsx` - Auto-loads cameras from go2rtc
- `AIScoreOverlay.tsx` - Score badge component

### Backend Key Files
- `services/analysis-worker/worker.py` - AI video analysis
- `services/api-gateway/src/server.ts` - WebSocket server, token generation

---

## Summary of What Works vs. Broken

### ✅ Currently Working
1. Docker services (all 5 running)
2. go2rtc service (RTSP→WebRTC gateway)
3. LiveKit server (WebRTC)
4. OpenAI API key (valid, 164 chars)
5. Frontend WebSocket connection
6. Your webcam video feed
7. YOLO object detection (detected you at 84%)
8. Camera naming ("Camera 1", "Camera 2", etc.)
9. Camera auto-loading logic
10. AI reasoning display code (just needs scores)

### ❌ Currently Broken
1. **AI ranking** - Worker sees 0 participants (room mismatch?)
2. **Camera video feeds** - Black screens (RTSP not enabled)
3. **Cameras 4-6** - Password issue may persist
4. **YOLO initialization** - Model file may be missing

### 🔧 Requires Action
1. **Join correct room**: `http://localhost:3001/rooms/geome-hackathon`
2. **Enable RTSP on all 6 cameras** (via camera web interface)
3. **Verify YOLO model file exists** (`frontend/public/models/yolo11n_256.onnx`)

---

## Next Steps

**Priority 1 - Test AI Ranking** (5 minutes):
1. Navigate to `http://localhost:3001/rooms/geome-hackathon`
2. Join with your webcam
3. Go to View → Combined
4. Wait 10 seconds
5. **Report back**: Do you see AI score and reasoning?

**Priority 2 - Enable RTSP** (30 minutes):
1. Access each camera web interface
2. Enable RTSP in settings
3. Restart go2rtc
4. Test cameras load with video

**Priority 3 - Verify YOLO** (2 minutes):
1. Check model file exists
2. Download if missing
3. Restart frontend

---

**Status**: Waiting for user testing and feedback
**Last Updated**: October 26, 2025
