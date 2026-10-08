import {
  ComboRecap,
  Direction,
  DIRECTIONS,
  GameState,
  MatchSettings,
  MatchStats,
  PlayerId,
  PlayerState,
  PlayerStats,
  Rng,
} from "../types/shadowBoxing";
import {
  generateAttackTargets,
  generateRelatedQuestion,
} from "./questionGenerator";
import { getDefenderTimeLimitMs } from "./timing";

export const DEFAULT_MATCH_HEARTS = 3;

export const DEFAULT_SETTINGS: MatchSettings = {
  difficulty: "medium",
  topic: "mixed",
  trickMe: false,
  hearts: DEFAULT_MATCH_HEARTS,
  lessDecisions: false,
  comboHitsRequired: 3,
};

function getDecisionDirections(settings: MatchSettings): Direction[] {
  return settings.lessDecisions ? ["left", "right"] : [...DIRECTIONS];
}

function opponentOf(playerId: PlayerId): PlayerId {
  return playerId === "player" ? "computer" : "player";
}

function createPlayerStats(): PlayerStats {
  return {
    attackAttempts: 0,
    attackCorrect: 0,
    attackTimesMs: [],
    defenseAttempts: 0,
    defenseSuccesses: 0,
    defenseTimeouts: 0,
    successfulCounters: 0,
    heartsLost: 0,
    conceptsMissed: [],
    conceptsCorrected: [],
  };
}

function createStats(startedAtMs: number): MatchStats {
  return {
    startedAtMs,
    byPlayer: {
      player: createPlayerStats(),
      computer: createPlayerStats(),
    },
  };
}

function normalizeSettings(settings: MatchSettings): MatchSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    hearts: Math.max(1, settings.hearts || DEFAULT_MATCH_HEARTS),
    comboHitsRequired: Math.max(1, settings.comboHitsRequired || 3),
  };
}

function createPlayers(hearts: number): Record<PlayerId, PlayerState> {
  return {
    player: {
      id: "player",
      label: "You",
      controller: "local",
      hearts,
    },
    computer: {
      id: "computer",
      label: "Computer",
      controller: "ai",
      hearts,
    },
  };
}

function addUnique(values: string[], value: string): string[] {
  if (values.includes(value)) {
    return values;
  }

  return [...values, value];
}

function updatePlayerStats(
  state: GameState,
  playerId: PlayerId,
  updater: (stats: PlayerStats) => PlayerStats
): GameState {
  return {
    ...state,
    stats: {
      ...state.stats,
      byPlayer: {
        ...state.stats.byPlayer,
        [playerId]: updater(state.stats.byPlayer[playerId]),
      },
    },
  };
}

function recordAttackAttempt(
  state: GameState,
  playerId: PlayerId,
  correct: boolean,
  attackTimeMs?: number,
  missedConcept?: string
): GameState {
  return updatePlayerStats(state, playerId, (stats) => ({
    ...stats,
    attackAttempts: stats.attackAttempts + 1,
    attackCorrect: correct ? stats.attackCorrect + 1 : stats.attackCorrect,
    attackTimesMs:
      correct && typeof attackTimeMs === "number"
        ? [...stats.attackTimesMs, attackTimeMs]
        : stats.attackTimesMs,
    conceptsMissed:
      !correct && missedConcept
        ? addUnique(stats.conceptsMissed, missedConcept)
        : stats.conceptsMissed,
  }));
}

function recordDefenseAttempt(
  state: GameState,
  playerId: PlayerId,
  result: "success" | "miss" | "timeout",
  concept: string
): GameState {
  return updatePlayerStats(state, playerId, (stats) => ({
    ...stats,
    defenseAttempts: stats.defenseAttempts + 1,
    defenseSuccesses:
      result === "success" ? stats.defenseSuccesses + 1 : stats.defenseSuccesses,
    defenseTimeouts:
      result === "timeout" ? stats.defenseTimeouts + 1 : stats.defenseTimeouts,
    successfulCounters:
      result === "success"
        ? stats.successfulCounters + 1
        : stats.successfulCounters,
    conceptsMissed:
      result === "success"
        ? stats.conceptsMissed
        : addUnique(stats.conceptsMissed, concept),
  }));
}

