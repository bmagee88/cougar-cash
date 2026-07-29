import {
  FlaggedPost,
  PadletParticipant,
  PadletSessionSnapshot,
  PadletSessionType,
} from "./types";

const STUDENT_AUDIT_KEY = "padletStudentCheckIds";
const TEACHER_SESSION_AUDIT_KEY = "padletTeacherSessionAudit";
const TEACHER_FLAGGED_POSTS_KEY = "padletTeacherFlaggedPosts";
export const PADLET_AUDIT_UPDATED_EVENT = "padlet-audit-updated";

export interface StudentCheckIdRecord {
  sessionId: string;
  code: string;
  avatarUrl?: string;
  boardName?: string;
  sessionType?: PadletSessionType;
  prompt?: string;
  joinedAt: string;
  lastSeenAt: string;
}

export interface TeacherSessionAuditRecord {
  sessionId: string;
  hostToken?: string;
  boardName: string;
  sessionType: PadletSessionType;
  prompt?: string;
  status: PadletSessionSnapshot["status"];
  createdAt: string;
  expiresAt: string;
  closedAt?: string | null;
  lastSeenAt: string;
  participantCount: number;
  participants: PadletParticipant[];
}

export interface TeacherFlaggedPostRecord extends FlaggedPost {
  storedAt: string;
  studentCode: string;
  studentAvatarUrl?: string;
  noteId?: string;
}

function canUseStorage() {
  try {
    return typeof window !== "undefined" && Boolean(window.localStorage);
  } catch {
    return false;
  }
}

