# 🚀 QUICK FIX - Use Chrome Instead of Safari

## The Problem
Safari on Mac is **extremely strict** with self-signed SSL certificates and won't let you bypass them easily. Chrome is much more permissive.

## ✅ THE SOLUTION - Use Chrome

### **Step 1: Install Chrome** (if you don't have it)
Download from: https://www.google.com/chrome/

### **Step 2: Open Camera in Chrome**

**Mac (this computer):**
```bash
open -a "Google Chrome" https://10.237.213.101:3000/camera?id=cam-1
```

Or manually paste in Chrome:
```
https://10.237.213.101:3000/camera?id=cam-1
```

### **Step 3: Click Through Warning**
1. You'll see "Your connection is not private"
2. Click **"Advanced"**
3. Click **"Proceed to 10.237.213.101 (unsafe)"**
4. ✅ Done! Certificate accepted

### **Step 4: Allow Camera**
1. Browser will ask for camera permission
2. Click **"Allow"**
3. ✅ You should see yourself with "🔴 LIVE"!

---

## 📱 For Phones (Keep Using Safari on iOS)

**iPhone:**
1. Open Safari (Chrome won't work on iOS with self-signed certs)
2. Go to: `https://10.237.213.101:3000/camera?id=cam-2`  
3. Tap "Show Details" → "visit this website"
4. Allow camera
5. ✅ Should work!

**Android:**
1. Open Chrome
2. Go to: `https://10.237.213.101:3000/camera?id=cam-2`
3. Tap "Advanced" → "Proceed"
4. Allow camera
5. ✅ Should work!

---

## 🌐 All Working URLs

| What | URL | Browser |
|------|-----|---------|
| **Dashboard** | `https://10.237.213.101:3101` | Chrome ✅ |
| **Camera 1** | `https://10.237.213.101:3000/camera?id=cam-1` | Chrome ✅ |
| **Camera 2** | `https://10.237.213.101:3000/camera?id=cam-2` | Chrome ✅ |
| **QR Codes** | `https://10.237.213.101:3101/cameras` | Chrome ✅ |

**Note:** Use port **3000** for cameras, port **3101** for dashboard!

---

## 🔧 Why Chrome and Not Safari?

- ✅ **Chrome**: Lets you bypass self-signed cert warnings easily
- ❌ **Safari**: Very strict, hard to bypass warnings on Mac
- ✅ **Safari on iOS**: Works fine (Apple allows bypassing on mobile)
- ✅ **Chrome on Android**: Works great

---

## 🚀 Quick Test Command

Run this on your Mac to open everything in Chrome:

```bash
# Open camera
open -a "Google Chrome" https://10.237.213.101:3000/camera?id=cam-1

# Wait 5 seconds, then open dashboard
sleep 5 && open -a "Google Chrome" https://10.237.213.101:3101
```

---

## ❓ Still Not Working?

1. **Make sure all services are running:**
   ```bash
   cd /Users/nadavshanun/Downloads/AI-OBS
   docker-compose ps
   ```
   All should show "Up"

2. **Restart everything:**
   ```bash
   docker-compose restart
   ```

3. **Check logs:**
   ```bash
   docker-compose logs --tail=50 api-gateway
   docker-compose logs --tail=50 livekit-server
   ```