function recordCorrection(
  state: GameState,
  playerId: PlayerId,
  concept: string
): GameState {
  return updatePlayerStats(state, playerId, (stats) => ({
    ...stats,
    conceptsCorrected: addUnique(stats.conceptsCorrected, concept),
  }));
}

function recordHeartLost(state: GameState, playerId: PlayerId): GameState {
  const nextPlayer = {
    ...state.players[playerId],
    hearts: Math.max(0, state.players[playerId].hearts - 1),
  };

  const nextState = updatePlayerStats(state, playerId, (stats) => ({
    ...stats,
    heartsLost: stats.heartsLost + 1,
  }));

  return {
    ...nextState,
    players: {
      ...nextState.players,
      [playerId]: nextPlayer,
    },
  };
}

function recentWithConcept(state: GameState, conceptId: string): string[] {
  return [conceptId, ...state.recentConceptIds.filter((id) => id !== conceptId)].slice(
    0,
    12
  );
}

function createAttackPrompt(
  state: Pick<GameState, "settings" | "recentConceptIds" | "comboFailures" | "failedConceptIds">,
  rng: Rng,
  preferredConceptIds: string[] = []
) {
  const targets = generateAttackTargets(
    state.settings.topic,
    rng,
    state.recentConceptIds,
    preferredConceptIds
  );
  const selectedTarget = targets[0];
  const attackQuestion = generateRelatedQuestion(
    selectedTarget.concept,
    state.settings.trickMe,
    rng,
    undefined,
    getDecisionDirections(state.settings)
  );

  return {
    currentTargets: [selectedTarget],
    selectedAttackTarget: selectedTarget,
    attackQuestion,
  };
}

export function createNewMatch(
  settings: MatchSettings = DEFAULT_SETTINGS,
  now: number,
  rng: Rng = Math.random
): GameState {
  const normalizedSettings = normalizeSettings(settings);
  const seedState = {
    settings: normalizedSettings,
    recentConceptIds: [],
    comboFailures: 0,
    failedConceptIds: [],
  };
  const attackPrompt = createAttackPrompt(seedState, rng);

  return {
    phase: "attacker-answer",
    settings: normalizedSettings,
    players: createPlayers(normalizedSettings.hearts),
    attackerId: "player",
    defenderId: "computer",
    comboFailures: 0,
    failedConceptIds: [],
    comboRecaps: [],
    recentConceptIds: [attackPrompt.selectedAttackTarget.concept.id],
    currentTargets: attackPrompt.currentTargets,
    selectedAttackTarget: attackPrompt.selectedAttackTarget,
    attackQuestion: attackPrompt.attackQuestion,
    attackStartTimeMs: now,
    message: "ATTACK",
    stats: createStats(now),
  };
}

export function beginNextAttack(
  state: GameState,
  now: number,
  rng: Rng = Math.random
): GameState {
  const comboRecall =
    state.comboFailures >= 2 && state.failedConceptIds.length >= 2;
  const preferredConceptIds = comboRecall
    ? state.failedConceptIds.slice(0, 2)
    : [];
  const attackPrompt = createAttackPrompt(state, rng, preferredConceptIds);

  return {
    ...state,
    phase: "attacker-answer",
    currentTargets: attackPrompt.currentTargets,
    attackStartTimeMs: now,
    selectedAttackTarget: attackPrompt.selectedAttackTarget,
    attackQuestion: attackPrompt.attackQuestion,
    recentConceptIds: recentWithConcept(
      state,
      attackPrompt.selectedAttackTarget.concept.id
    ),
    currentAttack: undefined,
    defenseDeadlineMs: undefined,
    correctionReplay: undefined,
    message: comboRecall ? "COMBO RECALL" : "ATTACK",
    lastOutcome: undefined,
  };
}

