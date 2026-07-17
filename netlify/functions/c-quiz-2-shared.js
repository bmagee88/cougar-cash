const crypto = require("crypto");
const { Pool } = require("pg");

const SESSION_COOKIE = "cquiz2_session";
const CSRF_COOKIE = "cquiz2_csrf";
const SESSION_TTL_SECONDS = 20 * 60;
const ROUND_TTL_SECONDS = 2 * 60 * 60;
const QUESTION_WINDOW_SIZE = 5;
const DEFAULT_TIME_ZONE = "America/New_York";

let pool;

const getPool = () => {
  if (pool) return pool;

  const connectionString =
    process.env.CQUIZ2_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL;

  if (!connectionString) {
    throw new Error(
      "Missing CQUIZ2_DATABASE_URL, DATABASE_URL, or POSTGRES_URL.",
    );
  }

  const sslMode = (process.env.PGSSLMODE || process.env.CQUIZ2_PGSSLMODE || "")
    .toLowerCase()
    .trim();

  pool = new Pool({
    connectionString,
    ssl:
      sslMode === "require" || sslMode === "no-verify"
        ? { rejectUnauthorized: sslMode !== "no-verify" }
        : undefined,
    max: Number(process.env.CQUIZ2_PG_POOL_MAX || 4),
    idleTimeoutMillis: 15_000,
  });

  return pool;
};

const json = (statusCode, body, extraHeaders = {}) => {
  const { "Set-Cookie": setCookie, ...headers } = extraHeaders;
  const response = {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      ...headers,
    },
    body: JSON.stringify(body),
  };

  if (setCookie) {
    response.multiValueHeaders = {
      "Set-Cookie": Array.isArray(setCookie) ? setCookie : [setCookie],
    };
  }

  return response;
};

const redirect = (location, cookies = []) => {
  const response = {
    statusCode: 303,
    headers: {
      Location: location,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
    body: "",
  };

  if (cookies.length) {
    response.multiValueHeaders = { "Set-Cookie": cookies };
  }

  return response;
};

const parseCookies = (cookieHeader = "") =>
  cookieHeader.split(";").reduce((acc, part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return acc;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) acc[key] = decodeURIComponent(value);
    return acc;
  }, {});

const parseBody = (event) => {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  const contentType = (event.headers["content-type"] || "").toLowerCase();

  if (contentType.includes("application/json")) {
    return raw ? JSON.parse(raw) : {};
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw));
  }

  return {};
};

const randomToken = (bytes = 32) =>
  crypto.randomBytes(bytes).toString("base64url");

const digest = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");

const hmac = (purpose, value) => {
  const secret =
    process.env.CQUIZ2_IDENTITY_PEPPER || process.env.CQUIZ2_SESSION_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error(
      "CQUIZ2_IDENTITY_PEPPER or CQUIZ2_SESSION_SECRET must be at least 24 characters.",
    );
  }
  return crypto
    .createHmac("sha256", `${purpose}:${secret}`)
    .update(String(value))
    .digest("hex");
};

const normalizeNamePart = (value, fallback) => {
  const cleaned = String(value || "")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/_/g, "")
    .trim()
    .toLowerCase();
  return cleaned || fallback;
};

const makeAnonPrefix = (googlePayload) => {
  const emailLocal = String(googlePayload.email || "").split("@")[0] || "user";
  const nameParts = String(googlePayload.name || "").trim().split(/\s+/);
  const given = normalizeNamePart(
    googlePayload.given_name || nameParts[0] || emailLocal[0],
    "u",
  );
  const family = normalizeNamePart(
    googlePayload.family_name ||
      nameParts[nameParts.length - 1] ||
      emailLocal.slice(1),
    "usr",
  );

  const first = (given[0] || "u").slice(0, 1);
  const last3 = `${family}xxx`.slice(0, 3);
  return `${first}${last3}`;
};

const makeAnonId = (prefix, googleSub, offset = 0) => {
  const hash = hmac("anon-id", `${googleSub}:${offset}`);
  const numeric = (parseInt(hash.slice(0, 8), 16) + offset) % 1000;
  return `${prefix}-${String(numeric).padStart(3, "0")}`;
};

const isLocalRequest = (event) => {
  const host = String(event?.headers?.host || event?.headers?.Host || "")
    .toLowerCase()
    .trim();
  return (
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("[::1]")
  );
};

