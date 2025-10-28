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
  detections?: Detection[];  // Detection data from backend YOLO
  track_name?: string;  // Track name from LiveKit (e.g., "Camera 1")
  track_sid?: string;   // Track SID from LiveKit (e.g., "TR_abc123")
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
