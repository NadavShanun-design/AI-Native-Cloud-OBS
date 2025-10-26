#!/bin/bash

# Script to view logs from different services

show_menu() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                  Cloud OBS - View Logs                         ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "  1) All services"
    echo "  2) API Gateway"
    echo "  3) Analysis Worker (AI scoring)"
    echo "  4) LiveKit Server"
    echo "  5) Redis"
    echo "  6) Check system health"
    echo "  0) Exit"
    echo ""
    read -p "Select an option: " choice

    case $choice in
        1)
            echo "📋 Showing all service logs (Ctrl+C to stop)..."
            docker-compose logs -f
            ;;
        2)
            echo "📋 Showing API Gateway logs (Ctrl+C to stop)..."
            docker-compose logs -f api-gateway
            ;;
        3)
            echo "📋 Showing Analysis Worker logs (Ctrl+C to stop)..."
            docker-compose logs -f analysis-worker
            ;;
        4)
            echo "📋 Showing LiveKit Server logs (Ctrl+C to stop)..."
            docker-compose logs -f livekit-server
            ;;
        5)
            echo "📋 Showing Redis logs (Ctrl+C to stop)..."
            docker-compose logs -f redis
            ;;
        6)
            echo "🔍 Checking system health..."
            echo ""
            echo "Docker Services:"
            docker-compose ps
            echo ""
            echo "API Gateway Health:"
            curl -s http://localhost:3000/health | jq . 2>/dev/null || echo "❌ Not responding"
            echo ""
            echo "LiveKit Server:"
            lsof -i :7880 | grep LISTEN || echo "❌ Not listening"
            echo ""
            echo "Redis:"
            docker exec cloud-obs-redis redis-cli ping 2>/dev/null || echo "❌ Not responding"
            echo ""
            show_menu
            ;;
        0)
            echo "👋 Goodbye!"
            exit 0
            ;;
        *)
            echo "❌ Invalid option"
            show_menu
            ;;
    esac
}

show_menu
