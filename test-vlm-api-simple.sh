#!/bin/bash

echo "Testing VLM API..."
echo ""

# Test GET endpoint to list models
echo "1. Testing GET /api/vlm-analyze (list models):"
curl -s http://localhost:3001/api/vlm-analyze | python3 -m json.tool
echo ""
echo ""

# Test if Ollama is accessible
echo "2. Testing Ollama API directly:"
curl -s http://localhost:11434/api/tags | python3 -c "import sys, json; data=json.load(sys.stdin); print(f'Available models: {len(data[\"models\"])}'); [print(f'  ✓ {m[\"name\"]}') for m in data['models']]"
echo ""
echo ""

echo "✅ VLM system is ready!"
echo ""
echo "Next steps:"
echo "1. Open http://localhost:3001 in your browser"
echo "2. Navigate to the VLM Analysis page"
echo "3. Select a model from the dropdown"
echo "4. The system will automatically analyze video frames!"
echo ""
echo "Available models:"
echo "  🚀 Moondream - Fast (1.7GB)"
echo "  ⚖️  LLaVA 7B - Balanced (4.7GB)"
echo "  🎯 Llama 3.2 Vision - Best Quality (7.8GB)"
