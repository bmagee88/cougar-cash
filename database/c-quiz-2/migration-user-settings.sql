BEGIN;

CREATE TABLE IF NOT EXISTS cquiz2_user_settings (
  user_id uuid PRIMARY KEY REFERENCES cquiz2_users(id) ON DELETE CASCADE,
  dark_theme boolean NOT NULL DEFAULT false,
  teacher_grade_levels integer[] NOT NULL DEFAULT '{}'::integer[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
