# Dashboard Connection Fix - Complete Plan

## Problem Analysis

### Current Status
- ✅ **Camera (CAM-1):** LIVE and streaming successfully
- ❌ **Dashboard:** Offline - Cannot connect to LiveKit

### Error Details
```
WebSocket connection to 'ws://localhost:7880/rtc?access_token=...' failed
Status: 401 (Unauthorized)
```

### Root Cause
The dashboard (`web-obs`) is configured to connect to **local LiveKit server** (`ws://localhost:7880`) but:
1. The token is signed for **LiveKit Cloud** (issuer: `API4DQvo9UNTZtR`)
2. The local LiveKit server doesn't recognize Cloud tokens
3. Camera connects to Cloud successfully, but dashboard doesn't

---

## Complete System Pipeline

### Current Flow (Broken)

```
┌─────────────────────────────────────────────────────────────┐
│                         CAMERA                               │
└─────────────────────────────────────────────────────────────┘
                             ↓
    1. Request token from API Gateway
                             ↓
    POST http://localhost:3000/token
    Body: { identity: "cam-1", room: "main", role: "camera" }
                             ↓
    Response: {
      token: "eyJhbGci..." (signed with Cloud API secret),
      url: "wss://buildathon-bo96a3yr.livekit.cloud"
    }
                             ↓
    2. Connect to LiveKit Cloud ✅
                             ↓
    ┌─────────────────────────────────────────┐
    │   LiveKit Cloud (buildathon-...)       │
    │   - Validates token ✅                  │
    │   - Accepts connection ✅               │
    │   - Receives video stream ✅            │
    └─────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                        DASHBOARD                             │
└─────────────────────────────────────────────────────────────┘
                             ↓
    1. Request token from API Gateway
                             ↓
    POST http://localhost:3000/token
    Body: { identity: "viewer-...", room: "main", role: "viewer" }
                             ↓
    Response: {
      token: "eyJhbGci..." (signed with Cloud API secret),
      url: "wss://buildathon-bo96a3yr.livekit.cloud"
    }
                             ↓
    2. IGNORES the URL in response! ❌
       Uses hardcoded: NEXT_PUBLIC_LIVEKIT_URL=ws://10.237.213.101:7880
                             ↓
    3. Tries to connect to LOCAL server ❌
                             ↓
    ┌─────────────────────────────────────────┐
    │   Local LiveKit Server (port 7880)      │
    │   - Receives Cloud token ❌              │
    │   - Token issuer doesn't match ❌       │
    │   - Returns 401 Unauthorized ❌          │
    └─────────────────────────────────────────┘
                             ↓
                    CONNECTION FAILS ❌
```

### Target Flow (Fixed)

```
┌─────────────────────────────────────────────────────────────┐
│                         CAMERA                               │
└─────────────────────────────────────────────────────────────┘
                             ↓
    Same as above (already working) ✅
                             ↓
    ┌─────────────────────────────────────────┐
    │   LiveKit Cloud (buildathon-...)       │
    │   - Video streaming ✅                  │
    └─────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                        DASHBOARD                             │
└─────────────────────────────────────────────────────────────┘
                             ↓
    1. Request token from API Gateway
                             ↓
    Response: {
      token: "eyJhbGci..." (signed with Cloud API secret),
      url: "wss://buildathon-bo96a3yr.livekit.cloud"
    }
                             ↓
    2. Uses NEXT_PUBLIC_LIVEKIT_URL=wss://buildathon-bo96a3yr.livekit.cloud ✅
                             ↓
    3. Connects to LiveKit Cloud ✅
                             ↓
    ┌─────────────────────────────────────────┐
    │   LiveKit Cloud (buildathon-...)       │
    │   - Validates token ✅                  │
    │   - Accepts connection ✅               │
    │   - Sends video from camera ✅          │
    └─────────────────────────────────────────┘
                             ↓
              DASHBOARD SHOWS LIVE VIDEO ✅
```

---

## Detailed Implementation Plan

### Phase 1: Identify Configuration Files

**Files to Check:**
1. `docker-compose.yml` - Service environment variables
2. `web-obs/.env.local` - Next.js local environment (if exists)
3. `web-obs/.env` - Next.js environment template (if exists)
4. `web-obs/Dockerfile` - Build-time environment

**What We're Looking For:**
- `NEXT_PUBLIC_LIVEKIT_URL` - Must be Cloud URL, not local
- `NEXT_PUBLIC_API_URL` - Should point to API Gateway

### Phase 2: Update Environment Variables

**Change Required:**
```bash
# BEFORE (Wrong - points to local)
NEXT_PUBLIC_LIVEKIT_URL=ws://10.237.213.101:7880

# AFTER (Correct - points to Cloud)
NEXT_PUBLIC_LIVEKIT_URL=wss://buildathon-bo96a3yr.livekit.cloud
```

**Files to Update:**
1. `docker-compose.yml` (line 89-91)
2. Any `.env` files in `web-obs/` directory

### Phase 3: Rebuild and Restart

