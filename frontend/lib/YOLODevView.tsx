'use client';

/**
 * YOLODevView Component - DEVELOPMENT/DEBUGGING VERSION
 * Enhanced YOLO view with extensive debugging tools and real-time detection monitoring
 * Features: Raw JSON display, WebSocket logs, performance metrics, detection history
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useParticipants, useRoomContext } from '@livekit/components-react';
import { Participant } from 'livekit-client';
import { AIScore, Detection } from './types/ai';
import { ClientSideYOLO } from './yolo/ClientSideYOLO';
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

interface DetectionLogEntry {
  timestamp: number;
  trackName: string;
  detectionCount: number;
  latency: number;
}

export function YOLODevView({ aiScores, aiConnected }: YOLODevViewProps) {
  const room = useRoomContext();
  const participants = useParticipants();
  const [detectionHistory, setDetectionHistory] = useState<DetectionLogEntry[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(true);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);

  // Map participants to their detections from backend
  const participantData = useMemo(() => {
    const data: ParticipantWithDetections[] = [];
    const allParticipants = [room.localParticipant, ...participants.filter(p => p !== room.localParticipant)];

    console.log('[YOLO DEV] 🔍 Mapping participants to detections. aiScores keys:', Array.from(aiScores.keys()));

    allParticipants.forEach((participant) => {
      participant.videoTrackPublications.forEach((publication) => {
        if (publication.track) {
          const trackSid = publication.track.sid;
          const trackName = publication.trackName || 'Video';

          // Try MULTIPLE matching strategies (COMPREHENSIVE)
          let score = null;
          let matchStrategy = '';

          // Strategy 1: Try by trackName
          score = aiScores.get(trackName);
          if (score) matchStrategy = 'trackName';

          // Strategy 2: Try by trackSid
          if (!score) {
            score = aiScores.get(trackSid);
            if (score) matchStrategy = 'trackSid';
          }

          // Strategy 3: Try by participant identity
          if (!score) {
            score = aiScores.get(participant.identity);
            if (score) matchStrategy = 'participant.identity';
          }

          // Strategy 4: Try combined key
          if (!score) {
            score = aiScores.get(`${participant.identity}_${trackSid}`);
            if (score) matchStrategy = 'combined';
          }

          // Strategy 5: Try wildcardmatch (fallback when backend can't identify track)
          if (!score) {
            score = aiScores.get('*');
            if (score) matchStrategy = 'wildcard(*)';
          }

          // Strategy 6: If only ONE score exists and we have no match, use it (single-camera scenario)
          if (!score && aiScores.size === 1) {
            score = Array.from(aiScores.values())[0];
            matchStrategy = 'single-score-fallback';
          }

          console.log(`[YOLO DEV] 📊 Track: "${trackName}" (${trackSid}) → ${score ? `✅ MATCHED via ${matchStrategy}` : '❌ NO MATCH'}`);
          console.log(`[YOLO DEV] 🔍 Available aiScores keys:`, Array.from(aiScores.keys()));

          // Extract detections
          const detections = score?.detections || [];

          if (detections.length > 0) {
            console.log(`[YOLO DEV] 🎯 ${trackName} HAS ${detections.length} DETECTIONS!`, detections);

            // Log to history
            const latency = score ? Date.now() - score.timestamp : 0;
            setDetectionHistory(prev => {
              const newEntry: DetectionLogEntry = {
                timestamp: Date.now(),
                trackName,
                detectionCount: detections.length,
                latency
              };
              return [newEntry, ...prev].slice(0, 20); // Keep last 20 entries
            });
          }

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

  // Calculate total stats
  const totalStats = useMemo(() => {
    const stats = {
      totalObjects: 0,
      persons: 0,
      vehicles: 0,
      animals: 0,
      other: 0,
      avgConfidence: 0,
      maxConfidence: 0,
    };

    let totalConfidence = 0;
    let detectionCount = 0;

    participantData.forEach((p) => {
      stats.totalObjects += p.detections.length;
      stats.persons += p.detections.filter((d) => d.className === 'person').length;
      stats.vehicles += p.detections.filter((d) =>
        ['car', 'truck', 'bus', 'motorcycle', 'bicycle'].includes(d.className)
      ).length;
      stats.animals += p.detections.filter((d) =>
        ['dog', 'cat', 'bird', 'horse', 'sheep', 'cow'].includes(d.className)
      ).length;

      p.detections.forEach(d => {
        totalConfidence += d.confidence;
        detectionCount++;
        if (d.confidence > stats.maxConfidence) {
          stats.maxConfidence = d.confidence;
        }
      });
    });

    stats.other = stats.totalObjects - stats.persons - stats.vehicles - stats.animals;
    stats.avgConfidence = detectionCount > 0 ? totalConfidence / detectionCount : 0;

    return stats;
  }, [participantData]);

  // Get selected track data for debug panel
  const selectedTrackData = participantData.find(p => p.trackName === selectedTrack);

  return (
    <div className={styles.container}>
      {/* Header with Dev Badge */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>
            🔧 YOLO DEV - Development Mode
          </h1>
          <div className={styles.statusBadge} style={{ marginLeft: '16px' }}>
            <div
              className={styles.statusIndicator}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: aiConnected ? '#10b981' : '#ef4444',
                marginRight: '8px',
                animation: aiConnected ? 'pulse 2s infinite' : 'none'
              }}
            />
            <span style={{ fontSize: '14px', color: '#9ca3af', fontWeight: 'bold' }}>
              {aiConnected ? '🟢 Backend YOLO Active' : '🔴 Backend Disconnected'}
            </span>
          </div>
          <button
            onClick={() => setShowDebugPanel(!showDebugPanel)}
            style={{
              marginLeft: '16px',
              padding: '8px 16px',
              background: showDebugPanel ? '#10b981' : '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            {showDebugPanel ? '🐛 Hide Debug' : '🐛 Show Debug'}
          </button>
        </div>

        {/* Enhanced Stats */}
        <div className={styles.stats} style={{ fontSize: '13px', gap: '12px' }}>
          <span style={{ fontWeight: 'bold' }}>📹 {participants.length} participants</span>
          <span>•</span>
          <span style={{ fontWeight: 'bold' }}>🎥 {participantData.length} videos</span>
          <span>•</span>
          <span style={{ fontWeight: 'bold', color: totalStats.totalObjects > 0 ? '#10b981' : '#ef4444' }}>
            📦 {totalStats.totalObjects} objects
          </span>
          {totalStats.persons > 0 && (
            <>
              <span>•</span>
              <span style={{ color: '#00ffff' }}>👤 {totalStats.persons} persons</span>
            </>
          )}
          {totalStats.vehicles > 0 && (
            <>
              <span>•</span>
              <span style={{ color: '#ffff00' }}>🚗 {totalStats.vehicles} vehicles</span>
            </>
          )}
          {totalStats.avgConfidence > 0 && (
            <>
              <span>•</span>
              <span style={{ color: '#fbbf24' }}>
                📊 Avg Conf: {(totalStats.avgConfidence * 100).toFixed(1)}%
              </span>
            </>
          )}
        </div>
      </div>

      {/* Debug Panel */}
      {showDebugPanel && (
        <div style={{
          margin: '0 20px 20px 20px',
          padding: '16px',
          background: 'rgba(0, 0, 0, 0.8)',
          border: '2px solid #10b981',
          borderRadius: '8px',
          color: '#10b981',
          fontFamily: 'monospace',
          fontSize: '12px'
        }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#10b981', fontSize: '16px' }}>
            🐛 DEBUG PANEL
          </h3>

          {/* WebSocket Status */}
          <div style={{ marginBottom: '12px', padding: '8px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '4px' }}>
            <strong>WebSocket:</strong> {aiConnected ? '✅ CONNECTED' : '❌ DISCONNECTED'} |
            <strong> AI Scores:</strong> {aiScores.size} entries
          </div>

          {/* Score Keys Mapping */}
          <div style={{ marginBottom: '12px' }}>
            <strong>🔑 Available Score Keys:</strong>
            <div style={{ marginTop: '4px', maxHeight: '100px', overflowY: 'auto', padding: '8px', background: 'rgba(0, 0, 0, 0.5)', borderRadius: '4px' }}>
              {Array.from(aiScores.keys()).map((key, i) => (
                <div key={i} style={{ padding: '2px 0' }}>
                  {i + 1}. "{key}" → {aiScores.get(key)?.detections?.length || 0} detections
                </div>
              ))}
            </div>
          </div>

          {/* Detection History */}
          <div style={{ marginBottom: '12px' }}>
            <strong>📜 Detection History (Last 20):</strong>
            <div style={{ marginTop: '4px', maxHeight: '150px', overflowY: 'auto', padding: '8px', background: 'rgba(0, 0, 0, 0.5)', borderRadius: '4px' }}>
              {detectionHistory.length === 0 ? (
                <div style={{ color: '#9ca3af' }}>No detections yet...</div>
              ) : (
                detectionHistory.map((entry, i) => (
                  <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    {new Date(entry.timestamp).toLocaleTimeString()} |
                    <strong> {entry.trackName}</strong> |
                    {entry.detectionCount} objects |
                    Latency: {entry.latency}ms
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Track Selection for Detailed View */}
          <div>
            <strong>🎯 Inspect Track:</strong>
            <select
              value={selectedTrack || ''}
              onChange={(e) => setSelectedTrack(e.target.value || null)}
              style={{
                marginLeft: '8px',
                padding: '4px 8px',
                background: '#1f2937',
                color: '#10b981',
                border: '1px solid #10b981',
                borderRadius: '4px'
              }}
            >
              <option value="">-- Select Track --</option>
              {participantData.map((p, i) => (
                <option key={i} value={p.trackName}>
                  {p.trackName} ({p.detections.length} detections)
                </option>
              ))}
            </select>

            {/* Show detailed JSON for selected track */}
            {selectedTrackData && (
              <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(0, 0, 0, 0.7)', borderRadius: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                <strong>Track Details:</strong>
                <pre style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#fbbf24', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify({
                    trackName: selectedTrackData.trackName,
                    trackSid: selectedTrackData.trackSid,
                    participantIdentity: selectedTrackData.participant.identity,
                    score: selectedTrackData.score?.score,
                    reason: selectedTrackData.score?.reason,
                    timestamp: selectedTrackData.score?.timestamp ? new Date(selectedTrackData.score.timestamp).toLocaleString() : null,
                    detections: selectedTrackData.detections.map(d => ({
                      class: d.className,
                      conf: (d.confidence * 100).toFixed(1) + '%',
                      box: `(${d.x0},${d.y0})→(${d.x1},${d.y1})`
                    }))
                  }, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* All videos with YOLO detection boxes */}
      {participantData.length > 0 && (
        <div className={styles.gridSection}>
          <h2 className={styles.gridTitle}>🎥 All Video Feeds with Detection Overlay</h2>
          <div className={styles.grid}>
            {participantData.map((data) => (
              <VideoTileDev
                key={`${data.participant.identity}_${data.trackSid}`}
                data={data}
                onSelect={() => setSelectedTrack(data.trackName)}
                isSelected={selectedTrack === data.trackName}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {participantData.length === 0 && (
        <div className={styles.emptyState}>
          <h3>⚠️ No videos yet</h3>
          <p>Join with your camera or add external streams to see YOLO detections</p>
          {!aiConnected && (
            <p className={styles.emptyStateHelp}>
              <strong>🔴 Backend YOLO service not connected.</strong> Check docker-compose services.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Enhanced Video Tile with Development Features
interface VideoTileDevProps {
  data: ParticipantWithDetections;
  onSelect: () => void;
  isSelected: boolean;
}

function VideoTileDev({ data, onSelect, isSelected }: VideoTileDevProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
  const [displayDimensions, setDisplayDimensions] = useState({ width: 0, height: 0 });
  const [isReady, setIsReady] = useState(false);
  const [fps, setFps] = useState(0);
  const lastFrameTimeRef = useRef<number>(Date.now());
  const frameCountRef = useRef<number>(0);

  // Track video native dimensions
  useEffect(() => {
    if (videoRef.current && data.videoTrack) {
      const videoElement = data.videoTrack.attach(videoRef.current);

      const handleMetadata = () => {
        const nativeWidth = videoElement.videoWidth;
        const nativeHeight = videoElement.videoHeight;

        console.log(`[YOLO DEV] ${data.trackName} native dimensions: ${nativeWidth}x${nativeHeight}`);

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
  }, [data.videoTrack, data.trackName]);

  // Track displayed dimensions
  useEffect(() => {
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

        if (displayWidth > 0 && displayHeight > 0 && videoDimensions.width > 0) {
          setIsReady(true);
        }
      }
    };

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
  }, [data.videoTrack, videoDimensions.width, data.trackName]);

  // FPS counter
  useEffect(() => {
    if (!isReady) return;

    const fpsInterval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastFrameTimeRef.current;
      const currentFps = Math.round((frameCountRef.current * 1000) / elapsed);
      setFps(currentFps);

      // Reset counters
      lastFrameTimeRef.current = now;
      frameCountRef.current = 0;
    }, 1000);

    return () => clearInterval(fpsInterval);
  }, [isReady]);

  // Count frames
  useEffect(() => {
    if (isReady) {
      frameCountRef.current++;
    }
  }, [data.detections, isReady]);

  // Detection stats
  const personCount = data.detections.filter((d) => d.className === 'person').length;
  const vehicleCount = data.detections.filter((d) =>
    ['car', 'truck', 'bus', 'motorcycle', 'bicycle'].includes(d.className)
  ).length;
  const animalCount = data.detections.filter((d) =>
    ['dog', 'cat', 'bird', 'horse', 'sheep', 'cow'].includes(d.className)
  ).length;
  const otherCount = data.detections.length - personCount - vehicleCount - animalCount;

  // Calculate average confidence
  const avgConfidence = data.detections.length > 0
    ? data.detections.reduce((sum, d) => sum + d.confidence, 0) / data.detections.length
    : 0;

  return (
    <div
      className={styles.gridTile}
      onClick={onSelect}
      style={{
        border: isSelected ? '3px solid #10b981' : '1px solid #374151',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }}
    >
      <div ref={containerRef} className={styles.videoContainer}>
        <video ref={videoRef} className={styles.video} autoPlay playsInline muted />

        {/* Client-Side YOLO detection - runs in browser with FULL DEBUG MODE */}
        {isReady && videoRef.current && (
          <ClientSideYOLO
            videoElement={videoRef.current}
            enabled={true}
            showLabels={true}
            showConfidence={true}
            debug={false}
          />
        )}

        {/* Enhanced Status Overlay */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: isReady ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            color: 'white',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            zIndex: 20,
            border: `3px solid ${isReady ? '#10b981' : '#ef4444'}`,
          }}
        >
          {isReady ? `✅ YOLO (${data.detections.length})` : '⏳ Loading...'}
          <br />
          <span style={{ fontSize: '10px' }}>
            {videoDimensions.width}x{videoDimensions.height} → {displayDimensions.width}x{displayDimensions.height}
          </span>
        </div>

        {/* FPS Counter */}
        {isReady && (
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              background: 'rgba(0, 0, 0, 0.8)',
              padding: '6px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              color: fps > 0 ? '#10b981' : '#9ca3af',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              zIndex: 20,
              border: '2px solid rgba(16, 185, 129, 0.5)',
            }}
          >
            📊 {fps} updates/sec
          </div>
        )}
      </div>

      {/* Enhanced Info panel */}
      <div className={styles.info}>
        <div className={styles.participantName}>
          {isSelected && '🎯 '}
          {data.trackName !== 'Video' ? data.trackName : data.participant.name || data.participant.identity}
        </div>

        {/* Detection summary with confidence */}
        <div className={styles.detectionSummary}>
          {personCount > 0 && <span className={styles.badge} style={{ background: 'rgba(0, 255, 255, 0.2)', color: '#00ffff', border: '1px solid #00ffff' }}>👤 {personCount}</span>}
          {vehicleCount > 0 && <span className={styles.badge} style={{ background: 'rgba(255, 255, 0, 0.2)', color: '#ffff00', border: '1px solid #ffff00' }}>🚗 {vehicleCount}</span>}
          {animalCount > 0 && <span className={styles.badge} style={{ background: 'rgba(0, 255, 0, 0.2)', color: '#00ff00', border: '1px solid #00ff00' }}>🐾 {animalCount}</span>}
          {otherCount > 0 && <span className={styles.badge} style={{ background: 'rgba(255, 0, 255, 0.2)', color: '#ff00ff', border: '1px solid #ff00ff' }}>📦 {otherCount}</span>}
          {data.detections.length === 0 && <span className={styles.badge}>No objects</span>}
        </div>

        {/* Avg confidence */}
        {avgConfidence > 0 && (
          <div style={{ fontSize: '12px', color: '#fbbf24', marginTop: '4px' }}>
            Avg Confidence: {(avgConfidence * 100).toFixed(1)}%
          </div>
        )}

        {/* AI score */}
        {data.score && (
          <div className={styles.scoreDetails}>
            <div className={styles.scoreValue}>Coverage: {Math.round(data.score.score * 100)}%</div>
            <div className={styles.reason}>{data.score.reason}</div>
            <div className={styles.timestamp}>
              Updated: {new Date(data.score.timestamp).toLocaleTimeString()}
              ({Math.floor((Date.now() - data.score.timestamp) / 1000)}s ago)
            </div>
          </div>
        )}

        {/* Track IDs for debugging */}
        <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px', fontFamily: 'monospace' }}>
          SID: {data.trackSid.substring(0, 12)}...
        </div>
      </div>
    </div>
  );
}

export default YOLODevView;
