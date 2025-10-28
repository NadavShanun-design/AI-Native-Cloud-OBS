'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Room, Track } from 'livekit-client';
import { CameraConnectionStatus, CameraStatus } from './CameraConnectionStatus';
import { MediaMTXWebRTCReader } from './MediaMTXWebRTCReader';

interface CameraAutoConnectProps {
  room: Room | null;
  enabled?: boolean;
  showStatus?: boolean;
}

// Reolink camera configuration
const CAMERAS = [
  { id: 'camera_1', name: 'Camera 1', ip: '10.39.12.110', streamName: 'camera_1' },
  { id: 'camera_2', name: 'Camera 2', ip: '10.39.12.107', streamName: 'camera_2' },
  { id: 'camera_3', name: 'Camera 3', ip: '10.39.12.104', streamName: 'camera_3' },
  { id: 'camera_4', name: 'Camera 4', ip: '10.39.12.106', streamName: 'camera_4' },
  { id: 'camera_5', name: 'Camera 5', ip: '10.39.12.109', streamName: 'camera_5' },
  { id: 'camera_6', name: 'Camera 6', ip: '10.39.12.108', streamName: 'camera_6' },
];

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000; // 5 seconds

export function CameraAutoConnectEnhanced({ room, enabled = true, showStatus = true }: CameraAutoConnectProps) {
  const connectAttempted = useRef(false);
  const connectedCameras = useRef<Set<string>>(new Set());
  const retryAttempts = useRef<Map<string, number>>(new Map());
  const retryTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const [cameraStatuses, setCameraStatuses] = useState<CameraStatus[]>(
    CAMERAS.map(cam => ({
      id: cam.id,
      name: cam.name,
      ip: cam.ip,
      status: 'disconnected' as const,
    }))
  );

  const updateCameraStatus = (
    cameraId: string,
    status: CameraStatus['status'],
    lastError?: string
  ) => {
    setCameraStatuses(prev =>
      prev.map(cam =>
        cam.id === cameraId ? { ...cam, status, lastError } : cam
      )
    );
  };

  const connectCamera = async (camera: typeof CAMERAS[0], isRetry = false) => {
    if (!room) {
      console.log(`Cannot connect ${camera.name}: room not available`);
      return;
    }

    if (connectedCameras.current.has(camera.id)) {
      console.log(`${camera.name} already connected, skipping`);
      return;
    }

    // Clear any pending retry timeout
    const existingTimeout = retryTimeouts.current.get(camera.id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      retryTimeouts.current.delete(camera.id);
    }

    try {
      console.log(`${isRetry ? 'Retrying' : 'Connecting to'} ${camera.name}...`);
      updateCameraStatus(camera.id, 'connecting');

      // MediaMTX WebRTC WHEP endpoint
      const mediaMTXUrl = `http://localhost:8889/${camera.streamName}/whep`;

      let trackReceived = false;
      const connectionTimeout = setTimeout(() => {
        if (!trackReceived) {
          console.error(`Connection timeout for ${camera.name}`);
          handleConnectionError(camera, 'Connection timeout');
        }
      }, 30000); // 30 second timeout

      // Create MediaMTX WebRTC reader
      const reader = new MediaMTXWebRTCReader({
        url: mediaMTXUrl,
        onError: (err) => {
          console.error(`❌ [${camera.name}] MediaMTX error:`, err);
          clearTimeout(connectionTimeout);
          handleConnectionError(camera, err);
        },
        onTrack: async (event) => {
          trackReceived = true;
          clearTimeout(connectionTimeout);

          console.log(`🎥 [${camera.name}] Received track event:`, {
            streams: event.streams.length,
            track: event.track,
            transceiver: event.transceiver
          });

          const stream = event.streams[0];
          const videoTrack = stream.getVideoTracks()[0];

          if (videoTrack) {
            // Log detailed track information
            const settings = videoTrack.getSettings();
            console.log(`📹 [${camera.name}] Video Track Details:`, {
              id: videoTrack.id,
              label: videoTrack.label,
              kind: videoTrack.kind,
              enabled: videoTrack.enabled,
              muted: videoTrack.muted,
              readyState: videoTrack.readyState,
              settings: settings,
            });

            // Check if track has dimensions
            if (!settings.width || !settings.height) {
              console.warn(`⚠️ [${camera.name}] Track has no dimensions! Settings:`, settings);
            } else {
              console.log(`✓ [${camera.name}] Track dimensions: ${settings.width}x${settings.height}`);
            }

            try {
              // Check if this track is already published
              const existingPublications = Array.from(room.localParticipant.videoTracks.values());
              const alreadyPublished = existingPublications.some(pub =>
                pub.track?.mediaStreamTrack?.id === videoTrack.id ||
                pub.trackName === camera.name
              );

              if (alreadyPublished) {
                console.log(`⚠️ [${camera.name}] Track already published, skipping`);
                connectedCameras.current.add(camera.id);
                updateCameraStatus(camera.id, 'connected');
                return;
              }

              // Publish camera stream to LiveKit room
              console.log(`📤 [${camera.name}] Publishing track to LiveKit...`);
              await room.localParticipant.publishTrack(videoTrack, {
                name: camera.name,
                source: Track.Source.Camera
              });

              connectedCameras.current.add(camera.id);
              retryAttempts.current.delete(camera.id); // Reset retry count on success
              updateCameraStatus(camera.id, 'connected');
              console.log(`✅ [${camera.name}] Successfully published to LiveKit via MediaMTX`);
            } catch (publishError) {
              const errorMsg = String(publishError);
              // If track is already published, mark as success
              if (errorMsg.includes('already been published')) {
                console.log(`⚠️ [${camera.name}] Track already published (caught), marking as connected`);
                connectedCameras.current.add(camera.id);
                updateCameraStatus(camera.id, 'connected');
              } else {
                console.error(`❌ [${camera.name}] Failed to publish to LiveKit:`, publishError);
                handleConnectionError(camera, `Publish failed: ${publishError}`);
              }
            }
          } else {
            console.error(`❌ [${camera.name}] No video track in stream!`);
            handleConnectionError(camera, 'No video track received');
          }
        }
      });

      // Store reader reference for cleanup (optional)
      // You could add this to a ref if you need to close connections later

    } catch (error) {
      console.error(`Failed to connect ${camera.name}:`, error);
      handleConnectionError(camera, String(error));
    }
  };

  const handleConnectionError = (camera: typeof CAMERAS[0], errorMessage: string) => {
    const attempts = retryAttempts.current.get(camera.id) || 0;

    if (attempts < MAX_RETRY_ATTEMPTS) {
      const nextAttempt = attempts + 1;
      retryAttempts.current.set(camera.id, nextAttempt);

      console.log(`Will retry ${camera.name} (attempt ${nextAttempt}/${MAX_RETRY_ATTEMPTS}) in ${RETRY_DELAY_MS/1000}s`);
      updateCameraStatus(camera.id, 'connecting', `Retrying... (${nextAttempt}/${MAX_RETRY_ATTEMPTS})`);

      const timeout = setTimeout(() => {
        connectCamera(camera, true);
      }, RETRY_DELAY_MS);

      retryTimeouts.current.set(camera.id, timeout);
    } else {
      console.error(`${camera.name} failed after ${MAX_RETRY_ATTEMPTS} attempts`);
      updateCameraStatus(camera.id, 'error', errorMessage);
    }
  };

  const retryCamera = (cameraId: string) => {
    const camera = CAMERAS.find(c => c.id === cameraId);
    if (camera) {
      retryAttempts.current.delete(cameraId);
      connectedCameras.current.delete(cameraId);
      connectCamera(camera);
    }
  };

  const connectAllCameras = async () => {
    if (!room || !enabled || connectAttempted.current) {
      return;
    }

    connectAttempted.current = true;
    console.log('🚀 Auto-connecting all Reolink cameras...');

    // Connect cameras with 500ms delay between each
    for (const camera of CAMERAS) {
      connectCamera(camera);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('Camera auto-connect sequence initiated');
  };

  useEffect(() => {
    // Wait for LiveKit room to be fully established
    const timer = setTimeout(() => {
      connectAllCameras();
    }, 2000);

    return () => {
      clearTimeout(timer);
      // Clean up all retry timeouts
      retryTimeouts.current.forEach(timeout => clearTimeout(timeout));
      retryTimeouts.current.clear();
    };
  }, [room, enabled]);

  // Show status indicator if enabled
  if (showStatus) {
    return <CameraConnectionStatus cameras={cameraStatuses} onRetryCamera={retryCamera} />;
  }

  return null;
}
