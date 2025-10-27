'use client';

import React, { useState } from 'react';
import { Room, Track } from 'livekit-client';
import { convertForLiveKit, convertForLiveKitFallback } from './convertForLiveKit';
import styles from '../styles/ExternalStreamModal.module.css';

interface ExternalStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
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

export function ExternalStreamModal({ isOpen, onClose, room }: ExternalStreamModalProps) {
  const [activeTab, setActiveTab] = useState<'url' | 'file' | 'camera'>('url');
  const [streamUrl, setStreamUrl] = useState('');
  const [streamName, setStreamName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room || !streamUrl.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      // For RTMP streams, you would typically use server-side API
      // For now, we'll handle file uploads or WebRTC streams
      if (streamUrl.startsWith('rtmp://') || streamUrl.startsWith('rtmps://')) {
        // Handle RTMP streams via server API
        const response = await fetch('/api/external-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            streamUrl,
            streamName: streamName || 'External Stream',
            roomName: room.name
          })
        });

        if (!response.ok) {
          throw new Error('Failed to add RTMP stream');
        }
      } else if (streamUrl.startsWith('http')) {
        // Handle HTTP video streams
      const video = document.createElement('video');
      video.src = streamUrl;
      video.crossOrigin = 'anonymous';
      video.muted = false; // Enable audio for external streams
        
        await new Promise((resolve, reject) => {
          video.onloadedmetadata = resolve;
          video.onerror = reject;
        });

        // Use the new LiveKit converter for optimal color space handling
        let stream: MediaStream;
        try {
          // Try WebCodecs approach first (modern browsers)
          stream = await convertForLiveKit(video, {
            targetWidth: 1280,
            targetHeight: 720,
            frameRate: 30,
            enableHardwareAcceleration: true
          });
        } catch (error) {
          console.warn('WebCodecs not available, falling back to canvas method:', error);
          // Fallback to canvas method for older browsers
          stream = convertForLiveKitFallback(video, {
            targetWidth: 1280,
            targetHeight: 720,
            frameRate: 30
          });
        }
        
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];
        
        // Publish video track with custom name to distinguish from camera
        const currentUser = room.localParticipant.identity;
        await room.localParticipant.publishTrack(videoTrack, {
          name: `${streamName || 'External Stream'} (by ${currentUser})`,
          source: Track.Source.Camera
        });
        
        // Publish audio track if available
        if (audioTrack) {
          await room.localParticipant.publishTrack(audioTrack, {
            name: `${streamName || 'External Stream'} Audio (by ${currentUser})`,
            source: Track.Source.Microphone
          });
        }
      }

      onClose();
      setStreamUrl('');
      setStreamName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add external stream');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCameraConnect = async (cameraId: string) => {
    if (!room) return;

    setIsLoading(true);
    setError('');

    try {
      const camera = CAMERAS.find(c => c.id === cameraId);
      if (!camera) throw new Error('Camera not found');

      console.log(`Connecting to ${camera.name}...`);

      // Connect to go2rtc WebRTC stream using proper WebSocket protocol
      const go2rtcUrl = `ws://localhost:1984/api/ws?src=${camera.streamName}`;

      // Create WebRTC peer connection to go2rtc
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      // Track connection success
      let connectionEstablished = false;

      // Handle incoming stream
      pc.ontrack = async (event) => {
        const stream = event.streams[0];
        const videoTrack = stream.getVideoTracks()[0];

        if (videoTrack) {
          // Publish camera stream to LiveKit room
          await room.localParticipant.publishTrack(videoTrack, {
            name: camera.name,  // Just "Camera 1", "Camera 2", etc.
            source: Track.Source.Camera
          });

          connectionEstablished = true;
          console.log(`${camera.name} connected and published to LiveKit from ${camera.ip}`);
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
          throw err;
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
        throw new Error(`WebSocket error connecting to ${camera.name}`);
      };

      ws.onclose = () => {
        console.log(`WebSocket closed for ${camera.name}`);
      };

      // Wait a bit for connection to establish
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (connectionEstablished) {
        onClose();
      } else {
        throw new Error('Camera connection timeout - check go2rtc service and camera availability');
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect camera');
      console.error('Camera connection error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !room) return;

    setIsLoading(true);
    setError('');

    try {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.muted = false; // Enable audio for uploaded files
      
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = reject;
      });

      // Start playing the video
      video.play();
      
      // Use the new LiveKit converter for optimal color space handling
      let stream: MediaStream;
      try {
        // Try WebCodecs approach first (modern browsers)
        stream = await convertForLiveKit(video, {
          targetWidth: 1280,
          targetHeight: 720,
          frameRate: 30,
          enableHardwareAcceleration: true
        });
      } catch (error) {
        console.warn('WebCodecs not available, falling back to canvas method:', error);
        // Fallback to canvas method for older browsers
        stream = convertForLiveKitFallback(video, {
          targetWidth: 1280,
          targetHeight: 720,
          frameRate: 30
        });
      }
      
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      
      // Publish video track with custom name to distinguish from camera
      const currentUser = room.localParticipant.identity;
      await room.localParticipant.publishTrack(videoTrack, {
        name: `Uploaded Video (by ${currentUser})`,
        source: Track.Source.Camera
      });
      
      // Publish audio track if available
      if (audioTrack) {
        await room.localParticipant.publishTrack(audioTrack, {
          name: `Uploaded Video Audio (by ${currentUser})`,
          source: Track.Source.Microphone
        });
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Add Stream or Camera</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'camera' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('camera')}
          >
            IP Cameras
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'url' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('url')}
          >
            Stream URL
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'file' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('file')}
          >
            Upload File
          </button>
        </div>

        {/* Camera Tab */}
        {activeTab === 'camera' && (
          <div className={styles.cameraGrid}>
            <p className={styles.cameraInfo}>Select a Reolink camera to add to the room:</p>
            {CAMERAS.map((camera) => (
              <button
                key={camera.id}
                type="button"
                onClick={() => handleCameraConnect(camera.id)}
                disabled={isLoading}
                className={styles.cameraButton}
              >
                <div className={styles.cameraName}>{camera.name}</div>
                <div className={styles.cameraIp}>{camera.ip}</div>
              </button>
            ))}
            {error && <div className={styles.error}>{error}</div>}
          </div>
        )}

        {/* URL Tab */}
        {activeTab === 'url' && (
          <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="streamName">Stream Name (Optional)</label>
            <input
              id="streamName"
              type="text"
              value={streamName}
              onChange={(e) => setStreamName(e.target.value)}
              placeholder="My External Stream"
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="streamUrl">Stream URL</label>
            <input
              id="streamUrl"
              type="url"
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              placeholder="rtmp://example.com/live/stream or https://example.com/video.mp4"
              required
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <button type="button" onClick={onClose} className={styles.cancelButton}>
              Cancel
            </button>
            <button type="submit" disabled={isLoading || !streamUrl.trim()} className={styles.submitButton}>
              {isLoading ? 'Adding...' : 'Add Stream'}
            </button>
          </div>
        </form>
        )}

        {/* File Upload Tab */}
        {activeTab === 'file' && (
          <div className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="fileUpload">Upload Video File</label>
              <input
                id="fileUpload"
                type="file"
                accept="video/*"
                onChange={handleFileUpload}
                className={styles.fileInput}
              />
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.actions}>
              <button type="button" onClick={onClose} className={styles.cancelButton}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

