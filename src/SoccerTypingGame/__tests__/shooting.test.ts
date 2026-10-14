import { DEFAULT_SOCCER_CONFIG as config } from "../engine/config";
import { checkHiddenDeadlines, createInitialSoccerMatch, handleTypingKey, proceedToNextPlay, selectOffensiveTarget, shiftActiveClocks, typeFullPhrase } from "../engine/gameEngine";
import { getShotChances, getShotDeadline, getShotGoalProbability, handleShotKey, rollShot, SHOT_DURATIONS, SHOT_TARGETS } from "../engine/shooting";
import { MatchState, ShotLocation, ShotState, TeamId } from "../engine/types";

declare const test: (name: string, fn: () => void) => void;
declare const expect: any;
const rng = () => 0;

test("live goal probability rises as attacking locations are completed for each distance", () => {
  for (const chances of [1, 2, 3, 4]) {
    for (const completed of [0, 1, 2, 3, 4, 5]) {
      const shot = { ...newShot().shot!, chances, targets: SHOT_TARGETS.map((entry, index) => ({ ...entry, attackerMs: index < completed ? 2000 : undefined })) };
      expect(getShotGoalProbability(shot)).toBeCloseTo(1 - Math.pow((5 - completed) / 5, chances));
    }
  }
});

test("live goal probability excludes blocked locations but retains pending, won, and tied battles", () => {
  const shot = { ...newShot().shot!, targets: SHOT_TARGETS.map((entry, index) => ({ ...entry,
    attackerMs: index === 4 ? undefined : 2000,
    defenderMs: [1000, 2000, 3000, undefined, undefined][index],
  })) };
  expect(getShotGoalProbability(shot)).toBeCloseTo(1 - Math.pow(2 / 5, 4));
  expect(getShotGoalProbability({ ...shot, chances: 1 })).toBeCloseTo(3 / 5);
  expect(getShotGoalProbability(completedShot())).toBeCloseTo(0.5904);
});

test("goal probability is zero when the keeper blocks every location and is not the random outcome", () => {
  const shot = { ...completedShot(), targets: completedShot().targets.map((entry) => ({ ...entry, defenderMs: 1000 })) };
  expect(getShotGoalProbability(shot)).toBe(0);
  const partialChance = completedShot();
  const withResult = { ...partialChance, result: rollShot(partialChance, () => 0.4) };
  expect(withResult.result.scored).toBe(true);
  expect(getShotGoalProbability(withResult)).toBeCloseTo(0.5904);
});

function newShot(team: TeamId = "X") {
  return selectOffensiveTarget(createInitialSoccerMatch(config, 0, team), "s", 100, config, rng);
}

function completedShot(team: TeamId = "X"): ShotState {
  return { ...newShot(team).shot!, targets: SHOT_TARGETS.map((entry) => ({ ...entry, attackerMs: 2000, defenderMs: entry.location === "c" ? 3000 : 1000 })) };
}

function typeWord(state: MatchState, location: ShotLocation, start: number, step: number) {
  let next = state;
  const phrase = state.shot!.targets.find((entry) => entry.location === location)!.phrase;
  phrase.split("").forEach((key, index) => { next = handleShotKey(next, key, start + index * step, rng); });
  return next;
}

function cinematic(scored: boolean, team: TeamId = "X"): MatchState {
  const initial = newShot(team);
  return { ...initial, phase: "SHOT_CAMERA", shot: { ...completedShot(team), result: { scored, location: scored ? "c" : "tl", rolls: [scored ? "c" : "tl"], blocked: ["tl", "tr", "bl", "br"] }, phaseStartedAtMs: 1000 } };
}

function advance(state: MatchState) {
  return checkHiddenDeadlines(state, getShotDeadline(state)!, config, rng);
}

test("all five targets have twelve characters and distinct first letters", () => {
  expect(SHOT_TARGETS.map((entry) => entry.phrase.length)).toEqual([12, 12, 12, 12, 12]);
  expect(new Set(SHOT_TARGETS.map((entry) => entry.phrase[0])).size).toBe(5);
  expect(new Set(SHOT_TARGETS.map((entry) => entry.location)).size).toBe(5);
});

test("shots start behind an Enter gate and do not reuse pass selection", () => {
  const state = newShot();
  expect(state.phase).toBe("SHOT_READY");
  expect(state.activeChallenge).toBeUndefined();
  expect(state.selectionDeadlineAtMs).toBeUndefined();
  expect(state.stats.shotsTaken).toBe(1);
  expect(handleTypingKey(state, "a", 200)).toBe(state);
  expect(handleShotKey(state, "Enter", 200, rng).phase).toBe("SHOT_TYPING");
});

