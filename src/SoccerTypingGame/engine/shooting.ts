import { repositionOffBallPlayers } from "./formations";
import { clamp, distance } from "./geometry";
import { applyTypingKey, createTypingChallenge, getTypingStats, isChallengeComplete } from "./typingChallenge";
import { MatchState, PlayerState, PlayTarget, Rng, ShotLocation, ShotState, ShotTarget, SoccerTypingConfig } from "./types";

export const SHOT_TARGETS = [
  { location: "tl" as const, phrase: "aim for goal" },
  { location: "tr" as const, phrase: "bend the net" },
  { location: "c" as const, phrase: "curl it home" },
  { location: "bl" as const, phrase: "drive it low" },
  { location: "br" as const, phrase: "edge of goal" },
];
export const SHOT_DURATIONS = { SHOT_CAMERA: 1800, SHOT_COUNTDOWN: 3000, SHOT_FLIGHT: 1500, SHOT_RESULT: 4000 };

export function getShotChances(shotDistance: number, fieldWidth: number) {
  return clamp(4 - Math.floor(Math.max(0, shotDistance) / (fieldWidth / 4)), 1, 4);
}

export function beginShot(state: MatchState, target: PlayTarget, nowMs: number, config: SoccerTypingConfig): MatchState {
  const shooter = state.players.find((player) => player.id === state.activePlayerId)!;
  const defenseTeam = shooter.team === "X" ? "O" : "X";
  const goalkeeper = state.players.find((player) => player.team === defenseTeam && player.role === "goalkeeper");
  if (!goalkeeper) throw new Error("Shooting requires a defending goalkeeper");
  const shotDistance = distance(shooter.position, target.point);
  return {
    ...state,
    phase: "SHOT_READY",
    shot: {
      offenseTeam: shooter.team, defenseTeam, shooterId: shooter.id, goalkeeperId: goalkeeper.id,
      distance: shotDistance, chances: getShotChances(shotDistance, config.field.width),
      round: "attacker", targets: SHOT_TARGETS.map((entry) => ({ ...entry })), phaseStartedAtMs: nowMs,
    },
    currentPlay: undefined, activeChallenge: undefined, selectionDeadlineAtMs: undefined,
    stats: { ...state.stats, shotsTaken: state.stats.shotsTaken + 1 },
    lastEvent: `${config.teams[shooter.team].name} lines up a shot`,
  };
}

function isShotTargetBlocked(target: ShotTarget) {
  return target.attackerMs !== undefined && target.defenderMs !== undefined && target.defenderMs < target.attackerMs;
}

export function getShotGoalProbability(shot: ShotState) {
  if (shot.targets.length === 0) return 0;
  const openLocations = shot.targets.filter((target) => target.attackerMs !== undefined && !isShotTargetBlocked(target)).length;
  return 1 - Math.pow(1 - openLocations / shot.targets.length, shot.chances);
}

export function rollShot(shot: ShotState, rng: Rng): NonNullable<ShotState["result"]> {
  const blocked = shot.targets.filter(isShotTargetBlocked).map((target) => target.location);
  const rolls = Array.from({ length: shot.chances }, () => shot.targets[clamp(Math.floor(rng() * 5), 0, 4)].location);
  const winners = Array.from(new Set(rolls.filter((location) => !blocked.includes(location))));
  const outcomes = winners.length ? winners : rolls;
  return {
    scored: winners.length > 0,
    location: outcomes[clamp(Math.floor(rng() * outcomes.length), 0, outcomes.length - 1)],
    rolls, blocked,
  };
}

