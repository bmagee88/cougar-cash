const {
  QUESTION_WINDOW_SIZE,
  ROUND_TTL_SECONDS,
  clearCsrfCookie,
  clearSessionCookie,
  computeStreakStatus,
  corsHeaders,
  digest,
  getPool,
  getSessionToken,
  getTodayKey,
  json,
  maxAttemptsPerDay,
  parseBody,
  randomToken,
  requireSession,
  assertSameOriginWrite,
  shuffle,
} = require("./c-quiz-2-shared");

const dateValueToKey = (value) => {
  if (!value) return getTodayKey();
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
};

const toAttemptDto = (row) => ({
  id: row.id,
  score: Number(row.score),
  correctCount: Number(row.correct_count),
  totalCount: Number(row.total_count),
  attemptDate: dateValueToKey(row.attempt_date),
  createdAt: row.created_at,
});

const toTeacherAttemptDto = (row) => ({
  id: row.attempt_id,
  score: Number(row.score),
  correctCount: Number(row.correct_count),
  totalCount: Number(row.total_count),
  attemptDate: dateValueToKey(row.attempt_date),
  createdAt: row.created_at,
});

const buildQuizSummaries = (quizzes, attempts, today) => {
  const attemptsByQuiz = new Map();
  for (const attempt of attempts) {
    const quizAttempts = attemptsByQuiz.get(attempt.quiz_id) || [];
    quizAttempts.push(attempt);
    attemptsByQuiz.set(attempt.quiz_id, quizAttempts);
  }

  return quizzes.map((quiz) => {
    const quizAttempts = (attemptsByQuiz.get(quiz.id) || []).map(toAttemptDto);
    const streakInput = quizAttempts.map((attempt) => ({
      score: attempt.score,
      attempt_date: attempt.attemptDate,
    }));
    const { status, hasAnyAttemptsEver } = computeStreakStatus(
      streakInput,
      today,
    );
    const questionCount = Number(quiz.question_count || 0);
    const maxToday = maxAttemptsPerDay(questionCount || QUESTION_WINDOW_SIZE);
    const attemptsToday = quizAttempts.filter(
      (attempt) => attempt.attemptDate === today,
    ).length;

    return {
      id: quiz.id,
      quizName: quiz.quiz_name,
      quizNumber: quiz.quiz_number,
      gradeLevel: quiz.grade_level == null ? null : Number(quiz.grade_level),
      teacher: quiz.teacher,
      unit: quiz.unit,
      section: quiz.section,
      questionCount,
      maxAttemptsPerDay: maxToday,
      attemptsToday,
      attemptsRemainingToday: Math.max(0, maxToday - attemptsToday),
      greenChecks: status.green,
      yellowCheck: status.cap === "yellow" ? 1 : 0,
      greyCheck: status.cap === "grey" ? 1 : 0,
      due: status.due,
      dueDate: status.dueDate,
      daysUntilDue: status.daysUntilDue,
      hasAnyAttemptsEver,
      latestScore: quizAttempts[quizAttempts.length - 1]?.score ?? null,
      attempts: quizAttempts,
    };
  });
};

const isTeacherRole = (user) => user?.role === "teacher" || user?.role === "admin";

const requireTeacherSession = async (event) => {
  const session = await requireSession(event);
  if (!isTeacherRole(session.user)) {
    const err = new Error("Teacher access required.");
    err.statusCode = 403;
    throw err;
  }
  return session;
};

const toTeacherQuizMeta = (row) => ({
  id: row.id || row.quiz_id,
  quizName: row.quiz_name,
  quizNumber: row.quiz_number,
  gradeLevel: row.grade_level == null ? null : Number(row.grade_level),
  teacher: row.teacher,
  unit: row.unit,
  section: row.section,
});

const getStatusMetrics = (attempts, today) => {
  const streakInput = attempts.map((attempt) => ({
    score: attempt.score,
    attempt_date: attempt.attemptDate,
  }));
  const status = computeStreakStatus(streakInput, today).status;
  let maxChecks = 0;

  for (let index = 0; index < streakInput.length; index += 1) {
    const slice = streakInput.slice(0, index + 1);
    const historicalToday = slice[index].attempt_date || today;
    const historicalStatus = computeStreakStatus(slice, historicalToday).status;
    maxChecks = Math.max(maxChecks, historicalStatus.green);
  }

  return {
    greenChecks: status.green,
    yellowChecks: status.cap === "yellow" ? 1 : 0,
    greyChecks: status.cap === "grey" ? 1 : 0,
    due: status.due,
    dueDate: status.dueDate,
    daysUntilDue: status.daysUntilDue,
    maxChecks,
  };
};

