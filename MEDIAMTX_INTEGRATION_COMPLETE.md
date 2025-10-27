# MediaMTX Integration Complete

## Overview

Your codebase has been successfully upgraded to use **MediaMTX** for camera streaming instead of the previous go2rtc-only approach. MediaMTX provides superior features including:

- ✅ **Standard WHEP protocol** for WebRTC (cleaner, more reliable)
- ✅ **Multiple output protocols**: WebRTC + HLS + RTSP + RTMP simultaneously
- ✅ **On-demand streaming**: Only connects to cameras when someone is watching
- ✅ **Built-in recording** capabilities (ready to enable)
- ✅ **Better browser compatibility** with HLS fallback
- ✅ **Live iframe embedding** support

---

## What Changed

### 1. New Configuration File: `mediamtx.yml`
Location: `/Users/nadavshanun/Downloads/cloud-obs-main/mediamtx.yml`

All 6 Reolink cameras are configured with both standard and HD streams:
- `camera_1` through `camera_6` (720p sub-stream)
- `camera_1_hd` through `camera_6_hd` (4K main stream)

### 2. Updated Docker Compose
Location: `/Users/nadavshanun/Downloads/cloud-obs-main/docker-compose.yml`

New `mediamtx` service added with exposed ports:
- **8889** - WebRTC server (WHEP protocol)
- **8888** - HLS server (HTTP Live Streaming)
- **9997** - API server
- **8189/udp** - WebRTC UDP traffic
- **8555** - RTSP server (different from go2rtc's 8554)
- **1935** - RTMP server
- **8890** - SRT server

### 3. New MediaMTX WebRTC Library
Location: `/Users/nadavshanun/Downloads/cloud-obs-main/frontend/lib/MediaMTXWebRTCReader.ts`

TypeScript library implementing the WHEP protocol for connecting to MediaMTX streams.

### 4. Updated Camera Connection Code
Location: `/Users/nadavshanun/Downloads/cloud-obs-main/frontend/lib/CameraAutoConnectEnhanced.tsx`

Changed from:
```typescript
// OLD: go2rtc WebSocket API
const go2rtcUrl = `ws://localhost:1984/api/ws?src=${camera.streamName}`;
// Custom WebRTC negotiation over WebSocket
```

To:
```typescript
// NEW: MediaMTX WHEP protocol
const mediaMTXUrl = `http://localhost:8889/${camera.streamName}/whep`;
const reader = new MediaMTXWebRTCReader({ url: mediaMTXUrl, ... });
```

---

## How to Start

### Step 1: Start Docker Services

```bash
cd /Users/nadavshanun/Downloads/cloud-obs-main

# Start all services including MediaMTX
docker-compose up -d

# Verify MediaMTX is running
docker ps | grep mediamtx
```

### Step 2: Verify MediaMTX is Running

Check the logs:
```bash
docker logs cloud-obs-mediamtx
```

You should see:
```
[mediamtx] INF MediaMTX v1.x.x
[mediamtx] INF [RTSP] listener opened on :8554
[mediamtx] INF [WebRTC] listener opened on :8889
[mediamtx] INF [HLS] listener opened on :8888
[mediamtx] INF [API] listener opened on :9997
```

### Step 3: Test Camera Connection

Open a browser and navigate to MediaMTX's built-in viewer:
```
http://localhost:8889/camera_1
```

You should see the camera stream directly in the browser! Repeat for `camera_2`, `camera_3`, etc.

### Step 4: Start the Frontend

```bash
cd frontend
pnpm install  # if needed
PORT=3001 pnpm dev
```

### Step 5: Open the App

Navigate to: `http://localhost:3001`

The Live section will automatically:
1. Connect to all 6 cameras via MediaMTX (WHEP protocol)
2. Publish the camera streams to LiveKit
3. Display them in the Live video conference view

---

## Camera Configuration

### Your 6 Reolink Cameras

| Camera | IP Address | Stream Name | MediaMTX URL |
|--------|-----------|-------------|--------------|
| Camera 1 | 10.39.12.110 | `camera_1` | http://localhost:8889/camera_1 |
| Camera 2 | 10.39.12.107 | `camera_2` | http://localhost:8889/camera_2 |
| Camera 3 | 10.39.12.104 | `camera_3` | http://localhost:8889/camera_3 |
| Camera 4 | 10.39.12.106 | `camera_4` | http://localhost:8889/camera_4 |
| Camera 5 | 10.39.12.109 | `camera_5` | http://localhost:8889/camera_5 |
| Camera 6 | 10.39.12.108 | `camera_6` | http://localhost:8889/camera_6 |

### HD Streams

For higher quality, use the `_hd` suffix:
```
http://localhost:8889/camera_1_hd
http://localhost:8889/camera_2_hd
...
```

---

## Testing Checklist

- [ ] MediaMTX container is running (`docker ps`)
- [ ] MediaMTX logs show listeners opened (`docker logs cloud-obs-mediamtx`)
- [ ] Camera 1 stream works in browser: http://localhost:8889/camera_1
- [ ] Camera 2 stream works in browser: http://localhost:8889/camera_2
- [ ] Frontend connects without errors
- [ ] Live section shows all camera streams
- [ ] Camera status indicator shows "connected" for all cameras

---

## Accessing Different Protocols

MediaMTX streams are available in multiple formats:

### 1. WebRTC (Browser - Best for Low Latency)
```
http://localhost:8889/camera_1
```

### 2. HLS (Browser - Best for Compatibility)
```html
<video controls>
  <source src="http://localhost:8888/camera_1/index.m3u8" type="application/x-mpegURL">
</video>
```

### 3. RTSP (VLC/ffmpeg)
```bash
ffplay rtsp://localhost:8555/camera_1
# or
vlc rtsp://localhost:8555/camera_1
```

### 4. RTMP (OBS Studio)
```
rtmp://localhost:1935/camera_1
```

### 5. Iframe Embed
```html
<iframe src="http://localhost:8889/camera_1" width="800" height="600"></iframe>
```

---

## API Usage

MediaMTX provides a REST API on port 9997:

### List All Paths
```bash
curl http://localhost:9997/v3/paths/list
```

### Get Path Info
```bash
curl http://localhost:9997/v3/paths/get/camera_1
```

### Get Config
```bash
curl http://localhost:9997/v3/config/global/get
```

---

## Troubleshooting

### Camera Stream Not Available

**Problem**: Browser shows "stream not found"

**Solution**: MediaMTX uses on-demand streaming. The camera only connects when someone requests the stream. Wait 5-10 seconds after opening the URL.

**Check RTSP is enabled on cameras**:
1. Open camera web interface: `http://10.39.12.110`
2. Login: `admin` / `Password03!` (or `zSQ6e9MB&03!`)
3. Go to: Settings → Network → Advanced → Port
4. Ensure **RTSP** is **enabled**
5. Verify RTSP port is **554**

### MediaMTX Container Not Starting

```bash
# Check logs
docker logs cloud-obs-mediamtx

# Restart container
docker restart cloud-obs-mediamtx

# Check port conflicts
lsof -i :8889
lsof -i :8888
```

### Camera Can't Be Reached

Test camera connectivity:
```bash
# Ping camera
ping 10.39.12.110

# Test RTSP port
nc -zv 10.39.12.110 554

# Test with ffprobe
ffprobe rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_sub
```

### Frontend Can't Connect to MediaMTX

**Check CORS**: MediaMTX allows all origins by default (`hlsAllowOrigin: '*'` and `webrtcAllowOrigin: '*'`)

**Check URL**: Ensure frontend uses `http://localhost:8889` not `http://localhost:8889/whep` (the `/whep` is added by the library)

**Check browser console**: Look for WHEP-related errors

---

## Advanced Features

### Enable Recording

Edit `mediamtx.yml`:
```yaml
paths:
  camera_1:
    source: rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_sub
    record: yes
    recordPath: ./recordings/%path/%Y-%m-%d_%H-%M-%S-%f
    recordFormat: fmp4
    recordSegmentDuration: 1h
    recordDeleteAfter: 7d  # Keep 7 days
```

Restart MediaMTX:
```bash
docker restart cloud-obs-mediamtx
```

Recordings will be saved to: `./recordings/camera_1/`

### Change Stream Quality

To use HD streams in the frontend, edit `CameraAutoConnectEnhanced.tsx`:
```typescript
const CAMERAS = [
  { id: 'camera_1', name: 'Camera 1 HD', ip: '10.39.12.110', streamName: 'camera_1_hd' },
  // ...
];
```

### Add External Cameras

Edit `mediamtx.yml`:
```yaml
paths:
  my_new_camera:
    source: rtsp://user:pass@camera-ip:554/stream
    sourceOnDemand: yes
```

Then add to frontend camera list in `CameraAutoConnectEnhanced.tsx`.

---

## Architecture Comparison

### Before (go2rtc only)
```
Cameras (RTSP) → go2rtc → WebSocket API → Custom WebRTC → Frontend → LiveKit
```

### After (MediaMTX integration)
```
Cameras (RTSP) → MediaMTX → WHEP (standard WebRTC) → Frontend → LiveKit
                      ↓
                   HLS fallback
                   RTSP re-stream
                   RTMP re-stream
                   Recording
```

---

## Performance Notes

- **On-Demand Streaming**: Cameras only connect when viewed, saving bandwidth
- **Low Latency**: WebRTC via WHEP provides <1 second latency
- **HLS Fallback**: If WebRTC fails, can fall back to HLS (~3-5 second latency)
- **Multiple Viewers**: MediaMTX handles multiple viewers efficiently
- **Resource Usage**: Minimal CPU usage when cameras not in use

---

## Next Steps

1. **Test all cameras** using the browser URLs
2. **Verify frontend integration** in the Live section
3. **Enable recording** if needed for your use case
4. **Consider removing go2rtc** if MediaMTX works perfectly (keep for now as fallback)
5. **Monitor performance** with 6 cameras streaming simultaneously

---

## Support & Documentation

- **MediaMTX GitHub**: https://github.com/bluenviron/mediamtx
- **MediaMTX Docs**: See `mediamtx-main/docs/` folder
- **WHEP Protocol**: https://www.ietf.org/archive/id/draft-murillo-whep-00.html

---

**Integration Status**: ✅ COMPLETE

All camera streaming infrastructure is ready. Start the services and test!
