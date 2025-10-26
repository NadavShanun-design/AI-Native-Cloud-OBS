'use client';

import { useEffect, useState } from 'react';
import { Room } from 'livekit-client';
import { LiveKitRoom } from '@livekit/components-react';
import ProgramMonitor from '@/components/ProgramMonitor';
import CameraGrid from '@/components/CameraGrid';
import ControlPanel from '@/components/ControlPanel';
import StatsPanel from '@/components/StatsPanel';
import { useAppStore } from '@/store/appStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880';

export default function Home() {
  const [token, setToken] = useState<string>('');
  const [connected, setConnected] = useState(false);
  const { updateScore, setCurrentProgram, setLastSwitch, setWsConnected } = useAppStore();

  useEffect(() => {
    // Get LiveKit token
    fetch(`${API_URL}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: `viewer-${Date.now()}`,
        room: 'main',
        role: 'viewer',
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setToken(data.data.token);
        }
      })
      .catch((err) => console.error('Failed to get token:', err));

    // Connect to WebSocket for real-time score updates
    const wsUrl = API_URL.replace('http://', 'ws://').replace('https://', 'wss://');
    const ws = new WebSocket(`${wsUrl}/ws`);

    ws.onopen = () => {
      console.log('✅ WebSocket connected for real-time updates');
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('📨 WebSocket message:', message);

        switch (message.type) {
          case 'score':
            // Update camera score
            if (message.payload?.payload) {
              const scoreData = message.payload.payload;
              updateScore({
                camId: scoreData.cam_id,
                score: scoreData.score,
                reason: scoreData.reason,
                timestamp: scoreData.timestamp,
                features: scoreData.features || {
                  camId: scoreData.cam_id,
                  timestamp: scoreData.timestamp,
                  objectCounts: {},
                  faceConfMax: 0,
                  faceArea: 0,
                  bboxOccupancy: 0,
                  motionScore: 0,
                  speechEnergyDb: 0,
                  keywords: [],
                  vlmTags: [],
                  faceSalience: 0,
                  mainSubjectOverlap: 0,
                  motionSalience: 0,
                  speechEnergy: 0,
                  keywordBoost: 0,
                  framingScore: 0,
                  noveltyDecay: 0,
                  continuityBonus: 0,
                },
              });
            }
            break;

          case 'switch':
            // Update current program camera
            if (message.payload?.to) {
              setCurrentProgram(message.payload.to);
              setLastSwitch(message.payload);
            }
            break;

          case 'status':
            // Handle status updates
            console.log('Status update:', message.payload);
            break;

          case 'narration':
            // Handle narration updates
            console.log('Narration:', message.payload);
            break;
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      setWsConnected(false);
    };

    ws.onclose = () => {
      console.log('🔌 WebSocket disconnected');
      setWsConnected(false);
    };

    // Cleanup on unmount
    return () => {
      ws.close();
    };
  }, [updateScore, setCurrentProgram, setLastSwitch, setWsConnected]);

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-200 border-t-violet-600 mx-auto mb-6"></div>
            <div className="absolute inset-0 rounded-full bg-violet-500/10 blur-xl"></div>
          </div>
          <p className="text-slate-600 font-medium">Connecting to LiveKit...</p>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={LIVEKIT_URL}
      connect={true}
      onConnected={() => setConnected(true)}
      onDisconnected={() => setConnected(false)}
    >
      <Main connected={connected} />
    </LiveKitRoom>
  );
}

function Main({ connected }: { connected: boolean }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">AI-OBS</h1>
                  <p className="text-xs text-slate-500 font-medium">Intelligent Auto-Director</p>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100">
                <div className="relative">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      connected ? 'bg-emerald-500' : 'bg-red-500'
                    } transition-all duration-300`}
                  ></div>
                  {connected && (
                    <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping"></div>
                  )}
                </div>
                <span className="text-xs font-semibold text-slate-700">
                  {connected ? 'Live' : 'Offline'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <a
                href="/cameras"
                className="group px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 rounded-xl transition-all duration-200 font-semibold text-sm text-white shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30 hover:-translate-y-0.5"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Connect Cameras
                </span>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="max-w-[1800px] mx-auto px-6 py-8 space-y-8">
        {/* Top: Program Monitor & Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ProgramMonitor />
          </div>
          <div>
            <StatsPanel />
          </div>
        </div>

        {/* Middle: Camera Previews with Rankings */}
        <CameraGrid />

        {/* Bottom: Controls */}
        <ControlPanel />
      </div>
    </div>
  );
}
