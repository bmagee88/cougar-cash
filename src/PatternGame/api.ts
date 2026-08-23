import {
  CreatePatternSessionResponse,
  PatternCredentials,
  PatternParticipantResponse,
  PatternSessionResponse,
} from "./types";

const API_BASE = (
  process.env.REACT_APP_COUGAR_API_URL ||
  process.env.REACT_APP_PATTERN_API_URL ||
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
    if (value) query.set(key, value);
  });
  const suffix = query.toString();
  return suffix ? `${withBase(path)}?${suffix}` : withBase(path);
}

function describeNetworkFailure(path: string) {
  const target = withBase(path);

  if (!API_BASE && !isLocalFrontend) {
    return "The Pattern backend URL is missing. In Netlify, set REACT_APP_COUGAR_API_URL to your backend URL and redeploy.";
  }

  if (
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    target.startsWith("http://")
  ) {
    return `The Pattern backend URL must use https, not http. Current URL: ${target}`;
  }

  return `Could not reach The Pattern backend at ${target}. Check that npm run start:backend is running locally or the deployed backend is awake.`;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";

  if (text.trim().startsWith("<!DOCTYPE") || !contentType.includes("json")) {
    throw new Error(
      isLocalFrontend
        ? "The Pattern backend did not return JSON. Make sure npm run start:backend is running on port 4000."
        : "The Pattern backend is not configured for this deployed site. Set REACT_APP_COUGAR_API_URL and redeploy."
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

function credentialsBody(credentials: PatternCredentials) {
  return credentials.hostToken
    ? { hostToken: credentials.hostToken }
    : { code: credentials.code };
}

export function getPatternEventSourceUrl(
  sessionId: string,
  credentials: PatternCredentials
) {
  return withQuery(`/api/pattern/sessions/${sessionId}/events`, {
    hostToken: credentials.hostToken,
    code: credentials.code,
  });
}

export function createPatternSession(config: {
  name: string;
  lakeWidth: number;
  seed?: string;
}) {
  return apiFetch<CreatePatternSessionResponse>("/api/pattern/sessions", {
    method: "POST",
    json: config,
  });
}

export function getPatternSession(
  sessionId: string,
  credentials: PatternCredentials
) {
  const query = new URLSearchParams();
  if (credentials.hostToken) query.set("hostToken", credentials.hostToken);
  if (credentials.code) query.set("code", credentials.code);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiFetch<PatternSessionResponse>(
    `/api/pattern/sessions/${sessionId}${suffix}`
  );
}

export function createPatternParticipant(sessionId: string, name: string) {
  return apiFetch<PatternParticipantResponse>(
    `/api/pattern/sessions/${sessionId}/participants`,
    {
      method: "POST",
      json: { name },
    }
  );
}

export function verifyPatternParticipant(sessionId: string, code: string) {
  return apiFetch<PatternParticipantResponse>(
    `/api/pattern/sessions/${sessionId}/verify`,
    {
      method: "POST",
      json: { code },
    }
  );
}

export function startPatternSession(sessionId: string, hostToken: string) {
  return apiFetch<PatternSessionResponse>(
    `/api/pattern/sessions/${sessionId}/start`,
    {
      method: "POST",
      json: { hostToken },
    }
  );
}

export function closePatternSession(sessionId: string, hostToken: string) {
  return apiFetch<PatternSessionResponse>(
    `/api/pattern/sessions/${sessionId}/close`,
    {
      method: "POST",
      json: { hostToken },
    }
  );
}

export function submitPatternCommand(
  sessionId: string,
  credentials: PatternCredentials,
  command: Record<string, unknown>
) {
  return apiFetch<PatternSessionResponse>(
    `/api/pattern/sessions/${sessionId}/commands`,
    {
      method: "POST",
      json: {
        ...credentialsBody(credentials),
        ...command,
      },
    }
  );
}
