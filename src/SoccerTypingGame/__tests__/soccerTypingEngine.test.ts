import { DEFAULT_SOCCER_CONFIG } from "../engine/config";
import { repositionOffBallPlayers } from "../engine/formations";
import {
  computeDefensiveTimeLimitMs,
  createInterceptionOptions,
  distance,
  projectPointToSegment,
} from "../engine/geometry";
import {
  checkHiddenDeadlines,
  createInitialSoccerMatch,
  getSelectableOffenseTargets,
  handleDefenseSelectionTimeout,
  handleDefenseTypingTimeout,
  handleTypingKey,
  proceedToNextPlay,
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
import { LockedPlay, MatchState, PlayerState } from "../engine/types";

declare const test: (name: string, fn: () => void) => void;
declare const expect: any;

const steadyRng = () => 0;

test("both formations cover both halves and leave room for player artwork", () => {
  const state = createInitialSoccerMatch(DEFAULT_SOCCER_CONFIG, 0);
  for (const team of ["X", "O"] as const) {
    const players = state.players.filter((player) => player.team === team);
    const xs = players.map((player) => player.position.x);
    const ys = players.map((player) => player.position.y);
    expect(Math.min(...xs)).toBeLessThan(30);
    expect(Math.max(...xs)).toBeGreaterThan(70);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(34);
  }

  state.players.forEach((player, index) => {
    const margin = player.role === "goalkeeper" ? 4 : 8;
    expect(player.position.x).toBeGreaterThanOrEqual(margin);
    expect(player.position.x).toBeLessThanOrEqual(DEFAULT_SOCCER_CONFIG.field.width - margin);
    expect(player.position.y).toBeGreaterThanOrEqual(10);
    expect(player.position.y).toBeLessThanOrEqual(DEFAULT_SOCCER_CONFIG.field.height - 7);
    state.players.slice(index + 1).forEach((other) => {
      expect(distance(player.position, other.position)).toBeGreaterThanOrEqual(10);
    });
  });
});

test("both teams have an interception opportunity on a long pass", () => {
  for (const team of ["X", "O"] as const) {
    let state = createInitialSoccerMatch(DEFAULT_SOCCER_CONFIG, 0, team);
    state = selectOffensiveTarget(state, team === "X" ? "W" : "B", 100, DEFAULT_SOCCER_CONFIG, steadyRng);
    state = typeFullPhrase(state, 200, 100, DEFAULT_SOCCER_CONFIG, steadyRng);
    expect(state.phase).toBe("DEFENSE_READY");
    state = proceedToNextPlay(state, 2500);
    expect(state.phase).toBe("DEFENSE_SELECT");
    expect(state.currentPlay!.eligibleInterceptions.length).toBeGreaterThan(0);
    expect(state.currentPlay!.eligibleInterceptions.every((option) => option.defenderTeam !== team)).toBe(true);
  }
});

function typeActivePhrase(state: ReturnType<typeof createInitialSoccerMatch>, startMs: number, stepMs: number) {
  let next = state;
  const phrase = next.activeChallenge?.phrase ?? "";
  phrase.split("").forEach((character, index) => {
    next = handleTypingKey(next, character, startMs + (index + 1) * stepMs, DEFAULT_SOCCER_CONFIG, steadyRng);
  });
  return next;
}

function createPassWithDefense(startMs = 100, stepMs = 100) {
  let state = createInitialSoccerMatch(DEFAULT_SOCCER_CONFIG, 0);
  state = selectOffensiveTarget(state, "W", startMs, DEFAULT_SOCCER_CONFIG, steadyRng);
  state = typeActivePhrase(state, startMs, stepMs);
  state = proceedToNextPlay(state, startMs + 2000);
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
  state = selectOffensiveTarget(state, "S", 100, DEFAULT_SOCCER_CONFIG, steadyRng);

  expect(state.phase).toBe("SHOT_READY");
  expect(state.shot?.offenseTeam).toBe("X");
  expect(state.shot?.goalkeeperId).toBe("o-goalkeeper");
});

test("phrase length increases with distance", () => {
  const shortPhraseLength = scaleDistanceToCharacterCount(8, DEFAULT_SOCCER_CONFIG.phraseScaling);
  const longPhraseLength = scaleDistanceToCharacterCount(90, DEFAULT_SOCCER_CONFIG.phraseScaling);

  expect(longPhraseLength).toBeGreaterThan(shortPhraseLength);
});

