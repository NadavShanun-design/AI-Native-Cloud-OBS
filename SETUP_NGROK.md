# 🚀 Setup ngrok for WiFi Camera Sharing

## Why ngrok?

After researching 2024 best practices, **ngrok is the ONLY solution** that works for:
- ✅ Sharing camera links with people on same WiFi
- ✅ No certificate warnings or errors
- ✅ Works on ALL devices (Mac, Windows, iPhone, Android)
- ✅ Simple "send a link" workflow

**Other solutions DON'T work:**
- ❌ `http://10.237.213.101` - Browsers block getUserMedia
- ❌ Self-signed HTTPS - Chrome rejects certificates
- ❌ `.local` domains - Inconsistent browser support

---

## Step 1: Create Free ngrok Account (One-Time, 2 Minutes)

1. Go to: **https://dashboard.ngrok.com/signup**
2. Sign up with email or Google
3. Free tier includes:
   - ✅ 1 online agent
   - ✅ Unlimited tunnels (one at a time)
   - ✅ HTTPS support

---

## Step 2: Get Your Authtoken

1. Go to: **https://dashboard.ngrok.com/get-started/your-authtoken**
2. Copy your authtoken (looks like: `2abc...def123`)

---

## Step 3: Configure ngrok

Run this command (replace `YOUR_TOKEN` with your actual token):

```bash
ngrok config add-authtoken YOUR_TOKEN_HERE
```

Example:
```bash
ngrok config add-authtoken 2abcXYZ123_defABC456hijklMNOPQR
```

---

## Step 4: Start ngrok Tunnel

```bash
cd /Users/nadavshanun/Downloads/AI-OBS
ngrok http 3000
```

This will show:
```
Session Status                online
Forwarding                    https://abc123.ngrok-free.app -> http://localhost:3000
```

---

## Step 5: Share Camera Links!

Copy the `https://` URL and add `/camera?id=cam-X`:

**Camera 1:** `https://YOUR-URL.ngrok-free.app/camera?id=cam-1`
**Camera 2:** `https://YOUR-URL.ngrok-free.app/camera?id=cam-2`
**Camera 3:** `https://YOUR-URL.ngrok-free.app/camera?id=cam-3`
**Camera 4:** `https://YOUR-URL.ngrok-free.app/camera?id=cam-4`
**Camera 5:** `https://YOUR-URL.ngrok-free.app/camera?id=cam-5`

Send any of these links to someone on your WiFi → They open it → Camera works!

---

## What People Will See

1. Open link on their laptop/phone
2. Click "Visit Site" (ngrok warning page - one time)
3. Allow camera access
4. See "🔴 LIVE" - camera is streaming!

---

## Dashboard Access

Dashboard also available at:
```
https://YOUR-URL.ngrok-free.app:3101
```

Or use localhost on this Mac:
```
http://localhost:3101
```

---

## Important Notes

### Free Tier Limits
- ✅ Unlimited bandwidth
- ✅ Works 24/7 while running
- ⚠️ 1 online agent (can only run 1 tunnel at a time)
- ⚠️ URL changes when you restart ngrok

### Keeping Same URL
**Paid plan** ($8/month) gives you:
- Static domains (URL never changes)
- Multiple tunnels simultaneously
- Custom branding

---

## Quick Commands

```bash
# Start tunnel
ngrok http 3000

# Stop (Ctrl+C)

# Check status
curl http://localhost:4040/api/tunnels
```

---

## Troubleshooting

### "ERR_NGROK_3004"
- You need to add your authtoken
- Run: `ngrok config add-authtoken YOUR_TOKEN`

### "Account limit reached"
- Free tier allows 1 agent at a time
- Stop other ngrok processes: `pkill ngrok`

### "Tunnel not found"
- Make sure services are running: `docker-compose ps`
- Restart: `docker-compose restart`

---

## Why This is Better Than Alternatives

| Solution | Works on WiFi? | Works on Phones? | Certificate Errors? | Easy to Share? |
|----------|---------------|------------------|---------------------|----------------|
| **ngrok** | ✅ | ✅ | ❌ No | ✅ Yes |
| Local IP (HTTP) | ❌ | ❌ | N/A | ❌ |
| Self-signed HTTPS | ❌ | ❌ | ✅ Yes | ❌ |
| Chrome flags | ✅ | ❌ | N/A | ❌ |

**ngrok is the industry standard for local WebRTC development!**
