# 🚀 QUICK TEST GUIDE - DO THIS NOW

## Critical Fix Applied: SINGLE Slash URLs

**Changed:** `//h264Preview_01_sub` → `/h264Preview_01_sub`
**Source:** Verified RLC-820A user configs from Frigate community

---

## Test Steps (Do in this exact order)

### Step 1: Hard Refresh Browser
```
Mac: Cmd + Shift + R
Windows: Ctrl + Shift + R
```
This forces new camera connections with corrected URLs.

---

### Step 2: Open Browser Console
Press **F12** or **Cmd+Option+I**

**Watch for these emoji logs:**

#### ✅ SUCCESS Pattern:
```
🎥 [Camera 1] Received track event...
📹 [Camera 1] Video Track Details: { width: 896, height: 512 }
✓ [Camera 1] Track dimensions: 896x512
📤 [Camera 1] Publishing track to LiveKit...
✅ [Camera 1] Successfully published to LiveKit
```

#### ⚠️ PROBLEM Pattern:
```
⚠️ [Camera 1] Track has no dimensions! Settings: {}
```

#### ❌ ERROR Pattern:
```
❌ [Camera 1] WebSocket error: streams: wrong user/pass
❌ [Camera 1] Connection timeout
```

---

### Step 3: Check go2rtc Logs
**In Terminal:**
```bash
docker logs cloud-obs-go2rtc --tail 30 | grep -E "camera_|producer"
```

**SHOULD SEE (Good):**
```
[streams] start producer url=rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_sub
```

**Should NOT see (Bad):**
```
[streams] stop producer        ← Cameras disconnecting
[webrtc] error="wrong user/pass"  ← Auth failure
#video=copy#audio=copy         ← Old config still loaded
```

---

### Step 4: Check Camera Status Indicator
**Location:** Top-right corner of browser window
**Shows:** "📹 Cameras: X/6"

**Click to expand** - should show:
```
✓ Camera 1 (10.39.12.110) - Connected
✓ Camera 2 (10.39.12.107) - Connected
✓ Camera 3 (10.39.12.104) - Connected
✗ Camera 4 (10.39.12.106) - Error: Connection timeout (if RTSP not enabled)
✗ Camera 5 (10.39.12.109) - Error: Connection timeout
✗ Camera 6 (10.39.12.108) - Error: Connection timeout
```

---

## Expected Results

### Cameras 1, 2, 3 (Password: Password03!)
**Should:** Connect successfully and show video
**If not:** Check console logs and share them

### Cameras 4, 5, 6 (Password: zSQ6e9MB&03!)
**Might fail if:** RTSP not enabled on these cameras
**To fix:**
1. Open browser: `http://10.39.12.106` (camera 4)
2. Login with admin credentials
3. Go to: **Network Settings → Advanced → Ports**
4. **Enable RTSP** (port 554)
5. Click **Save**
6. Repeat for cameras 5 (10.39.12.109) and 6 (10.39.12.108)
7. Refresh browser again

---

## Quick Diagnostic Commands

### Test Camera Connectivity
```bash
# Test if RTSP port is open
nc -zv 10.39.12.110 554

# Expected: Connection successful
# If fails: RTSP not enabled or firewall blocking
```

### Test RTSP Stream Directly
```bash
# If you have VLC player:
# File → Open Network Stream
# Enter: rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_sub
```

### Monitor Real-Time go2rtc Logs
```bash
# Keep this running in a terminal window
docker logs -f cloud-obs-go2rtc | grep -E "camera_|error|producer|consumer"
```

---

## What to Report Back

### If SUCCESS:
✅ "All X cameras connected and showing video!"
- Include screenshot of Live view with cameras
- Share browser console log snippet

### If PARTIAL SUCCESS:
⚠️ "Cameras 1,2,3 work but 4,5,6 fail"
- Share browser console errors for failed cameras
- Share go2rtc logs showing errors

### If FAILURE:
❌ "No cameras connect" or "Black screens"
- Share full browser console log
- Share go2rtc logs: `docker logs cloud-obs-go2rtc --tail 50`
- Confirm: Did you hard refresh? (Cmd+Shift+R)

---

## Common Issues & Quick Fixes

### Issue: "⚠️ Track has no dimensions"
**Cause:** RTSP stream not providing proper metadata
**Fix:** go2rtc should be transcoding. Check logs for "video=copy"

### Issue: "❌ WebSocket error: wrong user/pass"
**Cause:** RTSP not enabled or wrong credentials
**Fix:** Enable RTSP in camera web UI (see Cameras 4,5,6 section above)

### Issue: "Connection timeout"
**Cause:** Camera not responding on RTSP port
**Fix:**
- Test with: `nc -zv [camera-ip] 554`
- Enable RTSP in camera settings
- Check network connectivity

### Issue: Cameras connect then "stop producer"
**Cause:** RTSP URL format wrong or stream not working
**Fix:** The single-slash URLs should fix this!

---

## System Check
```bash
# Verify all services running
docker-compose ps

# Should show:
# cloud-obs-go2rtc        Up
# cloud-obs-backend       Up
# cloud-obs-livekit       Up
# cloud-obs-redis         Up
```

---

## Browser: http://localhost:3001

1. Join room with name "geome-hackathon"
2. Click hamburger menu (☰)
3. Click "Live" tab
4. Watch cameras auto-connect
5. Check console (F12) for logs

---

**Ready? Do the hard refresh now!** (Cmd+Shift+R)

Then report back what you see in:
1. Browser console emoji logs
2. Camera status indicator (top-right)
3. Video display (black or showing feed?)

---

**Files to check:**
- Browser console: F12
- Terminal: `docker logs cloud-obs-go2rtc --tail 30`
- Status indicator: Top-right corner of Live view

**Key change:** RTSP URLs now use `/h264Preview_01_sub` (single slash) instead of `//h264Preview_01_sub` (double slash)

This is the **correct format** verified by actual RLC-820A users!
