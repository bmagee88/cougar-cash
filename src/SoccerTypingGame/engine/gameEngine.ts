import { DEFAULT_SOCCER_CONFIG } from "./config";
import {
  clamp,
  computeDefensiveTimeLimitMs,
  createInterceptionOptions,
  distance,
  lerpPoint,
} from "./geometry";
import { choosePhraseForDistance } from "./phrases";
import {
  applyTypingKey,
  createTypingChallenge,
  getTypingStats,
  isChallengeComplete,
} from "./typingChallenge";
import {
  LockedPlay,
  MatchState,
  PlayerState,
  PlayTarget,
  Rng,
  SoccerTypingConfig,
  TeamId,
  TypingChallenge,
} from "./types";

const MIN_MODELED_TRAVEL_MS = 250;

function otherTeam(team: TeamId): TeamId {
  return team === "X" ? "O" : "X";
}

function normalizeKey(key: string) {
  return key.length === 1 ? key.toUpperCase() : key;
}

function getPlayer(state: MatchState, playerId: string) {
  return state.players.find((player) => player.id === playerId);
}

function setBallCarrier(players: PlayerState[], playerId: string) {
  return players.map((player) => ({
    ...player,
    hasBall: player.id === playerId,
  }));
}

function resetPlayersToHome(players: PlayerState[], carrierId: string) {
  return players.map((player) => ({
    ...player,
    position: player.home,
    temporary: undefined,
    hasBall: player.id === carrierId,
  }));
}

function makeStats() {
  return {
    passesCompleted: 0,
    shotsTaken: 0,
    goals: { X: 0, O: 0 },
    interceptions: { X: 0, O: 0 },
    turnovers: { X: 0, O: 0 },
    offenseChallenges: [],
    defenseChallenges: [],
  };
}

function makePlayerState(config: SoccerTypingConfig, kickoffPlayerId: string) {
  return config.players.map((player) => ({
    ...player,
    key: player.key.toUpperCase(),
    position: player.home,
    hasBall: player.id === kickoffPlayerId,
  }));
}

export function createInitialSoccerMatch(
  config: SoccerTypingConfig = DEFAULT_SOCCER_CONFIG,
  nowMs = 0,
  kickoffTeam: TeamId = "X"
): MatchState {
  const kickoffPlayerId = config.kickoffPlayerByTeam[kickoffTeam];
  const kickoffPlayer = config.players.find((player) => player.id === kickoffPlayerId);

  if (!kickoffPlayer) {
    throw new Error(`Missing kickoff player for ${kickoffTeam}`);
  }

  return {
    phase: "OFFENSE_SELECT",
    players: makePlayerState(config, kickoffPlayerId),
    scores: { X: 0, O: 0 },
    possessionTeam: kickoffTeam,
    activePlayerId: kickoffPlayerId,
    ball: kickoffPlayer.home,
    selectionDeadlineAtMs: nowMs + config.selection.offenseSelectionMs,
    lastEvent: `${config.teams[kickoffTeam].name} kickoff`,
    nextPlayId: 1,
    stats: makeStats(),
  };
}

export function getActivePlayer(state: MatchState) {
  const player = getPlayer(state, state.activePlayerId);
  if (!player) {
    throw new Error(`Missing active player ${state.activePlayerId}`);
  }
  return player;
}

export function getGoalForScoringTeam(config: SoccerTypingConfig, team: TeamId) {
  return config.goals.find((goal) => goal.scoringTeam === team);
}

export function getSelectableOffenseTargets(
  state: MatchState,
  config: SoccerTypingConfig = DEFAULT_SOCCER_CONFIG
): PlayTarget[] {
  const activePlayer = getActivePlayer(state);
  const teammates = state.players
    .filter((player) => player.team === activePlayer.team && player.id !== activePlayer.id)
    .map((player) => ({
      kind: "player" as const,
      id: player.id,
      key: player.key,
      label: player.name,
      point: player.position,
      team: player.team,
    }));
  const goal = getGoalForScoringTeam(config, activePlayer.team);
  const goals = goal
    ? [
        {
          kind: "goal" as const,
          id: goal.id,
          key: goal.key,
          label: goal.label,
          point: goal.point,
          scoringTeam: goal.scoringTeam,
        },
      ]
    : [];

  return [...teammates, ...goals];
}

