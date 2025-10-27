'use client';

/**
 * YOLOView Component - SIMPLIFIED VERSION
 * Displays YOLO object detections from backend (no browser processing)
 * Renders bounding boxes received via WebSocket from Python YOLO backend
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useParticipants, useRoomContext } from '@livekit/components-react';
import { Participant } from 'livekit-client';
import { AIScore, Detection } from './types/ai';
import { AIScoreOverlay } from './AIScoreOverlay';
import { DetectionOverlay, DetectionBadge, PerformanceOverlay } from './yolo/DetectionOverlay';
import styles from '../styles/YOLOView.module.css';

interface YOLOViewProps {
  aiScores: Map<string, AIScore>;
  aiConnected: boolean;
}

interface ParticipantWithDetections {
  participant: Participant;
  trackSid: string;
  trackName: string;
  videoTrack: any;
  score?: AIScore;
  rank?: number;
  detections: Detection[];
}

export function YOLOView({ aiScores, aiConnected }: YOLOViewProps) {
  const room = useRoomContext();
  const participants = useParticipants();

  // Map participants to their detections from backend
  const participantData = useMemo(() => {
    const data: ParticipantWithDetections[] = [];

    // Include local participant (where cameras are published) AND remote participants
    const allParticipants = [room.localParticipant, ...participants.filter(p => p !== room.localParticipant)];

    allParticipants.forEach((participant) => {
      participant.videoTrackPublications.forEach((publication) => {
        if (publication.track) {
          const trackSid = publication.track.sid;
          const trackName = publication.trackName || 'Video';

          // Try to get score/detections for this track
          // Format 1: participant_trackSid
          // Format 2: participant.identity (backend uses this)
          let score = aiScores.get(`${participant.identity}_${trackSid}`);
          if (!score) {
            score = aiScores.get(participant.identity);
          }

          // Extract detections from backend score data
          const detections = score?.detections || [];

          data.push({
            participant,
            trackSid,
            trackName,
            videoTrack: publication.track,
            score,
            detections,
          });
        }
      });
    });

    return data;
  }, [room.localParticipant, participants, aiScores]);

  // Rank participants by AI score (person coverage)
  const rankedParticipants = useMemo(() => {
    const ranked = [...participantData];

    // Sort by score (highest first)
    ranked.sort((a, b) => {
      const scoreA = a.score?.score ?? 0;
      const scoreB = b.score?.score ?? 0;
      return scoreB - scoreA;
    });

    // Assign ranks
    ranked.forEach((item, index) => {
      item.rank = index + 1;
    });

    return ranked;
  }, [participantData]);

  // Calculate total detection stats
  const totalStats = useMemo(() => {
    const stats = {
      totalObjects: 0,
      persons: 0,
      vehicles: 0,
      animals: 0,
      other: 0,
    };

    rankedParticipants.forEach((p) => {
      stats.totalObjects += p.detections.length;
      stats.persons += p.detections.filter((d) => d.className === 'person').length;
      stats.vehicles += p.detections.filter((d) =>
        ['car', 'truck', 'bus', 'motorcycle', 'bicycle'].includes(d.className)
      ).length;
      stats.animals += p.detections.filter((d) =>
        ['dog', 'cat', 'bird', 'horse', 'sheep', 'cow'].includes(d.className)
      ).length;
    });
    stats.other = stats.totalObjects - stats.persons - stats.vehicles - stats.animals;

    return stats;
  }, [rankedParticipants]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>YOLO Object Detection (Backend Powered)</h1>
          <div className={styles.statusBadge} style={{ marginLeft: '16px' }}>
            <div
              className={styles.statusIndicator}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: aiConnected ? '#10b981' : '#ef4444',
                marginRight: '8px'
              }}
            />
            <span style={{ fontSize: '14px', color: '#9ca3af' }}>
              {aiConnected ? 'Backend YOLO Active' : 'Backend Disconnected'}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className={styles.stats}>
          <span>{participants.length} participants</span>
          <span>•</span>
          <span>{rankedParticipants.length} videos</span>
          <span>•</span>
          <span>{totalStats.totalObjects} objects detected</span>
          {totalStats.persons > 0 && (
            <>
              <span>•</span>
              <span>{totalStats.persons} persons</span>
            </>
          )}
          {totalStats.vehicles > 0 && (
            <>
              <span>•</span>
              <span>{totalStats.vehicles} vehicles</span>
            </>
          )}
        </div>
      </div>

      {/* All videos with YOLO detection boxes */}
      {rankedParticipants.length > 0 && (
        <div className={styles.gridSection}>
          <h2 className={styles.gridTitle}>All Videos with Detection</h2>
          <div className={styles.grid}>
            {rankedParticipants.map((data) => (
              <VideoTile
                key={`${data.participant.identity}_${data.trackSid}`}
                data={data}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {rankedParticipants.length === 0 && (
        <div className={styles.emptyState}>
          <h3>No videos yet</h3>
          <p>Join with your camera or add external streams to see YOLO detections</p>
          {!aiConnected && (
            <p className={styles.emptyStateHelp}>
              <strong>Note:</strong> Backend YOLO service not connected.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Sub-component for video tile
interface VideoTileProps {
  data: ParticipantWithDetections;
}

function VideoTile({ data }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (videoRef.current && data.videoTrack) {
      const videoElement = data.videoTrack.attach(videoRef.current);

      // Get video dimensions once loaded
      const handleMetadata = () => {
        setVideoDimensions({
          width: videoElement.videoWidth,
          height: videoElement.videoHeight,
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
  }, [data.videoTrack]);

  // Detection stats
  const personCount = data.detections.filter((d) => d.className === 'person').length;
  const vehicleCount = data.detections.filter((d) =>
    ['car', 'truck', 'bus', 'motorcycle', 'bicycle'].includes(d.className)
  ).length;
  const animalCount = data.detections.filter((d) =>
    ['dog', 'cat', 'bird', 'horse', 'sheep', 'cow'].includes(d.className)
  ).length;
  const otherCount = data.detections.length - personCount - vehicleCount - animalCount;

  return (
    <div className={styles.gridTile}>
      <div className={styles.videoContainer}>
        <video ref={videoRef} className={styles.video} autoPlay playsInline muted />

        {/* YOLO detection overlay - using backend detections */}
        {videoDimensions.width > 0 && data.detections.length > 0 && (
          <DetectionOverlay
            detections={data.detections}
            width={videoDimensions.width}
            height={videoDimensions.height}
            showLabels={true}
            showConfidence={true}
            lineWidth={2}
          />
        )}

        {/* Detection badge */}
        {data.detections.length > 0 && <DetectionBadge detections={data.detections} />}

        {/* Performance info - backend processing */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'rgba(0, 0, 0, 0.7)',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#10b981',
            fontFamily: 'monospace',
            zIndex: 20,
          }}
        >
          Backend YOLO
        </div>
      </div>

      {/* Info panel */}
      <div className={styles.info}>
        <div className={styles.participantName}>
          {data.trackName !== 'Video' ? data.trackName : data.participant.name || data.participant.identity}
        </div>

        {/* Detection summary */}
        <div className={styles.detectionSummary}>
          {personCount > 0 && <span className={styles.badge}>{personCount} person(s)</span>}
          {vehicleCount > 0 && <span className={styles.badge}>{vehicleCount} vehicle(s)</span>}
          {animalCount > 0 && <span className={styles.badge}>{animalCount} animal(s)</span>}
          {otherCount > 0 && <span className={styles.badge}>{otherCount} other</span>}
          {data.detections.length === 0 && <span className={styles.badge}>No objects detected</span>}
        </div>

        {/* AI score */}
        {data.score && (
          <div className={styles.scoreDetails}>
            <div className={styles.scoreValue}>Coverage: {Math.round(data.score.score * 100)}%</div>
            <div className={styles.reason}>{data.score.reason}</div>
            <div className={styles.timestamp}>Updated {new Date(data.score.timestamp).toLocaleTimeString()}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default YOLOView;
