# ✅ Camera Works! Next: Test Full AI System

## What's Working

✅ **Camera permissions** - Safari properly asks for camera/mic access
✅ **Video capture** - Getting 1280x720 @ 30fps
✅ **Audio capture** - Microphone working
✅ **HTTPS** - Secure connection established

## Next: Connect to LiveKit & AI System

The **camera test page** you just used (`/camera-test`) only tests camera permissions. It doesn't connect to LiveKit or the AI analysis system.

Now you need to test the **FULL camera app** which:
- Connects to LiveKit (WebRTC streaming)
- Sends video to AI analysis worker
- Gets ranked by OpenAI Vision API
- Participates in automatic camera switching

---

## Step 1: Open the Full Camera App

**In Safari, open this URL:**

```
https://10.237.213.101:3000/camera?id=cam-1
```

This is the **full camera app** with LiveKit integration.

### What You Should See:

1. Page loads with:
   - Large video preview area
   - Camera ID: **CAM-1** at the top
   - Green "Start Broadcasting" button
   - Status: "Initializing..."

2. **Click "Start Broadcasting"**

3. Safari asks for camera/mic permissions (you already allowed these)

4. After a few seconds, you should see:
   - ✅ Your video preview
   - Status: **"Streaming as CAM-1"** (green)
   - Button changes to red "Stop Broadcasting"

---

## Step 2: Check Logs (I'll do this)

While your camera is streaming, I'll check:

1. **LiveKit Server** - Is cam-1 connected to the "main" room?
2. **Analysis Worker** - Is it receiving and analyzing your video frames?
3. **Decision Service** - Is it ranking cam-1?
4. **Redis** - Are scores being published?

---

## Step 3: Connect Multiple Cameras

Once one camera works, we'll test with multiple cameras:

### Option A: Multiple Browser Tabs (Easy)

Open these URLs in separate Safari tabs:
- `https://10.237.213.101:3000/camera?id=cam-1`
- `https://10.237.213.101:3000/camera?id=cam-2`
- `https://10.237.213.101:3000/camera?id=cam-3`

All will use your Mac's camera, but with different IDs.

### Option B: Use Your Phone (Real Multi-Camera)

1. Go to: `https://10.237.213.101:3101/cameras`
2. You'll see QR codes for 5 cameras
3. Scan with your iPhone (after installing the certificate)
4. Each device becomes a separate camera

---

## Step 4: Test AI Camera Ranking

Once multiple cameras are connected, the AI system should:

1. **Analyze each camera** every 3 seconds (FRAME_SAMPLE_INTERVAL)
2. **Score each camera** based on:
   - Scene content (GPT-4 Vision analysis)
   - Object detection (if enabled)
   - Audio activity
   - Motion detection
3. **Rank cameras** by score
4. **Switch to highest-ranked camera** automatically

You can watch this happen in the **dashboard**: `https://10.237.213.101:3101`

---

## Step 5: Verify Dashboard Shows Everything

The main dashboard should show:
- All connected cameras (live thumbnails)
- Current "Program" output (the active camera)
- Camera scores in real-time
- Switching decisions
- AI narration (if enabled)

---

## What I'll Check

While you test the full camera app, I'll monitor:

```bash
# Check LiveKit connections
docker-compose logs -f livekit-server | grep "participant"

# Check AI analysis
docker-compose logs -f analysis-worker | grep "Analysis"

# Check camera rankings
docker-compose logs -f decision-service | grep "Score"

# Check Redis activity
docker exec ai-obs-redis-1 redis-cli MONITOR
```

---

## Current Status

🟢 **Camera Test**: ✅ Working perfectly
🟡 **LiveKit Connection**: Need to test
🟡 **AI Analysis**: Need to verify
🟡 **Multi-Camera**: Not tested yet
🟡 **Auto-Switching**: Not tested yet

---

## Action Items

### You:
1. Open `https://10.237.213.101:3000/camera?id=cam-1` in Safari
2. Click "Start Broadcasting"
3. Let me know what status you see

### Me:
1. Monitor logs for LiveKit connection
2. Check analysis worker is processing frames
3. Verify decision service is ranking
4. Confirm end-to-end pipeline works

---

## URLs Quick Reference

| Purpose | URL |
|---------|-----|
| **Full Camera App** (LiveKit) | `https://10.237.213.101:3000/camera?id=cam-1` |
| Camera Test (Permissions Only) | `https://10.237.213.101:3000/camera-test` |
| Main Dashboard | `https://10.237.213.101:3101` |
| Camera QR Codes | `https://10.237.213.101:3101/cameras` |

---

**Ready to test?** Open the full camera app URL and click "Start Broadcasting"! 🚀