test("first letter locks a location, including errors and backspace time", () => {
  let state = handleShotKey(newShot(), "Enter", 200, rng);
  expect(handleShotKey(state, "z", 999, rng)).toBe(state);
  state = handleShotKey(state, "a", 1000, rng);
  state = handleShotKey(state, "b", 1100, rng);
  expect(state.shot!.activeLocation).toBe("tl");
  expect(state.activeChallenge!.typed).toBe("ab");
  state = handleShotKey(state, "Backspace", 1200, rng);
  "im for goal".split("").forEach((key, index) => { state = handleShotKey(state, key, 1300 + index * 100, rng); });
  expect(state.phase).toBe("SHOT_WORD_READY");
  expect(state.shot!.targets[0].attackerMs).toBe(1300);
  expect(state.stats.offenseChallenges[0].incorrectKeystrokes).toBe(1);
});

test("leftover letters after a word are ignored until Enter", () => {
  let state = handleShotKey(newShot(), "Enter", 200, rng);
  state = typeWord(state, "tl", 1000, 100);
  expect(handleShotKey(state, "b", 3000, rng)).toBe(state);
  state = handleShotKey(state, "Enter", 3000, rng);
  expect(state.activeChallenge).toBeUndefined();
  expect(handleShotKey(state, "a", 3100, rng)).toBe(state);
  state = handleShotKey(state, "b", 3200, rng);
  expect(state.shot!.activeLocation).toBe("tr");
});

test("both players complete all five phrases before the shot is rolled", () => {
  let state = handleShotKey(newShot(), "Enter", 200, rng);
  let time = 1000;
  for (const entry of SHOT_TARGETS) {
    state = typeWord(state, entry.location, time, 100);
    state = handleShotKey(state, "Enter", time + 2000, rng);
    time += 3000;
  }
  expect(state.phase).toBe("SHOT_READY");
  expect(state.shot!.round).toBe("defender");
  expect(state.shot!.targets.map((entry) => entry.attackerMs)).toEqual([1100, 1100, 1100, 1100, 1100]);
  expect(state.shot!.result).toBeUndefined();
  state = handleShotKey(state, "Enter", time, rng);
  for (const entry of SHOT_TARGETS) {
    state = typeWord(state, entry.location, time + 100, 50);
    state = handleShotKey(state, "Enter", time + 2000, rng);
    time += 3000;
  }
  expect(state.phase).toBe("SHOT_CAMERA");
  expect(state.shot!.targets.map((entry) => entry.defenderMs)).toEqual([550, 550, 550, 550, 550]);
  expect(state.shot!.result!.scored).toBe(false);
  expect(state.stats.offenseChallenges).toHaveLength(5);
  expect(state.stats.defenseChallenges).toHaveLength(5);
});

test("distance gives one chance from a keeper and four from near the goal", () => {
  expect([92, 60, 40, 20].map((value) => getShotChances(value, 100))).toEqual([1, 2, 3, 4]);
  expect(getShotChances(1000, 100)).toBe(1);
  expect(getShotChances(0, 100)).toBe(4);
  const state = createInitialSoccerMatch(config, 0);
  state.activePlayerId = "x-goalkeeper";
  expect(selectOffensiveTarget(state, "s", 100).shot!.chances).toBe(1);
});

test("four independent rolls can score through the only open center location", () => {
  const shot = { ...completedShot(), chances: 4 };
  const draws = [0, 0.2, 0.4, 0.8, 0];
  const outcome = rollShot(shot, () => draws.shift()!);
  expect(outcome.rolls).toEqual(["tl", "tr", "c", "br"]);
  expect(outcome.scored).toBe(true);
  expect(outcome.location).toBe("c");
  expect(outcome.blocked).toEqual(["tl", "tr", "bl", "br"]);
});

test("missing the open location is saved even on a close shot", () => {
  const draws = [0, 0.2, 0.6, 0.8, 0.99];
  const outcome = rollShot({ ...completedShot(), chances: 4 }, () => draws.shift()!);
  expect(outcome.scored).toBe(false);
  expect(outcome.location).toBe("br");
  expect(outcome.rolls).not.toContain("c");
});

test("equal typing times do not block and the animation chooses among successful rolls", () => {
  const shot = { ...completedShot(), chances: 4, targets: completedShot().targets.map((entry) => ({ ...entry, defenderMs: entry.attackerMs })) };
  const draws = [0, 0.2, 0.4, 0.8, 0.99];
  const outcome = rollShot(shot, () => draws.shift()!);
  expect(outcome.blocked).toEqual([]);
  expect(outcome.scored).toBe(true);
  expect(outcome.location).toBe("br");
});

