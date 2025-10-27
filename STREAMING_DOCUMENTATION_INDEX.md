# Cloud Observability System - Streaming Architecture Documentation Index

This directory contains comprehensive documentation on the video streaming architecture, camera connections, and AI analysis pipeline.

## Document Guide

### For Quick Understanding (Start Here)
**File**: `STREAMING_QUICK_REFERENCE.md`
- **Purpose**: Quick lookup and diagnosis guide
- **Best for**: Troubleshooting, finding specific information, port checking
- **Sections**:
  - Technology stack table
  - Critical connection diagrams (Camera → Browser → Analysis)
  - File structure with line numbers
  - Hardcoded values and how to fix them
  - Known issues summary (all 6 issues in one table)
  - Quick diagnosis guide (symptoms → solution)
  - Port checklist
  - Stream health monitoring commands

### For Complete Understanding (Detailed Reference)
**File**: `STREAMING_ARCHITECTURE_REPORT.md`
- **Purpose**: Comprehensive technical documentation
- **Best for**: Understanding the full system, implementation details, performance tuning
- **Sections**:
  1. **Current Streaming Architecture** - High-level data flow and camera configuration
  2. **Streaming Technology Stack** - go2rtc, WebRTC, LiveKit, Redis details
  3. **Key File Locations** - All components with file paths and line numbers
  4. **Identified Issues & Workarounds** - 6 issues with root causes and fixes
  5. **Video Streaming Pipeline Details** - Frame sampling, score distribution, YOLO
  6. **Configuration Summary** - Environment variables and port mappings
  7. **Architecture Strengths & Weaknesses** - Design decisions and tradeoffs
  8. **Recommendations** - Immediate, medium-term, and long-term improvements

### For System Overview (Architecture Context)
**File**: `ARCHITECTURE_SUMMARY.md` (Pre-existing)
- **Best for**: Understanding the three views (Live, Ranked, YOLO) and menu structure
- **Contains**: Integration points, system data flow diagram, scoring logic

### For Detailed Codebase Map
**File**: `CODEBASE_ARCHITECTURE_MAP.md` (Pre-existing)
- **Best for**: Finding specific code implementations and detailed function documentation
- **Contains**: Complete file tree, function signatures, implementation details

## Quick Navigation by Task

### "I need to fix black screens on camera feeds"
1. Read: `STREAMING_QUICK_REFERENCE.md` → "Symptom: Black screen on camera feeds"
2. Key issue: RTSP disabled on cameras (needs manual enable)
3. Full details: `STREAMING_ARCHITECTURE_REPORT.md` → Section 4.1

### "I need to understand the camera connection flow"
1. Read: `STREAMING_QUICK_REFERENCE.md` → "Critical Connection Points"
2. Component details: `STREAMING_ARCHITECTURE_REPORT.md` → Section 2.2 (CameraAutoConnect)
3. Code: `/frontend/lib/CameraAutoConnect.tsx` lines 21-164

### "I need to fix AI scoring (0 ranked)"
1. Read: `STREAMING_QUICK_REFERENCE.md` → "Symptom: 0 ranked - no AI scores"
2. Root cause: Room name mismatch
3. Full details: `STREAMING_ARCHITECTURE_REPORT.md` → Section 4.2
4. Fix: Use URL `/rooms/geome-hackathon` (hardcoded) or fix the code

### "I need to deploy to Docker/cloud"
1. Critical issue: `STREAMING_QUICK_REFERENCE.md` → "Issue #1: go2rtc URL Hardcoded"
2. Other issues: `STREAMING_ARCHITECTURE_REPORT.md` → Sections 4.3-4.6
3. Environment setup: `STREAMING_QUICK_REFERENCE.md` → "Environment Variables Reference"

### "I need to understand performance"
1. Metrics: `STREAMING_QUICK_REFERENCE.md` → "Performance Metrics"
2. Details: `STREAMING_ARCHITECTURE_REPORT.md` → Section 5 "Video Streaming Pipeline Details"
3. Latency breakdown: AI Analysis (2-5s) vs YOLO Detection (40-60ms)

### "I need to monitor stream health"
1. Commands: `STREAMING_QUICK_REFERENCE.md` → "Stream Health Monitoring"
2. Diagnosis: `STREAMING_QUICK_REFERENCE.md` → "Quick Diagnosis Guide"
3. Port checks: `STREAMING_QUICK_REFERENCE.md` → "Port Checklist"

