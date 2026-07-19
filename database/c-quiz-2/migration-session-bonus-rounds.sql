BEGIN;

ALTER TABLE cquiz2_attempts
  ADD COLUMN IF NOT EXISTS check_eligible boolean NOT NULL DEFAULT true;

COMMIT;
