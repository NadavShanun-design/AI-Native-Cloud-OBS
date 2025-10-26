'use client';

import { formatChatMessageLinks, RoomContext, VideoConference } from '@livekit/components-react';
import {
  ExternalE2EEKeyProvider,
  LogLevel,
  Room,
  RoomConnectOptions,
  RoomOptions,
  VideoPresets,
  type VideoCodec,
} from 'livekit-client';
import { DebugMode } from '@/lib/Debug';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardShortcuts } from '@/lib/KeyboardShortcuts';
import { SettingsMenu } from '@/lib/SettingsMenu';
import { useSetupE2EE } from '@/lib/useSetupE2EE';
import { useLowCPUOptimizer } from '@/lib/usePerfomanceOptimiser';
import { Sidebar } from '@/lib/Sidebar';
import { LiveVideoConference } from '@/lib/LiveVideoConference';
import { RankedView } from '@/lib/RankedView';
import { YOLOView } from '@/lib/YOLOView';
import { DashboardView } from '@/lib/DashboardView';
import { CameraAutoConnect } from '@/lib/CameraAutoConnect';
import { AIScore, ScoreMessage } from '@/lib/types/ai';

const BACKEND_URL = process.env.NEXT_PUBLIC_MAIN_BACKEND_URL || 'http://localhost:3000';

