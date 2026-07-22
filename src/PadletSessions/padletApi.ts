import {
  CreateSessionResponse,
  PadletCredentials,
  PadletSessionSnapshot,
  ParticipantResponse,
  SessionResponse,
} from "./types";

const API_BASE = (process.env.REACT_APP_PADLET_API_URL || "").replace(/\/$/, "");

function withBase(path: string) {
  return `${API_BASE}${path}`;
}

function withQuery(path: string, params: Record<string, string | undefined>) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      query.set(key, value);
    }
  });

  const suffix = query.toString();
  return suffix ? `${withBase(path)}?${suffix}` : withBase(path);
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload as T;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit & { json?: unknown } = {}
) {
  const { json, headers, ...rest } = options;
  const response = await fetch(withBase(path), {
    ...rest,
    headers: {
      ...(json === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    body: json === undefined ? rest.body : JSON.stringify(json),
  });

  return parseResponse<T>(response);
}

function credentialsBody(credentials: PadletCredentials) {
  return credentials.hostToken
    ? { hostToken: credentials.hostToken }
    : { code: credentials.code };
}

export function getEventSourceUrl(
  sessionId: string,
  credentials: PadletCredentials
) {
  return withQuery(`/api/sessions/${sessionId}/events`, {
    hostToken: credentials.hostToken,
    code: credentials.code,
  });
}

export function createSession(columnTitles: [string, string]) {
  return apiFetch<CreateSessionResponse>("/api/sessions", {
    method: "POST",
    json: {
      type: "good-not-good",
      columnTitles,
    },
  });
}

export function createParticipant(sessionId: string) {
  return apiFetch<ParticipantResponse>(
    `/api/sessions/${sessionId}/participants`,
    {
      method: "POST",
      json: {},
    }
  );
}

export function verifyParticipant(sessionId: string, code: string) {
  return apiFetch<ParticipantResponse>(`/api/sessions/${sessionId}/verify`, {
    method: "POST",
    json: { code },
  });
}

export function startSession(sessionId: string, hostToken: string) {
  return apiFetch<SessionResponse>(`/api/sessions/${sessionId}/start`, {
    method: "POST",
    json: { hostToken },
  });
}

export function closeSession(sessionId: string, hostToken: string) {
  return apiFetch<SessionResponse>(`/api/sessions/${sessionId}/close`, {
    method: "POST",
    json: { hostToken },
  });
}

export function renameColumns(
  sessionId: string,
  hostToken: string,
  columns: { id: string; title: string }[]
) {
  return apiFetch<SessionResponse>(`/api/sessions/${sessionId}/columns`, {
    method: "PATCH",
    json: { hostToken, columns },
  });
}

export function createPost(
  sessionId: string,
  credentials: PadletCredentials,
  columnId: string,
  text: string
) {
  return apiFetch<SessionResponse>(`/api/sessions/${sessionId}/posts`, {
    method: "POST",
    json: {
      ...credentialsBody(credentials),
      columnId,
      text,
    },
  });
}

export function plusOnePost(
  sessionId: string,
  credentials: PadletCredentials,
  postId: string
) {
  return apiFetch<SessionResponse>(
    `/api/sessions/${sessionId}/posts/${postId}/plus-one`,
    {
      method: "POST",
      json: credentialsBody(credentials),
    }
  );
}

export function copyPost(
  sessionId: string,
  credentials: PadletCredentials,
  postId: string,
  targetColumnId: string
) {
  return apiFetch<SessionResponse>(
    `/api/sessions/${sessionId}/posts/${postId}/copy`,
    {
      method: "POST",
      json: {
        ...credentialsBody(credentials),
        targetColumnId,
      },
    }
  );
}

export function updatePost(
  sessionId: string,
  hostToken: string,
  postId: string,
  text: string
) {
  return apiFetch<SessionResponse>(`/api/sessions/${sessionId}/posts/${postId}`, {
    method: "PATCH",
    json: { hostToken, text },
  });
}

export function deletePost(
  sessionId: string,
  hostToken: string,
  postId: string
) {
  return apiFetch<SessionResponse>(`/api/sessions/${sessionId}/posts/${postId}`, {
    method: "DELETE",
    json: { hostToken },
  });
}

export async function downloadSessionCsv(
  session: PadletSessionSnapshot,
  hostToken: string
) {
  const response = await fetch(
    withQuery(`/api/sessions/${session.id}/export.csv`, { hostToken })
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "CSV download failed.");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${session.id}-responses.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
