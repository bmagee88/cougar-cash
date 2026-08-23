const crypto = require("crypto");
const { Pool } = require("pg");
const { OAuth2Client } = require("google-auth-library");

const SESSION_COOKIE = "paw_pass_session";
const CSRF_COOKIE = "paw_pass_csrf";
const SESSION_TTL_SECONDS = Number(process.env.PAW_PASS_SESSION_TTL_SECONDS || 8 * 60 * 60);

let pool;
const googleClient = new OAuth2Client();

function getConnectionString() {
  return (
    process.env.PAW_PASS_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    ""
  );
}

function getPool() {
  if (pool) return pool;
  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error("Missing PAW_PASS_DATABASE_URL, DATABASE_URL, or POSTGRES_URL.");
  }

  const sslMode = String(process.env.PAW_PASS_PGSSLMODE || process.env.PGSSLMODE || "")
    .toLowerCase()
    .trim();

  pool = new Pool({
    connectionString,
    ssl:
      sslMode === "require" || sslMode === "no-verify"
        ? { rejectUnauthorized: sslMode !== "no-verify" }
        : undefined,
    max: Number(process.env.PAW_PASS_PG_POOL_MAX || 4),
    idleTimeoutMillis: 15_000,
  });

  return pool;
}

function json(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    ...extraHeaders,
  });
  res.end(JSON.stringify(body));
}

