BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS paw_staff_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub_hash text UNIQUE,
  email_hash text,
  email_domain text,
  display_name text NOT NULL,
  role text NOT NULL
    CHECK (role IN ('teacher', 'substitute', 'admin', 'security', 'office', 'nurse', 'library', 'counselor')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);

COMMENT ON TABLE paw_staff_users IS
  'Authorized staff accounts only. Students must not sign in to Paw Pass.';
COMMENT ON COLUMN paw_staff_users.google_sub_hash IS
  'HMAC-SHA256 of Google subject. Do not store the raw Google subject.';
COMMENT ON COLUMN paw_staff_users.email_hash IS
  'Optional HMAC-SHA256 of staff email. Store the raw email only if district policy approves it.';

CREATE INDEX IF NOT EXISTS paw_staff_users_role_idx
  ON paw_staff_users(role, active);

CREATE TABLE IF NOT EXISTS paw_staff_sessions (
  token_hash text PRIMARY KEY,
  staff_user_id uuid NOT NULL REFERENCES paw_staff_users(id) ON DELETE CASCADE,
  csrf_token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  user_agent_hash text,
  ip_hash text
);

CREATE INDEX IF NOT EXISTS paw_staff_sessions_user_idx
  ON paw_staff_sessions(staff_user_id);
CREATE INDEX IF NOT EXISTS paw_staff_sessions_expires_idx
  ON paw_staff_sessions(expires_at);

CREATE TABLE IF NOT EXISTS paw_staff_teacher_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id uuid NOT NULL REFERENCES paw_staff_users(id) ON DELETE CASCADE,
  teacher_user_id uuid NOT NULL REFERENCES paw_staff_users(id) ON DELETE CASCADE,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_by_user_id uuid REFERENCES paw_staff_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (staff_user_id <> teacher_user_id)
);

CREATE INDEX IF NOT EXISTS paw_staff_teacher_assignments_lookup_idx
  ON paw_staff_teacher_assignments(staff_user_id, active, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS paw_schedule_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_by_user_id uuid REFERENCES paw_staff_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS paw_schedule_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_template_id uuid NOT NULL REFERENCES paw_schedule_templates(id) ON DELETE CASCADE,
  period_key text NOT NULL,
  label text NOT NULL,
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  position integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  UNIQUE (schedule_template_id, period_key)
);

