import {
  CreateTypingBossSessionResponse,
  TypingBossActionResponse,
  TypingBossChallengeResponse,
  TypingBossClassId,
  TypingBossCredentials,
  TypingBossId,
  TypingBossMode,
  TypingBossWordResult,
  TypingBossParticipantResponse,
  TypingBossSessionResponse,
} from "./types";

const API_BASE = (
  process.env.REACT_APP_TYPING_BOSS_API_URL ||
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

function describeNetworkFailure(path: string) {
  const target = withBase(path);

  if (!API_BASE && !isLocalFrontend) {
    return "The Typing Boss backend URL is missing. In Netlify, set REACT_APP_TYPING_BOSS_API_URL to your Render backend URL and redeploy.";
  }

  if (
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    target.startsWith("http://")
  ) {
    return `The Typing Boss backend URL must use https, not http. Current URL: ${target}`;
  }

  return `Could not reach the Typing Boss backend at ${target}. Check that npm run start:backend is running locally or that the deployed classroom backend is awake.`;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";

  if (text.trim().startsWith("<!DOCTYPE") || !contentType.includes("json")) {
    throw new Error(
      isLocalFrontend
        ? "The Typing Boss backend did not return JSON. Make sure npm run start:backend is running on port 4000."
        : "The Typing Boss backend is not configured for this deployed site. Set REACT_APP_TYPING_BOSS_API_URL in Netlify and redeploy."
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

function credentialsBody(credentials: TypingBossCredentials) {
  return credentials.hostToken
    ? { hostToken: credentials.hostToken }
    : { code: credentials.code };
}

export function getTypingBossEventSourceUrl(
  sessionId: string,
  credentials: TypingBossCredentials
) {
  return withQuery(`/api/typing-boss/sessions/${sessionId}/events`, {
    hostToken: credentials.hostToken,
    code: credentials.code,
  });
}

export async function createTypingBossSession(name: string, bossId: TypingBossId, mode: TypingBossMode = "proportional") {
  const response = await apiFetch<CreateTypingBossSessionResponse>("/api/typing-boss/sessions", {
    method: "POST",
    json: { name, bossId, mode, ...(mode === "proportional" ? { goldWords: true } : {}) },
  });
  if ((response.session?.mode ?? "old") !== mode) {
    throw new Error("The Typing Boss backend returned a different battle mode. Update the backend to match this version of the game, then try again.");
  }
  return response;
}

export function submitTypingBossWords(sessionId: string, credentials: TypingBossCredentials, words: TypingBossWordResult[]) {
  return apiFetch<{ nextWord: number }>(`/api/typing-boss/sessions/${sessionId}/words`, {
    method: "POST", json: { ...credentialsBody(credentials), words },
  });
}

export function submitTypingBossProgress(sessionId: string, credentials: TypingBossCredentials, wordIndex: number, characters: number) {
  return apiFetch<{ ok: boolean }>(`/api/typing-boss/sessions/${sessionId}/progress`, {
    method: "POST", json: { ...credentialsBody(credentials), wordIndex, characters },
  });
}

export function getTypingBossSession(
  sessionId: string,
  credentials: TypingBossCredentials
) {
  const query = new URLSearchParams();
  if (credentials.hostToken) query.set("hostToken", credentials.hostToken);
  if (credentials.code) query.set("code", credentials.code);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiFetch<TypingBossSessionResponse>(
    `/api/typing-boss/sessions/${sessionId}${suffix}`
  );
}

export function createTypingBossParticipant(
  sessionId: string,
  name: string,
  classId: TypingBossClassId
) {
  return apiFetch<TypingBossParticipantResponse>(
    `/api/typing-boss/sessions/${sessionId}/participants`,
    {
      method: "POST",
      json: { name, classId, goldWords: true },
    }
  );
}

export function verifyTypingBossParticipant(sessionId: string, code: string) {
  return apiFetch<TypingBossParticipantResponse>(
    `/api/typing-boss/sessions/${sessionId}/verify`,
    {
      method: "POST",
      json: { code },
    }
  );
}

export async function startTypingBossSession(sessionId: string, hostToken: string, hpMultiplier = 1, gradeLevels?: number[], sentiments?: string[], balanced = false) {
  const response = await apiFetch<TypingBossSessionResponse>(
    `/api/typing-boss/sessions/${sessionId}/start`,
    {
      method: "POST",
      json: { hostToken, hpMultiplier, gradeLevels, sentiments, balanced },
    }
  );
  if (Boolean(response.session.balanced) !== balanced) {
    throw new Error("The backend did not apply Balanced mode. Deploy the matching Typing Boss backend and create a fresh room.");
  }
  return response;
}

export function closeTypingBossSession(sessionId: string, hostToken: string) {
  return apiFetch<TypingBossSessionResponse>(
    `/api/typing-boss/sessions/${sessionId}/close`,
    {
      method: "POST",
      json: { hostToken },
    }
  );
}

export function createTypingBossChallenge(
  sessionId: string,
  code: string,
  moveId: string,
  targetCode?: string
) {
  return apiFetch<TypingBossChallengeResponse>(
    `/api/typing-boss/sessions/${sessionId}/challenge`,
    {
      method: "POST",
      json: { code, moveId, targetCode },
    }
  );
}

export function submitTypingBossAction(
  sessionId: string,
  code: string,
  payload: {
    challengeId: string;
    answerText: string;
    durationMs: number;
    acceptedCharacters: number;
    mistakes: number;
  }
) {
  return apiFetch<TypingBossActionResponse>(
    `/api/typing-boss/sessions/${sessionId}/actions`,
    {
      method: "POST",
      json: {
        ...credentialsBody({ code }),
        ...payload,
      },
    }
  );
}
