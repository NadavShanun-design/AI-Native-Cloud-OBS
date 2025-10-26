#!/bin/bash

echo "🛑 Stopping Cloud OBS services..."

# Stop frontend (if running)
pkill -f "npm run dev" 2>/dev/null

# Stop Docker services
docker-compose down

echo "✅ All services stopped"