export function selectOffensiveTarget(
  state: MatchState,
  key: string,
  nowMs: number,
  config: SoccerTypingConfig = DEFAULT_SOCCER_CONFIG,
  rng: Rng = Math.random
): MatchState {
  if (state.phase !== "OFFENSE_SELECT") return state;
  if (state.selectionDeadlineAtMs !== undefined && nowMs >= state.selectionDeadlineAtMs) {
    return handleOffenseSelectionTimeout(state, nowMs, config);
  }

  const normalizedKey = normalizeKey(key);
  const target = getSelectableOffenseTargets(state, config).find(
    (candidate) => candidate.key.toUpperCase() === normalizedKey
  );
  if (!target) return state;

  const activePlayer = getActivePlayer(state);
  const playDistance = distance(activePlayer.position, target.point);
  const offensePhrase = choosePhraseForDistance(
    playDistance,
    config.phraseScaling,
    config.phraseBank,
    rng
  );
  const play: LockedPlay = {
    id: state.nextPlayId,
    offenseTeam: activePlayer.team,
    defenseTeam: otherTeam(activePlayer.team),
    originPlayerId: activePlayer.id,
    origin: activePlayer.position,
    target,
    distance: playDistance,
    offensePhrase,
    offenseStartedAtMs: nowMs,
    eligibleInterceptions: [],
  };

  return {
    ...state,
    phase: "OFFENSE_TYPING",
    currentPlay: play,
    activeChallenge: createTypingChallenge(offensePhrase, nowMs),
    selectionDeadlineAtMs: undefined,
    lastEvent:
      target.kind === "goal"
        ? `${activePlayer.key} lines up a shot to ${target.key}`
        : `${activePlayer.key} aims a pass to ${target.key}`,
    nextPlayId: state.nextPlayId + 1,
  };
}

function completeOffenseChallenge(
  state: MatchState,
  completedChallenge: TypingChallenge,
  nowMs: number,
  config: SoccerTypingConfig,
  rng: Rng
): MatchState {
  if (!state.currentPlay) return state;

  const elapsedMs = Math.max(
    MIN_MODELED_TRAVEL_MS,
    (completedChallenge.completedAtMs ?? nowMs) - completedChallenge.startedAtMs
  );
  const offenseStats = getTypingStats(completedChallenge, nowMs);
  const playWithElapsed: LockedPlay = {
    ...state.currentPlay,
    offenseCompletedAtMs: completedChallenge.completedAtMs ?? nowMs,
    offenseElapsedMs: elapsedMs,
  };
  const eligibleInterceptions = createInterceptionOptions(
    state.players,
    playWithElapsed,
    playWithElapsed.defenseTeam
  ).map((option) => ({
    ...option,
    defensiveTimeLimitMs: computeDefensiveTimeLimitMs(
      elapsedMs,
      playWithElapsed.distance,
      option.distanceFromOrigin
    ),
  }));
  const play = {
    ...playWithElapsed,
    eligibleInterceptions,
  };
  const nextState = {
    ...state,
    currentPlay: play,
    activeChallenge: undefined,
    stats: {
      ...state.stats,
      shotsTaken:
        play.target.kind === "goal" ? state.stats.shotsTaken + 1 : state.stats.shotsTaken,
      offenseChallenges: [...state.stats.offenseChallenges, offenseStats],
    },
  };

  if (eligibleInterceptions.length === 0) {
    return resolvePlaySuccess(nextState, nowMs, config);
  }

  return {
    ...nextState,
    phase: "DEFENSE_SELECT",
    selectionDeadlineAtMs: nowMs + config.selection.defenseSelectionMs,
    lastEvent: "Defense can choose an interceptor",
  };
}

export function handleTypingKey(
  state: MatchState,
  key: string,
  nowMs: number,
  config: SoccerTypingConfig = DEFAULT_SOCCER_CONFIG,
  rng: Rng = Math.random
): MatchState {
  if (!state.activeChallenge) return state;

  if (state.phase === "DEFENSE_TYPING" && state.currentPlay?.defenseDeadlineAtMs !== undefined) {
    if (nowMs > state.currentPlay.defenseDeadlineAtMs) {
      return resolvePlaySuccess(state, nowMs, config);
    }
  }

  const challenge = applyTypingKey(state.activeChallenge, key, nowMs);
  const withChallenge = {
    ...state,
    activeChallenge: challenge,
  };

  if (!isChallengeComplete(challenge)) {
    return withChallenge;
  }

  if (state.phase === "OFFENSE_TYPING") {
    return completeOffenseChallenge(withChallenge, challenge, nowMs, config, rng);
  }

  if (state.phase === "DEFENSE_TYPING") {
    const deadline = state.currentPlay?.defenseDeadlineAtMs ?? nowMs;
    const defenseStats = getTypingStats(challenge, nowMs);
    const withStats = {
      ...withChallenge,
      stats: {
        ...withChallenge.stats,
        defenseChallenges: [...withChallenge.stats.defenseChallenges, defenseStats],
      },
    };

    if ((challenge.completedAtMs ?? nowMs) <= deadline) {
      return resolveInterception(withStats, nowMs, config);
    }

    return resolvePlaySuccess(withStats, nowMs, config);
  }

  return withChallenge;
}

