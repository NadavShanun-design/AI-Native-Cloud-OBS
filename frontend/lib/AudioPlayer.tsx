/**
 * AudioPlayer Component
 * Plays narration audio with auto-play and volume control
 */

import React, { useRef, useEffect } from 'react';

interface AudioPlayerProps {
  src: string;
  volume: number;
  autoPlay?: boolean;
  onEnded?: () => void;
}

export function AudioPlayer({ src, volume, autoPlay = true, onEnded }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  // Update volume when it changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, [volume]);

  // Play new audio when src changes
  useEffect(() => {
    if (audioRef.current && autoPlay && src) {
      // Reset and play
      audioRef.current.load();
      audioRef.current.play().catch((err) => {
        console.error('[AudioPlayer] Playback failed:', err);
      });
    }
  }, [src, autoPlay]);

  return (
    <audio
      ref={audioRef}
      src={src}
      preload="auto"
      onEnded={onEnded}
      style={{ display: 'none' }}
    />
  );
}

export default AudioPlayer;