function switchAttackControl(state: GameState, message: string): GameState {
  return {
    ...state,
    phase: "role-switch",
    attackerId: state.defenderId,
    defenderId: state.attackerId,
    comboFailures: 0,
    failedConceptIds: [],
    comboRecaps: [],
    currentAttack: undefined,
    defenseDeadlineMs: undefined,
    correctionReplay: undefined,
    message,
    lastOutcome: message,
  };
}

export function continueAfterRoleSwitch(
  state: GameState,
  now: number,
  rng: Rng = Math.random
): GameState {
  if (state.phase !== "role-switch") {
    return state;
  }

  return beginNextAttack(state, now, rng);
}

export function continueAfterHeartLost(
  state: GameState,
  now: number,
  rng: Rng = Math.random
): GameState {
  if (state.phase !== "heart-lost") {
    return state;
  }

  return beginNextAttack(state, now, rng);
}

export function selectAttackTarget(
  state: GameState,
  direction: Direction,
  rng: Rng = Math.random
): GameState {
  if (state.phase !== "attacker-target" && state.phase !== "combo-recall") {
    return state;
  }

  const target = state.currentTargets.find(
    (option) => option.direction === direction
  );
  if (!target) {
    return state;
  }

  return {
    ...state,
    phase: "attacker-answer",
    selectedAttackTarget: target,
    attackQuestion: generateRelatedQuestion(
      target.concept,
      state.settings.trickMe,
      rng,
      undefined,
      getDecisionDirections(state.settings)
    ),
    recentConceptIds: recentWithConcept(state, target.concept.id),
    message: "PROVE IT",
  };
}

export function answerAttackQuestion(
  state: GameState,
  direction: Direction,
  now: number,
  rng: Rng = Math.random
): GameState {
  if (
    state.phase !== "attacker-answer" ||
    !state.attackQuestion ||
    !state.selectedAttackTarget ||
    typeof state.attackStartTimeMs !== "number"
  ) {
    return state;
  }

  const correct = direction === state.attackQuestion.correctDirection;
  const attackTimeMs = Math.max(0, now - state.attackStartTimeMs);
  let nextState = recordAttackAttempt(
    state,
    state.attackerId,
    correct,
    attackTimeMs,
    state.selectedAttackTarget.concept.term
  );

  if (!correct) {
    return switchAttackControl(nextState, "WHIFF");
  }

  const defenderTimeLimitMs = getDefenderTimeLimitMs(attackTimeMs);
  const defenseQuestion = generateRelatedQuestion(
    state.selectedAttackTarget.concept,
    state.settings.trickMe,
    rng,
    undefined,
    getDecisionDirections(state.settings)
  );

  return {
    ...nextState,
    phase: "defender-live",
    currentAttack: {
      attackerId: state.attackerId,
      defenderId: state.defenderId,
      attackDirection: state.selectedAttackTarget.direction,
      targetConcept: state.selectedAttackTarget.concept,
      attackQuestion: state.attackQuestion,
      attackStartedAtMs: state.attackStartTimeMs,
      attackTimeMs,
      defenderTimeLimitMs,
      defenseQuestion,
    },
    defenseDeadlineMs: now + defenderTimeLimitMs,
    message: "DEFEND",
    lastOutcome: "ATTACK THROWN",
  };
}

