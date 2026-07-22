export type PadletSessionStatus = "setup" | "active" | "closed" | "expired";

export interface PadletColumn {
  id: string;
  title: string;
}

export interface PadletPost {
  id: string;
  columnId: string;
  text: string;
  authorCode: string;
  createdAt: string | number;
  plusOnes: string[];
}

export interface PadletSessionLimits {
  maxPostLength: number;
  softPostLength: number;
}

export interface PadletSessionSnapshot {
  id: string;
  type: "good-not-good";
  status: PadletSessionStatus;
  createdAt: string;
  expiresAt: string;
  remainingSeconds: number;
  columns: PadletColumn[];
  posts: PadletPost[];
  participantCount: number;
  limits: PadletSessionLimits;
}

export interface PadletCredentials {
  hostToken?: string;
  code?: string;
}

export interface SessionResponse {
  session: PadletSessionSnapshot;
}

export interface CreateSessionResponse extends SessionResponse {
  sessionId: string;
  hostToken: string;
}

export interface ParticipantResponse extends SessionResponse {
  code: string;
}
