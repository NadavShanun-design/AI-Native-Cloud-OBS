'use client';

import React from 'react';
import { useParticipants, useRoomContext } from '@livekit/components-react';
import { AIScore } from './types/ai';
import { AIScoreOverlay } from './AIScoreOverlay';
import { ClientSideYOLO } from './yolo/ClientSideYOLO';
import { Participant } from 'livekit-client';
import styles from '../styles/RankedView.module.css';

interface RankedViewProps {
  aiScores: Map<string, AIScore>;
  aiConnected: boolean;
}

interface VideoTrackWithScore {
  participant: Participant;
  trackSid: string;
  trackName: string;
  videoTrack: any;
  score?: AIScore;
  rank?: number;
}

export function RankedView({ aiScores, aiConnected }: RankedViewProps) {
  const room = useRoomContext();
  const participants = useParticipants();
  const [stableScores, setStableScores] = React.useState<Map<string, AIScore>>(new Map());
  const [coverageScores, setCoverageScores] = React.useState<Map<string, number>>(new Map());

  // Handler for coverage updates from individual video tiles
  const handleCoverageUpdate = React.useCallback((trackSid: string, coverage: number) => {
    setCoverageScores(prev => {
      const updated = new Map(prev);
      updated.set(trackSid, coverage);
      return updated;
    });
  }, []);

  // Update stable scores every 10 seconds
  React.useEffect(() => {
    // Initialize immediately on first aiScores
    if (stableScores.size === 0 && aiScores.size > 0) {
      console.log('🎬 Initial stable scores set:', aiScores.size, 'scores');
      setStableScores(new Map(aiScores));
    }

    // Update every 10 seconds
    const interval = setInterval(() => {
      if (aiScores.size > 0) {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`🔄 [${timestamp}] Updating stable rankings (10-second interval)`);
        console.log('   Current aiScores:', Array.from(aiScores.entries()).map(([k, v]) => `${k}=${v.score.toFixed(2)}`));
        setStableScores(new Map(aiScores));
      }
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [aiScores]); // Only depend on aiScores, not stableScores.size

  // Use stable scores for ranking (updated every 10 seconds)
  const scoresForRanking = stableScores.size > 0 ? stableScores : aiScores;

  // Create entries for each individual video track (not just participants)
  // This allows multiple videos from the same participant to be ranked separately
  const rankedTracks: VideoTrackWithScore[] = React.useMemo(() => {
    const tracks: VideoTrackWithScore[] = [];

    // Check if room and localParticipant are ready
    if (!room || !room.localParticipant) {
      return tracks;
    }

    // Include local participant (where cameras are published) AND remote participants
    const allParticipants = [room.localParticipant, ...participants.filter(p => p !== room.localParticipant)];

    console.log('[RankedView] Processing participants:', allParticipants.length, '(including local)');
    console.log('[RankedView] Available scores:', Array.from(scoresForRanking.keys()));

    // Iterate through all participants (including local)
    allParticipants.forEach((participant) => {
      // Iterate through all video track publications for this participant
      participant.videoTrackPublications.forEach((publication) => {
        if (publication.track) {
          const trackSid = publication.track.sid;
          const trackName = publication.trackName || 'Video';

          // Use client-side coverage score (from YOLO detection)
          const coverage = coverageScores.get(trackSid) || 0;

          // Create a score object using the coverage
          const score: AIScore = {
            cam_id: trackSid,
            camId: trackSid,
            score: coverage,
            reason: coverage > 0 ? 'Person detected' : 'Analyzing...',
            timestamp: Date.now()
          };

          console.log(`[RankedView] Track: "${trackName}" (${trackSid}) - Coverage: ${(coverage * 100).toFixed(1)}%`);

          tracks.push({
            participant,
            trackSid,
            trackName,
            videoTrack: publication.track,
            score,
          });
        }
      });
    });

    // Sort by score (highest first), tracks without scores go last
    tracks.sort((a, b) => {
      const scoreA = a.score?.score ?? -1;
      const scoreB = b.score?.score ?? -1;
      return scoreB - scoreA;
    });

    // Assign ranks to ALL tracks (even without scores)
    tracks.forEach((item, index) => {
      item.rank = index + 1;
    });

    console.log('[RankedView] Ranked tracks:', tracks.map(t => ({ name: t.trackName, rank: t.rank, score: t.score?.score })));

    return tracks;
  }, [room.localParticipant, participants, coverageScores]);

  // Top track is always rank #1, even without scores
  const topTrack = rankedTracks[0];
  const otherTracks = rankedTracks.slice(1);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>YOLO Person Detection Ranked View</h1>
          <div className={styles.statusBadge}>
            <div
              className={styles.statusIndicator}
              style={{ backgroundColor: aiConnected ? '#10b981' : '#ef4444' }}
            />
            <span className={styles.statusText}>
              {aiConnected ? 'YOLO Detection Active' : 'Detection Disconnected'}
            </span>
          </div>
        </div>
        <div className={styles.participantCount}>
          {participants.length} {participants.length === 1 ? 'participant' : 'participants'} •
          {rankedTracks.length} {rankedTracks.length === 1 ? 'video' : 'videos'} ranked •
          {rankedTracks.filter(t => t.score).length} with scores
        </div>
      </div>

      {/* Top Ranked Video */}
      {topTrack && (
        <div className={styles.topSection}>
          <div className={styles.topLabel}>
            <span>Top Ranked - #{topTrack.rank}</span>
          </div>
          <div className={styles.topParticipant}>
            <VideoTileWithYOLO
              track={topTrack}
              isTopRanked={true}
              onCoverageUpdate={handleCoverageUpdate}
            />
            <div className={styles.participantName}>
              {topTrack.trackName !== 'Video' ? topTrack.trackName : (topTrack.participant.name || topTrack.participant.identity)}
            </div>
          </div>
        </div>
      )}

      {/* All Videos Grid */}
      {otherTracks.length > 0 && (
        <div className={styles.gridSection}>
          <h2 className={styles.gridTitle}>All Videos</h2>
          <div className={styles.grid}>
            {otherTracks.map((item) => (
              <div
                key={`${item.participant.identity}_${item.trackSid}`}
                className={styles.gridItem}
                style={{
                  borderColor: item.rank === 2 ? '#c0c0c0' : item.rank === 3 ? '#cd7f32' : '#374151',
                }}
              >
                <VideoTileWithYOLO
                  track={item}
                  isTopRanked={false}
                  onCoverageUpdate={handleCoverageUpdate}
                />
                <div className={styles.participantInfo}>
                  <div className={styles.participantName}>
                    {item.trackName !== 'Video' ? item.trackName : (item.participant.name || item.participant.identity)}
                  </div>
                  {item.score ? (
                    <>
                      <div className={styles.scoreInfo}>
                        Score: {Math.round(item.score.score * 100)}% • Updated {new Date(item.score.timestamp).toLocaleTimeString()}
                      </div>
                      <div className={styles.reason}>
                        <strong>Detection:</strong> {item.score.reason}
                      </div>
                    </>
                  ) : (
                    <div className={styles.scoreInfo}>
                      Waiting for detection data...
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No videos message */}
      {rankedTracks.length === 0 && (
        <div className={styles.emptyState}>
          <h3>No videos yet</h3>
          <p>Join with your camera or upload videos to see them ranked by person detection</p>
        </div>
      )}
    </div>
  );
}

// Helper component for video tile with YOLO detection overlay
interface VideoTileWithYOLOProps {
  track: VideoTrackWithScore;
  isTopRanked: boolean;
  onCoverageUpdate?: (trackSid: string, coverage: number) => void;
}

function VideoTileWithYOLO({ track, isTopRanked, onCoverageUpdate }: VideoTileWithYOLOProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [videoDimensions, setVideoDimensions] = React.useState({ width: 0, height: 0 });
  const [displayDimensions, setDisplayDimensions] = React.useState({ width: 0, height: 0 });
  const [isReady, setIsReady] = React.useState(false);
  const [currentCoverage, setCurrentCoverage] = React.useState(0);

  // Track video native dimensions
  React.useEffect(() => {
    if (videoRef.current && track.videoTrack) {
      const videoElement = videoRef.current;

      // Set dimensions before attaching to prevent dimension detection error
      videoElement.style.width = '100%';
      videoElement.style.height = '100%';

      try {
        track.videoTrack.attach(videoElement);
      } catch (error) {
        // Suppress error
      }

      const handleMetadata = () => {
        const nativeWidth = videoElement.videoWidth;
        const nativeHeight = videoElement.videoHeight;

        console.log(`[RankedView] ${track.trackName} native dimensions: ${nativeWidth}x${nativeHeight}`);

        setVideoDimensions({
          width: nativeWidth,
          height: nativeHeight,
        });
      };

      if (videoElement.readyState >= 2) {
        handleMetadata();
      } else {
        videoElement.addEventListener('loadedmetadata', handleMetadata);
      }

      return () => {
        videoElement.removeEventListener('loadedmetadata', handleMetadata);
      };
    }
  }, [track.videoTrack, track.trackName]);

  // Track displayed dimensions (after CSS)
  React.useEffect(() => {
    if (!videoRef.current || !containerRef.current) return;

    const updateDisplaySize = () => {
      if (videoRef.current && containerRef.current) {
        const videoRect = videoRef.current.getBoundingClientRect();

        const displayWidth = Math.floor(videoRect.width);
        const displayHeight = Math.floor(videoRect.height);

        setDisplayDimensions({
          width: displayWidth,
          height: displayHeight,
        });

        // Mark as ready when we have both dimensions
        if (displayWidth > 0 && displayHeight > 0 && videoDimensions.width > 0) {
          setIsReady(true);
        }
      }
    };

    // Update immediately and on events
    const timer = setTimeout(updateDisplaySize, 100);
    updateDisplaySize();

    window.addEventListener('resize', updateDisplaySize);
    const videoElement = videoRef.current;
    videoElement.addEventListener('loadeddata', updateDisplaySize);
    videoElement.addEventListener('playing', updateDisplaySize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateDisplaySize);
      videoElement.removeEventListener('loadeddata', updateDisplaySize);
      videoElement.removeEventListener('playing', updateDisplaySize);
    };
  }, [track.videoTrack, videoDimensions.width, track.trackName]);

  // Get detections from score
  const detections = track.score?.detections || [];

  // DEBUG: Log detection status
  React.useEffect(() => {
    console.log(`[RankedView - ${track.trackName}] Detection status:`, {
      hasScore: !!track.score,
      detectionCount: detections.length,
      isReady,
      videoDims: videoDimensions,
      displayDims: displayDimensions,
      score: track.score?.score,
      detections: detections.slice(0, 2) // Log first 2 detections
    });
  }, [track.score, detections.length, isReady, track.trackName]);

  return (
    <div ref={containerRef} className={styles.videoContainer}>
      <video
        ref={videoRef}
        className={styles.video}
        autoPlay
        playsInline
        muted
      />

      {/* Client-Side YOLO detection - runs in browser */}
      {isReady && videoRef.current && (
        <ClientSideYOLO
          videoElement={videoRef.current}
          enabled={true}
          showLabels={true}
          showConfidence={true}
          debug={false}
          onCoverageUpdate={(coverage) => {
            setCurrentCoverage(coverage);
            if (onCoverageUpdate) {
              onCoverageUpdate(track.trackSid, coverage);
            }
          }}
        />
      )}

      {/* AI Score Overlay */}
      <AIScoreOverlay
        score={{
          cam_id: track.trackSid,
          camId: track.trackSid,
          score: currentCoverage,
          reason: currentCoverage > 0 ? 'Person detected' : 'Analyzing...',
          timestamp: Date.now()
        }}
        rank={track.rank}
        showReason={isTopRanked}
        compact={!isTopRanked}
      />
    </div>
  );
}

export default RankedView;
