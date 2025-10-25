# 📹 AI-OBS Camera Links - READY TO USE

## 🏠 LOCAL (This Computer)

**Dashboard:**
```
http://localhost:3101
```

**Cameras (Open in separate tabs):**
```
http://localhost:3000/camera?id=cam-1
http://localhost:3000/camera?id=cam-2
http://localhost:3000/camera?id=cam-3
http://localhost:3000/camera?id=cam-4
http://localhost:3000/camera?id=cam-5
```

---

## 📱 WIFI (Other Devices on Same Network)

**Your IP Address:** `10.237.213.101`

**Dashboard:**
```
http://10.237.213.101:3101
```

**Cameras (Send these links to phones/laptops):**
```
http://10.237.213.101:3000/camera?id=cam-phone-1
http://10.237.213.101:3000/camera?id=cam-phone-2
http://10.237.213.101:3000/camera?id=cam-laptop-1
http://10.237.213.101:3000/camera?id=cam-laptop-2
http://10.237.213.101:3000/camera?id=cam-laptop-3
```

**Or custom ID:**
```
http://10.237.213.101:3000/camera?id=cam-YOUR-NAME
```

---

## ✅ HOW TO USE:

### **Step 1: Open Cameras FIRST**

Open 2-5 camera links in **SEPARATE TABS/WINDOWS**

Click "Allow" when browser asks for camera permission

Wait for **"🔴 LIVE"** status at top of each camera page

**LEAVE THESE TABS OPEN!**

### **Step 2: Open Dashboard**

Open dashboard link in a **NEW TAB**

You'll now see all connected cameras with:
- ✅ Live video feeds
- ✅ AI scores (0-100)
- ✅ Rankings (🥇🥈🥉)
- ✅ Real-time score updates
- ✅ Auto-switching to best camera

---

## 🔍 DEBUG PANEL

The dashboard now shows a **yellow debug panel** at the top with:

```
🔍 DEBUG INFO:
Total Participants: 2
Participant IDs: ["cam-1", "cam-2"]
Filtered Cameras: 2
Camera IDs: ["cam-1", "cam-2"]
Scores in Store: 2
```

This tells you exactly what the dashboard is seeing!

**If you see:**
- `Total Participants: 0` → No cameras connected yet
- `Filtered Cameras: 0` but `Total Participants > 0` → Cameras connected but wrong naming
- `Scores in Store: 0` → WebSocket not connected or scores not flowing

---

## 🐛 TROUBLESHOOTING:

### **Problem: "No cameras connected"**

**Solution:**
1. Open camera pages FIRST (http://localhost:3000/camera?id=cam-1)
2. Wait for "🔴 LIVE" status
3. THEN open dashboard
4. Check debug panel shows participants

### **Problem: Cameras disappear when I switch tabs**

**Solution:**
- Keep camera tabs OPEN in background
- Don't close camera tabs
- On phone: minimize browser but don't close it

### **Problem: Can't connect from phone**

**Check:**
1. Phone on SAME WiFi as computer
2. Using IP `10.237.213.101` (not localhost)
3. Allow camera access when prompted
4. No firewall blocking ports 3000, 3101, 7880

---

## 📊 VERIFY IT'S WORKING:

### **Check Cameras:**
```bash
docker-compose logs livekit-server --tail=20 | grep "cam-"
```

Should show: `participant: cam-1`, `participant: cam-2`, etc.

### **Check Scoring:**
```bash
docker-compose logs analysis-worker --tail=10 | grep "📊"
```

Should show: `📊 cam-1: score=0.65 - Person speaking`

### **Check All Services:**
```bash
docker-compose ps
```

All should show "Up"

---

## 🎬 QUICK TEST:

**1. Open Camera 1:**
```
http://localhost:3000/camera?id=cam-1
```
Wait for "🔴 LIVE"

**2. Open Camera 2:**
```
http://localhost:3000/camera?id=cam-2
```
Wait for "🔴 LIVE"

**3. Open Dashboard:**
```
http://localhost:3101
```

**4. Check Debug Panel:**
Should show:
- Total Participants: 2
- Participant IDs: ["cam-1", "cam-2"]
- Both cameras visible in grid with video feeds

---

**That's it! Simple and working!** 🚀
