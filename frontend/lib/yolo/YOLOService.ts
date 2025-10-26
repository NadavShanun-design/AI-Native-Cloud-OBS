/**
 * YOLO Object Detection Service
 * Handles model loading, preprocessing, inference, and postprocessing
 * for browser-based YOLO object detection using ONNXRuntime Web
 */

import * as ort from 'onnxruntime-web';
import ndarray from 'ndarray';
import ops from 'ndarray-ops';

// COCO dataset classes (80 classes) - used by all YOLO models
export const YOLO_CLASSES = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
  'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
  'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
  'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
  'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
  'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
  'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair',
  'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
  'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator',
  'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
];

export interface Detection {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  confidence: number;
  classId: number;
  className: string;
}

export interface YOLOConfig {
  modelPath: string;
  inputSize: [number, number];
  confidenceThreshold: number;
  iouThreshold: number;
}

export interface YOLOPerformance {
  preprocessTime: number;
  inferenceTime: number;
  postprocessTime: number;
  totalTime: number;
  fps: number;
}

export class YOLOService {
  private session: ort.InferenceSession | null = null;
  private config: YOLOConfig;
  private isLoading: boolean = false;
  private lastPerformance: YOLOPerformance | null = null;

  constructor(config: Partial<YOLOConfig> = {}) {
    this.config = {
      modelPath: config.modelPath || '/models/yolo11n_256.onnx',
      inputSize: config.inputSize || [256, 256],
      confidenceThreshold: config.confidenceThreshold || 0.25,
      iouThreshold: config.iouThreshold || 0.4,
    };

    // Configure ONNX Runtime for browser
    if (typeof window !== 'undefined') {
      ort.env.wasm.wasmPaths = '/_next/static/chunks/';
      ort.env.wasm.numThreads = 1; // Use single thread for stability
    }
  }

