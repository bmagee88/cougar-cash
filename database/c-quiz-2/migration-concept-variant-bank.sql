BEGIN;

CREATE TABLE IF NOT EXISTS cquiz2_concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES cquiz2_quizzes(id) ON DELETE CASCADE,
  concept_key text NOT NULL,
  concept_name text NOT NULL,
  position integer NOT NULL,
  confusability_group text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, concept_key),
  UNIQUE (quiz_id, position)
);

COMMENT ON TABLE cquiz2_concepts IS
  'Concepts assessed by a quiz. Each concept can have many question and answer variants, but a quiz round displays one answer variant per selected concept.';

CREATE INDEX IF NOT EXISTS cquiz2_concepts_quiz_idx
  ON cquiz2_concepts(quiz_id, active, position);
CREATE INDEX IF NOT EXISTS cquiz2_concepts_confusability_idx
  ON cquiz2_concepts(quiz_id, confusability_group);

CREATE TABLE IF NOT EXISTS cquiz2_question_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id uuid NOT NULL REFERENCES cquiz2_concepts(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  relationship_type text NOT NULL DEFAULT 'direct',
  difficulty integer,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (concept_id, question_text)
);

CREATE INDEX IF NOT EXISTS cquiz2_question_variants_concept_idx
  ON cquiz2_question_variants(concept_id, active);

CREATE TABLE IF NOT EXISTS cquiz2_answer_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id uuid NOT NULL REFERENCES cquiz2_concepts(id) ON DELETE CASCADE,
  answer_text text NOT NULL,
  difficulty integer,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (concept_id, answer_text)
);

CREATE INDEX IF NOT EXISTS cquiz2_answer_variants_concept_idx
  ON cquiz2_answer_variants(concept_id, active);

CREATE TABLE IF NOT EXISTS cquiz2_valid_matches (
  question_variant_id uuid NOT NULL REFERENCES cquiz2_question_variants(id) ON DELETE CASCADE,
  answer_variant_id uuid NOT NULL REFERENCES cquiz2_answer_variants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (question_variant_id, answer_variant_id)
);

CREATE INDEX IF NOT EXISTS cquiz2_valid_matches_answer_idx
  ON cquiz2_valid_matches(answer_variant_id);

CREATE TABLE IF NOT EXISTS cquiz2_user_concept_state (
  user_id uuid NOT NULL REFERENCES cquiz2_users(id) ON DELETE CASCADE,
  quiz_id uuid NOT NULL REFERENCES cquiz2_quizzes(id) ON DELETE CASCADE,
  concept_id uuid NOT NULL REFERENCES cquiz2_concepts(id) ON DELETE CASCADE,
  is_correct boolean NOT NULL DEFAULT false,
  last_attempt_id uuid REFERENCES cquiz2_attempts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, concept_id)
);

COMMENT ON TABLE cquiz2_user_concept_state IS
  'Persistent per-user master correctness list by concept. Variants change across rounds while mastery stays tied to the concept.';

CREATE INDEX IF NOT EXISTS cquiz2_user_concept_state_user_quiz_idx
  ON cquiz2_user_concept_state(user_id, quiz_id, is_correct);

ALTER TABLE cquiz2_attempt_answers
  ALTER COLUMN question_id DROP NOT NULL;

ALTER TABLE cquiz2_attempt_answers
  ADD COLUMN IF NOT EXISTS concept_id uuid REFERENCES cquiz2_concepts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS question_variant_id uuid REFERENCES cquiz2_question_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS answer_variant_id uuid REFERENCES cquiz2_answer_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS selected_answer_variant_id uuid REFERENCES cquiz2_answer_variants(id) ON DELETE SET NULL;

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
ON CONFLICT (quiz_id, concept_key)
DO UPDATE SET
  concept_name = EXCLUDED.concept_name,
  position = EXCLUDED.position,
  active = EXCLUDED.active,
  updated_at = now();

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
ON CONFLICT (concept_id, question_text)
DO UPDATE SET
  active = EXCLUDED.active,
  updated_at = now();

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
ON CONFLICT (concept_id, answer_text)
DO UPDATE SET
  active = EXCLUDED.active,
  updated_at = now();

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
ON CONFLICT (question_variant_id, answer_variant_id)
DO NOTHING;

INSERT INTO cquiz2_user_concept_state (
  user_id,
  quiz_id,
  concept_id,
  is_correct,
  last_attempt_id,
  created_at,
  updated_at
)
SELECT
  uqs.user_id,
  uqs.quiz_id,
  c.id,
  uqs.is_correct,
  uqs.last_attempt_id,
  uqs.created_at,
  uqs.updated_at
FROM cquiz2_user_question_state uqs
JOIN cquiz2_questions q ON q.id = uqs.question_id
JOIN cquiz2_concepts c
  ON c.quiz_id = q.quiz_id
 AND c.concept_key = 'legacy-' || q.position::text
ON CONFLICT (user_id, concept_id)
DO UPDATE SET
  quiz_id = EXCLUDED.quiz_id,
  is_correct = EXCLUDED.is_correct,
  last_attempt_id = EXCLUDED.last_attempt_id,
  updated_at = now();

UPDATE cquiz2_attempt_answers aa
SET
  concept_id = mapped.concept_id,
  question_variant_id = mapped.question_variant_id,
  answer_variant_id = mapped.answer_variant_id,
  selected_answer_variant_id = mapped.selected_answer_variant_id
FROM (
  SELECT
    aa_inner.id AS attempt_answer_id,
    c.id AS concept_id,
    qv.id AS question_variant_id,
    av.id AS answer_variant_id,
    selected_av.id AS selected_answer_variant_id
  FROM cquiz2_attempt_answers aa_inner
  JOIN cquiz2_questions q
    ON q.id = aa_inner.question_id
  JOIN cquiz2_concepts c
    ON c.quiz_id = q.quiz_id
   AND c.concept_key = 'legacy-' || q.position::text
  JOIN cquiz2_question_variants qv
    ON qv.concept_id = c.id
   AND qv.question_text = q.prompt
  JOIN cquiz2_answer_variants av
    ON av.concept_id = c.id
   AND av.answer_text = q.answer
  LEFT JOIN cquiz2_questions selected_q
    ON selected_q.id = aa_inner.selected_question_id
  LEFT JOIN cquiz2_concepts selected_c
    ON selected_c.quiz_id = selected_q.quiz_id
   AND selected_c.concept_key = 'legacy-' || selected_q.position::text
  LEFT JOIN cquiz2_answer_variants selected_av
    ON selected_av.concept_id = selected_c.id
   AND selected_av.answer_text = selected_q.answer
  WHERE aa_inner.concept_id IS NULL
) mapped
WHERE aa.id = mapped.attempt_answer_id;

COMMIT;
