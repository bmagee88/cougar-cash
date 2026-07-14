const crypto = require("crypto");
const http = require("http");
const { URL } = require("url");

const PORT = Number(process.env.PADLET_PORT || process.env.PORT || 4000);
const ONE_HOUR_MS = 60 * 60 * 1000;
const MAX_POST_LENGTH = 32;
const SOFT_POST_LENGTH = 16;
const DELETE_EXPIRED_AFTER_MS = 30 * 1000;

const sessions = new Map();

function randomHex(length) {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length)
    .toUpperCase();
}

function createSessionId() {
  for (let attempt = 0; attempt < 256; attempt += 1) {
    const id = randomHex(3);
    if (!sessions.has(id)) {
      return id;
    }
  }

  throw new Error("No session ids are available right now.");
}

function createParticipantCode(session) {
  for (let attempt = 0; attempt < 256; attempt += 1) {
    const code = randomHex(4);
    if (!session.participants.has(code)) {
      return code;
    }
  }

  throw new Error("No participant codes are available for this session.");
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, status, payload) {
  setCors(res);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

async function readJson(req) {
  let raw = "";

  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1024 * 1024) {
      throw new Error("Request body is too large.");
    }
  }

  if (!raw.trim()) {
    return {};
  }

  return JSON.parse(raw);
}

function toSafeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSessionId(value) {
  return toSafeString(value).toUpperCase();
}

function normalizeParticipantCode(value) {
  return toSafeString(value).toUpperCase();
}

function normalizeColumnTitle(value, fallback) {
  const title = toSafeString(value).slice(0, MAX_POST_LENGTH);
  return title || fallback;
}

function normalizePostText(value) {
  return toSafeString(value).slice(0, MAX_POST_LENGTH);
}

function isHostToken(session, token) {
  return typeof token === "string" && token.length > 0 && token === session.hostToken;
}

function authenticate(session, url, body = {}) {
  const hostToken = body.hostToken || url.searchParams.get("hostToken");
  if (isHostToken(session, hostToken)) {
    return { role: "host", actorCode: "HOST" };
  }

  const code = normalizeParticipantCode(body.code || url.searchParams.get("code"));
  if (code && session.participants.has(code)) {
    return { role: "participant", actorCode: code };
  }

  return null;
}

function getSnapshot(session) {
  const now = Date.now();

  return {
    id: session.id,
    type: session.type,
    status: session.status,
    createdAt: new Date(session.createdAt).toISOString(),
    expiresAt: new Date(session.expiresAt).toISOString(),
    remainingSeconds: Math.max(0, Math.ceil((session.expiresAt - now) / 1000)),
    columns: session.columns.map((column) => ({ ...column })),
    posts: session.posts.map((post) => ({ ...post, plusOnes: [...post.plusOnes] })),
    participantCount: session.participants.size,
    limits: {
      maxPostLength: MAX_POST_LENGTH,
      softPostLength: SOFT_POST_LENGTH,
    },
  };
}

function broadcastSession(session) {
  const event = `event: session\ndata: ${JSON.stringify(getSnapshot(session))}\n\n`;

  for (const subscriber of [...session.subscribers]) {
    try {
      subscriber.res.write(event);
    } catch (error) {
      clearInterval(subscriber.pingTimer);
      session.subscribers.delete(subscriber);
    }
  }
}

function expireSession(session) {
  if (!sessions.has(session.id) || session.status === "expired") {
    return;
  }

  session.status = "expired";
  session.closedAt = Date.now();
  broadcastSession(session);

  setTimeout(() => {
    for (const subscriber of [...session.subscribers]) {
      clearInterval(subscriber.pingTimer);
      subscriber.res.end();
      session.subscribers.delete(subscriber);
    }
    sessions.delete(session.id);
  }, DELETE_EXPIRED_AFTER_MS).unref?.();
}

function refreshSessionStatus(session) {
  if (Date.now() >= session.expiresAt) {
    expireSession(session);
  }
}

function findSession(id) {
  const session = sessions.get(normalizeSessionId(id));
  if (session) {
    refreshSessionStatus(session);
  }
  return session;
}