export function selectDefender(
  state: MatchState,
  key: string,
  nowMs: number,
  config: SoccerTypingConfig = DEFAULT_SOCCER_CONFIG,
  rng: Rng = Math.random
): MatchState {
  if (state.phase !== "DEFENSE_SELECT" || !state.currentPlay) return state;
  if (state.selectionDeadlineAtMs !== undefined && nowMs >= state.selectionDeadlineAtMs) {
    return resolvePlaySuccess(state, nowMs, config);
  }

  const normalizedKey = normalizeKey(key);
  const selectedInterception = state.currentPlay.eligibleInterceptions.find(
    (option) => option.defenderKey.toUpperCase() === normalizedKey
  );
  if (!selectedInterception) return state;

  const defensePhrase = choosePhraseForDistance(
    selectedInterception.distanceToPath,
    config.defensePhraseScaling,
    config.phraseBank,
    rng
  );
  const play: LockedPlay = {
    ...state.currentPlay,
    selectedInterception,
    defensePhrase,
    defenseStartedAtMs: nowMs,
    defenseDeadlineAtMs: nowMs + selectedInterception.defensiveTimeLimitMs,
  };

  return {
    ...state,
    phase: "DEFENSE_TYPING",
    currentPlay: play,
    activeChallenge: createTypingChallenge(defensePhrase, nowMs),
    selectionDeadlineAtMs: undefined,
    lastEvent: `${selectedInterception.defenderKey} races to intercept`,
  };
}

function ageTemporaryPositions(players: PlayerState[], skipPlayerId?: string) {
  return players.map((player) => {
    if (!player.temporary || player.id === skipPlayerId) return player;

    const turnsRemaining = player.temporary.turnsRemaining - 1;
    if (turnsRemaining > 0) {
      return {
        ...player,
        temporary: {
          ...player.temporary,
          turnsRemaining,
        },
      };
    }

    return {
      ...player,
      position: player.home,
      temporary: undefined,
    };
  });
}

function syncBallToCarrier(state: MatchState) {
  const carrier = getPlayer(state, state.activePlayerId);
  return carrier ? carrier.position : state.ball;
}

export function resolvePlaySuccess(
  state: MatchState,
  nowMs: number,
  config: SoccerTypingConfig = DEFAULT_SOCCER_CONFIG
): MatchState {
  if (!state.currentPlay) return state;

  const play = state.currentPlay;
  const agedPlayers = ageTemporaryPositions(state.players);

  if (play.target.kind === "player") {
    const playersWithCarrier = setBallCarrier(agedPlayers, play.target.id);
    const receiver = playersWithCarrier.find((player) => player.id === play.target.id);

    return {
      ...state,
      phase: "OFFENSE_SELECT",
      players: playersWithCarrier,
      activePlayerId: play.target.id,
      possessionTeam: play.offenseTeam,
      ball: receiver?.position ?? play.target.point,
      currentPlay: undefined,
      activeChallenge: undefined,
      selectionDeadlineAtMs: nowMs + config.selection.offenseSelectionMs,
      lastEvent: `${play.target.key} receives the pass`,
      stats: {
        ...state.stats,
        passesCompleted: state.stats.passesCompleted + 1,
      },
    };
  }

  const scoringTeam = play.target.scoringTeam ?? play.offenseTeam;
  const nextScores = {
    ...state.scores,
    [scoringTeam]: state.scores[scoringTeam] + 1,
  };
  const nextGoalStats = {
    ...state.stats.goals,
    [scoringTeam]: state.stats.goals[scoringTeam] + 1,
  };

  if (nextScores[scoringTeam] >= config.winningScore) {
    return {
      ...state,
      phase: "MATCH_COMPLETE",
      scores: nextScores,
      ball: play.target.point,
      currentPlay: undefined,
      activeChallenge: undefined,
      selectionDeadlineAtMs: undefined,
      winner: scoringTeam,
      lastEvent: `${config.teams[scoringTeam].name} wins the match`,
      stats: {
        ...state.stats,
        goals: nextGoalStats,
      },
    };
  }

  const concedingTeam = otherTeam(scoringTeam);
  const kickoffPlayerId = config.kickoffPlayerByTeam[concedingTeam];
  const resetPlayers = resetPlayersToHome(agedPlayers, kickoffPlayerId);
  const kickoffPlayer = resetPlayers.find((player) => player.id === kickoffPlayerId);

  return {
    ...state,
    phase: "OFFENSE_SELECT",
    players: resetPlayers,
    scores: nextScores,
    possessionTeam: concedingTeam,
    activePlayerId: kickoffPlayerId,
    ball: kickoffPlayer?.position ?? play.target.point,
    currentPlay: undefined,
    activeChallenge: undefined,
    selectionDeadlineAtMs: nowMs + config.selection.offenseSelectionMs,
    lastEvent: `Goal for ${config.teams[scoringTeam].name}`,
    stats: {
      ...state.stats,
      goals: nextGoalStats,
    },
  };
}

