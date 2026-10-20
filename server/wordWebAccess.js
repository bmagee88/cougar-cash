const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { OAuth2Client } = require("google-auth-library");
const allowedEmails = require("./wordWebAccessPolicy");

const COOKIE = "word_web_challenge";
const MAX_BODY = 24 * 1024;
const CHALLENGE_TTL = 10 * 60 * 1000;
const google = new OAuth2Client();
const localSecret = crypto.randomBytes(32).toString("hex");
const localOrigins = [3001, 4000, 8888].flatMap(port => [
  `http://localhost:${port}`, `http://127.0.0.1:${port}`,
]);
const failure = "Access denied. Check your password and use an approved Google account matching your email.";

async function configuration() {
  const production = process.env.NETLIFY === "true" || process.env.NODE_ENV === "production" || Boolean(process.env.LAMBDA_TASK_ROOT);
  let local = {};
  if (!production) {
    try { local = require("dotenv").parse(await fs.readFile(path.join(__dirname, "../.env.local"))); }
    catch { /* Deployment configuration comes from the server environment. */ }
  }
  const env = { ...local, ...process.env };
  const origins = new Set((env.WORD_WEB_ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean));
  for (const value of [env.URL, env.DEPLOY_URL, env.DEPLOY_PRIME_URL]) {
    if (value) { try { origins.add(new URL(value).origin); } catch { /* Invalid origins never grant access. */ } }
  }
  if (!production) localOrigins.forEach(origin => origins.add(origin));
  return {
    clientId: env.WORD_WEB_GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID || env.REACT_APP_GOOGLE_CLIENT_ID,
    secret: env.WORD_WEB_CHALLENGE_SECRET || env.CQUIZ2_SESSION_SECRET || (!production ? localSecret : ""),
    origins,
  };
}

