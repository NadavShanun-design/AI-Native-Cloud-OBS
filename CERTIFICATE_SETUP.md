# Certificate Setup for Safari

## The Problem
Safari blocks HTTPS requests to websites with untrusted SSL certificates. This prevents the camera page and dashboard from connecting to the API.

## The Solution
You need to trust the SSL certificate in Safari **before** opening the camera page or dashboard.

## Step-by-Step Instructions

### 1. Trust the Certificate in Safari

1. **Open Safari** (not Chrome or any other browser)

2. **Visit this URL:**
   ```
   https://localhost:3000/health
   ```

3. **You'll see a warning** like "This Connection Is Not Private" or "Safari can't verify the identity of the website"

4. **Click "Show Details"** (or "Advanced")

5. **Click "visit this website"** or **"Proceed to localhost (unsafe)"**

6. **You should see:**
   ```json
   {"status":"ok","timestamp":...}
   ```

7. **That's it!** The certificate is now trusted for this session.

### 2. Open the Camera Page

Now you can open the camera page:
```
https://localhost:3000/camera?id=cam-1
```

OR use the IP address (works from any device on the same network):
```
https://192.168.68.54:3000/camera?id=cam-1
```

### 3. Open the Dashboard

Open the main dashboard:
```
http://localhost:3101
```

## What Changed?

I generated a new SSL certificate that works for **both**:
- `localhost` (for local development)
- `192.168.68.54` (your current IP address on the network)

This means you can access the camera page from:
- Your laptop using `https://localhost:3000/camera?id=cam-1`
- Your phone/tablet using `https://192.168.68.54:3000/camera?id=cam-1`

## Troubleshooting

### Safari still shows "Can't Open the Page"
- Make sure you visited `https://localhost:3000/health` FIRST
- Make sure you clicked "visit this website" to accept the certificate
- Try refreshing the camera page

### Camera says "Error: could not establish signal connection"
- Make sure you trusted the certificate first
- Open the browser console (Safari → Develop → Show JavaScript Console)
- Look for any error messages starting with ❌
- Make sure you allowed camera and microphone permissions

### Dashboard stuck on "Connecting to LiveKit..."
- Make sure you visited `https://192.168.68.54:3000/health` in Safari first
- Accept the certificate
- Then refresh the dashboard at `http://localhost:3101`

## Quick Test

Run this in Terminal to verify everything is working:
```bash
curl -k https://localhost:3000/health
curl -k https://192.168.68.54:3000/health
```

Both should return:
```json
{"status":"ok","timestamp":...}
```