const getHighestAggregateChecks = (studentQuizzes, today) => {
  const dates = new Set([today]);
  for (const studentQuiz of studentQuizzes) {
    for (const attempt of studentQuiz.attempts) {
      if (attempt.attemptDate <= today) dates.add(attempt.attemptDate);
    }
  }

  let highest = 0;
  for (const date of Array.from(dates).sort()) {
    const total = studentQuizzes.reduce((sum, studentQuiz) => {
      const attemptsThroughDate = studentQuiz.attempts.filter(
        (attempt) => attempt.attemptDate <= date,
      );
      if (!attemptsThroughDate.length) return sum;
      const streakInput = attemptsThroughDate.map((attempt) => ({
        score: attempt.score,
        attempt_date: attempt.attemptDate,
      }));
      return sum + computeStreakStatus(streakInput, date).status.green;
    }, 0);
    highest = Math.max(highest, total);
  }

  return highest;
};

const getTeacherQuizRows = async (session) => {
  const isAdmin = session.user.role === "admin";
  const params = isAdmin ? [] : [session.user.id];
  const teacherPredicate = isAdmin ? "" : "AND t.user_id = $1";
  const result = await getPool().query(
    `
      SELECT
        q.id,
        q.quiz_name,
        q.quiz_number,
        q.grade_level,
        t.display_name AS teacher,
        u.name AS unit,
        s.name AS section
      FROM cquiz2_quizzes q
      JOIN cquiz2_teachers t ON t.id = q.teacher_id
      JOIN cquiz2_units u ON u.id = q.unit_id
      JOIN cquiz2_sections s ON s.id = q.section_id
      WHERE q.active = true
        ${teacherPredicate}
      ORDER BY q.quiz_number, q.quiz_name, q.grade_level, u.name, s.name
    `,
    params,
  );
  return result.rows;
};

const getTeacherAttemptRows = async (session) => {
  const isAdmin = session.user.role === "admin";
  const params = isAdmin ? [] : [session.user.id];
  const teacherPredicate = isAdmin ? "" : "AND t.user_id = $1";
  const result = await getPool().query(
    `
      SELECT
        a.id AS attempt_id,
        a.quiz_id,
        a.score,
        a.correct_count,
        a.total_count,
        a.attempt_date,
        a.created_at,
        u.anon_id,
        q.quiz_name,
        q.quiz_number,
        q.grade_level,
        t.display_name AS teacher,
        unit.name AS unit,
        section.name AS section
      FROM cquiz2_attempts a
      JOIN cquiz2_users u ON u.id = a.user_id
      JOIN cquiz2_quizzes q ON q.id = a.quiz_id
      JOIN cquiz2_teachers t ON t.id = q.teacher_id
      JOIN cquiz2_units unit ON unit.id = q.unit_id
      JOIN cquiz2_sections section ON section.id = q.section_id
      WHERE q.active = true
        ${teacherPredicate}
      ORDER BY u.anon_id, q.quiz_number, q.quiz_name, a.created_at
    `,
    params,
  );
  return result.rows;
};

