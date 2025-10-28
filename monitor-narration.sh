#!/bin/bash

###############################################################################
# Stream Narrator Monitoring Script
# Real-time monitoring of the narration system with health checks
###############################################################################

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to display header
print_header() {
    clear
    echo -e "${BLUE}========================================================================"
    echo -e "🎙️  Stream Narrator System Monitor"
    echo -e "========================================================================${NC}"
    echo -e "Time: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
}

# Function to check service health
check_service() {
    local service=$1
    if docker ps | grep -q "$service"; then
        local status=$(docker inspect --format='{{.State.Status}}' "cloud-obs-$service" 2>/dev/null || echo "unknown")
        if [ "$status" = "running" ]; then
            echo -e "${GREEN}✅ $service: RUNNING${NC}"
            return 0
        else
            echo -e "${RED}❌ $service: $status${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ $service: NOT FOUND${NC}"
        return 1
    fi
}

# Function to get container stats
get_stats() {
    local container=$1
    docker stats --no-stream --format "CPU: {{.CPUPerc}} | MEM: {{.MemUsage}}" "$container" 2>/dev/null || echo "N/A"
}

# Function to count audio files
count_audio_files() {
    local count=$(ls -1 tmp/narration_audio/narration_*.wav 2>/dev/null | wc -l)
    echo "$count"
}

# Function to get latest narration
get_latest_narration() {
    local latest=$(ls -t tmp/narration_audio/narration_*.wav 2>/dev/null | head -1)
    if [ -n "$latest" ]; then
        local size=$(ls -lh "$latest" | awk '{print $5}')
        local time=$(ls -l "$latest" | awk '{print $6, $7, $8}')
        echo "$time ($size)"
    else
        echo "No narrations yet"
    fi
}

# Main monitoring loop
while true; do
    print_header

    # Service Health
    echo -e "${BLUE}📊 Service Health:${NC}"
    echo "----------------------------------------"
    check_service "redis"
    check_service "livekit"
    check_service "api-gateway"
    check_service "analysis-worker"
    check_service "stream-narrator"
    echo ""

    # Stream Narrator Stats
    echo -e "${BLUE}💻 Stream Narrator Resources:${NC}"
    echo "----------------------------------------"
    get_stats "cloud-obs-stream-narrator"
    echo ""

    # Narration Files
    echo -e "${BLUE}🎵 Audio Files:${NC}"
    echo "----------------------------------------"
    echo "Total narrations: $(count_audio_files)"
    echo "Latest: $(get_latest_narration)"
    echo ""

    # Recent Logs
    echo -e "${BLUE}📝 Recent Logs (last 10 lines):${NC}"
    echo "----------------------------------------"
    docker-compose logs --tail=10 stream-narrator 2>/dev/null | sed 's/cloud-obs-stream-narrator  | //'
    echo ""

    # Footer
    echo -e "${BLUE}========================================================================"
    echo -e "Press Ctrl+C to exit | Refreshing every 5 seconds"
    echo -e "========================================================================${NC}"

    # Wait 5 seconds before refresh
    sleep 5
done
