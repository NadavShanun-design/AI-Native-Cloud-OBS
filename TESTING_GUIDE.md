# Camera Testing Guide

## What We Fixed

1. ✅ Added `playsinline` and `webkit-playsinline` attributes to video element (required for Safari/iOS)
2. ✅ Added hardware acceleration CSS transforms
3. ✅ Created simple camera test page (without LiveKit complexity)
4. ✅ Identified HTTPS requirement for Safari
5. ✅ Rebuilt and deployed API gateway

## Critical Issue: Safari Requires HTTPS

**Safari on both Mac and iOS requires HTTPS for camera access.** Since we're using `http://10.103.82.101:3000`, Safari won't prompt for camera permissions.

### Solution: Enable Safari Exception (Mac Only)

Follow the instructions in `SAFARI_SETUP.md` to enable camera on HTTP for development.

## Test Pages Available

### 1. Simple Camera Test (Start Here)
**URL**: `http://10.103.82.101:3000/camera-test`

This is a simple page that tests getUserMedia WITHOUT LiveKit. Use this to verify camera permissions work before testing the full system.

**Features**:
- Detailed logging of every step
- Shows exact error messages
- Detects secure context issues
- Lists available cameras
- Works on both Mac and phone

**Test on Mac Safari**:
1. Open Safari
2. Enable Web Inspector: Safari → Settings → Advanced → "Show features for web developers"
3. Go to `http://10.103.82.101:3000/camera-test`
4. Right-click → Inspect Element (or Cmd+Option+I)
5. In Web Inspector toolbar, click the **camera icon** → Enable "Allow Media Capture on Insecure Sites"
6. Refresh the page
7. Click "Start Camera"
8. Safari should now prompt for camera/microphone permissions
9. Allow both camera and microphone
10. You should see your video feed!

**Test on iPhone**:
1. iPhone may require HTTPS - try the simple test first
2. If it doesn't work, we'll need to set up HTTPS certificates or use the Mac as a hotspot

### 2. Full Camera App with LiveKit
**URL**: `http://10.103.82.101:3000/camera?id=cam-1`

After the simple test works, try the full camera app with LiveKit integration.

**Features**:
- Full LiveKit WebRTC streaming
- Camera selection dropdown (on laptops)
- Flip camera button (on phones)
- Connects to AI analysis system

## Testing Steps

### Phase 1: Simple Camera Test on Mac

1. **Open Safari on your Mac**
2. **Go to**: `http://10.103.82.101:3000/camera-test`
3. **Open Web Inspector** (Cmd+Option+I)
4. **Enable camera exception**:
   - Click camera icon in Web Inspector toolbar
   - Enable "Allow Media Capture on Insecure Sites"
5. **Refresh page**
6. **Click "Start Camera" button**
7. **Allow permissions** when Safari prompts
8. **Verify**: You should see your camera feed

**Expected Result**:
- Green status messages
- Video feed appears
- Logs show "✅ Camera access granted!"
- Logs show stream details (resolution, frame rate)

**If it doesn't work**:
- Check the logs in the page (scroll down)
- Look for red error messages
- Check Console tab in Web Inspector for errors

### Phase 2: Full Camera App on Mac

1. **Go to**: `http://10.103.82.101:3000/camera?id=cam-1`
2. **Click "Start Broadcasting"**
3. **Allow permissions** (if prompted again)
4. **Verify**: Video feed appears and status shows "Streaming as CAM-1"

**Expected Result**:
- LiveKit connects successfully
- Video and audio streaming
- Status shows "Connected as CAM-1"

### Phase 3: Phone Testing

#### iPhone:
1. **Scan QR code** from `http://10.103.82.101:3101/cameras` page
2. **Tap "Start Broadcasting"**
3. **Allow camera/microphone** when prompted

**Note**: iOS Safari may be more restrictive about HTTP. If it doesn't work:
- Try the camera-test page first: `http://10.103.82.101:3000/camera-test`
- Check if iOS shows the permission prompt
- May need HTTPS for production use

#### Android:
Should work more easily than iOS. Same steps as iPhone.

## Troubleshooting

### "Camera/microphone permission denied" (No prompt shown)

**Cause**: Safari requires HTTPS or Web Inspector exception

**Fix**:
1. Open Web Inspector (Cmd+Option+I)
2. Click camera icon → Enable "Allow Media Capture on Insecure Sites"
3. Refresh page

### "Camera permission denied" (After clicking deny)

**Cause**: You clicked "Deny" on the permission dialog

**Fix**:
1. Safari → Settings → Websites → Camera
2. Find and remove `10.103.82.101`
3. Refresh page and try again

### "No camera found"

**Cause**: No camera device available

**Fix**:
1. Check System Settings → Privacy & Security → Camera
2. Make sure Safari is allowed
3. Close other apps using the camera (Zoom, FaceTime, etc.)

### "Camera already in use"

**Cause**: Another app is using your camera

**Fix**:
1. Close Zoom, FaceTime, Photo Booth, etc.
2. Try again

### iOS/iPhone not working

**Cause**: iOS Safari is very strict about HTTPS

**Options**:
1. Set up HTTPS certificates (production solution)
2. Use Mac's hotspot (creates trusted local network)
3. Wait for desktop testing to work first

## What to Expect

### Simple Test Page (`/camera-test`)
- Shows detailed logs
- Clear error messages
- Lists camera devices
- Video preview
- Easy to debug

### Full Camera App (`/camera?id=cam-1`)
- Connects to LiveKit
- Streams to analysis workers
- AI-powered camera switching
- More complex, but full featured

## Next Steps After Testing

1. ✅ Verify simple camera test works on Mac
2. ✅ Verify full camera app works on Mac
3. 🔄 Test on iPhone (may need HTTPS)
4. 🔄 Test on Android
5. 🔄 Test AI camera switching
6. 🔄 Set up HTTPS for production

## URLs Quick Reference

- **Main Dashboard**: `http://10.103.82.101:3101`
- **Camera Setup (QR Codes)**: `http://10.103.82.101:3101/cameras`
- **Simple Camera Test**: `http://10.103.82.101:3000/camera-test`
- **Full Camera App**: `http://10.103.82.101:3000/camera?id=cam-1`
- **Token API**: `http://10.103.82.101:3000/token`
- **Health Check**: `http://10.103.82.101:3000/health`

## Safari Setup Reminder

See `SAFARI_SETUP.md` for detailed instructions on enabling camera on HTTP for Safari development.

**Key requirement**: Safari Web Inspector → Camera icon → "Allow Media Capture on Insecure Sites"
