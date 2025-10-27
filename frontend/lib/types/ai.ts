/**
 * TypeScript types for AI video ranking system
 */

export interface Detection {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  confidence: number;
  classId: number;
  className: string;
}

export interface AIScore {
  cam_id: string;
  camId: string;
  score: number; // 0.0 to 1.0
  reason: string;
  timestamp: number;
  detections?: Detection[];  // NEW: Detection data from backend YOLO
}

export interface ScoreMessage {
  type: 'score' | 'initial';
  payload: AIScore | AIScore[];
}

export interface VideoUploadStatus {
  filename: string;
  status: 'uploading' | 'playing' | 'error';
  progress?: number;
}

export interface ParticipantWithScore {
  participantId: string;
  participantName: string;
  score?: AIScore;
  rank?: number;
}
