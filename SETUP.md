# Cloud OBS - Setup Guide

Complete setup guide for the AI-powered video ranking system.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Docker Desktop** (version 20.10+)
  - Download: https://www.docker.com/products/docker-desktop
  - Start Docker Desktop before running the system

- **Node.js** (version 18+)
  - Download: https://nodejs.org/
  - Check version: `node --version`

- **OpenAI API Key**
  - Sign up at: https://platform.openai.com/
  - Create API key from: https://platform.openai.com/api-keys
  - Ensure you have credits ($5+ recommended for testing)

## Quick Start (5 minutes)

### 1. Verify Prerequisites

```bash
# Check Docker
docker --version
docker info

# Check Node.js
node --version
npm --version
```

### 2. Start the System

```bash
# Make scripts executable
chmod +x start.sh stop.sh logs.sh

# Start everything
./start.sh
```

This will:
- Start Redis, LiveKit, API Gateway, and Analysis Worker
- Install frontend dependencies (first time only)
- Start the Next.js frontend

### 3. Access the System

Open your browser to:
- **Main App**: http://localhost:3000
- **Ranked View**: http://localhost:3000/ranked

Password: `goodvibesonly`

### 4. Test the AI Ranking

1. Click "View" tab in sidebar (or go to /ranked)
2. Enter your name and click "Join Ranked View"
3. Allow camera access when prompted
4. Wait 3-5 seconds for the first AI score
5. Open another browser window (incognito) and join with a different name
6. See both participants ranked in real-time!

## System Architecture

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Frontend   │─────▶│ API Gateway  │─────▶│   LiveKit    │
│   (Next.js)  │◀─────│  (Node.js)   │◀─────│    Server    │
│              │ WS   │              │      │              │
└──────────────┘      └──────────────┘      └──────────────┘
                             │                      │
                             ▼                      ▼
                      ┌──────────────┐      ┌──────────────┐
                      │    Redis     │◀─────│   Analysis   │
                      │   Pub/Sub    │      │    Worker    │
                      │              │      │  (Python AI) │
                      └──────────────┘      └──────────────┘
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 (Next.js) | User interface |
| API Gateway | 3000 (backend) | REST API + WebSocket |
| LiveKit | 7880 | WebRTC video server |
| Redis | 6379 | Message queue |
| Analysis Worker | - | AI video scoring |

## Configuration

### Environment Variables

The `.env` file has been created with your OpenAI API key. You can modify:

```bash
# Adjust frame analysis interval (seconds)
FRAME_SAMPLE_INTERVAL=3.0  # More frequent = more expensive

# Change OpenAI model (if needed)
OPENAI_MODEL=gpt-4o-mini  # Cheapest and fastest

# LiveKit credentials
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
```

### Cost Optimization

Current settings:
- **Frame interval**: 3 seconds (20 frames/min)
- **Resolution**: 640x480
- **Model**: gpt-4o-mini ($0.00015/image)
- **Cost**: ~$0.60/hour per stream

To reduce costs:
```bash
# Edit .env
FRAME_SAMPLE_INTERVAL=5.0  # Analyze every 5 seconds
```

| Interval | Cost/hour (per stream) |
|----------|------------------------|
| 1 sec | $1.80 |
| 3 sec | $0.60 (default) |
| 5 sec | $0.36 |
| 10 sec | $0.18 |

## Management Commands

### View Logs

```bash
./logs.sh
```

Options:
1. All services
2. API Gateway
3. Analysis Worker (AI scores)
4. LiveKit Server
5. Redis
6. System health check

### Stop Services

```bash
./stop.sh
```

Stops all Docker services and the frontend.

### Restart Services

```bash
./stop.sh && ./start.sh
```

## Troubleshooting

### Issue: Services won't start

```bash
# Check Docker is running
docker info

# Check ports are available
lsof -i :3000
lsof -i :7880

# Restart Docker Desktop
```

### Issue: "Failed to join" error

```bash
# Check API Gateway
curl http://localhost:3000/health

# View logs
docker-compose logs api-gateway

# Restart services
docker-compose restart api-gateway
```

### Issue: No AI scores appearing

```bash
# Check Analysis Worker logs
docker-compose logs analysis-worker

# Look for OpenAI API errors
docker-compose logs analysis-worker | grep -i error

# Verify API key in .env
cat .env | grep OPENAI_API_KEY
```

### Issue: Video not showing