function digest(value) { return crypto.createHash("sha256").update(value).digest(); }
function verifyPassword(value) {
  return typeof value === "string" && value.length <= 200 &&
    crypto.timingSafeEqual(digest(value), digest("flabbergast42"));
}
function signature(value, secret) {
  return crypto.createHmac("sha256", secret).update(`word-web-challenge-v1:${value}`).digest("base64url");
}
function challengeCookie(value, secure, clear = false) {
  return `${COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/api/word-web; Max-Age=${clear ? 0 : CHALLENGE_TTL / 1000}${secure ? "; Secure" : ""}`;
}
function readChallenge(cookie, secret, now) {
  const token = String(cookie || "").split(";").map(item => item.trim()).find(item => item.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!token || token.length > 1000) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const expected = Buffer.from(signature(parts[0], secret));
  const supplied = Buffer.from(parts[1]);
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    return typeof parsed.nonce === "string" && parsed.nonce.length === 43 &&
      Number.isFinite(parsed.expires) && parsed.expires > now && parsed.expires <= now + CHALLENGE_TTL ? parsed : null;
  } catch { return null; }
}
async function privateBundle() {
  // included_files are packaged relative to the Netlify function's task root.
  const directory = process.env.NETLIFY === "true" || process.env.LAMBDA_TASK_ROOT
    ? path.join(process.env.LAMBDA_TASK_ROOT || process.cwd(), ".word-web-private")
    : path.join(__dirname, "../.word-web-private");
  const [script, css] = await Promise.all([
    fs.readFile(path.join(directory, "word-web.js"), "utf8"),
    fs.readFile(path.join(directory, "word-web.css"), "utf8"),
  ]);
  return { script, css };
}
function response(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Netlify-CDN-Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

// Injection points are for Node tests; no HTTP/environment debug or bypass switch exists.
function createWordWebAccess({ getConfiguration = configuration, verifyGoogle, loadBundle = privateBundle, now = Date.now } = {}) {
  const attempts = new Map();
  const verify = verifyGoogle || (async (credential, clientId) => {
    const ticket = await google.verifyIdToken({ idToken: credential, audience: clientId });
    return ticket.getPayload();
  });
  return async function handle({ method, pathname, headers = {}, body = "", ip = "unknown" }) {
    if (pathname !== "/api/word-web/config" && pathname !== "/api/word-web/unlock") return response(404, { error: "Not found." });
    const isConfig = pathname.endsWith("/config");
    if (method !== (isConfig ? "GET" : "POST")) return response(405, { error: "Method not allowed." }, { Allow: isConfig ? "GET" : "POST" });
    const config = await getConfiguration();
    if (!config.clientId || !config.secret || config.secret.length < 32 || !config.origins.size) {
      return response(503, { error: "Word Web sign-in is not configured. Contact the site owner." });
    }
    if (headers["sec-fetch-site"] === "cross-site") return response(403, { error: "Same-site requests are required." });
    let origin;
    if (headers.origin) {
      try {
        const parsed = new URL(headers.origin);
        // CRA's Windows proxy appends a slash to Origin. Accept that serialization,
        // while refusing paths, credentials, query strings, and opaque origins.
        if (parsed.pathname === "/" && !parsed.search && !parsed.hash && !parsed.username && !parsed.password) origin = parsed.origin;
      } catch { /* Malformed origins never authorize a request. */ }
    }
    if ((!isConfig || headers.origin) && (!origin || !config.origins.has(origin))) return response(403, { error: "This origin is not allowed." });
    const secure = !Array.from(config.origins).some(value => value === origin && value.startsWith("http://")) &&
      !(isConfig && !origin && localOrigins.some(value => { try { return new URL(value).host === headers.host; } catch { return false; } }));
    if (isConfig) {
      const nonce = crypto.randomBytes(32).toString("base64url");
      const encoded = Buffer.from(JSON.stringify({ nonce, expires: now() + CHALLENGE_TTL })).toString("base64url");
      return response(200, { clientId: config.clientId, nonce }, {
        "Set-Cookie": challengeCookie(`${encoded}.${signature(encoded, config.secret)}`, secure),
      });
    }
    // Local backend protection; Netlify also applies a distributed per-IP limit.
    const stamp = now();
    for (const [key, bucket] of attempts) if (bucket.expires <= stamp) attempts.delete(key);
    if (attempts.size >= 4096 && !attempts.has(ip)) return response(429, { error: "Too many attempts. Try again later." }, { "Retry-After": "60" });
    const bucket = attempts.get(ip) || { count: 0, expires: stamp + 10 * 60 * 1000 };
    if (bucket.count >= 10) return response(429, { error: "Too many attempts. Try again later." }, { "Retry-After": String(Math.ceil((bucket.expires - stamp) / 1000)) });
    bucket.count += 1;
    attempts.set(ip, bucket);
    if (!String(headers["content-type"] || "").toLowerCase().startsWith("application/json")) return response(415, { error: "JSON is required." });
    if (Buffer.byteLength(body) > MAX_BODY) return response(413, { error: "Request is too large." });
    let input;
    try { input = JSON.parse(body); } catch { return response(400, { error: "Invalid request." }); }
    if (!input || typeof input !== "object" || Array.isArray(input)) return response(400, { error: "Invalid request." });
    const challenge = readChallenge(headers.cookie, config.secret, stamp);
    const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    if (!challenge || !verifyPassword(input.password) || !allowedEmails.includes(email) ||
        typeof input.credential !== "string" || input.credential.length > 16000) return response(403, { error: failure });
    try {
      // The library checks Google's signature, issuer, audience, and expiration.
      const identity = await verify(input.credential, config.clientId);
      if (!identity?.sub || identity.email_verified !== true || identity.nonce !== challenge.nonce ||
          String(identity.email || "").toLowerCase() !== email || !allowedEmails.includes(String(identity.email || "").toLowerCase())) {
        return response(403, { error: failure });
      }
    } catch { return response(403, { error: failure }); }
    let bundle;
    try { bundle = await loadBundle(); }
    catch { return response(503, { error: "Word Web is temporarily unavailable. Contact the site owner." }); }
    return response(200, bundle, { "Set-Cookie": challengeCookie("", secure, true) });
  };
}

const handleWordWebAccess = createWordWebAccess();
async function handleWordWebRequest(req, res, url) {
  // Never inherit the other classroom APIs' permissive CORS headers.
  for (const header of ["Access-Control-Allow-Origin", "Access-Control-Allow-Methods", "Access-Control-Allow-Headers"]) res.removeHeader(header);
  try {
    let body = "";
    for await (const chunk of req) {
      body += chunk.toString();
      if (Buffer.byteLength(body) > MAX_BODY) {
        const oversized = response(413, { error: "Request is too large." });
        res.writeHead(oversized.statusCode, oversized.headers); res.end(oversized.body); return;
      }
    }
    const result = await handleWordWebAccess({ method: req.method, pathname: url.pathname, headers: req.headers, body, ip: req.socket.remoteAddress });
    res.writeHead(result.statusCode, result.headers); res.end(result.body);
  } catch {
    const result = response(503, { error: "Word Web sign-in is temporarily unavailable." });
    res.writeHead(result.statusCode, result.headers); res.end(result.body);
  }
}
module.exports = { createWordWebAccess, handleWordWebAccess, handleWordWebRequest };
