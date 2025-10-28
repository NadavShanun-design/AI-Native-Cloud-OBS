/**
 * StreamView Component
 * Displays the #1 ranked video with AI narration (text overlay + audio)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Track } from 'livekit-client';
import { VideoTrack, useParticipants } from '@livekit/components-react';
import AudioPlayer from './AudioPlayer';
import styles from '../styles/StreamView.module.css';

interface AIScore {
  cam_id: string;
  camId: string;
  score: number;
  reason: string;
  timestamp: number;
  detections?: any[];
}

interface Narration {
  cam_id: string;
  text: string;
  audio_url: string;
  timestamp: number;
}

interface StreamViewProps {
  aiScores: Map<string, AIScore>;
  currentNarration: Narration | null;
}

export function StreamView({ aiScores, currentNarration }: StreamViewProps) {
  const [audioVolume, setAudioVolume] = useState(0.8);
  const [showNarration, setShowNarration] = useState(false);
  const [stableTopCamera, setStableTopCamera] = useState<string | null>(null);
  const participants = useParticipants();

  // Find current #1 ranked camera (instant)
  const currentTopCamera = useMemo(() => {
    if (aiScores.size === 0) return null;

    const sorted = Array.from(aiScores.entries())
      .sort((a, b) => b[1].score - a[1].score);

    if (sorted.length > 0) {
      return sorted[0][0]; // Return cam_id of top camera
    }

    return null;
  }, [aiScores]);

  // Update stable top camera only every 10 seconds
  useEffect(() => {
    // Set initial top camera immediately
    if (!stableTopCamera && currentTopCamera) {
      setStableTopCamera(currentTopCamera);
    }

    // Update every 10 seconds
    const interval = setInterval(() => {
      if (currentTopCamera && currentTopCamera !== stableTopCamera) {
        console.log(`🏆 Ranking switched from ${stableTopCamera} to ${currentTopCamera}`);
        setStableTopCamera(currentTopCamera);
      }
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [currentTopCamera, stableTopCamera]);

  // Use stable camera for display
  const topCamera = stableTopCamera;

  // Get video track for top camera
  const topVideoTrack = useMemo(() => {
    if (!topCamera || participants.length === 0) return null;

    for (const participant of participants) {
      // Iterate through video tracks
      const videoTracks = Array.from(participant.videoTracks.values());

      for (const publication of videoTracks) {
        if (publication.track) {
          // Check if this participant/track matches our top camera
          const identity = participant.identity.toLowerCase();
          const trackName = publication.track.name?.toLowerCase() || '';
          const trackSid = publication.trackSid?.toLowerCase() || '';
          const topCamLower = topCamera.toLowerCase();

          // Match by identity, track name, or track SID
          if (
            identity.includes(topCamLower) ||
            trackName.includes(topCamLower) ||
            trackSid.includes(topCamLower) ||
            topCamLower.includes(trackName) ||
            topCamLower.includes(identity)
          ) {
            return publication.track;
          }
        }
      }
    }

    return null;
  }, [topCamera, participants]);

  // Show narration text with fade effect
  useEffect(() => {
    if (currentNarration) {
      setShowNarration(true);

      // Auto-hide after 8 seconds
      const timer = setTimeout(() => {
        setShowNarration(false);
      }, 8000);

      return () => clearTimeout(timer);
    }
  }, [currentNarration]);

  return (
    <div className={styles.streamContainer}>
      {/* Video Display */}
      <div className={styles.videoWrapper}>
        {topVideoTrack ? (
          <>
            <VideoTrack
              track={topVideoTrack}
              className={styles.videoElement}
            />

            {/* Top Camera Badge */}
            <div className={styles.topBadge}>
              <span className={styles.badgeIcon}>🏆</span>
              <span className={styles.badgeText}>
                {topCamera} - Top Ranked
              </span>
            </div>

            {/* Text Overlay */}
            {showNarration && currentNarration && (
              <div className={`${styles.textOverlay} ${styles.fadeIn}`}>
                <p className={styles.narrationText}>
                  {currentNarration.text}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className={styles.placeholder}>
            <div className={styles.placeholderContent}>
              <div className={styles.spinner}></div>
              <p>Waiting for top-ranked video...</p>
              {topCamera && (
                <p className={styles.placeholderHint}>
                  Looking for: {topCamera}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Audio Player (hidden, auto-plays) */}
      {currentNarration && (
        <AudioPlayer
          src={`http://localhost:3000${currentNarration.audio_url}`}
          volume={audioVolume}
          autoPlay
        />
      )}

      {/* Volume Control */}
      <div className={styles.controls}>
        <div className={styles.volumeControl}>
          <span className={styles.volumeIcon}>🔊</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={audioVolume}
            onChange={(e) => setAudioVolume(parseFloat(e.target.value))}
            className={styles.volumeSlider}
          />
          <span className={styles.volumeValue}>
            {Math.round(audioVolume * 100)}%
          </span>
        </div>
      </div>

      {/* Debug Info (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className={styles.debugInfo}>
          <p><strong>Top Camera:</strong> {topCamera || 'None'}</p>
          <p><strong>Score:</strong> {topCamera && aiScores.get(topCamera)?.score.toFixed(2)}</p>
          <p><strong>Narration:</strong> {currentNarration ? 'Active' : 'None'}</p>
          <p><strong>Participants:</strong> {participants.length}</p>
        </div>
      )}
    </div>
  );
}

export default StreamView;
