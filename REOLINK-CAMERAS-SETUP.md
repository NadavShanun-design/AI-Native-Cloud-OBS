# Reolink IP Camera Integration Setup

## ✅ What's Been Implemented

Your 6 Reolink RLC-820A cameras have been integrated with the following features:

1. **Auto-Connect**: All 6 cameras automatically connect when you join the room
2. **Manual Connect**: Click "Add Stream" in sidebar to manually add/remove cameras
3. **Real-Time AI Analysis**: All camera feeds are automatically analyzed by the AI worker
4. **Live Streaming**: Low-latency WebRTC streams via go2rtc proxy

---

## 🚀 Quick Start

### 1. Start Docker Services

```bash
cd /Users/nadavshanun/Downloads/cloud-obs-main

# Start all services including the new go2rtc service
docker-compose up -d
```

This will start:
- Redis
- LiveKit Server
- API Gateway
- Analysis Worker (AI)
- **go2rtc** (NEW - RTSP to WebRTC proxy)

### 2. Verify go2rtc is Running

Check go2rtc web interface:
```bash
open http://localhost:1984
```

You should see all 6 cameras listed:
- camera_1 (10.39.12.110)
- camera_2 (10.39.12.107)
- camera_3 (10.39.12.104)
- camera_4 (10.39.12.106)
- camera_5 (10.39.12.109)
- camera_6 (10.39.12.108)

### 3. Start Frontend

```bash
cd frontend
npm install  # First time only
npm run dev
```

Frontend will be available at: http://localhost:3001

### 4. Test Camera Streams

1. Open http://localhost:3001
2. Log in (password: `goodvibesonly`)
3. Wait 2-3 seconds after joining
4. **All 6 cameras will automatically connect!**
5. They will appear as video tiles with names like "Camera 1 (10.39.12.110)"

---

## 📹 How It Works

```
Reolink Cameras (RTSP)
    ↓
go2rtc (RTSP → WebRTC)
    ↓
Browser (WebRTC)
    ↓
LiveKit Room
    ↓
AI Analysis Worker
    ↓
Real-time scoring
```

---

## 🎛️ Manual Camera Control

### To Manually Add a Camera:

1. Click "Add Stream" in the sidebar
2. Click "IP Cameras" tab
3. Select the camera you want to add
4. Camera will instantly appear in the room

### Your Cameras:

| Name | IP Address | Credentials |
|------|------------|-------------|
| Camera 1 | 10.39.12.110 | admin:Password03! |
| Camera 2 | 10.39.12.107 | admin:Password03! |
| Camera 3 | 10.39.12.104 | admin:Password03! |
| Camera 4 | 10.39.12.106 | admin:zSQ6e9MB&03! |
| Camera 5 | 10.39.12.109 | admin:zSQ6e9MB&03! |
| Camera 6 | 10.39.12.108 | admin:zSQ6e9MB&03! |

---

## 🔧 Configuration Files

### go2rtc.yaml
Contains all camera RTSP URLs and configuration
- Located at: `/Users/nadavshanun/Downloads/cloud-obs-main/go2rtc.yaml`
- Configured with sub-streams (lower quality) for better performance
- HD streams also available: `camera_1_hd`, `camera_2_hd`, etc.

### docker-compose.yml
Added go2rtc service:
- Port 1984: Web UI and API
- Port 8554: RTSP server
- Automatically starts with other services

---

## 🛠️ Troubleshooting

### Problem: Cameras Not Connecting

**Solution 1**: Check if go2rtc can reach cameras
```bash
# Open go2rtc web UI
open http://localhost:1984

# Click on each camera name - you should see live video
```

**Solution 2**: Test RTSP directly
```bash
# Install VLC if you don't have it
# Test camera 1:
vlc rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_sub
```

**Solution 3**: Check cameras are on same network
```bash
# Ping camera
ping 10.39.12.110

# Should respond with times like "time=2ms"
```

### Problem: go2rtc Not Starting

```bash
# Check logs
docker logs cloud-obs-go2rtc

# Restart the service
docker-compose restart go2rtc
```

### Problem: Cameras Showing But No Video

**Check browser console** (F12 → Console tab):
- Look for WebRTC errors
- Look for "Camera X connected" messages

