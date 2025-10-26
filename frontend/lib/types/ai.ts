/**
 * TypeScript types for AI video ranking system
 */

export interface AIScore {
  cam_id: string;
  camId: string;
  score: number; // 0.0 to 1.0
  reason: string;
  timestamp: number;
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
