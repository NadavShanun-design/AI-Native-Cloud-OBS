'use client';

import React, { useEffect, useRef } from 'react';
import { Room, Track } from 'livekit-client';

interface CameraAutoConnectProps {
  room: Room | null;
  enabled?: boolean;
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

export function CameraAutoConnect({ room, enabled = true }: CameraAutoConnectProps) {
  const connectAttempted = useRef(false);
  const connectedCameras = useRef<Set<string>>(new Set());

  const connectCamera = async (camera: typeof CAMERAS[0]) => {
    if (!room || connectedCameras.current.has(camera.id)) {
      return;
    }

    try {
      console.log(`Connecting to ${camera.name}...`);

      // Connect to go2rtc WebRTC stream using proper WebSocket protocol
      const go2rtcUrl = `ws://localhost:1984/api/ws?src=${camera.streamName}`;

      // Create WebRTC peer connection to go2rtc
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      // Handle incoming stream
      pc.ontrack = async (event) => {
        const stream = event.streams[0];
        const videoTrack = stream.getVideoTracks()[0];

        if (videoTrack) {
          // Publish camera stream to LiveKit room
          await room.localParticipant.publishTrack(videoTrack, {
            name: `${camera.name} (${camera.ip})`,
            source: Track.Source.Camera
          });

          connectedCameras.current.add(camera.id);
          console.log(`✅ ${camera.name} connected and streaming`);
        }
      };

      // Add transceiver to receive video
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer to go2rtc via WebSocket
      const ws = new WebSocket(go2rtcUrl);

      // Store WebSocket reference to keep it alive
      let wsConnected = false;

      ws.onopen = () => {
        console.log(`WebSocket connected for ${camera.name}`);
        wsConnected = true;

        // Send offer in go2rtc's expected format
        if (offer.sdp) {
          ws.send(JSON.stringify({
            type: 'webrtc/offer',
            value: offer.sdp
          }));
        }
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          console.log(`Received message for ${camera.name}:`, msg.type);

          if (msg.type === 'webrtc/answer' && msg.value) {
            // Set remote description with the answer from go2rtc
            await pc.setRemoteDescription({
              type: 'answer',
              sdp: msg.value
            });
            console.log(`Answer processed for ${camera.name}`);
          } else if (msg.type === 'webrtc/candidate' && msg.value) {
            // Add ICE candidate from go2rtc
            await pc.addIceCandidate({
              candidate: msg.value,
              sdpMid: '0',
              sdpMLineIndex: 0
            });
          }
        } catch (err) {
          console.error(`Error processing message for ${camera.name}:`, err);
        }
      };

      // Send ICE candidates to go2rtc
      pc.onicecandidate = (event) => {
        if (event.candidate && wsConnected && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'webrtc/candidate',
            value: event.candidate.candidate
          }));
        }
      };

      ws.onerror = (error) => {
        console.error(`WebSocket error for ${camera.name}:`, error);
      };

      ws.onclose = () => {
        console.log(`WebSocket closed for ${camera.name}`);
      };

    } catch (error) {
      console.error(`Error connecting ${camera.name}:`, error);
    }
  };

  const connectAllCameras = async () => {
    if (!room || !enabled || connectAttempted.current) {
      return;
    }

    connectAttempted.current = true;
    console.log('Auto-connecting all Reolink cameras...');

    // Connect cameras with 500ms delay between each to avoid overwhelming the network
    for (const camera of CAMERAS) {
      await connectCamera(camera);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('Camera auto-connect completed');
  };

  useEffect(() => {
    // Wait a bit for LiveKit room to be fully established
    const timer = setTimeout(() => {
      connectAllCameras();
    }, 2000);

    return () => clearTimeout(timer);
  }, [room, enabled]);

  // This component doesn't render anything
  return null;
}