1. **Camera permissions**: Allow camera access in browser
2. **HTTPS requirement**: Some browsers require HTTPS for camera
   - Try: http://localhost:3000 (should work)
   - Or use Chrome/Firefox (more permissive for localhost)
3. **LiveKit connection**: Check browser console for WebRTC errors

### Issue: WebSocket not connecting

```bash
# Test WebSocket endpoint
npm install -g wscat
wscat -c ws://localhost:3000/ws

# Should connect and receive score updates
```

## Development

### Backend Development

```bash
# Analysis Worker (Python)
cd services/analysis-worker
pip install -r requirements.txt
python worker.py

# API Gateway (TypeScript)
cd services/api-gateway
npm install
npm run dev
```

### Frontend Development

```bash
cd frontend
npm run dev
```

### View Real-time Scores

```bash
# Subscribe to Redis pub/sub
docker exec -it cloud-obs-redis redis-cli
> SUBSCRIBE scores.stream
```

You'll see JSON messages like:
```json
{
  "type": "score",
  "payload": {
    "cam_id": "user123",
    "score": 0.75,
    "reason": "Two people in animated discussion"
  }
}
```

## Testing AI Scoring

### Understanding Scores

| Score | Level | Description |
|-------|-------|-------------|
| 0.9-1.0 | 🔥 Exceptional | Multiple people, dynamic action |
| 0.8-0.9 | ⭐ High | Speaking, gesturing, emotions |
| 0.6-0.8 | ✅ Good | People visible, some movement |
| 0.4-0.6 | 😐 Moderate | Static, low energy |
| 0.2-0.4 | 📉 Low | Minimal activity |
| 0.0-0.2 | 💤 None | Empty or static scene |

### Tips for Higher Scores

1. **Multiple people**: Have 2-3 people visible
2. **Movement**: Gesture while talking
3. **Engagement**: Make eye contact with camera
4. **Good lighting**: Well-lit face
5. **Clear framing**: Center yourself in frame

### Test Scenarios

Try these to see different scores:

1. **Empty room** (score: 0.0-0.2)
   - Cover camera or show blank wall

2. **Single person static** (score: 0.3-0.5)
   - Sit still, no movement

3. **Single person talking** (score: 0.6-0.8)
   - Talk to camera, gesture

4. **Multiple people discussing** (score: 0.8-1.0)
   - Have 2-3 people talking and gesturing

## Production Deployment

### Security Checklist

Before deploying to production:

- [ ] Change `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`
- [ ] Use environment variables for all secrets
- [ ] Enable HTTPS/TLS on all services
- [ ] Set up firewall rules (allow only necessary ports)
- [ ] Enable rate limiting on API Gateway
- [ ] Monitor OpenAI API costs
- [ ] Set up logging and monitoring
- [ ] Use strong password instead of "goodvibesonly"

### Recommended Changes

```bash
# .env (production)
LIVEKIT_API_KEY=<strong-random-key>
LIVEKIT_API_SECRET=<strong-random-secret>
OPENAI_API_KEY=<your-key>
NODE_ENV=production
LOG_LEVEL=warn  # Reduce logging
```

### Scaling

For high traffic:

1. **Use Redis Cluster** for better throughput
2. **Deploy multiple Analysis Workers** (one per LiveKit room)
3. **Use CDN** for frontend static assets
4. **Enable caching** on /rankings endpoint
5. **Load balance** API Gateway instances

## Support

### Logs Location

- Frontend: Terminal where `start.sh` was run
- Backend: `docker-compose logs <service>`
- Analysis Worker: `docker-compose logs analysis-worker`

### Common Log Messages

```bash
# Good signs
✅ Connected to Redis
✅ Connected to room: geome-hackathon
📊 Score update: 0.85

# Issues to investigate
❌ OpenAI API error: Rate limit exceeded
❌ Failed to connect to LiveKit
❌ Redis connection refused
```

### Get Help

1. Check logs: `./logs.sh`
2. Verify health: Select option 6 in logs menu
3. Review this guide
4. Check Docker Desktop is running
5. Verify OpenAI API key has credits

## Next Steps

Once everything is working:

1. **Customize scoring**: Edit `worker.py` to adjust AI scoring criteria
2. **Add features**: Extend frontend with more views
3. **Monitor costs**: Track OpenAI usage in dashboard
4. **Deploy**: Move to production server with HTTPS
5. **Scale**: Add more workers for multiple rooms

Enjoy your AI-powered video ranking system! 🚀