**Why Rebuild is Needed:**
- Next.js bakes environment variables into the build at compile time
- `NEXT_PUBLIC_*` variables are embedded in JavaScript bundles
- Changing env vars requires rebuild to take effect

**Steps:**
1. Stop web-obs container
2. Rebuild with new environment
3. Start container
4. Verify environment variables inside container

### Phase 4: Verification

**What to Check:**
1. Dashboard loads without errors
2. WebSocket connects to LiveKit Cloud (not localhost)
3. Dashboard shows "Online" status
4. Video from camera appears on dashboard
5. AI ranking updates appear

---

## Step-by-Step Implementation

### Step 1: Check Current Configuration

**Command:**
```bash
# Check docker-compose.yml
grep -A 5 "web-obs:" docker-compose.yml

# Check for .env files in web-obs
ls -la web-obs/.env*

# Check current environment in container
docker exec ai-obs-web-obs-1 env | grep NEXT_PUBLIC
```

### Step 2: Update docker-compose.yml

**Location:** `/Users/nadavshanun/Downloads/AI-OBS/docker-compose.yml`

**Find:**
```yaml
web-obs:
  build:
    context: .
    dockerfile: web-obs/Dockerfile
  environment:
    - NEXT_PUBLIC_API_URL=http://10.237.213.101:3000
    - NEXT_PUBLIC_LIVEKIT_URL=ws://10.237.213.101:7880  # ← WRONG
```

**Replace With:**
```yaml
web-obs:
  build:
    context: .
    dockerfile: web-obs/Dockerfile
  environment:
    - NEXT_PUBLIC_API_URL=http://localhost:3000
    - NEXT_PUBLIC_LIVEKIT_URL=wss://buildathon-bo96a3yr.livekit.cloud  # ← CORRECT
```

### Step 3: Check for .env.local

**Command:**
```bash
cat web-obs/.env.local 2>/dev/null || echo "No .env.local file"
```

**If exists, update:**
```bash
NEXT_PUBLIC_LIVEKIT_URL=wss://buildathon-bo96a3yr.livekit.cloud
```

### Step 4: Rebuild web-obs

**Command:**
```bash
# Export environment variables
export LIVEKIT_URL="wss://buildathon-bo96a3yr.livekit.cloud"
export LIVEKIT_API_KEY="API4DQvo9UNTZtR"
export LIVEKIT_API_SECRET="XbBzd81iuyFfz6iQWeWlHpYSz4weK6S2kdaUGeSkdQCD"
export OPENAI_API_KEY="sk-proj-..."
export OPENAI_MODEL="gpt-4o-mini"
export FRAME_SAMPLE_INTERVAL="3.0"

# Rebuild web-obs
docker-compose build web-obs

# Restart web-obs
docker-compose up -d web-obs
```

### Step 5: Verify Environment

**Command:**
```bash
# Wait for container to start
sleep 5

# Check environment variables
docker exec ai-obs-web-obs-1 env | grep NEXT_PUBLIC

# Expected output:
# NEXT_PUBLIC_LIVEKIT_URL=wss://buildathon-bo96a3yr.livekit.cloud
```

### Step 6: Test Dashboard

**Steps:**
1. Open http://localhost:3101
2. Check browser console (F12)
3. Look for WebSocket connection
4. Should connect to `wss://buildathon-bo96a3yr.livekit.cloud`
5. Dashboard should show "Online" status
6. Video from camera should appear

---

## Troubleshooting Guide

### Issue 1: Still Connecting to localhost:7880

**Cause:** Environment variable not updated in container

**Solution:**
```bash
# Force rebuild without cache
docker-compose build --no-cache web-obs
docker-compose up -d web-obs
```

### Issue 2: Dashboard Shows "Offline"

**Check:**
```bash
# View dashboard logs
docker-compose logs web-obs --tail=50

# Look for errors like:
# - "Connection refused"
# - "401 Unauthorized"
# - "WebSocket failed"
```

### Issue 3: 401 Unauthorized (Still)

**Cause:** Token issuer mismatch

**Verify:**
```bash
# Check token issuer
curl -X POST http://localhost:3000/token \
  -H "Content-Type: application/json" \
  -d '{"identity":"test-viewer","room":"main","role":"viewer"}' \
  | jq -r '.data.token' \
  | cut -d'.' -f2 \
  | base64 -d 2>/dev/null \
  | jq .iss

# Should output: "API4DQvo9UNTZtR"
```

---

## Complete Connection Pipeline

### 1. Camera Connection (Already Working ✅)

```
Camera Browser
    ↓
1. Open: https://patriotic-untimidly-miya.ngrok-free.dev/camera?id=cam-1
    ↓
2. Load camera.html
    ↓
3. Request token:
   POST http://localhost:3000/token
   Body: { identity: "cam-1", room: "main", role: "camera" }
    ↓
4. Receive token:
   {
     token: "eyJhbGci..." (iss: API4DQvo9UNTZtR),
     url: "wss://buildathon-bo96a3yr.livekit.cloud"
   }
    ↓
5. Connect to LiveKit Cloud:
   new Room().connect(url, token)
    ↓
6. Publish video track:
   room.localParticipant.publishTrack(videoTrack)
    ↓
7. LiveKit Cloud validates token ✅
    ↓
8. Video streaming to Cloud ✅
```