const buildTeacherSummaries = (quizzes, attemptRows, today) => {
  const pairMap = new Map();

  for (const row of attemptRows) {
    const key = `${row.anon_id}:${row.quiz_id}`;
    if (!pairMap.has(key)) {
      pairMap.set(key, {
        anonId: row.anon_id,
        quiz: toTeacherQuizMeta(row),
        attempts: [],
      });
    }
    pairMap.get(key).attempts.push(toTeacherAttemptDto(row));
  }

  const studentQuizSummaries = Array.from(pairMap.values()).map((pair) => {
    const attempts = pair.attempts.sort(
      (left, right) => new Date(left.createdAt) - new Date(right.createdAt),
    );
    const metrics = getStatusMetrics(attempts, today);
    return {
      ...pair.quiz,
      anonId: pair.anonId,
      greenChecks: metrics.greenChecks,
      yellowChecks: metrics.yellowChecks,
      greyChecks: metrics.greyChecks,
      due: metrics.due,
      dueDate: metrics.dueDate,
      daysUntilDue: metrics.daysUntilDue,
      maxChecks: metrics.maxChecks,
      attempts,
    };
  });

  const studentsByAlias = new Map();
  for (const quizSummary of studentQuizSummaries) {
    if (!studentsByAlias.has(quizSummary.anonId)) {
      studentsByAlias.set(quizSummary.anonId, {
        anonId: quizSummary.anonId,
        totalChecks: 0,
        quizCount: 0,
        quizzes: [],
      });
    }
    const student = studentsByAlias.get(quizSummary.anonId);
    student.totalChecks += quizSummary.greenChecks;
    student.quizCount += 1;
    student.quizzes.push(quizSummary);
  }

  const students = Array.from(studentsByAlias.values())
    .map((student) => ({
      ...student,
      quizzes: student.quizzes.sort((left, right) => {
        const byNumber = Number(left.quizNumber ?? -1) - Number(right.quizNumber ?? -1);
        if (byNumber !== 0) return byNumber;
        return left.quizName.localeCompare(right.quizName, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      }),
    }))
    .sort((left, right) =>
      left.anonId.localeCompare(right.anonId, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );

  const studentQuizzesByQuizId = new Map();
  for (const quizSummary of studentQuizSummaries) {
    const quizStudents = studentQuizzesByQuizId.get(quizSummary.id) || [];
    quizStudents.push(quizSummary);
    studentQuizzesByQuizId.set(quizSummary.id, quizStudents);
  }

  const quizSummaries = quizzes.map((quizRow) => {
    const quiz = toTeacherQuizMeta(quizRow);
    const quizStudents = studentQuizzesByQuizId.get(quiz.id) || [];
    const totalChecksCurrently = quizStudents.reduce(
      (sum, studentQuiz) => sum + studentQuiz.greenChecks,
      0,
    );
    const studentsForQuiz = quizStudents
      .map((studentQuiz) => ({
        anonId: studentQuiz.anonId,
        currentChecks: studentQuiz.greenChecks,
        maxChecks: studentQuiz.maxChecks,
        attempts: studentQuiz.attempts,
      }))
      .sort((left, right) =>
        left.anonId.localeCompare(right.anonId, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );

    return {
      ...quiz,
      totalUniqueStudentsAttempted: studentsForQuiz.length,
      totalChecksCurrently,
      highestChecksToDate: getHighestAggregateChecks(quizStudents, today),
      students: studentsForQuiz,
    };
  });

  return { students, quizzes: quizSummaries };
};

const getQuizRows = async () => {
  const result = await getPool().query(`
    SELECT
      q.id,
      q.quiz_name,
      q.quiz_number,
      q.grade_level,
      t.display_name AS teacher,
      u.name AS unit,
      s.name AS section,
      COALESCE(
        NULLIF(COUNT(DISTINCT c.id), 0),
        COUNT(DISTINCT qq.id)
      )::int AS question_count
    FROM cquiz2_quizzes q
    JOIN cquiz2_teachers t ON t.id = q.teacher_id
    JOIN cquiz2_units u ON u.id = q.unit_id
    JOIN cquiz2_sections s ON s.id = q.section_id
    LEFT JOIN cquiz2_concepts c
      ON c.quiz_id = q.id
     AND c.active = true
    LEFT JOIN cquiz2_questions qq
      ON qq.quiz_id = q.id
     AND qq.active = true
    WHERE q.active = true
    GROUP BY q.id, q.quiz_name, q.quiz_number, q.grade_level, t.display_name, u.name, s.name
    ORDER BY t.display_name, u.name, s.name, q.quiz_number, q.quiz_name
  `);
  return result.rows;
};

const getAttemptsForUser = async (userId) => {
  const result = await getPool().query(
    `
      SELECT
        id,
        quiz_id,
        score,
        correct_count,
        total_count,
        attempt_date,
        created_at
      FROM cquiz2_attempts
      WHERE user_id = $1
      ORDER BY created_at ASC
    `,
    [userId],
  );
  return result.rows;
};

const handleSession = async (event, headers) => {
  try {
    const session = await requireSession(event);
    return json(
      200,
      {
        signedIn: true,
        user: session.user,
        idleTimeoutSeconds: 20 * 60,
      },
      headers,
    );
  } catch (err) {
    return json(
      200,
      {
        signedIn: false,
        user: null,
        idleTimeoutSeconds: 20 * 60,
      },
      {
        ...headers,
        "Set-Cookie": [clearSessionCookie(), clearCsrfCookie()],
      },
    );
  }
};

const handleDashboard = async (event, headers) => {
  const session = await requireSession(event);
  const today = getTodayKey();
  const [quizzes, attempts] = await Promise.all([
    getQuizRows(),
    getAttemptsForUser(session.user.id),
  ]);
  const quizSummaries = buildQuizSummaries(quizzes, attempts, today);

  return json(
    200,
    {
      today,
      user: session.user,
      quizzes: quizSummaries,
      totals: {
        greenChecks: quizSummaries.reduce(
          (sum, quiz) => sum + quiz.greenChecks,
          0,
        ),
        yellowChecks: quizSummaries.reduce(
          (sum, quiz) => sum + quiz.yellowCheck,
          0,
        ),
        dueToday: quizSummaries.filter((quiz) => quiz.due).length,
      },
    },
    headers,
  );
};

const handleTeacherDashboard = async (event, headers) => {
  const session = await requireTeacherSession(event);
  const today = getTodayKey();
  const [quizzes, attemptRows] = await Promise.all([
    getTeacherQuizRows(session),
    getTeacherAttemptRows(session),
  ]);
  const summaries = buildTeacherSummaries(quizzes, attemptRows, today);

  return json(
    200,
    {
      today,
      user: session.user,
      students: summaries.students,
      quizzes: summaries.quizzes,
    },
    headers,
  );
};

const backfillLegacyConceptsForQuiz = async (quizId) => {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `
        INSERT INTO cquiz2_concepts (
          quiz_id,
          concept_key,
          concept_name,
          position,
          active,
          created_at,
          updated_at
        )
        SELECT
          q.quiz_id,
          'legacy-' || q.position::text,
          left(q.prompt, 160),
          q.position,
          q.active,
          q.created_at,
          q.updated_at
        FROM cquiz2_questions q
        WHERE q.quiz_id = $1
        ON CONFLICT (quiz_id, concept_key)
        DO UPDATE SET
          concept_name = EXCLUDED.concept_name,
          position = EXCLUDED.position,
          active = EXCLUDED.active,
          updated_at = now()
      `,
      [quizId],
    );
    await client.query(
      `
        INSERT INTO cquiz2_question_variants (
          concept_id,
          question_text,
          relationship_type,
          active,
          created_at,
          updated_at
        )
        SELECT
          c.id,
          q.prompt,
          'direct',
          q.active,
          q.created_at,
          q.updated_at
        FROM cquiz2_questions q
        JOIN cquiz2_concepts c
          ON c.quiz_id = q.quiz_id
         AND c.concept_key = 'legacy-' || q.position::text
        WHERE q.quiz_id = $1
        ON CONFLICT (concept_id, question_text)
        DO UPDATE SET
          active = EXCLUDED.active,
          updated_at = now()
      `,
      [quizId],
    );
    await client.query(
      `
        INSERT INTO cquiz2_answer_variants (
          concept_id,
          answer_text,
          active,
          created_at,
          updated_at
        )
        SELECT
          c.id,
          q.answer,
          q.active,
          q.created_at,
          q.updated_at
        FROM cquiz2_questions q
        JOIN cquiz2_concepts c
          ON c.quiz_id = q.quiz_id
         AND c.concept_key = 'legacy-' || q.position::text
        WHERE q.quiz_id = $1
        ON CONFLICT (concept_id, answer_text)
        DO UPDATE SET
          active = EXCLUDED.active,
          updated_at = now()
      `,
      [quizId],
    );
    await client.query(
      `
        INSERT INTO cquiz2_valid_matches (question_variant_id, answer_variant_id)
        SELECT qv.id, av.id
        FROM cquiz2_questions q
        JOIN cquiz2_concepts c
          ON c.quiz_id = q.quiz_id
         AND c.concept_key = 'legacy-' || q.position::text
        JOIN cquiz2_question_variants qv
          ON qv.concept_id = c.id
         AND qv.question_text = q.prompt
        JOIN cquiz2_answer_variants av
          ON av.concept_id = c.id
         AND av.answer_text = q.answer
        WHERE q.quiz_id = $1
        ON CONFLICT (question_variant_id, answer_variant_id)
        DO NOTHING
      `,
      [quizId],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const getQuizConcepts = async (quizId, { allowBackfill = true } = {}) => {
  const conceptResult = await getPool().query(
    `
      SELECT id, concept_key, concept_name, position, confusability_group
      FROM cquiz2_concepts
      WHERE quiz_id = $1
        AND active = true
      ORDER BY position, id
    `,
    [quizId],
  );

  if (!conceptResult.rows.length && allowBackfill) {
    await backfillLegacyConceptsForQuiz(quizId);
    return getQuizConcepts(quizId, { allowBackfill: false });
  }

  const concepts = conceptResult.rows.map((row) => ({
    id: row.id,
    conceptKey: row.concept_key,
    conceptName: row.concept_name,
    position: Number(row.position),
    confusabilityGroup: row.confusability_group,
    questionVariants: [],
    answerVariants: [],
  }));

  if (!concepts.length) return [];

  const conceptIds = concepts.map((concept) => concept.id);
  const [questionResult, answerResult] = await Promise.all([
    getPool().query(
      `
        SELECT id, concept_id, question_text, relationship_type
        FROM cquiz2_question_variants
        WHERE concept_id = ANY($1::uuid[])
          AND active = true
        ORDER BY concept_id, id
      `,
      [conceptIds],
    ),
    getPool().query(
      `
        SELECT id, concept_id, answer_text
        FROM cquiz2_answer_variants
        WHERE concept_id = ANY($1::uuid[])
          AND active = true
        ORDER BY concept_id, id
      `,
      [conceptIds],
    ),
  ]);

  const conceptById = new Map(concepts.map((concept) => [concept.id, concept]));
  const questionById = new Map();
  for (const row of questionResult.rows) {
    const questionVariant = {
      id: row.id,
      text: row.question_text,
      relationshipType: row.relationship_type,
      validAnswerIds: [],
    };
    questionById.set(row.id, questionVariant);
    conceptById.get(row.concept_id)?.questionVariants.push(questionVariant);
  }

  for (const row of answerResult.rows) {
    conceptById.get(row.concept_id)?.answerVariants.push({
      id: row.id,
      text: row.answer_text,
    });
  }

  if (questionById.size) {
    const matchResult = await getPool().query(
      `
        SELECT vm.question_variant_id, vm.answer_variant_id
        FROM cquiz2_valid_matches vm
        JOIN cquiz2_answer_variants av ON av.id = vm.answer_variant_id
        WHERE vm.question_variant_id = ANY($1::uuid[])
          AND av.active = true
      `,
      [Array.from(questionById.keys())],
    );
    for (const row of matchResult.rows) {
      questionById
        .get(row.question_variant_id)
        ?.validAnswerIds.push(row.answer_variant_id);
    }
  }

  return concepts.filter(
    (concept) => concept.questionVariants.length && concept.answerVariants.length,
  );
};

const getQuizMeta = async (quizId) => {
  const result = await getPool().query(
    `
      SELECT
        q.id,
        q.quiz_name,
        q.quiz_number,
        q.grade_level,
        t.display_name AS teacher,
        u.name AS unit,
        s.name AS section
      FROM cquiz2_quizzes q
      JOIN cquiz2_teachers t ON t.id = q.teacher_id
      JOIN cquiz2_units u ON u.id = q.unit_id
      JOIN cquiz2_sections s ON s.id = q.section_id
      WHERE q.id = $1
        AND q.active = true
    `,
    [quizId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    quizName: row.quiz_name,
    quizNumber: row.quiz_number,
    gradeLevel: row.grade_level == null ? null : Number(row.grade_level),
    teacher: row.teacher,
    unit: row.unit,
    section: row.section,
  };
};

const countAttemptsToday = async (userId, quizId, today) => {
  const result = await getPool().query(
    `
      SELECT COUNT(*)::int AS count
      FROM cquiz2_attempts
      WHERE user_id = $1
        AND quiz_id = $2
        AND attempt_date = $3::date
    `,
    [userId, quizId, today],
  );
  return Number(result.rows[0]?.count || 0);
};

const getPersistedConceptState = async (userId, quizId) => {
  const result = await getPool().query(
    `
      SELECT concept_id, is_correct
      FROM cquiz2_user_concept_state
      WHERE user_id = $1
        AND quiz_id = $2
    `,
    [userId, quizId],
  );

  return Object.fromEntries(
    result.rows.map((row) => [row.concept_id, row.is_correct]),
  );
};

const ensureAttemptSession = async ({
  userId,
  quizId,
  attemptSessionId,
  initialQuestionState = {},
}) => {
  if (attemptSessionId) {
    const existing = await getPool().query(
      `
        SELECT *
        FROM cquiz2_attempt_sessions
        WHERE id = $1
          AND user_id = $2
          AND quiz_id = $3
          AND expires_at > now()
      `,
      [attemptSessionId, userId, quizId],
    );
    if (!existing.rows[0]) {
      const err = new Error("Quiz session expired. Start the quiz again.");
      err.statusCode = 410;
      throw err;
    }
    return existing.rows[0];
  }

  const inserted = await getPool().query(
    `
      INSERT INTO cquiz2_attempt_sessions (
        user_id,
        quiz_id,
        question_state,
        current_round_payload,
        expires_at
      )
      VALUES (
        $1,
        $2,
        $3::jsonb,
        '[]'::jsonb,
        now() + ($4 || ' seconds')::interval
      )
      RETURNING *
    `,
    [userId, quizId, JSON.stringify(initialQuestionState), ROUND_TTL_SECONDS],
  );
  return inserted.rows[0];
};

const chooseOne = (items) => shuffle(items)[0];

const getCompatibleAnswerVariants = (concept, questionVariant) => {
  if (!questionVariant.validAnswerIds.length) return concept.answerVariants;
  const compatible = concept.answerVariants.filter((answerVariant) =>
    questionVariant.validAnswerIds.includes(answerVariant.id),
  );
  return compatible.length ? compatible : concept.answerVariants;
};

const createRound = (concepts, conceptState) => {
  const normalizedState = { ...conceptState };
  for (const concept of concepts) {
    if (normalizedState[concept.id] == null) normalizedState[concept.id] = false;
  }

  const incorrect = concepts.filter((concept) => !normalizedState[concept.id]);
  const correct = concepts.filter((concept) => normalizedState[concept.id]);
  const targetCount = Math.min(QUESTION_WINDOW_SIZE, concepts.length);
  const basePool = incorrect.length ? incorrect : concepts;
  const remainingSlots = Math.max(0, targetCount - basePool.length);
  const sampledCorrect = shuffle(correct).slice(0, remainingSlots);
  const selectedConcepts = shuffle([...basePool, ...sampledCorrect]).slice(
    0,
    targetCount,
  );
  const selectedPairs = selectedConcepts.map((concept) => {
    const questionVariant = chooseOne(concept.questionVariants);
    const answerVariant = chooseOne(
      getCompatibleAnswerVariants(concept, questionVariant),
    );
    return { concept, questionVariant, answerVariant };
  });
  const selectedAnswers = shuffle(selectedPairs);

  const questionPublicIds = new Map(
    selectedPairs.map((pair) => [pair.concept.id, randomToken(12)]),
  );
  const answerPublicIds = new Map(
    selectedAnswers.map((pair) => [pair.answerVariant.id, randomToken(12)]),
  );

  const roundPayload = selectedPairs.map((pair) => ({
    questionPublicId: questionPublicIds.get(pair.concept.id),
    conceptId: pair.concept.id,
    questionVariantId: pair.questionVariant.id,
    answerVariantId: pair.answerVariant.id,
    answerPublicId: answerPublicIds.get(pair.answerVariant.id),
  }));

  return {
    normalizedState,
    roundPayload,
    clientQuestions: selectedPairs.map((pair) => ({
      id: questionPublicIds.get(pair.concept.id),
      text: pair.questionVariant.text,
    })),
    clientAnswers: selectedAnswers.map((pair) => ({
      id: answerPublicIds.get(pair.answerVariant.id),
      text: pair.answerVariant.text,
    })),
  };
};

const handleStartRound = async (event, headers) => {
  assertSameOriginWrite(event);
  const session = await requireSession(event, { requireCsrf: true });
  const body = parseBody(event);
  const quizId = String(body.quizId || "");
  if (!quizId) return json(400, { error: "Missing quiz id." }, headers);

  const [quiz, concepts] = await Promise.all([
    getQuizMeta(quizId),
    getQuizConcepts(quizId),
  ]);

  if (!quiz) return json(404, { error: "Quiz not found." }, headers);
  if (!concepts.length) {
    return json(400, { error: "This quiz has no active concepts." }, headers);
  }

  const today = getTodayKey();
  const maxToday = maxAttemptsPerDay(concepts.length);
  const attemptsToday = await countAttemptsToday(session.user.id, quizId, today);
  if (attemptsToday >= maxToday) {
    return json(
      429,
      {
        error: "Daily attempt limit reached.",
        attemptsToday,
        maxAttemptsPerDay: maxToday,
      },
      headers,
    );
  }

  const attemptSessionId = body.attemptSessionId
    ? String(body.attemptSessionId)
    : "";
  const initialQuestionState = attemptSessionId
    ? {}
    : await getPersistedConceptState(session.user.id, quizId);

  const attemptSession = await ensureAttemptSession({
    userId: session.user.id,
    quizId,
    attemptSessionId,
    initialQuestionState,
  });

  const round = createRound(concepts, attemptSession.question_state || {});
  const updated = await getPool().query(
    `
      UPDATE cquiz2_attempt_sessions
      SET question_state = $2::jsonb,
          current_round_payload = $3::jsonb,
          current_round = current_round + 1,
          expires_at = now() + ($4 || ' seconds')::interval,
          updated_at = now()
      WHERE id = $1
      RETURNING current_round
    `,
    [
      attemptSession.id,
      JSON.stringify(round.normalizedState),
      JSON.stringify(round.roundPayload),
      ROUND_TTL_SECONDS,
    ],
  );

  return json(
    200,
    {
      attemptSessionId: attemptSession.id,
      roundNumber: updated.rows[0].current_round,
      quiz,
      questions: round.clientQuestions,
      answers: round.clientAnswers,
      questionWindowSize: QUESTION_WINDOW_SIZE,
      totalQuestions: concepts.length,
      attemptsToday,
      maxAttemptsPerDay: maxToday,
      attemptsRemainingToday: Math.max(0, maxToday - attemptsToday),
    },
    headers,
  );
};

const handleSubmitRound = async (event, headers) => {
  assertSameOriginWrite(event);
  const session = await requireSession(event, { requireCsrf: true });
  const body = parseBody(event);
  const attemptSessionId = String(body.attemptSessionId || "");
  const pairs = Array.isArray(body.pairs) ? body.pairs : [];

  if (!attemptSessionId) {
    return json(400, { error: "Missing quiz session." }, headers);
  }

  const sessionResult = await getPool().query(
    `
      SELECT *
      FROM cquiz2_attempt_sessions
      WHERE id = $1
        AND user_id = $2
        AND expires_at > now()
    `,
    [attemptSessionId, session.user.id],
  );
  const attemptSession = sessionResult.rows[0];
  if (!attemptSession) {
    return json(410, { error: "Quiz session expired." }, headers);
  }

  const roundPayload = attemptSession.current_round_payload || [];
  if (!roundPayload.length) {
    return json(409, { error: "This round was already submitted." }, headers);
  }

  const concepts = await getQuizConcepts(attemptSession.quiz_id);
  const quiz = await getQuizMeta(attemptSession.quiz_id);
  const today = getTodayKey();
  const maxToday = maxAttemptsPerDay(concepts.length);
  const attemptsToday = await countAttemptsToday(
    session.user.id,
    attemptSession.quiz_id,
    today,
  );

  if (attemptsToday >= maxToday) {
    return json(
      429,
      {
        error: "Daily attempt limit reached.",
        attemptsToday,
        maxAttemptsPerDay: maxToday,
      },
      headers,
    );
  }

  const answerByPublicId = new Map(
    roundPayload.map((item) => [item.answerPublicId, item]),
  );
  const pairByQuestionId = new Map(
    pairs.map((pair) => [String(pair.questionId || ""), String(pair.answerId || "")]),
  );

  const conceptState = { ...(attemptSession.question_state || {}) };
  const answerRows = [];

  for (const roundItem of roundPayload) {
    const submittedAnswerPublicId = pairByQuestionId.get(
      roundItem.questionPublicId,
    );
    const answerItem = answerByPublicId.get(submittedAnswerPublicId);
    const isCorrect = !!answerItem && answerItem.conceptId === roundItem.conceptId;

    conceptState[roundItem.conceptId] = isCorrect;
    answerRows.push({
      conceptId: roundItem.conceptId,
      questionVariantId: roundItem.questionVariantId,
      answerVariantId: roundItem.answerVariantId,
      selectedAnswerVariantId: answerItem?.answerVariantId || null,
      isCorrect,
      checked: !!pairs.find(
        (pair) => String(pair.questionId || "") === roundItem.questionPublicId,
      )?.checked,
    });
  }

  const totalCount = concepts.length;
  const correctCount = concepts.filter((concept) => conceptState[concept.id])
    .length;
  const score = Math.round((correctCount / Math.max(1, totalCount)) * 100);

  const client = await getPool().connect();
  let attemptId;
  try {
    await client.query("BEGIN");
    const attemptResult = await client.query(
      `
        INSERT INTO cquiz2_attempts (
          user_id,
          quiz_id,
          attempt_session_id,
          score,
          correct_count,
          total_count,
          attempt_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::date)
        RETURNING id, created_at
      `,
      [
        session.user.id,
        attemptSession.quiz_id,
        attemptSession.id,
        score,
        correctCount,
        totalCount,
        today,
      ],
    );
    attemptId = attemptResult.rows[0].id;

    for (const answer of answerRows) {
      await client.query(
        `
          INSERT INTO cquiz2_attempt_answers (
            attempt_id,
            concept_id,
            question_variant_id,
            answer_variant_id,
            selected_answer_variant_id,
            is_correct,
            checked_by_student
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          attemptId,
          answer.conceptId,
          answer.questionVariantId,
          answer.answerVariantId,
          answer.selectedAnswerVariantId,
          answer.isCorrect,
          answer.checked,
        ],
      );

      await client.query(
        `
          INSERT INTO cquiz2_user_concept_state (
            user_id,
            quiz_id,
            concept_id,
            is_correct,
            last_attempt_id
          )
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (user_id, concept_id)
          DO UPDATE SET
            quiz_id = EXCLUDED.quiz_id,
            is_correct = EXCLUDED.is_correct,
            last_attempt_id = EXCLUDED.last_attempt_id,
            updated_at = now()
        `,
        [
          session.user.id,
          attemptSession.quiz_id,
          answer.conceptId,
          answer.isCorrect,
          attemptId,
        ],
      );
    }

    await client.query(
      `
        UPDATE cquiz2_attempt_sessions
        SET question_state = $2::jsonb,
            current_round_payload = '[]'::jsonb,
            expires_at = now() + ($3 || ' seconds')::interval,
            updated_at = now()
        WHERE id = $1
      `,
      [attemptSession.id, JSON.stringify(conceptState), ROUND_TTL_SECONDS],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const allAttempts = await getPool().query(
    `
      SELECT score, attempt_date
      FROM cquiz2_attempts
      WHERE user_id = $1
        AND quiz_id = $2
      ORDER BY created_at ASC
    `,
    [session.user.id, attemptSession.quiz_id],
  );
  const status = computeStreakStatus(allAttempts.rows, today).status;
  const attemptsAfterSubmit = attemptsToday + 1;

  return json(
    200,
    {
      attemptId,
      quiz,
      score,
      correctCount,
      totalCount,
      results: [],
      status,
      attemptsToday: attemptsAfterSubmit,
      maxAttemptsPerDay: maxToday,
      attemptsRemainingToday: Math.max(0, maxToday - attemptsAfterSubmit),
      canKeepGoing: score < 100 && attemptsAfterSubmit < maxToday,
    },
    headers,
  );
};

const handleTouch = async (event, headers) => {
  assertSameOriginWrite(event);
  const session = await requireSession(event, { requireCsrf: true });
  return json(200, { ok: true, user: session.user }, headers);
};

const handleLogout = async (event, headers) => {
  assertSameOriginWrite(event);
  const token = getSessionToken(event);
  if (token) {
    await getPool().query("DELETE FROM cquiz2_sessions WHERE token_hash = $1", [
      digest(token),
    ]);
  }

  return json(
    200,
    { ok: true },
    {
      ...headers,
      "Set-Cookie": [clearSessionCookie(), clearCsrfCookie()],
    },
  );
};

exports.handler = async (event) => {
  const headers = corsHeaders(event);

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const action = event.queryStringParameters?.action || "session";

  try {
    if (action === "session") return handleSession(event, headers);
    if (action === "dashboard") return handleDashboard(event, headers);
    if (action === "teacher-dashboard") {
      return handleTeacherDashboard(event, headers);
    }
    if (action === "start-round") return handleStartRound(event, headers);
    if (action === "submit-round") return handleSubmitRound(event, headers);
    if (action === "touch") return handleTouch(event, headers);
    if (action === "logout") return handleLogout(event, headers);

    return json(404, { error: "Unknown C-Quiz-2 action." }, headers);
  } catch (err) {
    console.error("C-Quiz-2 API failed", err);
    const statusCode = err.statusCode || 500;
    return json(
      statusCode,
      {
        error:
          statusCode === 500
            ? "Something went wrong while handling the quiz request."
            : err.message,
      },
      headers,
    );
  }
};
