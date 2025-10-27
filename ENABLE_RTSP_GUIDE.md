# 🔧 Enable RTSP on RLC-820A Cameras - REQUIRED STEP

## Root Cause Identified

**RTSP is DISABLED by default** on RLC-820A cameras with firmware 3.1.0.764 and later.

From Reolink official documentation:
> "After a factory reset, the camera boots with RTSP and RTMP disabled until you turn it back on."

This is why:
- ✅ Cameras connect initially (TCP port 554 is open)
- ❌ Streams stop after 30 seconds (RTSP handshake fails)
- ❌ Show "wrong user/pass" (actually RTSP disabled)

---

## How to Enable RTSP - Step by Step

### Camera 1 (10.39.12.110)

1. **Open web browser**
   ```
   http://10.39.12.110
   ```

2. **Login**
   - Username: `admin`
   - Password: `Password03!`

3. **Navigate to RTSP Settings**
   ```
   Settings → Network → Advanced → Port Settings
   ```

4. **Enable RTSP**
   - Find "RTSP Port" section
   - Check the box: ☑️ **Enable RTSP**
   - Port should be: `554` (default)
   - Click **Save** or **Apply**

5. **Verify**
   - RTSP Port: `554`
   - Status: `Enabled` ✓

6. **Click OK/Save** to apply changes

---

### Camera 2 (10.39.12.107)

**Repeat the same steps:**

1. Open: `http://10.39.12.107`
2. Login: admin / Password03!
3. Settings → Network → Advanced → Port Settings
4. Enable RTSP (port 554)
5. Save

---

### Camera 3 (10.39.12.104)

1. Open: `http://10.39.12.104`
2. Login: admin / Password03!
3. Settings → Network → Advanced → Port Settings
4. Enable RTSP (port 554)
5. Save

---

### Camera 4 (10.39.12.106)

1. Open: `http://10.39.12.106`
2. Login: admin / zSQ6e9MB&03!  ← **Different password**
3. Settings → Network → Advanced → Port Settings
4. Enable RTSP (port 554)
5. Save

---

### Camera 5 (10.39.12.109)

1. Open: `http://10.39.12.109`
2. Login: admin / zSQ6e9MB&03!  ← **Different password**
3. Settings → Network → Advanced → Port Settings
4. Enable RTSP (port 554)
5. Save

---

### Camera 6 (10.39.12.108)

1. Open: `http://10.39.12.108`
2. Login: admin / zSQ6e9MB&03!  ← **Different password**
3. Settings → Network → Advanced → Port Settings
4. Enable RTSP (port 554)
5. Save

---

## Screenshots Location in Web UI

### Exact Path (may vary by firmware):

**Option 1 (Most common):**
```
Settings → Network → Advanced Settings → Port Settings
```

**Option 2:**
```
Device Settings → Network → Port Settings
```

**Option 3:**
```
System → Network → Port Settings
```

### What the RTSP Setting Looks Like:

```
┌─────────────────────────────────────┐
│  Port Settings                      │
├─────────────────────────────────────┤
│                                     │
│  ☐ HTTP Port:  [  80  ]            │
│  ☑ HTTPS Port: [ 443  ]            │
│  ☑ ONVIF Port: [ 8000 ]            │
│  ☐ RTMP Port:  [ 1935 ]            │
│  ☑ RTSP Port:  [ 554  ]  ← Enable! │
│                                     │
│         [Cancel]  [Save]            │
└─────────────────────────────────────┘
```

**Make sure the checkbox next to "RTSP Port" is CHECKED!**

---

## After Enabling RTSP

### Test Immediately

**Option 1: Test with VLC Media Player**

1. Open VLC
2. Media → Open Network Stream
3. Enter: `rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_sub`
4. Click Play
5. **Should see live video within 3-5 seconds**

**Option 2: Test with ffprobe (Terminal)**

```bash
ffprobe -rtsp_transport tcp -i "rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_sub" -show_streams 2>&1 | grep -E "codec_type|width|height"
```

**Expected output:**
```
codec_type=video
codec_name=h264
width=896
height=512
```

---

### Refresh Your Browser

**After enabling RTSP on all cameras:**

1. **Hard refresh browser:**
   - Mac: `Cmd + Shift + R`
   - Windows: `Ctrl + Shift + R`

2. **Open browser console:**
   - Press `F12`

3. **Watch for success logs:**
   ```
   🎥 [Camera 1] Received track event...
   📹 [Camera 1] Video Track Details: { width: 896, height: 512 }
   ✅ [Camera 1] Successfully published to LiveKit
   ```

4. **Check go2rtc logs:**
   ```bash
   docker logs cloud-obs-go2rtc --tail 30
   ```

   **Should see (and STAY connected):**
   ```
   [streams] start producer camera_1
   ```

   **Should NOT see:**
   ```
   [streams] stop producer camera_1  ← This was the problem!
   ```

---

## Troubleshooting

### Can't Access Camera Web Interface

**Problem:** Browser shows "Can't connect to 10.39.12.110"

**Solutions:**

1. **Check network connectivity:**
   ```bash
   ping 10.39.12.110
   ```

2. **Check if HTTP port is open:**
   ```bash
   nc -zv 10.39.12.110 80
   ```

3. **Try HTTPS instead:**
   ```
   https://10.39.12.110
   ```

4. **Reset camera to defaults:**
   - Press reset button for 10 seconds
   - Default IP: Check router DHCP assignments

---

### Wrong Username/Password

**Problem:** Login fails on camera web interface

**Camera 1, 2, 3:**
- Username: `admin`
- Password: `Password03!`

