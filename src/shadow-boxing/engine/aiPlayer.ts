import {
  ActiveQuestion,
  AttackTargetOption,
  Difficulty,
  Direction,
  Rng,
} from "../types/shadowBoxing";

export const AI_DIFFICULTIES: Record<
  Difficulty,
  {
    accuracy: number;
    minResponseMs: number;
    maxResponseMs: number;
  }
> = {
  easy: {
    accuracy: 0.55,
    minResponseMs: 2800,
    maxResponseMs: 5000,
  },
  medium: {
    accuracy: 0.7,
    minResponseMs: 2000,
    maxResponseMs: 4000,
  },
  hard: {
    accuracy: 0.82,
    minResponseMs: 1400,
    maxResponseMs: 3000,
  },
  expert: {
    accuracy: 0.92,
    minResponseMs: 900,
    maxResponseMs: 2000,
  },
  wizz: {
    accuracy: 0.97,
    minResponseMs: 450,
    maxResponseMs: 1200,
  },
};

export interface AiAttackPlan {
  targetDirection: Direction;
  totalAttackTimeMs: number;
  knowsAnswer: boolean;
}

export interface AiDefensePlan {
  responseTimeMs: number;
  knowsAnswer: boolean;
  answerDirection: Direction;
  timedOut: boolean;
}

function randomBetween(min: number, max: number, rng: Rng): number {
  return min + rng() * (max - min);
}

function getCorrectDirection(question: ActiveQuestion): Direction {
  return question.kind === "related"
    ? question.correctDirection
    : question.oddDirection;
}

function getIncorrectDirections(question: ActiveQuestion): Direction[] {
  const correctDirection = getCorrectDirection(question);
  return question.options
    .map((option) => option.direction)
    .filter((direction) => direction !== correctDirection);
}

export function pickQuestionAnswerDirection(
  question: ActiveQuestion,
  knowsAnswer: boolean,
  rng: Rng = Math.random
): Direction {
  if (knowsAnswer) {
    return getCorrectDirection(question);
  }

  const incorrectDirections = getIncorrectDirections(question);
  return incorrectDirections[Math.floor(rng() * incorrectDirections.length)] ?? "up";
}

export function planAiAttack(
  targets: AttackTargetOption[],
  difficulty: Difficulty,
  rng: Rng = Math.random
): AiAttackPlan {
  const config = AI_DIFFICULTIES[difficulty];
  const target = targets[Math.floor(rng() * targets.length)] ?? targets[0];

  return {
    targetDirection: target.direction,
    totalAttackTimeMs: randomBetween(
      config.minResponseMs,
      config.maxResponseMs,
      rng
    ),
    knowsAnswer: rng() < config.accuracy,
  };
}

export function planAiDefense(
  question: ActiveQuestion,
  difficulty: Difficulty,
  defenderTimeLimitMs: number,
  rng: Rng = Math.random
): AiDefensePlan {
  const config = AI_DIFFICULTIES[difficulty];
  const responseTimeMs = randomBetween(
    config.minResponseMs,
    config.maxResponseMs,
    rng
  );
  const knowsAnswer = rng() < config.accuracy;

  return {
    responseTimeMs,
    knowsAnswer,
    answerDirection: pickQuestionAnswerDirection(question, knowsAnswer, rng),
    timedOut: responseTimeMs > defenderTimeLimitMs,
  };
}

