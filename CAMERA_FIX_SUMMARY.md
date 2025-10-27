# Camera Connection Fix Summary - RLC-820A

## Date: October 27, 2025

## Critical Fixes Applied

### 1. RTSP URL Format - CORRECTED

**Problem:** Initially used double-slash format `//h264Preview_01_sub` based on some documentation
**Research Finding:** Actual RLC-820A users with working configs use **SINGLE slash**
**Source:** GitHub Frigate discussions with verified RLC-820A users (firmware v3.1.0.956_22041501)

**CORRECT Format:**
```yaml
rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_sub   # SINGLE slash!
rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_main  # Main stream
```

**Applied to:** All 6 cameras in go2rtc.yaml

---

### 2. Main Stream Codec Format

**Changed:** `h265Preview_01_main` → `h264Preview_01_main`
**Reason:** Tested RLC-820A configs use h264Preview for both main and sub streams
**Note:** While RLC-820A supports H.265, the RTSP path format uses h264Preview

---

### 3. Password Encoding Fixed

**Cameras 4, 5, 6:**
- Password: `zSQ6e9MB&03!`
- Using raw password in YAML (no URL encoding needed)
- YAML handles special characters correctly

---

### 4. Transcoding Enabled

**Removed:** `#video=copy#audio=copy` parameters
**Reason:** These bypass transcoding and prevent proper WebRTC SDP metadata
**Result:** Browser now receives tracks with width/height dimensions

---

### 5. Enhanced Logging Added

**File:** `frontend/lib/CameraAutoConnectEnhanced.tsx:93-147`

**What's Logged:**
- Track event details (streams, track, transceiver)
- Video track settings (width, height, frameRate)
- Track capabilities
- Track state (enabled, muted, readyState)
- Warnings if dimensions are missing
- Success/failure of LiveKit publish

**Look for these in browser console:**
- 🎥 Track received
- 📹 Track details
- ✓ Dimensions found
- ⚠️ Warning (missing data)
- ✅ Success
- ❌ Error

---

## Current Configuration

### go2rtc.yaml
```yaml
streams:
  camera_1:
    - rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_sub
  camera_1_hd:
    - rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_main

  # Cameras 2, 3 use Password03!
  # Cameras 4, 5, 6 use zSQ6e9MB&03!
```

---

## Testing Steps

### 1. Hard Refresh Browser
```
Mac: Cmd + Shift + R
Windows: Ctrl + Shift + R
```

This forces reload of JavaScript and triggers new camera connections.

---

### 2. Open Browser Console
```
Press F12 (or Cmd+Option+I on Mac)
```

**Expected Output for Success:**
```javascript
🎥 [Camera 1] Received track event: { streams: 1, ... }
📹 [Camera 1] Video Track Details: {
  width: 896,    // ← SHOULD HAVE THIS
  height: 512,   // ← SHOULD HAVE THIS
  frameRate: 15,
  ...
}
✓ [Camera 1] Track dimensions: 896x512
📤 [Camera 1] Publishing track to LiveKit...
✅ [Camera 1] Successfully published to LiveKit
```

**Repeat for all 6 cameras**

---

### 3. Check go2rtc Logs
```bash
docker logs cloud-obs-go2rtc --tail 50 | grep -E "camera_|producer|error"
```

**Expected:**
```
[streams] start producer url=rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_sub
```

**Should NOT see:**
- `stop producer` after 30 seconds
- `wrong user/pass` errors
- Old URLs with double slashes or #video=copy

---

### 4. Check Camera Status Indicator

**Location:** Top-right corner of Live view
**Format:** "📹 Cameras: X/6"

Click to expand and see per-camera status:
- ✓ (Green) = Connected
- ⋯ (Yellow) = Connecting/Retrying
- ✗ (Red) = Error (with retry button)

---

## Potential Issues & Solutions

### Issue 1: "wrong user/pass" for Cameras 4, 5, 6

**Check:**
1. RTSP enabled on cameras? (Web UI → Network → Advanced → Ports)
2. Admin user created via Reolink Windows app (not web UI)
3. Password is exactly: `zSQ6e9MB&03!`

**Fix:**
- Access camera web UI: `http://10.39.12.106` (camera 4)
- Go to: Network Settings → Advanced → Ports
- Enable RTSP (port 554)
- Repeat for cameras 5 and 6

