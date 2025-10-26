# 📱 Certificate Trust Setup for Camera Access

## Why You Need This

Modern browsers **require HTTPS** to access cameras/microphones from any device that isn't `localhost`. Since we're using a self-signed certificate for local development, you need to **trust the certificate** on each device.

---

## 🖥️ **Mac/Desktop (This Computer)**

### **Chrome/Brave/Edge**
1. When you see the warning "Your connection is not private"
2. Click **"Advanced"**
3. Click **"Proceed to 10.237.213.101 (unsafe)"**
4. ✅ Done! The certificate is now trusted for this session

### **Safari (Better for Mac)**
1. Go to `https://10.237.213.101:3000/health`
2. Click **"Show Details"** → **"Visit this website"**
3. Click **"Visit Website"** again
4. ✅ Done!

---

## 📱 **iPhone/iPad**

### **Step 1: Accept Certificate in Safari**
1. Open Safari on your iPhone
2. Go to: `https://10.237.213.101:3000/health`
3. You'll see a warning - tap **"Show Details"**
4. Tap **"visit this website"**
5. Tap **"Visit Website"** again to confirm
6. ✅ You should see: {"status":"ok",...}

### **Step 2: Now Test Camera**
1. In Safari, go to: `https://10.237.213.101:3000/camera?id=cam-1`
2. Tap **"Allow"** when asked for camera access
3. ✅ You should see yourself and "🔴 LIVE"!

**Note:** Use Safari on iOS. Chrome may not work with self-signed certificates.

---

## 🤖 **Android Phone/Tablet**

1. Open Chrome
2. Go to: `https://10.237.213.101:3000/health`
3. Tap **"Advanced"** → **"Proceed to 10.237.213.101 (unsafe)"**
4. Now go to: `https://10.237.213.101:3000/camera?id=cam-1`
5. Tap **"Allow"** for camera
6. ✅ Should work!

---

## 🌐 **All URLs Are Now HTTPS**

### **Dashboard:**
```
https://10.237.213.101:3101
```

### **Camera Page:**
```
https://10.237.213.101:3000/camera?id=cam-1
```

### **QR Code Page:**
```
https://10.237.213.101:3101/cameras
```

---

## 🔐 **Security Note**

This is a **self-signed certificate** - completely safe for local network use!
- ✅ Traffic is encrypted
- ✅ Standard for local development
- ❌ Don't use on public internet
