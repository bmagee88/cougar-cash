BEGIN;

WITH teacher AS (
  INSERT INTO cquiz2_teachers (display_name)
  VALUES ('Magbr')
  ON CONFLICT (display_name)
  DO UPDATE SET display_name = EXCLUDED.display_name
  RETURNING id
),
unit_row AS (
  INSERT INTO cquiz2_units (teacher_id, name)
  SELECT id, 'ACert'
  FROM teacher
  ON CONFLICT (teacher_id, name)
  DO UPDATE SET name = EXCLUDED.name
  RETURNING id, teacher_id
),
section_row AS (
  INSERT INTO cquiz2_sections (unit_id, name)
  SELECT id, 'Cloud Computing'
  FROM unit_row
  ON CONFLICT (unit_id, name)
  DO UPDATE SET name = EXCLUDED.name
  RETURNING id, unit_id
),
quiz_row AS (
  INSERT INTO cquiz2_quizzes (
    teacher_id,
    unit_id,
    section_id,
    quiz_name,
    quiz_number,
    grade_level
  )
  SELECT
    teacher.id,
    unit_row.id,
    section_row.id,
    'Cloud Computing 1',
    1,
    6
  FROM teacher, unit_row, section_row
  ON CONFLICT (teacher_id, unit_id, section_id, quiz_number, quiz_name)
  DO UPDATE SET grade_level = EXCLUDED.grade_level, active = true, updated_at = now()
  RETURNING id
)
INSERT INTO cquiz2_questions (quiz_id, position, prompt, answer)
SELECT quiz_row.id, seed.position, seed.prompt, seed.answer
FROM quiz_row
CROSS JOIN (
  VALUES
    (1, 'What is virtualization in simple terms?', 'Running one or more virtual computers on a physical computer.'),
    (2, 'What is a hypervisor''s main job?', 'It creates and manages virtual machines and shares hardware resources.'),
    (3, 'What is the difference between a host and a guest?', 'The host is the physical machine; the guest is the virtual machine running on it.'),
    (4, 'What is a snapshot used for in a virtual machine?', 'To save a point-in-time state so you can roll back after changes.'),
    (5, 'What is elasticity in cloud computing?', 'The ability to quickly scale resources up or down based on demand.'),
    (6, 'What does IaaS mainly provide?', 'Virtualized hardware resources like servers, storage, and networking.'),
    (7, 'What does PaaS mainly provide?', 'A platform to build and run apps without managing the underlying servers.'),
    (8, 'What does SaaS mainly provide?', 'Fully managed software accessed over the internet.'),
    (9, 'What is the function of a cloud region?', 'A geographic area containing multiple data centers for cloud services.'),
    (10, 'What is the function of a cloud availability zone?', 'A separate data center location within a region for redundancy.')
) AS seed(position, prompt, answer)
ON CONFLICT (quiz_id, position)
DO UPDATE SET
  prompt = EXCLUDED.prompt,
  answer = EXCLUDED.answer,
  active = true,
  updated_at = now();

COMMIT;
