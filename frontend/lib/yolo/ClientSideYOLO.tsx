'use client';

/**
 * ClientSideYOLO Component
 * Runs object detection directly in the browser using TensorFlow.js + COCO-SSD
 * This matches the exact approach from the working test-yolo.html
 */

import React, { useEffect, useRef, useState } from 'react';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';

interface ClientSideYOLOProps {
  videoElement: HTMLVideoElement | null;
  enabled?: boolean;
  debug?: boolean;
  showLabels?: boolean;
  showConfidence?: boolean;
  onCoverageUpdate?: (coverage: number) => void; // Callback for person coverage %
}

interface Detection {
  bbox: [number, number, number, number]; // [x, y, width, height]
  class: string;
  score: number;
}

export function ClientSideYOLO({
  videoElement,
  enabled = true,
  debug = false,
  showLabels = true,
  showConfidence = true,
  onCoverageUpdate,
}: ClientSideYOLOProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const animationFrameRef = useRef<number>();

  const [modelLoaded, setModelLoaded] = useState(false);
  const [detectionCount, setDetectionCount] = useState(0);
  const [fps, setFps] = useState(0);

  const lastFrameTimeRef = useRef(Date.now());
  const frameCountRef = useRef(0);

  // Load COCO-SSD model
  useEffect(() => {
    let isMounted = true;

    async function loadModel() {
      try {
        console.log('[ClientSideYOLO] Loading COCO-SSD model...');
        const model = await cocoSsd.load();

        if (isMounted) {
          modelRef.current = model;
          setModelLoaded(true);
          console.log('[ClientSideYOLO] ✓ Model loaded successfully');
        }
      } catch (error) {
        console.error('[ClientSideYOLO] Error loading model:', error);
      }
    }

    loadModel();

    return () => {
      isMounted = false;
    };
  }, []);

  // Main detection loop
  useEffect(() => {
    if (!enabled || !modelLoaded || !modelRef.current || !videoElement || !canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const model = modelRef.current;
    let isRunning = true;

    // Match canvas to video dimensions
    canvas.width = videoElement.videoWidth || videoElement.clientWidth;
    canvas.height = videoElement.videoHeight || videoElement.clientHeight;

    console.log('[ClientSideYOLO] Starting detection loop', {
      videoWidth: videoElement.videoWidth,
      videoHeight: videoElement.videoHeight,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
    });

    async function detectFrame() {
      if (!isRunning || !videoElement || videoElement.readyState !== 4) {
        if (isRunning) {
          animationFrameRef.current = requestAnimationFrame(detectFrame);
        }
        return;
      }

      try {
        // Run detection on video element
        const predictions = await model.detect(videoElement);

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Update detection count
        setDetectionCount(predictions.length);

        // Calculate person coverage percentage
        let totalPersonArea = 0;
        const totalVideoArea = canvas.width * canvas.height;

        predictions.forEach((prediction: Detection) => {
          if (prediction.class === 'person') {
            const [x, y, width, height] = prediction.bbox;
            totalPersonArea += width * height;
          }
        });

        const personCoverage = totalVideoArea > 0 ? totalPersonArea / totalVideoArea : 0;

        // Call callback with coverage percentage
        if (onCoverageUpdate) {
          onCoverageUpdate(personCoverage);
        }

        // Draw each detection
        predictions.forEach((prediction: Detection, index: number) => {
          const [x, y, width, height] = prediction.bbox;
          const label = prediction.class;
          const score = prediction.score;

          // Choose color based on class
          let color = '#ff00ff'; // magenta default
          let fillColor = 'rgba(255, 0, 255, 0.15)';

          if (label === 'person') {
            color = '#00ff00'; // green for person
            fillColor = 'rgba(0, 255, 0, 0.15)';
          } else if (['car', 'truck', 'bus', 'motorcycle', 'bicycle'].includes(label)) {
            color = '#ffff00'; // yellow for vehicles
            fillColor = 'rgba(255, 255, 0, 0.2)';
          }

          // Draw filled rectangle
          ctx.fillStyle = fillColor;
          ctx.fillRect(x, y, width, height);

          // Draw thick border
          ctx.strokeStyle = color;
          ctx.lineWidth = 4;
          ctx.strokeRect(x, y, width, height);

          // Draw label
          if (showLabels) {
            const labelText = showConfidence
              ? `${label} ${(score * 100).toFixed(0)}%`
              : label;

            ctx.font = 'bold 16px Arial';
            const textMetrics = ctx.measureText(labelText);
            const textWidth = textMetrics.width;
            const textHeight = 20;

            // Label background
            ctx.fillStyle = color;
            ctx.fillRect(x, y - textHeight - 4, textWidth + 10, textHeight + 4);

            // Label text
            ctx.fillStyle = 'black';
            ctx.fillText(labelText, x + 5, y - 8);
          }

          // Debug logging for first detection
          if (debug && index === 0) {
            console.log('[ClientSideYOLO] Detection:', {
              class: label,
              score: (score * 100).toFixed(1) + '%',
              bbox: `(${Math.round(x)}, ${Math.round(y)}) [${Math.round(width)}x${Math.round(height)}]`,
            });
          }
        });

        // Calculate FPS
        frameCountRef.current++;
        const now = Date.now();
        if (now - lastFrameTimeRef.current >= 1000) {
          setFps(frameCountRef.current);
          frameCountRef.current = 0;
          lastFrameTimeRef.current = now;
        }

      } catch (error) {
        console.error('[ClientSideYOLO] Detection error:', error);
      }

      // Continue loop
      if (isRunning) {
        animationFrameRef.current = requestAnimationFrame(detectFrame);
      }
    }

    // Start detection loop
    detectFrame();

    return () => {
      isRunning = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [enabled, modelLoaded, videoElement, debug, showLabels, showConfidence]);

  // Update canvas size when video dimensions change
  useEffect(() => {
    if (!videoElement || !canvasRef.current) return;

    const updateCanvasSize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const newWidth = videoElement.videoWidth || videoElement.clientWidth;
      const newHeight = videoElement.videoHeight || videoElement.clientHeight;

      if (canvas.width !== newWidth || canvas.height !== newHeight) {
        canvas.width = newWidth;
        canvas.height = newHeight;
        console.log('[ClientSideYOLO] Canvas resized:', newWidth, 'x', newHeight);
      }
    };

    videoElement.addEventListener('loadedmetadata', updateCanvasSize);
    videoElement.addEventListener('resize', updateCanvasSize);

    // Initial size
    updateCanvasSize();

    return () => {
      videoElement.removeEventListener('loadedmetadata', updateCanvasSize);
      videoElement.removeEventListener('resize', updateCanvasSize);
    };
  }, [videoElement]);

  if (!enabled) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 100,
      }}
    />
  );
}