test("offensive typing time becomes modeled ball travel time", () => {
  let state = createInitialSoccerMatch(DEFAULT_SOCCER_CONFIG, 0);
  state = selectOffensiveTarget(state, "W", 100, DEFAULT_SOCCER_CONFIG, steadyRng);
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
  let state = createPassWithDefense(100, 90);
  const defenderKey = state.currentPlay!.eligibleInterceptions[0].defenderKey;
  state = selectDefender(state, defenderKey, 2500, DEFAULT_SOCCER_CONFIG, steadyRng);
  const defenderId = state.currentPlay!.selectedInterception!.defenderId;
  const interceptionPoint = state.currentPlay!.selectedInterception!.interceptionPoint;

  state = typeFullPhrase(state, 2501, 1, DEFAULT_SOCCER_CONFIG, steadyRng);

  expect(state.phase).toBe("OFFENSE_READY");
  expect(state.activePlayerId).toBe(defenderId);
  expect(state.possessionTeam).toBe("O");
  expect(state.ball).toEqual(interceptionPoint);
  expect(state.players.find((player) => player.id === defenderId)?.temporary?.turnsRemaining).toBe(2);

  const immediateTarget = getSelectableOffenseTargets(state, DEFAULT_SOCCER_CONFIG)[0];
  expect(selectOffensiveTarget(state, immediateTarget.key, 2600)).toBe(state);
  state = proceedToNextPlay(state, 2600);
  state = selectOffensiveTarget(state, immediateTarget.key, 2600, DEFAULT_SOCCER_CONFIG, steadyRng);
  expect(state.phase).toBe("OFFENSE_TYPING");
});

test("a failed defensive challenge lets the pass complete", () => {
  let state = createPassWithDefense(100, 80);
  const defenderKey = state.currentPlay!.eligibleInterceptions[0].defenderKey;
  state = selectDefender(state, defenderKey, 2200, DEFAULT_SOCCER_CONFIG, steadyRng);
  const deadline = state.currentPlay!.defenseDeadlineAtMs!;

  state = handleDefenseTypingTimeout(state, deadline + 1, DEFAULT_SOCCER_CONFIG);

  expect(state.stats.passesCompleted).toBe(1);
  expect(state.phase).toBe("OFFENSE_READY");
  expect(state.possessionTeam).toBe("X");
});

test("a successful interception moves every off-ball player while keeping the new carrier at the interception", () => {
  let state = createPassWithDefense(100, 90);
  state = selectDefender(
    state,
    state.currentPlay!.eligibleInterceptions[0].defenderKey,
    2500,
    DEFAULT_SOCCER_CONFIG,
    steadyRng
  );
  const defenderId = state.currentPlay!.selectedInterception!.defenderId;
  const interceptionPoint = state.currentPlay!.selectedInterception!.interceptionPoint;
  const before = state;
  state = typeFullPhrase(state, 2501, 1, DEFAULT_SOCCER_CONFIG, steadyRng);

  expect(state.players.find((player) => player.id === defenderId)!.position).toEqual(interceptionPoint);
  expect(state.ball).toEqual(interceptionPoint);
  expectOffBallMovement(before, state);
});

function expectOffBallMovement(before: MatchState, after: MatchState) {
  expect(after.players.filter((player) => player.hasBall)).toHaveLength(1);
  after.players.filter((player) => !player.hasBall).forEach((player) => {
    expect(player.position).not.toEqual(before.players.find((previous) => previous.id === player.id)!.position);
    expect(distance(player.position, player.home)).toBeLessThanOrEqual(DEFAULT_SOCCER_CONFIG.movement.radius + 0.000001);
    expect(player.temporary).toBeUndefined();
  });
}

function createPassAttempt() {
  let state = createInitialSoccerMatch(DEFAULT_SOCCER_CONFIG, 0);
  state = selectOffensiveTarget(state, "W", 100, DEFAULT_SOCCER_CONFIG, steadyRng);
  state = typeActivePhrase(state, 100, 100);
  state = proceedToNextPlay(state, 2500);
  expect(state.phase).toBe("DEFENSE_SELECT");
  return selectDefender(state, state.currentPlay!.eligibleInterceptions[0].defenderKey, 3000, DEFAULT_SOCCER_CONFIG, steadyRng);
}

test("a failed interception refreshes the field without moving the receiver from the locked pass target", () => {
  const before = createPassAttempt();
  const target = before.currentPlay!.target;
  const after = handleDefenseTypingTimeout(before, before.currentPlay!.defenseDeadlineAtMs! + 1, DEFAULT_SOCCER_CONFIG, steadyRng);
  expect(after.activePlayerId).toBe(target.id);
  expect(after.players.find((player) => player.hasBall)!.position).toEqual(target.point);
  expect(after.ball).toEqual(target.point);
  expect(after.stats.passesCompleted).toBe(1);
  expectOffBallMovement(before, after);
});

