/**
 * StreamView Component
 * Displays ONLY the #1 ranked video with YOLO detection overlay
 * Updates every 10 seconds based on person coverage percentage
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParticipants, useRoomContext } from '@livekit/components-react';
import { ClientSideYOLO } from './yolo/ClientSideYOLO';
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
  const room = useRoomContext();
  const participants = useParticipants();
  const [coverageScores, setCoverageScores] = useState<Map<string, number>>(new Map());
  const [stableTopTrack, setStableTopTrack] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const lastAttachedTrackSid = useRef<string | null>(null);

  // Update stable top track every 10 seconds based on person coverage
  useEffect(() => {
    // Initialize immediately
    if (!stableTopTrack && coverageScores.size > 0) {
      const sorted = Array.from(coverageScores.entries()).sort((a, b) => b[1] - a[1]);
      if (sorted.length > 0) {
        setStableTopTrack(sorted[0][0]);
        console.log(`[StreamView] 🎬 Initial top track: ${sorted[0][0]} (${(sorted[0][1] * 100).toFixed(1)}%)`);
      }
    }

    // Update every 10 seconds
    const interval = setInterval(() => {
      if (coverageScores.size > 0) {
        const sorted = Array.from(coverageScores.entries()).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) {
          const newTop = sorted[0][0];
          const currentCoverage = coverageScores.get(stableTopTrack || '') || 0;
          const newTopCoverage = sorted[0][1];

          // Hysteresis: only switch if new top is significantly better (>5% diff)
          // This prevents rapid switching between similar coverage scores
          if (!stableTopTrack || (newTopCoverage - currentCoverage) > 0.05 || newTop !== stableTopTrack) {
            if (newTop !== stableTopTrack) {
              console.log(`[StreamView] 🔄 Top track changed: ${stableTopTrack} → ${newTop} (${(sorted[0][1] * 100).toFixed(1)}%)`);
            }
            setStableTopTrack(newTop);
          }
        }
      }
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [coverageScores, stableTopTrack]);

  // Handler for coverage updates from hidden video trackers
  const handleCoverageUpdate = useCallback((trackSid: string, coverage: number) => {
    setCoverageScores(prev => {
      const updated = new Map(prev);
      updated.set(trackSid, coverage);
      return updated;
    });
  }, []);

  // Get all video tracks for coverage tracking
  const allVideoTracks = useMemo(() => {
    if (!room || !room.localParticipant) return [];

    const allParticipants = [room.localParticipant, ...participants.filter(p => p !== room.localParticipant)];
    const tracks: Array<{ trackSid: string; track: any; trackName: string }> = [];

    allParticipants.forEach((participant) => {
      participant.videoTrackPublications.forEach((publication) => {
        if (publication.track) {
          tracks.push({
            trackSid: publication.track.sid,
            track: publication.track,
            trackName: publication.trackName || 'Video'
          });
        }
      });
    });

    return tracks;
  }, [room, room?.localParticipant, participants]);

  // Get the top video track
  const topVideoTrack = useMemo(() => {
    if (!stableTopTrack) return null;

    const track = allVideoTracks.find(t => t.trackSid === stableTopTrack);
    return track || null;
  }, [stableTopTrack, allVideoTracks]);

  // Attach/detach track to video element ONLY when topVideoTrack changes
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !topVideoTrack) return;

    // Don't re-attach if it's already the same track
    if (lastAttachedTrackSid.current === topVideoTrack.trackSid) {
      console.log(`[StreamView] ✅ Track ${topVideoTrack.trackName} already attached, skipping`);
      return;
    }

    console.log(`[StreamView] 🎥 Attaching track: ${topVideoTrack.trackName} (${topVideoTrack.trackSid})`);

    // Detach previous track if any
    if (lastAttachedTrackSid.current && videoElement.srcObject) {
      const oldTracks = allVideoTracks.find(t => t.trackSid === lastAttachedTrackSid.current);
      if (oldTracks) {
        console.log(`[StreamView] 🗑️ Detaching old track: ${oldTracks.trackName}`);
        oldTracks.track.detach(videoElement);
      }
    }

    // Attach new track
    topVideoTrack.track.attach(videoElement);
    lastAttachedTrackSid.current = topVideoTrack.trackSid;

    // Mark as ready when video starts playing
    const handlePlaying = () => {
      console.log(`[StreamView] ▶️ Video playing: ${topVideoTrack.trackName}`);
      setIsVideoReady(true);
    };

    const handleLoadedData = () => {
      console.log(`[StreamView] 📊 Video loaded: ${topVideoTrack.trackName}`);
    };

    videoElement.addEventListener('playing', handlePlaying);
    videoElement.addEventListener('loadeddata', handleLoadedData);

    return () => {
      videoElement.removeEventListener('playing', handlePlaying);
      videoElement.removeEventListener('loadeddata', handleLoadedData);
      // Don't detach on cleanup - let the next track switch handle it
    };
  }, [topVideoTrack?.trackSid]); // Only re-run when track SID changes

  return (
    <div className={styles.streamContainer}>
      {/* Single video element for stable playback */}
      <div className={styles.videoWrapper}>
        {allVideoTracks.length > 0 ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={styles.videoElement}
            />

            {/* YOLO Detection Overlay */}
            {isVideoReady && videoRef.current && (
              <div className={styles.yoloOverlay}>
                <ClientSideYOLO
                  videoElement={videoRef.current}
                  enabled={true}
                  showLabels={true}
                  showConfidence={true}
                  debug={false}
                />
              </div>
            )}

            {/* Debug info overlay */}
            {topVideoTrack && (
              <div className={styles.statusOverlay}>
                <span className={styles.cameraName}>
                  🏆 {topVideoTrack.trackName}
                </span>
                <span className={styles.coverage}>
                  {((coverageScores.get(topVideoTrack.trackSid) || 0) * 100).toFixed(0)}% coverage
                </span>
              </div>
            )}
          </>
        ) : (
          <div className={styles.placeholder}>
            <div className={styles.placeholderContent}>
              <div className={styles.spinner}></div>
              <p>Waiting for video streams...</p>
              <p className={styles.placeholderHint}>
                No cameras connected. Check camera auto-connect status above.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Hidden video trackers for coverage scoring */}
      <div style={{ display: 'none' }}>
        {allVideoTracks.map((trackData) => (
          <HiddenVideoTracker
            key={trackData.trackSid}
            trackSid={trackData.trackSid}
            trackName={trackData.trackName}
            videoTrack={trackData.track}
            onCoverageUpdate={handleCoverageUpdate}
          />
        ))}
      </div>
    </div>
  );
}

// Hidden component that tracks video and reports coverage
interface HiddenVideoTrackerProps {
  trackSid: string;
  trackName: string;
  videoTrack: any;
  onCoverageUpdate: (trackSid: string, coverage: number) => void;
}

function HiddenVideoTracker({ trackSid, trackName, videoTrack, onCoverageUpdate }: HiddenVideoTrackerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Attach track to video element
  useEffect(() => {
    if (!videoRef.current || !videoTrack) return;

    const videoElement = videoRef.current;
    videoTrack.attach(videoElement);

    return () => {
      videoTrack.detach(videoElement);
    };
  }, [videoTrack]);

  return (
    <>
      <video ref={videoRef} autoPlay playsInline muted style={{ width: 160, height: 90 }} />
      {videoRef.current && (
        <ClientSideYOLO
          videoElement={videoRef.current}
          enabled={true}
          showLabels={false}
          showConfidence={false}
          debug={false}
          onCoverageUpdate={(coverage) => {
            onCoverageUpdate(trackSid, coverage);
          }}
        />
      )}
    </>
  );
}

export default StreamView;
