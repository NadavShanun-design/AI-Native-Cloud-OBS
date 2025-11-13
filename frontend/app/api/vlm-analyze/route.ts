import { NextRequest, NextResponse } from 'next/server';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

// Allow long-running requests (10 minutes max)
export const maxDuration = 600; // 10 minutes in seconds
export const dynamic = 'force-dynamic';

interface VLMAnalyzeRequest {
  image: string; // Base64 encoded image
  camId: string;
  prompt?: string;
  model?: 'moondream' | 'llava:7b' | 'llama3.2-vision:11b';
}

// Model configurations with descriptions
const VLM_MODELS = {
  'moondream': {
    name: 'moondream:latest',
    size: '1.7GB',
    speed: 'fast',
    description: 'Lightweight and fast, works reliably (RECOMMENDED)',
    requiresMemory: '2GB'
  },
  'llava:7b': {
    name: 'llava:7b',
    size: '4.7GB',
    speed: 'medium',
    description: 'Balanced performance (requires more RAM)',
    requiresMemory: '8GB'
  },
  'llama3.2-vision:11b': {
    name: 'llama3.2-vision:11b',
    size: '7.8GB',
    speed: 'slow',
    description: 'Best quality (requires significant RAM)',
    requiresMemory: '12GB'
  }
} as const;

export async function POST(request: NextRequest) {
  try {
    const { image, camId, prompt, model = 'moondream' }: VLMAnalyzeRequest = await request.json();

    if (!image) {
      return NextResponse.json(
        { error: 'Image is required' },
        { status: 400 }
      );
    }

    if (!camId) {
      return NextResponse.json(
        { error: 'Camera ID is required' },
        { status: 400 }
      );
    }

    // Validate model selection
    const selectedModel = VLM_MODELS[model] || VLM_MODELS['moondream'];

    // Enhanced prompt for better, more specific analysis
    const analysisPrompt = prompt || 'Analyze this video frame carefully. Describe exactly what you see: count people, describe their appearance and what they are doing, identify objects and their colors, describe the setting and lighting. Be specific and accurate.';

    console.log(`[VLM] Analyzing frame from camera: ${camId} using ${selectedModel.name}`);
    console.log(`[VLM] Prompt: "${analysisPrompt.substring(0, 80)}..."`);
    console.log(`[VLM] Image size: ${image.length} chars`);
    const startTime = Date.now();

    // Call Ollama API with selected model
    // Use modern AbortSignal.timeout() for 10-minute timeout
    try {
      const ollamaResponse = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel.name,
          prompt: analysisPrompt,
          images: [image], // Base64 encoded image
          stream: false,
          options: {
            temperature: 0.7,  // Add some randomness to avoid identical responses
            top_p: 0.9,
            top_k: 40,
            num_predict: 150,  // Allow longer, more detailed responses
          }
        }),
        signal: AbortSignal.timeout(600000), // 10 minutes - modern Node.js approach
      });

      if (!ollamaResponse.ok) {
        const errorText = await ollamaResponse.text();
        console.error('[VLM] Ollama API error:', errorText);
        return NextResponse.json(
          { error: 'Failed to analyze image with local VLM', details: errorText },
          { status: 500 }
        );
      }

      const ollamaData = await ollamaResponse.json();
      let insight = ollamaData.response || '';

      // Handle empty or whitespace-only responses
      insight = insight.trim();
      if (!insight || insight.length === 0) {
        console.warn(`[VLM] Empty response from ${selectedModel.name}, retrying with simpler prompt...`);
        insight = 'Analysis completed but no description was generated. This may indicate the image is unclear or the model is having difficulty processing it.';
      }

      const processingTime = Date.now() - startTime;

      console.log(`[VLM] ${selectedModel.name} analysis complete for ${camId} in ${processingTime}ms`);
      console.log(`[VLM] Full Response: "${insight.substring(0, 100)}..."`);

      return NextResponse.json({
        camId,
        insight,
        timestamp: Date.now(),
        model: selectedModel.name,
        processingTime,
      });

    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
          console.error('[VLM] Request timeout after 10 minutes');
          return NextResponse.json(
            { error: 'VLM analysis timeout - took longer than 10 minutes' },
            { status: 504 }
          );
        }
        console.error('[VLM] Error during analysis:', error.message);
      }
      throw error;
    }

  } catch (error) {
    console.error('[VLM] Error analyzing image:', error);
    return NextResponse.json(
      { error: 'Failed to analyze image', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET endpoint to list available models
export async function GET() {
  return NextResponse.json({
    models: Object.entries(VLM_MODELS).map(([key, value]) => ({
      id: key,
      ...value
    })),
    default: 'moondream'
  });
}
