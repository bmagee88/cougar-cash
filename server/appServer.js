const crypto = require("crypto");
const http = require("http");
const { URL } = require("url");

const PORT = Number(
  process.env.APP_SERVER_PORT ||
    process.env.COUGAR_API_PORT ||
    process.env.PADLET_PORT ||
    process.env.PORT ||
    4000
);
const ONE_HOUR_MS = 60 * 60 * 1000;
const MAX_POST_LENGTH = 32;
const SOFT_POST_LENGTH = 16;
const MAX_PROMPT_LENGTH = 240;
const MAX_BOARD_NAME_LENGTH = 64;
const DELETE_EXPIRED_AFTER_MS = 30 * 1000;
const SESSION_PREFIX = "session";
const USER_PREFIX = "user";
const POST_COOLDOWN_MS = 2500;
const POST_WINDOW_MS = 60 * 1000;
const MAX_POSTS_PER_WINDOW = 8;
const DUPLICATE_POST_WINDOW_MS = 2 * 60 * 1000;

const sessions = new Map();
const typingBossSessions = new Map();

const TYPING_BOSS_PREFIX = "boss";
const TYPING_BOSS_PLAYER_PREFIX = "hero";
const TYPING_BOSS_SESSION_MS = 2 * 60 * 60 * 1000;
const TYPING_BOSS_DELETE_EXPIRED_AFTER_MS = 60 * 1000;
const TYPING_BOSS_JOIN_NAME_MAX = 24;
const TYPING_BOSS_PROJECTILE_TRAVEL_MS = 1800;
const TYPING_BOSS_BOSS_TRAVEL_MS = 2200;
const TYPING_BOSS_DEFAULT_ACCURACY = 0.7;
const TYPING_BOSS_PLAYER_MAX_HP = 140;

const TYPING_BOSS_PROFILES = {
  emberWhelp: {
    id: "emberWhelp",
    name: "Ember Whelp",
    difficulty: "easy",
    maxHp: 900,
    attackIntervalMs: 24000,
    color: "#f97316",
    glow: "rgba(249, 115, 22, 0.45)",
    moves: [
      { id: "ember-snap", label: "Ember Snap", damageMin: 12, damageMax: 18 },
      { id: "smoke-burst", label: "Smoke Burst", damageMin: 14, damageMax: 20 },
      { id: "small-flame", label: "Small Flame", damageMin: 16, damageMax: 22 },
    ],
  },
  cindermaw: {
    id: "cindermaw",
    name: "Cindermaw",
    difficulty: "medium",
    maxHp: 1200,
    attackIntervalMs: 18000,
    color: "#ef4444",
    glow: "rgba(239, 68, 68, 0.5)",
    moves: [
      { id: "ember-storm", label: "Ember Storm", damageMin: 16, damageMax: 24 },
      { id: "scorching-roar", label: "Scorching Roar", damageMin: 20, damageMax: 30 },
      { id: "cinder-claw", label: "Cinder Claw", damageMin: 24, damageMax: 34 },
    ],
  },
  infernalDragon: {
    id: "infernalDragon",
    name: "Ancient Red Dragon",
    difficulty: "hard",
    maxHp: 1550,
    attackIntervalMs: 12000,
    color: "#dc2626",
    glow: "rgba(220, 38, 38, 0.62)",
    moves: [
      { id: "inferno-wave", label: "Inferno Wave", damageMin: 24, damageMax: 36 },
      { id: "molten-gaze", label: "Molten Gaze", damageMin: 28, damageMax: 40 },
      { id: "cataclysm-breath", label: "Cataclysm Breath", damageMin: 32, damageMax: 46 },
    ],
  },
};

const TYPING_BOSS_CLASSES = {
  cleric: {
    id: "cleric",
    label: "Cleric",
    maxHp: 135,
    color: "#facc15",
    specialLabel: "Radiant Mend",
  },
  barbarian: {
    id: "barbarian",
    label: "Barbarian",
    maxHp: 165,
    color: "#fb7185",
    specialLabel: "Rage Breaker",
  },
  paladin: {
    id: "paladin",
    label: "Paladin",
    maxHp: 155,
    color: "#fbbf24",
    specialLabel: "Blessed Rally",
  },
  rogue: {
    id: "rogue",
    label: "Rogue",
    maxHp: 125,
    color: "#a78bfa",
    specialLabel: "Shadow Veil",
  },
  necromancer: {
    id: "necromancer",
    label: "Necromancer",
    maxHp: 130,
    color: "#86efac",
    specialLabel: "Soul Return",
  },
  monk: {
    id: "monk",
    label: "Monk",
    maxHp: 140,
    color: "#fb923c",
    specialLabel: "Third Palm",
  },
};
const TYPING_BOSS_CLASS_IDS = Object.keys(TYPING_BOSS_CLASSES);

const TYPING_BOSS_MOVES = {
  weak: {
    id: "weak",
    label: "Quick Strike",
    kind: "damage",
    difficulty: "easy",
    power: 0.7,
  },
  strong: {
    id: "strong",
    label: "Heavy Strike",
    kind: "damage",
    difficulty: "medium",
    power: 1.08,
  },
  clericSpecial: {
    id: "clericSpecial",
    label: "Radiant Mend",
    kind: "heal-other",
    difficulty: "medium",
    power: 1.22,
  },
  barbarianSpecial: {
    id: "barbarianSpecial",
    label: "Rage Breaker",
    kind: "damage",
    difficulty: "hard",
    power: 1.72,
    extraLong: true,
  },
  paladinSpecial: {
    id: "paladinSpecial",
    label: "Blessed Rally",
    kind: "buff-other",
    difficulty: "medium",
    power: 1,
  },
  rogueSpecial: {
    id: "rogueSpecial",
    label: "Shadow Veil",
    kind: "evade-self",
    difficulty: "easy",
    power: 1,
  },
  necromancerSpecial: {
    id: "necromancerSpecial",
    label: "Soul Return",
    kind: "resurrect",
    difficulty: "medium",
    power: 1,
  },
  monkSpecial: {
    id: "monkSpecial",
    label: "Third Palm",
    kind: "damage",
    difficulty: "easy",
    power: 1.48,
  },
  potion: {
    id: "potion",
    label: "Potion",
    kind: "heal-self",
    difficulty: "easy",
    power: 0.95,
  },
};


