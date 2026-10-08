import { DEFAULT_SOCCER_CONFIG } from "../engine/config";
import {
  computeDefensiveTimeLimitMs,
  createInterceptionOptions,
  projectPointToSegment,
} from "../engine/geometry";
import {
  checkHiddenDeadlines,
  createInitialSoccerMatch,
  getSelectableOffenseTargets,
  handleDefenseSelectionTimeout,
  handleDefenseTypingTimeout,
  handleTypingKey,
  selectDefender,
  selectOffensiveTarget,
  typeFullPhrase,
} from "../engine/gameEngine";
import { scaleDistanceToCharacterCount } from "../engine/phrases";
import {
  applyTypingKey,
  createTypingChallenge,
  isChallengeComplete,
} from "../engine/typingChallenge";
import { LockedPlay, PlayerState } from "../engine/types";

declare const test: (name: string, fn: () => void) => void;
declare const expect: any;

const steadyRng = () => 0;

function typeActivePhrase(state: ReturnType<typeof createInitialSoccerMatch>, startMs: number, stepMs: number) {
  let next = state;
  const phrase = next.activeChallenge?.phrase ?? "";
  phrase.split("").forEach((character, index) => {
    next = handleTypingKey(next, character, startMs + (index + 1) * stepMs, DEFAULT_SOCCER_CONFIG, steadyRng);
  });
  return next;
}

function createShotWithDefense(startMs = 100, stepMs = 100) {
  let state = createInitialSoccerMatch(DEFAULT_SOCCER_CONFIG, 0);
  state = selectOffensiveTarget(state, "P", startMs, DEFAULT_SOCCER_CONFIG, steadyRng);
  state = typeActivePhrase(state, startMs, stepMs);
  expect(state.phase).toBe("DEFENSE_SELECT");
  expect(state.currentPlay?.eligibleInterceptions.length).toBeGreaterThan(0);
  return state;
}

test("target letters select players and goal locations", () => {
  let state = createInitialSoccerMatch(DEFAULT_SOCCER_CONFIG, 0);
  const active = state.players.find((player) => player.id === state.activePlayerId)!;
  const teammateTarget = getSelectableOffenseTargets(state, DEFAULT_SOCCER_CONFIG).find(
    (target) => target.kind === "player"
  )!;

  state = selectOffensiveTarget(state, teammateTarget.key, 100, DEFAULT_SOCCER_CONFIG, steadyRng);

  expect(state.phase).toBe("OFFENSE_TYPING");
  expect(state.currentPlay?.origin).toEqual(active.position);
  expect(state.currentPlay?.target.id).toBe(teammateTarget.id);

  state = createInitialSoccerMatch(DEFAULT_SOCCER_CONFIG, 0);
  state = selectOffensiveTarget(state, "P", 100, DEFAULT_SOCCER_CONFIG, steadyRng);

  expect(state.currentPlay?.target.kind).toBe("goal");
  expect(state.currentPlay?.target.point).toEqual({ x: 98, y: 30 });
});

test("phrase length increases with distance", () => {
  const shortPhraseLength = scaleDistanceToCharacterCount(8, DEFAULT_SOCCER_CONFIG.phraseScaling);
  const longPhraseLength = scaleDistanceToCharacterCount(90, DEFAULT_SOCCER_CONFIG.phraseScaling);

  expect(longPhraseLength).toBeGreaterThan(shortPhraseLength);
});

test("offensive typing time becomes modeled ball travel time", () => {
  let state = createInitialSoccerMatch(DEFAULT_SOCCER_CONFIG, 0);
  state = selectOffensiveTarget(state, "P", 100, DEFAULT_SOCCER_CONFIG, steadyRng);
  const phraseLength = state.activeChallenge!.phrase.length;
  state = typeActivePhrase(state, 100, 100);

  expect(state.currentPlay?.offenseElapsedMs).toBe(phraseLength * 100);
  expect(state.stats.offenseChallenges[0].elapsedMs).toBe(phraseLength * 100);
});

test("typing allows non-blocking errors and requires backspace correction", () => {
  let challenge = createTypingChallenge("ENGINEERING", 0);
  "ENGINXERING".split("").forEach((character, index) => {
    challenge = applyTypingKey(challenge, character, index + 1);
  });

  expect(challenge.typed).toBe("ENGINXERING");
  expect(challenge.incorrectKeystrokes).toBe(1);
  expect(isChallengeComplete(challenge)).toBe(false);

  challenge = applyTypingKey(challenge, "!", 20);
  expect(challenge.typed).toBe("ENGINXERING");

  for (let index = 0; index < 6; index += 1) {
    challenge = applyTypingKey(challenge, "Backspace", 30 + index);
  }
  "EERING".split("").forEach((character, index) => {
    challenge = applyTypingKey(challenge, character, 40 + index);
  });

  expect(challenge.typed).toBe("ENGINEERING");
  expect(challenge.incorrectKeystrokes).toBe(1);
  expect(challenge.backspaces).toBe(6);
  expect(isChallengeComplete(challenge)).toBe(true);
});

test("perpendicular geometry includes only intersections on the segment", () => {
  const inside = projectPointToSegment({ x: 5, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 });
  const outside = projectPointToSegment({ x: 12, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 });

  expect(inside.onSegment).toBe(true);
  expect(inside.point).toEqual({ x: 5, y: 0 });
  expect(inside.distance).toBeCloseTo(4);
  expect(outside.onSegment).toBe(false);
});

