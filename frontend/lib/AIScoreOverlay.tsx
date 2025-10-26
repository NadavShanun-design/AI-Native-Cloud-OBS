'use client';

import React from 'react';
import { AIScore } from './types/ai';
import styles from '../styles/AIScoreOverlay.module.css';

interface AIScoreOverlayProps {
  score?: AIScore;
  rank?: number;
  showReason?: boolean;
  compact?: boolean;
}

export function AIScoreOverlay({ score, rank, showReason = false, compact = false }: AIScoreOverlayProps) {
  if (!score) {
    return null;
  }

  const scorePercent = Math.round(score.score * 100);

  // Determine color based on score
  const getScoreColor = (scoreValue: number): string => {
    if (scoreValue >= 0.8) return '#10b981'; // Green - High
    if (scoreValue >= 0.6) return '#f59e0b'; // Orange - Good
    return '#ef4444'; // Red - Low
  };

  const scoreColor = getScoreColor(score.score);

  // Get medal emoji for top 3
  const getMedal = (position?: number): string => {
    if (!position) return '';
    if (position === 1) return '🥇';
    if (position === 2) return '🥈';
    if (position === 3) return '🥉';
    return '';
  };

  const medal = getMedal(rank);

  if (compact) {
    return (
      <div className={styles.compact} style={{ borderColor: scoreColor }}>
        {rank && (
          <span className={styles.rankBadge}>
            {medal || `#${rank}`}
          </span>
        )}
        <span className={styles.scoreValue} style={{ color: scoreColor }}>
          {scorePercent}
        </span>
      </div>
    );
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.header}>
        {rank && (
          <div className={styles.rank} style={{ backgroundColor: scoreColor }}>
            {medal || `#${rank}`}
          </div>
        )}
        <div className={styles.score} style={{ color: scoreColor }}>
          <span className={styles.scoreNumber}>{scorePercent}</span>
          <span className={styles.scoreLabel}>score</span>
        </div>
      </div>

      {showReason && score.reason && (
        <div className={styles.reason}>
          <div className={styles.reasonLabel}>AI Analysis:</div>
          <div className={styles.reasonText}>{score.reason}</div>
        </div>
      )}
    </div>
  );
}

export default AIScoreOverlay;
