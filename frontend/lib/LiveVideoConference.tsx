'use client';

import React from 'react';
import {
  VideoConference,
  useParticipants,
  ParticipantTile,
  useTrackReferences,
  useRoomContext,
  TrackReferenceOrPlaceholder,
  LayoutContextProvider,
  type MessageFormatter,
} from '@livekit/components-react';
import { Track, Participant } from 'livekit-client';
import { AIScore } from './types/ai';
import { LiveRankBadge } from './LiveRankBadge';
import styles from '../styles/LiveVideoConference.module.css';

interface LiveVideoConferenceProps {
  aiScores: Map<string, AIScore>;
  chatMessageFormatter?: MessageFormatter;
  SettingsComponent?: React.ComponentType;
}

export function LiveVideoConference({
  aiScores,
  chatMessageFormatter,
  SettingsComponent,
}: LiveVideoConferenceProps) {
  const participants = useParticipants();
  const [testMode, setTestMode] = React.useState(false);
  const [mockScores, setMockScores] = React.useState<Map<string, AIScore>>(new Map());

  // Log participants when they change
  React.useEffect(() => {
    console.log('Participants changed:', participants.map(p => ({ identity: p.identity, name: p.name })));
  }, [participants]);

  // Test mode: Press 'T' to toggle mock AI scores
  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') {
        console.log('T key pressed! Current testMode:', testMode, 'Participants:', participants.length);
        setTestMode((prev) => !prev);
        console.log('Test mode:', !testMode ? 'ENABLED' : 'DISABLED');

        if (!testMode && participants.length > 0) {
          // Generate mock scores for all participants
          const scores = new Map<string, AIScore>();
          participants.forEach((p, index) => {
            const scoreObj = {
              cam_id: p.identity,
              camId: p.identity,
              score: 0.9 - (index * 0.1), // Descending scores
              reason: `Test score ${index + 1}`,
              timestamp: Date.now(),
            };
            scores.set(p.identity, scoreObj);
            console.log('Generated mock score for', p.identity, scoreObj);
          });
          setMockScores(scores);
          console.log('Generated mock scores for', participants.length, 'participants', Array.from(scores.entries()));
        } else if (!testMode && participants.length === 0) {
          console.warn('Cannot generate mock scores: no participants detected');
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [testMode, participants]);

  // Use mock scores in test mode, otherwise use real AI scores
  const effectiveScores = testMode ? mockScores : aiScores;

  console.log('effectiveScores:', Array.from(effectiveScores.entries()));
  console.log('testMode:', testMode);

  // Calculate rankings from AI scores (use effectiveScores to support test mode)
  const participantRanks = React.useMemo<Map<string, number>>(() => {
    const ranksMap = new Map<string, number>();

    console.log('Calculating ranks for', participants.length, 'participants');
    console.log('Effective scores:', Array.from(effectiveScores.entries()));

    // Get participants with scores
    const withScores = participants
      .map((participant) => ({
        identity: participant.identity,
        score: effectiveScores.get(participant.identity)?.score ?? -1,
      }))
      .filter((p) => p.score >= 0); // Only rank participants with scores

    console.log('Participants with scores:', withScores);

    // Sort by score (highest first)
    withScores.sort((a, b) => b.score - a.score);

    // Assign ranks to ALL participants (not just top 3)
    withScores.forEach((item, index) => {
      ranksMap.set(item.identity, index + 1);
      console.log('Assigned rank', index + 1, 'to', item.identity);
    });

    console.log('Final participant ranks:', Array.from(ranksMap.entries()));

    return ranksMap;
  }, [participants, effectiveScores]);

  // Custom participant tile renderer with rank badges
  const ParticipantTileWithBadge = React.useCallback(
    ({ trackReference }: { trackReference: TrackReferenceOrPlaceholder }) => {
      const participantIdentity = trackReference.participant?.identity;
      const rank = participantIdentity ? participantRanks.get(participantIdentity) : undefined;

      return (
        <div style={{ position: 'relative', height: '100%', width: '100%' }}>
          <ParticipantTile trackReference={trackReference} />
          {rank && (
            <div className="live-rank-badge-wrapper">
              <LiveRankBadge rank={rank} />
            </div>
          )}
        </div>
      );
    },
    [participantRanks],
  );

  return (
    <div className={styles.container} style={{ position: 'relative' }}>
      {/* Custom grid that shows ALL video tracks including local participant cameras */}
      <CameraGrid participantRanks={participantRanks} aiScores={effectiveScores} />
    </div>
  );
}