**Camera 4, 5, 6:**
- Username: `admin`
- Password: `zSQ6e9MB&03!`

**If password still wrong:**
1. Try mobile app (Reolink app) to access camera
2. Check password in app settings
3. May need to create new admin user via Reolink Windows client
4. Factory reset camera if necessary

---

### RTSP Option Not Visible

**Problem:** Can't find "RTSP Port" in settings

**Possible causes:**

1. **Old firmware:** Update camera firmware
   - Settings → Device → Firmware
   - Check for updates
   - Update to latest (3.1.0.956+ recommended)

2. **Wrong settings menu:** Try different paths:
   - Network → Port Settings
   - Advanced Settings → Port Settings
   - System → Network

3. **Feature disabled:** Some models require license
   - Check Reolink support for your model

---

### RTSP Enabled but Still Fails

**Problem:** Enabled RTSP but streams still stop

**Debug steps:**

1. **Reboot camera after enabling:**
   - Settings → System → Reboot
   - Wait 2 minutes for camera to restart

2. **Test RTSP port is open:**
   ```bash
   nc -zv 10.39.12.110 554
   ```

   **Should show:**
   ```
   Connection to 10.39.12.110 port 554 succeeded!
   ```

3. **Test RTSP stream directly:**
   ```bash
   ffplay "rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_sub"
   ```

   **Should show live video**

4. **Check camera logs:**
   - Settings → System → Logs
   - Look for RTSP connection attempts
   - Check for error messages

---

## Expected Results After Enabling RTSP

### Browser Console

**All 6 cameras should show:**
```javascript
✅ [Camera 1] Successfully published to LiveKit
✅ [Camera 2] Successfully published to LiveKit
✅ [Camera 3] Successfully published to LiveKit
✅ [Camera 4] Successfully published to LiveKit
✅ [Camera 5] Successfully published to LiveKit
✅ [Camera 6] Successfully published to LiveKit
```

### go2rtc Logs

**Should show and STAY connected:**
```
[streams] start producer camera_1
[streams] start producer camera_2
[streams] start producer camera_3
[streams] start producer camera_4
[streams] start producer camera_5
[streams] start producer camera_6
```

**Should NOT see "stop producer" anymore!**

### Live View

**All 6 camera feeds should:**
- ✅ Display live video (not black screens)
- ✅ Show proper resolution (896×512)
- ✅ Update in real-time (15 FPS)
- ✅ Have green checkmark in status indicator

### Camera Status Indicator

**Top-right corner should show:**
```
📹 Cameras: 6/6

Click to expand:
✓ Camera 1 (10.39.12.110) - Connected
✓ Camera 2 (10.39.12.107) - Connected
✓ Camera 3 (10.39.12.104) - Connected
✓ Camera 4 (10.39.12.106) - Connected
✓ Camera 5 (10.39.12.109) - Connected
✓ Camera 6 (10.39.12.108) - Connected
```

---

## Alternative: Enable RTSP via Mobile App

If web interface doesn't work:

1. **Install Reolink app** (iOS/Android)
2. **Add cameras** to app
3. **For each camera:**
   - Tap camera
   - Settings ⚙️
   - Network Settings
   - Port Settings
   - Enable RTSP (port 554)
   - Save

---

## Alternative: Enable RTSP via Reolink Client (Desktop)

1. **Download Reolink Client** for Windows/Mac
2. **Add cameras** to client
3. **Right-click camera** → Device Settings
4. **Network** → Port Settings
5. **Enable RTSP** (port 554)
6. **Apply**

---

## Why This Matters

**Without RTSP enabled:**
- ❌ TCP connection succeeds (port 554 open)
- ❌ RTSP handshake fails (service disabled)
- ❌ go2rtc shows "wrong user/pass" or timeout
- ❌ Stream stops after 30 seconds
- ❌ No video data received

**With RTSP enabled:**
- ✅ TCP connection succeeds
- ✅ RTSP handshake succeeds
- ✅ go2rtc receives H.264 stream
- ✅ WebRTC connection established
- ✅ Browser displays live video

---

## Summary Checklist

### For Each Camera:

- [ ] Access camera web interface (http://[camera-ip])
- [ ] Login with admin credentials
- [ ] Navigate to Network → Advanced → Port Settings
- [ ] Check "Enable RTSP" checkbox
- [ ] Verify port is 554
- [ ] Click Save
- [ ] Wait 10 seconds
- [ ] Test with VLC: `rtsp://admin:password@ip:554/h264Preview_01_sub`
- [ ] Verify video plays in VLC

### After All Cameras Configured:

- [ ] Hard refresh browser (Cmd+Shift+R)
- [ ] Check browser console for ✅ success logs
- [ ] Verify go2rtc logs show "start producer" for all 6
- [ ] Confirm no "stop producer" messages
- [ ] Check Live view shows all 6 video feeds
- [ ] Verify camera status shows 6/6 connected

---

## Next Steps

1. **Enable RTSP on all 6 cameras** (use this guide)
2. **Test each camera** with VLC or ffprobe
3. **Refresh browser** and check console logs
4. **Report back** with results
5. **If successful:** Video should display in Live, Ranked, and YOLO views
6. **If still failing:** Share camera web UI screenshots and logs

---

**Critical Note:** RTSP MUST be enabled on RLC-820A cameras for this system to work. This is not optional - it's a required configuration step for any camera model with firmware 3.1.0.764+.

**Estimated Time:** 10-15 minutes to enable RTSP on all 6 cameras

**After enabling RTSP, the video pipeline will work:**
```
Camera (RTSP enabled) → go2rtc → WebRTC → Browser → Live/Ranked/YOLO Views
```
