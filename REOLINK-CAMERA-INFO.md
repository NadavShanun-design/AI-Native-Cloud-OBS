# Reolink RLC-820A Camera Information & Configuration Guide

## Camera Model: Reolink RLC-820A
**Type**: 4K (8MP) PoE IP Camera
**Codec**: H.265/H.264 (Main stream uses H.265 for 4K)
**Resolution**: 3840x2160 (4K)
**Connection**: RTSP Protocol via Port 554

---

## Your Camera Network Configuration

### Camera Inventory
| Camera ID | IP Address | Username | Password | Location |
|-----------|------------|----------|----------|----------|
| Camera 1 | 10.39.12.110 | admin | Password03! | - |
| Camera 2 | 10.39.12.107 | admin | Password03! | - |
| Camera 3 | 10.39.12.104 | admin | Password03! | - |
| Camera 4 | 10.39.12.106 | admin | zSQ6e9MB&03! | - |
| Camera 5 | 10.39.12.109 | admin | zSQ6e9MB&03! | - |
| Camera 6 | 10.39.12.108 | admin | zSQ6e9MB&03! | - |

**Network**: All cameras on 10.39.12.0/24 subnet
**RTSP Port**: 554 (default)

---

## RTSP Stream URL Formats

### Critical: RLC-820A Uses H.265 for Main Stream!

**Main Stream (4K - H.265):**
```
rtsp://admin:password@ip_address:554/h265Preview_01_main
```

**Sub Stream (720p - H.264):**
```
rtsp://admin:password@ip_address:554/h264Preview_01_sub
```

### Example URLs for Your Cameras

**Camera 1 (10.39.12.110):**
- Main: `rtsp://admin:Password03!@10.39.12.110:554/h265Preview_01_main`
- Sub: `rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_sub`

**Camera 4 (10.39.12.106):**
- Main: `rtsp://admin:zSQ6e9MB&03!@10.39.12.106:554/h265Preview_01_main`
- Sub: `rtsp://admin:zSQ6e9MB&03!@10.39.12.106:554/h264Preview_01_sub`

**Important**: The `&` character in passwords must be URL-encoded as `%26` in configuration files!

---

## RTSP Protocol Details

### How RTSP Works
1. **Protocol**: Real-Time Streaming Protocol
2. **Transport**: TCP connection on port 554
3. **Authentication**: Basic Auth (username:password in URL)
4. **Streaming**: RTP/RTCP for actual video data
5. **Codec Support**: H.264, H.265 (HEVC)

### Stream Quality Comparison
| Stream Type | Resolution | Bitrate | Codec | Use Case |
|-------------|-----------|---------|-------|----------|
| Main Stream | 3840x2160 (4K) | ~8-16 Mbps | H.265 | High quality, recording |
| Sub Stream | 896x512 (720p) | ~512-1024 Kbps | H.264 | Live viewing, low bandwidth |

---

## Camera Setup Requirements

### IMPORTANT: Enable RTSP First!
Before RTSP will work, you MUST enable it in camera settings:

1. Access camera web interface: `http://10.39.12.110` (use camera IP)
2. Login with admin credentials
3. Navigate to: **Settings → Network → Advanced → Port**
4. **Enable RTSP**
5. Verify RTSP Port is set to **554**
6. Save settings

**After factory reset**, cameras boot with RTSP and RTMP disabled by default!

### Firmware Recommendations
- Minimum: v3.1.0.956_22041503 (April 2022)
- Latest firmware improves RTSP server stability
- Update via Reolink app or web interface

---

## Connection Methods

### Method 1: VLC Media Player (Testing)
```bash
vlc rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_sub
```

### Method 2: FFmpeg (Conversion)
```bash
ffmpeg -rtsp_transport tcp -i "rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_sub" \
  -c:v copy -f rtsp rtsp://destination
```

### Method 3: go2rtc (RTSP to WebRTC Proxy)
```yaml
streams:
  camera_1:
    - rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_sub
  camera_1_hd:
    - rtsp://admin:Password03!@10.39.12.110:554/h265Preview_01_main
```

---

## Troubleshooting

### Common Issues

#### 1. "Connection Timeout"
- **Cause**: RTSP not enabled in camera settings
- **Fix**: Enable RTSP via camera web interface (see above)
- **Verify**: `curl -I http://10.39.12.110` (check camera is reachable)

#### 2. "Authentication Failed"
- **Cause**: Incorrect username/password
- **Fix**: Verify credentials via web login first
- **Note**: Special characters may need URL encoding

