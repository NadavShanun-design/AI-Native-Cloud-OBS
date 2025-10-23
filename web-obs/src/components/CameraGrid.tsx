'use client';

import { useRoomContext } from '@livekit/components-react';
import { useAppStore } from '@/store/appStore';
import CameraPreview from './CameraPreview';
import { useState, useEffect } from 'react';
import { RemoteParticipant, RoomEvent } from 'livekit-client';

export default function CameraGrid() {
  const room = useRoomContext();
  const { scores, currentProgram } = useAppStore();
  const [cameras, setCameras] = useState<Map<string, RemoteParticipant>>(new Map());

  // Track all camera participants
  useEffect(() => {
    if (!room) return;

    const handleParticipantConnected = (participant: RemoteParticipant) => {
      if (participant.identity.startsWith('cam-')) {
        setCameras(prev => new Map(prev).set(participant.identity, participant));
      }
    };

    const handleParticipantDisconnected = (participant: RemoteParticipant) => {
      setCameras(prev => {
        const next = new Map(prev);
        next.delete(participant.identity);
        return next;
      });
    };

    // Initial participants
    Array.from(room.participants.values()).forEach(handleParticipantConnected);

    // Subscribe to events
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

    return () => {
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    };
  }, [room]);

  // Convert to array and SORT BY SCORE (highest first) for real-time rankings
  const cameraList = Array.from(cameras.entries()).map(([id, participant]) => {
    const scoreData = scores.get(id);
    return {
      id,
      participant,
      score: scoreData?.score || 0,
      reason: scoreData?.reason || '',
      isProgram: id === currentProgram,
    };
  }).sort((a, b) => b.score - a.score); // Sort by score descending

  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-slate-200/60 p-6 shadow-xl shadow-slate-200/50">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Live Camera Rankings</h2>
          <p className="text-sm text-slate-500 mt-0.5">AI-powered scoring updates in real-time</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-violet-50 rounded-xl border border-violet-200">
          <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span className="font-bold text-violet-600">{cameraList.length}</span>
          <span className="text-sm text-slate-600 font-medium">/ 5 Active</span>
        </div>
      </div>

      {cameraList.length === 0 ? (
        <div className="text-center py-16 px-4">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No Cameras Connected</h3>
          <p className="text-slate-500 mb-4">Connect cameras from your phones or laptops to start</p>
          <a
            href="/cameras"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-violet-500/30 transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Connect Cameras
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {cameraList.map((cam, index) => (
            <CameraPreview key={cam.id} camera={cam} rank={index + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
