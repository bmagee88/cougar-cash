const crypto = require("crypto");
const {
  COLORS,
  HABITAT_LABELS,
  LURES,
  RETRIEVES,
  adjacentTileIds,
  buildActionDeck,
  buildWeatherDeck,
  calculateHookSet,
  calculateNibble,
  canMoveToTile,
  castRollToCell,
  chooseHabitatFromCell,
  createBattleState,
  createRng,
  findTile,
  fullFishCard,
  generateFishPopulation,
  generateLake,
  generateMood,
  moonForRound,
  publicFishCard,
  randomInt,
  resolveBattleStep,
  resolveBiteBox,
  resolveHookSetRoll,
  resolveNibbleRoll,
  resolveSpookCheck,
  seasonForRound,
  shuffleCopy,
} = require("../src/PatternGame/patternCore");

const PATTERN_PREFIX = "pattern";
const PATTERN_PLAYER_PREFIX = "angler";
const PATTERN_SESSION_MS = 3 * 60 * 60 * 1000;
const PATTERN_DELETE_EXPIRED_AFTER_MS = 60 * 1000;
const MAX_PATTERN_PLAYERS = 4;
const MAX_HAND_SIZE = 5;
const ROLL_ANIMATION_MS = 3000;
const patternSessions = new Map();

function randomHex(length) {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length)
    .toUpperCase();
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
  return raw.trim() ? JSON.parse(raw) : {};
}

function toSafeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePatternSessionId(value) {
  const raw = toSafeString(value);
  const hex = raw
    .replace(new RegExp(`^${PATTERN_PREFIX}`, "i"), "")
    .toUpperCase()
    .replace(/[^0-9A-F]/g, "")
    .slice(0, 3);
  return hex.length === 3 ? `${PATTERN_PREFIX}${hex}` : raw;
}

function normalizePatternPlayerCode(value) {
  const raw = toSafeString(value);
  const hex = raw
    .replace(new RegExp(`^${PATTERN_PLAYER_PREFIX}`, "i"), "")
    .toUpperCase()
    .replace(/[^0-9A-F]/g, "")
    .slice(0, 4);
  return hex.length === 4 ? `${PATTERN_PLAYER_PREFIX}${hex}` : raw;
}

function normalizeName(value, fallback) {
  const cleaned = toSafeString(value).replace(/\s+/g, " ").slice(0, 28);
  return cleaned || fallback;
}

function normalizeLakeWidth(value) {
  const width = Number(value);
  return [2, 3, 4].includes(width) ? width : 3;
}

function createPatternSessionId() {
  for (let attempt = 0; attempt < 256; attempt += 1) {
    const id = `${PATTERN_PREFIX}${randomHex(3)}`;
    if (!patternSessions.has(id)) return id;
  }
  throw new Error("No Pattern game ids are available right now.");
}

function createPatternPlayerCode(session) {
  for (let attempt = 0; attempt < 256; attempt += 1) {
    const code = `${PATTERN_PLAYER_PREFIX}${randomHex(4)}`;
    if (!session.players.has(code)) return code;
  }
  throw new Error("No angler codes are available for this game.");
}

function createPatternSession(body = {}) {
  const now = Date.now();
  const id = createPatternSessionId();
  const session = {
    id,
    hostToken: randomHex(32),
    name: normalizeName(body.name || body.gameName, "The Pattern"),
    status: "setup",
    createdAt: now,
    expiresAt: now + PATTERN_SESSION_MS,
    closedAt: null,
    lakeWidth: normalizeLakeWidth(body.lakeWidth),
    seed: toSafeString(body.seed),
    debug: Boolean(body.debug),
    rng: createRng(body.seed || `${id}-${randomHex(8)}`),
    players: new Map(),
    playerOrder: [],
    lake: null,
    fish: new Map(),
    actionDeck: [],
    actionDiscard: [],
    weatherDeck: [],
    weatherDiscard: [],
    round: 0,
    season: "",
    moon: "",
    weather: "",
    activeEvent: null,
    firstPlayerIndex: 0,
    turnCursor: 0,
    turnNumber: 0,
    turn: null,
    attempt: null,
    battle: null,
    results: null,
    log: [],
    subscribers: new Set(),
  };

  session.expireTimer = setTimeout(() => expirePatternSession(session), PATTERN_SESSION_MS);
  session.expireTimer.unref?.();
  addLog(session, "Pattern game created.", "info");
  patternSessions.set(id, session);
  return session;
}

function findPatternSession(id) {
  const session = patternSessions.get(normalizePatternSessionId(id));
  if (session) refreshPatternSessionStatus(session);
  return session;
}

function refreshPatternSessionStatus(session) {
  if (
    Date.now() >= session.expiresAt &&
    !["closed", "expired", "complete"].includes(session.status)
  ) {
    expirePatternSession(session);
  }
}

function refreshAllPatternSessionStatuses() {
  for (const session of [...patternSessions.values()]) {
    refreshPatternSessionStatus(session);
    if (
      ["closed", "expired", "complete"].includes(session.status) &&
      session.closedAt &&
      Date.now() - session.closedAt > PATTERN_DELETE_EXPIRED_AFTER_MS
    ) {
      patternSessions.delete(session.id);
    }
  }
}

function expirePatternSession(session) {
  if (!patternSessions.has(session.id) || session.status === "expired") return;
  session.status = "expired";
  session.closedAt = Date.now();
  clearTimeout(session.expireTimer);
  addLog(session, "The game expired.", "danger");
  broadcastPatternSession(session);
}

function closePatternSessionsForShutdown() {
  for (const session of patternSessions.values()) {
    clearTimeout(session.expireTimer);
    session.status = session.status === "setup" || session.status === "active" ? "closed" : session.status;
    session.closedAt = session.closedAt || Date.now();
    for (const subscriber of session.subscribers) {
      clearInterval(subscriber.pingTimer);
      subscriber.res.end();
    }
    session.subscribers.clear();
  }
}

function isHostToken(session, token) {
  return typeof token === "string" && token.length > 0 && token === session.hostToken;
}

function authenticate(session, url, body = {}) {
  const hostToken = body.hostToken || url.searchParams.get("hostToken");
  if (isHostToken(session, hostToken)) {
    return { role: "host", actorCode: "HOST" };
  }

  const code = normalizePatternPlayerCode(body.code || url.searchParams.get("code"));
  if (code && session.players.has(code)) {
    return { role: "player", actorCode: code };
  }

  return null;
}

function requireHost(res, session, auth) {
  if (!auth || auth.role !== "host" || !isHostToken(session, auth.actorCode === "HOST" ? session.hostToken : "")) {
    sendError(res, 403, "A valid host token is required.");
    return false;
  }
  return true;
}

function requirePlayer(res, auth) {
  if (!auth || auth.role !== "player") {
    sendError(res, 403, "A valid angler code is required.");
    return false;
  }
  return true;
}

