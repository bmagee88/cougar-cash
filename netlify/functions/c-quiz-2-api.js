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

const getQuizRows = async () => {
  const result = await getPool().query(`
    SELECT
      q.id,
      q.quiz_name,
      q.quiz_number,
      t.display_name AS teacher,
      u.name AS unit,
      s.name AS section,
      COUNT(qq.id)::int AS question_count
    FROM cquiz2_quizzes q
    JOIN cquiz2_teachers t ON t.id = q.teacher_id
    JOIN cquiz2_units u ON u.id = q.unit_id
    JOIN cquiz2_sections s ON s.id = q.section_id
    LEFT JOIN cquiz2_questions qq
      ON qq.quiz_id = q.id
     AND qq.active = true
    WHERE q.active = true
    GROUP BY q.id, q.quiz_name, q.quiz_number, t.display_name, u.name, s.name
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

const getQuizQuestions = async (quizId) => {
  const result = await getPool().query(
    `
      SELECT id, prompt, answer
      FROM cquiz2_questions
      WHERE quiz_id = $1
        AND active = true
      ORDER BY position, id
    `,
    [quizId],
  );
  return result.rows;
};

const getQuizMeta = async (quizId) => {
  const result = await getPool().query(
    `
      SELECT
        q.id,
        q.quiz_name,
        q.quiz_number,
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
  return result.rows[0];
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

const ensureAttemptSession = async ({ userId, quizId, attemptSessionId }) => {
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
        '{}'::jsonb,
        '[]'::jsonb,
        now() + ($3 || ' seconds')::interval
      )
      RETURNING *
    `,
    [userId, quizId, ROUND_TTL_SECONDS],
  );
  return inserted.rows[0];
};

const createRound = (questions, questionState) => {
  const normalizedState = { ...questionState };
  for (const question of questions) {
    if (normalizedState[question.id] == null) normalizedState[question.id] = false;
  }

  const incorrect = questions.filter((question) => !normalizedState[question.id]);
  const correct = questions.filter((question) => normalizedState[question.id]);
  const targetCount = Math.min(QUESTION_WINDOW_SIZE, questions.length);
  const basePool = incorrect.length ? incorrect : questions;
  const remainingSlots = Math.max(0, targetCount - basePool.length);
  const sampledCorrect = shuffle(correct).slice(0, remainingSlots);
  const selectedQuestions = shuffle([...basePool, ...sampledCorrect]).slice(
    0,
    targetCount,
  );
  const selectedAnswers = shuffle(selectedQuestions);

  const questionPublicIds = new Map(
    selectedQuestions.map((question) => [question.id, randomToken(12)]),
  );
  const answerPublicIds = new Map(
    selectedAnswers.map((question) => [question.id, randomToken(12)]),
  );

  const roundPayload = selectedQuestions.map((question) => ({
    questionPublicId: questionPublicIds.get(question.id),
    questionId: question.id,
    answerPublicId: answerPublicIds.get(question.id),
    answerQuestionId: question.id,
  }));

  return {
    normalizedState,
    roundPayload,
    clientQuestions: selectedQuestions.map((question) => ({
      id: questionPublicIds.get(question.id),
      text: question.prompt,
    })),
    clientAnswers: selectedAnswers.map((question) => ({
      id: answerPublicIds.get(question.id),
      text: question.answer,
    })),
  };
};

const handleStartRound = async (event, headers) => {
  assertSameOriginWrite(event);
  const session = await requireSession(event, { requireCsrf: true });
  const body = parseBody(event);
  const quizId = String(body.quizId || "");
  if (!quizId) return json(400, { error: "Missing quiz id." }, headers);

  const [quiz, questions] = await Promise.all([
    getQuizMeta(quizId),
    getQuizQuestions(quizId),
  ]);

  if (!quiz) return json(404, { error: "Quiz not found." }, headers);
  if (!questions.length) {
    return json(400, { error: "This quiz has no active questions." }, headers);
  }

  const today = getTodayKey();
  const maxToday = maxAttemptsPerDay(questions.length);
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

  const attemptSession = await ensureAttemptSession({
    userId: session.user.id,
    quizId,
    attemptSessionId: body.attemptSessionId,
  });

  const round = createRound(questions, attemptSession.question_state || {});
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
      totalQuestions: questions.length,
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

  const questions = await getQuizQuestions(attemptSession.quiz_id);
  const quiz = await getQuizMeta(attemptSession.quiz_id);
  const today = getTodayKey();
  const maxToday = maxAttemptsPerDay(questions.length);
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

  const questionByPublicId = new Map(
    roundPayload.map((item) => [item.questionPublicId, item]),
  );
  const answerByPublicId = new Map(
    roundPayload.map((item) => [item.answerPublicId, item]),
  );
  const pairByQuestionId = new Map(
    pairs.map((pair) => [String(pair.questionId || ""), String(pair.answerId || "")]),
  );

  const questionState = { ...(attemptSession.question_state || {}) };
  const answerRows = [];
  const results = [];

  for (const roundItem of roundPayload) {
    const submittedAnswerPublicId = pairByQuestionId.get(
      roundItem.questionPublicId,
    );
    const answerItem = answerByPublicId.get(submittedAnswerPublicId);
    const isCorrect =
      !!answerItem && answerItem.answerQuestionId === roundItem.questionId;

    questionState[roundItem.questionId] = isCorrect;
    answerRows.push({
      questionId: roundItem.questionId,
      selectedQuestionId: answerItem?.answerQuestionId || null,
      isCorrect,
      checked: !!pairs.find(
        (pair) => String(pair.questionId || "") === roundItem.questionPublicId,
      )?.checked,
    });
    results.push({
      questionId: roundItem.questionPublicId,
      correct: isCorrect,
    });
  }

  const totalCount = questions.length;
  const correctCount = questions.filter((question) => questionState[question.id])
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
            question_id,
            selected_question_id,
            is_correct,
            checked_by_student
          )
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          attemptId,
          answer.questionId,
          answer.selectedQuestionId,
          answer.isCorrect,
          answer.checked,
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
      [attemptSession.id, JSON.stringify(questionState), ROUND_TTL_SECONDS],
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
      results,
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