#### 3. "Stream Not Found"
- **Cause**: Wrong URL path (h264 vs h265)
- **Fix**: Use `h265Preview_01_main` for 4K stream
- **Fix**: Use `h264Preview_01_sub` for sub stream

#### 4. "No Video Data"
- **Cause**: Firewall blocking port 554
- **Fix**: Check network routing between server and cameras
- **Test**: `telnet 10.39.12.110 554`

#### 5. "WebSocket Connection Failed" (go2rtc)
- **Cause**: go2rtc can't reach camera RTSP stream
- **Fix**: Check go2rtc logs: `docker logs cloud-obs-go2rtc`
- **Verify**: Test direct RTSP access first with VLC

### Diagnostic Commands

**Ping camera:**
```bash
ping 10.39.12.110
```

**Test RTSP port:**
```bash
telnet 10.39.12.110 554
# Or
nc -zv 10.39.12.110 554
```

**Test RTSP stream with curl:**
```bash
curl -v "rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_sub"
```

**View go2rtc streams:**
```bash
curl http://localhost:1984/api/streams
```

---

## Network Requirements

### Bandwidth Calculation (6 Cameras)
- **Sub Streams (720p)**: 6 × 1 Mbps = 6 Mbps
- **Main Streams (4K)**: 6 × 12 Mbps = 72 Mbps
- **Recommended**: Use sub streams for live viewing, main streams for recording

### Port Requirements
- **RTSP**: 554 (TCP/UDP) - Camera to go2rtc
- **HTTP**: 80 (TCP) - Camera web interface
- **ONVIF**: 8000 (TCP) - Device discovery (optional)

### Network Topology
```
Reolink Cameras (10.39.12.104-110)
    ↓ RTSP (port 554)
go2rtc Container (Docker)
    ↓ WebRTC (port 1984)
Browser (Frontend)
    ↓ LiveKit WebRTC
LiveKit Room
    ↓ Video Tracks
AI Analysis Worker
```

---

## Security Best Practices

1. **Change Default Passwords**: ✅ Already done (Password03!, zSQ6e9MB&03!)
2. **Use Sub Streams**: Reduces bandwidth and resource usage
3. **Limit Network Access**: Cameras on isolated VLAN (if possible)
4. **Update Firmware**: Keep cameras updated for security patches
5. **Strong Passwords**: Use complex passwords (already implemented)
6. **Disable Unused Services**: Turn off UPnP, P2P if not needed

---

## Integration with Cloud Observability System

### Current Setup
Your system uses **go2rtc** as a bridge:
1. go2rtc connects to cameras via RTSP
2. go2rtc converts RTSP to WebRTC
3. Browser connects to go2rtc via WebSocket
4. Video published to LiveKit room
5. AI worker analyzes frames

### Configuration Files
- **go2rtc.yaml**: RTSP camera definitions
- **frontend/lib/CameraAutoConnect.tsx**: Auto-connection logic
- **frontend/lib/ExternalStreamModal.tsx**: Manual camera control

### Key Parameters
- **Frame Sample Interval**: 3 seconds (configurable in `.env`)
- **AI Analysis Cost**: ~$0.60/hour per camera
- **Video Quality**: 720p sub-streams for efficiency

---

## Quick Reference

### Test Camera Connection
```bash
# 1. Ping camera
ping 10.39.12.110

# 2. Test RTSP with VLC
vlc "rtsp://admin:Password03!@10.39.12.110:554/h264Preview_01_sub"

# 3. Check go2rtc can see camera
curl http://localhost:1984/api/streams | grep camera_1
```

### Access Camera Web Interface
```
http://10.39.12.110
http://10.39.12.107
http://10.39.12.104
http://10.39.12.106
http://10.39.12.109
http://10.39.12.108
```

### Default Credentials
- Username: `admin`
- Password: `Password03!` (cameras 1-3) or `zSQ6e9MB&03!` (cameras 4-6)

---

## References

- [Reolink RTSP Documentation](https://support.reolink.com/hc/en-us/articles/900000630706-Introduction-to-RTSP/)
- [Reolink VLC Setup Guide](https://support.reolink.com/hc/en-us/articles/360007010473-How-to-Live-View-Reolink-Cameras-via-VLC-Media-Player/)
- [go2rtc Documentation](https://github.com/AlexxIT/go2rtc)
- [RTSP RFC 2326](https://www.ietf.org/rfc/rfc2326.txt)

---

**Last Updated**: October 26, 2025
**System**: Cloud Observability Platform
**Location**: `/Users/nadavshanun/Downloads/cloud-obs-main/REOLINK-CAMERA-INFO.md`