const TYPING_BOSS_QUESTIONS = {
  easy: [
    {
      id: "easy-01",
      question: "What is 7 + 5?",
      answers: ["12", "10", "13", "11"],
      correctAnswer: "12",
    },
    {
      id: "easy-02",
      question: "Which planet is known as the Red Planet?",
      answers: ["Mars", "Venus", "Earth", "Jupiter"],
      correctAnswer: "Mars",
    },
    {
      id: "easy-03",
      question: "How many sides does a triangle have?",
      answers: ["three", "four", "five", "six"],
      correctAnswer: "three",
    },
    {
      id: "easy-04",
      question: "What is the past tense of run?",
      answers: ["ran", "runned", "runs", "running"],
      correctAnswer: "ran",
    },
    {
      id: "easy-05",
      question: "Which punctuation mark ends a question?",
      answers: ["question mark", "period", "comma", "semicolon"],
      correctAnswer: "question mark",
    },
    {
      id: "easy-06",
      question: "What is 9 x 4?",
      answers: ["36", "32", "34", "40"],
      correctAnswer: "36",
    },
    {
      id: "easy-07",
      question: "Which word is a noun?",
      answers: ["river", "quickly", "blue", "jump"],
      correctAnswer: "river",
    },
    {
      id: "easy-08",
      question: "Water freezes at what temperature in Celsius?",
      answers: ["0", "100", "32", "10"],
      correctAnswer: "0",
    },
    {
      id: "easy-09",
      question: "Which tool is used to measure length?",
      answers: ["ruler", "scale", "thermometer", "clock"],
      correctAnswer: "ruler",
    },
    {
      id: "easy-10",
      question: "What is the opposite of increase?",
      answers: ["decrease", "expand", "collect", "create"],
      correctAnswer: "decrease",
    },
  ],
  medium: [
    {
      id: "medium-01",
      question: "What fraction is equivalent to one half?",
      answers: ["2/4", "2/3", "3/5", "4/6"],
      correctAnswer: "2/4",
    },
    {
      id: "medium-02",
      question: "Which part of speech describes an action?",
      answers: ["verb", "noun", "adjective", "preposition"],
      correctAnswer: "verb",
    },
    {
      id: "medium-03",
      question: "What gas do plants take in during photosynthesis?",
      answers: ["carbon dioxide", "oxygen", "nitrogen", "hydrogen"],
      correctAnswer: "carbon dioxide",
    },
    {
      id: "medium-04",
      question: "What is the area of a rectangle that is 6 by 8 units?",
      answers: ["48 square units", "28 square units", "14 square units", "36 square units"],
      correctAnswer: "48 square units",
    },
    {
      id: "medium-05",
      question: "Which sentence uses a comma correctly?",
      answers: ["After lunch, we read.", "After, lunch we read.", "After lunch we, read.", "After lunch we read,"],
      correctAnswer: "After lunch, we read.",
    },
    {
      id: "medium-06",
      question: "What is the main idea of a paragraph?",
      answers: ["the central point", "the longest sentence", "the final word", "the page number"],
      correctAnswer: "the central point",
    },
    {
      id: "medium-07",
      question: "Which number is prime?",
      answers: ["17", "21", "27", "33"],
      correctAnswer: "17",
    },
    {
      id: "medium-08",
      question: "What force pulls objects toward Earth?",
      answers: ["gravity", "friction", "magnetism", "electricity"],
      correctAnswer: "gravity",
    },
    {
      id: "medium-09",
      question: "Which word means to compare two unlike things using like or as?",
      answers: ["simile", "metaphor", "theme", "setting"],
      correctAnswer: "simile",
    },
    {
      id: "medium-10",
      question: "What is 15 percent of 200?",
      answers: ["30", "15", "20", "45"],
      correctAnswer: "30",
    },
  ],
  hard: [
    {
      id: "hard-01",
      question: "Which process describes water changing from a liquid into a gas?",
      answers: ["evaporation", "condensation", "precipitation", "collection"],
      correctAnswer: "evaporation",
    },
    {
      id: "hard-02",
      question: "What is the result of multiplying three fourths by eight?",
      answers: ["six", "four", "eight", "twelve"],
      correctAnswer: "six",
    },
    {
      id: "hard-03",
      question: "Which literary term means a lesson or message about life?",
      answers: ["theme", "conflict", "narrator", "dialogue"],
      correctAnswer: "theme",
    },
    {
      id: "hard-04",
      question: "What is the volume of a rectangular prism measuring 4 by 5 by 6?",
      answers: ["120 cubic units", "90 cubic units", "30 cubic units", "15 cubic units"],
      correctAnswer: "120 cubic units",
    },
    {
      id: "hard-05",
      question: "Which body system moves oxygen from the lungs into the blood?",
      answers: ["respiratory system", "digestive system", "skeletal system", "nervous system"],
      correctAnswer: "respiratory system",
    },
    {
      id: "hard-06",
      question: "Which equation has the solution x equals seven?",
      answers: ["x + 5 = 12", "x - 5 = 1", "2x = 16", "x/7 = 7"],
      correctAnswer: "x + 5 = 12",
    },
    {
      id: "hard-07",
      question: "Which word best describes evidence that can be measured or counted?",
      answers: ["quantitative", "figurative", "persuasive", "chronological"],
      correctAnswer: "quantitative",
    },
    {
      id: "hard-08",
      question: "What is the name for a comparison that does not use like or as?",
      answers: ["metaphor", "simile", "alliteration", "hyperbole"],
      correctAnswer: "metaphor",
    },
    {
      id: "hard-09",
      question: "Which layer of Earth is made mostly of solid iron and nickel?",
      answers: ["inner core", "outer core", "mantle", "crust"],
      correctAnswer: "inner core",
    },
    {
      id: "hard-10",
      question: "Which strategy is best for checking whether a source is trustworthy?",
      answers: ["compare it with reliable sources", "choose the first result", "count every picture", "ignore the author"],
      correctAnswer: "compare it with reliable sources",
    },
  ],
};

function randomHex(length) {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length)
    .toUpperCase();
}

function createSessionId() {
  for (let attempt = 0; attempt < 256; attempt += 1) {
    const id = `${SESSION_PREFIX}${randomHex(3)}`;
    if (!sessions.has(id)) {
      return id;
    }
  }

  throw new Error("No session ids are available right now.");
}

function createParticipantCode(session) {
  for (let attempt = 0; attempt < 256; attempt += 1) {
    const code = `${USER_PREFIX}${randomHex(4)}`;
    if (!session.participants.has(code)) {
      return code;
    }
  }

  throw new Error("No participant codes are available for this session.");
}

function createTypingBossSessionId() {
  for (let attempt = 0; attempt < 256; attempt += 1) {
    const id = `${TYPING_BOSS_PREFIX}${randomHex(3)}`;
    if (!typingBossSessions.has(id)) {
      return id;
    }
  }

  throw new Error("No boss game ids are available right now.");
}

function createTypingBossPlayerCode(session) {
  for (let attempt = 0; attempt < 256; attempt += 1) {
    const code = `${TYPING_BOSS_PLAYER_PREFIX}${randomHex(4)}`;
    if (!session.players.has(code)) {
      return code;
    }
  }

  throw new Error("No player codes are available for this boss game.");
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
  const raw = toSafeString(value);
  const hex = raw
    .replace(new RegExp(`^${SESSION_PREFIX}`, "i"), "")
    .toUpperCase()
    .replace(/[^0-9A-F]/g, "")
    .slice(0, 3);

  return hex.length === 3 ? `${SESSION_PREFIX}${hex}` : raw;
}

function normalizeParticipantCode(value) {
  const raw = toSafeString(value);
  const hex = raw
    .replace(new RegExp(`^${USER_PREFIX}`, "i"), "")
    .toUpperCase()
    .replace(/[^0-9A-F]/g, "")
    .slice(0, 4);

  return hex.length === 4 ? `${USER_PREFIX}${hex}` : raw;
}

function normalizeTypingBossSessionId(value) {
  const raw = toSafeString(value);
  const hex = raw
    .replace(new RegExp(`^${TYPING_BOSS_PREFIX}`, "i"), "")
    .toUpperCase()
    .replace(/[^0-9A-F]/g, "")
    .slice(0, 3);

  return hex.length === 3 ? `${TYPING_BOSS_PREFIX}${hex}` : raw;
}

function normalizeTypingBossPlayerCode(value) {
  const raw = toSafeString(value);
  const hex = raw
    .replace(new RegExp(`^${TYPING_BOSS_PLAYER_PREFIX}`, "i"), "")
    .toUpperCase()
    .replace(/[^0-9A-F]/g, "")
    .slice(0, 4);

  return hex.length === 4 ? `${TYPING_BOSS_PLAYER_PREFIX}${hex}` : raw;
}

function normalizeTypingBossPlayerName(value, fallback) {
  const cleaned = toSafeString(value)
    .replace(/\s+/g, " ")
    .slice(0, TYPING_BOSS_JOIN_NAME_MAX);
  return cleaned || fallback;
}

function normalizeTypingBossClass(value) {
  const raw = toSafeString(value);
  if (!raw) return "cleric";

  const compact = raw.toLowerCase().replace(/[^a-z]/g, "");
  return (
    TYPING_BOSS_CLASS_IDS.find((classId) => {
      const classInfo = TYPING_BOSS_CLASSES[classId];
      return (
        classId.toLowerCase() === compact ||
        classInfo.label.toLowerCase().replace(/[^a-z]/g, "") === compact
      );
    }) || ""
  );
}

function normalizeTypingBossProfile(value) {
  return TYPING_BOSS_PROFILES[value] || TYPING_BOSS_PROFILES.cindermaw;
}

function normalizeTypedAnswer(value) {
  return toSafeString(value);
}

function normalizeColumnTitle(value, fallback) {
  const title = toSafeString(value).slice(0, MAX_POST_LENGTH);
  return title || fallback;
}

function normalizePostText(value) {
  return toSafeString(value).slice(0, MAX_POST_LENGTH);
}

function normalizePrompt(value, fallback = "") {
  const prompt = toSafeString(value).slice(0, MAX_PROMPT_LENGTH);
  return prompt || fallback;
}

function normalizeBoardName(value, fallback = "Class Board") {
  const name = toSafeString(value).slice(0, MAX_BOARD_NAME_LENGTH);
  return name || fallback;
}

function normalizeSessionType(value) {
  return value === "one-q-many-a" ? "one-q-many-a" : "good-not-good";
}

function createAvatarUrl(code) {
  const lock = parseInt(code.replace(new RegExp(`^${USER_PREFIX}`, "i"), ""), 16);
  return `https://loremflickr.com/96/96/animals?lock=${lock}`;
}

