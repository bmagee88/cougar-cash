BEGIN;

CREATE INDEX IF NOT EXISTS cquiz2_teachers_user_idx
  ON cquiz2_teachers(user_id);

CREATE INDEX IF NOT EXISTS cquiz2_attempts_quiz_user_date_idx
  ON cquiz2_attempts(quiz_id, user_id, attempt_date, created_at);

COMMIT;
