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

  // Create entries for each individual video track (not just participants)
  // This allows multiple videos from the same participant to be ranked separately
  const rankedTracks: VideoTrackWithScore[] = React.useMemo(() => {
    const tracks: VideoTrackWithScore[] = [];

    // Iterate through all participants
    participants.forEach((participant) => {
      // Iterate through all video track publications for this participant
      participant.videoTrackPublications.forEach((publication) => {
        if (publication.track) {
          const trackSid = publication.track.sid;
          const trackName = publication.trackName || 'Video';

          // Try multiple score ID formats for backwards compatibility
          // Format 1: participant_trackSid (new format)
          // Format 2: participant.identity (old format, for single camera)
          let score = aiScores.get(`${participant.identity}_${trackSid}`);
          if (!score && participant.videoTrackPublications.size === 1) {
            // Fallback to old format if only one track
            score = aiScores.get(participant.identity);
          }

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

    // Assign ranks (only to tracks with scores)
    let rank = 1;
    tracks.forEach((item) => {
      if (item.score) {
        item.rank = rank++;
      }
    });

    return tracks;
  }, [participants, aiScores]);

  const topTrack = rankedTracks.find(t => t.score);
  const otherTracks = topTrack ? rankedTracks.filter(t => t !== topTrack) : rankedTracks;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>AI Ranked View</h1>
          <div className={styles.statusBadge}>
            <div
              className={styles.statusIndicator}
              style={{ backgroundColor: aiConnected ? '#10b981' : '#ef4444' }}
            />
            <span className={styles.statusText}>
              {aiConnected ? 'AI Analysis Active (GPT-4o-mini)' : 'AI Disconnected'}
            </span>
          </div>
        </div>
        <div className={styles.participantCount}>
          {participants.length} {participants.length === 1 ? 'participant' : 'participants'} •
          {rankedTracks.length} {rankedTracks.length === 1 ? 'video' : 'videos'} •
          {rankedTracks.filter(t => t.score).length} ranked
        </div>
      </div>

      {/* Top Ranked Video */}
      {topTrack && topTrack.score && (
        <div className={styles.topSection}>
          <div className={styles.topLabel}>
            <span>Top Ranked</span>
          </div>
          <div className={styles.topParticipant}>
            <div className={styles.videoContainer}>
              <video
                ref={(el) => {
                  if (el && topTrack.videoTrack) {
                    topTrack.videoTrack.attach(el);
                  }
                }}
                className={styles.video}
                autoPlay
                playsInline
                muted
              />
              <AIScoreOverlay
                score={topTrack.score}
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
                        item.videoTrack.attach(el);
                      }
                    }}
                    className={styles.video}
                    autoPlay
                    playsInline
                    muted
                  />
                  {item.score && <AIScoreOverlay score={item.score} rank={item.rank} compact />}
                </div>
                <div className={styles.participantInfo}>
                  <div className={styles.participantName}>
                    {item.trackName !== 'Video' ? item.trackName : (item.participant.name || item.participant.identity)}
                  </div>
                  {item.score && (
                    <>
                      <div className={styles.scoreInfo}>
                        Score: {Math.round(item.score.score * 100)}% • Updated {new Date(item.score.timestamp).toLocaleTimeString()}
                      </div>
                      <div className={styles.reason}>
                        <strong>AI:</strong> {item.score.reason}
                      </div>
                    </>
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
          <p>Join with your camera or upload videos to see them ranked by AI</p>
        </div>
      )}
    </div>
  );
}

export default RankedView;
