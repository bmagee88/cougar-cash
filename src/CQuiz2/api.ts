const API_URL = "/.netlify/functions/c-quiz-2-api";
const CSRF_COOKIE = "cquiz2_csrf";

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(status: number, message: string, details: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

const readCookie = (name: string) => {
  if (typeof document === "undefined") return "";
  const prefix = `${name}=`;
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length) ?? "";
};

const csrfToken = () => decodeURIComponent(readCookie(CSRF_COOKIE));

const request = async <T>(action: string, init: RequestInit = {}): Promise<T> => {
  const method = init.method || "GET";
  const headers = new Headers(init.headers);

  if (method !== "GET") {
    headers.set("Content-Type", "application/json");
    const token = csrfToken();
    if (token) headers.set("X-CQuiz2-CSRF", token);
  }

  const response = await fetch(`${API_URL}?action=${encodeURIComponent(action)}`, {
    ...init,
    method,
    headers,
    credentials: "include",
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      response.status,
      typeof payload?.error === "string" ? payload.error : "Request failed.",
      payload,
    );
  }

  return payload as T;
};

export const apiGet = <T>(action: string) => request<T>(action);

export const apiPost = <T>(action: string, body: unknown = {}) =>
  request<T>(action, {
    method: "POST",
    body: JSON.stringify(body),
  });
