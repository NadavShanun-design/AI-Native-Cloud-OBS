#!/bin/bash

# Start ngrok tunnel for AI-OBS
# This creates HTTPS URLs that work from anywhere (including phones)

echo "🚀 Starting ngrok tunnel for AI-OBS..."
echo ""
echo "⏳ Checking if ngrok is configured..."

# Check if ngrok is configured
if ! ngrok config check &>/dev/null; then
  echo ""
  echo "❌ ngrok is not configured yet!"
  echo ""
  echo "📝 Follow these steps:"
  echo "  1. Sign up: https://dashboard.ngrok.com/signup"
  echo "  2. Get authtoken: https://dashboard.ngrok.com/get-started/your-authtoken"
  echo "  3. Run: ngrok config add-authtoken YOUR_TOKEN"
  echo ""
  echo "Then run this script again!"
  exit 1
fi

# Kill any existing ngrok processes
pkill ngrok 2>/dev/null
sleep 1

# Start ngrok for API Gateway (port 3000) - this handles camera pages
echo "✅ ngrok configured!"
echo "🌐 Starting tunnel to port 3000..."
ngrok http 3000 --log=stdout > /tmp/ngrok.log 2>&1 &

# Wait for ngrok to start
sleep 5

# Get the URL from ngrok API
echo "🔍 Getting your HTTPS URL..."
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['tunnels'][0]['public_url'] if data.get('tunnels') else '')" 2>/dev/null || echo "")

if [ -z "$NGROK_URL" ]; then
  echo ""
  echo "⚠️  Could not auto-detect URL."
  echo "📊 Check manually at: http://localhost:4040"
  echo ""
  echo "Or run: curl -s http://localhost:4040/api/tunnels | jq"
  exit 1
fi

# Display all shareable links
echo ""
echo "============================================"
echo "✅ ngrok tunnel is LIVE!"
echo "============================================"
echo ""
echo "📱 SHARE THESE LINKS WITH ANYONE ON YOUR WIFI:"
echo ""
echo "🎥 Camera 1: $NGROK_URL/camera?id=cam-1"
echo "🎥 Camera 2: $NGROK_URL/camera?id=cam-2"
echo "🎥 Camera 3: $NGROK_URL/camera?id=cam-3"
echo "🎥 Camera 4: $NGROK_URL/camera?id=cam-4"
echo "🎥 Camera 5: $NGROK_URL/camera?id=cam-5"
echo ""
echo "📊 Dashboard (View All): http://localhost:3101"
echo ""
echo "============================================"
echo ""
echo "💡 HOW TO USE:"
echo "  1. Copy a camera link above"
echo "  2. Send via iMessage/Email/Slack to someone"
echo "  3. They open it on their laptop/phone"
echo "  4. Click 'Visit Site' (ngrok warning)"
echo "  5. Allow camera access"
echo "  6. See '🔴 LIVE' - they're streaming!"
echo ""
echo "🌐 ngrok Web Interface: http://localhost:4040"
echo "⏹️  To stop: pkill ngrok"
echo ""
echo "⚠️  Note: This URL will change when you restart ngrok"
echo "    (Upgrade to paid plan for permanent URLs)"
echo ""
