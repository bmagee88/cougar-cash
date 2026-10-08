import { VOCABULARY } from "../data/vocabulary";
import { planAiDefense } from "../engine/aiPlayer";
import {
  answerAttackQuestion,
  answerDefenseQuestion,
  completeCorrection,
  createNewMatch,
  DEFAULT_SETTINGS,
  handleDefenseTimeout,
} from "../engine/gameEngine";
import {
  generateOddOneOutQuestion,
  generateRelatedQuestion,
  validateQuestionOptions,
  validateVocabulary,
} from "../engine/questionGenerator";
import { getDefenderTimeLimitMs } from "../engine/timing";
import { Direction, GameState, Rng } from "../types/shadowBoxing";

declare const test: (name: string, fn: () => void) => void;
declare const expect: any;

const steadyRng: Rng = () => 0.42;

function wrongDirection(options: { direction: Direction; isCorrect?: boolean }[]) {
  return options.find((option) => !option.isCorrect)?.direction ?? "up";
}

function startComputersMatch(hearts = 3): GameState {
  return createNewMatch(
    {
      ...DEFAULT_SETTINGS,
      difficulty: "medium",
      topic: "computers",
      hearts,
    },
    0,
    steadyRng
  );
}

function throwSuccessfulAttack(state: GameState, elapsedMs = 1000): GameState {
  return answerAttackQuestion(
    state,
    state.attackQuestion!.correctDirection,
    (state.attackStartTimeMs ?? 0) + elapsedMs,
    steadyRng
  );
}

function failDefense(state: GameState): GameState {
  return answerDefenseQuestion(
    state,
    wrongDirection(state.currentAttack!.defenseQuestion.options),
    steadyRng
  );
}

function completeCurrentCorrection(state: GameState): GameState {
  return completeCorrection(
    state,
    state.correctionReplay!.question.correctDirection,
    (state.attackStartTimeMs ?? 0) + 2000,
    steadyRng
  );
}

test("defender time limit is attacker time plus one second", () => {
  expect(getDefenderTimeLimitMs(1370)).toBe(2370);
});

test("a wrong attacker answer whiffs and transfers control", () => {
  const selected = startComputersMatch();
  const whiff = answerAttackQuestion(
    selected,
    wrongDirection(selected.attackQuestion!.options),
    1200,
    steadyRng
  );

  expect(whiff.phase).toBe("role-switch");
  expect(whiff.attackerId).toBe("computer");
  expect(whiff.comboFailures).toBe(0);
});

test("a successful live defense transfers attack control", () => {
  const liveDefense = throwSuccessfulAttack(startComputersMatch());
  const counter = answerDefenseQuestion(
    liveDefense,
    liveDefense.currentAttack!.defenseQuestion.correctDirection,
    steadyRng
  );

  expect(counter.phase).toBe("role-switch");
  expect(counter.attackerId).toBe("computer");
  expect(counter.comboFailures).toBe(0);
});

test("a timeout counts as a defensive failure", () => {
  const liveDefense = throwSuccessfulAttack(startComputersMatch());
  const timedOut = handleDefenseTimeout(liveDefense, steadyRng);

  expect(timedOut.phase).toBe("correction");
  expect(timedOut.comboFailures).toBe(1);
  expect(timedOut.stats.byPlayer.computer.defenseTimeouts).toBe(1);
});

test("correction replay does not transfer control", () => {
  const liveDefense = throwSuccessfulAttack(startComputersMatch());
  const timedOut = handleDefenseTimeout(liveDefense, steadyRng);
  const corrected = completeCurrentCorrection(timedOut);

  expect(corrected.attackerId).toBe("player");
  expect(corrected.defenderId).toBe("computer");
  expect(corrected.comboFailures).toBe(1);
  expect(corrected.phase).toBe("attacker-answer");
});

test("three live defensive failures remove one heart and reset combo", () => {
  let state = throwSuccessfulAttack(startComputersMatch());
  state = completeCurrentCorrection(failDefense(state));
  state = throwSuccessfulAttack(state);
  state = completeCurrentCorrection(failDefense(state));
  state = throwSuccessfulAttack(state);
  state = failDefense(state);

  expect(state.phase).toBe("heart-lost");
  expect(state.players.computer.hearts).toBe(2);
  expect(state.comboFailures).toBe(0);
});

test("heart loss does not transfer the attacking role", () => {
  let state = throwSuccessfulAttack(startComputersMatch());
  state = completeCurrentCorrection(failDefense(state));
  state = throwSuccessfulAttack(state);
  state = completeCurrentCorrection(failDefense(state));
  state = throwSuccessfulAttack(state);
  state = failDefense(state);

  expect(state.attackerId).toBe("player");
  expect(state.defenderId).toBe("computer");
});

test("zero hearts ends the match", () => {
  let state = throwSuccessfulAttack(startComputersMatch(1));
  state = completeCurrentCorrection(failDefense(state));
  state = throwSuccessfulAttack(state);
  state = completeCurrentCorrection(failDefense(state));
  state = throwSuccessfulAttack(state);
  state = failDefense(state);

  expect(state.phase).toBe("game-over");
  expect(state.winnerId).toBe("player");
  expect(state.players.computer.hearts).toBe(0);
});

test("custom combo hit threshold controls heart loss", () => {
  let state = createNewMatch(
    {
      ...DEFAULT_SETTINGS,
      difficulty: "medium",
      topic: "computers",
      hearts: 3,
      comboHitsRequired: 2,
    },
    0,
    steadyRng
  );

  state = throwSuccessfulAttack(state);
  state = completeCurrentCorrection(failDefense(state));
  state = throwSuccessfulAttack(state);
  state = failDefense(state);

  expect(state.phase).toBe("heart-lost");
  expect(state.players.computer.hearts).toBe(2);
  expect(state.comboFailures).toBe(0);
});

test("AI can know the answer and still timeout", () => {
  const question = generateOddOneOutQuestion(VOCABULARY[0], false, steadyRng);
  const sequence = [0, 0.1, 0.2];
  const rng: Rng = () => sequence.shift() ?? 0;
  const plan = planAiDefense(question, "easy", 1000, rng);

  expect(plan.knowsAnswer).toBe(true);
  expect(plan.responseTimeMs).toBeGreaterThan(1000);
  expect(plan.timedOut).toBe(true);
});

test("generated questions have four options and one correct answer", () => {
  expect(validateVocabulary()).toEqual([]);

  VOCABULARY.forEach((concept) => {
    const normalRelated = generateRelatedQuestion(concept, false, steadyRng);
    const trickRelated = generateRelatedQuestion(concept, true, steadyRng);
    const normalOdd = generateOddOneOutQuestion(concept, false, steadyRng);
    const trickOdd = generateOddOneOutQuestion(concept, true, steadyRng);

    expect(validateQuestionOptions(normalRelated)).toEqual([]);
    expect(validateQuestionOptions(trickRelated)).toEqual([]);
    expect(validateQuestionOptions(normalOdd)).toEqual([]);
    expect(validateQuestionOptions(trickOdd)).toEqual([]);
  });
});

test("less-decisions related questions only use left and right", () => {
  const question = generateRelatedQuestion(
    VOCABULARY[0],
    false,
    steadyRng,
    undefined,
    ["left", "right"]
  );

  expect(validateQuestionOptions(question, 2)).toEqual([]);
  expect(question.options.map((option) => option.direction).sort()).toEqual([
    "left",
    "right",
  ]);
});

