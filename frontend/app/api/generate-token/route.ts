import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

export async function POST(request: NextRequest) {
  try {
    const { password, participantName, roomName, isGuest } = await request.json();

    // Validate required fields
    if (!participantName || !roomName) {
      return NextResponse.json(
        { error: 'Participant name and room name are required' },
        { status: 400 }
      );
    }

    // Determine user role
    let role = 'guest';

    if (isGuest === true) {
      // Guest login - no password required
      role = 'guest';
      console.log(`Guest login: ${participantName}`);
    } else {
      // Admin login - check password
      if (password !== 'goodvibesonly') {
        return NextResponse.json(
          { error: 'Invalid password' },
          { status: 401 }
        );
      }
      role = 'admin';
      console.log(`Admin login: ${participantName}`);
    }

    // Generate unique token with participant name as identity
    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!,
      {
        identity: participantName,
        ttl: '24h', // Token valid for 24 hours
        metadata: JSON.stringify({ role }), // Store role in token metadata
      }
    );

    // Add video grants (same for both guest and admin)
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
      roomRecord: true,
    });

    const token = await at.toJwt();

    return NextResponse.json({
      token,
      participantName,
      roomName,
      role, // Include role in response
      expiresIn: '24h'
    });

  } catch (error) {
    console.error('Error generating token:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}
