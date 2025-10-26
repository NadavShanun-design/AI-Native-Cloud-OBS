'use client';

/**
 * YOLOView Component
 * Main view for YOLO object detection integrated with AI ranking
 * Combines real-time object detection with existing AI scoring system
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useParticipants, useRoomContext } from '@livekit/components-react';
import { Participant } from 'livekit-client';
import { AIScore } from './types/ai';
import { AIScoreOverlay } from './AIScoreOverlay';
import { YOLOService, Detection } from './yolo/YOLOService';
import { DetectionOverlay, DetectionBadge, PerformanceOverlay } from './yolo/DetectionOverlay';
import styles from '../styles/YOLOView.module.css';

interface YOLOViewProps {
  aiScores: Map<string, AIScore>;
  aiConnected: boolean;
}

interface ParticipantWithYOLO {
  participant: Participant;
  trackSid: string;
  trackName: string;
  videoTrack: any;
  score?: AIScore;
  rank?: number;
  detections: Detection[];
  yoloFps: number;
  inferenceTime: number;
}

export function YOLOView({ aiScores, aiConnected }: YOLOViewProps) {
  const room = useRoomContext();
  const participants = useParticipants();

  // YOLO service instance (singleton)
  const yoloService = useMemo(() => {
    return new YOLOService({
      modelPath: '/models/yolo11n_256.onnx',
      inputSize: [256, 256],
      confidenceThreshold: 0.25,
      iouThreshold: 0.4,
    });
  }, []);

  const [yoloReady, setYoloReady] = useState(false);
  const [yoloLoading, setYoloLoading] = useState(true);
  const [yoloError, setYoloError] = useState<string | null>(null);
  const [participantData, setParticipantData] = useState<Map<string, ParticipantWithYOLO>>(
    new Map()
  );

  // View mode toggle
  const [viewMode, setViewMode] = useState<'detections' | 'ranked' | 'combined'>('combined');
  const [showDetections, setShowDetections] = useState(true);
  const [showScores, setShowScores] = useState(true);

  // Initialize YOLO model
  useEffect(() => {
    const initYOLO = async () => {
      try {
        setYoloLoading(true);
        setYoloError(null);
        console.log('[YOLOView] Initializing YOLO service...');

        await yoloService.initialize();

        setYoloReady(true);
        setYoloLoading(false);
        console.log('[YOLOView] ✅ YOLO service ready');
      } catch (error) {
        console.error('[YOLOView] ❌ Failed to initialize YOLO:', error);
        setYoloError(error instanceof Error ? error.message : String(error));
        setYoloLoading(false);
      }
    };

    initYOLO();

    // Cleanup on unmount
    return () => {
      yoloService.dispose();
    };
  }, [yoloService]);

  // Process video tracks with YOLO
  useEffect(() => {
    if (!yoloReady) return;

    const processIntervals: Map<string, NodeJS.Timeout> = new Map();
    const videoElements: Map<string, HTMLVideoElement> = new Map();

    participants.forEach((participant) => {
      participant.videoTrackPublications.forEach((publication) => {
        if (publication.track) {
          const trackKey = `${participant.identity}_${publication.track.sid}`;

          // Skip if already processing
          if (processIntervals.has(trackKey)) return;

          // Create video element for this track
          const videoElement = document.createElement('video');
          videoElement.autoplay = true;
          videoElement.muted = true;
          videoElement.playsInline = true;

          // Attach track to video element
          publication.track.attach(videoElement);
          videoElements.set(trackKey, videoElement);

          // Wait for video to be ready
          const startProcessing = () => {
            const processFrame = async () => {
              try {
                if (videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
                  const startTime = performance.now();
                  const detections = await yoloService.detect(videoElement);
                  const perf = yoloService.getPerformance();

                  // Update participant data
                  setParticipantData((prev) => {
                    const updated = new Map(prev);
                    const existing = updated.get(trackKey);

                    updated.set(trackKey, {
                      participant,
                      trackSid: publication.track!.sid,
                      trackName: publication.trackName || 'Video',
                      videoTrack: publication.track,
                      score:
                        aiScores.get(`${participant.identity}_${publication.track!.sid}`) ||
                        aiScores.get(participant.identity),
                      detections,
                      yoloFps: perf?.fps || 0,
                      inferenceTime: perf?.inferenceTime || 0,
                      rank: existing?.rank,
                    });

                    return updated;
                  });
                }
              } catch (error) {
                console.error('[YOLOView] Processing error:', error);
              }
            };

            // Process at ~10 FPS (100ms interval)
            const interval = setInterval(processFrame, 100);
            processIntervals.set(trackKey, interval);
            console.log(`[YOLOView] Started processing: ${trackKey}`);
          };

          // Wait for video to load
          if (videoElement.readyState >= 2) {
            startProcessing();
          } else {
            videoElement.addEventListener('loadeddata', startProcessing, { once: true });
          }
        }
      });
    });

    // Cleanup
    return () => {
      processIntervals.forEach((interval, key) => {
        clearInterval(interval);
        console.log(`[YOLOView] Stopped processing: ${key}`);
      });
      processIntervals.clear();

      videoElements.forEach((video, key) => {
        video.remove();
      });
      videoElements.clear();
    };
  }, [participants, yoloReady, yoloService, aiScores]);

  // Rank participants by AI score + YOLO detections
  const rankedParticipants = useMemo(() => {
    const data = Array.from(participantData.values());

    // Sort by:
    // 1. AI score (if available)
    // 2. Number of "person" detections
    // 3. Total number of detections
    data.sort((a, b) => {
      const scoreA = a.score?.score ?? 0;
      const scoreB = b.score?.score ?? 0;

      if (scoreA !== scoreB) return scoreB - scoreA;

      // If scores equal, rank by person count
      const personsA = a.detections.filter((d) => d.className === 'person').length;
      const personsB = b.detections.filter((d) => d.className === 'person').length;

      if (personsA !== personsB) return personsB - personsA;

      // Finally, rank by total detections
      return b.detections.length - a.detections.length;
    });

    // Assign ranks
    data.forEach((item, index) => {
      item.rank = index + 1;
    });

    return data;
  }, [participantData]);

  const topParticipant = rankedParticipants[0];
  const otherParticipants = rankedParticipants.slice(1);

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
          <h1 className={styles.title}>🎯 YOLO Object Detection + AI Ranking</h1>
          <div className={styles.statusBadges}>
            <div className={styles.statusBadge}>
              <div
                className={styles.statusIndicator}
                style={{
                  backgroundColor: yoloReady ? '#10b981' : yoloLoading ? '#f59e0b' : '#ef4444',
                }}
              />
              <span className={styles.statusText}>
                {yoloLoading ? 'Loading YOLO...' : yoloReady ? 'YOLO Active' : 'YOLO Offline'}
              </span>
            </div>
            <div className={styles.statusBadge}>
              <div
                className={styles.statusIndicator}
                style={{ backgroundColor: aiConnected ? '#10b981' : '#ef4444' }}
              />
              <span className={styles.statusText}>
                {aiConnected ? 'AI Ranking Active' : 'AI Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* Error message */}
        {yoloError && (
          <div className={styles.errorBanner}>
            <strong>⚠️ YOLO Error:</strong> {yoloError}
            <br />
            <small>
              Make sure you have a YOLO model at <code>/public/models/yolo11n_256.onnx</code>
              <br />
              See <code>/public/models/SETUP_INSTRUCTIONS.md</code> for help
            </small>
          </div>
        )}

        {/* View mode controls */}
        <div className={styles.controls}>
          <div className={styles.buttonGroup}>
            <button
              className={`${styles.controlButton} ${viewMode === 'detections' ? styles.active : ''}`}
              onClick={() => setViewMode('detections')}
            >
              Detections Only
            </button>
            <button
              className={`${styles.controlButton} ${viewMode === 'ranked' ? styles.active : ''}`}
              onClick={() => setViewMode('ranked')}
            >
              Ranked Only
            </button>
            <button
              className={`${styles.controlButton} ${viewMode === 'combined' ? styles.active : ''}`}
              onClick={() => setViewMode('combined')}
            >
              Combined View
            </button>
          </div>

          <div className={styles.toggles}>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={showDetections}
                onChange={(e) => setShowDetections(e.target.checked)}
              />
              <span>Show YOLO Boxes</span>
            </label>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={showScores}
                onChange={(e) => setShowScores(e.target.checked)}
              />
              <span>Show AI Scores</span>
            </label>
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
              <span>👤 {totalStats.persons}</span>
            </>
          )}
          {totalStats.vehicles > 0 && (
            <>
              <span>•</span>
              <span>🚗 {totalStats.vehicles}</span>
            </>
          )}
        </div>
      </div>

      {/* Top ranked video */}
      {topParticipant && (
        <div className={styles.topSection}>
          <div className={styles.topLabel}>🏆 Top Ranked</div>
          <VideoTile data={topParticipant} isTop={true} showDetections={showDetections} showScores={showScores} />
        </div>
      )}

      {/* Grid of other videos */}
      {otherParticipants.length > 0 && (
        <div className={styles.gridSection}>
          <h2 className={styles.gridTitle}>All Videos</h2>
          <div className={styles.grid}>
            {otherParticipants.map((data) => (
              <VideoTile
                key={`${data.participant.identity}_${data.trackSid}`}
                data={data}
                isTop={false}
                showDetections={showDetections}
                showScores={showScores}
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
          {yoloError && (
            <p className={styles.emptyStateHelp}>
              <strong>Note:</strong> YOLO model not loaded. Check the error message above.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Sub-component for video tile
interface VideoTileProps {
  data: ParticipantWithYOLO;
  isTop: boolean;
  showDetections: boolean;
  showScores: boolean;
}

function VideoTile({ data, isTop, showDetections, showScores }: VideoTileProps) {
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
    <div className={isTop ? styles.topTile : styles.gridTile}>
      <div className={styles.videoContainer}>
        <video ref={videoRef} className={styles.video} autoPlay playsInline muted />

        {/* YOLO detection overlay */}
        {showDetections && videoDimensions.width > 0 && data.detections.length > 0 && (
          <DetectionOverlay
            detections={data.detections}
            width={videoDimensions.width}
            height={videoDimensions.height}
            showLabels={isTop}
            showConfidence={isTop}
            lineWidth={isTop ? 2 : 1}
          />
        )}

        {/* Detection badge */}
        {data.detections.length > 0 && <DetectionBadge detections={data.detections} />}

        {/* AI score overlay */}
        {showScores && data.score && (
          <AIScoreOverlay score={data.score} rank={data.rank} compact={!isTop} />
        )}

        {/* Performance metrics */}
        <PerformanceOverlay
          fps={data.yoloFps}
          inferenceTime={data.inferenceTime}
          detectionCount={data.detections.length}
        />
      </div>

      {/* Info panel */}
      <div className={styles.info}>
        <div className={styles.participantName}>
          {data.trackName !== 'Video' ? data.trackName : data.participant.name || data.participant.identity}
        </div>

        {/* Detection summary */}
        <div className={styles.detectionSummary}>
          {personCount > 0 && <span className={styles.badge}>👤 {personCount} person(s)</span>}
          {vehicleCount > 0 && <span className={styles.badge}>🚗 {vehicleCount} vehicle(s)</span>}
          {animalCount > 0 && <span className={styles.badge}>🐾 {animalCount} animal(s)</span>}
          {otherCount > 0 && <span className={styles.badge}>📦 {otherCount} other</span>}
          {data.detections.length === 0 && <span className={styles.badge}>No objects detected</span>}
        </div>

        {/* AI score */}
        {data.score && (
          <div className={styles.scoreDetails}>
            <div className={styles.scoreValue}>AI Score: {Math.round(data.score.score * 100)}%</div>
            <div className={styles.reason}>{data.score.reason}</div>
            <div className={styles.timestamp}>Updated {new Date(data.score.timestamp).toLocaleTimeString()}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default YOLOView;