function requireHost(res, session, auth) {
  if (!auth || auth.role !== "host") {
    sendError(res, 403, "Host access is required.");
    return false;
  }

  if (session.status === "expired") {
    sendError(res, 410, "This session has expired.");
    return false;
  }

  return true;
}

function requireActiveSession(res, session) {
  if (session.status === "expired") {
    sendError(res, 410, "This session has expired.");
    return false;
  }

  if (session.status === "closed") {
    sendError(res, 409, "This session is closed.");
    return false;
  }

  if (session.status !== "active") {
    sendError(res, 409, "The host has not opened this session yet.");
    return false;
  }

  return true;
}

function findPost(session, postId) {
  return session.posts.find((post) => post.id === postId);
}

function getOtherColumnId(session, columnId) {
  const otherColumn = session.columns.find((column) => column.id !== columnId);
  return otherColumn?.id || columnId;
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function sessionToCsv(session) {
  const header = [
    "session_id",
    "status",
    "column",
    "text",
    "author_code",
    "plus_one_count",
    "plus_one_codes",
    "created_at",
  ];

  const rows = session.posts.map((post) => {
    const column = session.columns.find((item) => item.id === post.columnId);

    return [
      session.id,
      session.status,
      column?.title || post.columnId,
      post.text,
      post.authorCode,
      post.plusOnes.length,
      post.plusOnes.join(" "),
      new Date(post.createdAt).toISOString(),
    ];
  });

  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function createSession(body) {
  const id = createSessionId();
  const now = Date.now();
  const session = {
    id,
    hostToken: randomHex(32),
    type: body.type === "good-not-good" ? body.type : "good-not-good",
    status: "setup",
    createdAt: now,
    expiresAt: now + ONE_HOUR_MS,
    closedAt: null,
    columns: [
      {
        id: "good-at",
        title: normalizeColumnTitle(body.columnTitles?.[0], "Good At"),
      },
      {
        id: "not-good-at",
        title: normalizeColumnTitle(body.columnTitles?.[1], "Not Good At"),
      },
    ],
    posts: [],
    participants: new Set(),
    subscribers: new Set(),
  };

  session.expireTimer = setTimeout(() => expireSession(session), ONE_HOUR_MS);
  session.expireTimer.unref?.();
  sessions.set(id, session);
  return session;
}

async function handleCreateSession(req, res) {
  const body = await readJson(req);
  const session = createSession(body);

  sendJson(res, 201, {
    session: getSnapshot(session),
    sessionId: session.id,
    hostToken: session.hostToken,
  });
}

function handleEvents(req, res, session, url) {
  const auth = authenticate(session, url);
  if (!auth) {
    sendError(res, 401, "A valid host token or participant code is required.");
    return;
  }

  setCors(res);
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  res.write(`event: session\ndata: ${JSON.stringify(getSnapshot(session))}\n\n`);

  const subscriber = {
    res,
    pingTimer: setInterval(() => {
      res.write(": ping\n\n");
    }, 25 * 1000),
  };

  session.subscribers.add(subscriber);

  req.on("close", () => {
    clearInterval(subscriber.pingTimer);
    session.subscribers.delete(subscriber);
  });
}

async function handleCreateParticipant(req, res, session) {
  const code = createParticipantCode(session);
  session.participants.add(code);
  broadcastSession(session);

  sendJson(res, 201, {
    code,
    session: getSnapshot(session),
  });
}

async function handleVerifyParticipant(req, res, session) {
  const body = await readJson(req);
  const code = normalizeParticipantCode(body.code);

  if (!session.participants.has(code)) {
    sendError(res, 401, "That participant code is not valid for this session.");
    return;
  }

  sendJson(res, 200, {
    code,
    session: getSnapshot(session),
  });
}

async function handleStartSession(req, res, session, url) {
  const body = await readJson(req);
  const auth = authenticate(session, url, body);
  if (!requireHost(res, session, auth)) {
    return;
  }

  if (session.status === "closed") {
    sendError(res, 409, "This session has already been closed.");
    return;
  }

  session.status = "active";
  broadcastSession(session);
  sendJson(res, 200, { session: getSnapshot(session) });
}

async function handleCloseSession(req, res, session, url) {
  const body = await readJson(req);
  const auth = authenticate(session, url, body);
  if (!requireHost(res, session, auth)) {
    return;
  }

  session.status = "closed";
  session.closedAt = Date.now();
  broadcastSession(session);
  sendJson(res, 200, { session: getSnapshot(session) });
}

async function handleRenameColumns(req, res, session, url) {
  const body = await readJson(req);
  const auth = authenticate(session, url, body);
  if (!requireHost(res, session, auth)) {
    return;
  }

  if (session.status === "closed") {
    sendError(res, 409, "Closed sessions cannot be edited.");
    return;
  }

  const updates = Array.isArray(body.columns) ? body.columns : [];
  for (const update of updates) {
    const column = session.columns.find((item) => item.id === update.id);
    if (column) {
      column.title = normalizeColumnTitle(update.title, column.title);
    }
  }

  broadcastSession(session);
  sendJson(res, 200, { session: getSnapshot(session) });
}

async function handleCreatePost(req, res, session, url) {
  const body = await readJson(req);
  const auth = authenticate(session, url, body);

  if (!auth) {
    sendError(res, 401, "A valid participant code is required.");
    return;
  }

  if (!requireActiveSession(res, session)) {
    return;
  }

  const column = session.columns.find((item) => item.id === body.columnId);
  if (!column) {
    sendError(res, 400, "Choose a valid column.");
    return;
  }

  const text = normalizePostText(body.text);
  if (!text) {
    sendError(res, 400, "Post text is required.");
    return;
  }

  const post = {
    id: randomHex(12),
    columnId: column.id,
    text,
    authorCode: auth.actorCode,
    createdAt: Date.now(),
    plusOnes: [],
  };

  session.posts.push(post);
  broadcastSession(session);
  sendJson(res, 201, { post, session: getSnapshot(session) });
}

async function handleUpdatePost(req, res, session, url, postId) {
  const body = await readJson(req);
  const auth = authenticate(session, url, body);
  if (!requireHost(res, session, auth)) {
    return;
  }

  if (!requireActiveSession(res, session)) {
    return;
  }

  const post = findPost(session, postId);
  if (!post) {
    sendError(res, 404, "That post was not found.");
    return;
  }

  if (typeof body.text === "string") {
    const text = normalizePostText(body.text);
    if (!text) {
      sendError(res, 400, "Post text is required.");
      return;
    }
    post.text = text;
  }

  if (typeof body.columnId === "string") {
    const column = session.columns.find((item) => item.id === body.columnId);
    if (!column) {
      sendError(res, 400, "Choose a valid column.");
      return;
    }
    post.columnId = column.id;
  }

  broadcastSession(session);
  sendJson(res, 200, { post, session: getSnapshot(session) });
}

async function handleDeletePost(req, res, session, url, postId) {
  const body = await readJson(req);
  const auth = authenticate(session, url, body);
  if (!requireHost(res, session, auth)) {
    return;
  }

  if (!requireActiveSession(res, session)) {
    return;
  }

  const index = session.posts.findIndex((post) => post.id === postId);
  if (index === -1) {
    sendError(res, 404, "That post was not found.");
    return;
  }

  session.posts.splice(index, 1);
  broadcastSession(session);
  sendJson(res, 200, { session: getSnapshot(session) });
}

async function handlePlusOne(req, res, session, url, postId) {
  const body = await readJson(req);
  const auth = authenticate(session, url, body);

  if (!auth) {
    sendError(res, 401, "A valid participant code is required.");
    return;
  }

  if (!requireActiveSession(res, session)) {
    return;
  }

  const post = findPost(session, postId);
  if (!post) {
    sendError(res, 404, "That post was not found.");
    return;
  }

  if (!post.plusOnes.includes(auth.actorCode)) {
    post.plusOnes.push(auth.actorCode);
    broadcastSession(session);
  }

  sendJson(res, 200, { post, session: getSnapshot(session) });
}

async function handleCopyPost(req, res, session, url, postId) {
  const body = await readJson(req);
  const auth = authenticate(session, url, body);

  if (!auth) {
    sendError(res, 401, "A valid participant code is required.");
    return;
  }

  if (!requireActiveSession(res, session)) {
    return;
  }

  const source = findPost(session, postId);
  if (!source) {
    sendError(res, 404, "That post was not found.");
    return;
  }

  const targetColumnId = body.targetColumnId || getOtherColumnId(session, source.columnId);
  const targetColumn = session.columns.find((column) => column.id === targetColumnId);
  if (!targetColumn) {
    sendError(res, 400, "Choose a valid target column.");
    return;
  }

  const post = {
    id: randomHex(12),
    columnId: targetColumn.id,
    text: source.text,
    authorCode: auth.actorCode,
    createdAt: Date.now(),
    plusOnes: [],
  };

  session.posts.push(post);
  broadcastSession(session);
  sendJson(res, 201, { post, session: getSnapshot(session) });
}

function handleExportCsv(res, session, url) {
  const auth = authenticate(session, url);
  if (!requireHost(res, session, auth)) {
    return;
  }

  setCors(res);
  res.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${session.id}-responses.csv"`,
  });
  res.end(sessionToCsv(session));
}