function requireActive(session, res) {
  if (session.status !== "active") {
    sendError(res, 409, "This Pattern game is not active.");
    return false;
  }
  return true;
}

function requireActivePlayer(session, res, auth, phases = []) {
  if (!requirePlayer(res, auth)) return null;
  if (!requireActive(session, res)) return null;
  const turn = session.turn;
  if (!turn || turn.playerId !== auth.actorCode) {
    sendError(res, 403, "Only the active angler can do that right now.");
    return null;
  }
  if (phases.length > 0 && !phases.includes(turn.phase)) {
    sendError(res, 409, `That command is not available during ${turn.phase}.`);
    return null;
  }
  return session.players.get(auth.actorCode);
}

function addLog(session, message, tone = "info") {
  session.log.push({
    id: randomHex(10),
    message,
    tone,
    createdAt: new Date().toISOString(),
  });
  session.log = session.log.slice(-80);
}

function drawFromDeck(session) {
  if (session.actionDeck.length === 0) {
    session.actionDeck = shuffleCopy(session.actionDiscard, session.rng);
    session.actionDiscard = [];
  }
  return session.actionDeck.pop() || null;
}

function drawActionCard(session, player) {
  const card = drawFromDeck(session);
  if (card) {
    player.hand.push(card);
  }
  return card;
}

function drawWeather(session) {
  if (session.weatherDeck.length === 0) {
    session.weatherDeck = buildWeatherDeck(session.rng);
  }
  const weather = session.weatherDeck.pop();
  session.weatherDiscard.push(weather);
  return weather;
}

function startPatternGame(session) {
  if (session.playerOrder.length < 1) {
    throw new Error("Add at least one angler before starting.");
  }
  if (session.playerOrder.length > MAX_PATTERN_PLAYERS) {
    throw new Error("The Pattern supports 1-4 anglers.");
  }

  session.lake = generateLake(session.lakeWidth, session.rng);
  const fish = generateFishPopulation(session.rng);
  session.fish = new Map(fish.map((fishCard) => [fishCard.id, fishCard]));
  session.actionDeck = buildActionDeck(session.rng);
  session.actionDiscard = [];
  session.weatherDeck = buildWeatherDeck(session.rng);
  session.weatherDiscard = [];
  session.round = 1;
  session.moon = moonForRound(session.round);
  session.season = seasonForRound(session.round);
  session.weather = drawWeather(session);
  session.activeEvent = null;
  session.status = "active";
  session.closedAt = null;
  session.firstPlayerIndex = 0;
  session.turnCursor = 0;
  session.turnNumber = 0;
  session.attempt = null;
  session.battle = null;
  session.results = null;

  const startingTiles = session.lake.tiles
    .filter((tile) => tile.row === 1)
    .sort((a, b) => a.column - b.column);
  session.playerOrder.forEach((playerId, index) => {
    const player = session.players.get(playerId);
    player.locationTileId = startingTiles[index % startingTiles.length]?.id || session.lake.tiles[0].id;
    player.hand = [];
    player.tackleSlots = [];
    player.livewell = [];
    player.currentPresentation = null;
  });

  addLog(
    session,
    `Round 1 begins: ${session.season}, ${session.moon} Moon, ${session.weather}.`,
    "info"
  );
  startCurrentTurn(session);
}

function startCurrentTurn(session) {
  const activePlayerId =
    session.playerOrder[(session.firstPlayerIndex + session.turnCursor) % session.playerOrder.length];
  const player = session.players.get(activePlayerId);
  session.turnNumber += 1;
  const drawnCard = drawActionCard(session, player);
  session.attempt = null;
  session.battle = null;
  session.turn = {
    id: `turn-${session.turnNumber}-${randomHex(4)}`,
    playerId: activePlayerId,
    phase: drawnCard?.immediate ? "immediate" : "move",
    drawnCardId: drawnCard?.id || null,
    cast: null,
    selectedFishId: null,
    pendingFishId: null,
    waitUsed: false,
    waitBonus: 0,
    hardSet: false,
    setResult: null,
  };
  addLog(session, `${player.name} drew an Action card.`, "info");
}

function advanceTurn(session) {
  session.turnCursor += 1;
  session.attempt = null;
  session.battle = null;

  if (session.turnCursor >= session.playerOrder.length) {
    session.round += 1;
    if (session.round > 12) {
      completePatternGame(session);
      return;
    }
    session.firstPlayerIndex = (session.firstPlayerIndex + 1) % session.playerOrder.length;
    session.turnCursor = 0;
    session.activeEvent = null;
    session.moon = moonForRound(session.round);
    session.season = seasonForRound(session.round);
    session.weather = drawWeather(session);
    addLog(
      session,
      `Round ${session.round} begins: ${session.season}, ${session.moon} Moon, ${session.weather}.`,
      "info"
    );
  }

  startCurrentTurn(session);
}

function completePatternGame(session) {
  session.status = "complete";
  session.closedAt = Date.now();
  session.turn = null;
  session.attempt = null;
  session.battle = null;

  const standings = session.playerOrder.map((playerId) => {
    const player = session.players.get(playerId);
    const fishCards = player.livewell.map((slot) => session.fish.get(slot.fishId)).filter(Boolean);
    const weights = fishCards.map((fish) => fish.weight).sort((a, b) => b - a);
    return {
      playerId,
      name: player.name,
      totalWeight: Number(weights.reduce((sum, weight) => sum + weight, 0).toFixed(1)),
      weights,
      fish: fishCards.map(fullFishCard),
    };
  });

  standings.sort(compareStandings);
  const winners = standings.filter((standing) => compareStandings(standing, standings[0]) === 0);
  session.results = {
    standings,
    winners: winners.map((winner) => winner.playerId),
  };
  addLog(session, "Round 12 ended. Livewells are revealed.", "victory");
}

