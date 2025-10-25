'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { WSEvent } from '@ai-obs/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function StatsPanel() {
  const { updateScore, setLastSwitch, setWsConnected, setCurrentProgram } = useAppStore();
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    // Connect to WebSocket for real-time events
    const wsUrl = API_URL.replace('http', 'ws') + '/ws';
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setWsConnected(true);
      addEvent('Connected to event stream');
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSEvent = JSON.parse(event.data);

        switch (msg.type) {
          case 'score':
            if (msg.payload.payload) {
              updateScore(msg.payload.payload);
            }
            break;

          case 'switch':
            if (msg.payload.payload) {
              setLastSwitch(msg.payload.payload);
              if (msg.payload.payload.toCam) {
                setCurrentProgram(msg.payload.payload.toCam);
              }
              addEvent(`Switch: ${msg.payload.payload.rationale}`);
            }
            break;

          case 'narration':
            if (msg.payload.payload?.text) {
              addEvent(`Narration: ${msg.payload.payload.text}`);
            }
            break;

          case 'status':
            if (msg.payload.payload?.camera) {
              setCurrentProgram(msg.payload.payload.camera);
            }
            break;
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      addEvent('Disconnected from event stream');
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      addEvent('WebSocket error');
    };

    return () => {
      ws.close();
    };
  }, [updateScore, setLastSwitch, setWsConnected, setCurrentProgram]);

  const addEvent = (event: string) => {
    setEvents((prev) => [
      `${new Date().toLocaleTimeString()}: ${event}`,
      ...prev.slice(0, 9),
    ]);
  };

  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-slate-200/60 shadow-xl shadow-slate-200/50 h-full flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-50 to-violet-50 px-6 py-4 border-b border-slate-200/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Activity Feed</h2>
            <p className="text-xs text-slate-500">Real-time AI decisions</p>
          </div>
        </div>
      </div>

      {/* Event Feed */}
      <div className="flex-1 p-4 space-y-2 overflow-y-auto">
        {events.length > 0 ? (
          events.map((event, i) => {
            const isSwitch = event.includes('Switch:');
            const isNarration = event.includes('Narration:');
            const isConnection = event.includes('Connected') || event.includes('Disconnected');

            return (
              <div
                key={i}
                className={`group relative pl-4 pr-3 py-3 rounded-xl border transition-all duration-200 hover:shadow-md ${
                  isSwitch
                    ? 'bg-gradient-to-r from-violet-50 to-indigo-50 border-violet-200 hover:border-violet-300'
                    : isNarration
                    ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200 hover:border-emerald-300'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Timeline Dot */}
                <div className={`absolute left-1.5 top-4 w-2 h-2 rounded-full ${
                  isSwitch ? 'bg-violet-500' : isNarration ? 'bg-emerald-500' : 'bg-slate-400'
                }`}></div>

                {/* Event Icon */}
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-0.5">
                    {isSwitch ? (
                      <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    ) : isNarration ? (
                      <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-600 font-mono leading-relaxed break-words">
                      {event}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-12">
            <div className="w-16 h-16 mb-4 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500 font-medium">No activity yet</p>
            <p className="text-xs text-slate-400 mt-1">Events will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}