test("interception options exclude defenders whose projection is outside the pass", () => {
  const play: LockedPlay = {
    id: 1,
    offenseTeam: "X",
    defenseTeam: "O",
    originPlayerId: "x",
    origin: { x: 0, y: 0 },
    target: { kind: "player", id: "target", key: "T", label: "Target", point: { x: 10, y: 0 }, team: "X" },
    distance: 10,
    offensePhrase: "pass",
    offenseStartedAtMs: 0,
    offenseElapsedMs: 5000,
    eligibleInterceptions: [],
  };
  const players: PlayerState[] = [
    {
      id: "valid",
      team: "O",
      name: "Valid",
      key: "A",
      home: { x: 5, y: 3 },
      position: { x: 5, y: 3 },
      hasBall: false,
    },
    {
      id: "invalid",
      team: "O",
      name: "Invalid",
      key: "B",
      home: { x: 12, y: 3 },
      position: { x: 12, y: 3 },
      hasBall: false,
    },
  ];

  const options = createInterceptionOptions(players, play, "O");

  expect(options.map((option) => option.defenderId)).toEqual(["valid"]);
});

test("defensive time limit uses the offensive time and interception ratio", () => {
  expect(computeDefensiveTimeLimitMs(5000, 100, 60)).toBe(3000);
});

test("a successful defender changes possession and creates a temporary position", () => {
  let state = createShotWithDefense(100, 90);
  const defenderKey = state.currentPlay!.eligibleInterceptions[0].defenderKey;
  state = selectDefender(state, defenderKey, 2500, DEFAULT_SOCCER_CONFIG, steadyRng);
  const defenderId = state.currentPlay!.selectedInterception!.defenderId;
  const interceptionPoint = state.currentPlay!.selectedInterception!.interceptionPoint;

  state = typeFullPhrase(state, 2501, 1, DEFAULT_SOCCER_CONFIG, steadyRng);

  expect(state.phase).toBe("OFFENSE_SELECT");
  expect(state.activePlayerId).toBe(defenderId);
  expect(state.possessionTeam).toBe("O");
  expect(state.ball).toEqual(interceptionPoint);
  expect(state.players.find((player) => player.id === defenderId)?.temporary?.turnsRemaining).toBe(2);

  const immediateTarget = getSelectableOffenseTargets(state, DEFAULT_SOCCER_CONFIG)[0];
  state = selectOffensiveTarget(state, immediateTarget.key, 2600, DEFAULT_SOCCER_CONFIG, steadyRng);
  expect(state.phase).toBe("OFFENSE_TYPING");
});

test("a failed defensive challenge lets the shot score", () => {
  let state = createShotWithDefense(100, 80);
  const defenderKey = state.currentPlay!.eligibleInterceptions[0].defenderKey;
  state = selectDefender(state, defenderKey, 2200, DEFAULT_SOCCER_CONFIG, steadyRng);
  const deadline = state.currentPlay!.defenseDeadlineAtMs!;

  state = handleDefenseTypingTimeout(state, deadline + 1, DEFAULT_SOCCER_CONFIG);

  expect(state.scores.X).toBe(1);
  expect(state.phase).toBe("OFFENSE_SELECT");
  expect(state.possessionTeam).toBe("O");
});

test("temporary interception positions persist for the required resolved turns", () => {
  let state = createShotWithDefense(100, 90);
  state = selectDefender(
    state,
    state.currentPlay!.eligibleInterceptions[0].defenderKey,
    2500,
    DEFAULT_SOCCER_CONFIG,
    steadyRng
  );
  const defenderId = state.currentPlay!.selectedInterception!.defenderId;
  const interceptionPoint = state.currentPlay!.selectedInterception!.interceptionPoint;
  state = typeFullPhrase(state, 2501, 1, DEFAULT_SOCCER_CONFIG, steadyRng);

  const firstTarget = getSelectableOffenseTargets(state, DEFAULT_SOCCER_CONFIG).find(
    (target) => target.kind === "player"
  )!;
  state = selectOffensiveTarget(state, firstTarget.key, 2700, DEFAULT_SOCCER_CONFIG, steadyRng);
  state = typeActivePhrase(state, 2700, 10);
  if (state.phase === "DEFENSE_SELECT") {
    state = handleDefenseSelectionTimeout(state, state.selectionDeadlineAtMs! + 1, DEFAULT_SOCCER_CONFIG);
  }

  let defender = state.players.find((player) => player.id === defenderId)!;
  expect(defender.position).toEqual(interceptionPoint);
  expect(defender.temporary?.turnsRemaining).toBe(1);

  const secondTarget = getSelectableOffenseTargets(state, DEFAULT_SOCCER_CONFIG).find(
    (target) => target.kind === "player"
  )!;
  state = selectOffensiveTarget(state, secondTarget.key, 3500, DEFAULT_SOCCER_CONFIG, steadyRng);
  state = typeActivePhrase(state, 3500, 10);
  if (state.phase === "DEFENSE_SELECT") {
    state = handleDefenseSelectionTimeout(state, state.selectionDeadlineAtMs! + 1, DEFAULT_SOCCER_CONFIG);
  }

  defender = state.players.find((player) => player.id === defenderId)!;
  expect(defender.position).toEqual(defender.home);
  expect(defender.temporary).toBeUndefined();
});

test("selection deadlines resolve without changing the visible state machine contract", () => {
  let state = createInitialSoccerMatch(DEFAULT_SOCCER_CONFIG, 0);
  state = checkHiddenDeadlines(state, DEFAULT_SOCCER_CONFIG.selection.offenseSelectionMs + 1, DEFAULT_SOCCER_CONFIG);

  expect(state.phase).toBe("OFFENSE_SELECT");
  expect(state.possessionTeam).toBe("O");
  expect(state.stats.turnovers.O).toBe(1);
});