test("a late defensive keystroke also triggers off-ball movement", () => {
  const before = createPassAttempt();
  const after = handleTypingKey(before, "x", before.currentPlay!.defenseDeadlineAtMs! + 1, DEFAULT_SOCCER_CONFIG, steadyRng);
  expect(after.phase).toBe("OFFENSE_READY");
  expectOffBallMovement(before, after);
});

test("missing defender selection does not move the formation", () => {
  const before = createPassWithDefense();
  const after = handleDefenseSelectionTimeout(before, before.selectionDeadlineAtMs! + 1, DEFAULT_SOCCER_CONFIG);
  expect(after.players.map((player) => player.position)).toEqual(before.players.map((player) => player.position));
});

test("S shoots toward the opposing goal for either team and is never a player key", () => {
  expect(DEFAULT_SOCCER_CONFIG.players.some((player) => player.key.toUpperCase() === "S")).toBe(false);
  for (const team of ["X", "O"] as const) {
    const state = selectOffensiveTarget(createInitialSoccerMatch(DEFAULT_SOCCER_CONFIG, 0, team), "s", 100, DEFAULT_SOCCER_CONFIG, steadyRng);
    expect(state.phase).toBe("SHOT_READY");
    expect(state.shot!.offenseTeam).toBe(team);
  }
  const invalidConfig = {
    ...DEFAULT_SOCCER_CONFIG,
    players: DEFAULT_SOCCER_CONFIG.players.map((player, index) => index === 0 ? { ...player, key: "s" } : player),
  };
  expect(() => createInitialSoccerMatch(invalidConfig)).toThrow("S is reserved");
});

test("goalkeepers can receive passes", () => {
  const state = createInitialSoccerMatch(DEFAULT_SOCCER_CONFIG, 0);
  expect(getSelectableOffenseTargets(state).find((target) => target.key === "Z")!.kind).toBe("player");
});

test("repeated movement stays around original homes, in bounds, and clear of other markers", () => {
  let players = createInitialSoccerMatch(DEFAULT_SOCCER_CONFIG, 0).players;
  let seed = 123456;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let turn = 0; turn < 200; turn += 1) {
    const carrierIndex = turn % players.length;
    const before = players.map((player, index) => ({ ...player, hasBall: index === carrierIndex }));
    const next = repositionOffBallPlayers(before, DEFAULT_SOCCER_CONFIG, rng);
    next.filter((player) => player.hasBall).forEach((player) => {
      expect(player.position).toEqual(before.find((previous) => previous.id === player.id)!.position);
    });
    next.filter((player) => !player.hasBall).forEach((player) => {
      expect(player.position).not.toEqual(before.find((previous) => previous.id === player.id)!.position);
      expect(distance(player.position, player.home)).toBeLessThanOrEqual(DEFAULT_SOCCER_CONFIG.movement.radius + 0.000001);
      expect(player.position.x).toBeGreaterThanOrEqual(3.5);
      expect(player.position.x).toBeLessThanOrEqual(96.5);
      expect(player.position.y).toBeGreaterThanOrEqual(10);
      expect(player.position.y).toBeLessThanOrEqual(53);
    });
    next.filter((player) => player.role === "goalkeeper" && !player.hasBall).forEach((player) => {
      expect(player.position.x < 12.01 || player.position.x > 87.99).toBe(true);
      expect(player.position.y).toBeGreaterThanOrEqual(23);
      expect(player.position.y).toBeLessThanOrEqual(37);
    });
    next.forEach((player, index) => {
      next.slice(index + 1).forEach((other) => {
        expect(Math.abs(player.position.x - other.position.x) >= 8.4 || Math.abs(player.position.y - other.position.y) >= 15.5).toBe(true);
      });
    });
    players = next;
  }
});

test("selection deadlines resolve without changing the visible state machine contract", () => {
  let state = createInitialSoccerMatch(DEFAULT_SOCCER_CONFIG, 0);
  state = checkHiddenDeadlines(state, DEFAULT_SOCCER_CONFIG.selection.offenseSelectionMs + 1, DEFAULT_SOCCER_CONFIG);

  expect(state.phase).toBe("OFFENSE_READY");
  expect(state.possessionTeam).toBe("O");
  expect(state.stats.turnovers.O).toBe(1);
});