export function VideoConferenceClientImpl(props: {
  liveKitUrl: string;
  token: string;
  codec: VideoCodec | undefined;
}) {
  const keyProvider = useMemo(() => new ExternalE2EEKeyProvider(), []);
  const { worker, e2eePassphrase } = useSetupE2EE();
  const e2eeEnabled = !!(e2eePassphrase && worker);

  const [e2eeSetupComplete, setE2eeSetupComplete] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // AI Ranking System state
  const [aiScores, setAiScores] = useState<Map<string, AIScore>>(new Map());
  const [aiConnected, setAiConnected] = useState(false);
  const [activeView, setActiveView] = useState<'live' | 'view' | 'dashboard' | 'personalize'>('live');

  // Handle tab changes from sidebar
  const handleTabChange = (tabId: string) => {
    console.log('Tab changed to:', tabId);
    setActiveView(tabId as 'live' | 'view' | 'dashboard' | 'personalize');
  };

  const roomOptions = useMemo((): RoomOptions => {
    return {
      publishDefaults: {
        videoSimulcastLayers: [VideoPresets.h540, VideoPresets.h216],
        red: !e2eeEnabled,
        videoCodec: props.codec,
      },
      adaptiveStream: { pixelDensity: 'screen' },
      dynacast: true,
      e2ee: e2eeEnabled
        ? {
            keyProvider,
            worker,
          }
        : undefined,
    };
  }, [e2eeEnabled, props.codec, keyProvider, worker]);

  const room = useMemo(() => new Room(roomOptions), [roomOptions]);

  const connectOptions = useMemo((): RoomConnectOptions => {
    return {
      autoSubscribe: true,
    };
  }, []);

  useEffect(() => {
    if (e2eeEnabled) {
      keyProvider.setKey(e2eePassphrase).then(() => {
        room.setE2EEEnabled(true).then(() => {
          setE2eeSetupComplete(true);
        });
      });
    } else {
      setE2eeSetupComplete(true);
    }
  }, [e2eeEnabled, e2eePassphrase, keyProvider, room, setE2eeSetupComplete]);

  useEffect(() => {
    if (e2eeSetupComplete) {
      console.log('Connecting to room...', props.liveKitUrl);
      
      // Add timeout to prevent hanging
      const connectionTimeout = setTimeout(() => {
        console.error('Connection timeout after 10 seconds');
        setIsConnected(false);
      }, 10000);
      
      room.connect(props.liveKitUrl, props.token, connectOptions)
        .then(() => {
          clearTimeout(connectionTimeout);
          console.log('Room connected successfully, enabling camera and microphone...');
          setIsConnected(true);
          // Enable camera and microphone after successful connection
          return room.localParticipant.enableCameraAndMicrophone();
        })
        .then(() => {
          console.log('Camera and microphone enabled successfully');
        })
        .catch((error) => {
          clearTimeout(connectionTimeout);
          console.error('Connection or media enable error:', error);
          console.error('Error details:', {
            message: error.message,
            code: error.code,
            stack: error.stack
          });
          setIsConnected(false);
        });
      
      // Screen sharing will be handled by user interaction
    }
  }, [room, props.liveKitUrl, props.token, connectOptions, e2eeSetupComplete]);

  useLowCPUOptimizer(room);

  // Render different views based on activeView state
  const renderView = () => {
    switch (activeView) {
      case 'live':
        return (
          <LiveVideoConference
            aiScores={aiScores}
            chatMessageFormatter={formatChatMessageLinks}
            SettingsComponent={
              process.env.NEXT_PUBLIC_SHOW_SETTINGS_MENU === 'true' ? SettingsMenu : undefined
            }
          />
        );
      case 'view':
        return <YOLOView aiScores={aiScores} aiConnected={aiConnected} />;
      case 'dashboard':
        return <DashboardView aiScores={aiScores} aiConnected={aiConnected} />;
      case 'personalize':
        return (
          <div style={{ padding: '20px', color: 'white' }}>
            <h2>Personalize</h2>
            <p>Customization options coming soon...</p>
          </div>
        );
      default:
        return (
          <LiveVideoConference
            aiScores={aiScores}
            chatMessageFormatter={formatChatMessageLinks}
            SettingsComponent={
              process.env.NEXT_PUBLIC_SHOW_SETTINGS_MENU === 'true' ? SettingsMenu : undefined
            }
          />
        );
    }
  };

  // WebSocket connection for AI scores
  useEffect(() => {
    const wsUrl = BACKEND_URL.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws';
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('AI WebSocket connected');
          setAiConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const message: ScoreMessage = JSON.parse(event.data);

            if (message.type === 'initial' && Array.isArray(message.payload)) {
              // Initial scores - replace entire map
              const newScores = new Map<string, AIScore>();
              message.payload.forEach((score: AIScore) => {
                newScores.set(score.camId || score.cam_id, score);
              });
              setAiScores(newScores);
            } else if (message.type === 'score' && !Array.isArray(message.payload)) {
              // Single score update
              const score = message.payload as AIScore;
              setAiScores((prev) => {
                const updated = new Map(prev);
                updated.set(score.camId || score.cam_id, score);
                return updated;
              });
            }
          } catch (error) {
            console.error('Error parsing AI score message:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('AI WebSocket error - Connection failed');
          // Don't log the error object as it's not serializable
        };

        ws.onclose = () => {
          console.log('AI WebSocket disconnected');
          setAiConnected(false);

          // Attempt to reconnect after 3 seconds
          reconnectTimeout = setTimeout(() => {
            console.log('Attempting to reconnect to AI WebSocket...');
            connect();
          }, 3000);
        };
      } catch (error) {
        console.error('Error creating WebSocket connection:', error);
        setAiConnected(false);
      }
    };

    connect();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (ws) {
        ws.close();
      }
    };
  }, []);

  return (
    <div className="lk-room-container" style={{ display: 'flex', height: '100vh' }}>
      <RoomContext.Provider value={room}>
        {/* Auto-connect Reolink cameras when room is ready */}
        <CameraAutoConnect room={isConnected ? room : null} enabled={true} />

        <Sidebar
          isCollapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          room={room}
          onTabChange={handleTabChange}
          activeTab={activeView}
        />
        <div style={{
          flex: 1,
          marginLeft: sidebarCollapsed ? '48px' : '200px',
          transition: 'margin-left 0.3s ease',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <KeyboardShortcuts />
          {isConnected ? (
            renderView()
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
              <div>Connecting to room...</div>
            </div>
          )}
          <DebugMode logLevel={LogLevel.debug} />
        </div>
      </RoomContext.Provider>
    </div>
  );
}
