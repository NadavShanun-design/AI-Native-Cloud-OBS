'use client';

import { useEffect, useRef } from 'react';
import { RemoteParticipant, RemoteVideoTrack, Track } from 'livekit-client';
import { useAppStore } from '@/store/appStore';

interface CameraPreviewProps {
  camera: {
    id: string;
    participant: RemoteParticipant;
    score: number;
    reason?: string;
    isProgram: boolean;
  };
  rank: number;
}

export default function CameraPreview({ camera, rank }: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { setCurrentProgram, manualMode } = useAppStore();

  // Rank badge colors
  const getRankBadge = () => {
    if (rank === 1) return { bg: 'from-yellow-400 to-amber-500', text: '🥇 1st', border: 'border-yellow-400' };
    if (rank === 2) return { bg: 'from-slate-300 to-slate-400', text: '🥈 2nd', border: 'border-slate-400' };
    if (rank === 3) return { bg: 'from-amber-600 to-amber-700', text: '🥉 3rd', border: 'border-amber-600' };
    return { bg: 'from-slate-500 to-slate-600', text: `#${rank}`, border: 'border-slate-500' };
  };

  const rankBadge = getRankBadge();

  useEffect(() => {
    if (!videoRef.current || !camera.participant) return;

    const participant = camera.participant;
    const videoElement = videoRef.current;

    // Function to attach video track
    const attachVideoTrack = () => {
      const videoPublication = participant.getTrack(Track.Source.Camera);

      if (videoPublication?.track) {
        const videoTrack = videoPublication.track as RemoteVideoTrack;
        videoTrack.attach(videoElement);
      }
    };

    // Function to detach video track
    const detachVideoTrack = () => {
      const videoPublication = participant.getTrack(Track.Source.Camera);

      if (videoPublication?.track) {
        const videoTrack = videoPublication.track as RemoteVideoTrack;
        videoTrack.detach(videoElement);
      }
    };

    // Attach immediately if track already exists
    attachVideoTrack();

    // Listen for track subscribed event (in case track arrives later)
    participant.on('trackSubscribed', attachVideoTrack);

    return () => {
      participant.off('trackSubscribed', attachVideoTrack);
      detachVideoTrack();
    };
  }, [camera.participant]);

  const handleClick = () => {
    if (manualMode) {
      setCurrentProgram(camera.id);
    }
  };

  return (
    <div
      className={`group relative rounded-2xl overflow-hidden bg-white border-2 transition-all duration-300 hover:shadow-2xl ${
        camera.isProgram
          ? 'border-red-500 shadow-xl shadow-red-500/20 ring-4 ring-red-500/10'
          : `${rankBadge.border} hover:border-violet-400`
      } ${manualMode ? 'cursor-pointer' : ''}`}
      onClick={handleClick}
    >
      {/* Video Feed */}
      <div className="aspect-video bg-gradient-to-br from-slate-900 to-slate-800 relative overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {/* Gradient Overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      {/* Camera Label */}
      <div className="absolute top-3 left-3 px-3 py-1.5 rounded-xl bg-white/90 backdrop-blur-sm border border-slate-200 shadow-lg">
        <span className="text-xs font-bold text-slate-700">{camera.id.toUpperCase()}</span>
      </div>

      {/* Rank Badge */}
      <div className="absolute top-3 right-3">
        <div className={`px-3 py-1.5 rounded-xl bg-gradient-to-r ${rankBadge.bg} text-white font-bold text-sm shadow-lg backdrop-blur-sm transition-all duration-300`}>
          {rankBadge.text}
        </div>
      </div>

      {/* LIVE Indicator */}
      {camera.isProgram && (
        <div className="absolute bottom-3 right-3 animate-pulse">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-600 text-white font-bold text-xs shadow-lg">
            <div className="w-2 h-2 bg-white rounded-full animate-ping absolute"></div>
            <div className="w-2 h-2 bg-white rounded-full"></div>
            <span>ON AIR</span>
          </div>
        </div>
      )}

      {/* Score Section */}
      <div className="p-3 bg-gradient-to-br from-slate-50 to-white border-t border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">AI Score</span>
          <span className="text-lg font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            {Math.round(camera.score * 100)}
          </span>
        </div>

        {/* Animated Score Bar */}
        <div className="relative w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out ${
              camera.isProgram
                ? 'bg-gradient-to-r from-red-500 to-pink-500'
                : 'bg-gradient-to-r from-violet-500 to-indigo-500'
            }`}
            style={{ width: `${camera.score * 100}%` }}
          >
            <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
          </div>
        </div>

        {/* AI Reason */}
        {camera.reason && (
          <p className="mt-2 text-xs text-slate-600 line-clamp-2 leading-relaxed">
            {camera.reason}
          </p>
        )}
      </div>
    </div>
  );
}