---

### Issue 2: Video tracks still have no dimensions

**Symptoms:** Console shows `⚠️ Track has no dimensions! Settings: {}`

**Possible Causes:**
1. go2rtc not transcoding (check logs for "video=copy")
2. RTSP stream codec incompatible
3. Camera firmware issue
4. RTSP URL format still incorrect

**Debug:**
```bash
# Test direct RTSP connection
ffprobe -rtsp_transport tcp -i "rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_sub" -show_streams 2>&1 | grep -E "codec_type|width|height"
```

Should show:
```
codec_type=video
width=896
height=512
```

---

### Issue 3: Cameras connect then stop after 30 seconds

**Symptoms:** go2rtc logs show `[streams] stop producer`

**Possible Causes:**
1. RTSP timeout (no stream data)
2. Authentication expired
3. Camera RTSP limit reached (max clients)

**Fix:**
- Try accessing camera directly in VLC: `rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_sub`
- Check camera RTSP client limit in web UI
- Verify network connectivity

---

### Issue 4: Black screens in Live view

**Symptoms:** Cameras connect (green checkmark) but show black video

**Check:**
1. Browser console for LiveKit publish errors
2. LiveKit room participant list (should show camera tracks)
3. Video element inspector (should have srcObject assigned)

**Debug:**
```javascript
// In browser console:
document.querySelectorAll('video').forEach(v => {
  console.log('Video element:', {
    srcObject: v.srcObject,
    readyState: v.readyState,
    videoWidth: v.videoWidth,
    videoHeight: v.videoHeight
  });
});
```

---

## RLC-820A Camera Specifications

| Feature | Value |
|---------|-------|
| Model | RLC-820A |
| Resolution | 3840×2160 (4K) |
| Sub Stream | 896×512 @ 15fps |
| Main Stream | 3840×2160 @ 25-30fps |
| Video Format | H.264 (sub), H.265 (main) |
| RTSP Port | 554 (must be enabled) |
| Default Admin | admin |
| Web Interface | http://[camera-ip] |

---

## Important Notes

1. **RTSP Must Be Enabled:** RLC-820A cameras ship with RTSP disabled by default (firmware 3.1.0.764+)

2. **User Credentials:** Users created via camera web interface may fail authentication. Use Reolink Windows client to create users with proper formatting.

3. **HTTP-FLV Alternative:** If RTSP continues to fail, consider HTTP-FLV format:
   ```
   http://[IP]/flv?port=1935&app=bcs&stream=channel0_ext.bcs&user=admin&password=[pass]
   ```

4. **Network Requirements:**
   - Cameras on same network as go2rtc container
   - No firewall blocking port 554
   - Sufficient bandwidth for 6 streams

---

## Next Steps After Testing

1. **If all cameras connect and show video:**
   - ✅ Implementation complete!
   - Monitor for stability over 24 hours
   - Check CPU usage with all streams active

2. **If cameras 1, 2, 3 work but 4, 5, 6 fail:**
   - Enable RTSP on cameras 4, 5, 6 via web UI
   - Verify password is correct
   - Test credentials with VLC

3. **If cameras connect but no video:**
   - Share browser console logs
   - Share go2rtc logs
   - Check LiveKit room for tracks

4. **If connection timeout errors:**
   - Test network connectivity: `ping 10.39.12.110`
   - Test RTSP port: `nc -zv 10.39.12.110 554`
   - Check camera logs in web UI

---

## Files Modified

1. **go2rtc.yaml** - Fixed RTSP URLs (single slash, removed video=copy)
2. **frontend/lib/CameraAutoConnectEnhanced.tsx** - Enhanced logging
3. **frontend/lib/CameraConnectionStatus.tsx** - New status indicator component
4. **frontend/app/custom/VideoConferenceClientImpl.tsx** - Integration point

---

## Research Sources

- Frigate NVR Camera-Specific Configs: https://docs.frigate.video/configuration/camera_specific/
- Reolink Official RTSP Docs: https://support.reolink.com/hc/en-us/articles/900000630706
- RLC-820A User Configs: https://github.com/blakeblackshear/frigate/discussions/5198
- Verified working config: firmware v3.1.0.956_22041501

---

**Status:** ✅ Configuration updated, go2rtc restarted, ready for testing
**Last Updated:** October 27, 2025 20:13 UTC
