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

  // Use white color for all scores
  const scoreColor = '#ffffff';

  // Get rank label
  const getRankLabel = (position?: number): string => {
    if (!position) return '';
    return `#${position}`;
  };

  const rankLabel = getRankLabel(rank);

  if (compact) {
    return (
      <div className={styles.compact} style={{ borderColor: scoreColor }}>
        {rank && (
          <span className={styles.rankBadge}>
            {rankLabel}
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
            {rankLabel}
          </div>
        )}
        <div className={styles.score} style={{ color: scoreColor }}>
          <span className={styles.scoreNumber}>{scorePercent}</span>
          <span className={styles.scoreLabel}>coverage</span>
        </div>
      </div>

      {showReason && score.reason && (
        <div className={styles.reason}>
          <div className={styles.reasonLabel}>Person Detection:</div>
          <div className={styles.reasonText}>{score.reason}</div>
        </div>
      )}
    </div>
  );
}

export default AIScoreOverlay;
