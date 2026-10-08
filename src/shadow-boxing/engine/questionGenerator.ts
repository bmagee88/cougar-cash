import {
  AttackTargetOption,
  Direction,
  DirectionalOption,
  DIRECTIONS,
  OddOneOutQuestion,
  RelatedQuestion,
  Rng,
  TopicFilter,
  VocabularyConcept,
} from "../types/shadowBoxing";
import {
  findConceptById,
  getConceptsForTopic,
  VOCABULARY,
} from "../data/vocabulary";

const FALLBACK_OBVIOUS_DISTRACTORS = [
  "clouds",
  "sand",
  "basket",
  "lantern",
  "mountain",
  "ocean",
  "chair",
  "pencil",
  "garden",
  "window",
];

function normalizeChoice(choice: string): string {
  return choice.trim().toLowerCase();
}

export function countDisplayWords(value: string): number {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function shuffle<T>(items: T[], rng: Rng = Math.random): T[] {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    const current = copy[index];
    copy[index] = copy[swapIndex];
    copy[swapIndex] = current;
  }

  return copy;
}

function uniqueByLabel(items: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  items.forEach((item) => {
    const key = normalizeChoice(item);
    if (!seen.has(key) && countDisplayWords(item) <= 2) {
      seen.add(key);
      unique.push(item);
    }
  });

  return unique;
}

function takeUnique(
  candidates: string[],
  count: number,
  rng: Rng,
  blocked: string[] = []
): string[] {
  const blockedKeys = new Set(blocked.map(normalizeChoice));
  const shuffled = shuffle(uniqueByLabel(candidates), rng);
  const selected: string[] = [];

  shuffled.forEach((candidate) => {
    if (selected.length >= count) return;
    if (!blockedKeys.has(normalizeChoice(candidate))) {
      selected.push(candidate);
      blockedKeys.add(normalizeChoice(candidate));
    }
  });

  return selected;
}

function getGlobalDistractors(blocked: string[]): string[] {
  const blockedKeys = new Set(blocked.map(normalizeChoice));
  const fromTerms = VOCABULARY.map((concept) => concept.term);
  const fromDistractors = VOCABULARY.flatMap((concept) => [
    ...concept.obviousDistractors,
    ...concept.nearMissDistractors,
  ]);

  return uniqueByLabel([...FALLBACK_OBVIOUS_DISTRACTORS, ...fromTerms, ...fromDistractors]).filter(
    (choice) => !blockedKeys.has(normalizeChoice(choice))
  );
}

function assignDirections<T extends string>(
  labels: T[],
  rng: Rng,
  correctLabel?: T,
  forcedCorrectDirection?: Direction,
  allowedDirections: Direction[] = [...DIRECTIONS]
): DirectionalOption<T>[] {
  const directions = shuffle([...allowedDirections], rng);
  const orderedLabels = [...labels];

  if (correctLabel && forcedCorrectDirection) {
    const correctIndex = orderedLabels.findIndex(
      (label) => normalizeChoice(label) === normalizeChoice(correctLabel)
    );
    if (correctIndex >= 0) {
      const directionIndex = directions.indexOf(forcedCorrectDirection);
      const labelAtForcedDirection = orderedLabels[directionIndex];
      orderedLabels[directionIndex] = orderedLabels[correctIndex];
      orderedLabels[correctIndex] = labelAtForcedDirection;
    }
  }

  return orderedLabels.map((label, index) => ({
    direction: directions[index],
    label,
    value: label,
    isCorrect: correctLabel
      ? normalizeChoice(label) === normalizeChoice(correctLabel)
      : false,
  }));
}

function getCorrectRelatedAnswer(concept: VocabularyConcept, rng: Rng): string {
  const pool = uniqueByLabel([...(concept.synonyms ?? []), ...concept.related]);
  const shuffled = shuffle(pool, rng);
  return shuffled[0] ?? concept.related[0];
}

export function generateRelatedQuestion(
  concept: VocabularyConcept,
  trickMe: boolean,
  rng: Rng = Math.random,
  forcedCorrectDirection?: Direction,
  allowedDirections: Direction[] = [...DIRECTIONS]
): RelatedQuestion {
  const correctAnswer = getCorrectRelatedAnswer(concept, rng);
  const distractorCount = Math.max(1, allowedDirections.length - 1);
  const primaryDistractors = trickMe
    ? concept.nearMissDistractors
    : concept.obviousDistractors;
  const secondaryDistractors = trickMe
    ? concept.obviousDistractors
    : getGlobalDistractors([concept.term, correctAnswer]);
  const distractors = takeUnique(
    [...primaryDistractors, ...secondaryDistractors],
    distractorCount,
    rng,
    [concept.term, correctAnswer, ...concept.related, ...(concept.synonyms ?? [])]
  );
  const fallback = takeUnique(
    getGlobalDistractors([concept.term, correctAnswer, ...distractors]),
    distractorCount - distractors.length,
    rng,
    [concept.term, correctAnswer, ...distractors]
  );
  const options = assignDirections(
    shuffle(
      [correctAnswer, ...distractors, ...fallback].slice(
        0,
        allowedDirections.length
      ),
      rng
    ),
    rng,
    correctAnswer,
    forcedCorrectDirection,
    allowedDirections
  );
  const correctOption = options.find((option) => option.isCorrect);

  return {
    kind: "related",
    concept,
    prompt: concept.term,
    correctAnswer,
    correctDirection: correctOption?.direction ?? "up",
    options,
    trickMe,
  };
}

