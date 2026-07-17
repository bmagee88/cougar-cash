const { OAuth2Client } = require("google-auth-library");
const {
  clearCsrfCookie,
  clearSessionCookie,
  digest,
  getPool,
  hmac,
  json,
  makeAnonId,
  makeAnonPrefix,
  makeCsrfCookie,
  makeSessionCookie,
  parseBody,
  parseCookies,
  randomToken,
  redirect,
  SESSION_TTL_SECONDS,
} = require("./c-quiz-2-shared");

const client = new OAuth2Client();

const getRedirectTarget = () =>
  process.env.CQUIZ2_AUTH_REDIRECT || "/c-quiz-2";

const verifyGoogleCredential = async (credential) => {
  const audience = process.env.GOOGLE_CLIENT_ID || process.env.REACT_APP_GOOGLE_CLIENT_ID;
  if (!audience) {
    throw new Error("Missing GOOGLE_CLIENT_ID.");
  }

  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience,
  });
  const payload = ticket.getPayload();

  if (!payload?.sub) {
    throw new Error("Google credential did not include a stable subject.");
  }

  if (payload.email_verified === false) {
    throw new Error("Google email is not verified.");
  }

  return payload;
};

const findOrCreateUser = async (googlePayload) => {
  const pool = getPool();
  const googleSubHash = hmac("google-sub", googlePayload.sub);
  const existing = await pool.query(
    `
      SELECT id, anon_id, role
      FROM cquiz2_users
      WHERE google_sub_hash = $1
    `,
    [googleSubHash],
  );

  if (existing.rows[0]) return existing.rows[0];

  const prefix = makeAnonPrefix(googlePayload);

  for (let offset = 0; offset < 1000; offset += 1) {
    const anonId = makeAnonId(prefix, googlePayload.sub, offset);
    try {
      const inserted = await pool.query(
        `
          INSERT INTO cquiz2_users (google_sub_hash, anon_id)
          VALUES ($1, $2)
          RETURNING id, anon_id, role
        `,
        [googleSubHash, anonId],
      );
      return inserted.rows[0];
    } catch (err) {
      if (err.code !== "23505") throw err;

      const raced = await pool.query(
        `
          SELECT id, anon_id, role
          FROM cquiz2_users
          WHERE google_sub_hash = $1
        `,
        [googleSubHash],
      );
      if (raced.rows[0]) return raced.rows[0];
    }
  }

  throw new Error("Could not create a unique anonymous id.");
};

const createSession = async (user, event) => {
  const sessionToken = randomToken();
  const csrfToken = randomToken(24);
  const tokenHash = digest(sessionToken);
  const csrfHash = digest(csrfToken);
  const userAgentHash = digest(event.headers["user-agent"] || "");
  const ipHash = digest(
    event.headers["x-nf-client-connection-ip"] ||
      event.headers["client-ip"] ||
      event.headers["x-forwarded-for"] ||
      "",
  );

  await getPool().query(
    `
      INSERT INTO cquiz2_sessions (
        token_hash,
        user_id,
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
    [tokenHash, user.id, csrfHash, SESSION_TTL_SECONDS, userAgentHash, ipHash],
  );

  await getPool().query(
    `
      UPDATE cquiz2_users
      SET last_seen_at = now()
      WHERE id = $1
    `,
    [user.id],
  );

  return { sessionToken, csrfToken };
};

const isLocalDebug = (event) => {
  const host = event.headers.host || event.headers.Host || "";
  return (
    host.includes("localhost") ||
    process.env.NETLIFY_DEV === "true" ||
    process.env.CQUIZ2_DEBUG_AUTH === "true"
  );
};

const classifyAuthError = (err) => {
  if (err.code === "ECONNREFUSED") {
    return {
      statusCode: 503,
      error: "Database connection failed.",
      detail:
        "Could not connect to Postgres. Check that Postgres is running and CQUIZ2_DATABASE_URL points to the right host, port, database, user, and password.",
    };
  }

  if (err.code === "42P01") {
    return {
      statusCode: 503,
      error: "Database schema is missing.",
      detail: "Run database/c-quiz-2/schema.sql against the C-Quiz-2 database.",
    };
  }

  if (String(err.message || "").includes("audience")) {
    return {
      statusCode: 401,
      error: "Google client id mismatch.",
      detail:
        "The Google token was not issued for GOOGLE_CLIENT_ID. Make sure REACT_APP_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID use the same OAuth Client ID.",
    };
  }

  if (String(err.message || "").includes("Missing GOOGLE_CLIENT_ID")) {
    return {
      statusCode: 500,
      error: "Missing GOOGLE_CLIENT_ID.",
      detail: "Set GOOGLE_CLIENT_ID in Netlify and in .env.local for local dev.",
    };
  }

  return {
    statusCode: 401,
    error: "Google sign-in failed.",
    detail: err.message || "Unknown sign-in error.",
  };
};

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Google sign-in must POST to this endpoint." });
  }

  try {
    const body = parseBody(event);
    const cookies = parseCookies(event.headers.cookie || event.headers.Cookie || "");

    if (!body.credential) {
      return json(400, { error: "Missing Google credential." });
    }

    if (
      !body.g_csrf_token ||
      !cookies.g_csrf_token ||
      body.g_csrf_token !== cookies.g_csrf_token
    ) {
      return json(400, { error: "Google sign-in CSRF check failed." }, {
        "Set-Cookie": [clearSessionCookie(), clearCsrfCookie()],
      });
    }

    const googlePayload = await verifyGoogleCredential(body.credential);
    const user = await findOrCreateUser(googlePayload);
    const { sessionToken, csrfToken } = await createSession(user, event);

    return redirect(getRedirectTarget(), [
      makeSessionCookie(sessionToken),
      makeCsrfCookie(csrfToken),
    ]);
  } catch (err) {
    console.error("C-Quiz-2 auth failed", err);
    const classified = classifyAuthError(err);
    return json(
      classified.statusCode,
      {
        error: classified.error,
        ...(isLocalDebug(event) ? { detail: classified.detail } : {}),
      },
      {
        "Set-Cookie": [clearSessionCookie(), clearCsrfCookie()],
      },
    );
  }
};