test("camera, countdown, flight, and four-second goal result increment the score once", () => {
  let state = cinematic(true);
  expect(advance(state).phase).toBe("SHOT_COUNTDOWN");
  state = advance(advance(advance(state)));
  expect(state.phase).toBe("SHOT_RESULT");
  expect(state.scores.X).toBe(1);
  expect(state.stats.goals.X).toBe(1);
  expect(checkHiddenDeadlines(state, getShotDeadline(state)! - 1, config, rng)).toBe(state);
  state = advance(state);
  expect(state.phase).toBe("OFFENSE_READY");
  expect(state.scores.X).toBe(1);
  expect(state.possessionTeam).toBe("O");
  expect(state.activePlayerId).toBe(config.goalKickoffPlayerByTeam.O);
  expect(state.players.map((player) => player.position)).toEqual(state.players.map((player) => player.home));
});

test("after either team scores, the conceding team's back starts with the ball", () => {
  for (const team of ["X", "O"] as const) {
    const state = advance(advance(advance(advance(cinematic(true, team)))));
    const concedingTeam = team === "X" ? "O" : "X";
    const carrier = state.players.find((player) => player.hasBall)!;
    expect(state.phase).toBe("OFFENSE_READY");
    expect(state.possessionTeam).toBe(concedingTeam);
    expect(state.activePlayerId).toBe(config.goalKickoffPlayerByTeam[concedingTeam]);
    expect(carrier.name).toBe("Sweeper");
    expect(carrier.team).toBe(concedingTeam);
    expect(carrier.position).toEqual(carrier.home);
    expect(state.ball).toEqual(carrier.home);
  }
});

test("SAVE lasts four seconds then resumes with the keeper and new off-ball positions", () => {
  let state = advance(advance(advance(cinematic(false))));
  const before = state;
  expect(state.phase).toBe("SHOT_RESULT");
  expect(getShotDeadline(state)! - state.shot!.phaseStartedAtMs).toBe(SHOT_DURATIONS.SHOT_RESULT);
  state = advance(state);
  expect(state.phase).toBe("OFFENSE_READY");
  expect(state.activePlayerId).toBe("o-goalkeeper");
  expect(state.possessionTeam).toBe("O");
  expect(state.scores.X).toBe(0);
  expect(state.players.find((player) => player.hasBall)!.position).toEqual(before.players.find((player) => player.id === "o-goalkeeper")!.position);
  state.players.filter((player) => !player.hasBall).forEach((player) => {
    expect(player.position).not.toEqual(before.players.find((previous) => previous.id === player.id)!.position);
  });
});

test("winning goal finishes the match only after its celebration", () => {
  let state = cinematic(true);
  state.scores.X = config.winningScore - 1;
  state = advance(advance(advance(state)));
  expect(state.phase).toBe("SHOT_RESULT");
  state = advance(state);
  expect(state.phase).toBe("MATCH_COMPLETE");
  expect(state.winner).toBe("X");
  expect(state.scores.X).toBe(config.winningScore);
});

test("pausing shifts shot typing and cinematics without rerolling", () => {
  let state = handleShotKey(newShot(), "Enter", 200, rng);
  state = handleShotKey(state, "a", 1000, rng);
  state = shiftActiveClocks(state, 5000);
  expect(state.activeChallenge!.startedAtMs).toBe(6000);
  const animated = cinematic(true);
  const shifted = shiftActiveClocks(animated, 5000);
  expect(getShotDeadline(shifted)).toBe(getShotDeadline(animated)! + 5000);
  expect(shifted.shot!.result).toBe(animated.shot!.result);
});

test("pass handoff and next selection ignore stray letters and start clocks only after Enter", () => {
  let state = selectOffensiveTarget(createInitialSoccerMatch(config, 0), "w", 100, config, rng);
  state = typeFullPhrase(state, 200, 100, config, rng);
  expect(state.phase).toBe("DEFENSE_READY");
  expect(checkHiddenDeadlines(state, 100000, config, rng)).toBe(state);
  expect(selectOffensiveTarget(state, "r", 100000)).toBe(state);
  state = proceedToNextPlay(state, 100000);
  expect(state.phase).toBe("DEFENSE_SELECT");
  expect(state.selectionDeadlineAtMs).toBe(100000 + config.selection.defenseSelectionMs);
});
