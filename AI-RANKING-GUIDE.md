# 🤖 AI Video Ranking System - Complete Guide

## 🎉 **SYSTEM IS LIVE AND RUNNING!**

Your AI-powered video ranking system is now fully operational. Here's everything you need to know.

---

## 📍 **QUICK ACCESS**

### **Main Application**
- **URL**: http://localhost:3001
- **Password**: `goodvibesonly`

### **AI Dashboard (NEW!)**
- **URL**: http://localhost:3001/dashboard
- **Purpose**: Upload and rank multiple videos simultaneously

### **Ranked View**
- **URL**: http://localhost:3001/ranked
- **Purpose**: Real-time participant leaderboard

---

## 🎯 **HOW TO USE THE DASHBOARD**

### **Step 1: Access the Dashboard**
1. Go to http://localhost:3001
2. Enter password: `goodvibesonly`
3. Click the **📊 Dashboard** tab in the sidebar

### **Step 2: Upload Videos**
1. Click the **"📤 Upload Videos"** button
2. Select multiple video files (MP4, WebM, MOV, etc.)
3. Videos will automatically:
   - Convert to LiveKit-compatible format
   - Start playing in the room
   - Get analyzed by AI every 3 seconds

### **Step 3: Watch Real-time Rankings**
- **Top Video**: Featured prominently at the top with gold border 🏆
- **All Videos Grid**: Sorted by AI score (highest first)
- **Live Scores**: Update every 3 seconds via WebSocket
- **AI Reasons**: See why each video got its score

---

## 🎥 **WHAT HAPPENS WHEN YOU UPLOAD**

```
Your Video Upload
      ↓
Converts to H.264 (LiveKit compatible)
      ↓
Publishes to LiveKit Room
      ↓
AI Worker samples frame every 3 seconds
      ↓
OpenAI GPT-4o-mini analyzes engagement
      ↓
Score sent via WebSocket
      ↓
Dashboard updates in real-time
```

---

## 📊 **AI SCORING SYSTEM**

### **Score Ranges:**

| Score | Level | Description | Example |
|-------|-------|-------------|---------|
| 90-100 | 🔥 Exceptional | Multiple people, dynamic action, clear engagement | Active meeting with gestures |
| 80-89 | ⭐ High | Speaking, gesturing, visible emotions | Person presenting |
| 60-79 | ✅ Good | People visible, some movement | Group discussion |
| 40-59 | 😐 Moderate | People present but static | Sitting quietly |
| 20-39 | 📉 Low | Minimal activity | Distant view |
| 0-19 | 💤 None | Empty or static | Blank screen |

### **What AI Considers:**
1. **Number of People** - More people often = higher score
2. **Engagement Level** - Speaking, gesturing, eye contact
3. **Movement** - Dynamic vs static
4. **Composition** - Framing, lighting, clarity
5. **Context** - Meeting, presentation, casual

---

## 🏗️ **SYSTEM ARCHITECTURE**

### **Backend Services (Running in Docker):**

```
┌─────────────────┐
│   Frontend      │ ← http://localhost:3001
│   (Next.js)     │
└────────┬────────┘
         │
         ├─── HTTP ──→ ┌─────────────────┐
         │             │  API Gateway    │ ← Port 3000
         │             │  (Node.js)      │
         │             └────────┬────────┘
         │                      │
         └── WebSocket ─────────┤
                                │
                    ┌───────────┴──────────┐
                    │                      │
            ┌───────▼────────┐    ┌───────▼─────────┐
            │   LiveKit      │    │     Redis       │
            │   Server       │    │   Pub/Sub       │
            └───────┬────────┘    └────────▲────────┘
                    │                      │
                    │              ┌───────┴─────────┐
                    └─────────────▶│ Analysis Worker │
                                   │  (Python + AI)  │
                                   └─────────────────┘
```

### **Data Flow:**

1. **Video Upload** → Frontend
2. **Convert & Publish** → LiveKit Server
3. **Subscribe to Video** → Analysis Worker
4. **Sample Frames** → Every 3 seconds
5. **AI Analysis** → OpenAI GPT-4o-mini
6. **Publish Score** → Redis
7. **Broadcast** → API Gateway → WebSocket → Frontend
8. **Update UI** → Real-time score display

---

## 🎨 **DASHBOARD FEATURES**

### **1. Header Section**
- **AI Status**: Shows if AI backend is connected
- **Video Count**: Number of active videos
- **Real-time Updates**: Green = connected, Red = disconnected

### **2. Upload Section**
- **Multi-file Upload**: Select multiple videos at once
- **Upload Progress**: See status of each video
- **Auto-play**: Videos start playing automatically

### **3. Featured Video (Top Ranked)**
- **Gold Border**: Highlights #1 ranked video
- **Large Display**: 500px height showcase
- **Score Badge**: Shows current score
- **AI Reason**: Explains why it's ranked #1

### **4. Video Grid**
- **Auto-sorted**: By AI score (high to low)
- **Rank Badges**: #1, #2, #3, etc.
- **Medals**: 🥇 Gold, 🥈 Silver, 🥉 Bronze
- **Color Coding**:
  - Gold border = #1
  - Silver border = #2
  - Bronze border = #3
  - Gray border = Others

### **5. Score Display**
- **Large Numbers**: Easy to read scores
- **Color Coded**:
  - Green = High (80-100)
  - Orange = Medium (60-79)
  - Red = Low (0-59)
- **AI Reasoning**: Why this score?

---

## 💻 **MAIN LIVE VIEW INTEGRATION**