function avatarUrlForCode(session, code) {
  if (code === "HOST") return "";
  return session.participants.get(code)?.avatarUrl || "";
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

function getParticipantSnapshot(session) {
  return [...session.participants.values()].map((participant) => ({
    code: participant.code,
    avatarUrl: participant.avatarUrl,
    showMe: Boolean(participant.showMe),
    issuedAt: new Date(participant.issuedAt).toISOString(),
    joinedAt: participant.joinedAt
      ? new Date(participant.joinedAt).toISOString()
      : null,
    lastSeenAt: participant.lastSeenAt
      ? new Date(participant.lastSeenAt).toISOString()
      : null,
  }));
}

function getParticipantProfiles(session) {
  return [...session.participants.values()].map((participant) => ({
    code: participant.code,
    avatarUrl: participant.avatarUrl,
    showMe: Boolean(participant.showMe),
  }));
}

function getPostSnapshot(session, post) {
  const author = session.participants.get(post.authorCode);
  return {
    ...post,
    authorAvatarUrl: post.authorAvatarUrl || avatarUrlForCode(session, post.authorCode),
    authorShowMe: post.authorCode === "HOST" || Boolean(author?.showMe),
    plusOnes: [...post.plusOnes],
  };
}

function getSnapshot(session, options = {}) {
  const now = Date.now();
  const includeParticipants = Boolean(options.includeParticipants);

  const snapshot = {
    id: session.id,
    name: session.name,
    type: session.type,
    status: session.status,
    prompt: session.prompt,
    createdAt: new Date(session.createdAt).toISOString(),
    expiresAt: new Date(session.expiresAt).toISOString(),
    closedAt: session.closedAt ? new Date(session.closedAt).toISOString() : null,
    remainingSeconds: Math.max(0, Math.ceil((session.expiresAt - now) / 1000)),
    columns: session.columns.map((column) => ({ ...column })),
    posts: session.posts.map((post) => getPostSnapshot(session, post)),
    participantCount: session.participants.size,
    participantProfiles: getParticipantProfiles(session),
    limits: {
      maxPostLength: MAX_POST_LENGTH,
      softPostLength: SOFT_POST_LENGTH,
    },
  };

  if (includeParticipants) {
    snapshot.participants = getParticipantSnapshot(session);
  }

  return snapshot;
}

function getSnapshotForAuth(session, auth) {
  return getSnapshot(session, { includeParticipants: auth?.role === "host" });
}

function getSessionSummary(session) {
  const now = Date.now();

  return {
    id: session.id,
    name: session.name,
    type: session.type,
    status: session.status,
    prompt: session.prompt,
    createdAt: new Date(session.createdAt).toISOString(),
    expiresAt: new Date(session.expiresAt).toISOString(),
    closedAt: session.closedAt ? new Date(session.closedAt).toISOString() : null,
    remainingSeconds: Math.max(0, Math.ceil((session.expiresAt - now) / 1000)),
    columns: session.columns.map((column) => ({ ...column })),
    postCount: session.posts.length,
    participantCount: session.participants.size,
  };
}

function writeSessionEvent(subscriber, session) {
  const event = `event: session\ndata: ${JSON.stringify(
    getSnapshot(session, { includeParticipants: subscriber.auth?.role === "host" })
  )}\n\n`;

  subscriber.res.write(event);
}

function broadcastSession(session) {
  for (const subscriber of [...session.subscribers]) {
    try {
      writeSessionEvent(subscriber, session);
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

function refreshAllSessionStatuses() {
  for (const session of [...sessions.values()]) {
    refreshSessionStatus(session);
  }
}

function closeSessionsForShutdown() {
  const now = Date.now();

  for (const session of sessions.values()) {
    if (session.status === "setup" || session.status === "active") {
      session.status = "closed";
      session.closedAt = session.closedAt || now;
      broadcastSession(session);
    }

    for (const subscriber of [...session.subscribers]) {
      clearInterval(subscriber.pingTimer);
      subscriber.res.end();
      session.subscribers.delete(subscriber);
    }
  }

  closeTypingBossSessionsForShutdown();
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

function looksLikeNonsense(text) {
  const compact = text.replace(/\s+/g, "");
  const alnum = text.replace(/[^a-z0-9]/gi, "");

  if (alnum.length < 2) {
    return true;
  }

  if (/(.)\1{5,}/i.test(compact)) {
    return true;
  }

  if (alnum.length >= 8 && new Set(alnum.toLowerCase()).size <= 2) {
    return true;
  }

  return false;
}

function checkPostThrottle(session, auth, text) {
  if (auth.role === "host") {
    return null;
  }

  const participant = session.participants.get(auth.actorCode);
  if (!participant) {
    return { status: 401, message: "A valid participant code is required." };
  }

  if (looksLikeNonsense(text)) {
    return {
      status: 400,
      message: "Add a more complete response before posting.",
    };
  }

  const now = Date.now();
  participant.postTimestamps = (participant.postTimestamps || []).filter(
    (postedAt) => now - postedAt < POST_WINDOW_MS
  );

  const lastPostAt = participant.postTimestamps.at?.(-1);
  if (lastPostAt && now - lastPostAt < POST_COOLDOWN_MS) {
    return {
      status: 429,
      message: "Pause for a moment before posting again.",
    };
  }

  if (participant.postTimestamps.length >= MAX_POSTS_PER_WINDOW) {
    return {
      status: 429,
      message: "Posting is temporarily slowed for this alias.",
    };
  }

  const normalized = text.toLowerCase();
  const duplicate = session.posts.some(
    (post) =>
      post.authorCode === auth.actorCode &&
      post.text.toLowerCase() === normalized &&
      now - post.createdAt < DUPLICATE_POST_WINDOW_MS
  );

  if (duplicate) {
    return {
      status: 429,
      message: "That response was already posted recently.",
    };
  }

  return null;
}

function recordAcceptedPost(session, auth) {
  if (auth.role === "host") {
    return;
  }

  const participant = session.participants.get(auth.actorCode);
  if (!participant) {
    return;
  }

  participant.postTimestamps = [
    ...(participant.postTimestamps || []),
    Date.now(),
  ].filter((postedAt) => Date.now() - postedAt < POST_WINDOW_MS);
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function sessionToCsv(session) {
  const header = [
    "session_id",
    "board_name",
    "session_type",
    "status",
    "prompt",
    "column",
    "post_type",
    "parent_question",
    "text",
    "author_code",
    "plus_one_count",
    "plus_one_codes",
    "created_at",
  ];

  const rows = session.posts.map((post) => {
    const column = session.columns.find((item) => item.id === post.columnId);
    const parent = post.parentPostId
      ? session.posts.find((item) => item.id === post.parentPostId)
      : null;

    return [
      session.id,
      session.name,
      session.type,
      session.status,
      session.prompt || "",
      column?.title || post.columnId,
      post.postType || "reflection",
      parent?.text || "",
      post.text,
      post.authorCode,
      post.plusOnes.length,
      post.plusOnes.join(" "),
      new Date(post.createdAt).toISOString(),
    ];
  });

  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function shuffleCopy(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function typingBossMoveForPlayer(player, moveId) {
  if (moveId === "special") {
    const moveByClass = {
      barbarian: TYPING_BOSS_MOVES.barbarianSpecial,
      paladin: TYPING_BOSS_MOVES.paladinSpecial,
      rogue: TYPING_BOSS_MOVES.rogueSpecial,
      necromancer: TYPING_BOSS_MOVES.necromancerSpecial,
      monk: TYPING_BOSS_MOVES.monkSpecial,
      cleric: TYPING_BOSS_MOVES.clericSpecial,
    };
    return moveByClass[player.classId] || TYPING_BOSS_MOVES.clericSpecial;
  }

  return TYPING_BOSS_MOVES[moveId] || TYPING_BOSS_MOVES.weak;
}

function typingBossSpecialReady(player) {
  if (player.classId === "monk") {
    return (player.monkSpecialCharge || 0) >= 2;
  }

  if (player.classId === "rogue") {
    return !player.evadeReady;
  }

  return true;
}

function typingBossSpeedMultiplier(player, effectiveDps, previousAverage) {
  if (!player.averageDps) {
    return 1;
  }

  if (player.classId === "monk") {
    return clampNumber(effectiveDps / previousAverage, 1, 1.75);
  }

  return clampNumber(effectiveDps / previousAverage, 0.65, 1.6);
}

function advanceTypingBossPlayerTurn(player, move) {
  player.turnsTaken = (player.turnsTaken || 0) + 1;

  if (player.classId === "monk") {
    player.monkSpecialCharge =
      move.id === "monkSpecial"
        ? 0
        : Math.min(2, (player.monkSpecialCharge || 0) + 1);
  }
}

function typingBossQuestionById(questionId) {
  for (const questions of Object.values(TYPING_BOSS_QUESTIONS)) {
    const question = questions.find((item) => item.id === questionId);
    if (question) {
      return question;
    }
  }

  return null;
}

function pickTypingBossQuestion(move) {
  const bank = TYPING_BOSS_QUESTIONS[move.difficulty] || TYPING_BOSS_QUESTIONS.easy;
  const base = bank[Math.floor(Math.random() * bank.length)];
  const answers = shuffleCopy(base.answers);

  if (!move.extraLong) {
    return { ...base, answers };
  }

  return {
    ...base,
    question: `${base.question} Type with battle focus before choosing the answer.`,
    answers,
  };
}

function typingBossAccuracy(player) {
  if (!player.totalKeystrokes) {
    return TYPING_BOSS_DEFAULT_ACCURACY;
  }

  return clampNumber(player.correctKeystrokes / player.totalKeystrokes, 0, 1);
}

function typingBossAccuracyBonus(attackAccuracy) {
  const pct = Math.floor(clampNumber(attackAccuracy, 0, 1) * 100);
  let bonus = 0;

  if (pct >= 100) bonus = 16;
  else if (pct >= 99) bonus = 11;
  else if (pct >= 98) bonus = 7;
  else if (pct >= 97) bonus = 4;
  else if (pct >= 96) bonus = 2;
  else if (pct >= 95) bonus = 1;

  return 1 + bonus / 100;
}

function typingBossResolveTarget(session, player, move, requestedTargetCode) {
  if (move.kind === "heal-self") {
    return player.code;
  }

  if (move.kind === "evade-self") {
    return player.code;
  }

  if (move.kind === "buff-other") {
    const requested = session.players.get(normalizeTypingBossPlayerCode(requestedTargetCode));
    if (requested && requested.hp > 0 && requested.code !== player.code) {
      return requested.code;
    }

    const ally = [...session.players.values()].find(
      (candidate) => candidate.hp > 0 && candidate.code !== player.code
    );

    return ally?.code || null;
  }

  if (move.kind === "resurrect") {
    const requested = session.players.get(normalizeTypingBossPlayerCode(requestedTargetCode));
    if (requested && requested.hp <= 0) {
      return requested.code;
    }

    const defeated = [...session.players.values()].find(
      (candidate) => candidate.hp <= 0 && candidate.code !== player.code
    );

    return defeated?.code || null;
  }

  if (move.kind === "heal-other") {
    const requested = session.players.get(normalizeTypingBossPlayerCode(requestedTargetCode));
    if (requested && requested.hp > 0) {
      return requested.code;
    }

    const injuredAlly = [...session.players.values()]
      .filter((candidate) => candidate.hp > 0 && candidate.hp < candidate.maxHp)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];

    return injuredAlly?.code || player.code;
  }

  return "boss";
}

function createTypingBossSession(body) {
  const id = createTypingBossSessionId();
  const now = Date.now();
  const bossProfile = normalizeTypingBossProfile(body.bossId || body.bossType);
  const session = {
    id,
    hostToken: randomHex(32),
    name: normalizeBoardName(body.name || body.gameName, "Typing Boss Battle"),
    status: "setup",
    createdAt: now,
    expiresAt: now + TYPING_BOSS_SESSION_MS,
    closedAt: null,
    boss: {
      id: bossProfile.id,
      name: bossProfile.name,
      difficulty: bossProfile.difficulty,
      hp: bossProfile.maxHp,
      maxHp: bossProfile.maxHp,
      attackIntervalMs: bossProfile.attackIntervalMs,
      lastAttackAt: now,
      nextAttackAt: now + bossProfile.attackIntervalMs,
      currentMoveLabel: bossProfile.moves[0].label,
      color: bossProfile.color,
      glow: bossProfile.glow,
    },
    players: new Map(),
    challenges: new Map(),
    projectiles: [],
    log: [],
    subscribers: new Set(),
    timers: new Set(),
    bossTimer: null,
  };

  session.expireTimer = setTimeout(
    () => expireTypingBossSession(session),
    TYPING_BOSS_SESSION_MS
  );
  session.expireTimer.unref?.();
  typingBossSessions.set(id, session);
  return session;
}

function getTypingBossPlayerSnapshot(player) {
  return {
    code: player.code,
    name: player.name,
    classId: player.classId,
    classLabel: TYPING_BOSS_CLASSES[player.classId]?.label || "Hero",
    color: TYPING_BOSS_CLASSES[player.classId]?.color || "#7dd3fc",
    hp: Math.max(0, Math.round(player.hp)),
    maxHp: player.maxHp,
    joinedAt: new Date(player.joinedAt).toISOString(),
    lastSeenAt: player.lastSeenAt
      ? new Date(player.lastSeenAt).toISOString()
      : null,
    averageDps: Number(player.averageDps.toFixed(2)),
    accuracy: Number(typingBossAccuracy(player).toFixed(3)),
    correctStreak: player.correctStreak,
    totalDamage: Math.round(player.totalDamage),
    totalHealing: Math.round(player.totalHealing),
    totalBuffs: player.totalBuffs || 0,
    totalResurrections: player.totalResurrections || 0,
    bossHitsTaken: player.bossHitsTaken || 0,
    regularBossMisses: player.regularBossMisses || 0,
    specialEvades: player.specialEvades || 0,
    turnsTaken: player.turnsTaken || 0,
    nextAttackMultiplier: Number((player.nextAttackMultiplier || 1).toFixed(2)),
    evadeReady: Boolean(player.evadeReady),
    monkSpecialCharge: player.monkSpecialCharge || 0,
    specialReady: typingBossSpecialReady(player),
    defeated: player.hp <= 0,
  };
}

function getTypingBossProjectileSnapshot(projectile) {
  const pending = !projectile.resolvedAt;
  const result = pending
    ? "pending"
    : projectile.willHit
    ? "hit"
    : projectile.evadeType === "special"
    ? "evade"
    : "miss";
  return {
    id: projectile.id,
    source: projectile.source,
    target: projectile.target,
    kind: projectile.kind,
    moveId: projectile.moveId || null,
    bossId: projectile.bossId || null,
    moveLabel: projectile.moveLabel,
    startedAt: projectile.startedAt,
    impactAt: projectile.impactAt,
    resolvedAt: projectile.resolvedAt || null,
    result,
    amount: pending ? null : projectile.amount,
    evadeType: projectile.evadeType || null,
  };
}

function getTypingBossSnapshot(session, options = {}) {
  const now = Date.now();
  const includeHostToken = Boolean(options.includeHostToken);
  const includeChallengesFor = options.includeChallengesFor || "";

  session.projectiles = session.projectiles.filter(
    (projectile) => !projectile.resolvedAt || now - projectile.resolvedAt < 4500
  );

  const snapshot = {
    id: session.id,
    name: session.name,
    status: session.status,
    createdAt: new Date(session.createdAt).toISOString(),
    expiresAt: new Date(session.expiresAt).toISOString(),
    closedAt: session.closedAt ? new Date(session.closedAt).toISOString() : null,
    remainingSeconds: Math.max(0, Math.ceil((session.expiresAt - now) / 1000)),
    boss: { ...session.boss },
    players: [...session.players.values()].map(getTypingBossPlayerSnapshot),
    projectiles: session.projectiles.map(getTypingBossProjectileSnapshot),
    log: session.log.slice(-14),
  };

  if (includeHostToken) {
    snapshot.hostToken = session.hostToken;
  }

  if (includeChallengesFor) {
    snapshot.activeChallengeIds = [...session.challenges.values()]
      .filter((challenge) => challenge.playerCode === includeChallengesFor)
      .map((challenge) => challenge.id);
  }

  return snapshot;
}

function isTypingBossHostToken(session, token) {
  return typeof token === "string" && token.length > 0 && token === session.hostToken;
}

function authenticateTypingBoss(session, url, body = {}) {
  const hostToken = body.hostToken || url.searchParams.get("hostToken");
  if (isTypingBossHostToken(session, hostToken)) {
    return { role: "host", actorCode: "HOST" };
  }

  const code = normalizeTypingBossPlayerCode(body.code || url.searchParams.get("code"));
  if (code && session.players.has(code)) {
    return { role: "player", actorCode: code };
  }

  return null;
}

function getTypingBossSnapshotForAuth(session, auth) {
  return getTypingBossSnapshot(session, {
    includeChallengesFor: auth?.role === "player" ? auth.actorCode : "",
  });
}

function findTypingBossSession(id) {
  const session = typingBossSessions.get(normalizeTypingBossSessionId(id));
  if (session) {
    refreshTypingBossSessionStatus(session);
  }
  return session;
}

function addTypingBossLog(session, message, tone = "info") {
  session.log.push({
    id: randomHex(10),
    message,
    tone,
    createdAt: new Date().toISOString(),
  });

  if (session.log.length > 40) {
    session.log = session.log.slice(-40);
  }
}

function getTypingBossSubscriberSnapshotKey(subscriber) {
  return subscriber.auth?.role === "player"
    ? `player:${subscriber.auth.actorCode}`
    : "shared";
}

function writeTypingBossEvent(subscriber, session, snapshotCache = null) {
  const includeChallengesFor =
    subscriber.auth?.role === "player" ? subscriber.auth.actorCode : "";
  const cacheKey = getTypingBossSubscriberSnapshotKey(subscriber);
  let payload = snapshotCache?.get(cacheKey);

  if (!payload) {
    payload = JSON.stringify(
      getTypingBossSnapshot(session, {
        includeChallengesFor,
      })
    );
    snapshotCache?.set(cacheKey, payload);
  }

  const event = `event: session\ndata: ${payload}\n\n`;

  subscriber.res.write(event);
}

function broadcastTypingBossSession(session) {
  const snapshotCache = new Map();
  for (const subscriber of [...session.subscribers]) {
    try {
      writeTypingBossEvent(subscriber, session, snapshotCache);
    } catch (error) {
      clearInterval(subscriber.pingTimer);
      session.subscribers.delete(subscriber);
    }
  }
}

function clearTypingBossTimers(session) {
  clearTimeout(session.expireTimer);
  clearTimeout(session.bossTimer);
  for (const timer of session.timers) {
    clearTimeout(timer);
  }
  session.timers.clear();
}

function expireTypingBossSession(session) {
  if (!typingBossSessions.has(session.id) || session.status === "expired") {
    return;
  }

  session.status = "expired";
  session.closedAt = Date.now();
  clearTimeout(session.bossTimer);
  broadcastTypingBossSession(session);

  setTimeout(() => {
    for (const subscriber of [...session.subscribers]) {
      clearInterval(subscriber.pingTimer);
      subscriber.res.end();
      session.subscribers.delete(subscriber);
    }
    clearTypingBossTimers(session);
    typingBossSessions.delete(session.id);
  }, TYPING_BOSS_DELETE_EXPIRED_AFTER_MS).unref?.();
}

function refreshTypingBossSessionStatus(session) {
  if (Date.now() >= session.expiresAt) {
    expireTypingBossSession(session);
  }
}

function refreshAllTypingBossSessionStatuses() {
  for (const session of [...typingBossSessions.values()]) {
    refreshTypingBossSessionStatus(session);
  }
}

function requireTypingBossHost(res, session, auth) {
  if (!auth || auth.role !== "host") {
    sendError(res, 403, "Host access is required.");
    return false;
  }

  if (session.status === "expired") {
    sendError(res, 410, "This boss game has expired.");
    return false;
  }

  return true;
}

function requireTypingBossActive(res, session) {
  if (session.status === "expired") {
    sendError(res, 410, "This boss game has expired.");
    return false;
  }

  if (session.status === "closed") {
    sendError(res, 409, "This boss game is closed.");
    return false;
  }

  if (session.status !== "active") {
    sendError(res, 409, "The host has not started the boss fight yet.");
    return false;
  }

  return true;
}

function scheduleTypingBossTimer(session, callback, delayMs) {
  const timer = setTimeout(() => {
    session.timers.delete(timer);
    callback();
  }, delayMs);
  timer.unref?.();
  session.timers.add(timer);
  return timer;
}

function scheduleTypingBossAttack(session) {
  clearTimeout(session.bossTimer);

  if (session.status !== "active" || session.boss.hp <= 0) {
    return;
  }

  const delay = Math.max(500, session.boss.nextAttackAt - Date.now());
  session.bossTimer = setTimeout(() => triggerTypingBossAttack(session), delay);
  session.bossTimer.unref?.();
}

function resolveTypingBossProjectile(session, projectileId) {
  const projectile = session.projectiles.find((item) => item.id === projectileId);
  if (!projectile || projectile.resolvedAt || session.status === "expired") {
    return;
  }

  projectile.resolvedAt = Date.now();

  if (
    ["damage", "heal", "resurrect", "buff"].includes(projectile.kind) &&
    typeof projectile.nextStreak === "number"
  ) {
    const source = session.players.get(projectile.source);
    if (source) {
      source.correctStreak = projectile.nextStreak;
    }
  }

  if (projectile.kind === "damage" && projectile.target === "boss") {
    if (projectile.willHit && session.boss.hp > 0) {
      const before = session.boss.hp;
      session.boss.hp = Math.max(0, session.boss.hp - projectile.amount);
      const actualDamage = Math.round(before - session.boss.hp);
      const source = session.players.get(projectile.source);
      if (source) {
        source.totalDamage += actualDamage;
      }
      addTypingBossLog(
        session,
        `${projectile.sourceName} hit ${session.boss.name} for ${actualDamage}.`,
        "hit"
      );

      if (session.boss.hp <= 0) {
        session.status = "victory";
        session.closedAt = Date.now();
        clearTimeout(session.bossTimer);
        addTypingBossLog(session, `${session.boss.name} was defeated!`, "victory");
      }
    } else {
      addTypingBossLog(
        session,
        `${projectile.sourceName}'s ${projectile.moveLabel} missed.`,
        "miss"
      );
    }
  } else if (projectile.kind === "heal") {
    const target = session.players.get(projectile.target);
    if (projectile.willHit && target && target.hp > 0) {
      const before = target.hp;
      target.hp = Math.min(target.maxHp, target.hp + projectile.amount);
      const healed = Math.round(target.hp - before);
      const source = session.players.get(projectile.source);
      if (source) {
        source.totalHealing += healed;
      }
      addTypingBossLog(
        session,
        `${projectile.sourceName} restored ${healed} HP to ${target.name}.`,
        "heal"
      );
    } else {
      addTypingBossLog(session, `${projectile.sourceName}'s heal fizzled.`, "miss");
    }
  } else if (projectile.kind === "resurrect") {
    const target = session.players.get(projectile.target);
    if (projectile.willHit && target && target.hp <= 0) {
      target.hp = Math.max(1, Math.ceil(target.maxHp / 2));
      const source = session.players.get(projectile.source);
      if (source) {
        source.totalHealing += target.hp;
        source.totalResurrections = (source.totalResurrections || 0) + 1;
      }
      addTypingBossLog(
        session,
        `${projectile.sourceName} resurrected ${target.name} with ${target.hp} HP.`,
        "heal"
      );
    } else {
      addTypingBossLog(session, `${projectile.sourceName}'s resurrection failed.`, "miss");
    }
  } else if (projectile.kind === "buff") {
    const target = session.players.get(projectile.target);
    const source = session.players.get(projectile.source);
    if (projectile.willHit && target) {
      if (projectile.buffType === "attack") {
        target.nextAttackMultiplier = Math.max(
          target.nextAttackMultiplier || 1,
          projectile.multiplier || 1.5
        );
        if (source) {
          source.totalBuffs = (source.totalBuffs || 0) + 1;
        }
        addTypingBossLog(
          session,
          `${projectile.sourceName} buffed ${target.name}'s next attack by 50%.`,
          "heal"
        );
      } else if (projectile.buffType === "evade") {
        target.evadeReady = true;
        if (source) {
          source.totalBuffs = (source.totalBuffs || 0) + 1;
        }
        addTypingBossLog(
          session,
          `${target.name} prepared a special evade.`,
          "evade"
        );
      }
    } else {
      addTypingBossLog(session, `${projectile.sourceName}'s buff fizzled.`, "miss");
    }
  } else if (projectile.kind === "boss") {
    const target = session.players.get(projectile.target);
    if (projectile.willHit && target && target.hp > 0) {
      target.hp = Math.max(0, target.hp - projectile.amount);
      target.bossHitsTaken = (target.bossHitsTaken || 0) + 1;
      addTypingBossLog(
        session,
        `${session.boss.name}'s ${projectile.moveLabel} hit ${target.name} for ${projectile.amount}.`,
        "danger"
      );
    } else if (target) {
      if (projectile.evadeType === "special") {
        target.evadeReady = false;
        target.specialEvades = (target.specialEvades || 0) + 1;
        addTypingBossLog(
          session,
          `${target.name} special-evaded ${session.boss.name}'s ${projectile.moveLabel}.`,
          "evade"
        );
      } else {
        target.regularBossMisses = (target.regularBossMisses || 0) + 1;
        addTypingBossLog(
          session,
          `${target.name} dodged ${session.boss.name}'s ${projectile.moveLabel}.`,
          "miss"
        );
      }
    }

  }

  const anyAlive = [...session.players.values()].some((player) => player.hp > 0);
  const pendingResurrection = session.projectiles.some(
    (item) => item.kind === "resurrect" && !item.resolvedAt && item.willHit
  );
  if (
    !anyAlive &&
    session.players.size > 0 &&
    session.status === "active" &&
    !pendingResurrection
  ) {
    session.status = "defeat";
    session.closedAt = Date.now();
    clearTimeout(session.bossTimer);
    addTypingBossLog(session, "The party was knocked out.", "danger");
  }

  broadcastTypingBossSession(session);
}

function createTypingBossProjectile(session, projectile) {
  const fullProjectile = {
    id: randomHex(12),
    startedAt: Date.now(),
    impactAt: Date.now() + projectile.travelMs,
    resolvedAt: null,
    ...projectile,
  };

  session.projectiles.push(fullProjectile);
  scheduleTypingBossTimer(
    session,
    () => resolveTypingBossProjectile(session, fullProjectile.id),
    projectile.travelMs
  );

  return fullProjectile;
}

function triggerTypingBossAttack(session) {
  if (session.status !== "active" || session.boss.hp <= 0) {
    return;
  }

  const alivePlayers = [...session.players.values()].filter((player) => player.hp > 0);
  const now = Date.now();
  const bossProfile = normalizeTypingBossProfile(session.boss.id);
  const move = bossProfile.moves[Math.floor(Math.random() * bossProfile.moves.length)];

  session.boss.currentMoveLabel = move.label;
  session.boss.lastAttackAt = now;
  session.boss.nextAttackAt = now + session.boss.attackIntervalMs;

  alivePlayers.forEach((player) => {
    const accuracy = typingBossAccuracy(player);
    const baseHitChance = clampNumber(1 - accuracy + accuracy / 2, 0.35, 0.95);
    const hitChance =
      player.classId === "rogue" && player.evadeReady
        ? baseHitChance / 2
        : baseHitChance;
    const roll = Math.random();
    const willHit = roll < hitChance;
    const evadeType =
      !willHit && player.classId === "rogue" && player.evadeReady && roll < baseHitChance
        ? "special"
        : "regular";
    const amount = randomInt(move.damageMin, move.damageMax);

    createTypingBossProjectile(session, {
      source: "boss",
      sourceName: session.boss.name,
      target: player.code,
      kind: "boss",
      bossId: session.boss.id,
      moveId: move.id,
      moveLabel: move.label,
      amount,
      willHit,
      evadeType: willHit ? null : evadeType,
      travelMs: TYPING_BOSS_BOSS_TRAVEL_MS,
    });
  });

  addTypingBossLog(session, `${session.boss.name} launched ${move.label}.`, "danger");
  broadcastTypingBossSession(session);
  scheduleTypingBossAttack(session);
}

function closeTypingBossSessionsForShutdown() {
  const now = Date.now();

  for (const session of typingBossSessions.values()) {
    if (session.status === "setup" || session.status === "active") {
      session.status = "closed";
      session.closedAt = session.closedAt || now;
      broadcastTypingBossSession(session);
    }

    for (const subscriber of [...session.subscribers]) {
      clearInterval(subscriber.pingTimer);
      subscriber.res.end();
      session.subscribers.delete(subscriber);
    }

    clearTypingBossTimers(session);
  }
}

async function handleCreateTypingBossSession(req, res) {
  const body = await readJson(req);
  const session = createTypingBossSession(body);

  sendJson(res, 201, {
    session: getTypingBossSnapshot(session, { includeHostToken: true }),
    sessionId: session.id,
    hostToken: session.hostToken,
  });
}

function handleTypingBossEvents(req, res, session, url) {
  const auth = authenticateTypingBoss(session, url);
  if (!auth) {
    sendError(res, 401, "A valid host token or player code is required.");
    return;
  }

  if (auth.role === "player") {
    const player = session.players.get(auth.actorCode);
    if (player) {
      player.lastSeenAt = Date.now();
      broadcastTypingBossSession(session);
    }
  }

  setCors(res);
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  const subscriber = {
    res,
    auth,
    pingTimer: setInterval(() => {
      res.write(": ping\n\n");
    }, 25 * 1000),
  };

  session.subscribers.add(subscriber);
  writeTypingBossEvent(subscriber, session);

  req.on("close", () => {
    clearInterval(subscriber.pingTimer);
    session.subscribers.delete(subscriber);
  });
}

async function handleCreateTypingBossParticipant(req, res, session) {
  const body = await readJson(req);

  if (session.status === "closed" || session.status === "victory" || session.status === "defeat") {
    sendError(res, 409, "This boss game is no longer accepting players.");
    return;
  }

  if (session.status === "expired") {
    sendError(res, 410, "This boss game has expired.");
    return;
  }

  const code = createTypingBossPlayerCode(session);
  const classId = normalizeTypingBossClass(body.classId);
  if (!classId) {
    sendError(
      res,
      400,
      `Choose a valid class: ${TYPING_BOSS_CLASS_IDS.map(
        (id) => TYPING_BOSS_CLASSES[id].label
      ).join(", ")}.`
    );
    return;
  }

  const heroClass = TYPING_BOSS_CLASSES[classId] || TYPING_BOSS_CLASSES.cleric;
  const player = {
    code,
    name: normalizeTypingBossPlayerName(body.name, heroClass.label),
    classId,
    hp: heroClass.maxHp || TYPING_BOSS_PLAYER_MAX_HP,
    maxHp: heroClass.maxHp || TYPING_BOSS_PLAYER_MAX_HP,
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
    averageDps: 0,
    totalKeystrokes: 0,
    correctKeystrokes: 0,
    correctStreak: 0,
    totalDamage: 0,
    totalHealing: 0,
    totalBuffs: 0,
    totalResurrections: 0,
    bossHitsTaken: 0,
    regularBossMisses: 0,
    specialEvades: 0,
    turnsTaken: 0,
    nextAttackMultiplier: 1,
    evadeReady: false,
    monkSpecialCharge: 0,
  };

  session.players.set(code, player);
  addTypingBossLog(session, `${player.name} joined as ${heroClass.label}.`, "info");
  broadcastTypingBossSession(session);

  sendJson(res, 201, {
    code,
    session: getTypingBossSnapshot(session, { includeChallengesFor: code }),
  });
}

async function handleVerifyTypingBossParticipant(req, res, session) {
  const body = await readJson(req);
  const code = normalizeTypingBossPlayerCode(body.code);
  const player = session.players.get(code);

  if (!player) {
    sendError(res, 401, "That player code is not valid for this boss game.");
    return;
  }

  player.lastSeenAt = Date.now();
  broadcastTypingBossSession(session);
  sendJson(res, 200, {
    code,
    session: getTypingBossSnapshot(session, { includeChallengesFor: code }),
  });
}

async function handleStartTypingBossSession(req, res, session, url) {
  const body = await readJson(req);
  const auth = authenticateTypingBoss(session, url, body);
  if (!requireTypingBossHost(res, session, auth)) {
    return;
  }

  if (session.status === "closed") {
    sendError(res, 409, "This boss game has already been closed.");
    return;
  }

  if (session.players.size === 0) {
    sendError(res, 409, "At least one player must join before the fight starts.");
    return;
  }

  const now = Date.now();
  session.status = "active";
  session.boss.lastAttackAt = now;
  session.boss.nextAttackAt = now + session.boss.attackIntervalMs;
  addTypingBossLog(session, "The fight has begun.", "info");
  broadcastTypingBossSession(session);
  scheduleTypingBossAttack(session);
  sendJson(res, 200, { session: getTypingBossSnapshotForAuth(session, auth) });
}

async function handleCloseTypingBossSession(req, res, session, url) {
  const body = await readJson(req);
  const auth = authenticateTypingBoss(session, url, body);
  if (!requireTypingBossHost(res, session, auth)) {
    return;
  }

  session.status = "closed";
  session.closedAt = Date.now();
  clearTimeout(session.bossTimer);
  addTypingBossLog(session, "The host closed the fight.", "info");
  broadcastTypingBossSession(session);
  sendJson(res, 200, { session: getTypingBossSnapshotForAuth(session, auth) });
}

async function handleCreateTypingBossChallenge(req, res, session, url) {
  const body = await readJson(req);
  const auth = authenticateTypingBoss(session, url, body);

  if (!auth || auth.role !== "player") {
    sendError(res, 403, "A valid player code is required.");
    return;
  }

  if (!requireTypingBossActive(res, session)) {
    return;
  }

  const player = session.players.get(auth.actorCode);
  if (!player || player.hp <= 0) {
    sendError(res, 409, "Defeated players cannot take actions yet.");
    return;
  }

  const move = typingBossMoveForPlayer(player, body.moveId);
  if (body.moveId === "special" && !typingBossSpecialReady(player)) {
    sendError(
      res,
      409,
      player.classId === "monk"
        ? "The monk special is ready every third turn."
        : "That special is already active."
    );
    return;
  }

  const targetCode = typingBossResolveTarget(session, player, move, body.targetCode);
  if (!targetCode) {
    sendError(res, 409, "That move needs a valid target.");
    return;
  }
  const question = pickTypingBossQuestion(move);
  const challenge = {
    id: randomHex(12),
    playerCode: player.code,
    moveId: move.id,
    requestedMoveId: body.moveId,
    targetCode,
    questionId: question.id,
    questionText: question.question,
    correctAnswer: question.correctAnswer,
    createdAt: Date.now(),
  };

  session.challenges.set(challenge.id, challenge);
  player.lastSeenAt = Date.now();

  sendJson(res, 201, {
    challenge: {
      id: challenge.id,
      moveId: move.id,
      moveLabel: move.label,
      movePower: move.power,
      kind: move.kind,
      targetCode,
      questionId: question.id,
      question: question.question,
      answers: question.answers,
      difficulty: move.difficulty,
      createdAt: challenge.createdAt,
    },
    session: getTypingBossSnapshot(session, { includeChallengesFor: player.code }),
  });
}

async function handleSubmitTypingBossAction(req, res, session, url) {
  const body = await readJson(req);
  const auth = authenticateTypingBoss(session, url, body);

  if (!auth || auth.role !== "player") {
    sendError(res, 403, "A valid player code is required.");
    return;
  }

  if (!requireTypingBossActive(res, session)) {
    return;
  }

  const player = session.players.get(auth.actorCode);
  if (!player || player.hp <= 0) {
    sendError(res, 409, "Defeated players cannot take actions yet.");
    return;
  }

  const challenge = session.challenges.get(toSafeString(body.challengeId));
  if (!challenge || challenge.playerCode !== player.code) {
    sendError(res, 404, "That typing challenge is no longer active.");
    return;
  }

  const question = typingBossQuestionById(challenge.questionId);
  if (!question) {
    sendError(res, 400, "That question is no longer available.");
    return;
  }

  session.challenges.delete(challenge.id);

  const move =
    TYPING_BOSS_MOVES[challenge.moveId] ||
    typingBossMoveForPlayer(player, challenge.requestedMoveId);
  const answerText = toSafeString(body.answerText);
  const isCorrect =
    normalizeTypedAnswer(answerText) === normalizeTypedAnswer(challenge.correctAnswer);
  const acceptedCharacters = clampNumber(
    Number(body.acceptedCharacters) || 0,
    0,
    1000
  );
  const mistakes = clampNumber(Number(body.mistakes) || 0, 0, 1000);
  const totalKeystrokes = Math.max(acceptedCharacters + mistakes, 1);
  const durationSec = clampNumber((Number(body.durationMs) || 1000) / 1000, 0.6, 180);
  const effectiveDps = acceptedCharacters / durationSec;
  const previousAverage = player.averageDps || effectiveDps || 1;
  const speedMultiplier = typingBossSpeedMultiplier(player, effectiveDps, previousAverage);
  const attackAccuracy = clampNumber(acceptedCharacters / totalKeystrokes, 0, 1);
  const accuracyMultiplier = typingBossAccuracyBonus(attackAccuracy);
  const nextStreak = isCorrect ? player.correctStreak + 1 : Math.floor(player.correctStreak / 2);
  const streakMultiplier = isCorrect ? 1 + nextStreak * 0.05 : 1;
  const buffMultiplier =
    move.kind === "damage" ? player.nextAttackMultiplier || 1 : 1;
  const typedCharBase = Math.max(
    challenge.questionText.length + answerText.length,
    challenge.questionText.length + challenge.correctAnswer.length
  );
  const amount = Math.max(
    1,
    Math.round(
      typedCharBase *
        move.power *
        speedMultiplier *
        accuracyMultiplier *
        streakMultiplier *
        buffMultiplier
    )
  );
  const targetCode = challenge.targetCode;
  const isHeal = move.kind === "heal-self" || move.kind === "heal-other";
  const isResurrect = move.kind === "resurrect";
  const isBuff = move.kind === "buff-other" || move.kind === "evade-self";
  const targetPlayer =
    isHeal || isResurrect || isBuff ? session.players.get(targetCode) : null;
  const willHit =
    isCorrect &&
    (move.kind === "damage" ||
      (isHeal && Boolean(targetPlayer && targetPlayer.hp > 0)) ||
      (isResurrect && Boolean(targetPlayer && targetPlayer.hp <= 0)) ||
      (move.kind === "buff-other" && Boolean(targetPlayer && targetPlayer.hp > 0)) ||
      (move.kind === "evade-self" && Boolean(targetPlayer && targetPlayer.code === player.code)));

  player.totalKeystrokes += totalKeystrokes;
  player.correctKeystrokes += acceptedCharacters;
  player.averageDps = player.averageDps
    ? player.averageDps * 0.78 + effectiveDps * 0.22
    : effectiveDps;
  player.lastSeenAt = Date.now();
  advanceTypingBossPlayerTurn(player, move);

  if (move.kind === "damage" && buffMultiplier > 1) {
    player.nextAttackMultiplier = 1;
  }

  const projectileKind = isResurrect ? "resurrect" : isBuff ? "buff" : isHeal ? "heal" : "damage";
  const projectileAmount = isResurrect && targetPlayer
    ? Math.ceil(targetPlayer.maxHp / 2)
    : isBuff
    ? move.kind === "buff-other"
      ? 50
      : 0
    : willHit
    ? amount
    : 0;

  const projectile = createTypingBossProjectile(session, {
    source: player.code,
    sourceName: player.name,
    target: move.kind === "damage" ? "boss" : targetCode,
    kind: projectileKind,
    moveId: move.id,
    moveLabel: move.label,
    amount: willHit ? projectileAmount : 0,
    willHit,
    nextStreak,
    buffType:
      move.kind === "buff-other"
        ? "attack"
        : move.kind === "evade-self"
        ? "evade"
        : null,
    multiplier: move.kind === "buff-other" ? 1.5 : null,
    travelMs: TYPING_BOSS_PROJECTILE_TRAVEL_MS,
  });

  addTypingBossLog(
    session,
    `${player.name} launched ${move.label}.`,
    isHeal || isResurrect || isBuff ? "heal" : "info"
  );
  broadcastTypingBossSession(session);

  sendJson(res, 201, {
    projectile: getTypingBossProjectileSnapshot(projectile),
    stats: {
      correct: isCorrect,
      effectiveDps: Number(effectiveDps.toFixed(2)),
      speedMultiplier: Number(speedMultiplier.toFixed(2)),
      accuracy: Number(attackAccuracy.toFixed(3)),
      streak: nextStreak,
    },
    session: getTypingBossSnapshot(session, { includeChallengesFor: player.code }),
  });
}

async function handleTypingBossRequest(req, res, url, parts) {
  if (parts[2] !== "sessions") {
    sendError(res, 404, "Not found.");
    return;
  }

  if (req.method === "POST" && parts.length === 3) {
    await handleCreateTypingBossSession(req, res);
    return;
  }

  if (req.method === "GET" && parts.length === 4 && parts[3] === "active") {
    const activeSessions = [...typingBossSessions.values()]
      .filter((session) => session.status === "setup" || session.status === "active")
      .map((session) => ({
        id: session.id,
        name: session.name,
        status: session.status,
        playerCount: session.players.size,
        bossName: session.boss.name,
        bossDifficulty: session.boss.difficulty,
        bossHp: session.boss.hp,
        bossMaxHp: session.boss.maxHp,
        createdAt: new Date(session.createdAt).toISOString(),
        remainingSeconds: Math.max(0, Math.ceil((session.expiresAt - Date.now()) / 1000)),
      }));
    sendJson(res, 200, { sessions: activeSessions });
    return;
  }

  const session = findTypingBossSession(parts[3]);
  if (!session) {
    sendJson(res, 404, {
      error: "That boss game was not found.",
      sessionClosed: true,
    });
    return;
  }

  if (req.method === "GET" && parts.length === 4) {
    const auth = authenticateTypingBoss(session, url);
    if (!auth) {
      sendError(res, 401, "A valid host token or player code is required.");
      return;
    }
    sendJson(res, 200, { session: getTypingBossSnapshotForAuth(session, auth) });
    return;
  }

  if (req.method === "GET" && parts[4] === "events") {
    handleTypingBossEvents(req, res, session, url);
    return;
  }

  if (req.method === "POST" && parts[4] === "participants") {
    await handleCreateTypingBossParticipant(req, res, session);
    return;
  }

  if (req.method === "POST" && parts[4] === "verify") {
    await handleVerifyTypingBossParticipant(req, res, session);
    return;
  }

  if (req.method === "POST" && parts[4] === "start") {
    await handleStartTypingBossSession(req, res, session, url);
    return;
  }

  if (req.method === "POST" && parts[4] === "close") {
    await handleCloseTypingBossSession(req, res, session, url);
    return;
  }

  if (req.method === "POST" && parts[4] === "challenge") {
    await handleCreateTypingBossChallenge(req, res, session, url);
    return;
  }

  if (req.method === "POST" && parts[4] === "actions") {
    await handleSubmitTypingBossAction(req, res, session, url);
    return;
  }

  sendError(res, 404, "Not found.");
}

function createSession(body) {
  const id = createSessionId();
  const now = Date.now();
  const type = normalizeSessionType(body.type);
  const columns =
    type === "one-q-many-a"
      ? [
          {
            id: "questions",
            title: "Questions",
          },
          {
            id: "answers",
            title: "Answers",
          },
        ]
      : [
          {
            id: "good-at",
            title: normalizeColumnTitle(body.columnTitles?.[0], "Good At"),
          },
          {
            id: "not-good-at",
            title: normalizeColumnTitle(body.columnTitles?.[1], "Not Good At"),
          },
        ];

  const session = {
    id,
    hostToken: randomHex(32),
    name: normalizeBoardName(body.name || body.boardName, "Class Board"),
    type,
    status: "setup",
    prompt:
      type === "one-q-many-a"
        ? normalizePrompt(body.prompt, "What questions do you have?")
        : "",
    createdAt: now,
    expiresAt: now + ONE_HOUR_MS,
    closedAt: null,
    columns,
    posts: [],
    participants: new Map(),
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
    session: getSnapshot(session, { includeParticipants: true }),
    sessionId: session.id,
    hostToken: session.hostToken,
  });
}

function handleListActiveSessions(res) {
  const activeSessions = [];

  for (const session of sessions.values()) {
    refreshSessionStatus(session);
    if (session.status === "setup" || session.status === "active") {
      activeSessions.push(getSessionSummary(session));
    }
  }

  activeSessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  sendJson(res, 200, { sessions: activeSessions });
}

function handleEvents(req, res, session, url) {
  const auth = authenticate(session, url);
  if (!auth) {
    sendError(res, 401, "A valid host token or participant code is required.");
    return;
  }

  if (auth.role === "participant") {
    const participant = session.participants.get(auth.actorCode);
    if (participant) {
      participant.joinedAt = participant.joinedAt || Date.now();
      participant.lastSeenAt = Date.now();
      broadcastSession(session);
    }
  }

  setCors(res);
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  const subscriber = {
    res,
    auth,
    pingTimer: setInterval(() => {
      res.write(": ping\n\n");
    }, 25 * 1000),
  };

  session.subscribers.add(subscriber);
  writeSessionEvent(subscriber, session);

  req.on("close", () => {
    clearInterval(subscriber.pingTimer);
    session.subscribers.delete(subscriber);
  });
}

async function handleCreateParticipant(req, res, session) {
  const code = createParticipantCode(session);
  const avatarUrl = createAvatarUrl(code);
  session.participants.set(code, {
    code,
    avatarUrl,
    showMe: false,
    postTimestamps: [],
    issuedAt: Date.now(),
    joinedAt: null,
    lastSeenAt: null,
  });
  broadcastSession(session);

  sendJson(res, 201, {
    code,
    avatarUrl,
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

  const participant = session.participants.get(code);
  participant.joinedAt = participant.joinedAt || Date.now();
  participant.lastSeenAt = Date.now();
  broadcastSession(session);

  sendJson(res, 200, {
    code,
    avatarUrl: participant.avatarUrl,
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
  sendJson(res, 200, { session: getSnapshotForAuth(session, auth) });
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
  sendJson(res, 200, { session: getSnapshotForAuth(session, auth) });
}

async function handleRenameSession(req, res, session, url) {
  const body = await readJson(req);
  const auth = authenticate(session, url, body);
  if (!requireHost(res, session, auth)) {
    return;
  }

  if (session.status === "closed") {
    sendError(res, 409, "Closed sessions cannot be renamed.");
    return;
  }

  session.name = normalizeBoardName(body.name, session.name);
  broadcastSession(session);
  sendJson(res, 200, { session: getSnapshotForAuth(session, auth) });
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
  sendJson(res, 200, { session: getSnapshotForAuth(session, auth) });
}

async function handleUpdateShowMe(req, res, session, url) {
  const body = await readJson(req);
  const auth = authenticate(session, url, body);

  if (!auth || auth.role !== "participant") {
    sendError(res, 403, "A valid participant alias is required.");
    return;
  }

  const participant = session.participants.get(auth.actorCode);
  if (!participant) {
    sendError(res, 401, "A valid participant alias is required.");
    return;
  }

  participant.showMe = Boolean(body.showMe);
  participant.lastSeenAt = Date.now();
  broadcastSession(session);
  sendJson(res, 200, { session: getSnapshotForAuth(session, auth) });
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

  let postType = "reflection";
  let parentPostId = null;

  if (session.type === "one-q-many-a") {
    if (column.id === "questions") {
      postType = "question";
    } else if (column.id === "answers") {
      const parent = findPost(session, body.parentPostId);
      if (!parent || parent.postType !== "question") {
        sendError(res, 400, "Choose a question before adding an answer.");
        return;
      }
      postType = "answer";
      parentPostId = parent.id;
    } else {
      sendError(res, 400, "Choose a valid question or answer column.");
      return;
    }
  }

  const text = normalizePostText(body.text);
  if (!text) {
    sendError(res, 400, "Post text is required.");
    return;
  }

  const throttleError = checkPostThrottle(session, auth, text);
  if (throttleError) {
    sendError(res, throttleError.status, throttleError.message);
    return;
  }

  const post = {
    id: randomHex(12),
    columnId: column.id,
    text,
    authorCode: auth.actorCode,
    authorAvatarUrl: avatarUrlForCode(session, auth.actorCode),
    postType,
    parentPostId,
    restrictedPlusOneCodes: auth.role === "host" ? [] : [auth.actorCode],
    createdAt: Date.now(),
    plusOnes: [],
  };

  session.posts.push(post);
  recordAcceptedPost(session, auth);
  broadcastSession(session);
  sendJson(res, 201, { post, session: getSnapshotForAuth(session, auth) });
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
  sendJson(res, 200, { post, session: getSnapshotForAuth(session, auth) });
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

  const post = session.posts[index];
  const removeIds = new Set([post.id]);
  if (session.type === "one-q-many-a" && post.postType === "question") {
    session.posts.forEach((item) => {
      if (item.parentPostId === post.id) {
        removeIds.add(item.id);
      }
    });
  }

  session.posts = session.posts.filter((item) => !removeIds.has(item.id));
  broadcastSession(session);
  sendJson(res, 200, { session: getSnapshotForAuth(session, auth) });
}

async function handleFlagPost(req, res, session, url, postId) {
  const body = await readJson(req);
  const auth = authenticate(session, url, body);
  if (!requireHost(res, session, auth)) {
    return;
  }

  const post = findPost(session, postId);
  if (!post) {
    sendError(res, 404, "That post was not found.");
    return;
  }

  const removeIds = new Set([post.id]);
  if (session.type === "one-q-many-a" && post.postType === "question") {
    session.posts.forEach((item) => {
      if (item.parentPostId === post.id) {
        removeIds.add(item.id);
      }
    });
  }

  const flaggedAt = Date.now();
  const flaggedPosts = session.posts
    .filter((item) => removeIds.has(item.id))
    .map((item) => ({
      ...item,
      plusOnes: [...item.plusOnes],
      sessionId: session.id,
      sessionName: session.name,
      sessionType: session.type,
      sessionCreatedAt: new Date(session.createdAt).toISOString(),
      prompt: session.prompt,
      flaggedAt: new Date(flaggedAt).toISOString(),
      flaggedBy: auth.actorCode,
    }));

  session.posts = session.posts.filter((item) => !removeIds.has(item.id));
  broadcastSession(session);
  sendJson(res, 200, {
    flaggedPosts,
    session: getSnapshotForAuth(session, auth),
  });
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

  const restrictedCodes = post.restrictedPlusOneCodes || [post.authorCode];
  if (
    session.type === "good-not-good" &&
    auth.role !== "host" &&
    restrictedCodes.includes(auth.actorCode)
  ) {
    sendError(res, 403, "Students cannot +1 their own post or copied post.");
    return;
  }

  if (!post.plusOnes.includes(auth.actorCode)) {
    post.plusOnes.push(auth.actorCode);
    broadcastSession(session);
  }

  sendJson(res, 200, { post, session: getSnapshotForAuth(session, auth) });
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

  if (session.type === "one-q-many-a") {
    sendError(res, 400, "This session type does not support copying posts.");
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
    authorAvatarUrl: avatarUrlForCode(session, auth.actorCode),
    copiedFromPostId: source.id,
    sourceAuthorCode: source.sourceAuthorCode || source.authorCode,
    restrictedPlusOneCodes: [
      ...new Set([
        ...(source.restrictedPlusOneCodes || [source.authorCode]),
        ...(auth.role === "host" ? [] : [auth.actorCode]),
      ]),
    ],
    createdAt: Date.now(),
    plusOnes: [],
  };

  session.posts.push(post);
  broadcastSession(session);
  sendJson(res, 201, { post, session: getSnapshotForAuth(session, auth) });
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
      sendJson(res, 200, {
        ok: true,
        service: "cougar-classroom-backend",
        features: ["padlet-sessions", "typing-boss"],
      });
      return;
    }

    if (parts[0] === "api" && parts[1] === "typing-boss") {
      await handleTypingBossRequest(req, res, url, parts);
      return;
    }

    if (parts[0] !== "api" || parts[1] !== "sessions") {
      sendError(res, 404, "Not found.");
      return;
    }

    if (req.method === "GET" && parts.length === 3 && parts[2] === "active") {
      handleListActiveSessions(res);
      return;
    }

    if (req.method === "POST" && parts.length === 2) {
      await handleCreateSession(req, res);
      return;
    }

    const session = findSession(parts[2]);
    if (!session) {
      sendJson(res, 404, {
        error: "That session was not found.",
        sessionClosed: true,
      });
      return;
    }

    if (req.method === "GET" && parts.length === 3) {
      const auth = authenticate(session, url);
      if (!auth) {
        sendError(res, 401, "A valid host token or participant code is required.");
        return;
      }
      sendJson(res, 200, { session: getSnapshotForAuth(session, auth) });
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

    if (req.method === "PATCH" && parts[3] === "name") {
      await handleRenameSession(req, res, session, url);
      return;
    }

    if (req.method === "PATCH" && parts[3] === "columns") {
      await handleRenameColumns(req, res, session, url);
      return;
    }

    if (req.method === "PATCH" && parts[3] === "show-me") {
      await handleUpdateShowMe(req, res, session, url);
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

      if (req.method === "POST" && parts[5] === "flag") {
        await handleFlagPost(req, res, session, url, postId);
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
const statusSweepTimer = setInterval(() => {
  refreshAllSessionStatuses();
  refreshAllTypingBossSessionStatuses();
}, 15 * 1000);
statusSweepTimer.unref?.();

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Cougar classroom backend could not start because port ${PORT} is already in use.`
    );
    console.error(`Stop the process using ${PORT}, or set APP_SERVER_PORT.`);
    process.exit(1);
  }

  console.error("Cougar classroom backend failed to start.", error);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`Cougar classroom backend listening on http://localhost:${PORT}`);
});

function shutdown(signal) {
  console.log(
    `Cougar classroom backend received ${signal}; closing active sessions.`
  );
  clearInterval(statusSweepTimer);
  closeSessionsForShutdown();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref?.();
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