### 2. Dashboard Connection (To Be Fixed)

```
Dashboard Browser
    ↓
1. Open: http://localhost:3101
    ↓
2. Load Next.js app
    ↓
3. Read environment:
   NEXT_PUBLIC_LIVEKIT_URL = "wss://buildathon-bo96a3yr.livekit.cloud"
    ↓
4. Request token:
   POST http://localhost:3000/token
   Body: { identity: "viewer-...", room: "main", role: "viewer" }
    ↓
5. Receive token:
   {
     token: "eyJhbGci..." (iss: API4DQvo9UNTZtR),
     url: "wss://buildathon-bo96a3yr.livekit.cloud"
   }
    ↓
6. Connect to LiveKit Cloud (using env var):
   new Room().connect(NEXT_PUBLIC_LIVEKIT_URL, token)
    ↓
7. LiveKit Cloud validates token ✅
    ↓
8. Subscribe to camera tracks ✅
    ↓
9. Receive video from camera ✅
    ↓
10. Display on dashboard ✅
```

### 3. AI Analysis Pipeline (Should Work After Fix)

```
Analysis Worker
    ↓
1. Connect to LiveKit Cloud as hidden participant
    ↓
2. Subscribe to all camera tracks
    ↓
3. Every 3 seconds:
   - Capture frame from each camera
   - Send to OpenAI Vision API
   - Receive score + reasoning
    ↓
4. Publish scores to Redis pub/sub
    ↓
Decision Service
    ↓
5. Subscribe to Redis scores
    ↓
6. Calculate rankings (highest score = 🥇)
    ↓
7. Publish to Redis pub/sub
    ↓
Dashboard
    ↓
8. Subscribe to Redis rankings
    ↓
9. Update UI with medals 🥇🥈🥉
    ↓
10. Display AI reasoning
```

---

## Expected Results After Fix

### Dashboard Browser Console
```javascript
// BEFORE (Wrong)
WebSocket connection to 'ws://localhost:7880/rtc?access_token=...' failed
Status: 401 (Unauthorized)

// AFTER (Correct)
Connected to room: main
Participant connected: cam-1
Track subscribed: video track from cam-1
Dashboard: Online ✅
```

### Dashboard UI
```
┌────────────────────────────────────────┐
│  🟢 Online                              │
│                                        │
│  Room: main                            │
│                                        │
│  ┌────────────────────────────────┐   │
│  │  🥇 CAM-1  (Score: 95)          │   │
│  │  [Video Feed]                   │   │
│  │  Reasoning: Clear view of person│   │
│  └────────────────────────────────┘   │
│                                        │
│  Activity Feed:                        │
│  • CAM-1 connected                    │
│  • AI analysis started                │
│  • CAM-1 ranked #1                    │
└────────────────────────────────────────┘
```

---

## Files That Will Be Modified

1. **docker-compose.yml**
   - Line 89-91: Update NEXT_PUBLIC_LIVEKIT_URL

2. **web-obs/.env.local** (if exists)
   - Update NEXT_PUBLIC_LIVEKIT_URL

3. **web-obs container** (rebuild required)
   - New environment baked into build

---

## Success Criteria

✅ Dashboard shows "Online" status (green dot)
✅ No 401 errors in browser console
✅ WebSocket connects to `wss://buildathon-bo96a3yr.livekit.cloud`
✅ Video from CAM-1 appears on dashboard
✅ AI ranking scores appear (🥇🥈🥉)
✅ Activity feed shows "CAM-1 connected"

---

## Timeline

**Estimated Time:** 5-10 minutes

1. Update docker-compose.yml (1 min)
2. Rebuild web-obs (2-3 min)
3. Restart container (30 sec)
4. Test dashboard (1 min)
5. Verify complete pipeline (2 min)

---

## Next Steps After Fix

Once dashboard is online:

1. **Test Multiple Cameras**
   - Open cam-2, cam-3 on different devices
   - Verify all appear on dashboard
   - Check AI ranking updates

2. **Test AI Ranking**
   - Move around in frame
   - Change lighting
   - Verify scores update every 3 seconds

3. **Test Camera Switching**
   - Decision service should switch to highest-ranked camera
   - Dashboard should highlight active camera

4. **Monitor Performance**
   - Check CPU usage
   - Check network bandwidth
   - Verify no dropped frames

---

## Summary

**Problem:** Dashboard configured for local LiveKit, but system uses LiveKit Cloud

**Solution:** Update `NEXT_PUBLIC_LIVEKIT_URL` to Cloud URL in docker-compose.yml

**Impact:** Dashboard will connect to same LiveKit Cloud instance as camera

**Result:** Complete pipeline working: Camera → Cloud → Dashboard → AI → Rankings

**Risk:** Low - Only changing environment variable, no code changes

**Rollback:** Revert docker-compose.yml change if needed