## File Location Summary

### Configuration Files (What to Configure)
```
go2rtc.yaml          ← Camera definitions (6 cameras, RTSP URLs)
docker-compose.yml   ← Service orchestration (ports, networks)
livekit.yaml         ← LiveKit server config (ports, Redis)
.env                 ← API keys and room name (HARDCODED ISSUE)
```

### Frontend (How video flows to browser)
```
/frontend/lib/
├── CameraAutoConnect.tsx       ← CRITICAL: Browser → go2rtc WebRTC
├── ExternalStreamModal.tsx     ← Manual camera addition
├── LiveVideoConference.tsx     ← Grid view with AI rank badges
├── YOLOView.tsx                ← Object detection view
└── yolo/
    └── YOLOService.ts          ← YOLO inference engine
```

### Backend (How analysis works)
```
/services/
├── analysis-worker/worker.py   ← Frame sampling + OpenAI API calls
└── api-gateway/src/server.ts   ← WebSocket score broadcast
```

## The 6 Key Issues (All Listed Here)

| # | Issue | Severity | File | Line | Status | Impact |
|---|-------|----------|------|------|--------|--------|
| 1 | RTSP disabled on cameras | CRITICAL | go2rtc.yaml | 4-46 | NOT FIXED | Black screens |
| 2 | Room name hardcoded | CRITICAL | worker.py | 42 | NOT FIXED | No AI scores |
| 3 | go2rtc URL hardcoded | MODERATE | CameraAutoConnect.tsx | 34 | NOT FIXED | Docker fails |
| 4 | No reconnection logic | MODERATE | CameraAutoConnect.tsx | 125 | NOT FIXED | Manual refresh |
| 5 | Color space overhead | MODERATE | convertForLiveKit.ts | 343-434 | MITIGATED | High CPU |
| 6 | AI error handling | MINOR | worker.py | 150-155 | MITIGATED | Bad rankings |

## Key Metrics Reference

### Costs & Performance
- **AI Analysis**: $25/hour for 6 continuous cameras
- **YOLO Detection**: 15-20% CPU for 6 cameras
- **Latency**: 2.5-5.2 seconds end-to-end (analysis) vs 100ms (YOLO)
- **Model Size**: 4.3 MB (YOLO11n_256 in browser)

### Configuration Values
- **Frame Sampling**: Every 3.0 seconds (configurable)
- **YOLO FPS**: 10 FPS per video (100ms interval)
- **WebRTC Offer Timeout**: 30 seconds before camera goes black
- **Room Empty Timeout**: 5 minutes (livekit.yaml)

## Technology Stack (One-liner Reference)

**Video Path**: 
Reolink RTSP → go2rtc (1984) → Browser WebSocket → RTCPeerConnection → MediaStream → LiveKit (7880) → All Clients

**Analysis Path**: 
Video Track → Python Worker → OpenAI API → Score (0-1.0) → Redis → API Gateway (3000) → WebSocket broadcast → Frontend

**Detection Path**: 
Video Element → YOLO11n ONNX Runtime → Detections array → Canvas overlay

## How to Use These Documents

1. **Troubleshooting**: Start with Quick Reference, then dive into Architecture Report
2. **Implementation**: Use Architecture Report Section 3 to find files, then read the code
3. **Deployment**: Read Section 4 issues in Architecture Report, prioritize fixes
4. **Performance Tuning**: Reference the metrics in both documents
5. **Feature Development**: Use Codebase Architecture Map to understand component interfaces

## Important Notes

- These documents are based on code analysis as of October 26, 2025
- All file paths are absolute: `/Users/nadavshanun/Downloads/cloud-obs-main/...`
- Line numbers refer to the specific files mentioned
- Room name `geome-hackathon` is CRITICAL - used in multiple places
- RTSP must be manually enabled on each camera before deployment
- The system is NOT production-ready due to hardcoded values

## Related Documentation

- **COMPLETE_DIAGNOSIS_AND_FIXES.md** - Original issue diagnosis (pre-existing)
- **ARCHITECTURE_SUMMARY.md** - High-level system overview (pre-existing)
- **CODEBASE_ARCHITECTURE_MAP.md** - Detailed code map (pre-existing)

---

**Documentation Created**: October 26, 2025
**Status**: Comprehensive analysis complete
**Next Action**: Implement fixes from Section 8 of STREAMING_ARCHITECTURE_REPORT.md
