import {
  CreateSessionRequest,
  CreateSessionResponse,
  FlagPostResponse,
  PadletCredentials,
  PadletSessionSnapshot,
  PadletSessionSummary,
  ParticipantResponse,
  SessionResponse,
} from "./types";

const API_BASE = (
  process.env.REACT_APP_COUGAR_API_URL ||
  process.env.REACT_APP_PADLET_API_URL ||
  ""
).replace(/\/$/, "");
const isLocalFrontend =
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname);

function withBase(path: string) {
  return `${API_BASE}${path}`;
}

function describeNetworkFailure(path: string) {
  const target = withBase(path);

  if (!API_BASE && !isLocalFrontend) {
    return "The classroom backend URL is missing. In Netlify, set REACT_APP_COUGAR_API_URL to your Render backend URL and redeploy.";
  }

  if (
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    target.startsWith("http://")
  ) {
    return `The classroom backend URL must use https, not http. Current URL: ${target}`;
  }

  return `Could not reach the classroom backend at ${target}. Check that the Render service is deployed, awake, and that /api/health works.`;
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
  const contentType = response.headers.get("content-type") || "";

  if (text.trim().startsWith("<!DOCTYPE") || !contentType.includes("json")) {
    throw new Error(
      isLocalFrontend
        ? "The classroom backend did not return JSON. Make sure npm run start:backend is running on port 4000."
        : "The classroom backend is not configured for this deployed site. Deploy the backend to a persistent Node host and set REACT_APP_COUGAR_API_URL in Netlify."
    );
  }

  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const error = new Error(payload.error || "Request failed.") as Error & {
      status?: number;
      payload?: unknown;
    };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload as T;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit & { json?: unknown } = {}
) {
  const { json, headers, ...rest } = options;
  let response: Response;

  try {
    response = await fetch(withBase(path), {
      ...rest,
      headers: {
        ...(json === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      body: json === undefined ? rest.body : JSON.stringify(json),
    });
  } catch {
    throw new Error(describeNetworkFailure(path));
  }

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

export function createSession(config: CreateSessionRequest) {
  return apiFetch<CreateSessionResponse>("/api/sessions", {
    method: "POST",
    json: config,
  });
}

export function listActiveSessions() {
  return apiFetch<{ sessions: PadletSessionSummary[] }>("/api/sessions/active");
}

export function getSession(
  sessionId: string,
  credentials: PadletCredentials
) {
  const query = new URLSearchParams();
  if (credentials.hostToken) query.set("hostToken", credentials.hostToken);
  if (credentials.code) query.set("code", credentials.code);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiFetch<SessionResponse>(`/api/sessions/${sessionId}${suffix}`);
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

export function renameSession(
  sessionId: string,
  hostToken: string,
  name: string
) {
  return apiFetch<SessionResponse>(`/api/sessions/${sessionId}/name`, {
    method: "PATCH",
    json: { hostToken, name },
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
  text: string,
  parentPostId?: string
) {
  return apiFetch<SessionResponse>(`/api/sessions/${sessionId}/posts`, {
    method: "POST",
    json: {
      ...credentialsBody(credentials),
      columnId,
      text,
      parentPostId,
    },
  });
}

export function updateShowMe(
  sessionId: string,
  code: string,
  showMe: boolean
) {
  return apiFetch<SessionResponse>(`/api/sessions/${sessionId}/show-me`, {
    method: "PATCH",
    json: { code, showMe },
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

export function flagPost(
  sessionId: string,
  hostToken: string,
  postId: string
) {
  return apiFetch<FlagPostResponse>(
    `/api/sessions/${sessionId}/posts/${postId}/flag`,
    {
      method: "POST",
      json: { hostToken },
    }
  );
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