async function requestHandler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const parts = url.pathname.split("/").filter(Boolean);

  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (parts[0] !== "api" || parts[1] !== "sessions") {
      sendError(res, 404, "Not found.");
      return;
    }

    if (req.method === "POST" && parts.length === 2) {
      await handleCreateSession(req, res);
      return;
    }

    const session = findSession(parts[2]);
    if (!session) {
      sendError(res, 404, "That session was not found.");
      return;
    }

    if (req.method === "GET" && parts.length === 3) {
      const auth = authenticate(session, url);
      if (!auth) {
        sendError(res, 401, "A valid host token or participant code is required.");
        return;
      }
      sendJson(res, 200, { session: getSnapshot(session) });
      return;
    }

    if (req.method === "GET" && parts[3] === "events") {
      handleEvents(req, res, session, url);
      return;
    }

    if (req.method === "GET" && parts[3] === "export.csv") {
      handleExportCsv(res, session, url);
      return;
    }

    if (req.method === "POST" && parts[3] === "participants") {
      if (session.status === "closed") {
        sendError(res, 409, "This session is closed.");
        return;
      }
      if (session.status === "expired") {
        sendError(res, 410, "This session has expired.");
        return;
      }
      await handleCreateParticipant(req, res, session);
      return;
    }

    if (req.method === "POST" && parts[3] === "verify") {
      await handleVerifyParticipant(req, res, session);
      return;
    }

    if (req.method === "POST" && parts[3] === "start") {
      await handleStartSession(req, res, session, url);
      return;
    }

    if (req.method === "POST" && parts[3] === "close") {
      await handleCloseSession(req, res, session, url);
      return;
    }

    if (req.method === "PATCH" && parts[3] === "columns") {
      await handleRenameColumns(req, res, session, url);
      return;
    }

    if (req.method === "POST" && parts[3] === "posts" && parts.length === 4) {
      await handleCreatePost(req, res, session, url);
      return;
    }

    if (parts[3] === "posts" && parts[4]) {
      const postId = parts[4];

      if (req.method === "PATCH" && parts.length === 5) {
        await handleUpdatePost(req, res, session, url, postId);
        return;
      }

      if (req.method === "DELETE" && parts.length === 5) {
        await handleDeletePost(req, res, session, url, postId);
        return;
      }

      if (req.method === "POST" && parts[5] === "plus-one") {
        await handlePlusOne(req, res, session, url, postId);
        return;
      }

      if (req.method === "POST" && parts[5] === "copy") {
        await handleCopyPost(req, res, session, url, postId);
        return;
      }
    }

    sendError(res, 404, "Not found.");
  } catch (error) {
    const message = error instanceof SyntaxError ? "Invalid JSON." : error.message;
    sendError(res, 400, message || "Request failed.");
  }
}

const server = http.createServer(requestHandler);

server.listen(PORT);
