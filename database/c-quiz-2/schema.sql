BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS cquiz2_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub_hash text NOT NULL UNIQUE,
  anon_id text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'student'
    CHECK (role IN ('student', 'teacher', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);

COMMENT ON COLUMN cquiz2_users.google_sub_hash IS
  'HMAC-SHA256 of the Google subject using a server-side pepper. Never store the raw Google subject.';
COMMENT ON COLUMN cquiz2_users.anon_id IS
  'Anonymous classroom display id returned to the browser, for example bmag-419.';

CREATE TABLE IF NOT EXISTS cquiz2_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES cquiz2_users(id) ON DELETE CASCADE,
  csrf_token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  user_agent_hash text,
  ip_hash text
);

CREATE INDEX IF NOT EXISTS cquiz2_sessions_user_idx
  ON cquiz2_sessions(user_id);
CREATE INDEX IF NOT EXISTS cquiz2_sessions_expires_idx
  ON cquiz2_sessions(expires_at);

CREATE TABLE IF NOT EXISTS cquiz2_teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL UNIQUE,
  user_id uuid REFERENCES cquiz2_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cquiz2_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES cquiz2_teachers(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, name)
);

CREATE TABLE IF NOT EXISTS cquiz2_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES cquiz2_units(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unit_id, name)
);

CREATE TABLE IF NOT EXISTS cquiz2_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES cquiz2_teachers(id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL REFERENCES cquiz2_units(id) ON DELETE RESTRICT,
  section_id uuid NOT NULL REFERENCES cquiz2_sections(id) ON DELETE RESTRICT,
  quiz_name text NOT NULL,
  quiz_number integer NOT NULL,
  grade_level integer CHECK (grade_level BETWEEN 0 AND 12),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, unit_id, section_id, quiz_number, quiz_name)
);

CREATE INDEX IF NOT EXISTS cquiz2_quizzes_lookup_idx
  ON cquiz2_quizzes(teacher_id, unit_id, section_id, quiz_number);

CREATE TABLE IF NOT EXISTS cquiz2_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES cquiz2_quizzes(id) ON DELETE CASCADE,
  position integer NOT NULL,
  prompt text NOT NULL,
  answer text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, position)
);

CREATE INDEX IF NOT EXISTS cquiz2_questions_quiz_idx
  ON cquiz2_questions(quiz_id, active, position);

CREATE TABLE IF NOT EXISTS cquiz2_attempt_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES cquiz2_users(id) ON DELETE CASCADE,
  quiz_id uuid NOT NULL REFERENCES cquiz2_quizzes(id) ON DELETE CASCADE,
  question_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_round_payload jsonb NOT NULL DEFAULT '[]'::jsonb,
  current_round integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN cquiz2_attempt_sessions.current_round_payload IS
  'Server-only opaque mapping between public round ids and real question/answer ids. The browser never receives the answer key.';

CREATE INDEX IF NOT EXISTS cquiz2_attempt_sessions_user_quiz_idx
  ON cquiz2_attempt_sessions(user_id, quiz_id, expires_at);

CREATE TABLE IF NOT EXISTS cquiz2_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES cquiz2_users(id) ON DELETE CASCADE,
  quiz_id uuid NOT NULL REFERENCES cquiz2_quizzes(id) ON DELETE CASCADE,
  attempt_session_id uuid REFERENCES cquiz2_attempt_sessions(id) ON DELETE SET NULL,
  score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  correct_count integer NOT NULL CHECK (correct_count >= 0),
  total_count integer NOT NULL CHECK (total_count > 0),
  attempt_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cquiz2_attempts_user_quiz_date_idx
  ON cquiz2_attempts(user_id, quiz_id, attempt_date, created_at);
CREATE INDEX IF NOT EXISTS cquiz2_attempts_user_date_idx
  ON cquiz2_attempts(user_id, attempt_date);

CREATE TABLE IF NOT EXISTS cquiz2_user_question_state (
  user_id uuid NOT NULL REFERENCES cquiz2_users(id) ON DELETE CASCADE,
  quiz_id uuid NOT NULL REFERENCES cquiz2_quizzes(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES cquiz2_questions(id) ON DELETE CASCADE,
  is_correct boolean NOT NULL DEFAULT false,
  last_attempt_id uuid REFERENCES cquiz2_attempts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, question_id)
);

COMMENT ON TABLE cquiz2_user_question_state IS
  'Persistent per-user master correctness list used to choose future C-Quiz-2 rounds without exposing identity or answer keys to the browser.';

CREATE INDEX IF NOT EXISTS cquiz2_user_question_state_user_quiz_idx
  ON cquiz2_user_question_state(user_id, quiz_id, is_correct);

CREATE TABLE IF NOT EXISTS cquiz2_attempt_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES cquiz2_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES cquiz2_questions(id) ON DELETE CASCADE,
  selected_question_id uuid REFERENCES cquiz2_questions(id) ON DELETE SET NULL,
  is_correct boolean NOT NULL,
  checked_by_student boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cquiz2_attempt_answers_attempt_idx
  ON cquiz2_attempt_answers(attempt_id);

COMMIT;
