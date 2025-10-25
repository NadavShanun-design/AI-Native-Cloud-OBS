'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function CamerasPage() {
  const [localIP, setLocalIP] = useState<string>('');
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    // Get local IP and protocol from window location
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || `${protocol}//${hostname}:3000`;
    // Extract hostname and port from API URL
    const match = apiUrl.match(/^https?:\/\/([^:/]+)(?::(\d+))?/);
    if (match) {
      const host = match[1];
      const port = match[2] || (apiUrl.startsWith('https') ? '443' : '3000');
      setLocalIP(`${host}:${port}`);
    }
  }, []);

  const cameras = [
    { id: 'cam-1', name: 'Camera 1', gradient: 'from-violet-500 to-purple-600', icon: '📹' },
    { id: 'cam-2', name: 'Camera 2', gradient: 'from-blue-500 to-cyan-600', icon: '🎥' },
    { id: 'cam-3', name: 'Camera 3', gradient: 'from-emerald-500 to-teal-600', icon: '🎬' },
    { id: 'cam-4', name: 'Camera 4', gradient: 'from-amber-500 to-orange-600', icon: '📱' },
    { id: 'cam-5', name: 'Camera 5', gradient: 'from-pink-500 to-rose-600', icon: '💻' },
  ];

  const getCameraUrl = (camId: string) => {
    // Use current page protocol if available (client-side), default to https
    const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
    return `${protocol}//${localIP}/camera?id=${camId}`;
  };

  const copyToClipboard = (url: string, index: number) => {
    navigator.clipboard.writeText(url);
    setCopied(index);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                  Connect Cameras
                </h1>
                <p className="text-sm text-slate-500">Turn any device into a camera</p>
              </div>
            </div>
            <a
              href="/"
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all duration-200 font-semibold text-sm text-slate-700 border border-slate-200"
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Dashboard
              </span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Instructions */}
        <div className="mb-12 bg-white/60 backdrop-blur-xl rounded-2xl border border-slate-200/60 p-8 shadow-xl shadow-slate-200/50">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Quick Start Guide</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Phone Instructions */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-6 border border-emerald-200">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-3xl">📱</span>
                <h3 className="text-lg font-bold text-emerald-700">From Phone/Tablet</h3>
              </div>
              <ol className="space-y-3">
                {['Open your camera app', 'Scan any QR code below', 'Tap the notification', 'Tap "Start Broadcasting"'].map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-sm font-bold shadow-lg">{i + 1}</span>
                    <span className="text-slate-700 font-medium pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Laptop Instructions */}
            <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-xl p-6 border border-violet-200">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-3xl">💻</span>
                <h3 className="text-lg font-bold text-violet-700">From Laptop/Desktop</h3>
              </div>
              <ol className="space-y-3">
                {['Click "Copy URL" button below', 'Paste in a new browser tab (Safari recommended)', 'Click "Start Broadcasting"', 'Allow camera access when prompted'].map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white text-sm font-bold shadow-lg">{i + 1}</span>
                    <span className="text-slate-700 font-medium pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="mt-6 p-5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💡</span>
              <div>
                <p className="font-semibold text-amber-900 mb-1">Pro Tip</p>
                <p className="text-sm text-amber-800">
                  Works on ANY device with a camera - iPhones, Android, MacBooks, Windows laptops! Mix and match up to 5 cameras. All devices must be on the same WiFi network.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* QR Codes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cameras.map((camera, index) => {
            const url = getCameraUrl(camera.id);

            return (
              <div
                key={camera.id}
                className="group bg-white rounded-2xl border-2 border-slate-200 overflow-hidden hover:shadow-2xl hover:border-violet-300 transition-all duration-300"
              >
                {/* Header */}
                <div className={`bg-gradient-to-r ${camera.gradient} px-6 py-4 flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{camera.icon}</span>
                    <div>
                      <h3 className="font-bold text-white text-lg">{camera.name}</h3>
                      <span className="text-xs text-white/80 font-mono">{camera.id}</span>
                    </div>
                  </div>
                </div>

                {/* QR Code */}
                <div className="p-8 bg-gradient-to-br from-slate-50 to-white flex items-center justify-center">
                  <div className="p-4 bg-white rounded-2xl shadow-xl border-2 border-slate-200">
                    <QRCodeSVG value={url} size={180} level="H" />
                  </div>
                </div>

                {/* URL Section */}
                <div className="p-5 bg-slate-50 border-t border-slate-200 space-y-3">
                  <div className="bg-white px-3 py-2 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500 font-mono break-all leading-relaxed">
                      {url}
                    </p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(url, index)}
                    className={`w-full px-4 py-3 rounded-xl font-bold transition-all duration-200 shadow-lg ${
                      copied === index
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
                        : 'bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white'
                    }`}
                  >
                    {copied === index ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied!
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy URL
                      </span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