export function resolveInterception(
  state: MatchState,
  nowMs: number,
  config: SoccerTypingConfig = DEFAULT_SOCCER_CONFIG
): MatchState {
  const play = state.currentPlay;
  const selected = play?.selectedInterception;
  if (!play || !selected) return state;

  const agedPlayers = ageTemporaryPositions(state.players, selected.defenderId);
  const players = agedPlayers.map((player) => {
    if (player.id !== selected.defenderId) {
      return {
        ...player,
        hasBall: false,
      };
    }

    return {
      ...player,
      position: selected.interceptionPoint,
      hasBall: true,
      temporary: {
        interceptionPlayId: play.id,
        turnsRemaining: 2,
      },
    };
  });

  return {
    ...state,
    phase: "OFFENSE_SELECT",
    players,
    possessionTeam: selected.defenderTeam,
    activePlayerId: selected.defenderId,
    ball: selected.interceptionPoint,
    currentPlay: undefined,
    activeChallenge: undefined,
    selectionDeadlineAtMs: nowMs + config.selection.offenseSelectionMs,
    lastEvent: `${selected.defenderKey} wins the ball`,
    stats: {
      ...state.stats,
      interceptions: {
        ...state.stats.interceptions,
        [selected.defenderTeam]: state.stats.interceptions[selected.defenderTeam] + 1,
      },
    },
  };
}

export function handleDefenseTypingTimeout(
  state: MatchState,
  nowMs: number,
  config: SoccerTypingConfig = DEFAULT_SOCCER_CONFIG
) {
  if (state.phase !== "DEFENSE_TYPING" || !state.currentPlay?.defenseDeadlineAtMs) return state;
  if (nowMs < state.currentPlay.defenseDeadlineAtMs) return state;

  const challenge = state.activeChallenge;
  const defenseStats = challenge ? getTypingStats(challenge, nowMs) : undefined;
  const withStats = defenseStats
    ? {
        ...state,
        stats: {
          ...state.stats,
          defenseChallenges: [...state.stats.defenseChallenges, defenseStats],
        },
      }
    : state;

  return resolvePlaySuccess(withStats, nowMs, config);
}

export function handleDefenseSelectionTimeout(
  state: MatchState,
  nowMs: number,
  config: SoccerTypingConfig = DEFAULT_SOCCER_CONFIG
) {
  if (state.phase !== "DEFENSE_SELECT") return state;
  if (state.selectionDeadlineAtMs !== undefined && nowMs < state.selectionDeadlineAtMs) return state;
  return resolvePlaySuccess(state, nowMs, config);
}

export function closestOpponentToPoint(players: PlayerState[], team: TeamId, point: { x: number; y: number }) {
  return players
    .filter((player) => player.team !== team)
    .sort((a, b) => distance(a.position, point) - distance(b.position, point))[0];
}

