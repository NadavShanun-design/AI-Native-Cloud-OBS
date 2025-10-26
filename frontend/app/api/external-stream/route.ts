import { NextRequest, NextResponse } from 'next/server';
// Note: LiveKit Ingress API for RTMP streams requires additional setup
// This endpoint is currently not implemented for camera connections
// Cameras connect directly via WebRTC through go2rtc

export async function POST(request: NextRequest) {
  try {
    const { streamUrl, streamName, roomName } = await request.json();

    if (!streamUrl || !roomName) {
      return NextResponse.json(
        { error: 'Stream URL and room name are required' },
        { status: 400 }
      );
    }

    // TODO: Implement RTMP/WHIP ingress using LiveKit Ingress service
    // For now, RTMP streams are not supported
    // Cameras should connect via the ExternalStreamModal using go2rtc WebRTC
    return NextResponse.json(
      { error: 'RTMP streams not yet implemented. Use go2rtc for camera connections.' },
      { status: 501 }
    );

  } catch (error) {
    console.error('Error adding external stream:', error);
    return NextResponse.json(
      { error: 'Failed to add external stream' },
      { status: 500 }
    );
  }
}