function applyDefensiveFailure(
  state: GameState,
  result: "miss" | "timeout"
): GameState {
  if (!state.currentAttack) {
    return state;
  }

  const nextFailures = state.comboFailures + 1;
  const failedConceptId = state.currentAttack.targetConcept.id;
  const failedConceptIds = addUnique(state.failedConceptIds, failedConceptId);
  const recap: ComboRecap = {
    conceptId: failedConceptId,
    prompt: state.currentAttack.defenseQuestion.prompt,
    correctAnswer: state.currentAttack.defenseQuestion.correctAnswer,
    correctDirection: state.currentAttack.defenseQuestion.correctDirection,
    options: state.currentAttack.defenseQuestion.options,
  };
  const comboRecaps = [...state.comboRecaps, recap];

  if (nextFailures >= state.settings.comboHitsRequired) {
    const afterHeart = recordHeartLost(state, state.defenderId);
    const defenderHearts = afterHeart.players[state.defenderId].hearts;

    if (defenderHearts <= 0) {
      return {
        ...afterHeart,
        phase: "game-over",
        comboFailures: 0,
        failedConceptIds: [],
        comboRecaps: [],
        winnerId: state.attackerId,
        currentAttack: undefined,
        defenseDeadlineMs: undefined,
        message: "HIT",
        lastOutcome: "GAME OVER",
        stats: {
          ...afterHeart.stats,
          endedAtMs: Date.now(),
        },
      };
    }

    return {
      ...afterHeart,
      phase: "heart-lost",
      comboFailures: 0,
      failedConceptIds: [],
      comboRecaps: [],
      currentAttack: undefined,
      defenseDeadlineMs: undefined,
      correctionReplay: undefined,
      message: "HIT",
      lastOutcome: "HIT",
    };
  }

  return {
    ...state,
    phase: "correction",
    comboFailures: nextFailures,
    failedConceptIds,
    comboRecaps,
    defenseDeadlineMs: undefined,
    correctionReplay: {
      attackDirection: state.currentAttack.attackDirection,
      targetConcept: state.currentAttack.targetConcept,
      question: state.currentAttack.defenseQuestion,
      recaps: comboRecaps,
    },
    message: result === "timeout" ? "TIMEOUT" : "MISS",
    lastOutcome: `FAIL #${nextFailures}`,
  };
}

export function answerDefenseQuestion(
  state: GameState,
  direction: Direction,
  _rng: Rng = Math.random
): GameState {
  if (state.phase !== "defender-live" || !state.currentAttack) {
    return state;
  }

  const correct = direction === state.currentAttack.defenseQuestion.correctDirection;
  const concept = state.currentAttack.targetConcept.term;
  const withStats = recordDefenseAttempt(
    state,
    state.defenderId,
    correct ? "success" : "miss",
    concept
  );

  if (correct) {
    return switchAttackControl(withStats, "COUNTER");
  }

  return applyDefensiveFailure(withStats, "miss");
}

export function handleDefenseTimeout(
  state: GameState,
  _rng: Rng = Math.random
): GameState {
  if (state.phase !== "defender-live" || !state.currentAttack) {
    return state;
  }

  const withStats = recordDefenseAttempt(
    state,
    state.defenderId,
    "timeout",
    state.currentAttack.targetConcept.term
  );

  return applyDefensiveFailure(withStats, "timeout");
}

export function completeCorrection(
  state: GameState,
  direction: Direction,
  now: number,
  rng: Rng = Math.random
): GameState {
  if (state.phase !== "correction" || !state.correctionReplay) {
    return state;
  }

  if (direction !== state.correctionReplay.question.correctDirection) {
    return {
      ...state,
      message: "CORRECT",
    };
  }

  const withStats = recordCorrection(
    state,
    state.defenderId,
    state.correctionReplay.targetConcept.term
  );

  return beginNextAttack(withStats, now, rng);
}

export function forceAttacker(
  state: GameState,
  attackerId: PlayerId,
  now: number,
  rng: Rng = Math.random
): GameState {
  return beginNextAttack(
    {
      ...state,
      attackerId,
      defenderId: opponentOf(attackerId),
      comboFailures: 0,
      failedConceptIds: [],
      comboRecaps: [],
      currentAttack: undefined,
      correctionReplay: undefined,
      defenseDeadlineMs: undefined,
      message: "ATTACK",
    },
    now,
    rng
  );
}

export function getAttackAccuracy(stats: PlayerStats): number {
  if (stats.attackAttempts === 0) {
    return 0;
  }

  return stats.attackCorrect / stats.attackAttempts;
}

export function getDefenseAccuracy(stats: PlayerStats): number {
  if (stats.defenseAttempts === 0) {
    return 0;
  }

  return stats.defenseSuccesses / stats.defenseAttempts;
}

