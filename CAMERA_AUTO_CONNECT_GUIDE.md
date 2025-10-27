# Camera Auto-Connect Integration Guide

## 🎉 What's Been Implemented

Your cloud-obs system now has **automatic camera connection** with visual status indicators! All 6 Reolink cameras will automatically connect when you log in and navigate to the Live view.

---

## 📋 System Overview

### Architecture Flow
```
Reolink Cameras (6x RLC-820A)
    ↓ RTSP (port 554)
go2rtc Container (localhost:1984)
    ↓ WebRTC via WebSocket
Frontend Browser (CameraAutoConnectEnhanced)
    ↓ Publish video tracks
LiveKit Room
    ↓ Subscribe & Display
Live View + AI Analysis + YOLO Detection
```

### Components Added/Enhanced

1. **CameraConnectionStatus.tsx** - Visual status indicator
   - Shows camera count (connected/total)
   - Expandable panel with per-camera status
   - Retry buttons for failed connections
   - Real-time status updates

2. **CameraAutoConnectEnhanced.tsx** - Enhanced auto-connect logic
   - Automatic reconnection (up to 3 attempts)
   - Connection timeout handling (30 seconds)
   - Status tracking per camera
   - Error reporting

3. **VideoConferenceClientImpl.tsx** - Updated to use enhanced version
   - Imports `CameraAutoConnectEnhanced`
   - Shows status indicator in top-right corner

---

## 🚀 How to Use

### 1. Start All Services

From the `cloud-obs-main` directory:

```bash
# Make sure Docker is running
open -a Docker

# Wait 10-15 seconds for Docker to start, then:
docker-compose up -d

# Verify all containers are running
docker ps
```

You should see:
- ✅ `cloud-obs-go2rtc` (ports 1984, 8554)
- ✅ `cloud-obs-livekit` (ports 7880, 7881)
- ✅ `cloud-obs-api-gateway` (port 3000)
- ✅ `cloud-obs-analysis-worker`
- ✅ `cloud-obs-redis` (port 6380)

### 2. Start Frontend

```bash
cd frontend
PORT=3001 pnpm dev
```

The frontend will run on **http://localhost:3001** (to avoid conflict with API gateway on 3000).

### 3. Access the Application

1. Open your browser to: **http://localhost:3001**
2. You'll be prompted to join a room
3. Enter any room name (or use the default)
4. Click "Join Room"

### 4. Navigate to Live View

Once in the room:
1. Look for the **hamburger menu** (☰) on the left side
2. Click the **"Live"** tab
3. **Cameras will auto-connect within 2-5 seconds**

---

## 📊 Status Indicator

In the top-right corner, you'll see:

```
📹 Cameras: 3/6    [2 connecting]
```

Click to expand and see detailed status:

```
✓ Camera 1    10.39.12.110
✓ Camera 2    10.39.12.107
✓ Camera 3    10.39.12.104
⋯ Camera 4    10.39.12.106    Connecting...
✗ Camera 5    10.39.12.109    [Retry]
○ Camera 6    10.39.12.108
```

### Status Icons:
- **✓** (Green) - Connected
- **⋯** (Yellow) - Connecting/Retrying
- **✗** (Red) - Error (with retry button)
- **○** (Gray) - Disconnected

---

## 🔧 Camera Configuration

All 6 cameras are pre-configured:

| Camera ID | Name | IP Address | Stream Name |
|-----------|------|------------|-------------|
| camera_1 | Camera 1 | 10.39.12.110 | camera_1 |
| camera_2 | Camera 2 | 10.39.12.107 | camera_2 |
| camera_3 | Camera 3 | 10.39.12.104 | camera_3 |
| camera_4 | Camera 4 | 10.39.12.106 | camera_4 |
| camera_5 | Camera 5 | 10.39.12.109 | camera_5 |
| camera_6 | Camera 6 | 10.39.12.108 | camera_6 |

**RTSP URLs** (configured in `go2rtc.yaml`):
- Sub-stream (720p): `rtsp://admin:password@IP:554/h264Preview_01_sub`
- Main stream (4K): `rtsp://admin:password@IP:554/h264Preview_01_main`

---

## 🔍 How Auto-Connect Works

### Connection Sequence (per camera):

1. **Initiation** (2 seconds after room connection)
   - Component waits for LiveKit room to be ready
   - Begins connecting cameras with 500ms delay between each

2. **WebRTC Handshake**
   - Creates RTCPeerConnection to go2rtc
   - Opens WebSocket: `ws://localhost:1984/api/ws?src=camera_X`
   - Sends SDP offer
   - Receives SDP answer
   - Exchanges ICE candidates

3. **Track Reception**
   - Receives video track from go2rtc
   - Publishes track to LiveKit room
   - Marks camera as connected