export function handleOffenseSelectionTimeout(
  state: MatchState,
  nowMs: number,
  config: SoccerTypingConfig = DEFAULT_SOCCER_CONFIG
): MatchState {
  if (state.phase !== "OFFENSE_SELECT") return state;
  if (state.selectionDeadlineAtMs !== undefined && nowMs < state.selectionDeadlineAtMs) return state;

  const activePlayer = getActivePlayer(state);
  const newCarrier = closestOpponentToPoint(state.players, activePlayer.team, activePlayer.position);
  if (!newCarrier) return state;

  const agedPlayers = ageTemporaryPositions(state.players);
  const players = setBallCarrier(agedPlayers, newCarrier.id);
  const carrierAfterAging = players.find((player) => player.id === newCarrier.id) ?? newCarrier;

  return {
    ...state,
    phase: "OFFENSE_SELECT",
    players,
    possessionTeam: newCarrier.team,
    activePlayerId: newCarrier.id,
    ball: carrierAfterAging.position,
    currentPlay: undefined,
    activeChallenge: undefined,
    selectionDeadlineAtMs: nowMs + config.selection.offenseSelectionMs,
    lastEvent: `${newCarrier.key} takes over after hesitation`,
    stats: {
      ...state.stats,
      turnovers: {
        ...state.stats.turnovers,
        [newCarrier.team]: state.stats.turnovers[newCarrier.team] + 1,
      },
    },
  };
}

export function checkHiddenDeadlines(
  state: MatchState,
  nowMs: number,
  config: SoccerTypingConfig = DEFAULT_SOCCER_CONFIG
) {
  if (state.phase === "OFFENSE_SELECT") {
    return handleOffenseSelectionTimeout(state, nowMs, config);
  }
  if (state.phase === "DEFENSE_SELECT") {
    return handleDefenseSelectionTimeout(state, nowMs, config);
  }
  if (state.phase === "DEFENSE_TYPING") {
    return handleDefenseTypingTimeout(state, nowMs, config);
  }
  return state;
}

export function getModeledBallPosition(state: MatchState, nowMs: number) {
  const play = state.currentPlay;
  if (state.phase === "DEFENSE_TYPING" && play?.defenseStartedAtMs !== undefined) {
    const elapsedMs = Math.max(0, nowMs - play.defenseStartedAtMs);
    const progress = clamp(elapsedMs / Math.max(MIN_MODELED_TRAVEL_MS, play.offenseElapsedMs ?? 1), 0, 1);
    return lerpPoint(play.origin, play.target.point, progress);
  }

  return syncBallToCarrier(state);
}

export function shiftActiveClocks(state: MatchState, pauseMs: number): MatchState {
  if (pauseMs <= 0) return state;

  const shiftedChallenge = state.activeChallenge
    ? {
        ...state.activeChallenge,
        startedAtMs: state.activeChallenge.startedAtMs + pauseMs,
        completedAtMs:
          state.activeChallenge.completedAtMs === undefined
            ? undefined
            : state.activeChallenge.completedAtMs + pauseMs,
      }
    : undefined;
  const shiftedPlay = state.currentPlay
    ? {
        ...state.currentPlay,
        offenseStartedAtMs: state.currentPlay.offenseStartedAtMs + pauseMs,
        offenseCompletedAtMs:
          state.currentPlay.offenseCompletedAtMs === undefined
            ? undefined
            : state.currentPlay.offenseCompletedAtMs + pauseMs,
        defenseStartedAtMs:
          state.currentPlay.defenseStartedAtMs === undefined
            ? undefined
            : state.currentPlay.defenseStartedAtMs + pauseMs,
        defenseDeadlineAtMs:
          state.currentPlay.defenseDeadlineAtMs === undefined
            ? undefined
            : state.currentPlay.defenseDeadlineAtMs + pauseMs,
      }
    : undefined;

  return {
    ...state,
    activeChallenge: shiftedChallenge,
    currentPlay: shiftedPlay,
    selectionDeadlineAtMs:
      state.selectionDeadlineAtMs === undefined ? undefined : state.selectionDeadlineAtMs + pauseMs,
  };
}

export function typeFullPhrase(
  state: MatchState,
  startMs: number,
  stepMs: number,
  config: SoccerTypingConfig = DEFAULT_SOCCER_CONFIG,
  rng: Rng = Math.random
) {
  let next = state;
  const phrase = state.activeChallenge?.phrase ?? "";
  phrase.split("").forEach((character, index) => {
    next = handleTypingKey(next, character, startMs + index * stepMs, config, rng);
  });
  return next;
}

export { otherTeam };