  /**
   * Initialize ONNX Runtime session with YOLO model
   */
  async initialize(): Promise<void> {
    if (this.session) {
      console.log('[YOLO] Model already loaded');
      return;
    }

    if (this.isLoading) {
      console.log('[YOLO] Model loading in progress...');
      // Wait for loading to complete
      while (this.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this.isLoading = true;

    try {
      console.log(`[YOLO] Loading model: ${this.config.modelPath}`);
      const startTime = performance.now();

      this.session = await ort.InferenceSession.create(
        this.config.modelPath,
        {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
        }
      );

      const loadTime = performance.now() - startTime;
      console.log(`[YOLO] ✅ Model loaded successfully in ${loadTime.toFixed(2)}ms`);
      console.log(`[YOLO] Input names:`, this.session.inputNames);
      console.log(`[YOLO] Output names:`, this.session.outputNames);

      this.isLoading = false;
    } catch (error) {
      this.isLoading = false;
      console.error('[YOLO] ❌ Failed to load model:', error);
      throw new Error(`Failed to load YOLO model: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Preprocess image data for YOLO model
   * Converts ImageData to NCHW tensor format (batch, channels, height, width)
   */
  private preprocess(imageData: ImageData): ort.Tensor {
    const [width, height] = this.config.inputSize;
    const { data } = imageData;

    // Create ndarray from RGBA data
    const dataTensor = ndarray(new Float32Array(data), [width, height, 4]);

    // Create output tensor in NCHW format
    const processedTensor = ndarray(
      new Float32Array(width * height * 3),
      [1, 3, width, height]
    );

    // Extract RGB channels (discard alpha)
    ops.assign(processedTensor.pick(0, 0, null, null), dataTensor.pick(null, null, 0)); // R
    ops.assign(processedTensor.pick(0, 1, null, null), dataTensor.pick(null, null, 1)); // G
    ops.assign(processedTensor.pick(0, 2, null, null), dataTensor.pick(null, null, 2)); // B

    // Normalize to [0, 1]
    ops.divseq(processedTensor, 255.0);

    // Create ONNX tensor
    return new ort.Tensor('float32', processedTensor.data as Float32Array, [1, 3, width, height]);
  }

  /**
   * Run YOLO inference on preprocessed tensor
   */
  private async infer(inputTensor: ort.Tensor): Promise<ort.Tensor> {
    if (!this.session) {
      throw new Error('[YOLO] Model not initialized. Call initialize() first.');
    }

    const feeds = { [this.session.inputNames[0]]: inputTensor };
    const results = await this.session.run(feeds);
    return results[this.session.outputNames[0]];
  }

  /**
   * Postprocess YOLO output tensor to detections
   * Handles YOLOv11/v12 format: [1, 84, num_anchors]
   * 84 = 4 (bbox coords) + 80 (class probabilities)
   */
  private postprocess(
    outputTensor: ort.Tensor,
    canvasWidth: number,
    canvasHeight: number
  ): Detection[] {
    const detections: Detection[] = [];
    const [modelWidth, modelHeight] = this.config.inputSize;

    // Scale factors to map model coordinates to canvas coordinates
    const scaleX = canvasWidth / modelWidth;
    const scaleY = canvasHeight / modelHeight;

    const data = outputTensor.data as Float32Array;
    const dims = outputTensor.dims;

    // YOLOv11/v12 format: [1, 84, num_anchors]
    // 84 = 4 (bbox) + 80 (classes)
    const numAnchors = dims[2]; // e.g., 1344 for 256x256, 8400 for 640x640
    const numClasses = 80;

    for (let i = 0; i < numAnchors; i++) {
      // Extract bbox coordinates (center format: x_center, y_center, width, height)
      const xCenter = data[i];
      const yCenter = data[numAnchors + i];
      const width = data[2 * numAnchors + i];
      const height = data[3 * numAnchors + i];

      // Find max class probability
      let maxScore = 0;
      let maxClassId = 0;

      for (let j = 0; j < numClasses; j++) {
        const score = data[(4 + j) * numAnchors + i];
        if (score > maxScore) {
          maxScore = score;
          maxClassId = j;
        }
      }

      // Filter by confidence threshold
      if (maxScore > this.config.confidenceThreshold) {
        // Convert center format to corner format (x0, y0, x1, y1)
        const x0 = (xCenter - width / 2) * scaleX;
        const y0 = (yCenter - height / 2) * scaleY;
        const x1 = (xCenter + width / 2) * scaleX;
        const y1 = (yCenter + height / 2) * scaleY;

        detections.push({
          x0,
          y0,
          x1,
          y1,
          confidence: maxScore,
          classId: maxClassId,
          className: YOLO_CLASSES[maxClassId],
        });
      }
    }

    // Apply Non-Maximum Suppression to remove overlapping boxes
    return this.applyNMS(detections);
  }

  /**
   * Apply Non-Maximum Suppression to remove overlapping boxes
   * Only suppresses boxes of the same class
   */
  private applyNMS(detections: Detection[]): Detection[] {
    // Sort by confidence (descending)
    detections.sort((a, b) => b.confidence - a.confidence);

    const keep: boolean[] = new Array(detections.length).fill(true);

    for (let i = 0; i < detections.length; i++) {
      if (!keep[i]) continue;

      const boxA = detections[i];
      for (let j = i + 1; j < detections.length; j++) {
        if (!keep[j]) continue;

        const boxB = detections[j];

        // Only suppress within same class
        if (boxA.classId !== boxB.classId) continue;

        // Calculate IoU (Intersection over Union)
        const iou = this.calculateIoU(boxA, boxB);

        if (iou > this.config.iouThreshold) {
          keep[j] = false; // Suppress lower-confidence box
        }
      }
    }

    return detections.filter((_, index) => keep[index]);
  }

  /**
   * Calculate Intersection over Union (IoU) between two boxes
   */
  private calculateIoU(boxA: Detection, boxB: Detection): number {
    // Intersection coordinates
    const x0 = Math.max(boxA.x0, boxB.x0);
    const y0 = Math.max(boxA.y0, boxB.y0);
    const x1 = Math.min(boxA.x1, boxB.x1);
    const y1 = Math.min(boxA.y1, boxB.y1);

    // Intersection area
    const intersectionArea = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);

    if (intersectionArea === 0) return 0;

    // Union area
    const boxAArea = (boxA.x1 - boxA.x0) * (boxA.y1 - boxA.y0);
    const boxBArea = (boxB.x1 - boxB.x0) * (boxB.y1 - boxB.y0);
    const unionArea = boxAArea + boxBArea - intersectionArea;

    return intersectionArea / unionArea;
  }

  /**
   * Main detection method: Process video frame and return detections
   */
  async detect(videoElement: HTMLVideoElement): Promise<Detection[]> {
    if (!this.session) {
      throw new Error('[YOLO] Model not initialized');
    }

    const totalStartTime = performance.now();

    // 1. PREPROCESSING: Capture frame from video
    const preprocessStartTime = performance.now();

    const canvas = document.createElement('canvas');
    const [modelWidth, modelHeight] = this.config.inputSize;
    canvas.width = modelWidth;
    canvas.height = modelHeight;

    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    // Draw video frame to canvas (resized to model input size)
    ctx.drawImage(videoElement, 0, 0, modelWidth, modelHeight);

    // Get image data
    const imageData = ctx.getImageData(0, 0, modelWidth, modelHeight);

    // Preprocess to tensor
    const inputTensor = this.preprocess(imageData);

    const preprocessTime = performance.now() - preprocessStartTime;

    // 2. INFERENCE: Run model
    const inferenceStartTime = performance.now();
    const outputTensor = await this.infer(inputTensor);
    const inferenceTime = performance.now() - inferenceStartTime;

    // 3. POSTPROCESSING: Parse output and apply NMS
    const postprocessStartTime = performance.now();
    const detections = this.postprocess(
      outputTensor,
      videoElement.videoWidth,
      videoElement.videoHeight
    );
    const postprocessTime = performance.now() - postprocessStartTime;

    const totalTime = performance.now() - totalStartTime;

    // Store performance metrics
    this.lastPerformance = {
      preprocessTime,
      inferenceTime,
      postprocessTime,
      totalTime,
      fps: 1000 / totalTime,
    };

    return detections;
  }

  /**
   * Detect objects from canvas context (alternative method)
   */
  async detectFromCanvas(ctx: CanvasRenderingContext2D, width: number, height: number): Promise<Detection[]> {
    if (!this.session) {
      throw new Error('[YOLO] Model not initialized');
    }

    // Resize canvas to model input size
    const [modelWidth, modelHeight] = this.config.inputSize;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = modelWidth;
    tempCanvas.height = modelHeight;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true })!;

    // Draw resized image
    tempCtx.drawImage(ctx.canvas, 0, 0, width, height, 0, 0, modelWidth, modelHeight);

    // Get image data
    const imageData = tempCtx.getImageData(0, 0, modelWidth, modelHeight);

    // Preprocess
    const inputTensor = this.preprocess(imageData);

    // Infer
    const outputTensor = await this.infer(inputTensor);

    // Postprocess
    return this.postprocess(outputTensor, width, height);
  }

  /**
   * Check if model is ready
   */
  isReady(): boolean {
    return this.session !== null && !this.isLoading;
  }

  /**
   * Get model configuration
   */
  getConfig(): YOLOConfig {
    return { ...this.config };
  }

  /**
   * Get last performance metrics
   */
  getPerformance(): YOLOPerformance | null {
    return this.lastPerformance;
  }

  /**
   * Update configuration (requires reinitialization if model path changes)
   */
  updateConfig(newConfig: Partial<YOLOConfig>): void {
    const oldModelPath = this.config.modelPath;
    this.config = { ...this.config, ...newConfig };

    if (newConfig.modelPath && newConfig.modelPath !== oldModelPath) {
      console.log('[YOLO] Model path changed, session will be reinitialized on next detect()');
      this.session = null;
    }
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    if (this.session) {
      await this.session.release();
      this.session = null;
      console.log('[YOLO] Session disposed');
    }
  }
}
