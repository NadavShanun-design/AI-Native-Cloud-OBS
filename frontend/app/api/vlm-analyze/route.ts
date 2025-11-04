import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

interface VLMAnalyzeRequest {
  image: string; // Base64 encoded image
  camId: string;
  prompt?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { image, camId, prompt }: VLMAnalyzeRequest = await request.json();

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

    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Default prompt for video frame analysis
    const analysisPrompt = prompt || 'Describe what is happening in this image in one concise sentence. Focus on people, actions, and important objects.';

    console.log(`[VLM] Analyzing frame from camera: ${camId}`);

    // Call OpenAI Vision API with GPT-4o-mini
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: analysisPrompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 100,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('[VLM] OpenAI API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to analyze image with VLM', details: errorText },
        { status: 500 }
      );
    }

    const openaiData = await openaiResponse.json();
    const insight = openaiData.choices?.[0]?.message?.content || 'No analysis available';

    console.log(`[VLM] Analysis complete for ${camId}: ${insight.substring(0, 100)}...`);

    return NextResponse.json({
      camId,
      insight,
      timestamp: Date.now(),
    });

  } catch (error) {
    console.error('[VLM] Error analyzing image:', error);
    return NextResponse.json(
      { error: 'Failed to analyze image', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