// Custom grid component to display all camera feeds
function CameraGrid({ participantRanks, aiScores }: { participantRanks: Map<string, number>, aiScores: Map<string, AIScore> }) {
  const room = useRoomContext();
  const participants = useParticipants();

  // Get ALL video tracks (including local participant's camera tracks)
  const videoTracks = React.useMemo(() => {
    const tracks: Array<{ participant: Participant; trackSid: string; trackName: string; videoTrack: any; rank?: number; score?: AIScore }> = [];

    // Include local participant
    const allParticipants = [room.localParticipant, ...participants.filter(p => p !== room.localParticipant)];

    allParticipants.forEach((participant) => {
      participant.videoTrackPublications.forEach((publication) => {
        if (publication.track && publication.source === Track.Source.Camera) {
          const identity = participant.identity;
          const rank = participantRanks.get(identity);
          const score = aiScores.get(identity);

          tracks.push({
            participant,
            trackSid: publication.track.sid,
            trackName: publication.trackName || participant.name || participant.identity,
            videoTrack: publication.track,
            rank,
            score,
          });
        }
      });
    });

    return tracks;
  }, [room.localParticipant, participants, participantRanks, aiScores]);

  console.log('[CameraGrid] Rendering', videoTracks.length, 'video tracks');

  if (videoTracks.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'white',
        flexDirection: 'column',
        gap: '20px',
      }}>
        <h2>No Camera Feeds Yet</h2>
        <p>Cameras are connecting... Check the status indicator at the top.</p>
        <p style={{ fontSize: '14px', opacity: 0.7 }}>
          Expected: 3 cameras (Camera 1, 2, 3) should connect automatically
        </p>
      </div>
    );
  }

  // Calculate grid layout
  const gridCols = Math.ceil(Math.sqrt(videoTracks.length));
  const gridRows = Math.ceil(videoTracks.length / gridCols);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
        gridTemplateRows: `repeat(${gridRows}, 1fr)`,
        gap: '10px',
        height: '100%',
        padding: '10px',
        backgroundColor: '#1a1a1a',
      }}
    >
      {videoTracks.map((track) => (
        <VideoTile key={track.trackSid} track={track} />
      ))}
    </div>
  );
}

// Video tile component
function VideoTile({ track }: { track: any }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (videoRef.current && track.videoTrack) {
      try {
        track.videoTrack.attach(videoRef.current);
        console.log('[VideoTile] Attached video:', track.trackName);
      } catch (error) {
        console.error('[VideoTile] Error attaching video:', error);
      }

      return () => {
        try {
          track.videoTrack.detach(videoRef.current!);
        } catch (error) {
          // Ignore detach errors
        }
      };
    }
  }, [track.videoTrack]);

  return (
    <div
      style={{
        position: 'relative',
        backgroundColor: '#000',
        borderRadius: '8px',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />

      {/* Participant name overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: 'bold',
        }}
      >
        {track.trackName}
      </div>

      {/* Rank badge */}
      {track.rank && track.score && (
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(10px)',
            borderRadius: '12px',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            border: '3px solid #ffffff',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.8)',
          }}
        >
          <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>
            #{track.rank}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', lineHeight: 1 }}>
              Rank {track.rank}
            </span>
            <span style={{ fontSize: '12px', color: '#fff', lineHeight: 1 }}>
              {Math.round(track.score.score * 100)}% score
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Component to inject rank badges into participant tiles
function RankBadgeOverlay({ participantRanks, aiScores }: { participantRanks: Map<string, number>, aiScores: Map<string, AIScore> }) {
  React.useEffect(() => {
    console.log('=== RankBadgeOverlay ===');
    console.log('Ranks:', Array.from(participantRanks.entries()));
    console.log('Scores:', Array.from(aiScores.entries()));

    const interval = setInterval(() => {
      // Find all participant tiles in the DOM
      const participantTiles = document.querySelectorAll('[data-lk-participant-identity]');

      if (participantTiles.length > 0) {
        console.log('Found', participantTiles.length, 'participant tiles');
      }

      participantTiles.forEach((tile) => {
        const identity = tile.getAttribute('data-lk-participant-identity');
        if (!identity) return;

        const rank = participantRanks.get(identity);
        const score = aiScores.get(identity);

        // Remove existing badge
        const existingBadge = tile.querySelector('.live-rank-badge-wrapper');
        if (existingBadge) {
          existingBadge.remove();
        }

        // Add badge for ALL participants with ranks
        if (rank && score) {
          const badgeWrapper = document.createElement('div');
          badgeWrapper.className = 'live-rank-badge-wrapper';

          // Get rank label
          const getRankLabel = (position: number): string => {
            return `#${position}`;
          };

          const getRankColor = (position: number): string => {
            return '#ffffff'; // White for all ranks
          };

          const rankLabel = getRankLabel(rank);
          const color = getRankColor(rank);
          const scorePercent = Math.round(score.score * 100);

          badgeWrapper.innerHTML = `
            <div style="
              position: absolute;
              bottom: 50px;
              right: 12px;
              z-index: 9999;
              background: rgba(0, 0, 0, 0.9);
              backdrop-filter: blur(10px);
              border-radius: 12px;
              padding: 8px 14px;
              display: flex;
              align-items: center;
              gap: 8px;
              border: 3px solid ${color};
              box-shadow: 0 4px 16px rgba(0, 0, 0, 0.8), 0 0 20px ${color}40;
              pointer-events: none;
            ">
              <span style="
                font-size: 20px;
                line-height: 1;
                font-weight: bold;
                color: ${color};
              ">${rankLabel}</span>
              <div style="
                display: flex;
                flex-direction: column;
                gap: 2px;
              ">
                <span style="
                  font-size: 14px;
                  font-weight: bold;
                  color: ${color};
                  line-height: 1;
                ">Rank ${rank}</span>
                <span style="
                  font-size: 12px;
                  color: #fff;
                  line-height: 1;
                ">${scorePercent}% score</span>
              </div>
            </div>
          `;

          tile.appendChild(badgeWrapper);
          console.log('Badge added:', identity, 'rank', rank, 'score', scorePercent);
        }
      });
    }, 500);

    return () => clearInterval(interval);
  }, [participantRanks, aiScores]);

  return null; // No debug bar
}

export default LiveVideoConference;
