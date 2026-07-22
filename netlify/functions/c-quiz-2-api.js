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
  checkEligible: row.check_eligible !== false,
});

const toTeacherAttemptDto = (row) => ({
  id: row.attempt_id,
  score: Number(row.score),
  correctCount: Number(row.correct_count),
  totalCount: Number(row.total_count),
  attemptDate: dateValueToKey(row.attempt_date),
  createdAt: row.created_at,
  checkEligible: row.check_eligible !== false,
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
    const checkEligibleAttempts = quizAttempts.filter(
      (attempt) => attempt.checkEligible,
    );
    const streakInput = checkEligibleAttempts.map((attempt) => ({
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

const requireTeacherSession = async (event, options = {}) => {
  const session = await requireSession(event, options);
  if (!isTeacherRole(session.user)) {
    const err = new Error("Teacher access required.");
    err.statusCode = 403;
    throw err;
  }
  return session;
};

const cleanText = (value, maxLength = 500) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const slugify = (value, fallback = "concept") => {
  const slug = String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/_/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 64);
  return slug || fallback;
};

const normalizeGradeLevels = (value) =>
  Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((grade) => Number.parseInt(String(grade), 10))
        .filter((grade) => Number.isInteger(grade) && grade >= 0 && grade <= 12),
    ),
  ).sort((left, right) => left - right);

const getUserSettings = async (userId) => {
  const result = await getPool().query(
    `
      INSERT INTO cquiz2_user_settings (user_id)
      VALUES ($1)
      ON CONFLICT (user_id)
      DO UPDATE SET user_id = EXCLUDED.user_id
      RETURNING dark_theme, teacher_grade_levels
    `,
    [userId],
  );
  const row = result.rows[0] || {};
  return {
    darkTheme: row.dark_theme === true,
    teacherGradeLevels: normalizeGradeLevels(row.teacher_grade_levels || []),
  };
};

const getLinkedTeacher = async (client, userId) => {
  const result = await client.query(
    `
      SELECT id, display_name
      FROM cquiz2_teachers
      WHERE user_id = $1
      ORDER BY created_at ASC
      LIMIT 1
    `,
    [userId],
  );
  return result.rows[0] || null;
};

const getOrCreateTeacherForSession = async (client, session, displayName) => {
  const linked = await getLinkedTeacher(client, session.user.id);
  if (linked) return linked;

  const safeDisplayName =
    cleanText(displayName, 80) || `Teacher ${session.user.anonId}`;
  const result = await client.query(
    `
      INSERT INTO cquiz2_teachers (display_name, user_id)
      VALUES ($1, $2)
      ON CONFLICT (display_name)
      DO UPDATE SET user_id = COALESCE(cquiz2_teachers.user_id, EXCLUDED.user_id)
      WHERE cquiz2_teachers.user_id IS NULL
         OR cquiz2_teachers.user_id = EXCLUDED.user_id
      RETURNING id, display_name
    `,
    [safeDisplayName, session.user.id],
  );

  const teacher = result.rows[0];
  if (!teacher) {
    const err = new Error("That teacher display name is already in use.");
    err.statusCode = 409;
    throw err;
  }
  return teacher;
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
  const checkEligibleAttempts = attempts.filter(
    (attempt) => attempt.checkEligible !== false,
  );
  const streakInput = checkEligibleAttempts.map((attempt) => ({
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
      if (attempt.checkEligible === false) continue;
      if (attempt.attemptDate <= today) dates.add(attempt.attemptDate);
    }
  }

  let highest = 0;
  for (const date of Array.from(dates).sort()) {
    const total = studentQuizzes.reduce((sum, studentQuiz) => {
      const attemptsThroughDate = studentQuiz.attempts.filter(
        (attempt) =>
          attempt.checkEligible !== false && attempt.attemptDate <= date,
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
        a.check_eligible,
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
        created_at,
        check_eligible
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

const handleTeacherResetQuiz = async (event, headers) => {
  assertSameOriginWrite(event);
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." }, headers);
  }

  const session = await requireTeacherSession(event, { requireCsrf: true });
  const body = parseBody(event);
  const quizId = String(body.quizId || "");
  if (!quizId) return json(400, { error: "Missing quiz id." }, headers);

  const client = await getPool().connect();
  const isAdmin = session.user.role === "admin";
  const teacherParams = isAdmin ? [quizId] : [quizId, session.user.id];
  const teacherPredicate = isAdmin ? "" : "AND t.user_id = $2";

  try {
    await client.query("BEGIN");

    const quizCheck = await client.query(
      `
        SELECT q.id
        FROM cquiz2_quizzes q
        JOIN cquiz2_teachers t ON t.id = q.teacher_id
        WHERE q.id = $1
          AND q.active = true
          ${teacherPredicate}
      `,
      teacherParams,
    );

    if (!quizCheck.rows[0]) {
      const err = new Error("Quiz not found.");
      err.statusCode = 404;
      throw err;
    }

    const affectedUsers = await client.query(
      `
        SELECT COUNT(DISTINCT user_id)::int AS count
        FROM (
          SELECT user_id FROM cquiz2_attempts WHERE quiz_id = $1
          UNION
          SELECT user_id FROM cquiz2_attempt_sessions WHERE quiz_id = $1
          UNION
          SELECT user_id FROM cquiz2_user_concept_state WHERE quiz_id = $1
          UNION
          SELECT user_id FROM cquiz2_user_question_state WHERE quiz_id = $1
        ) affected
      `,
      [quizId],
    );

    const attemptAnswers = await client.query(
      `
        SELECT COUNT(*)::int AS count
        FROM cquiz2_attempt_answers aa
        JOIN cquiz2_attempts a ON a.id = aa.attempt_id
        WHERE a.quiz_id = $1
      `,
      [quizId],
    );

    const attempts = await client.query(
      "DELETE FROM cquiz2_attempts WHERE quiz_id = $1",
      [quizId],
    );
    const attemptSessions = await client.query(
      "DELETE FROM cquiz2_attempt_sessions WHERE quiz_id = $1",
      [quizId],
    );
    const conceptStates = await client.query(
      "DELETE FROM cquiz2_user_concept_state WHERE quiz_id = $1",
      [quizId],
    );
    const questionStates = await client.query(
      "DELETE FROM cquiz2_user_question_state WHERE quiz_id = $1",
      [quizId],
    );

    await client.query("COMMIT");

    return json(
      200,
      {
        ok: true,
        quizId,
        affectedUsers: Number(affectedUsers.rows[0]?.count || 0),
        attemptsDeleted: attempts.rowCount || 0,
        attemptAnswersDeleted: Number(attemptAnswers.rows[0]?.count || 0),
        attemptSessionsDeleted: attemptSessions.rowCount || 0,
        conceptStatesDeleted: conceptStates.rowCount || 0,
        questionStatesDeleted: questionStates.rowCount || 0,
      },
      headers,
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const normalizeQuizDraft = (body) => {
  const conceptKeyCounts = new Map();
  const questionTextOwners = new Map();
  const answerTextOwners = new Map();
  const concepts = (Array.isArray(body.concepts) ? body.concepts : []).map(
    (concept, index) => {
      const position = Number.parseInt(String(concept.position || index + 1), 10);
      const conceptName = cleanText(concept.conceptName || concept.concept_name, 160);
      const conceptKey = slugify(
        concept.conceptKey || concept.concept_key || conceptName,
        `concept-${index + 1}`,
      );
      const confusabilityGroup = cleanText(
        concept.confusabilityGroup || concept.confusability_group || "general",
        120,
      );
      const questionVariants = Array.from(
        new Set(
          (Array.isArray(concept.questionVariants)
            ? concept.questionVariants
            : concept.question_variants || []
          )
            .map((variant) => cleanText(variant, 800))
            .filter(Boolean),
        ),
      );
      const answerVariants = Array.from(
        new Set(
          (Array.isArray(concept.answerVariants)
            ? concept.answerVariants
            : concept.answer_variants || []
          )
            .map((variant) => cleanText(variant, 800))
            .filter(Boolean),
        ),
      );

      conceptKeyCounts.set(conceptKey, (conceptKeyCounts.get(conceptKey) || 0) + 1);
      questionVariants.forEach((text) => {
        const key = text.toLowerCase();
        questionTextOwners.set(key, [
          ...(questionTextOwners.get(key) || []),
          conceptKey,
        ]);
      });
      answerVariants.forEach((text) => {
        const key = text.toLowerCase();
        answerTextOwners.set(key, [
          ...(answerTextOwners.get(key) || []),
          conceptKey,
        ]);
      });

      return {
        position: Number.isInteger(position) && position > 0 ? position : index + 1,
        conceptKey,
        conceptName,
        confusabilityGroup,
        questionVariants,
        answerVariants,
      };
    },
  );

  const quizNumber = Number.parseInt(String(body.quizNumber || body.quiz_number), 10);
  const gradeLevelValue = body.gradeLevel ?? body.grade_level;
  const gradeLevel =
    gradeLevelValue === null || gradeLevelValue === ""
      ? null
      : Number.parseInt(String(gradeLevelValue), 10);
  const errors = [];
  if (!cleanText(body.quizName || body.quiz_name, 160)) errors.push("Quiz name is required.");
  if (!Number.isInteger(quizNumber)) errors.push("Quiz number is required.");
  if (gradeLevel !== null && (!Number.isInteger(gradeLevel) || gradeLevel < 0 || gradeLevel > 12)) {
    errors.push("Grade level must be between 0 and 12.");
  }
  if (!cleanText(body.unitName || body.unit_name, 120)) errors.push("Unit is required.");
  if (!cleanText(body.sectionName || body.section_name, 120)) errors.push("Section is required.");
  if (!concepts.length) errors.push("At least one concept is required.");

  for (const concept of concepts) {
    if (!concept.conceptName) {
      errors.push(`Concept ${concept.position} needs a name.`);
    }
    if (!concept.questionVariants.length) {
      errors.push(`${concept.conceptName || concept.conceptKey} needs at least one question variant.`);
    }
    if (!concept.answerVariants.length) {
      errors.push(`${concept.conceptName || concept.conceptKey} needs at least one answer variant.`);
    }
  }

  for (const [key, count] of conceptKeyCounts.entries()) {
    if (count > 1) errors.push(`Concept key "${key}" is used more than once.`);
  }

  const repeatedQuestions = Array.from(questionTextOwners.entries()).filter(
    ([, owners]) => new Set(owners).size > 1,
  );
  const repeatedAnswers = Array.from(answerTextOwners.entries()).filter(
    ([, owners]) => new Set(owners).size > 1,
  );
  if (repeatedQuestions.length) {
    errors.push("The same question text appears in more than one concept.");
  }
  if (repeatedAnswers.length) {
    errors.push("The same answer text appears in more than one concept.");
  }

  if (errors.length) {
    const err = new Error(errors.join(" "));
    err.statusCode = 400;
    throw err;
  }

  return {
    quizName: cleanText(body.quizName || body.quiz_name, 160),
    quizNumber,
    gradeLevel,
    unitName: cleanText(body.unitName || body.unit_name, 120),
    sectionName: cleanText(body.sectionName || body.section_name, 120),
    teacherDisplayName: cleanText(body.teacherDisplayName || body.teacher_display_name, 80),
    concepts,
  };
};

const getEditableQuizRow = async (client, quizId, session) => {
  const isAdmin = session.user.role === "admin";
  const params = isAdmin ? [quizId] : [quizId, session.user.id];
  const teacherPredicate = isAdmin ? "" : "AND t.user_id = $2";
  const result = await client.query(
    `
      SELECT q.id, q.teacher_id
      FROM cquiz2_quizzes q
      JOIN cquiz2_teachers t ON t.id = q.teacher_id
      WHERE q.id = $1
        AND q.active = true
        ${teacherPredicate}
    `,
    params,
  );
  return result.rows[0] || null;
};

const loadTeacherQuizDetail = async (quizId, session) => {
  const client = await getPool().connect();
  try {
    const quizRow = await getEditableQuizRow(client, quizId, session);
    if (!quizRow) return null;

    const metaResult = await client.query(
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
      `,
      [quizId],
    );
    const conceptResult = await client.query(
      `
        SELECT id, concept_key, concept_name, position, confusability_group
        FROM cquiz2_concepts
        WHERE quiz_id = $1
          AND active = true
        ORDER BY position, concept_name
      `,
      [quizId],
    );
    const conceptIds = conceptResult.rows.map((row) => row.id);
    const [questionResult, answerResult] = conceptIds.length
      ? await Promise.all([
          client.query(
            `
              SELECT concept_id, question_text, difficulty
              FROM cquiz2_question_variants
              WHERE concept_id = ANY($1::uuid[])
                AND active = true
              ORDER BY concept_id, difficulty, id
            `,
            [conceptIds],
          ),
          client.query(
            `
              SELECT concept_id, answer_text, difficulty
              FROM cquiz2_answer_variants
              WHERE concept_id = ANY($1::uuid[])
                AND active = true
              ORDER BY concept_id, difficulty, id
            `,
            [conceptIds],
          ),
        ])
      : [{ rows: [] }, { rows: [] }];

    const questionsByConcept = new Map();
    const answersByConcept = new Map();
    questionResult.rows.forEach((row) => {
      questionsByConcept.set(row.concept_id, [
        ...(questionsByConcept.get(row.concept_id) || []),
        row.question_text,
      ]);
    });
    answerResult.rows.forEach((row) => {
      answersByConcept.set(row.concept_id, [
        ...(answersByConcept.get(row.concept_id) || []),
        row.answer_text,
      ]);
    });

    const meta = metaResult.rows[0];
    return {
      id: meta.id,
      quizName: meta.quiz_name,
      quizNumber: Number(meta.quiz_number),
      gradeLevel: meta.grade_level == null ? null : Number(meta.grade_level),
      teacher: meta.teacher,
      unit: meta.unit,
      section: meta.section,
      concepts: conceptResult.rows.map((row) => ({
        position: Number(row.position),
        conceptKey: row.concept_key,
        conceptName: row.concept_name,
        confusabilityGroup: row.confusability_group || "",
        questionVariants: questionsByConcept.get(row.id) || [],
        answerVariants: answersByConcept.get(row.id) || [],
      })),
    };
  } finally {
    client.release();
  }
};

const saveQuizDraft = async ({ session, quizId, draft }) => {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    const existingQuiz = quizId ? await getEditableQuizRow(client, quizId, session) : null;
    if (quizId && !existingQuiz) {
      const err = new Error("Quiz not found.");
      err.statusCode = 404;
      throw err;
    }

    const teacher = existingQuiz
      ? { id: existingQuiz.teacher_id }
      : await getOrCreateTeacherForSession(
          client,
          session,
          draft.teacherDisplayName,
        );

    const unitResult = await client.query(
      `
        INSERT INTO cquiz2_units (teacher_id, name)
        VALUES ($1, $2)
        ON CONFLICT (teacher_id, name)
        DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `,
      [teacher.id, draft.unitName],
    );
    const unitId = unitResult.rows[0].id;
    const sectionResult = await client.query(
      `
        INSERT INTO cquiz2_sections (unit_id, name)
        VALUES ($1, $2)
        ON CONFLICT (unit_id, name)
        DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `,
      [unitId, draft.sectionName],
    );
    const sectionId = sectionResult.rows[0].id;

    let savedQuizId = quizId;
    if (savedQuizId) {
      await client.query(
        `
          UPDATE cquiz2_quizzes
          SET unit_id = $2,
              section_id = $3,
              quiz_name = $4,
              quiz_number = $5,
              grade_level = $6,
              active = true,
              updated_at = now()
          WHERE id = $1
        `,
        [
          savedQuizId,
          unitId,
          sectionId,
          draft.quizName,
          draft.quizNumber,
          draft.gradeLevel,
        ],
      );
    } else {
      const quizResult = await client.query(
        `
          INSERT INTO cquiz2_quizzes (
            teacher_id,
            unit_id,
            section_id,
            quiz_name,
            quiz_number,
            grade_level,
            active
          )
          VALUES ($1, $2, $3, $4, $5, $6, true)
          ON CONFLICT (teacher_id, unit_id, section_id, quiz_number, quiz_name)
          DO UPDATE SET
            grade_level = EXCLUDED.grade_level,
            active = true,
            updated_at = now()
          RETURNING id
        `,
        [
          teacher.id,
          unitId,
          sectionId,
          draft.quizName,
          draft.quizNumber,
          draft.gradeLevel,
        ],
      );
      savedQuizId = quizResult.rows[0].id;
    }

    const conceptKeys = draft.concepts.map((concept) => concept.conceptKey);
    await client.query(
      `
        UPDATE cquiz2_concepts
        SET active = false,
            updated_at = now()
        WHERE quiz_id = $1
          AND NOT (concept_key = ANY($2::text[]))
      `,
      [savedQuizId, conceptKeys],
    );

    for (const concept of draft.concepts) {
      const conceptResult = await client.query(
        `
          INSERT INTO cquiz2_concepts (
            quiz_id,
            concept_key,
            concept_name,
            position,
            confusability_group,
            active
          )
          VALUES ($1, $2, $3, $4, $5, true)
          ON CONFLICT (quiz_id, concept_key)
          DO UPDATE SET
            concept_name = EXCLUDED.concept_name,
            position = EXCLUDED.position,
            confusability_group = EXCLUDED.confusability_group,
            active = true,
            updated_at = now()
          RETURNING id
        `,
        [
          savedQuizId,
          concept.conceptKey,
          concept.conceptName,
          concept.position,
          concept.confusabilityGroup,
        ],
      );
      const conceptId = conceptResult.rows[0].id;

      await client.query(
        `
          UPDATE cquiz2_question_variants
          SET active = false,
              updated_at = now()
          WHERE concept_id = $1
            AND NOT (question_text = ANY($2::text[]))
        `,
        [conceptId, concept.questionVariants],
      );
      await client.query(
        `
          UPDATE cquiz2_answer_variants
          SET active = false,
              updated_at = now()
          WHERE concept_id = $1
            AND NOT (answer_text = ANY($2::text[]))
        `,
        [conceptId, concept.answerVariants],
      );

      for (let index = 0; index < concept.questionVariants.length; index += 1) {
        await client.query(
          `
            INSERT INTO cquiz2_question_variants (
              concept_id,
              question_text,
              relationship_type,
              difficulty,
              active
            )
            VALUES ($1, $2, 'direct', $3, true)
            ON CONFLICT (concept_id, question_text)
            DO UPDATE SET
              relationship_type = EXCLUDED.relationship_type,
              difficulty = EXCLUDED.difficulty,
              active = true,
              updated_at = now()
          `,
          [conceptId, concept.questionVariants[index], index + 1],
        );
      }

      for (let index = 0; index < concept.answerVariants.length; index += 1) {
        await client.query(
          `
            INSERT INTO cquiz2_answer_variants (
              concept_id,
              answer_text,
              difficulty,
              active
            )
            VALUES ($1, $2, $3, true)
            ON CONFLICT (concept_id, answer_text)
            DO UPDATE SET
              difficulty = EXCLUDED.difficulty,
              active = true,
              updated_at = now()
          `,
          [conceptId, concept.answerVariants[index], index + 1],
        );
      }

      await client.query(
        `
          DELETE FROM cquiz2_valid_matches vm
          USING cquiz2_question_variants qv
          WHERE vm.question_variant_id = qv.id
            AND qv.concept_id = $1
        `,
        [conceptId],
      );
      await client.query(
        `
          INSERT INTO cquiz2_valid_matches (question_variant_id, answer_variant_id)
          SELECT qv.id, av.id
          FROM cquiz2_question_variants qv
          CROSS JOIN cquiz2_answer_variants av
          WHERE qv.concept_id = $1
            AND av.concept_id = $1
            AND qv.active = true
            AND av.active = true
          ON CONFLICT (question_variant_id, answer_variant_id)
          DO NOTHING
        `,
        [conceptId],
      );
    }

    await client.query("COMMIT");
    return savedQuizId;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const handleSettings = async (event, headers) => {
  const session = await requireSession(event, { requireCsrf: event.httpMethod !== "GET" });

  if (event.httpMethod === "GET") {
    return json(200, await getUserSettings(session.user.id), headers);
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." }, headers);
  }

  const body = parseBody(event);
  const darkTheme = body.darkTheme === true;
  const teacherGradeLevels = isTeacherRole(session.user)
    ? normalizeGradeLevels(body.teacherGradeLevels)
    : [];
  const result = await getPool().query(
    `
      INSERT INTO cquiz2_user_settings (
        user_id,
        dark_theme,
        teacher_grade_levels
      )
      VALUES ($1, $2, $3::int[])
      ON CONFLICT (user_id)
      DO UPDATE SET
        dark_theme = EXCLUDED.dark_theme,
        teacher_grade_levels = EXCLUDED.teacher_grade_levels,
        updated_at = now()
      RETURNING dark_theme, teacher_grade_levels
    `,
    [session.user.id, darkTheme, teacherGradeLevels],
  );
  const row = result.rows[0];
  return json(
    200,
    {
      darkTheme: row.dark_theme === true,
      teacherGradeLevels: normalizeGradeLevels(row.teacher_grade_levels || []),
    },
    headers,
  );
};

const handleTeacherQuizDetail = async (event, headers) => {
  const session = await requireTeacherSession(event, {
    requireCsrf: event.httpMethod !== "GET",
  });
  const body = parseBody(event);
  const quizId = String(body.quizId || event.queryStringParameters?.quizId || "");
  if (!quizId) return json(400, { error: "Missing quiz id." }, headers);

  const detail = await loadTeacherQuizDetail(quizId, session);
  if (!detail) return json(404, { error: "Quiz not found." }, headers);
  return json(200, detail, headers);
};

const handleTeacherSaveQuiz = async (event, headers) => {
  assertSameOriginWrite(event);
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." }, headers);
  }

  const session = await requireTeacherSession(event, { requireCsrf: true });
  const body = parseBody(event);
  const quizId = body.quizId ? String(body.quizId) : "";
  const draft = normalizeQuizDraft(body);
  const savedQuizId = await saveQuizDraft({ session, quizId, draft });
  const detail = await loadTeacherQuizDetail(savedQuizId, session);
  return json(200, { ok: true, quizId: savedQuizId, quiz: detail }, headers);
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

const SESSION_STATE_VERSION = 2;

const chooseOne = (items) => shuffle(items)[0];

const uniqueIds = (items) =>
  Array.from(new Set(items.filter((item) => typeof item === "string" && item)));

const validConceptIds = (concepts) => new Set(concepts.map((concept) => concept.id));

const normalizeConceptState = (concepts, conceptState = {}) =>
  Object.fromEntries(
    concepts.map((concept) => [concept.id, conceptState[concept.id] === true]),
  );

const allConceptsCorrect = (concepts, conceptState) =>
  concepts.length > 0 && concepts.every((concept) => conceptState[concept.id] === true);

const countSeenConcepts = (concepts, seenConceptIds) => {
  const validIds = validConceptIds(concepts);
  return seenConceptIds.filter((id) => validIds.has(id)).length;
};

const bonusRoundsForWrongCount = (wrongCount) =>
  Math.ceil(wrongCount / QUESTION_WINDOW_SIZE);

const createInitialSessionState = (concepts, persistedConceptState) => {
  const conceptState = normalizeConceptState(concepts, persistedConceptState);
  const initialAllCorrect = allConceptsCorrect(concepts, conceptState);
  return {
    version: SESSION_STATE_VERSION,
    conceptState,
    initialAllCorrect,
    bonusEligible: initialAllCorrect,
    seenConceptIds: [],
    firstPassWrongConceptIds: [],
    bonusSeenConceptIds: [],
    bonusRoundsEarned: 0,
    bonusRoundsUsed: 0,
    requiredComplete: false,
    complete: false,
  };
};

const normalizeQuizSessionState = (rawState, concepts, fallbackConceptState = {}) => {
  const validIds = validConceptIds(concepts);
  const isStructured =
    rawState &&
    rawState.version === SESSION_STATE_VERSION &&
    rawState.conceptState &&
    typeof rawState.conceptState === "object";
  const source = isStructured ? rawState : {};
  const conceptState = normalizeConceptState(
    concepts,
    isStructured ? source.conceptState : rawState || fallbackConceptState,
  );
  const seenConceptIds = uniqueIds(source.seenConceptIds || []).filter((id) =>
    validIds.has(id),
  );
  const firstPassWrongConceptIds = uniqueIds(
    source.firstPassWrongConceptIds || [],
  ).filter((id) => validIds.has(id));
  const bonusSeenConceptIds = uniqueIds(source.bonusSeenConceptIds || []).filter((id) =>
    validIds.has(id),
  );
  const initialAllCorrect = Boolean(source.initialAllCorrect) ||
    (!isStructured && allConceptsCorrect(concepts, conceptState));
  const bonusEligible = Boolean(source.bonusEligible) || initialAllCorrect;
  const requiredComplete =
    Boolean(source.requiredComplete) ||
    (bonusEligible && countSeenConcepts(concepts, seenConceptIds) >= concepts.length);
  const bonusRoundsEarned = Math.max(
    Number(source.bonusRoundsEarned || 0),
    bonusRoundsForWrongCount(firstPassWrongConceptIds.length),
  );

  return {
    version: SESSION_STATE_VERSION,
    conceptState,
    initialAllCorrect,
    bonusEligible,
    seenConceptIds,
    firstPassWrongConceptIds,
    bonusSeenConceptIds,
    bonusRoundsEarned,
    bonusRoundsUsed: Math.max(0, Number(source.bonusRoundsUsed || 0)),
    requiredComplete,
    complete: Boolean(source.complete),
  };
};

const refreshSessionCompletion = (sessionState, concepts, { attemptsUsed, maxToday } = {}) => {
  const seenCount = countSeenConcepts(concepts, sessionState.seenConceptIds);
  sessionState.requiredComplete =
    sessionState.bonusEligible && seenCount >= concepts.length;
  sessionState.bonusRoundsEarned = bonusRoundsForWrongCount(
    sessionState.firstPassWrongConceptIds.length,
  );

  if (sessionState.bonusEligible) {
    sessionState.complete =
      sessionState.requiredComplete &&
      sessionState.bonusRoundsUsed >= sessionState.bonusRoundsEarned;
  } else {
    sessionState.complete =
      typeof attemptsUsed === "number" && attemptsUsed >= maxToday;
  }

  return sessionState;
};

const allowedRoundsForSession = (sessionState, maxToday) =>
  maxToday + Number(sessionState.bonusRoundsEarned || 0);

const getCompatibleAnswerVariants = (concept, questionVariant) => {
  if (!questionVariant.validAnswerIds.length) return concept.answerVariants;
  const compatible = concept.answerVariants.filter((answerVariant) =>
    questionVariant.validAnswerIds.includes(answerVariant.id),
  );
  return compatible.length ? compatible : concept.answerVariants;
};

const createRound = (concepts, sessionState) => {
  const targetCount = Math.min(QUESTION_WINDOW_SIZE, concepts.length);
  let roundMode = "practice";
  let selectedConcepts = [];

  if (sessionState.bonusEligible && !sessionState.requiredComplete) {
    roundMode = "required";
    const seen = new Set(sessionState.seenConceptIds);
    selectedConcepts = shuffle(concepts.filter((concept) => !seen.has(concept.id))).slice(
      0,
      targetCount,
    );
  } else if (
    sessionState.bonusEligible &&
    sessionState.bonusRoundsUsed < sessionState.bonusRoundsEarned
  ) {
    roundMode = "bonus";
    const bonusSeen = new Set(sessionState.bonusSeenConceptIds);
    const wrong = shuffle(
      concepts.filter(
        (concept) => !sessionState.conceptState[concept.id] && !bonusSeen.has(concept.id),
      ),
    ).slice(0, targetCount);
    const selectedIds = new Set(wrong.map((concept) => concept.id));
    const correctFill = shuffle(
      concepts.filter(
        (concept) => sessionState.conceptState[concept.id] && !selectedIds.has(concept.id),
      ),
    ).slice(0, Math.max(0, targetCount - wrong.length));
    selectedConcepts = [...wrong, ...correctFill];

    if (selectedConcepts.length < targetCount) {
      const fallbackIds = new Set(selectedConcepts.map((concept) => concept.id));
      selectedConcepts = [
        ...selectedConcepts,
        ...shuffle(concepts.filter((concept) => !fallbackIds.has(concept.id))).slice(
          0,
          targetCount - selectedConcepts.length,
        ),
      ];
    }
  } else {
    const incorrect = concepts.filter((concept) => !sessionState.conceptState[concept.id]);
    const correct = concepts.filter((concept) => sessionState.conceptState[concept.id]);
    const basePool = incorrect.length ? incorrect : concepts;
    const remainingSlots = Math.max(0, targetCount - basePool.length);
    const sampledCorrect = shuffle(correct).slice(0, remainingSlots);
    selectedConcepts = shuffle([...basePool, ...sampledCorrect]).slice(
      0,
      targetCount,
    );
  }

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
    roundMode,
  }));

  return {
    sessionState,
    roundMode,
    isBonusRound: roundMode === "bonus",
    bonusRoundNumber:
      roundMode === "bonus" ? sessionState.bonusRoundsUsed + 1 : null,
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
  const attemptSessionId = body.attemptSessionId
    ? String(body.attemptSessionId)
    : "";
  const persistedConceptState = attemptSessionId
    ? {}
    : await getPersistedConceptState(session.user.id, quizId);
  const initialQuestionState = createInitialSessionState(
    concepts,
    persistedConceptState,
  );

  const attemptSession = await ensureAttemptSession({
    userId: session.user.id,
    quizId,
    attemptSessionId,
    initialQuestionState,
  });

  const sessionState = refreshSessionCompletion(
    normalizeQuizSessionState(
      attemptSession.question_state || {},
      concepts,
      initialQuestionState.conceptState,
    ),
    concepts,
    { attemptsUsed: attemptsToday, maxToday },
  );

  if (sessionState.complete) {
    return json(409, { error: "This quiz is complete for today." }, headers);
  }

  const allowedRounds = allowedRoundsForSession(sessionState, maxToday);
  if (attemptsToday >= allowedRounds) {
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

  const round = createRound(concepts, sessionState);
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
      JSON.stringify(round.sessionState),
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
      attemptsToday,
      maxAttemptsPerDay: maxToday,
      attemptsRemainingToday: Math.max(0, maxToday - attemptsToday),
      bonusRoundsEarned: sessionState.bonusRoundsEarned,
      bonusRoundsRemaining: Math.max(
        0,
        sessionState.bonusRoundsEarned - sessionState.bonusRoundsUsed,
      ),
      isBonusRound: round.isBonusRound,
      bonusRoundNumber: round.bonusRoundNumber,
      roundMode: round.roundMode,
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
  const sessionState = refreshSessionCompletion(
    normalizeQuizSessionState(attemptSession.question_state || {}, concepts),
    concepts,
    { attemptsUsed: attemptsToday, maxToday },
  );
  const allowedRounds = allowedRoundsForSession(sessionState, maxToday);

  if (attemptsToday >= allowedRounds) {
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

  const roundMode = roundPayload[0]?.roundMode || "practice";
  const answerRows = [];

  for (const roundItem of roundPayload) {
    const submittedAnswerPublicId = pairByQuestionId.get(
      roundItem.questionPublicId,
    );
    const answerItem = answerByPublicId.get(submittedAnswerPublicId);
    const isCorrect = !!answerItem && answerItem.conceptId === roundItem.conceptId;

    sessionState.conceptState[roundItem.conceptId] = isCorrect;
    sessionState.seenConceptIds = uniqueIds([
      ...sessionState.seenConceptIds,
      roundItem.conceptId,
    ]);
    if (roundMode === "required" && !isCorrect) {
      sessionState.firstPassWrongConceptIds = uniqueIds([
        ...sessionState.firstPassWrongConceptIds,
        roundItem.conceptId,
      ]);
    }
    if (roundMode === "bonus") {
      sessionState.bonusSeenConceptIds = uniqueIds([
        ...sessionState.bonusSeenConceptIds,
        roundItem.conceptId,
      ]);
    }
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

  if (roundMode === "bonus") {
    sessionState.bonusRoundsUsed += 1;
  }

  if (!sessionState.bonusEligible && allConceptsCorrect(concepts, sessionState.conceptState)) {
    sessionState.bonusEligible = true;
  }

  refreshSessionCompletion(sessionState, concepts, {
    attemptsUsed: attemptsToday + 1,
    maxToday,
  });

  const totalCount = concepts.length;
  const correctCount = concepts.filter((concept) => sessionState.conceptState[concept.id])
    .length;
  const score = Math.round((correctCount / Math.max(1, totalCount)) * 100);
  const checkEligible = sessionState.complete;

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
          attempt_date,
          check_eligible
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8)
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
        checkEligible,
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
      [attemptSession.id, JSON.stringify(sessionState), ROUND_TTL_SECONDS],
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
        AND check_eligible = true
      ORDER BY created_at ASC
    `,
    [session.user.id, attemptSession.quiz_id],
  );
  const status = computeStreakStatus(allAttempts.rows, today).status;
  const attemptsAfterSubmit = attemptsToday + 1;
  const allowedRoundsAfterSubmit = allowedRoundsForSession(sessionState, maxToday);

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
      bonusRoundsEarned: sessionState.bonusRoundsEarned,
      bonusRoundsRemaining: Math.max(
        0,
        sessionState.bonusRoundsEarned - sessionState.bonusRoundsUsed,
      ),
      isBonusRound: roundMode === "bonus",
      bonusRoundNumber:
        roundMode === "bonus" ? Math.max(1, sessionState.bonusRoundsUsed) : null,
      roundMode,
      canKeepGoing:
        !sessionState.complete && attemptsAfterSubmit < allowedRoundsAfterSubmit,
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
    if (action === "settings") return handleSettings(event, headers);
    if (action === "dashboard") return handleDashboard(event, headers);
    if (action === "teacher-dashboard") {
      return handleTeacherDashboard(event, headers);
    }
    if (action === "teacher-reset-quiz") {
      return handleTeacherResetQuiz(event, headers);
    }
    if (action === "teacher-quiz-detail") {
      return handleTeacherQuizDetail(event, headers);
    }
    if (action === "teacher-save-quiz") {
      return handleTeacherSaveQuiz(event, headers);
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
