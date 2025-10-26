# 🚀 Quick Start Guide - AI Ranking System

## ⚠️ IMPORTANT: You're on the wrong page!

The errors you're seeing are because you're accessing `/custom` which connects to LiveKit Cloud.

The **AI ranking system is integrated into the main application**, not the custom page.

---

## ✅ CORRECT WAY TO ACCESS

### Step 1: Go to the Home Page
Open your browser and navigate to:
```
http://localhost:3001
```

### Step 2: Enter Password
When prompted, enter:
```
goodvibesonly
```

### Step 3: Join a Room
- Enter your name
- The room name will be automatically set
- Enable camera/microphone if needed
- Click "Join Room"

### Step 4: Access AI Features
Once in the room, use the sidebar (left side) to access:

- **Live Tab** 📹 - Normal video conference with AI scores overlay
- **View Tab** 🏆 - Ranked leaderboard of all participants
- **Dashboard Tab** 📊 - Upload and rank multiple videos
- **Add Stream** 📤 - Quick video upload modal

---

## 🎥 How to Upload and Rank Videos

### Option 1: Using Dashboard (Recommended)

1. Click the **"Dashboard"** tab in the sidebar
2. Click **"📤 Upload Videos"** button
3. Select one or multiple video files
4. Watch them upload, convert, and start playing
5. AI will analyze them every 3 seconds
6. Videos will be sorted by AI score automatically

### Option 2: Using Add Stream Modal

1. Click the **"Add Stream"** button in the sidebar
2. Select a single video file
3. It will be added to the live room

---

## 🔧 System Status Check

### Verify Backend is Running

Open a terminal and run:
```bash
cd /Users/nadavshanun/Downloads/cloud-obs-main
docker-compose ps
```

You should see all services as "Up":
```
✅ cloud-obs-livekit        (port 7880)
✅ cloud-obs-api-gateway    (port 3000)
✅ cloud-obs-redis          (port 6380)
✅ cloud-obs-analysis-worker
```

### Check AI Worker Logs

```bash
docker-compose logs -f analysis-worker
```

You should see:
```
[INFO] 🤖 AI Video Analysis Worker Starting
[INFO] ✅ Connected to Redis
[INFO] OpenAI Model: gpt-4o-mini
```

---

## 🐛 Troubleshooting

### Error: "ConnectionError: could not establish signal connection: invalid API key"

**Cause**: You're on `/custom` page trying to connect to LiveKit Cloud

**Solution**: Go to `http://localhost:3001` instead (home page)

---

### Error: "publishing rejected as engine not connected"

**Cause**: Using cloud credentials instead of local LiveKit

**Solution**: Use the home page flow, not `/custom`

---

### No AI scores appearing

**Cause**: Backend might not be running or no videos in room

**Solutions**:
1. Check Docker: `docker-compose ps`
2. Restart if needed: `docker-compose restart`
3. Upload a video using Dashboard tab
4. Wait 3-5 seconds for first AI score

---

## 📍 URL Guide

### ✅ CORRECT URLs to use:

- **Home/Login**: `http://localhost:3001`
- **Auto-redirect to room**: Happens after login
- **AI features**: Access via sidebar tabs (no URL changes)

### ❌ INCORRECT URLs (will cause errors):

- `/custom?liveKitUrl=...` - This is for external LiveKit Cloud
- Direct room URLs without going through login

---

## 🎯 Testing the Complete Flow

### Quick Test (No Video Upload):

1. Go to `http://localhost:3001`
2. Enter password: `goodvibesonly`
3. Join room with camera enabled
4. Click "View" tab to see ranked view
5. Your camera feed should appear with AI score

### Full Test (With Video Upload):

1. Go to `http://localhost:3001`
2. Enter password: `goodvibesonly`
3. Join room
4. Click "Dashboard" tab
5. Click "📤 Upload Videos"
6. Select 2-3 video files
7. Watch them upload and get AI scores
8. Top-ranked video appears at the top
9. Switch to "View" tab to see leaderboard

---

## 🔑 Important Configuration

### Frontend (.env.local)
```env
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_URL=ws://localhost:7880
NEXT_PUBLIC_MAIN_BACKEND_URL=http://localhost:3000
```

### Backend (.env)
```env
OPENAI_API_KEY=your_openai_api_key_here
LIVEKIT_URL=ws://livekit-server:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
```

---

## 🎉 You're Ready!

**Main URL**: http://localhost:3001

**Password**: goodvibesonly

**Next Step**: Join room, click "Dashboard", upload videos, watch AI rank them!

---

## 💡 Pro Tips

1. **Upload multiple videos at once** - Dashboard supports multi-upload
2. **Wait 3-5 seconds** - First AI score takes a few seconds
3. **Check the score badges** - Green = high score, Red = low score
4. **Read AI reasoning** - Hover over scores to see why
5. **Switch views** - Use sidebar to switch between Live, View, Dashboard

---

**Still having issues?** Check:
1. Are you on `http://localhost:3001`? (Not `/custom`)
2. Is Docker running? (`docker-compose ps`)
3. Did you enter the password? (`goodvibesonly`)