function compareStandings(a, b) {
  if (b.totalWeight !== a.totalWeight) return b.totalWeight - a.totalWeight;
  for (let index = 0; index < 3; index += 1) {
    const diff = (b.weights[index] || 0) - (a.weights[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function activeFishAt(session, tileId, row, column) {
  return [...session.fish.values()].find(
    (fish) =>
      fish.poolState === "active" &&
      fish.activeLocation?.tileInstanceId === tileId &&
      fish.activeLocation?.row === row &&
      fish.activeLocation?.column === column
  );
}

function availableFishForHabitat(session, habitat) {
  return [...session.fish.values()].filter(
    (fish) => fish.habitat === habitat && fish.poolState === "available"
  );
}

function activateFish(session, fish, tileId, row, column) {
  if (!Array.isArray(fish.guessHistory)) fish.guessHistory = [];
  fish.poolState = "active";
  fish.activeLocation = {
    tileInstanceId: tileId,
    row,
    column,
  };
  fish.publicId = `fish${randomHex(6)}`;
  fish.fightRevealed = false;
  fish.alert = Boolean(fish.alert);
}

function returnFishToHabitat(session, fish) {
  fish.poolState = "available";
  fish.activeLocation = null;
  fish.publicId = null;
  fish.alert = false;
  fish.fightRevealed = false;
  fish.guessHistory = [];
}

function removeActiveFishFromBoard(fish, poolState) {
  fish.poolState = poolState;
  fish.activeLocation = null;
  fish.publicId = null;
  fish.alert = false;
}

function startAttempt(session, player, fish, habitat, cell) {
  const mood = generateMood(fish, session.rng);
  const attempt = {
    id: `attempt-${randomHex(8)}`,
    playerId: player.code,
    fishId: fish.id,
    fishPublicId: fish.publicId,
    habitat,
    cell: [...cell],
    wasAlertAtStart: Boolean(fish.alert),
    moodCategory: mood.moodCategory,
    hiddenMoodOptions: mood.hiddenMoodOptions,
    declaration: null,
    matchCount: null,
    hotHit: false,
    nibbleRoll: null,
    nibbleModifier: null,
    nibbleTarget: null,
    nibbleRawModifier: null,
    nibbleDetails: [],
    nibbleSuccess: null,
    biteBoxResolved: false,
  };
  session.attempt = attempt;
  session.turn.phase = "declare";
  session.turn.selectedFishId = fish.id;
  addLog(session, `Mood revealed: ${mood.moodCategory.toUpperCase()}.`, "info");
}

function handleFishFailure(session, fish, wasAlertAtStart, reason) {
  if (!wasAlertAtStart && !fish.alert) {
    fish.alert = true;
    addLog(session, `${reason} The Fish became Alert.`, "miss");
    return;
  }

  const roll = randomInt(session.rng, 1, 6);
  const spook = resolveSpookCheck(roll);
  if (spook.spooked) {
    returnFishToHabitat(session, fish);
    addLog(session, `${reason} Spook check ${roll}: Fish spooked and returned to habitat.`, "danger");
  } else {
    fish.alert = true;
    addLog(session, `${reason} Spook check ${roll}: Fish stayed Alert.`, "miss");
  }
}

function endFishing(session) {
  session.turn.phase = "cleanup";
  session.battle = null;
}

function tackleKeys(player) {
  return player.tackleSlots.map((card) => card.key);
}

function tileCellForFish(session, fish) {
  if (!fish?.activeLocation || !session.lake) return [];
  const tileItem = findTile(session.lake, fish.activeLocation.tileInstanceId);
  return tileItem?.grid?.[fish.activeLocation.row]?.[fish.activeLocation.column] || [];
}

function currentShoreAdjacent(fish) {
  return fish?.activeLocation?.row === 0 || fish?.activeLocation?.row === 2;
}

function recordFishGuess(session, player, fish, attempt, biteBox, nibbleCalc, roll, nibble) {
  if (!Array.isArray(fish.guessHistory)) fish.guessHistory = [];
  const guess = {
    id: attempt.id,
    playerId: player.code,
    playerName: player.name,
    round: session.round,
    declaration: { ...attempt.declaration },
    matchCount: biteBox.matchCount,
    hotHit: biteBox.hotHit,
    nibbleRoll: roll,
    nibbleModifier: nibbleCalc.modifier,
    nibbleTarget: nibbleCalc.target,
    nibbleRawModifier: nibbleCalc.rawModifier,
    nibbleDetails: nibbleCalc.details.map((detail) => ({ ...detail })),
    nibbleSuccess: nibble ? nibble.success : null,
  };
  const existingIndex = fish.guessHistory.findIndex((item) => item.id === attempt.id);
  if (existingIndex >= 0) {
    fish.guessHistory[existingIndex] = guess;
  } else {
    fish.guessHistory.push(guess);
  }
}

function publicAttemptSnapshot(attempt) {
  if (!attempt) return null;
  return {
    id: attempt.id,
    playerId: attempt.playerId,
    fishPublicId: attempt.fishPublicId,
    habitat: attempt.habitat,
    habitatLabel: HABITAT_LABELS[attempt.habitat],
    moodCategory: attempt.moodCategory,
    declaration: attempt.declaration ? { ...attempt.declaration } : null,
    matchCount: attempt.matchCount,
    hotHit: attempt.hotHit,
    nibbleRoll: attempt.nibbleRoll,
    nibbleModifier: attempt.nibbleModifier,
    nibbleTarget: attempt.nibbleTarget,
    nibbleRawModifier: attempt.nibbleRawModifier,
    nibbleDetails: (attempt.nibbleDetails || []).map((detail) => ({ ...detail })),
    nibbleSuccess: attempt.nibbleSuccess,
    biteBoxResolved: attempt.biteBoxResolved,
  };
}

function setResultSnapshot(result) {
  if (!result) return null;
  return {
    id: result.id,
    mode: result.mode,
    hardSet: Boolean(result.hardSet),
    waitRoll: result.waitRoll ?? null,
    waitBonus: result.waitBonus || 0,
    waitSpit: Boolean(result.waitSpit),
    hookRoll: result.hookRoll ?? null,
    hookModifier: result.hookModifier ?? null,
    hookTarget: result.hookTarget ?? null,
    hookDetails: (result.hookDetails || []).map((detail) => ({ ...detail })),
    hookSuccess: result.hookSuccess ?? null,
    proceedAfter: result.proceedAfter ? new Date(result.proceedAfter).toISOString() : null,
  };
}

function battleSnapshot(battle, session) {
  if (!battle) return null;
  const fish = session.fish.get(battle.fishId);
  return {
    fishPublicId: fish?.publicId || null,
    playerId: battle.playerId,
    position: battle.position,
    tension: battle.tension,
    tangled: battle.tangled,
    abilityUsed: battle.abilityUsed,
    terminal: battle.terminal,
    history: (battle.history || []).slice(-8),
  };
}

function publicPlayerSnapshot(player, session, viewerCode) {
  return {
    code: player.code,
    name: player.name,
    ready: Boolean(player.ready),
    joinedAt: new Date(player.joinedAt).toISOString(),
    lastSeenAt: player.lastSeenAt ? new Date(player.lastSeenAt).toISOString() : null,
    locationTileId: player.locationTileId,
    equipment: { ...player.equipment },
    tackleSlots: player.tackleSlots.map(publicCard),
    currentPresentation: player.currentPresentation ? { ...player.currentPresentation } : null,
    handCount: player.hand.length,
    livewell: player.livewell.map((slot, index) => {
      const fish = session.fish.get(slot.fishId);
      if (slot.revealed || session.status === "complete") {
        return {
          slot: index + 1,
          revealed: true,
          fish: fullFishCard(fish),
        };
      }
      return {
        slot: index + 1,
        revealed: false,
        label: viewerCode === player.code ? "Secret Bass" : "Secret Fish",
      };
    }),
  };
}

function privatePlayerSnapshot(player, session) {
  const pendingFish = session.turn?.pendingFishId
    ? session.fish.get(session.turn.pendingFishId)
    : null;

  return {
    code: player.code,
    hand: player.hand.map(publicCard),
    livewell: player.livewell.map((slot, index) => {
      const fish = session.fish.get(slot.fishId);
      return {
        slot: index + 1,
        revealed: Boolean(slot.revealed),
        fish: fullFishCard(fish),
      };
    }),
    pendingCatch: pendingFish ? fullFishCard(pendingFish) : null,
    pendingImmediateCardId:
      session.turn?.phase === "immediate" && session.turn.playerId === player.code
        ? session.turn.drawnCardId
        : null,
    adjacentTileIds: session.lake && player.locationTileId
      ? adjacentTileIds(session.lake, player.locationTileId)
      : [],
  };
}

function publicCard(card) {
  return {
    id: card.id,
    key: card.key,
    name: card.name,
    category: card.category,
    tradeValue: card.tradeValue || null,
    text: card.text,
    immediate: Boolean(card.immediate),
    dead: Boolean(card.dead),
  };
}

function getLakeSnapshot(session) {
  if (!session.lake) return null;
  const activeFish = [...session.fish.values()]
    .filter((fish) => fish.poolState === "active" && fish.activeLocation)
    .map((fish) => ({
      ...publicFishCard(fish),
      location: { ...fish.activeLocation },
    }));

  return {
    ...session.lake,
    activeFish,
  };
}

function getPatternSnapshot(session, options = {}) {
  const auth = options.auth || null;
  const viewerCode = auth?.role === "player" ? auth.actorCode : "";
  const now = Date.now();
  const snapshot = {
    id: session.id,
    name: session.name,
    status: session.status,
    createdAt: new Date(session.createdAt).toISOString(),
    expiresAt: new Date(session.expiresAt).toISOString(),
    closedAt: session.closedAt ? new Date(session.closedAt).toISOString() : null,
    remainingSeconds: Math.max(0, Math.ceil((session.expiresAt - now) / 1000)),
    lakeWidth: session.lakeWidth,
    round: session.round,
    season: session.season,
    moon: session.moon,
    weather: session.weather,
    activeEvent: session.activeEvent ? { ...session.activeEvent } : null,
    playerOrder: [...session.playerOrder],
    turn: session.turn
      ? {
          id: session.turn.id,
          playerId: session.turn.playerId,
          phase: session.turn.phase,
          cast: session.turn.cast ? { ...session.turn.cast } : null,
          selectedFishPublicId: session.turn.selectedFishId
            ? session.fish.get(session.turn.selectedFishId)?.publicId || null
            : null,
          waitUsed: session.turn.waitUsed,
          waitBonus: session.turn.waitBonus || 0,
          setResult: setResultSnapshot(session.turn.setResult),
        }
      : null,
    lake: getLakeSnapshot(session),
    players: session.playerOrder.map((playerId) =>
      publicPlayerSnapshot(session.players.get(playerId), session, viewerCode)
    ),
    attempt: publicAttemptSnapshot(session.attempt),
    battle: battleSnapshot(session.battle, session),
    log: session.log.slice(-40),
    results: session.results,
  };

  if (auth?.role === "player") {
    const player = session.players.get(auth.actorCode);
    snapshot.me = player ? privatePlayerSnapshot(player, session) : null;
  }

  if (auth?.role === "host") {
    snapshot.host = {
      hostToken: session.hostToken,
      deckCount: session.actionDeck.length,
      discardCount: session.actionDiscard.length,
    };
    if (session.debug) {
      snapshot.debug = {
        fish: [...session.fish.values()].map(fullFishCard),
      };
    }
  }

  return snapshot;
}

function subscriberCacheKey(subscriber) {
  return subscriber.auth?.role === "player"
    ? `player:${subscriber.auth.actorCode}`
    : subscriber.auth?.role === "host"
    ? "host"
    : "public";
}

function writePatternEvent(subscriber, session, snapshotCache = null) {
  const cacheKey = subscriberCacheKey(subscriber);
  let payload = snapshotCache?.get(cacheKey);
  if (!payload) {
    payload = JSON.stringify(getPatternSnapshot(session, { auth: subscriber.auth }));
    snapshotCache?.set(cacheKey, payload);
  }
  subscriber.res.write(`event: session\n`);
  subscriber.res.write(`data: ${payload}\n\n`);
}

function broadcastPatternSession(session) {
  const snapshotCache = new Map();
  for (const subscriber of [...session.subscribers]) {
    try {
      writePatternEvent(subscriber, session, snapshotCache);
    } catch {
      clearInterval(subscriber.pingTimer);
      session.subscribers.delete(subscriber);
    }
  }
}

function handlePatternEvents(req, res, session, url) {
  const auth = authenticate(session, url);
  if (!auth) {
    sendError(res, 401, "A valid host token or angler code is required.");
    return;
  }

  if (auth.role === "player") {
    const player = session.players.get(auth.actorCode);
    if (player) player.lastSeenAt = Date.now();
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
  writePatternEvent(subscriber, session);

  req.on("close", () => {
    clearInterval(subscriber.pingTimer);
    session.subscribers.delete(subscriber);
  });
}

async function handleCreatePatternSession(req, res) {
  const body = await readJson(req);
  const session = createPatternSession(body);
  sendJson(res, 201, {
    session: getPatternSnapshot(session, {
      auth: { role: "host", actorCode: "HOST" },
    }),
    sessionId: session.id,
    hostToken: session.hostToken,
  });
}

async function handleCreatePatternParticipant(req, res, session) {
  const body = await readJson(req);
  if (session.status !== "setup") {
    sendError(res, 409, "This Pattern game is not accepting new anglers.");
    return;
  }
  if (session.playerOrder.length >= MAX_PATTERN_PLAYERS) {
    sendError(res, 409, "This Pattern game already has 4 anglers.");
    return;
  }

  const code = createPatternPlayerCode(session);
  const player = {
    code,
    name: normalizeName(body.name, `Angler ${session.playerOrder.length + 1}`),
    ready: false,
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
    locationTileId: null,
    equipment: {
      rod: "Moderate Rod",
      reel: "Balanced Reel",
      line: "Fluorocarbon",
    },
    tackleSlots: [],
    hand: [],
    livewell: [],
    currentPresentation: null,
  };
  session.players.set(code, player);
  session.playerOrder.push(code);
  addLog(session, `${player.name} joined the lake.`, "info");
  broadcastPatternSession(session);
  sendJson(res, 201, {
    code,
    session: getPatternSnapshot(session, { auth: { role: "player", actorCode: code } }),
  });
}

async function handleVerifyPatternParticipant(req, res, session) {
  const body = await readJson(req);
  const code = normalizePatternPlayerCode(body.code);
  const player = session.players.get(code);
  if (!player) {
    sendError(res, 401, "That angler code is not valid for this Pattern game.");
    return;
  }
  player.lastSeenAt = Date.now();
  broadcastPatternSession(session);
  sendJson(res, 200, {
    code,
    session: getPatternSnapshot(session, { auth: { role: "player", actorCode: code } }),
  });
}

async function handleStartPatternSession(req, res, session, url) {
  const body = await readJson(req);
  const auth = authenticate(session, url, body);
  if (!auth || auth.role !== "host") {
    sendError(res, 403, "A valid host token is required.");
    return;
  }
  if (session.status !== "setup") {
    sendError(res, 409, "Only setup games can be started.");
    return;
  }
  startPatternGame(session);
  broadcastPatternSession(session);
  sendJson(res, 200, { session: getPatternSnapshot(session, { auth }) });
}

async function handleClosePatternSession(req, res, session, url) {
  const body = await readJson(req);
  const auth = authenticate(session, url, body);
  if (!auth || auth.role !== "host") {
    sendError(res, 403, "A valid host token is required.");
    return;
  }
  session.status = "closed";
  session.closedAt = Date.now();
  addLog(session, "The host closed the game.", "danger");
  broadcastPatternSession(session);
  sendJson(res, 200, { session: getPatternSnapshot(session, { auth }) });
}

async function handlePatternCommand(req, res, session, url) {
  const body = await readJson(req);
  const auth = authenticate(session, url, body);
  const command = body.command || body.type || "";

  try {
    if (command === "ready") {
      const player = requirePlayer(res, auth) ? session.players.get(auth.actorCode) : null;
      if (!player) return;
      player.ready = Boolean(body.ready);
      addLog(session, `${player.name} is ${player.ready ? "ready" : "not ready"}.`, "info");
    } else if (command === "immediate") {
      commandImmediate(session, res, auth, body);
      if (res.writableEnded) return;
    } else if (command === "move") {
      commandMove(session, res, auth, body);
      if (res.writableEnded) return;
    } else if (command === "equipTackle") {
      commandEquipTackle(session, res, auth, body);
      if (res.writableEnded) return;
    } else if (command === "unequipTackle") {
      commandUnequipTackle(session, res, auth, body);
      if (res.writableEnded) return;
    } else if (command === "discard") {
      commandDiscard(session, res, auth, body);
      if (res.writableEnded) return;
    } else if (command === "tradeCards") {
      commandTradeCards(session, res, auth, body);
      if (res.writableEnded) return;
    } else if (command === "finishRig") {
      const player = requireActivePlayer(session, res, auth, ["rig"]);
      if (!player) return;
      session.turn.phase = "cast";
      addLog(session, `${player.name} finished rigging.`, "info");
    } else if (command === "cast") {
      commandCast(session, res, auth, body);
      if (res.writableEnded) return;
    } else if (command === "declare") {
      commandDeclare(session, res, auth, body);
      if (res.writableEnded) return;
    } else if (command === "rollNibble") {
      commandRollNibble(session, res, auth);
      if (res.writableEnded) return;
    } else if (command === "setHook") {
      commandSetHook(session, res, auth, body);
      if (res.writableEnded) return;
    } else if (command === "proceedSet") {
      commandProceedSet(session, res, auth);
      if (res.writableEnded) return;
    } else if (command === "battleStep") {
      commandBattleStep(session, res, auth, body);
      if (res.writableEnded) return;
    } else if (command === "livewell") {
      commandLivewell(session, res, auth, body);
      if (res.writableEnded) return;
    } else if (command === "endTurn") {
      commandEndTurn(session, res, auth);
      if (res.writableEnded) return;
    } else {
      sendError(res, 400, "Unknown Pattern command.");
      return;
    }
  } catch (error) {
    sendError(res, 400, error.message || "Pattern command failed.");
    return;
  }

  broadcastPatternSession(session);
  sendJson(res, 200, { session: getPatternSnapshot(session, { auth }) });
}

function commandImmediate(session, res, auth, body) {
  const player = requireActivePlayer(session, res, auth, ["immediate"]);
  if (!player) return;
  const card = player.hand.find((item) => item.id === session.turn.drawnCardId);
  if (!card || !card.immediate) {
    sendError(res, 409, "There is no Immediate card waiting.");
    return;
  }

  if (body.play) {
    session.activeEvent = {
      key: card.key,
      name: card.name,
      text: card.text,
      round: session.round,
    };
    removeCardFromHand(player, card.id);
    session.actionDiscard.push(card);
    addLog(session, `${player.name} played ${card.name}.`, "hit");
  } else {
    card.dead = true;
    addLog(session, `${player.name} declined an Immediate card.`, "miss");
  }
  session.turn.phase = "move";
}

function commandMove(session, res, auth, body) {
  const player = requireActivePlayer(session, res, auth, ["move"]);
  if (!player) return;
  const targetTileId = toSafeString(body.tileId || player.locationTileId);
  if (!findTile(session.lake, targetTileId)) {
    sendError(res, 400, "Choose a valid Location Tile.");
    return;
  }
  if (!canMoveToTile(session.lake, player.locationTileId, targetTileId)) {
    sendError(res, 409, "Anglers can move only one orthogonal tile.");
    return;
  }
  player.locationTileId = targetTileId;
  const tileItem = findTile(session.lake, targetTileId);
  session.turn.phase = "rig";
  addLog(session, `${player.name} moved to ${tileItem.name}.`, "info");
}

function commandEquipTackle(session, res, auth, body) {
  const player = requireActivePlayer(session, res, auth, ["rig"]);
  if (!player) return;
  const card = player.hand.find((item) => item.id === body.cardId);
  if (!card || card.category !== "tackle") {
    sendError(res, 400, "Choose a Tackle card from your hand.");
    return;
  }
  if (player.tackleSlots.length >= 2) {
    sendError(res, 409, "You can equip at most 2 Tackle cards.");
    return;
  }
  removeCardFromHand(player, card.id);
  player.tackleSlots.push(card);
  addLog(session, `${player.name} equipped ${card.name}.`, "info");
}

function commandUnequipTackle(session, res, auth, body) {
  const player = requireActivePlayer(session, res, auth, ["rig"]);
  if (!player) return;
  const cardId = toSafeString(body.cardId);
  const cardIndex = player.tackleSlots.findIndex((card) => card.id === cardId);
  if (cardIndex < 0) {
    sendError(res, 400, "Choose equipped Tackle to unequip.");
    return;
  }
  const [card] = player.tackleSlots.splice(cardIndex, 1);
  player.hand.push(card);
  addLog(session, `${player.name} unequipped ${card.name}.`, "info");
}

function commandDiscard(session, res, auth, body) {
  const player = requireActivePlayer(session, res, auth, ["cleanup", "rig"]);
  if (!player) return;
  const card = removeCardFromHand(player, body.cardId);
  if (!card) {
    sendError(res, 400, "Choose a card in your hand.");
    return;
  }
  session.actionDiscard.push(card);
  addLog(session, `${player.name} discarded a card.`, "info");
}

function commandTradeCards(session, res, auth, body) {
  const player = requireActivePlayer(session, res, auth, ["rig"]);
  if (!player) return;
  const target = session.players.get(normalizePatternPlayerCode(body.targetCode));
  if (!target || target.code === player.code) {
    sendError(res, 400, "Choose another angler for the trade.");
    return;
  }
  const give = removeCardFromHand(player, body.giveCardId);
  const take = removeCardFromHand(target, body.takeCardId);
  if (!give || !take) {
    if (give) player.hand.push(give);
    if (take) target.hand.push(take);
    sendError(res, 400, "Both traded cards must be in hand.");
    return;
  }
  player.hand.push(take);
  target.hand.push(give);
  addLog(session, `${player.name} traded cards with ${target.name}.`, "info");
}

function commandCast(session, res, auth) {
  const player = requireActivePlayer(session, res, auth, ["cast"]);
  if (!player) return;
  const tileItem = findTile(session.lake, player.locationTileId);
  const roll = randomInt(session.rng, 1, 10);
  const [row, column] = castRollToCell(roll);
  const cell = tileItem.grid[row][column];
  const cast = {
    roll,
    tileId: tileItem.id,
    row,
    column,
    cell: [...cell],
  };
  session.turn.cast = cast;
  addLog(session, `${player.name} cast into ${tileItem.name}: d10 ${roll}.`, "info");

  if (cell.includes("M")) {
    addLog(session, "The cast landed in Muck. No Fish was found.", "miss");
    endFishing(session);
    return;
  }

  let fish = activeFishAt(session, tileItem.id, row, column);
  let habitat = fish?.habitat || null;
  if (!fish) {
    const habitatSelection = chooseHabitatFromCell(cell, session.rng, {
      activeEvent: session.activeEvent,
    });
    habitat = habitatSelection.habitat;
    const available = availableFishForHabitat(session, habitat);
    if (available.length === 0) {
      addLog(session, `${HABITAT_LABELS[habitat]} was selected, but no Bass remain in that pool.`, "miss");
      endFishing(session);
      return;
    }
    fish = available[Math.floor(session.rng() * available.length)];
    activateFish(session, fish, tileItem.id, row, column);
    addLog(session, `${HABITAT_LABELS[habitat]} habitat selected. A Fish was found.`, "hit");
    addLog(
      session,
      `Tell revealed: ${fish.tell.lures.join("/")} | ${fish.tell.colors.join("/")} | ${fish.tell.retrieves.join("/")}.`,
      "info"
    );
  } else {
    addLog(session, `${player.name} targeted an active ${HABITAT_LABELS[fish.habitat]} Fish.`, "info");
  }

  startAttempt(session, player, fish, habitat, cell);
}

function commandDeclare(session, res, auth, body) {
  const player = requireActivePlayer(session, res, auth, ["declare"]);
  if (!player) return;
  const attempt = session.attempt;
  const fish = session.fish.get(attempt?.fishId);
  if (!attempt || !fish) {
    sendError(res, 409, "No Fish is being attempted.");
    return;
  }
  const declaration = {
    lure: normalizeChoice(body.lure, LURES, "Jig"),
    color: normalizeChoice(body.color, COLORS, "Natural"),
    retrieve: normalizeChoice(body.retrieve, RETRIEVES, "Slow"),
  };
  attempt.declaration = declaration;
  player.currentPresentation = declaration;
  const biteBox = resolveBiteBox(fish, attempt, declaration);
  attempt.hiddenMoodOptions = {};
  const nibbleCalc = calculateNibble({
    matchCount: biteBox.matchCount,
    hotHit: biteBox.hotHit,
    lure: declaration.lure,
    color: declaration.color,
    retrieve: declaration.retrieve,
    habitat: attempt.habitat,
    alert: fish.alert,
    weather: session.weather,
    season: session.season,
    line: player.equipment.line,
    tackle: tackleKeys(player),
    activeEvent: session.activeEvent,
    shoreAdjacent: currentShoreAdjacent(fish),
  });
  attempt.matchCount = biteBox.matchCount;
  attempt.hotHit = biteBox.hotHit;
  attempt.nibbleRoll = null;
  attempt.nibbleModifier = nibbleCalc.modifier;
  attempt.nibbleTarget = nibbleCalc.target;
  attempt.nibbleRawModifier = nibbleCalc.rawModifier;
  attempt.nibbleDetails = nibbleCalc.details.map((detail) => ({ ...detail }));
  attempt.nibbleSuccess = null;
  attempt.biteBoxResolved = true;
  recordFishGuess(session, player, fish, attempt, biteBox, nibbleCalc, null, null);

  addLog(
    session,
    `${player.name} declared ${declaration.lure} / ${declaration.color} / ${declaration.retrieve}.`,
    "info"
  );
  addLog(session, `Bite Box: ${biteBox.matchCount} Matches${biteBox.hotHit ? ", Hot Hit" : ""}.`, "hit");
  addLog(
    session,
    `Nibble ready: DC ${nibbleCalc.target}, modifier ${formatModifier(nibbleCalc.modifier)}. ${formatRollDetails(
      "Modifiers",
      nibbleCalc.details,
      nibbleCalc.modifier,
      nibbleCalc.rawModifier
    )}`,
    "info"
  );

  session.turn.phase = "nibble";
}

function commandRollNibble(session, res, auth) {
  const player = requireActivePlayer(session, res, auth, ["nibble"]);
  if (!player) return;
  const attempt = session.attempt;
  const fish = session.fish.get(attempt?.fishId);
  if (!attempt || !fish || !attempt.biteBoxResolved || attempt.matchCount === null) {
    sendError(res, 409, "No Nibble is ready to roll.");
    return;
  }
  if (attempt.nibbleRoll !== null) {
    sendError(res, 409, "This Nibble has already been rolled.");
    return;
  }

  const nibbleCalc = {
    modifier: attempt.nibbleModifier || 0,
    target: attempt.nibbleTarget || 5,
    rawModifier: attempt.nibbleRawModifier ?? attempt.nibbleModifier ?? 0,
    details: attempt.nibbleDetails || [],
  };
  const roll = randomInt(session.rng, 1, 6);
  const nibble = resolveNibbleRoll(roll, nibbleCalc);
  attempt.nibbleRoll = roll;
  attempt.nibbleSuccess = nibble.success;
  recordFishGuess(
    session,
    player,
    fish,
    attempt,
    { matchCount: attempt.matchCount, hotHit: attempt.hotHit },
    nibbleCalc,
    roll,
    nibble
  );

  addLog(
    session,
    `Nibble roll ${roll}${formatModifier(nibbleCalc.modifier)} vs DC ${nibbleCalc.target}: ${
      nibble.success ? "NIBBLE!" : "no bite"
    }. ${formatRollDetails("Modifiers", nibbleCalc.details, nibbleCalc.modifier, nibbleCalc.rawModifier)}`,
    nibble.success ? "hit" : "miss"
  );

  session.turn.phase = nibble.success ? "set" : "cleanup";
}

function commandSetHook(session, res, auth, body) {
  const player = requireActivePlayer(session, res, auth, ["set"]);
  if (!player) return;
  const attempt = session.attempt;
  const fish = session.fish.get(attempt?.fishId);
  if (!attempt || !fish || !attempt.nibbleSuccess) {
    sendError(res, 409, "No successful Nibble is ready to set.");
    return;
  }
  if (session.turn.setResult) {
    sendError(res, 409, "Resolve the pending Set result before rolling again.");
    return;
  }

  const mode = body.mode === "wait" ? "wait" : "now";
  if (mode === "wait") {
    if (session.turn.waitUsed) {
      sendError(res, 409, "You can Wait only once per successful Nibble.");
      return;
    }
    session.turn.waitUsed = true;
    const waitRoll = randomInt(session.rng, 1, 6);
    const waitBonus = waitRoll >= 5 ? 2 : 0;
    const waitSpit = waitRoll <= 2;
    session.turn.setResult = {
      id: `set-${randomHex(8)}`,
      mode: "wait",
      hardSet: false,
      waitRoll,
      waitBonus,
      waitSpit,
      hookRoll: null,
      hookModifier: null,
      hookTarget: null,
      hookDetails: [],
      hookSuccess: null,
      proceedAfter: Date.now() + ROLL_ANIMATION_MS,
    };
    session.turn.phase = "wait";
    addLog(
      session,
      `${player.name} waited. Roll ${waitRoll}: ${
        waitSpit
          ? "Fish spit the lure."
          : waitBonus
          ? "+2 Hook Set locked in."
          : "Fish still has it."
      } Proceed when the roll finishes.`,
      waitSpit ? "miss" : "info"
    );
    return;
  }

  const hardSet = Boolean(body.hardSet);
  const waitBonus = session.turn.waitBonus || 0;
  const hookCalc = calculateHookSet({
    lure: attempt.declaration.lure,
    habitat: attempt.habitat,
    rod: player.equipment.rod,
    tackle: tackleKeys(player),
    hardSet,
    waitBonus,
  });
  const roll = randomInt(session.rng, 1, 6);
  const hook = resolveHookSetRoll(roll, hookCalc);
  session.turn.hardSet = hardSet;
  session.turn.setResult = {
    id: `set-${randomHex(8)}`,
    mode: "now",
    hardSet,
    waitRoll: null,
    waitBonus,
    waitSpit: false,
    hookRoll: roll,
    hookModifier: hookCalc.modifier,
    hookTarget: hookCalc.target,
    hookDetails: hookCalc.details.map((detail) => ({ ...detail })),
    hookSuccess: hook.success,
    proceedAfter: Date.now() + ROLL_ANIMATION_MS,
  };
  session.turn.phase = "hookSet";

  addLog(
    session,
    `${player.name} ${hardSet ? "Hard Set" : "Hook Set"}: ${roll} vs ${hookCalc.target}+ (${formatModifier(
      hookCalc.modifier
    )}). Proceed when the roll finishes.`,
    hook.success ? "hit" : "miss"
  );
}

function commandProceedSet(session, res, auth) {
  const player = requireActivePlayer(session, res, auth, ["wait", "hookSet"]);
  if (!player) return;
  const result = session.turn.setResult;
  const attempt = session.attempt;
  const fish = session.fish.get(attempt?.fishId);
  if (!result || !attempt || !fish) {
    sendError(res, 409, "No Set result is waiting to proceed.");
    return;
  }
  if (result.proceedAfter && Date.now() < result.proceedAfter) {
    sendError(res, 409, "Wait for the dice roll to finish before proceeding.");
    return;
  }

  if (session.turn.phase === "wait") {
    if (result.mode !== "wait" || result.waitRoll === null) {
      sendError(res, 409, "No Wait result is waiting to proceed.");
      return;
    }
    session.turn.setResult = null;
    if (result.waitSpit) {
      handleFishFailure(session, fish, attempt.wasAlertAtStart, "Hook Set window failed.");
      endFishing(session);
      return;
    }
    session.turn.waitBonus = result.waitBonus || 0;
    session.turn.phase = "set";
    addLog(
      session,
      `${player.name} proceeds to Hook Set${
        session.turn.waitBonus ? ` with ${formatModifier(session.turn.waitBonus)} from Wait` : ""
      }.`,
      "info"
    );
    return;
  }

  if (result.mode !== "now" || result.hookRoll === null || result.hookSuccess === null) {
    sendError(res, 409, "No Hook Set result is waiting to proceed.");
    return;
  }
  session.turn.setResult = null;

  if (!result.hookSuccess) {
    handleFishFailure(session, fish, attempt.wasAlertAtStart, "Hook Set failed.");
    endFishing(session);
    return;
  }

  fish.fightRevealed = true;
  const battle = createBattleState({
    fishId: fish.id,
    playerId: player.code,
    hardSet: result.hardSet,
  });
  battle.wasAlertAtStart = attempt.wasAlertAtStart;
  if (player.equipment.line === "Monofilament") {
    battle.tension = false;
  }
  session.battle = battle;
  session.turn.phase = "battle";
  addLog(
    session,
    `${player.name} hooked the Fish. Fight ${fish.fight}, Ability ${abilityLabel(fish.ability)}.`,
    "hit"
  );
}

function commandBattleStep(session, res, auth, body) {
  const player = requireActivePlayer(session, res, auth, ["battle"]);
  if (!player) return;
  const battle = session.battle;
  const fish = session.fish.get(battle?.fishId);
  if (!battle || !fish) {
    sendError(res, 409, "No Battle is active.");
    return;
  }
  const action = ["reel", "pressure", "giveLine"].includes(body.action)
    ? body.action
    : "reel";
  const roll = action === "giveLine" ? null : randomInt(session.rng, 1, 6);
  const result = resolveBattleStep({
    fish,
    battle,
    action,
    roll,
    cell: tileCellForFish(session, fish),
    equipment: player.equipment,
    tackle: tackleKeys(player),
  });
  session.battle = result.battle;
  addLog(
    session,
    `${player.name} chose ${battleActionLabel(action)}${
      roll ? `: ${roll}${result.step.modifier ? formatModifier(result.step.modifier) : ""}` : ""
    }. ${result.step.success ? "Success." : action === "giveLine" ? "Line given." : "Failure."}`,
    result.step.success ? "hit" : "miss"
  );
  result.step.notes.forEach((note) => addLog(session, note, "info"));

  if (session.battle.terminal === "landed") {
    removeActiveFishFromBoard(fish, "pendingLivewell");
    session.turn.pendingFishId = fish.id;
    session.turn.phase = "livewell";
    session.battle = null;
    addLog(session, `${player.name} landed a Fish. Livewell decision pending.`, "victory");
  } else if (session.battle.terminal === "escaped") {
    handleFishFailure(session, fish, battle.wasAlertAtStart, "Battle escaped.");
    session.battle = null;
    endFishing(session);
  }
}

function commandLivewell(session, res, auth, body) {
  const player = requireActivePlayer(session, res, auth, ["livewell"]);
  if (!player) return;
  const pendingFishId = session.turn.pendingFishId;
  const fish = session.fish.get(pendingFishId);
  if (!fish || fish.poolState !== "pendingLivewell") {
    sendError(res, 409, "No landed Fish is waiting for the livewell.");
    return;
  }

  const reveal = Boolean(body.reveal);
  const releaseFishId = toSafeString(body.releaseFishId);
  const needsCull = player.livewell.length >= 3;
  if (needsCull && !releaseFishId) {
    sendError(res, 409, "Choose one Fish to release.");
    return;
  }

  if (needsCull && releaseFishId !== fish.id) {
    const releaseIndex = player.livewell.findIndex((slot) => slot.fishId === releaseFishId);
    if (releaseIndex < 0) {
      sendError(res, 400, "Choose one of your livewell Fish or the new Fish to release.");
      return;
    }
    const [released] = player.livewell.splice(releaseIndex, 1);
    const releasedFish = session.fish.get(released.fishId);
    returnFishToHabitat(session, releasedFish);
    addLog(session, `${player.name} culled a Fish back to its habitat.`, "info");
  }

  if (releaseFishId === fish.id) {
    returnFishToHabitat(session, fish);
    addLog(session, `${player.name} released the new Fish.`, "info");
  } else {
    fish.poolState = "livewell";
    player.livewell.push({ fishId: fish.id, revealed: reveal });
    if (reveal) {
      const drawn = drawActionCard(session, player);
      addLog(
        session,
        `${player.name} showed off a ${fish.weight.toFixed(1)} lb Bass and drew an Action card.`,
        "victory"
      );
      if (drawn?.immediate) drawn.dead = true;
    } else {
      addLog(session, `${player.name} kept a landed Fish secret.`, "info");
    }
  }

  session.turn.pendingFishId = null;
  session.turn.phase = "cleanup";
}

function commandEndTurn(session, res, auth) {
  const player = requireActivePlayer(session, res, auth, ["cleanup"]);
  if (!player) return;
  if (player.hand.length > MAX_HAND_SIZE) {
    sendError(res, 409, `Discard down to ${MAX_HAND_SIZE} cards before ending the turn.`);
    return;
  }
  addLog(session, `${player.name} ended the turn.`, "info");
  advanceTurn(session);
}

function removeCardFromHand(player, cardId) {
  const index = player.hand.findIndex((card) => card.id === cardId);
  if (index < 0) return null;
  const [card] = player.hand.splice(index, 1);
  return card;
}

function normalizeChoice(value, options, fallback) {
  return options.includes(value) ? value : fallback;
}

function formatModifier(value) {
  return value >= 0 ? `+${value}` : String(value);
}

function formatRollDetails(label, details = [], modifier = 0, rawModifier = modifier) {
  if (!details.length) return `${label}: none.`;
  const detailText = details
    .map((detail) => `${detail.label} ${formatModifier(detail.value)}`)
    .join(", ");
  const capText =
    rawModifier !== modifier
      ? ` Raw total ${formatModifier(rawModifier)} capped at ${formatModifier(modifier)}.`
      : "";
  return `${label}: ${detailText}.${capText}`;
}

function abilityLabel(value) {
  return {
    jump: "Jump",
    run: "Run",
    cover: "Cover",
    headShake: "Head Shake",
    dive: "Dive",
  }[value] || value;
}

function battleActionLabel(action) {
  return {
    reel: "Reel",
    pressure: "Pressure",
    giveLine: "Give Line",
  }[action] || action;
}

async function handlePatternRequest(req, res, url, parts) {
  if (parts[2] !== "sessions") {
    sendError(res, 404, "Not found.");
    return;
  }

  if (req.method === "POST" && parts.length === 3) {
    await handleCreatePatternSession(req, res);
    return;
  }

  if (req.method === "GET" && parts.length === 4 && parts[3] === "active") {
    const activeSessions = [...patternSessions.values()]
      .filter((session) => session.status === "setup" || session.status === "active")
      .map((session) => ({
        id: session.id,
        name: session.name,
        status: session.status,
        playerCount: session.playerOrder.length,
        lakeWidth: session.lakeWidth,
        createdAt: new Date(session.createdAt).toISOString(),
        remainingSeconds: Math.max(0, Math.ceil((session.expiresAt - Date.now()) / 1000)),
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    sendJson(res, 200, { sessions: activeSessions });
    return;
  }

  const session = findPatternSession(parts[3]);
  if (!session) {
    sendJson(res, 404, {
      error: "That Pattern game was not found.",
      sessionClosed: true,
    });
    return;
  }

  if (req.method === "GET" && parts.length === 4) {
    const auth = authenticate(session, url);
    if (!auth) {
      sendError(res, 401, "A valid host token or angler code is required.");
      return;
    }
    sendJson(res, 200, { session: getPatternSnapshot(session, { auth }) });
    return;
  }

  if (req.method === "GET" && parts[4] === "events") {
    handlePatternEvents(req, res, session, url);
    return;
  }

  if (req.method === "POST" && parts[4] === "participants") {
    await handleCreatePatternParticipant(req, res, session);
    return;
  }

  if (req.method === "POST" && parts[4] === "verify") {
    await handleVerifyPatternParticipant(req, res, session);
    return;
  }

  if (req.method === "POST" && parts[4] === "start") {
    await handleStartPatternSession(req, res, session, url);
    return;
  }

  if (req.method === "POST" && parts[4] === "close") {
    await handleClosePatternSession(req, res, session, url);
    return;
  }

  if (req.method === "POST" && parts[4] === "commands") {
    await handlePatternCommand(req, res, session, url);
    return;
  }

  sendError(res, 404, "Not found.");
}

module.exports = {
  closePatternSessionsForShutdown,
  handlePatternRequest,
  refreshAllPatternSessionStatuses,
};
