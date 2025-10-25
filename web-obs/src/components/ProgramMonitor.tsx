'use client';

import { useEffect, useRef, useState } from 'react';
import { useRemoteParticipants } from '@livekit/components-react';
import { useAppStore } from '@/store/appStore';
import { RemoteParticipant, RemoteVideoTrack, Track } from 'livekit-client';

export default function ProgramMonitor() {
  const { currentProgram } = useAppStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteParticipants = useRemoteParticipants();
  const [activeParticipant, setActiveParticipant] = useState<RemoteParticipant | null>(null);

  // Find active camera participant
  useEffect(() => {
    if (!currentProgram) return;

    // Find participant matching current program
    const participant = remoteParticipants.find(
      (p) => p.identity === currentProgram
    );
    setActiveParticipant(participant || null);
  }, [remoteParticipants, currentProgram]);

  // Attach video track
  useEffect(() => {
    if (!videoRef.current || !activeParticipant) return;

    const participant = activeParticipant;
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
  }, [activeParticipant]);

  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-2xl overflow-hidden border border-slate-200/60 shadow-2xl shadow-slate-200/50">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-50 to-pink-50 px-6 py-4 border-b border-slate-200/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Program Output</h2>
              <p className="text-xs text-slate-500">Main broadcast feed</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500 animate-pulse shadow-lg">
            <div className="relative">
              <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
              <div className="absolute inset-0 w-2.5 h-2.5 bg-white rounded-full animate-ping"></div>
            </div>
            <span className="text-sm font-bold text-white">LIVE</span>
          </div>
        </div>
      </div>

      {/* Video Display */}
      <div className="relative aspect-video bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-contain"
        />

        {currentProgram ? (
          <div className="absolute bottom-6 left-6">
            <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-2xl">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                {currentProgram}
              </span>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Waiting for AI to select camera...</p>
                <p className="text-slate-500 text-sm mt-1">Connect cameras to begin</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