The main Live view (http://localhost:3001/custom) can be enhanced to show the top-ranked participant:

### **To Enable Top-Ranked Display:**

1. Videos from Dashboard appear in Live view
2. AI scores are tracked
3. Top-ranked video can be featured
4. Others shown in sidebar

---

## 🔧 **TECHNICAL DETAILS**

### **Frontend Technology:**
- **Framework**: Next.js 15.2.4
- **WebRTC**: LiveKit Client SDK
- **Real-time**: WebSocket connection
- **Styling**: CSS Modules

### **Backend Services:**
- **API Gateway**: Fastify (Node.js/TypeScript)
- **Analysis Worker**: Python 3.11
- **AI Model**: OpenAI GPT-4o-mini
- **Messaging**: Redis Pub/Sub
- **Video Server**: LiveKit

### **Video Processing:**
- **Conversion**: H.264 codec, YUV420p color space
- **Resolution**: 1280x720 (default)
- **Frame Rate**: 30 FPS
- **Format**: Browser-native playback

### **AI Analysis:**
- **Frequency**: Every 3 seconds per video
- **Resolution**: 640x480 (for AI analysis)
- **Model**: GPT-4o-mini
- **Cost**: ~$0.60/hour per video stream

---

## 📁 **FILE STRUCTURE**

```
cloud-obs-main/
├── frontend/
│   ├── app/
│   │   ├── dashboard/              # NEW: AI Dashboard
│   │   │   ├── page.tsx
│   │   │   ├── DashboardClient.tsx
│   │   │   └── dashboard.module.css
│   │   ├── ranked/                 # AI Ranked View
│   │   │   ├── page.tsx
│   │   │   ├── RankedViewClient.tsx
│   │   │   └── ranked.module.css
│   │   ├── rooms/[roomName]/       # Main Live View
│   │   └── page.tsx                # Login page
│   ├── lib/
│   │   ├── Sidebar.tsx             # MODIFIED: Dashboard nav
│   │   ├── convertForLiveKit.ts    # Video conversion
│   │   └── ExternalStreamModal.tsx # Upload modal
│   └── .env.local                  # Frontend config
├── services/
│   ├── analysis-worker/            # AI Video Analysis
│   │   ├── worker.py
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   └── api-gateway/                # WebSocket + REST API
│       ├── src/server.ts
│       ├── package.json
│       └── Dockerfile
├── docker-compose.yml              # Service orchestration
├── livekit.yaml                    # LiveKit config
└── .env                            # Backend config
```

---

## 🎮 **USAGE SCENARIOS**

### **Scenario 1: Upload & Rank Videos**
1. Go to Dashboard
2. Upload 5 different videos
3. Watch AI analyze and rank them
4. See top video featured prominently
5. Understand why each video got its score

### **Scenario 2: Live Streaming Ranking**
1. Multiple people join the room
2. Each person's video is analyzed
3. Real-time leaderboard updates
4. Top participant always visible

### **Scenario 3: Content Testing**
1. Upload different video content
2. See which content scores highest
3. Use AI feedback to improve content
4. Test engagement strategies

---

## ⚙️ **CUSTOMIZATION**

### **Change AI Analysis Frequency:**

Edit `.env` file:
```bash
FRAME_SAMPLE_INTERVAL=5.0  # Analyze every 5 seconds (slower, cheaper)
FRAME_SAMPLE_INTERVAL=1.0  # Analyze every second (faster, more expensive)
```

### **Adjust Video Quality:**

Edit `DashboardClient.tsx`:
```typescript
const stream = await convertForLiveKit(video, {
  targetWidth: 1920,  // Change from 1280
  targetHeight: 1080, // Change from 720
  frameRate: 60       // Change from 30
});
```

### **Change Scoring Criteria:**

Edit `services/analysis-worker/worker.py`:
- Modify `ANALYSIS_PROMPT` variable
- Adjust scoring guidelines
- Change what AI looks for

---

## 🐛 **TROUBLESHOOTING**

### **Videos not uploading:**
- Check file format (use MP4, WebM)
- Check file size (large files take longer)
- Check browser console for errors

### **No AI scores appearing:**
- Verify backend is running: `docker-compose ps`
- Check WebSocket connection (green badge)
- View Analysis Worker logs: `docker-compose logs analysis-worker`

### **Top video not showing:**
- Wait 3-5 seconds for first AI score
- Upload at least one video
- Check that video is playing

### **Performance issues:**
- Reduce number of simultaneous videos
- Lower video resolution
- Increase frame sample interval

---

## 📊 **MONITORING**

### **Check Service Status:**
```bash
docker-compose ps
```

### **View AI Scores:**
```bash
docker-compose logs analysis-worker | grep "Score"
```

### **Monitor Costs:**
- Each video = ~$0.60/hour
- 5 videos = ~$3.00/hour
- Check OpenAI dashboard for usage

---

## 🎯 **NEXT STEPS**

1. ✅ **Dashboard Created** - Upload and rank videos
2. ✅ **AI Integration** - Real-time scoring
3. ✅ **WebSocket Live** - Instant updates
4. ✅ **Sidebar Navigation** - Easy access

### **Potential Enhancements:**
- Add video playback controls (pause, restart)
- Export rankings to CSV
- Historical score tracking
- Advanced filtering/sorting
- Multi-room support
- Custom AI prompts per video

---

## 🚀 **YOU'RE READY TO GO!**

**Access the Dashboard now:**
### http://localhost:3001/dashboard

Upload videos and watch the AI rank them in real-time!

---

**Questions? Issues?**
- Check Docker logs: `docker-compose logs -f`
- Verify services: `docker-compose ps`
- Restart if needed: `docker-compose restart`

**Enjoy your AI-powered video ranking system!** 🎉
