'use client';

import React from 'react';
import styles from '../styles/CameraConnectionStatus.module.css';

export interface CameraStatus {
  id: string;
  name: string;
  ip: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastError?: string;
}

interface CameraConnectionStatusProps {
  cameras: CameraStatus[];
  onRetryCamera?: (cameraId: string) => void;
}

export function CameraConnectionStatus({ cameras, onRetryCamera }: CameraConnectionStatusProps) {
  const [expanded, setExpanded] = React.useState(false);

  const connectedCount = cameras.filter(c => c.status === 'connected').length;
  const connectingCount = cameras.filter(c => c.status === 'connecting').length;
  const errorCount = cameras.filter(c => c.status === 'error').length;

  const getStatusIcon = (status: CameraStatus['status']) => {
    switch (status) {
      case 'connected':
        return '✓';
      case 'connecting':
        return '⋯';
      case 'error':
        return '✗';
      default:
        return '○';
    }
  };

  const getStatusColor = (status: CameraStatus['status']) => {
    switch (status) {
      case 'connected':
        return '#4ade80';
      case 'connecting':
        return '#fbbf24';
      case 'error':
        return '#f87171';
      default:
        return '#9ca3af';
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.summary} onClick={() => setExpanded(!expanded)}>
        <span className={styles.title}>
          📹 Cameras: {connectedCount}/{cameras.length}
        </span>
        {connectingCount > 0 && (
          <span className={styles.badge} style={{ backgroundColor: '#fbbf24' }}>
            {connectingCount} connecting
          </span>
        )}
        {errorCount > 0 && (
          <span className={styles.badge} style={{ backgroundColor: '#f87171' }}>
            {errorCount} errors
          </span>
        )}
        <span className={styles.expandIcon}>{expanded ? '▼' : '▶'}</span>
      </div>

      {expanded && (
        <div className={styles.details}>
          {cameras.map((camera) => (
            <div key={camera.id} className={styles.cameraRow}>
              <span
                className={styles.statusIcon}
                style={{ color: getStatusColor(camera.status) }}
              >
                {getStatusIcon(camera.status)}
              </span>
              <span className={styles.cameraName}>
                {camera.name}
              </span>
              <span className={styles.cameraIp}>
                {camera.ip}
              </span>
              {camera.status === 'error' && camera.lastError && (
                <span className={styles.error} title={camera.lastError}>
                  {camera.lastError.substring(0, 30)}...
                </span>
              )}
              {camera.status === 'error' && onRetryCamera && (
                <button
                  className={styles.retryButton}
                  onClick={() => onRetryCamera(camera.id)}
                >
                  Retry
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