**Try hard refresh**: Cmd+Shift+R (Mac) or Ctrl+Shift+F5 (Windows)

---

## ⚙️ Advanced Configuration

### Change Camera Quality

Edit `go2rtc.yaml`:

**For Lower Bandwidth** (current default):
```yaml
camera_1:
  - rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_sub
```

**For HD Quality**:
```yaml
camera_1:
  - rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_main
```

Then restart: `docker-compose restart go2rtc`

### Disable Auto-Connect

Edit `frontend/app/custom/VideoConferenceClientImpl.tsx`:

Change line 242:
```tsx
<CameraAutoConnect room={isConnected ? room : null} enabled={false} />
```

### Add More Cameras

1. Edit `go2rtc.yaml` - add new camera:
```yaml
camera_7:
  - rtsp://admin:password@10.39.12.XXX:554/h264Preview_01_sub
```

2. Edit `frontend/lib/ExternalStreamModal.tsx` - add to CAMERAS array:
```tsx
{ id: 'camera_7', name: 'Camera 7', ip: '10.39.12.XXX', streamName: 'camera_7' },
```

3. Edit `frontend/lib/CameraAutoConnect.tsx` - add to CAMERAS array (same as above)

4. Restart services:
```bash
docker-compose restart go2rtc
# Restart frontend (Ctrl+C then npm run dev)
```

---

## 📊 Monitoring

### View Camera Streams Directly
- go2rtc Web UI: http://localhost:1984
- Click any camera name to see live feed

### Check AI Scores
- Open "View" tab in sidebar
- All cameras ranked in real-time
- Scores update every 3 seconds

### Docker Logs
```bash
# All services
docker-compose logs -f

# Just go2rtc
docker logs -f cloud-obs-go2rtc

# Just AI worker
docker logs -f cloud-obs-analysis-worker
```

---

## 🎯 Expected Behavior

1. **On Page Load**:
   - User joins LiveKit room
   - After 2 seconds, auto-connect starts
   - Each camera connects with 500ms delay between them
   - Total connection time: ~5-7 seconds for all 6 cameras

2. **Video Tiles**:
   - Each camera appears as separate participant
   - Named like "Camera 1 (10.39.12.110)"
   - AI scores shown as badges on tiles

3. **AI Analysis**:
   - Worker automatically detects camera tracks
   - Analyzes frames every 3 seconds
   - Scores broadcast via WebSocket
   - Rankings update in real-time

---

## 💰 Cost Considerations

**Current Settings**:
- 6 cameras × $0.60/hour = **$3.60/hour**
- Sub-streams (720p) for bandwidth efficiency
- 3-second AI analysis interval

**To Reduce Costs**:
Edit `.env`:
```bash
FRAME_SAMPLE_INTERVAL=5.0  # Was 3.0
# Now: $2.16/hour for all 6 cameras
```

---

## 🔐 Security Notes

- Cameras use RTSP with authentication
- go2rtc runs in isolated Docker network
- WebRTC streams encrypted in transit
- No camera credentials stored in browser
- All communication over local network

---

## ✅ Testing Checklist

- [ ] Docker services running (`docker-compose ps`)
- [ ] go2rtc accessible (http://localhost:1984)
- [ ] Frontend running (http://localhost:3001)
- [ ] Can see camera streams in go2rtc UI
- [ ] Cameras auto-connect after joining room
- [ ] AI scores appearing on camera tiles
- [ ] Can manually add cameras via "Add Stream"
- [ ] Rankings shown in "View" tab

---

## 📞 Support

If cameras aren't working:

1. **Check network**: All cameras on 10.39.12.0/24 subnet
2. **Check RTSP port**: Port 554 must be open on cameras
3. **Check passwords**: Ensure credentials match camera settings
4. **Check go2rtc logs**: `docker logs cloud-obs-go2rtc`
5. **Test with VLC**: Verify RTSP URLs work outside the app

---

## 🎉 You're All Set!

Run these commands to start everything:

```bash
# Terminal 1 - Docker services
docker-compose up -d

# Terminal 2 - Frontend
cd frontend && npm run dev
```

Then open: http://localhost:3001

Your 6 Reolink cameras will automatically connect and start streaming! 🎥
