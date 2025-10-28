'use client';

/**
 * DetectionOverlayRobust Component
 * Ultra-robust YOLO bounding box renderer with visual debugging
 * Based on best practices: requestAnimationFrame, proper scaling, error handling
 */

import React, { useEffect, useRef, useState } from 'react';
import { Detection } from '../types/ai';

interface DetectionOverlayRobustProps {
  detections: Detection[];
  videoWidth: number;      // Native video resolution width
  videoHeight: number;     // Native video resolution height
  displayWidth: number;    // Displayed video width (after CSS)
  displayHeight: number;   // Displayed video height (after CSS)
  showLabels?: boolean;
  showConfidence?: boolean;
  debug?: boolean;         // Show debug info
}

export function DetectionOverlayRobust({
  detections,
  videoWidth,
  videoHeight,
  displayWidth,
  displayHeight,
  showLabels = true,
  showConfidence = true,
  debug = false,
}: DetectionOverlayRobustProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const [debugInfo, setDebugInfo] = useState<string>('');

  // Direct render without requestAnimationFrame - update immediately when detections change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Validate dimensions
    if (displayWidth === 0 || displayHeight === 0) {
      return;
    }

    if (videoWidth === 0 || videoHeight === 0) {
      return;
    }

    // Render immediately when detections change
    const render = () => {
      // Clear canvas
      ctx.clearRect(0, 0, displayWidth, displayHeight);

      // Calculate scale factors - CRITICAL: These must match actual video display size
      const scaleX = displayWidth / videoWidth;
      const scaleY = displayHeight / videoHeight;

      // Debug info
      if (debug) {
        const info = `Detections: ${detections.length} | Video: ${videoWidth}x${videoHeight} | Display: ${displayWidth}x${displayHeight} | Scale: ${scaleX.toFixed(2)}x${scaleY.toFixed(2)}`;
        setDebugInfo(info);

        // Draw debug border around canvas
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, displayWidth - 4, displayHeight - 4);

        // Draw debug text
        ctx.fillStyle = 'red';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(`CANVAS DEBUG: ${detections.length} detections`, 10, 30);
      }

      // Draw each detection
      detections.forEach((det, index) => {
        try {
          // IMPORTANT: Detections come in absolute pixel coordinates from native video resolution
          // We need to scale them to the displayed resolution
          const x0 = Math.round(det.x0 * scaleX);
          const y0 = Math.round(det.y0 * scaleY);
          const x1 = Math.round(det.x1 * scaleX);
          const y1 = Math.round(det.y1 * scaleY);

          const boxWidth = x1 - x0;
          const boxHeight = y1 - y0;

          // Validate box dimensions
          if (boxWidth <= 0 || boxHeight <= 0 || isNaN(boxWidth) || isNaN(boxHeight)) {
            console.warn(`[DetectionOverlay] Invalid box dimensions for detection ${index}:`, det);
            return;
          }

          // Color based on class
          let color: string;
          let fillColor: string;

          if (det.className === 'person') {
            color = 'rgb(0, 255, 255)'; // Bright cyan for people
            fillColor = 'rgba(0, 255, 255, 0.2)';
          } else if (['car', 'truck', 'bus', 'motorcycle', 'bicycle'].includes(det.className)) {
            color = 'rgb(255, 255, 0)'; // Yellow for vehicles
            fillColor = 'rgba(255, 255, 0, 0.2)';
          } else if (['dog', 'cat', 'bird', 'horse', 'sheep', 'cow'].includes(det.className)) {
            color = 'rgb(0, 255, 0)'; // Green for animals
            fillColor = 'rgba(0, 255, 0, 0.2)';
          } else {
            color = 'rgb(255, 0, 255)'; // Magenta for others
            fillColor = 'rgba(255, 0, 255, 0.2)';
          }

          // Draw filled rectangle
          ctx.fillStyle = fillColor;
          ctx.fillRect(x0, y0, boxWidth, boxHeight);

          // Draw VERY thick border for maximum visibility
          ctx.strokeStyle = color;
          ctx.lineWidth = 5;
          ctx.strokeRect(x0, y0, boxWidth, boxHeight);

          // Add inner shadow for depth
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x0 + 2, y0 + 2, boxWidth - 4, boxHeight - 4);

          // Draw label
          if (showLabels) {
            const label = showConfidence
              ? `${det.className} ${(det.confidence * 100).toFixed(0)}%`
              : det.className;

            ctx.font = 'bold 16px Arial';
            const textMetrics = ctx.measureText(label);
            const textWidth = textMetrics.width;
            const textHeight = 20;

            // Position label
            const labelX = Math.max(2, Math.min(x0, displayWidth - textWidth - 10));
            const labelY = Math.max(textHeight + 5, y0 - 5);

            // Draw label background
            ctx.fillStyle = color;
            ctx.fillRect(labelX - 2, labelY - textHeight, textWidth + 8, textHeight + 4);

            // Draw label border
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.strokeRect(labelX - 2, labelY - textHeight, textWidth + 8, textHeight + 4);

            // Draw label text
            ctx.fillStyle = 'black';
            ctx.font = 'bold 16px Arial';
            ctx.fillText(label, labelX + 2, labelY - 4);
          }

          // Debug: log first detection
          if (debug && index === 0) {
            console.log('[DetectionOverlay] First detection:', {
              original: { x0: det.x0, y0: det.y0, x1: det.x1, y1: det.y1 },
              scaled: { x0, y0, x1, y1 },
              dimensions: { width: boxWidth, height: boxHeight },
              className: det.className,
              confidence: det.confidence
            });
          }
        } catch (error) {
          console.error(`[DetectionOverlay] Error rendering detection ${index}:`, error, det);
        }
      });
    };

    // Render immediately (not in animation loop - React handles updates)
    render();

    // No cleanup needed since we're not using requestAnimationFrame
  }, [detections, videoWidth, videoHeight, displayWidth, displayHeight, showLabels, showConfidence, debug]);

  return (
    <>
      <canvas
        ref={canvasRef}
        width={displayWidth}
        height={displayHeight}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${displayWidth}px`,
          height: `${displayHeight}px`,
          pointerEvents: 'none',
          zIndex: 100,
          border: debug ? '4px solid lime' : 'none', // Debug border
        }}
      />
      {debug && debugInfo && (
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            background: 'rgba(0, 0, 0, 0.9)',
            color: 'lime',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'monospace',
            zIndex: 101,
            border: '2px solid lime',
          }}
        >
          {debugInfo}
        </div>
      )}
    </>
  );
}

/**
 * Simplified badge showing detection counts
 */
export function DetectionBadgeRobust({
  detections,
}: {
  detections: Detection[];
}) {
  if (detections.length === 0) return null;

  const personCount = detections.filter((d) => d.className === 'person').length;
  const vehicleCount = detections.filter((d) =>
    ['car', 'truck', 'bus', 'motorcycle', 'bicycle'].includes(d.className)
  ).length;

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        background: 'rgba(0, 0, 0, 0.85)',
        padding: '6px 10px',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: 'bold',
        color: 'white',
        display: 'flex',
        gap: '10px',
        zIndex: 99,
        border: '2px solid rgb(0, 255, 255)',
      }}
    >
      {personCount > 0 && (
        <span style={{ color: 'rgb(0, 255, 255)' }}>
          👤 {personCount}
        </span>
      )}
      {vehicleCount > 0 && (
        <span style={{ color: 'rgb(255, 255, 0)' }}>
          🚗 {vehicleCount}
        </span>
      )}
      {detections.length > personCount + vehicleCount && (
        <span style={{ color: 'rgb(255, 0, 255)' }}>
          📦 {detections.length - personCount - vehicleCount}
        </span>
      )}
    </div>
  );
}