export function generateOddOneOutQuestion(
  concept: VocabularyConcept,
  trickMe: boolean,
  rng: Rng = Math.random
): OddOneOutQuestion {
  const relatedChoices = takeUnique(
    [...concept.related, ...(concept.synonyms ?? [])],
    3,
    rng,
    [concept.term]
  );
  const oddPool = trickMe
    ? [...concept.nearMissDistractors, ...concept.obviousDistractors]
    : [...concept.obviousDistractors, ...getGlobalDistractors([concept.term])];
  const oddAnswer =
    takeUnique(oddPool, 1, rng, [
      concept.term,
      ...relatedChoices,
      ...concept.related,
      ...(concept.synonyms ?? []),
    ])[0] ?? "clouds";
  const fallbackRelated = takeUnique(
    [...concept.related, ...(concept.synonyms ?? []), ...getGlobalDistractors([oddAnswer])],
    3 - relatedChoices.length,
    rng,
    [concept.term, oddAnswer, ...relatedChoices]
  );
  const options = assignDirections(
    shuffle([...relatedChoices, ...fallbackRelated, oddAnswer].slice(0, 4), rng),
    rng,
    oddAnswer
  );
  const oddOption = options.find((option) => option.isCorrect);

  return {
    kind: "odd-one-out",
    concept,
    prompt: concept.term,
    oddAnswer,
    oddDirection: oddOption?.direction ?? "up",
    options,
    trickMe,
  };
}

export function repositionRelatedQuestion(
  question: RelatedQuestion,
  forcedCorrectDirection: Direction,
  rng: Rng = Math.random
): RelatedQuestion {
  const labels = question.options.map((option) => option.label);
  const options = assignDirections(
    shuffle(labels, rng),
    rng,
    question.correctAnswer,
    forcedCorrectDirection,
    question.options.map((option) => option.direction)
  );
  const correctOption = options.find((option) => option.isCorrect);

  return {
    ...question,
    options,
    correctDirection: correctOption?.direction ?? forcedCorrectDirection,
  };
}

export function generateAttackTargets(
  topic: TopicFilter,
  rng: Rng = Math.random,
  recentConceptIds: string[] = [],
  preferredConceptIds: string[] = []
): AttackTargetOption[] {
  const available = getConceptsForTopic(topic);
  const recent = new Set(recentConceptIds);
  const selected: VocabularyConcept[] = [];
  const selectedTerms = new Set<string>();

  preferredConceptIds.forEach((id) => {
    const concept = findConceptById(id);
    if (!concept) return;
    const termKey = normalizeChoice(concept.term);
    if (!selectedTerms.has(termKey)) {
      selected.push(concept);
      selectedTerms.add(termKey);
    }
  });

  const fresh = shuffle(
    available.filter(
      (concept) =>
        !recent.has(concept.id) && !selectedTerms.has(normalizeChoice(concept.term))
    ),
    rng
  );
  const fallback = shuffle(
    available.filter(
      (concept) => !selectedTerms.has(normalizeChoice(concept.term))
    ),
    rng
  );

  [...fresh, ...fallback].forEach((concept) => {
    if (selected.length >= 4) return;
    const termKey = normalizeChoice(concept.term);
    if (!selectedTerms.has(termKey)) {
      selected.push(concept);
      selectedTerms.add(termKey);
    }
  });

  const directions = shuffle([...DIRECTIONS], rng);

  return selected.slice(0, 4).map((concept, index) => ({
    direction: directions[index],
    concept,
    label: concept.term,
  }));
}

export function validateQuestionOptions(
  question: RelatedQuestion | OddOneOutQuestion,
  expectedOptionCount = 4
): string[] {
  const errors: string[] = [];
  const labels = question.options.map((option) => option.label);
  const uniqueLabels = new Set(labels.map(normalizeChoice));
  const correctCount = question.options.filter((option) => option.isCorrect).length;

  if (question.options.length !== expectedOptionCount) {
    errors.push(
      `${question.prompt} should have exactly ${expectedOptionCount} options.`
    );
  }

  if (uniqueLabels.size !== labels.length) {
    errors.push(`${question.prompt} contains duplicate options.`);
  }

  if (correctCount !== 1) {
    errors.push(`${question.prompt} should have exactly one correct option.`);
  }

  labels.forEach((label) => {
    if (countDisplayWords(label) > 2) {
      errors.push(`${label} is longer than two words.`);
    }
  });

  return errors;
}

export function validateVocabulary(): string[] {
  const errors: string[] = [];

  VOCABULARY.forEach((concept) => {
    const displayed = [
      concept.term,
      ...concept.related,
      ...(concept.synonyms ?? []),
      ...concept.obviousDistractors,
      ...concept.nearMissDistractors,
    ];

    displayed.forEach((value) => {
      if (countDisplayWords(value) > 2) {
        errors.push(`${concept.id} has a phrase longer than two words: ${value}`);
      }
    });

    if (concept.related.length < 3) {
      errors.push(`${concept.id} needs at least three related choices.`);
    }

    if (concept.obviousDistractors.length < 3) {
      errors.push(`${concept.id} needs at least three obvious distractors.`);
    }

    if (concept.nearMissDistractors.length < 3) {
      errors.push(`${concept.id} needs at least three near-miss distractors.`);
    }
  });

  return errors;
}