export function handleShotKey(state: MatchState, key: string, nowMs: number, rng: Rng): MatchState {
  const shot = state.shot;
  if (!shot) return state;
  if (key === "Enter") {
    if (state.phase === "SHOT_READY") {
      return { ...state, phase: "SHOT_TYPING", shot: { ...shot, phaseStartedAtMs: nowMs } };
    }
    if (state.phase !== "SHOT_WORD_READY") return state;
    const finished = shot.targets.every((target) => (shot.round === "attacker" ? target.attackerMs : target.defenderMs) !== undefined);
    if (!finished) return { ...state, phase: "SHOT_TYPING", activeChallenge: undefined, shot: { ...shot, activeLocation: undefined } };
    if (shot.round === "attacker") {
      return { ...state, phase: "SHOT_READY", activeChallenge: undefined,
        shot: { ...shot, round: "defender", activeLocation: undefined, phaseStartedAtMs: nowMs } };
    }
    return { ...state, phase: "SHOT_CAMERA", activeChallenge: undefined,
      shot: { ...shot, activeLocation: undefined, result: rollShot(shot, rng), phaseStartedAtMs: nowMs } };
  }
  if (state.phase !== "SHOT_TYPING") return state;
  let challenge = state.activeChallenge;
  let activeLocation = shot.activeLocation;
  if (!challenge) {
    const target = shot.targets.find((entry) => entry.phrase[0] === key &&
      (shot.round === "attacker" ? entry.attackerMs : entry.defenderMs) === undefined);
    if (!target) return state;
    activeLocation = target.location;
    challenge = createTypingChallenge(target.phrase, nowMs);
  }
  challenge = applyTypingKey(challenge, key, nowMs);
  const next = { ...state, activeChallenge: challenge, shot: { ...shot, activeLocation } };
  if (!isChallengeComplete(challenge)) return next;
  const stats = getTypingStats(challenge, nowMs);
  const statsKey = shot.round === "attacker" ? "offenseChallenges" : "defenseChallenges";
  return {
    ...next, phase: "SHOT_WORD_READY",
    shot: { ...next.shot, targets: shot.targets.map((entry) => entry.location === activeLocation
      ? { ...entry, [shot.round === "attacker" ? "attackerMs" : "defenderMs"]: stats.elapsedMs } : entry) },
    stats: { ...state.stats, [statsKey]: [...state.stats[statsKey], stats] },
  };
}

export function getShotDeadline(state: MatchState): number | undefined {
  if (!state.shot || !(state.phase in SHOT_DURATIONS)) return undefined;
  return state.shot.phaseStartedAtMs + SHOT_DURATIONS[state.phase as keyof typeof SHOT_DURATIONS];
}

export function advanceShot(state: MatchState, nowMs: number, config: SoccerTypingConfig, rng: Rng): MatchState {
  const shot = state.shot;
  const deadline = getShotDeadline(state);
  if (!shot || deadline === undefined || nowMs < deadline) return state;
  if (state.phase === "SHOT_CAMERA" || state.phase === "SHOT_COUNTDOWN" || state.phase === "SHOT_FLIGHT") {
    const nextPhase = state.phase === "SHOT_CAMERA" ? "SHOT_COUNTDOWN" : state.phase === "SHOT_COUNTDOWN" ? "SHOT_FLIGHT" : "SHOT_RESULT";
    const scored = nextPhase === "SHOT_RESULT" && shot.result?.scored;
    return {
      ...state, phase: nextPhase, shot: { ...shot, phaseStartedAtMs: nowMs },
      scores: scored ? { ...state.scores, [shot.offenseTeam]: state.scores[shot.offenseTeam] + 1 } : state.scores,
      stats: scored ? { ...state.stats, goals: { ...state.stats.goals, [shot.offenseTeam]: state.stats.goals[shot.offenseTeam] + 1 } } : state.stats,
      lastEvent: nextPhase === "SHOT_RESULT" ? scored ? `Goal for ${config.teams[shot.offenseTeam].name}` : `${config.teams[shot.defenseTeam].name} goalkeeper saves` : state.lastEvent,
    };
  }
  const scored = shot.result?.scored;
  const carrierId = scored ? config.goalKickoffPlayerByTeam[shot.defenseTeam] : shot.goalkeeperId;
  const playersWithCarrier = state.players.map((player) => ({
    ...player, hasBall: player.id === carrierId,
    position: scored ? { ...player.home } : player.position, temporary: undefined,
  }));
  const players: PlayerState[] = scored ? playersWithCarrier : repositionOffBallPlayers(playersWithCarrier, config, rng);
  const winner = scored && state.scores[shot.offenseTeam] >= config.winningScore ? shot.offenseTeam : undefined;
  return {
    ...state, phase: winner ? "MATCH_COMPLETE" : "OFFENSE_READY", winner,
    shot: undefined, activeChallenge: undefined, currentPlay: undefined, selectionDeadlineAtMs: undefined,
    players, activePlayerId: carrierId, possessionTeam: shot.defenseTeam,
    ball: players.find((player) => player.id === carrierId)!.position,
    lastEvent: winner ? `${config.teams[winner].name} wins the match` : scored ? `Goal for ${config.teams[shot.offenseTeam].name}` : `${config.teams[shot.defenseTeam].name} goalkeeper saves`,
  };
}

export const SHOT_POINTS: Record<ShotLocation, { x: number; y: number }> = {
  tl: { x: 22, y: 25 }, tr: { x: 78, y: 25 }, c: { x: 50, y: 61 }, bl: { x: 22, y: 73 }, br: { x: 78, y: 73 },
};