function redirect(res, location, cookies = []) {
  const headers = {
    Location: location,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
  if (cookies.length) headers["Set-Cookie"] = cookies;
  res.writeHead(303, headers);
  res.end("");
}

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((acc, part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return acc;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

function readRaw(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function readBody(req) {
  const raw = await readRaw(req);
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (contentType.includes("application/json")) {
    return raw ? JSON.parse(raw) : {};
  }
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  return {};
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function digest(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function secret() {
  const value = process.env.PAW_PASS_IDENTITY_PEPPER || process.env.PAW_PASS_SESSION_SECRET;
  if (!value || value.length < 24) {
    throw new Error("PAW_PASS_IDENTITY_PEPPER or PAW_PASS_SESSION_SECRET must be at least 24 characters.");
  }
  return value;
}

function hmac(purpose, value) {
  return crypto
    .createHmac("sha256", `${purpose}:${secret()}`)
    .update(String(value))
    .digest("hex");
}

function isLocalHost(req) {
  const host = String(req.headers.host || "").toLowerCase();
  return host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]");
}

function secureCookie(req) {
  if (isLocalHost(req)) return "";
  return "; Secure";
}

function sessionCookie(token, req) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secureCookie(req)}`;
}

function csrfCookie(token, req) {
  return `${CSRF_COOKIE}=${encodeURIComponent(token)}; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secureCookie(req)}`;
}

function clearCookie(name) {
  return `${name}=; Path=/; SameSite=Lax; Max-Age=0`;
}

function allowedDomains() {
  return String(process.env.PAW_PASS_ALLOWED_DOMAINS || "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

async function verifyGoogleCredential(credential) {
  const audience = process.env.GOOGLE_CLIENT_ID || process.env.REACT_APP_GOOGLE_CLIENT_ID;
  if (!audience) throw new Error("Missing GOOGLE_CLIENT_ID.");

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience,
  });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload?.email) {
    throw new Error("Google credential did not include staff identity.");
  }
  if (payload.email_verified === false) {
    throw new Error("Google email is not verified.");
  }
  const domain = String(payload.email).split("@")[1]?.toLowerCase() || "";
  const domains = allowedDomains();
  if (domains.length && !domains.includes(domain)) {
    throw new Error("This Google domain is not approved for Paw Pass.");
  }
  return payload;
}

async function findOrCreateStaff(googlePayload) {
  const db = getPool();
  const googleSubHash = hmac("google-sub", googlePayload.sub);
  const emailHash = hmac("staff-email", String(googlePayload.email).toLowerCase());
  const emailDomain = String(googlePayload.email).split("@")[1]?.toLowerCase() || "";

  const existing = await db.query(
    `
      SELECT id, display_name, role, active
      FROM paw_staff_users
      WHERE google_sub_hash = $1 OR email_hash = $2
      ORDER BY google_sub_hash = $1 DESC
      LIMIT 1
    `,
    [googleSubHash, emailHash],
  );

  if (existing.rows[0]) {
    const user = existing.rows[0];
    if (!user.active) throw new Error("This Paw Pass staff account is inactive.");
    await db.query(
      `
        UPDATE paw_staff_users
        SET google_sub_hash = $2,
            email_hash = $3,
            email_domain = $4,
            last_seen_at = now(),
            updated_at = now()
        WHERE id = $1
      `,
      [user.id, googleSubHash, emailHash, emailDomain],
    );
    return user;
  }

  const autoRole = String(process.env.PAW_PASS_AUTO_PROVISION_ROLE || "").trim();
  if (!["teacher", "substitute", "admin", "security", "office", "nurse", "library", "counselor"].includes(autoRole)) {
    throw new Error("Staff account is not approved for Paw Pass.");
  }

  const inserted = await db.query(
    `
      INSERT INTO paw_staff_users (
        google_sub_hash,
        email_hash,
        email_domain,
        display_name,
        role,
        last_seen_at
      )
      VALUES ($1, $2, $3, $4, $5, now())
      RETURNING id, display_name, role, active
    `,
    [
      googleSubHash,
      emailHash,
      emailDomain,
      googlePayload.name || String(googlePayload.email).split("@")[0],
      autoRole,
    ],
  );
  return inserted.rows[0];
}

async function createSession(staffUser, req) {
  const sessionToken = randomToken();
  const csrfToken = randomToken(24);
  await getPool().query(
    `
      INSERT INTO paw_staff_sessions (
        token_hash,
        staff_user_id,
        csrf_token_hash,
        expires_at,
        user_agent_hash,
        ip_hash
      )
      VALUES (
        $1,
        $2,
        $3,
        now() + ($4 || ' seconds')::interval,
        $5,
        $6
      )
    `,
    [
      digest(sessionToken),
      staffUser.id,
      digest(csrfToken),
      SESSION_TTL_SECONDS,
      digest(req.headers["user-agent"] || ""),
      digest(req.socket.remoteAddress || ""),
    ],
  );
  return { sessionToken, csrfToken };
}

async function requireSession(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const sessionToken = cookies[SESSION_COOKIE];
  if (!sessionToken) {
    const error = new Error("Not signed in.");
    error.status = 401;
    throw error;
  }

  const result = await getPool().query(
    `
      SELECT
        s.token_hash,
        s.csrf_token_hash,
        u.id,
        u.display_name,
        u.role,
        u.active
      FROM paw_staff_sessions s
      JOIN paw_staff_users u ON u.id = s.staff_user_id
      WHERE s.token_hash = $1
        AND s.expires_at > now()
    `,
    [digest(sessionToken)],
  );
  const user = result.rows[0];
  if (!user || !user.active) {
    const error = new Error("Session expired.");
    error.status = 401;
    throw error;
  }

  await getPool().query(
    `
      UPDATE paw_staff_sessions
      SET expires_at = now() + ($2 || ' seconds')::interval,
          last_seen_at = now()
      WHERE token_hash = $1
    `,
    [digest(sessionToken), SESSION_TTL_SECONDS],
  );

  return {
    id: user.id,
    displayName: user.display_name,
    role: user.role,
  };
}

async function handleGoogleAuth(req, res) {
  const body = await readBody(req);
  const cookies = parseCookies(req.headers.cookie || "");
  if (!body.credential) {
    json(res, 400, { error: "Missing Google credential." });
    return;
  }
  if (
    body.g_csrf_token &&
    cookies.g_csrf_token &&
    body.g_csrf_token !== cookies.g_csrf_token
  ) {
    json(res, 400, { error: "Google sign-in CSRF check failed." });
    return;
  }

  const payload = await verifyGoogleCredential(body.credential);
  const staff = await findOrCreateStaff(payload);
  const { sessionToken, csrfToken } = await createSession(staff, req);
  redirect(res, process.env.PAW_PASS_AUTH_REDIRECT || "/paw-pass", [
    sessionCookie(sessionToken, req),
    csrfCookie(csrfToken, req),
  ]);
}

async function handleBootstrap(req, res) {
  const user = await requireSession(req);
  const db = getPool();
  const [
    schedules,
    periods,
    teachers,
    groups,
    groupMembers,
    settings,
  ] = await Promise.all([
    db.query("SELECT id, name, active FROM paw_schedule_templates WHERE active = true ORDER BY name"),
    db.query(
      "SELECT id, schedule_template_id, period_key, label, starts_at, ends_at, position FROM paw_schedule_periods WHERE active = true ORDER BY schedule_template_id, position",
    ),
    db.query("SELECT id, display_name, role FROM paw_staff_users WHERE role = 'teacher' AND active = true ORDER BY display_name"),
    db.query("SELECT id, name, normal_capacity FROM paw_groups WHERE active = true ORDER BY name"),
    db.query("SELECT group_id, teacher_user_id FROM paw_group_members WHERE active = true"),
    db.query("SELECT key, value FROM paw_settings"),
  ]);

  json(res, 200, {
    user,
    schedules: schedules.rows.map((schedule) => ({
      ...schedule,
      periods: periods.rows.filter((period) => period.schedule_template_id === schedule.id),
    })),
    teachers: teachers.rows,
    groups: groups.rows.map((group) => ({
      ...group,
      teacherIds: groupMembers.rows
        .filter((member) => member.group_id === group.id)
        .map((member) => member.teacher_user_id),
    })),
    settings: Object.fromEntries(settings.rows.map((row) => [row.key, row.value])),
  });
}

async function handlePawPassRequest(req, res, url, parts) {
  if (req.method === "GET" && parts[2] === "health") {
    json(res, 200, {
      ok: true,
      service: "paw-pass",
      databaseConfigured: Boolean(getConnectionString()),
      googleConfigured: Boolean(process.env.GOOGLE_CLIENT_ID || process.env.REACT_APP_GOOGLE_CLIENT_ID),
    });
    return;
  }

  if (req.method === "POST" && parts[2] === "auth" && parts[3] === "google") {
    await handleGoogleAuth(req, res);
    return;
  }

  if (req.method === "POST" && parts[2] === "logout") {
    redirect(res, "/paw-pass", [clearCookie(SESSION_COOKIE), clearCookie(CSRF_COOKIE)]);
    return;
  }

  if (req.method === "GET" && parts[2] === "bootstrap") {
    await handleBootstrap(req, res);
    return;
  }

  json(res, 404, { error: "Paw Pass endpoint not found.", path: url.pathname });
}

async function closePawPassPool() {
  if (!pool) return;
  await pool.end();
  pool = null;
}

module.exports = {
  closePawPassPool,
  handlePawPassRequest,
};
