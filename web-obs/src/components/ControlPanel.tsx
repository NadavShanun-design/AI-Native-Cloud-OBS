'use client';

import { useAppStore } from '@/store/appStore';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

export default function ControlPanel() {
  const {
    manualMode,
    setManualMode,
    narrationEnabled,
    toggleNarration,
    lastSwitch,
  } = useAppStore();

  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-slate-200/60 p-6 shadow-xl shadow-slate-200/50">
      <h2 className="text-xl font-bold text-slate-800 mb-6">Control Panel</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Auto/Manual Mode */}
        <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <label className="text-sm font-semibold text-slate-600 mb-3 block flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
            Switching Mode
          </label>
          <button
            onClick={() => setManualMode(!manualMode)}
            className={`w-full px-4 py-3 rounded-xl font-bold transition-all duration-200 shadow-lg ${
              manualMode
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-amber-500/30'
                : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-emerald-500/30'
            }`}
          >
            {manualMode ? (
              <div className="flex items-center justify-center gap-2">
                <Pause className="w-5 h-5" />
                <span>Manual Mode</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <Play className="w-5 h-5" />
                <span>Auto Mode</span>
              </div>
            )}
          </button>
        </div>

        {/* Narration Toggle */}
        <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <label className="text-sm font-semibold text-slate-600 mb-3 block flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            AI Commentary
          </label>
          <button
            onClick={toggleNarration}
            className={`w-full px-4 py-3 rounded-xl font-bold transition-all duration-200 shadow-lg ${
              narrationEnabled
                ? 'bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white shadow-violet-500/30'
                : 'bg-gradient-to-r from-slate-400 to-slate-500 hover:from-slate-500 hover:to-slate-600 text-white shadow-slate-500/20'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              {narrationEnabled ? (
                <Volume2 className="w-5 h-5" />
              ) : (
                <VolumeX className="w-5 h-5" />
              )}
              <span>{narrationEnabled ? 'Enabled' : 'Disabled'}</span>
            </div>
          </button>
        </div>

        {/* Last Switch Info */}
        <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <label className="text-sm font-semibold text-slate-600 mb-3 block flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Last Switch
          </label>
          <div className="text-sm">
            {lastSwitch ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-mono font-bold text-slate-800 bg-gradient-to-r from-emerald-100 to-teal-100 px-3 py-2 rounded-lg">
                  <span className="text-slate-600">{lastSwitch.fromCam}</span>
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <span className="text-emerald-600">{lastSwitch.toCam}</span>
                </div>
                <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                  {lastSwitch.rationale}
                </p>
              </div>
            ) : (
              <div className="text-slate-400 text-center py-4">
                <svg className="w-8 h-8 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                No switches yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