function readList<T>(key: string): T[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeList<T>(key: string, records: T[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(records));
  window.dispatchEvent(new Event(PADLET_AUDIT_UPDATED_EVENT));
}

export function readStudentCheckIds() {
  return readList<StudentCheckIdRecord>(STUDENT_AUDIT_KEY);
}

export function recordStudentCheckId(record: {
  sessionId: string;
  code: string;
  avatarUrl?: string;
  session?: PadletSessionSnapshot;
}) {
  const now = new Date().toISOString();
  const records = readStudentCheckIds();
  const existingIndex = records.findIndex(
    (item) => item.sessionId === record.sessionId && item.code === record.code
  );
  const existing = existingIndex >= 0 ? records[existingIndex] : null;
  const next: StudentCheckIdRecord = {
    sessionId: record.sessionId,
    code: record.code,
    avatarUrl:
      record.avatarUrl ||
      record.session?.participantProfiles.find((profile) => profile.code === record.code)
        ?.avatarUrl ||
      existing?.avatarUrl,
    boardName: record.session?.name || existing?.boardName,
    sessionType: record.session?.type || existing?.sessionType,
    prompt: record.session?.prompt || existing?.prompt,
    joinedAt: existing?.joinedAt || now,
    lastSeenAt: now,
  };

  if (existingIndex >= 0) {
    records[existingIndex] = next;
  } else {
    records.unshift(next);
  }

  writeList(STUDENT_AUDIT_KEY, records.slice(0, 100));
}

export function readTeacherSessionAudits() {
  return readList<TeacherSessionAuditRecord>(TEACHER_SESSION_AUDIT_KEY);
}

function mergeParticipants(
  existing: PadletParticipant[],
  incoming: PadletParticipant[]
) {
  const merged = new Map<string, PadletParticipant>();

  existing.forEach((participant) => {
    merged.set(participant.code, participant);
  });

  incoming.forEach((participant) => {
    const previous = merged.get(participant.code);
    merged.set(participant.code, {
      ...previous,
      ...participant,
      avatarUrl: participant.avatarUrl || previous?.avatarUrl,
      joinedAt: participant.joinedAt || previous?.joinedAt || null,
      lastSeenAt: participant.lastSeenAt || previous?.lastSeenAt || null,
    });
  });

  return Array.from(merged.values());
}

export function recordTeacherSessionAudit(
  session: PadletSessionSnapshot,
  hostToken?: string
) {
  const records = readTeacherSessionAudits();
  const existingIndex = records.findIndex((item) => item.sessionId === session.id);
  const existing = existingIndex >= 0 ? records[existingIndex] : null;
  const participants = mergeParticipants(
    existing?.participants || [],
    session.participants || []
  );
  const next: TeacherSessionAuditRecord = {
    sessionId: session.id,
    hostToken: hostToken || existing?.hostToken,
    boardName: session.name || existing?.boardName || session.id,
    sessionType: session.type,
    prompt: session.prompt,
    status: session.status,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    closedAt: session.closedAt || existing?.closedAt || null,
    lastSeenAt: new Date().toISOString(),
    participantCount: Math.max(
      session.participantCount,
      participants.length,
      existing?.participantCount || 0
    ),
    participants,
  };

  if (existingIndex >= 0) {
    records[existingIndex] = next;
  } else {
    records.unshift(next);
  }

  writeList(TEACHER_SESSION_AUDIT_KEY, records.slice(0, 100));
}

export function markTeacherSessionClosed(sessionId: string) {
  const records = readTeacherSessionAudits();
  const existingIndex = records.findIndex((item) => item.sessionId === sessionId);

  if (existingIndex < 0) return;

  const now = new Date().toISOString();
  records[existingIndex] = {
    ...records[existingIndex],
    status: "closed",
    closedAt: records[existingIndex].closedAt || now,
    lastSeenAt: now,
  };

  writeList(TEACHER_SESSION_AUDIT_KEY, records.slice(0, 100));
}

export function clearClosedTeacherSessions() {
  const records = readTeacherSessionAudits().filter(
    (session) => session.status !== "closed" && session.status !== "expired"
  );
  writeList(TEACHER_SESSION_AUDIT_KEY, records.slice(0, 100));
}

export function readTeacherFlaggedPosts() {
  return readList<TeacherFlaggedPostRecord>(TEACHER_FLAGGED_POSTS_KEY);
}

function isSameFlaggedPost(
  record: TeacherFlaggedPostRecord,
  target: Pick<TeacherFlaggedPostRecord, "sessionId" | "id" | "flaggedAt">
) {
  return (
    record.sessionId === target.sessionId &&
    record.id === target.id &&
    record.flaggedAt === target.flaggedAt
  );
}

export function recordTeacherFlaggedPosts(posts: FlaggedPost[]) {
  if (posts.length === 0) return;

  const existing = readTeacherFlaggedPosts();
  const storedAt = new Date().toISOString();
  const nextPosts = posts.map((post) => ({
    ...post,
    storedAt,
    studentCode: post.authorCode,
    studentAvatarUrl: post.authorAvatarUrl,
    noteId: existing.find((record) => isSameFlaggedPost(record, post))?.noteId,
  }));

  writeList(
    TEACHER_FLAGGED_POSTS_KEY,
    [
      ...nextPosts,
      ...existing.filter(
        (record) => !nextPosts.some((post) => isSameFlaggedPost(record, post))
      ),
    ].slice(0, 250)
  );
}

export function updateTeacherFlaggedPostNote(
  target: Pick<TeacherFlaggedPostRecord, "sessionId" | "id" | "flaggedAt">,
  noteId: string
) {
  const normalizedNoteId = noteId.slice(0, 80);
  const records = readTeacherFlaggedPosts();
  const nextRecords = records.map((record) =>
    isSameFlaggedPost(record, target)
      ? { ...record, noteId: normalizedNoteId || undefined }
      : record
  );

  writeList(TEACHER_FLAGGED_POSTS_KEY, nextRecords);
}

export function removeTeacherFlaggedPost(
  target: Pick<TeacherFlaggedPostRecord, "sessionId" | "id" | "flaggedAt">
) {
  const records = readTeacherFlaggedPosts().filter(
    (record) => !isSameFlaggedPost(record, target)
  );
  writeList(TEACHER_FLAGGED_POSTS_KEY, records);
}

export function clearTeacherFlaggedPosts() {
  writeList(TEACHER_FLAGGED_POSTS_KEY, []);
}
