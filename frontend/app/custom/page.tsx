import { videoCodecs } from 'livekit-client';
import { VideoConferenceClientImpl } from './VideoConferenceClientImpl';
import { isVideoCodec } from '@/lib/types';

export default async function CustomRoomConnection(props: {
  searchParams: Promise<{
    liveKitUrl?: string;
    token?: string;
    codec?: string;
    role?: string; // Add role parameter
  }>;
}) {
  const { liveKitUrl, token, codec, role } = await props.searchParams;
  if (typeof liveKitUrl !== 'string') {
    return <h2>Missing LiveKit URL</h2>;
  }
  if (typeof token !== 'string') {
    return <h2>Missing LiveKit token</h2>;
  }
  if (codec !== undefined && !isVideoCodec(codec)) {
    return <h2>Invalid codec, if defined it has to be [{videoCodecs.join(', ')}].</h2>;
  }

  // Validate and set user role (default to guest for safety)
  const userRole: 'admin' | 'guest' = role === 'admin' ? 'admin' : 'guest';
  console.log(`[CustomRoomConnection] User role: ${userRole}`);

  return (
    <main data-lk-theme="default" style={{ height: '100%' }}>
      <VideoConferenceClientImpl
        liveKitUrl={liveKitUrl}
        token={token}
        codec={codec}
        userRole={userRole}
      />
    </main>
  );
}
