# Network Fix Summary - AI-OBS LiveKit Docker Networking

## Problem Identified
The browser couldn't connect to LiveKit WebSocket at `ws://localhost:7880`, showing:
- "Offline" status in dashboard
- "Could not connect to server" WebSocket errors
- Analysis worker could connect but browser couldn't

## Root Cause
- LiveKit was using `network_mode: host` in docker-compose.yml
- On Docker for Mac, `host` mode binds to the Linux VM network (192.168.65.3), NOT macOS localhost
- Browser on macOS couldn't reach localhost:7880 because ports weren't published

## Changes Made

### 1. docker-compose.yml - LiveKit Service
**Before:**
```yaml
livekit-server:
  network_mode: host
  extra_hosts:
    - "redis:127.0.0.1"
```

**After:**
```yaml
livekit-server:
  ports:
    - "7880:7880"
    - "7881:7881"
  networks:
    - default
  restart: unless-stopped
```

### 2. docker-compose.yml - Analysis Worker
**Before:**
```yaml
environment:
  - LIVEKIT_URL=ws://172.17.0.1:7880
  - LOG_LEVEL=DEBUG
```

**After:**
```yaml
environment:
  - LIVEKIT_URL=ws://livekit-server:7880
  - LOG_LEVEL=INFO
```

### 3. livekit.yaml - Redis Configuration
**Before:**
```yaml
redis:
  address: localhost:6379
```

**After:**
```yaml
redis:
  address: redis:6379
```

### 4. workers/analysis-worker/src/config.py
- Removed excessive network debug logging
- Simplified to clean startup message

## Validation Results
✅ LiveKit HTTP endpoint responds: `curl http://localhost:7880/` → "OK"
✅ Port 7880 listening on macOS: Docker process bound to *:7880
✅ Token API returns correct URL: `"url":"ws://localhost:7880"`
✅ Analysis worker connected: Using service name `livekit-server`
✅ All Docker services running: 6/6 containers up

## Testing Instructions

### 1. Dashboard Test
Open in browser: http://localhost:3002
- Should show "Live" status (green dot) instead of "Offline"
- Should connect to LiveKit without WebSocket errors

### 2. Camera Test
Open in mobile/second browser: http://localhost:3002/camera?id=cam-1
- Should enable camera and show "STREAMING" status
- Dashboard should show camera feed

### 3. Check Logs
```bash
# LiveKit connections
docker-compose logs -f livekit-server

# Analysis worker
docker-compose logs -f analysis-worker

# Browser console (F12)
# Should see: "[Dashboard] ✅ Connected to LiveKit"
```

## Backups Created
- docker-compose.yml.backup-20251024-125842
- livekit.yaml.backup-20251024-125842
- workers/analysis-worker/src/config.py.backup

## Ports Summary
- 3002: ai-obs-v2 Next.js dashboard
- 3000: API Gateway (Docker)
- 3001: Decision Service (Docker)
- 3101: Web OBS (Docker)
- 7880: LiveKit WebSocket/HTTP (NOW ACCESSIBLE!)
- 7881: LiveKit TCP fallback
- 6379: Redis

Generated: 2025-10-24