const requestLooksSecure = (event) => {
  const proto = String(
    event?.headers?.["x-forwarded-proto"] ||
      event?.headers?.["X-Forwarded-Proto"] ||
      "",
  )
    .toLowerCase()
    .trim();
  if (proto) return proto === "https";
  return !isLocalRequest(event);
};

const cookieOptions = (event) => {
  const sameSite = process.env.CQUIZ2_COOKIE_SAMESITE || "Lax";
  const secure = shouldUseSecureCookies(event) ? "; Secure" : "";
  return `HttpOnly; Path=/; SameSite=${sameSite}; Max-Age=${SESSION_TTL_SECONDS}${secure}`;
};

const shouldUseSecureCookies = (event) => {
  if (isLocalRequest(event)) return false;
  if (process.env.CQUIZ2_COOKIE_SECURE) {
    return process.env.CQUIZ2_COOKIE_SECURE !== "false";
  }

  if (!requestLooksSecure(event)) return false;

  return (
    process.env.CONTEXT === "production" ||
    (process.env.URL || "").startsWith("https://")
  );
};

const makeSessionCookie = (sessionToken, event) =>
  `${SESSION_COOKIE}=${encodeURIComponent(sessionToken)}; ${cookieOptions(event)}`;

const makeCsrfCookie = (csrfToken, event) => {
  const sameSite = process.env.CQUIZ2_COOKIE_SAMESITE || "Lax";
  const secure = shouldUseSecureCookies(event) ? "; Secure" : "";
  return `${CSRF_COOKIE}=${encodeURIComponent(csrfToken)}; Path=/; SameSite=${sameSite}; Max-Age=${SESSION_TTL_SECONDS}${secure}`;
};

const clearSessionCookie = () =>
  `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;

const clearCsrfCookie = () =>
  `${CSRF_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`;

const getSessionToken = (event) => {
  const cookies = parseCookies(event.headers.cookie || event.headers.Cookie || "");
  return cookies[SESSION_COOKIE] || "";
};

const getAllowedOrigins = () =>
  (process.env.CQUIZ2_ALLOWED_ORIGINS || process.env.URL || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const corsHeaders = (event) => {
  const origin = event.headers.origin || event.headers.Origin || "";
  const allowed = getAllowedOrigins();
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, X-CQuiz2-CSRF",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  };
};

const assertSameOriginWrite = (event) => {
  if (event.httpMethod === "GET" || event.httpMethod === "OPTIONS") return;
  const origin = event.headers.origin || event.headers.Origin || "";
  if (!origin) return;
  const allowed = getAllowedOrigins();
  const host = event.headers.host || event.headers.Host || "";
  const sameHost = host && origin.endsWith(`://${host}`);
  if (!sameHost && !allowed.includes(origin)) {
    const err = new Error("Request origin is not allowed.");
    err.statusCode = 403;
    throw err;
  }
};

const requireSession = async (event, { requireCsrf = false } = {}) => {
  const sessionToken = getSessionToken(event);
  if (!sessionToken) {
    const err = new Error("Not signed in.");
    err.statusCode = 401;
    throw err;
  }

  const tokenHash = digest(sessionToken);
  const result = await getPool().query(
    `
      SELECT
        s.token_hash,
        s.csrf_token_hash,
        s.expires_at,
        u.id AS user_id,
        u.anon_id,
        u.role
      FROM cquiz2_sessions s
      JOIN cquiz2_users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.expires_at > now()
    `,
    [tokenHash],
  );

  const row = result.rows[0];
  if (!row) {
    const err = new Error("Session expired.");
    err.statusCode = 401;
    throw err;
  }

  if (requireCsrf) {
    const csrf = event.headers["x-cquiz2-csrf"] || event.headers["X-CQuiz2-CSRF"];
    if (!csrf || digest(csrf) !== row.csrf_token_hash) {
      const err = new Error("Security token mismatch.");
      err.statusCode = 403;
      throw err;
    }
  }

  await getPool().query(
    `
      UPDATE cquiz2_sessions
      SET expires_at = now() + ($2 || ' seconds')::interval,
          last_seen_at = now()
      WHERE token_hash = $1
    `,
    [tokenHash, SESSION_TTL_SECONDS],
  );

  return {
    tokenHash,
    csrfTokenHash: row.csrf_token_hash,
    user: {
      id: row.user_id,
      anonId: row.anon_id,
      role: row.role,
    },
  };
};

