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
  model?: string;
  processingTime?: number;
}

interface VLMModel {
  id: string;
  name: string;
  size: string;
  speed: string;
  description: string;
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

  // Insights history - all insights chronologically (persisted to localStorage)
  const [insightsHistory, setInsightsHistory] = useState<VLMInsight[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vlm-insights-history');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('[VLMView] Failed to parse saved insights:', e);
        }
      }
    }
    return [];
  });

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState<Map<string, boolean>>(new Map());

  // Available VLM models
  const [availableModels, setAvailableModels] = useState<VLMModel[]>([]);

  // Selected model
  const [selectedModel, setSelectedModel] = useState<string>('moondream');

  // Video refs for frame capture
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Analysis interval ref
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load available models on mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        const response = await fetch('/api/vlm-analyze');
        const data = await response.json();
        setAvailableModels(data.models || []);
        setSelectedModel(data.default || 'moondream');
      } catch (error) {
        console.error('[VLMView] Failed to load models:', error);
      }
    };
    loadModels();
  }, []);

  // Save insights history to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && insightsHistory.length > 0) {
      localStorage.setItem('vlm-insights-history', JSON.stringify(insightsHistory));
      console.log(`[VLMView] Saved ${insightsHistory.length} insights to localStorage`);
    }
  }, [insightsHistory]);

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

      console.log(`[VLMView] 🤖 Sending frame to VLM API for ${trackName} using model: ${selectedModel}`);
      const response = await fetch('/api/vlm-analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image,
          camId: trackSid,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`[VLMView] API error for ${trackName}:`, errorData);
        return;
      }

      const data = await response.json();
      console.log(`[VLMView] ✅ Received insight for ${trackName} (${data.processingTime}ms):`, data.insight.substring(0, 50));

      // Update current insight
      setCurrentInsights((prev) => new Map(prev).set(trackSid, data.insight));

      // Add to history
      const newInsight: VLMInsight = {
        camId: trackSid,
        camName: trackName,
        insight: data.insight,
        timestamp: data.timestamp,
        model: data.model,
        processingTime: data.processingTime,
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

  // Continuous analysis loop - waits for completion before next run
  useEffect(() => {
    if (videoTracks.length === 0) {
      console.log('[VLMView] No video tracks, skipping analysis setup');
      return;
    }

    console.log('[VLMView] Setting up continuous analysis loop');
    let isActive = true; // Flag to stop loop when component unmounts

    const continuousAnalysisLoop = async () => {
      while (isActive) {
        const tracks = videoTracks;
        console.log(`[VLMView] 🔄 Starting analysis cycle for ${tracks.length} cameras`);

        // Analyze all cameras sequentially
        for (const trackRef of tracks) {
          if (!isActive) break; // Stop if component unmounted

          const trackName = trackRef.publication?.trackName || 'Unknown';
          const trackSid = trackRef.publication?.trackSid || 'unknown';

          console.log(`[VLMView] 📸 Analyzing camera: ${trackName}`);
          await analyzeFrame(trackSid, trackName);
          console.log(`[VLMView] ✅ Completed analysis for ${trackName}`);
        }

        // Wait 5 seconds before next cycle (only after ALL cameras analyzed)
        console.log('[VLMView] ⏳ Waiting 5 seconds before next cycle...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      console.log('[VLMView] Analysis loop stopped');
    };

    // Start the continuous loop
    continuousAnalysisLoop();

    // Cleanup function
    return () => {
      console.log('[VLMView] Stopping analysis loop');
      isActive = false;
    };
  }, [videoTracks, selectedModel]); // Re-run when tracks or model changes

  // Format timestamp for display
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Export insights to PDF (using browser's print functionality)
  const exportToPDF = () => {
    if (insightsHistory.length === 0) {
      alert('No insights to export');
      return;
    }

    // Create a printable HTML document
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>VLM Analysis Report - ${new Date().toLocaleDateString()}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 40px;
            color: #333;
          }
          h1 {
            color: #2563eb;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 10px;
          }
          .meta {
            color: #666;
            margin-bottom: 30px;
            font-size: 14px;
          }
          .insight {
            margin-bottom: 25px;
            padding: 15px;
            border: 1px solid #ddd;
            border-radius: 8px;
            page-break-inside: avoid;
          }
          .insight-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-weight: bold;
            color: #2563eb;
          }
          .insight-meta {
            font-size: 12px;
            color: #666;
            margin-bottom: 8px;
          }
          .insight-text {
            line-height: 1.6;
            color: #333;
          }
          @media print {
            body { margin: 20px; }
          }
        </style>
      </head>
      <body>
        <h1>VLM Analysis Report</h1>
        <div class="meta">
          <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Total Insights:</strong> ${insightsHistory.length}</p>
          <p><strong>Model:</strong> ${selectedModel}</p>
        </div>
        ${insightsHistory.map(insight => `
          <div class="insight">
            <div class="insight-header">
              <span>${insight.camName}</span>
              <span>${formatTime(insight.timestamp)}</span>
            </div>
            <div class="insight-meta">
              Model: ${insight.model || 'unknown'} |
              Processing Time: ${insight.processingTime ? (insight.processingTime / 1000).toFixed(1) + 's' : 'N/A'}
            </div>
            <div class="insight-text">${insight.insight}</div>
          </div>
        `).join('')}
      </body>
      </html>
    `;

    // Open print dialog
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  // Clear insights history
  const clearHistory = () => {
    if (confirm('Are you sure you want to clear all insights history? This cannot be undone.')) {
      setInsightsHistory([]);
      localStorage.removeItem('vlm-insights-history');
      console.log('[VLMView] Cleared insights history');
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h2>VLM Analysis</h2>
        <div className={styles.headerRight}>
          <div className={styles.modelSelector}>
            <label htmlFor="model-select">Model:</label>
            <select
              id="model-select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className={styles.modelSelect}
            >
              {availableModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.id} ({model.size} - {model.speed})
                </option>
              ))}
            </select>
          </div>
          <div className={styles.status}>
            <div className={`${styles.statusDot} ${aiConnected ? styles.connected : styles.disconnected}`}></div>
            <span>{videoTracks.length} cameras • Analysis every 5s</span>
          </div>
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
          <div className={styles.historyHeaderRight}>
            <span className={styles.historyCount}>{insightsHistory.length} insights</span>
            <button
              onClick={exportToPDF}
              className={styles.exportButton}
              disabled={insightsHistory.length === 0}
              title="Export to PDF"
            >
              📄 Export PDF
            </button>
            <button
              onClick={clearHistory}
              className={styles.clearButton}
              disabled={insightsHistory.length === 0}
              title="Clear history"
            >
              🗑️ Clear
            </button>
          </div>
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
                  <div className={styles.historyItemMeta}>
                    {insight.model && <span className={styles.historyItemModel}>{insight.model.split(':')[0]}</span>}
                    {insight.processingTime && <span className={styles.historyItemTime}>{(insight.processingTime / 1000).toFixed(1)}s</span>}
                    <span className={styles.historyItemTime}>{formatTime(insight.timestamp)}</span>
                  </div>
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