4. **Timeout & Retry**
   - 30-second connection timeout per attempt
   - Up to 3 automatic retry attempts
   - 5-second delay between retries
   - After 3 failures, shows error with manual retry button

---

## 🎨 Integration with Existing Features

### Live View
- All connected cameras appear as participants
- Video tiles display in grid layout
- Rank badges overlay on each video (when AI scores available)

### Ranked View
- Cameras ranked by AI engagement scores
- Top camera featured prominently
- Score explanations displayed

### YOLO View
- Real-time object detection on all camera feeds
- Bounding boxes with confidence scores
- Detection statistics (persons, vehicles, etc.)

### AI Analysis Worker
- Automatically analyzes frames from all cameras every 3 seconds
- Sends engagement scores via Redis pub/sub
- Scores displayed on video tiles

---

## 🐛 Troubleshooting

### Issue: Cameras not connecting

**Check 1: Verify RTSP ports are open**
```bash
for ip in 10.39.12.110 10.39.12.107 10.39.12.104 10.39.12.106 10.39.12.109 10.39.12.108; do
  nc -zv $ip 554
done
```

**Check 2: Verify go2rtc is running**
```bash
curl http://localhost:1984/api/streams | python3 -m json.tool
```

**Check 3: Check go2rtc logs**
```bash
docker logs cloud-obs-go2rtc --tail 50
```

**Check 4: Browser console**
- Open browser DevTools (F12)
- Look for WebSocket connection messages
- Check for errors in console

### Issue: Status indicator not showing

**Solution:** Make sure `showStatus={true}` in VideoConferenceClientImpl.tsx line 245

### Issue: Cameras connect but no video

**Possible causes:**
1. RTSP stream not available from camera
2. go2rtc can't reach camera (firewall/network)
3. LiveKit track publish failed

**Debug:**
```bash
# Test direct RTSP stream with VLC:
vlc "rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_sub"
```

### Issue: Connection timeout errors

**Causes:**
- Network latency
- Camera offline
- RTSP not enabled on camera

**Solution:** Click the **Retry** button in the status indicator

---

## 📝 Configuration Files

### Camera Configuration
Location: `frontend/lib/CameraAutoConnectEnhanced.tsx` lines 17-24

```typescript
const CAMERAS = [
  { id: 'camera_1', name: 'Camera 1', ip: '10.39.12.110', streamName: 'camera_1' },
  // ... add more cameras here
];
```

### go2rtc Streams
Location: `go2rtc.yaml`

```yaml
streams:
  camera_1:
    - rtsp://admin:Password03%21@10.39.12.110:554/h264Preview_01_sub#timeout=30
```

### Retry Configuration
Location: `frontend/lib/CameraAutoConnectEnhanced.tsx` lines 26-27

```typescript
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000; // 5 seconds
```

---

## 🎯 Key Features

### ✅ Implemented
- ✓ Automatic connection on login
- ✓ Visual status indicator with real-time updates
- ✓ Automatic reconnection (up to 3 attempts)
- ✓ Manual retry buttons for failed cameras
- ✓ Connection timeout handling
- ✓ Error reporting
- ✓ Integration with Live/Ranked/YOLO views
- ✓ AI analysis on all camera streams
- ✓ YOLO object detection

### 🚀 Future Enhancements
- Stream quality switching (SD ↔ HD)
- Per-camera settings (mute, quality, etc.)
- Recording controls
- Camera grouping/favorites
- Connection health monitoring
- Bandwidth optimization

---

## 📚 File Locations Reference

| File | Purpose |
|------|---------|
| `frontend/lib/CameraAutoConnectEnhanced.tsx` | Main auto-connect logic |
| `frontend/lib/CameraConnectionStatus.tsx` | Status indicator component |
| `frontend/styles/CameraConnectionStatus.module.css` | Status indicator styles |
| `frontend/app/custom/VideoConferenceClientImpl.tsx` | Root component integration |
| `frontend/lib/LiveVideoConference.tsx` | Live view with participants |
| `go2rtc.yaml` | Camera RTSP to WebRTC configuration |
| `docker-compose.yml` | Service orchestration |

---

## 🔐 Security Notes

1. **Passwords in go2rtc.yaml are URL-encoded**
   - `!` → `%21`
   - `&` → `%26`

2. **Rotate default passwords**
   - Change camera admin passwords from defaults
   - Update go2rtc.yaml after changing

3. **Network security**
   - Cameras on 10.39.12.0/24 subnet
   - Consider VLAN isolation for cameras
   - Firewall rules to restrict access

---

## 📞 Support

For issues or questions:
1. Check browser console (F12)
2. Check Docker logs: `docker logs cloud-obs-go2rtc`
3. Verify network connectivity to cameras
4. Review this guide's troubleshooting section

---

**Status:** ✅ **FULLY IMPLEMENTED AND READY TO USE**

**Last Updated:** October 27, 2025
**Version:** 1.0
