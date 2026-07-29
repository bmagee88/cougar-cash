export type PadletSessionStatus = "setup" | "active" | "closed" | "expired";
export type PadletSessionType = "good-not-good" | "one-q-many-a";
export type PadletPostType = "reflection" | "question" | "answer";

export interface PadletColumn {
  id: string;
  title: string;
}

export interface PadletParticipant {
  code: string;
  avatarUrl?: string;
  showMe?: boolean;
  issuedAt: string;
  joinedAt: string | null;
  lastSeenAt: string | null;
}

export interface PadletParticipantProfile {
  code: string;
  avatarUrl?: string;
  showMe?: boolean;
}

export interface PadletPost {
  id: string;
  columnId: string;
  text: string;
  authorCode: string;
  authorAvatarUrl?: string;
  authorShowMe?: boolean;
  postType?: PadletPostType;
  parentPostId?: string | null;
  copiedFromPostId?: string;
  sourceAuthorCode?: string;
  restrictedPlusOneCodes?: string[];
  createdAt: string | number;
  plusOnes: string[];
}

export interface PadletSessionLimits {
  maxPostLength: number;
  softPostLength: number;
}

export interface PadletSessionSnapshot {
  id: string;
  name: string;
  type: PadletSessionType;
  status: PadletSessionStatus;
  prompt?: string;
  createdAt: string;
  expiresAt: string;
  closedAt?: string | null;
  remainingSeconds: number;
  columns: PadletColumn[];
  posts: PadletPost[];
  participantCount: number;
  participantProfiles: PadletParticipantProfile[];
  participants?: PadletParticipant[];
  limits: PadletSessionLimits;
}

export interface PadletSessionSummary {
  id: string;
  name: string;
  type: PadletSessionType;
  status: PadletSessionStatus;
  prompt?: string;
  createdAt: string;
  expiresAt: string;
  closedAt?: string | null;
  remainingSeconds: number;
  columns: PadletColumn[];
  postCount: number;
  participantCount: number;
}

export interface PadletCredentials {
  hostToken?: string;
  code?: string;
}

export interface SessionResponse {
  session: PadletSessionSnapshot;
}

export interface CreateSessionRequest {
  name?: string;
  type: PadletSessionType;
  columnTitles?: [string, string];
  prompt?: string;
}

export interface CreateSessionResponse extends SessionResponse {
  sessionId: string;
  hostToken: string;
}

export interface ParticipantResponse extends SessionResponse {
  code: string;
  avatarUrl?: string;
}

export interface FlaggedPost extends PadletPost {
  sessionId: string;
  sessionName: string;
  sessionType: PadletSessionType;
  sessionCreatedAt: string;
  prompt?: string;
  flaggedAt: string;
  flaggedBy: string;
}

export interface FlagPostResponse extends SessionResponse {
  flaggedPosts: FlaggedPost[];
}