CREATE INDEX IF NOT EXISTS paw_schedule_periods_lookup_idx
  ON paw_schedule_periods(schedule_template_id, active, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS paw_day_schedule_overrides (
  day date PRIMARY KEY,
  schedule_template_id uuid NOT NULL REFERENCES paw_schedule_templates(id) ON DELETE RESTRICT,
  label text,
  created_by_user_id uuid REFERENCES paw_staff_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS paw_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  normal_capacity integer NOT NULL DEFAULT 1 CHECK (normal_capacity >= 1),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS paw_group_members (
  group_id uuid NOT NULL REFERENCES paw_groups(id) ON DELETE CASCADE,
  teacher_user_id uuid NOT NULL REFERENCES paw_staff_users(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, teacher_user_id)
);

CREATE INDEX IF NOT EXISTS paw_group_members_teacher_idx
  ON paw_group_members(teacher_user_id, active);

CREATE TABLE IF NOT EXISTS paw_room_states (
  teacher_user_id uuid PRIMARY KEY REFERENCES paw_staff_users(id) ON DELETE CASCADE,
  frozen boolean NOT NULL DEFAULT false,
  frozen_at timestamptz,
  frozen_by_user_id uuid REFERENCES paw_staff_users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS paw_destination_states (
  destination text PRIMARY KEY
    CHECK (destination IN ('office', 'nurse', 'library', 'counselor')),
  blocked boolean NOT NULL DEFAULT false,
  blocked_at timestamptz,
  blocked_by_user_id uuid REFERENCES paw_staff_users(id) ON DELETE SET NULL,
  auto_block_after_count integer NOT NULL DEFAULT 0 CHECK (auto_block_after_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO paw_destination_states (destination)
VALUES ('office'), ('nurse'), ('library'), ('counselor')
ON CONFLICT (destination) DO NOTHING;

CREATE TABLE IF NOT EXISTS paw_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE
    CHECK (username ~ '^[a-z]_[a-z]{3}_[a-z0-9]{3}$'),
  district_student_hash text NOT NULL UNIQUE,
  student_id_suffix text NOT NULL CHECK (student_id_suffix ~ '^[a-z0-9]{3}$'),
  medical_priority boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE paw_students IS
  'Student table is intentionally pseudonymous. Do not store full legal name, birthdate, or raw internal student id here.';
COMMENT ON COLUMN paw_students.district_student_hash IS
  'Server-side HMAC of the internal student id or approved district identifier.';

CREATE INDEX IF NOT EXISTS paw_students_username_idx
  ON paw_students(username);

CREATE TABLE IF NOT EXISTS paw_rosters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_user_id uuid NOT NULL REFERENCES paw_staff_users(id) ON DELETE CASCADE,
  period_key text NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_user_id, period_key, active)
);

CREATE INDEX IF NOT EXISTS paw_rosters_teacher_period_idx
  ON paw_rosters(teacher_user_id, period_key, active);

CREATE TABLE IF NOT EXISTS paw_roster_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roster_id uuid NOT NULL REFERENCES paw_rosters(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES paw_students(id) ON DELETE RESTRICT,
  active boolean NOT NULL DEFAULT true,
  deleted_at timestamptz,
  deleted_by_user_id uuid REFERENCES paw_staff_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (roster_id, student_id)
);

CREATE INDEX IF NOT EXISTS paw_roster_students_roster_active_idx
  ON paw_roster_students(roster_id, active);
CREATE INDEX IF NOT EXISTS paw_roster_students_student_idx
  ON paw_roster_students(student_id);

CREATE TABLE IF NOT EXISTS paw_pass_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roster_id uuid NOT NULL REFERENCES paw_rosters(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES paw_students(id) ON DELETE RESTRICT,
  teacher_user_id uuid NOT NULL REFERENCES paw_staff_users(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL REFERENCES paw_staff_users(id) ON DELETE RESTRICT,
  group_id uuid NOT NULL REFERENCES paw_groups(id) ON DELETE RESTRICT,
  schedule_template_id uuid REFERENCES paw_schedule_templates(id) ON DELETE SET NULL,
  period_key text NOT NULL,
  destination text NOT NULL
    CHECK (destination IN ('bathroom', 'water_fountain', 'nurse', 'counselor', 'office', 'teacher_room', 'library', 'eloper')),
  status text NOT NULL
    CHECK (status IN ('delayed', 'waiting', 'offered', 'out', 'received', 'return_waiting', 'return_offered', 'returning', 'returned', 'dismissed')),
  queue_reason text NOT NULL DEFAULT '',
  is_medical_override boolean NOT NULL DEFAULT false,
  requested_at timestamptz NOT NULL DEFAULT now(),
  delay_until timestamptz,
  snooze_until timestamptz,
  skipped_this_cycle boolean NOT NULL DEFAULT false,
  offered_at timestamptz,
  offer_expires_at timestamptz,
  pass_over_count integer NOT NULL DEFAULT 0,
  permitted_at timestamptz,
  due_at timestamptz,
  received_at timestamptz,
  received_by_user_id uuid REFERENCES paw_staff_users(id) ON DELETE SET NULL,
  return_requested_at timestamptz,
  return_dismissed_by_user_id uuid REFERENCES paw_staff_users(id) ON DELETE SET NULL,
  return_offered_at timestamptz,
  return_offer_expires_at timestamptz,
  return_called_at timestamptz,
  return_called_by_user_id uuid REFERENCES paw_staff_users(id) ON DELETE SET NULL,
  returned_at timestamptz,
  dismissed_at timestamptz,
  dismissed_by_user_id uuid REFERENCES paw_staff_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS paw_pass_requests_group_active_idx
  ON paw_pass_requests(group_id, status, is_medical_override, requested_at)
  WHERE status IN ('delayed', 'waiting', 'offered', 'out', 'received', 'return_waiting', 'return_offered', 'returning');
CREATE INDEX IF NOT EXISTS paw_pass_requests_teacher_active_idx
  ON paw_pass_requests(teacher_user_id, status, requested_at)
  WHERE status IN ('delayed', 'waiting', 'offered', 'out', 'received', 'return_waiting', 'return_offered', 'returning');
CREATE INDEX IF NOT EXISTS paw_pass_requests_destination_inbound_idx
  ON paw_pass_requests(destination, status, permitted_at)
  WHERE status IN ('out', 'received', 'return_waiting', 'return_offered', 'returning');
CREATE INDEX IF NOT EXISTS paw_pass_requests_return_priority_idx
  ON paw_pass_requests(status, return_requested_at)
  WHERE status IN ('return_waiting', 'return_offered', 'returning');
CREATE INDEX IF NOT EXISTS paw_pass_requests_student_history_idx
  ON paw_pass_requests(student_id, requested_at DESC);

CREATE TABLE IF NOT EXISTS paw_elopers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES paw_pass_requests(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES paw_students(id) ON DELETE RESTRICT,
  teacher_user_id uuid NOT NULL REFERENCES paw_staff_users(id) ON DELETE RESTRICT,
  group_id uuid NOT NULL REFERENCES paw_groups(id) ON DELETE RESTRICT,
  destination text NOT NULL
    CHECK (destination IN ('bathroom', 'water_fountain', 'nurse', 'counselor', 'office', 'teacher_room', 'library', 'eloper')),
  requested_at timestamptz NOT NULL,
  permitted_at timestamptz NOT NULL,
  due_at timestamptz NOT NULL,
  flagged_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  accounted_for_at timestamptz,
  accounted_for_by_user_id uuid REFERENCES paw_staff_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS paw_elopers_active_idx
  ON paw_elopers(active, flagged_at DESC);
CREATE INDEX IF NOT EXISTS paw_elopers_teacher_active_idx
  ON paw_elopers(teacher_user_id, active, flagged_at DESC);

CREATE TABLE IF NOT EXISTS paw_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  actor_user_id uuid REFERENCES paw_staff_users(id) ON DELETE SET NULL,
  effective_teacher_user_id uuid REFERENCES paw_staff_users(id) ON DELETE SET NULL,
  target_student_id uuid REFERENCES paw_students(id) ON DELETE SET NULL,
  request_id uuid REFERENCES paw_pass_requests(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS paw_audit_events_actor_idx
  ON paw_audit_events(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS paw_audit_events_teacher_idx
  ON paw_audit_events(effective_teacher_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS paw_audit_events_request_idx
  ON paw_audit_events(request_id);

CREATE TABLE IF NOT EXISTS paw_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by_user_id uuid REFERENCES paw_staff_users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO paw_settings (key, value)
VALUES
  ('permit_window_ms', '90000'::jsonb),
  ('eloper_after_ms', '300000'::jsonb),
  ('retry_skipped_after_ms', '45000'::jsonb),
  ('long_return_ms', '360000'::jsonb),
  ('habit_delay_ms', '120000'::jsonb),
  ('auto_freeze_start_period_ms', '0'::jsonb),
  ('auto_freeze_end_period_ms', '0'::jsonb),
  ('quiet_mode_default', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

COMMIT;
