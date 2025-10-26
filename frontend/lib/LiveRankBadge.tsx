'use client';

import React from 'react';
import styles from '../styles/LiveRankBadge.module.css';

interface LiveRankBadgeProps {
  rank: number;
}

export function LiveRankBadge({ rank }: LiveRankBadgeProps) {
  // Get color based on rank
  const getRankColor = (position: number): string => {
    if (position === 1) return '#ffd700'; // Gold
    if (position === 2) return '#c0c0c0'; // Silver
    if (position === 3) return '#cd7f32'; // Bronze
    return '#6b7280'; // Gray for others
  };

  const rankColor = getRankColor(rank);

  return (
    <div className={styles.badge} style={{ borderColor: rankColor }}>
      <span className={styles.rankNumber} style={{ color: rankColor }}>
        Ranked {rank}
      </span>
    </div>
  );
}

export default LiveRankBadge;