const getTodayKey = () => {
  const timeZone = process.env.CQUIZ2_TIME_ZONE || DEFAULT_TIME_ZONE;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
};

const dateKeyToDate = (key) => {
  const [year, month, day] = key.split("-").map((n) => Number.parseInt(n, 10));
  return new Date(year, month - 1, day, 12, 0, 0, 0);
};

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDaysKey = (key, days) => {
  const date = dateKeyToDate(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
};

const daysBetweenKeys = (fromKey, toKey) =>
  Math.round((dateKeyToDate(toKey) - dateKeyToDate(fromKey)) / 86_400_000);

const nextIntervalDays = (greenAfterWin) => Math.max(1, greenAfterWin);

const computeStreakStatus = (attempts, today = getTodayKey()) => {
  const byDate = {};
  for (const attempt of attempts) {
    const date = attempt.attempt_date || attempt.date;
    if (!date) continue;
    if (!byDate[date]) byDate[date] = { attempted: false, got100: false };
    byDate[date].attempted = true;
    if (Number(attempt.score) === 100) byDate[date].got100 = true;
  }

  const hasAnyAttemptsEver = attempts.length > 0;
  if (!hasAnyAttemptsEver) {
    return {
      status: {
        green: 0,
        cap: "grey",
        due: true,
        dueDate: today,
        daysUntilDue: 0,
      },
      hasAnyAttemptsEver,
    };
  }

  const dates = Object.keys(byDate).sort();
  const start = dates[0] || today;
  const yesterday = addDaysKey(today, -1);

  let green = 0;
  let dueDate = start;
  let cursor = start;

  while (cursor <= yesterday) {
    const info = byDate[cursor];
    const isDueThatDay = cursor >= dueDate;

    if (isDueThatDay) {
      if (info?.attempted) {
        if (info.got100) {
          green += 1;
          dueDate = addDaysKey(cursor, nextIntervalDays(green));
        } else {
          dueDate = addDaysKey(cursor, 1);
        }
      } else {
        green = Math.max(0, green - 1);
        dueDate = cursor;
      }
    } else if (info?.attempted && info.got100) {
      green += 1;
      dueDate = addDaysKey(cursor, nextIntervalDays(green));
    }

    cursor = addDaysKey(cursor, 1);
  }

  const dueAtStartToday = today >= dueDate;
  const todayInfo = byDate[today];
  const attemptedToday = !!todayInfo?.attempted;
  const got100Today = !!todayInfo?.got100;
  let cap = null;

  if (dueAtStartToday) {
    if (!attemptedToday) {
      cap = "grey";
    } else if (got100Today) {
      green += 1;
      dueDate = addDaysKey(today, nextIntervalDays(green));
    } else {
      cap = "yellow";
      dueDate = addDaysKey(today, 1);
    }
  } else if (attemptedToday && got100Today) {
    green += 1;
    dueDate = addDaysKey(today, nextIntervalDays(green));
  }

  return {
    status: {
      green,
      cap,
      due: today >= dueDate,
      dueDate,
      daysUntilDue: Math.max(0, daysBetweenKeys(today, dueDate)),
    },
    hasAnyAttemptsEver,
  };
};

const shuffle = (items) => {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const maxAttemptsPerDay = (questionCount) =>
  Math.max(1, Math.ceil(questionCount / QUESTION_WINDOW_SIZE));

module.exports = {
  CSRF_COOKIE,
  QUESTION_WINDOW_SIZE,
  ROUND_TTL_SECONDS,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  addDaysKey,
  clearCsrfCookie,
  clearSessionCookie,
  computeStreakStatus,
  corsHeaders,
  digest,
  getPool,
  getSessionToken,
  getTodayKey,
  hmac,
  json,
  makeAnonId,
  makeAnonPrefix,
  makeCsrfCookie,
  makeSessionCookie,
  maxAttemptsPerDay,
  parseBody,
  parseCookies,
  randomToken,
  redirect,
  requireSession,
  assertSameOriginWrite,
  shuffle,
};
