'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRoomContext, useTracks } from '@livekit/components-react';
import { Track } from 'livekit-client';
import styles from '../styles/VLMView.module.css';
import { AIScore } from './types/ai';

interface VLMInsight {
  camId: string;
  camName: string;
  insight: string;
  timestamp: number;
}

interface VLMViewProps {
  aiScores: Map<string, AIScore>;
  aiConnected: boolean;
}

export function VLMView({ aiScores, aiConnected }: VLMViewProps) {
  const room = useRoomContext();
  const videoTracks = useTracks([Track.Source.Camera], { onlySubscribed: true });

  // Current insights - one per camera
  const [currentInsights, setCurrentInsights] = useState<Map<string, string>>(new Map());

  // Insights history - all insights chronologically
  const [insightsHistory, setInsightsHistory] = useState<VLMInsight[]>([]);

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState<Map<string, boolean>>(new Map());

  // Video refs for frame capture
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Analysis interval ref
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to capture frame from video element
  const captureFrame = (video: HTMLVideoElement): string | null => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to base64 (remove data:image/png;base64, prefix)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      return dataUrl.split(',')[1];
    } catch (error) {
      console.error('[VLMView] Error capturing frame:', error);
      return null;
    }
  };

  // Analyze a single camera frame
  const analyzeFrame = async (trackSid: string, trackName: string) => {
    const video = videoRefs.current.get(trackSid);
    if (!video || video.readyState < 2) {
      console.log(`[VLMView] Video not ready for ${trackName}`);
      return;
    }

    // Skip if already analyzing
    if (isAnalyzing.get(trackSid)) {
      console.log(`[VLMView] Already analyzing ${trackName}, skipping`);
      return;
    }

    try {
      // Mark as analyzing
      setIsAnalyzing((prev) => new Map(prev).set(trackSid, true));

      console.log(`[VLMView] 📸 Capturing frame from ${trackName}`);
      const base64Image = captureFrame(video);

      if (!base64Image) {
        console.error(`[VLMView] Failed to capture frame from ${trackName}`);
        return;
      }

      console.log(`[VLMView] 🤖 Sending frame to VLM API for ${trackName}`);
      const response = await fetch('/api/vlm-analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image,
          camId: trackSid,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`[VLMView] API error for ${trackName}:`, errorData);
        return;
      }

      const data = await response.json();
      console.log(`[VLMView] ✅ Received insight for ${trackName}:`, data.insight.substring(0, 50));

      // Update current insight
      setCurrentInsights((prev) => new Map(prev).set(trackSid, data.insight));

      // Add to history
      const newInsight: VLMInsight = {
        camId: trackSid,
        camName: trackName,
        insight: data.insight,
        timestamp: data.timestamp,
      };
      setInsightsHistory((prev) => [newInsight, ...prev].slice(0, 100)); // Keep last 100 insights

    } catch (error) {
      console.error(`[VLMView] Error analyzing ${trackName}:`, error);
    } finally {
      // Mark as not analyzing
      setIsAnalyzing((prev) => {
        const updated = new Map(prev);
        updated.set(trackSid, false);
        return updated;
      });
    }
  };

  // Start periodic analysis (every 5 seconds)
  useEffect(() => {
    console.log('[VLMView] Setting up analysis interval');

    analysisIntervalRef.current = setInterval(() => {
      console.log(`[VLMView] 🔄 Running periodic analysis for ${videoTracks.length} cameras`);

      videoTracks.forEach((trackRef) => {
        const trackName = trackRef.publication?.trackName || 'Unknown';
        const trackSid = trackRef.publication?.trackSid || 'unknown';

        analyzeFrame(trackSid, trackName);
      });
    }, 5000); // 5 seconds

    return () => {
      if (analysisIntervalRef.current) {
        console.log('[VLMView] Clearing analysis interval');
        clearInterval(analysisIntervalRef.current);
      }
    };
  }, [videoTracks]);

  // Format timestamp for display
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h2>VLM Analysis</h2>
        <div className={styles.status}>
          <div className={`${styles.statusDot} ${aiConnected ? styles.connected : styles.disconnected}`}></div>
          <span>{videoTracks.length} cameras • Analysis every 5s</span>
        </div>
      </div>

      {/* Video Grid */}
      <div className={styles.videoGrid}>
        {videoTracks.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No video streams available</p>
          </div>
        ) : (
          videoTracks.map((trackRef) => {
            const trackName = trackRef.publication?.trackName || 'Unknown';
            const trackSid = trackRef.publication?.trackSid || 'unknown';
            const currentInsight = currentInsights.get(trackSid) || 'Analyzing...';
            const analyzing = isAnalyzing.get(trackSid) || false;

            return (
              <div key={trackSid} className={styles.videoCard}>
                {/* Video Element */}
                <div className={styles.videoWrapper}>
                  <video
                    ref={(el) => {
                      if (el && trackRef.publication?.track) {
                        videoRefs.current.set(trackSid, el);
                        trackRef.publication.track.attach(el);
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    className={styles.video}
                  />
                  {analyzing && (
                    <div className={styles.analyzingOverlay}>
                      <div className={styles.spinner}></div>
                      <span>Analyzing...</span>
                    </div>
                  )}
                </div>

                {/* Camera Info */}
                <div className={styles.cameraInfo}>
                  <h3 className={styles.cameraName}>{trackName}</h3>
                  <p className={styles.insight}>{currentInsight}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Insights History Panel */}
      <div className={styles.historyPanel}>
        <div className={styles.historyHeader}>
          <h3>Insights History</h3>
          <span className={styles.historyCount}>{insightsHistory.length} insights</span>
        </div>

        <div className={styles.historyList}>
          {insightsHistory.length === 0 ? (
            <div className={styles.emptyHistory}>
              <p>No insights yet. Analysis will begin in a few seconds...</p>
            </div>
          ) : (
            insightsHistory.map((insight, index) => (
              <div key={`${insight.camId}-${insight.timestamp}-${index}`} className={styles.historyItem}>
                <div className={styles.historyItemHeader}>
                  <span className={styles.historyItemCamera}>{insight.camName}</span>
                  <span className={styles.historyItemTime}>{formatTime(insight.timestamp)}</span>
                </div>
                <p className={styles.historyItemInsight}>{insight.insight}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
