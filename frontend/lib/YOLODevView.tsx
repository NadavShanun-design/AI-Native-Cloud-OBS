'use client';

/**
 * YOLODevView Component - DEVELOPMENT VERSION
 * Displays YOLO object detections from the DEV backend at 1 FPS
 * Separate from production YOLO to allow experimentation without breaking existing features
 * Listens to 'yolo-dev-score' WebSocket messages from analysis-worker-dev service
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useParticipants, useRoomContext } from '@livekit/components-react';
import { Participant } from 'livekit-client';
import { AIScore, Detection } from './types/ai';
import { AIScoreOverlay } from './AIScoreOverlay';
import { DetectionOverlay, DetectionBadge, PerformanceOverlay } from './yolo/DetectionOverlay';
import styles from '../styles/YOLOView.module.css';

interface YOLODevViewProps {
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

export function YOLODevView({ aiScores, aiConnected }: YOLODevViewProps) {
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
          <h1 className={styles.title}>YOLO DEV - Development Detection (1 FPS)</h1>
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
              {aiConnected ? 'DEV Backend Active (1 FPS)' : 'DEV Backend Disconnected'}
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
          <span>•</span>
          <span style={{ color: '#10b981', fontWeight: 'bold' }}>DEV MODE</span>
        </div>
      </div>

      {/* All videos with YOLO detection boxes */}
      {rankedParticipants.length > 0 && (
        <div className={styles.gridSection}>
          <h2 className={styles.gridTitle}>All Videos with Detection (1 FPS Processing)</h2>
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
          <p>Join with your camera or add external streams to see YOLO DEV detections (1 FPS)</p>
          {!aiConnected && (
            <p className={styles.emptyStateHelp}>
              <strong>Note:</strong> YOLO DEV backend service not connected. Start the analysis-worker-dev service.
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
  const [displayDimensions, setDisplayDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (videoRef.current && data.videoTrack) {
      const videoElement = data.videoTrack.attach(videoRef.current);

      // Get video native dimensions once loaded
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

  // Track the DISPLAYED size of the video (after CSS scaling)
  useEffect(() => {
    if (!videoRef.current || !containerRef.current) return;

    const updateDisplaySize = () => {
      if (videoRef.current) {
        const rect = videoRef.current.getBoundingClientRect();
        setDisplayDimensions({
          width: rect.width,
          height: rect.height,
        });
      }
    };

    // Update on load and resize
    updateDisplaySize();
    window.addEventListener('resize', updateDisplaySize);

    // Also update when video loads
    const videoElement = videoRef.current;
    videoElement.addEventListener('loadeddata', updateDisplaySize);

    return () => {
      window.removeEventListener('resize', updateDisplaySize);
      videoElement.removeEventListener('loadeddata', updateDisplaySize);
    };
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

  // Scale detections from native video resolution to displayed resolution
  const scaledDetections = React.useMemo(() => {
    if (videoDimensions.width === 0 || displayDimensions.width === 0) return [];

    const scaleX = displayDimensions.width / videoDimensions.width;
    const scaleY = displayDimensions.height / videoDimensions.height;

    const scaled = data.detections.map(det => ({
      ...det,
      x0: det.x0 * scaleX,
      y0: det.y0 * scaleY,
      x1: det.x1 * scaleX,
      y1: det.y1 * scaleY,
    }));

    // Debug logging
    if (scaled.length > 0) {
      console.log(`[YOLO DEV] ${data.trackName}: ${scaled.length} detections`, {
        native: `${videoDimensions.width}x${videoDimensions.height}`,
        display: `${displayDimensions.width}x${displayDimensions.height}`,
        scale: `${scaleX.toFixed(2)}x, ${scaleY.toFixed(2)}y`,
        sample: scaled[0]
      });
    }

    return scaled;
  }, [data.detections, videoDimensions, displayDimensions, data.trackName]);

  return (
    <div className={styles.gridTile}>
      <div ref={containerRef} className={styles.videoContainer}>
        <video ref={videoRef} className={styles.video} autoPlay playsInline muted />

        {/* YOLO detection overlay - using scaled detections for displayed video size */}
        {displayDimensions.width > 0 && scaledDetections.length > 0 && (
          <DetectionOverlay
            detections={scaledDetections}
            width={displayDimensions.width}
            height={displayDimensions.height}
            showLabels={true}
            showConfidence={true}
            lineWidth={3}
          />
        )}

        {/* Detection badge */}
        {data.detections.length > 0 && <DetectionBadge detections={data.detections} />}

        {/* Performance info - DEV backend processing */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'rgba(16, 185, 129, 0.9)',
            padding: '6px 10px',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#fff',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            zIndex: 20,
            border: '2px solid #10b981',
          }}
        >
          DEV YOLO (1 FPS)
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

export default YOLODevView;
