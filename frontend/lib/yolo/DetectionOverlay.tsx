'use client';

/**
 * DetectionOverlay Component
 * Renders YOLO detection bounding boxes and labels on a canvas overlay
 */

import React, { useEffect, useRef } from 'react';
import { Detection, YOLO_CLASSES } from './YOLOService';

interface DetectionOverlayProps {
  detections: Detection[];
  width: number;
  height: number;
  showLabels?: boolean;
  showConfidence?: boolean;
  lineWidth?: number;
}

export function DetectionOverlay({
  detections,
  width,
  height,
  showLabels = true,
  showConfidence = true,
  lineWidth = 2,
}: DetectionOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw each detection
    detections.forEach((det, index) => {
      const { x0, y0, x1, y1, confidence, className } = det;

      // Calculate color based on confidence (gradient from red to green)
      const colorIntensity = Math.floor(confidence * 255);
      const red = 255 - colorIntensity;
      const green = colorIntensity;
      const blue = 0;
      const color = `rgb(${red}, ${green}, ${blue})`;

      // Draw bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);

      // Draw semi-transparent fill
      ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, 0.1)`;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

      // Draw label
      if (showLabels) {
        const label = showConfidence
          ? `${className} ${(confidence * 100).toFixed(0)}%`
          : className;

        ctx.font = '14px Arial';
        const textMetrics = ctx.measureText(label);
        const textWidth = textMetrics.width;
        const textHeight = 16; // Approximate height

        // Ensure label stays within canvas bounds
        const labelX = Math.max(0, Math.min(x0, width - textWidth - 8));
        const labelY = Math.max(textHeight + 4, y0);

        // Draw label background
        ctx.fillStyle = color;
        ctx.fillRect(labelX, labelY - textHeight, textWidth + 8, textHeight + 4);

        // Draw label text
        ctx.fillStyle = 'white';
        ctx.fillText(label, labelX + 4, labelY - 2);
      }
    });
  }, [detections, width, height, showLabels, showConfidence, lineWidth]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    />
  );
}

/**
 * Compact version for grid views
 */
export function CompactDetectionOverlay({
  detections,
  width,
  height,
}: {
  detections: Detection[];
  width: number;
  height: number;
}) {
  return (
    <DetectionOverlay
      detections={detections}
      width={width}
      height={height}
      showLabels={false}
      showConfidence={false}
      lineWidth={1}
    />
  );
}

/**
 * Detection count badge
 */
export function DetectionBadge({
  detections,
  className = '',
}: {
  detections: Detection[];
  className?: string;
}) {
  if (detections.length === 0) return null;

  // Count by category
  const personCount = detections.filter((d) => d.className === 'person').length;
  const vehicleCount = detections.filter((d) =>
    ['car', 'truck', 'bus', 'motorcycle', 'bicycle'].includes(d.className)
  ).length;
  const animalCount = detections.filter((d) =>
    ['dog', 'cat', 'bird', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe'].includes(
      d.className
    )
  ).length;
  const otherCount = detections.length - personCount - vehicleCount - animalCount;

  return (
    <div
      className={`detection-badge ${className}`}
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        background: 'rgba(0, 0, 0, 0.7)',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        color: 'white',
        display: 'flex',
        gap: '8px',
        zIndex: 20,
      }}
    >
      {personCount > 0 && (
        <span>
          👤 {personCount}
        </span>
      )}
      {vehicleCount > 0 && (
        <span>
          🚗 {vehicleCount}
        </span>
      )}
      {animalCount > 0 && (
        <span>
          🐾 {animalCount}
        </span>
      )}
      {otherCount > 0 && (
        <span>
          📦 {otherCount}
        </span>
      )}
    </div>
  );
}

/**
 * Performance metrics overlay
 */
export function PerformanceOverlay({
  fps,
  inferenceTime,
  detectionCount,
}: {
  fps: number;
  inferenceTime: number;
  detectionCount: number;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        background: 'rgba(0, 0, 0, 0.7)',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        color: 'white',
        fontFamily: 'monospace',
        zIndex: 20,
      }}
    >
      <div>{fps.toFixed(1)} FPS</div>
      <div>{inferenceTime.toFixed(0)}ms</div>
      <div>{detectionCount} obj</div>
    </div>
  );
}
