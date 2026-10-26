import {
  ConceptState, LocalAttempt, LocalRound, MatchingItem, QuizDefinition, QuizSessionState,
} from "./types";

export const QUESTION_WINDOW_SIZE = 4;
let identifierSequence = 0;
export const createQuizId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${identifierSequence++}`;

// Ported from c-quiz-2-api.js: same practice / required / bonus selection,
// variant pairing, concept mastery, and cumulative scoring. Quiz App 3 uses
// four questions, a per-take round allowance, and at most one earned bonus round.
export const shuffle = <T,>(items: T[]): T[] => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
};

const chooseOne = <T,>(items: T[]) => shuffle(items)[0];
const uniqueIds = (items: string[]) => Array.from(new Set(items));
const allCorrect = (quiz: QuizDefinition, state: ConceptState) =>
  quiz.concepts.length > 0 && quiz.concepts.every((concept) => state[concept.conceptKey]);

export const createSession = (quiz: QuizDefinition, persisted: ConceptState = {}): QuizSessionState => {
  const conceptState = Object.fromEntries(
    quiz.concepts.map((concept) => [concept.conceptKey, persisted[concept.conceptKey] === true]),
  );
  return {
    conceptState,
    bonusEligible: allCorrect(quiz, conceptState),
    seenConceptIds: [],
    firstPassWrongConceptIds: [],
    bonusSeenConceptIds: [],
    bonusRoundsEarned: 0,
    bonusRoundsUsed: 0,
    requiredComplete: false,
    complete: false,
  };
};

export const createRound = (quiz: QuizDefinition, state: QuizSessionState): LocalRound => {
  if (state.complete) throw new Error("This run is complete. Start another run to continue.");
  const concepts = quiz.concepts;
  const targetCount = Math.min(QUESTION_WINDOW_SIZE, concepts.length);
  let mode: LocalRound["mode"] = "practice";
  let selected: QuizDefinition["concepts"];

  if (state.bonusEligible && !state.requiredComplete) {
    mode = "required";
    const seen = new Set(state.seenConceptIds);
    selected = shuffle(concepts.filter((concept) => !seen.has(concept.conceptKey))).slice(0, targetCount);
  } else if (state.bonusEligible && state.bonusRoundsUsed < state.bonusRoundsEarned) {
    mode = "bonus";
    const bonusSeen = new Set(state.bonusSeenConceptIds);
    const missed = new Set(state.firstPassWrongConceptIds);
    const wrong = [
      ...shuffle(concepts.filter((concept) => missed.has(concept.conceptKey) &&
        !state.conceptState[concept.conceptKey] && !bonusSeen.has(concept.conceptKey))),
      ...shuffle(concepts.filter((concept) => !missed.has(concept.conceptKey) &&
        !state.conceptState[concept.conceptKey] && !bonusSeen.has(concept.conceptKey))),
    ].slice(0, targetCount);
    const selectedIds = new Set(wrong.map((concept) => concept.conceptKey));
    const correctFill = shuffle(concepts.filter((concept) =>
      state.conceptState[concept.conceptKey] && !selectedIds.has(concept.conceptKey),
    )).slice(0, Math.max(0, targetCount - wrong.length));
    selected = [...wrong, ...correctFill];
    if (selected.length < targetCount) {
      const fallbackIds = new Set(selected.map((concept) => concept.conceptKey));
      selected = [...selected, ...shuffle(concepts.filter((concept) =>
        !fallbackIds.has(concept.conceptKey),
      )).slice(0, targetCount - selected.length)];
    }
  } else {
    const incorrect = concepts.filter((concept) => !state.conceptState[concept.conceptKey]);
    const correct = concepts.filter((concept) => state.conceptState[concept.conceptKey]);
    const basePool = incorrect.length ? incorrect : concepts;
    const remainingSlots = Math.max(0, targetCount - basePool.length);
    selected = shuffle([...basePool, ...shuffle(correct).slice(0, remainingSlots)]).slice(0, targetCount);
  }

  // IDs describe slots, never answers, so two identical strings stay distinct.
  const id = createQuizId();
  const pairs = selected.map((concept, index) => ({
    questionId: `${id}-q${index}`,
    answerId: `${id}-a${index}`,
    conceptKey: concept.conceptKey,
  }));
  return {
    id, mode, pairs,
    questions: selected.map((concept, index) => ({
      id: pairs[index].questionId, text: chooseOne(concept.questionVariants),
    })),
    answers: shuffle(selected.map((concept, index) => ({
      id: pairs[index].answerId, text: chooseOne(concept.answerVariants),
    }))),
  };
};

export const submitRound = (
  quiz: QuizDefinition,
  previous: QuizSessionState,
  round: LocalRound,
  answers: MatchingItem[],
  roundsUsed: number,
) => {
  const state: QuizSessionState = {
    ...previous,
    conceptState: { ...previous.conceptState },
    seenConceptIds: [...previous.seenConceptIds],
    firstPassWrongConceptIds: [...previous.firstPassWrongConceptIds],
    bonusSeenConceptIds: [...previous.bonusSeenConceptIds],
  };
  const results = round.pairs.map((pair, index) => {
    const correct = answers[index]?.id === pair.answerId;
    state.conceptState[pair.conceptKey] = correct;
    state.seenConceptIds = uniqueIds([...state.seenConceptIds, pair.conceptKey]);
    if (round.mode !== "bonus" && !correct) {
      state.firstPassWrongConceptIds = uniqueIds([...state.firstPassWrongConceptIds, pair.conceptKey]);
    }
    if (round.mode === "bonus") {
      state.bonusSeenConceptIds = uniqueIds([...state.bonusSeenConceptIds, pair.conceptKey]);
    }
    return { questionId: pair.questionId, correct };
  });
  if (round.mode === "bonus") state.bonusRoundsUsed += 1;
  if (!state.bonusEligible && allCorrect(quiz, state.conceptState)) state.bonusEligible = true;
  state.requiredComplete = state.bonusEligible && state.seenConceptIds.length >= quiz.concepts.length;
  state.bonusRoundsEarned = state.firstPassWrongConceptIds.length > 0 ? 1 : 0;
  state.complete = state.bonusEligible
    ? state.requiredComplete && state.bonusRoundsUsed >= state.bonusRoundsEarned
    : roundsUsed >= Math.ceil(quiz.concepts.length / QUESTION_WINDOW_SIZE);

  const totalCount = quiz.concepts.length;
  const correctCount = quiz.concepts.filter((concept) => state.conceptState[concept.conceptKey]).length;
  return {
    state, results, correctCount, totalCount,
    score: Math.round(correctCount / Math.max(1, totalCount) * 100),
  };
};

// The take's only bonus comes after the regular allowance. Reuse the original
// bonus selector: random missed concepts first, then correct concepts to fill.
export const createDailyRound = (
  quiz: QuizDefinition,
  state: QuizSessionState,
  daily: { dailyAttempts: number; dailyBase: number; dailyBonus: number },
) => createRound(quiz, {
  ...state,
  complete: false,
  ...(daily.dailyAttempts >= daily.dailyBase && daily.dailyBonus > 0 ? {
    bonusEligible: true,
    requiredComplete: true,
    bonusRoundsEarned: 1,
    bonusRoundsUsed: 0,
  } : {
    // Regular rounds cover the bank once, even when earlier answers were wrong.
    bonusEligible: true,
    requiredComplete: false,
  }),
});

export const attemptStats = (attempts: LocalAttempt[]) => {
  const total = attempts.length;
  const perfect = attempts.filter((attempt) => attempt.score === 100).length;
  return {
    total, perfect, below: total - perfect,
    perfectPercent: total ? perfect / total * 100 : null,
    belowPercent: total ? (total - perfect) / total * 100 : null,
  };
};

export const formatPercent = (value: number | null) =>
  value === null ? "—" : `${Number(value.toFixed(1))}%`;
