'use client';

import React from 'react';
import { useParticipants, useRoomContext } from '@livekit/components-react';
import { AIScore } from './types/ai';
import { AIScoreOverlay } from './AIScoreOverlay';
import { Participant } from 'livekit-client';
import { convertForLiveKit, convertForLiveKitFallback } from './convertForLiveKit';
import styles from '../styles/DashboardView.module.css';

interface DashboardViewProps {
  aiScores: Map<string, AIScore>;
  aiConnected: boolean;
}

interface VideoUpload {
  id: string;
  filename: string;
  status: 'uploading' | 'playing' | 'error';
  progress?: number;
  error?: string;
}

interface VideoTrackWithScore {
  participant: Participant;
  trackSid: string;
  trackName: string;
  videoTrack: any;
  score?: AIScore;
  rank?: number;
}

export function DashboardView({ aiScores, aiConnected }: DashboardViewProps) {
  const room = useRoomContext();
  const participants = useParticipants();
  const [uploads, setUploads] = React.useState<VideoUpload[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Create entries for each individual video track (not just participants)
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

  const topTrack = rankedTracks.find((t) => t.score);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !room) return;

    const filesArray = Array.from(files);

    // Create upload entries
    const newUploads: VideoUpload[] = filesArray.map((file) => ({
      id: Math.random().toString(36).substring(7),
      filename: file.name,
      status: 'uploading',
      progress: 0,
    }));

    setUploads((prev) => [...prev, ...newUploads]);

    // Process each file
    for (let i = 0; i < filesArray.length; i++) {
      const file = filesArray[i];
      const uploadId = newUploads[i].id;

      try {
        // Create video element from file
        const videoUrl = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.src = videoUrl;
        video.muted = true;
        video.loop = true;

        await new Promise((resolve, reject) => {
          video.onloadedmetadata = resolve;
          video.onerror = reject;
          setTimeout(() => reject(new Error('Video load timeout')), 10000);
        });

        // Convert video for LiveKit
        let stream: MediaStream;
        try {
          stream = await convertForLiveKit(video, {
            targetWidth: 1280,
            targetHeight: 720,
            frameRate: 30,
            enableHardwareAcceleration: true,
          });
        } catch (error) {
          console.warn('WebCodecs not available, using fallback:', error);
          stream = convertForLiveKitFallback(video, {
            targetWidth: 1280,
            targetHeight: 720,
            frameRate: 30,
          });
        }

        // Publish video to room
        const videoTrack = stream.getVideoTracks()[0];
        await room.localParticipant.publishTrack(videoTrack, {
          name: file.name,
          source: 'camera',
        });

        // Start playing the video
        video.play();

        // Update upload status
        setUploads((prev) =>
          prev.map((u) => (u.id === uploadId ? { ...u, status: 'playing' as const } : u)),
        );

        // Clean up object URL after a delay
        setTimeout(() => URL.revokeObjectURL(videoUrl), 1000);
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        setUploads((prev) =>
          prev.map((u) =>
            u.id === uploadId
              ? {
                  ...u,
                  status: 'error' as const,
                  error: error instanceof Error ? error.message : 'Unknown error',
                }
              : u,
          ),
        );
      }
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const removeUpload = (uploadId: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== uploadId));
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>AI Dashboard</h1>
        </div>
        <button className={styles.uploadButton} onClick={handleUploadClick}>
          Upload Videos
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
      </div>

      {/* Upload Status */}
      {uploads.length > 0 && (
        <div className={styles.uploadSection}>
          <h2 className={styles.sectionTitle}>Upload Status</h2>
          <div className={styles.uploadList}>
            {uploads.map((upload) => (
              <div key={upload.id} className={styles.uploadItem}>
                <div className={styles.uploadInfo}>
                  <div className={styles.uploadFilename}>{upload.filename}</div>
                  <div className={styles.uploadStatus}>
                    {upload.status === 'uploading' && 'Uploading...'}
                    {upload.status === 'playing' && 'Playing'}
                    {upload.status === 'error' && `Error: ${upload.error}`}
                  </div>
                </div>
                <button
                  className={styles.removeButton}
                  onClick={() => removeUpload(upload.id)}
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Ranked Video */}
      {topTrack && topTrack.score && (
        <div className={styles.topSection}>
          <h2 className={styles.sectionTitle}>
            Top Ranked Video
          </h2>
          <div className={styles.topVideo}>
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
                score={topTrack.score}
                rank={topTrack.rank}
                showReason={true}
              />
            </div>
            <div className={styles.videoInfo}>
              <div className={styles.videoName}>
                {topTrack.trackName !== 'Video' ? topTrack.trackName : (topTrack.participant.name || topTrack.participant.identity)}
              </div>
              <div className={styles.videoReason}>{topTrack.score.reason}</div>
            </div>
          </div>
        </div>
      )}

      {/* All Videos Grid */}
      {rankedTracks.length > 0 && (
        <div className={styles.gridSection}>
          <h2 className={styles.sectionTitle}>
            All Videos ({rankedTracks.length})
          </h2>
          <div className={styles.grid}>
            {rankedTracks.map((item) => {
              const borderColor =
                item.rank === 1
                  ? '#fbbf24'
                  : item.rank === 2
                    ? '#c0c0c0'
                    : item.rank === 3
                      ? '#cd7f32'
                      : '#374151';

              return (
                <div
                  key={`${item.participant.identity}_${item.trackSid}`}
                  className={styles.gridItem}
                  style={{ borderColor }}
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
                    {item.score && <AIScoreOverlay score={item.score} rank={item.rank} compact />}
                  </div>
                  <div className={styles.gridItemInfo}>
                    <div className={styles.gridItemName}>
                      {item.trackName !== 'Video' ? item.trackName : (item.participant.name || item.participant.identity)}
                    </div>
                    {item.score && (
                      <div className={styles.gridItemReason}>{item.score.reason}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {rankedTracks.length === 0 && (
        <div className={styles.emptyState}>
          <h3>No videos yet</h3>
          <p>Upload videos to see them ranked by AI</p>
          <button className={styles.emptyButton} onClick={handleUploadClick}>
            Upload Your First Video
          </button>
        </div>
      )}
    </div>
  );
}

export default DashboardView;
