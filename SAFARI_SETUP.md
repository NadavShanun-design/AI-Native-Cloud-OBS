# Safari Camera Setup for Mac

Safari requires HTTPS for camera/microphone access. Since we're using HTTP for local development, you need to enable an exception in Safari.

## Enable Camera on HTTP (Development Only)

### Method 1: Safari Web Inspector (Easiest)

1. Open Safari on your Mac
2. Go to Safari menu → Settings → Advanced
3. Check "Show features for web developers" at the bottom
4. Go to `http://10.103.82.101:3000/camera?id=cam-1` in Safari
5. Right-click on the page → Inspect Element (or press Cmd+Option+I)
6. In the Web Inspector window, look for the **camera icon** in the top toolbar
7. Click the camera icon and enable "Allow Media Capture on Insecure Sites"
8. Refresh the page
9. Click "Start Broadcasting"
10. Safari should now prompt for camera/microphone permissions

### Method 2: Develop Menu

1. Open Safari → Settings → Advanced
2. Enable "Show Develop menu in menu bar"
3. In Safari menu bar: Develop → Experimental Features
4. Look for and enable any options related to getUserMedia or media capture

### Method 3: Use localhost with Port Forwarding

If the above doesn't work, you can use SSH tunneling to access via localhost (which Safari treats as secure):

```bash
# On your Mac, forward the remote port to localhost
ssh -L 3000:10.103.82.101:3000 localhost
```

Then access via `http://localhost:3000/camera?id=cam-1` instead.

## For iPhone

For iPhone, you have two options:

### Option A: Self-Signed Certificate (Production-Ready)

Generate HTTPS certificates and configure the API gateway to use HTTPS.

### Option B: Test via Computer's Hotspot

1. On your Mac, enable Internet Sharing to create a hotspot
2. Connect your iPhone to that hotspot
3. Use the Mac's IP address from the hotspot network
4. iOS Safari will be more permissive with local network HTTPS requirements

## Verify Camera Permissions

After enabling the setting:

1. Click "Start Broadcasting" in the camera page
2. Safari should show a permission dialog
3. Click "Allow" for both camera and microphone
4. The video preview should appear

## Troubleshooting

If still not working:

1. **Check System Settings**:
   - System Settings → Privacy & Security → Camera
   - Make sure Safari is allowed

2. **Check Console Logs**:
   - Open Web Inspector (Cmd+Option+I)
   - Check the Console tab for errors
   - Look for red error messages

3. **Reset Permissions**:
   - Safari → Settings → Websites → Camera
   - Remove `10.103.82.101` if listed
   - Try again with fresh permissions

## Why This is Needed

Safari requires secure contexts (HTTPS or localhost) for getUserMedia API access. This is a security feature to prevent malicious sites from accessing your camera. For production, you should use proper HTTPS certificates.
