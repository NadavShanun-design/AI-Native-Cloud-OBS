'use client';

import React from 'react';
import { useParticipants, useRoomContext } from '@livekit/components-react';
import { AIScore } from './types/ai';
import { AIScoreOverlay } from './AIScoreOverlay';
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

  // Update stable scores every 10 seconds
  React.useEffect(() => {
    // Initialize immediately
    if (stableScores.size === 0 && aiScores.size > 0) {
      setStableScores(new Map(aiScores));
    }

    // Update every 10 seconds
    const interval = setInterval(() => {
      if (aiScores.size > 0) {
        console.log('🔄 Updating stable rankings (10-second interval)');
        setStableScores(new Map(aiScores));
      }
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [aiScores, stableScores.size]);

  // Use stable scores for ranking (updated every 10 seconds)
  const scoresForRanking = stableScores.size > 0 ? stableScores : aiScores;

  // Create entries for each individual video track (not just participants)
  // This allows multiple videos from the same participant to be ranked separately
  const rankedTracks: VideoTrackWithScore[] = React.useMemo(() => {
    const tracks: VideoTrackWithScore[] = [];

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

          // Try multiple score ID formats
          // Format 1: trackName (e.g., "Camera 1", "Camera 2") - NEW YOLO format
          // Format 2: trackSid (e.g., "TR_abc123") - fallback for unnamed tracks
          // Format 3: participant.identity - legacy format
          let score = scoresForRanking.get(trackName);
          if (!score) {
            score = scoresForRanking.get(trackSid);
          }
          if (!score) {
            score = scoresForRanking.get(participant.identity);
          }

          console.log(`[RankedView] Track lookup: trackName="${trackName}", trackSid="${trackSid}", participant="${participant.identity}"`, score ? `✅ Score=${score.score}` : '❌ No score');
          console.log(`[RankedView] Available score keys:`, Array.from(scoresForRanking.keys()));

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
  }, [room.localParticipant, participants, scoresForRanking]);

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
            <div className={styles.videoContainer}>
              <video
                ref={(el) => {
                  if (el && topTrack.videoTrack) {
                    // Set dimensions before attaching to prevent dimension detection error
                    el.style.width = '100%';
                    el.style.height = '100%';

                    try {
                      topTrack.videoTrack.attach(el);
                    } catch (error) {
                      // Suppress error
                    }
                  }
                }}
                className={styles.video}
                autoPlay
                playsInline
                muted
              />
              <AIScoreOverlay
                score={topTrack.score || { cam_id: '', camId: '', score: 0, reason: 'Analyzing...', timestamp: Date.now() }}
                rank={topTrack.rank}
                showReason={true}
              />
            </div>
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
                <div className={styles.videoContainer}>
                  <video
                    ref={(el) => {
                      if (el && item.videoTrack) {
                        // Set dimensions before attaching to prevent dimension detection error
                        el.style.width = '100%';
                        el.style.height = '100%';

                        try {
                          item.videoTrack.attach(el);
                        } catch (error) {
                          // Suppress error
                        }
                      }
                    }}
                    className={styles.video}
                    autoPlay
                    playsInline
                    muted
                  />
                  <AIScoreOverlay
                    score={item.score || { cam_id: '', camId: '', score: 0, reason: 'Analyzing...', timestamp: Date.now() }}
                    rank={item.rank}
                    compact
                  />
                </div>
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

export default RankedView;
