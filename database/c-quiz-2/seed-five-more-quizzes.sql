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
  SELECT id, 'Digital Literacy'
  FROM teacher
  ON CONFLICT (teacher_id, name)
  DO UPDATE SET name = EXCLUDED.name
  RETURNING id, teacher_id
),
section_row AS (
  INSERT INTO cquiz2_sections (unit_id, name)
  SELECT id, 'Computer Basics'
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
    quiz_number
  )
  SELECT
    teacher.id,
    unit_row.id,
    section_row.id,
    'Hardware Basics',
    2
  FROM teacher, unit_row, section_row
  ON CONFLICT (teacher_id, unit_id, section_id, quiz_number, quiz_name)
  DO UPDATE SET active = true, updated_at = now()
  RETURNING id
)
INSERT INTO cquiz2_questions (quiz_id, position, prompt, answer)
SELECT quiz_row.id, seed.position, seed.prompt, seed.answer
FROM quiz_row
CROSS JOIN (
  VALUES
    (1, 'What does the CPU do?', 'It executes instructions and performs calculations for the computer.'),
    (2, 'What does RAM store?', 'It temporarily stores data and programs the computer is currently using.'),
    (3, 'What is the main job of a motherboard?', 'It connects computer parts so they can communicate with each other.'),
    (4, 'What does a storage drive do?', 'It saves files, programs, and the operating system for long-term use.'),
    (5, 'What is the difference between an SSD and an HDD?', 'An SSD has no moving parts and is usually faster than an HDD.'),
    (6, 'What does a power supply do?', 'It converts wall power into power the computer parts can use.'),
    (7, 'What does a GPU help with?', 'It processes graphics and can speed up visual or compute-heavy tasks.'),
    (8, 'Why do computers need cooling?', 'Cooling removes heat so parts do not overheat or slow down.'),
    (9, 'What is a peripheral?', 'A device connected to a computer, such as a keyboard, mouse, monitor, or printer.'),
    (10, 'What is an input device?', 'A device used to send information into a computer.')
) AS seed(position, prompt, answer)
ON CONFLICT (quiz_id, position)
DO UPDATE SET
  prompt = EXCLUDED.prompt,
  answer = EXCLUDED.answer,
  active = true,
  updated_at = now();

WITH teacher AS (
  INSERT INTO cquiz2_teachers (display_name)
  VALUES ('Magbr')
  ON CONFLICT (display_name)
  DO UPDATE SET display_name = EXCLUDED.display_name
  RETURNING id
),
unit_row AS (
  INSERT INTO cquiz2_units (teacher_id, name)
  SELECT id, 'Digital Literacy'
  FROM teacher
  ON CONFLICT (teacher_id, name)
  DO UPDATE SET name = EXCLUDED.name
  RETURNING id, teacher_id
),
section_row AS (
  INSERT INTO cquiz2_sections (unit_id, name)
  SELECT id, 'Connectivity'
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
    quiz_number
  )
  SELECT
    teacher.id,
    unit_row.id,
    section_row.id,
    'Cables and Ports',
    3
  FROM teacher, unit_row, section_row
  ON CONFLICT (teacher_id, unit_id, section_id, quiz_number, quiz_name)
  DO UPDATE SET active = true, updated_at = now()
  RETURNING id
)
INSERT INTO cquiz2_questions (quiz_id, position, prompt, answer)
SELECT quiz_row.id, seed.position, seed.prompt, seed.answer
FROM quiz_row
CROSS JOIN (
  VALUES
    (1, 'What is an HDMI cable commonly used for?', 'It carries digital video and audio to a monitor, TV, or projector.'),
    (2, 'What is an Ethernet cable used for?', 'It connects a device to a wired network.'),
    (3, 'What does USB stand for?', 'Universal Serial Bus.'),
    (4, 'What is USB-C known for?', 'It is a reversible connector used for charging, data, and sometimes video.'),
    (5, 'What is a power cable used for?', 'It supplies electrical power to a device.'),
    (6, 'What is the purpose of a charging cable?', 'It delivers power to recharge a battery-powered device.'),
    (7, 'What is DisplayPort used for?', 'It carries video, and often audio, from a computer to a display.'),
    (8, 'Why should you avoid forcing a cable into a port?', 'Forcing it can bend pins, damage the port, or break the connector.'),
    (9, 'What is a network port on a computer often called?', 'An Ethernet or RJ-45 port.'),
    (10, 'What should you check first if a monitor shows no signal?', 'Check that the video cable is connected to the correct port on both devices.')
) AS seed(position, prompt, answer)
ON CONFLICT (quiz_id, position)
DO UPDATE SET
  prompt = EXCLUDED.prompt,
  answer = EXCLUDED.answer,
  active = true,
  updated_at = now();

WITH teacher AS (
  INSERT INTO cquiz2_teachers (display_name)
  VALUES ('Magbr')
  ON CONFLICT (display_name)
  DO UPDATE SET display_name = EXCLUDED.display_name
  RETURNING id
),
unit_row AS (
  INSERT INTO cquiz2_units (teacher_id, name)
  SELECT id, 'Digital Citizenship'
  FROM teacher
  ON CONFLICT (teacher_id, name)
  DO UPDATE SET name = EXCLUDED.name
  RETURNING id, teacher_id
),
section_row AS (
  INSERT INTO cquiz2_sections (unit_id, name)
  SELECT id, 'Managed Devices'
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
    quiz_number
  )
  SELECT
    teacher.id,
    unit_row.id,
    section_row.id,
    'Corporate Control',
    4
  FROM teacher, unit_row, section_row
  ON CONFLICT (teacher_id, unit_id, section_id, quiz_number, quiz_name)
  DO UPDATE SET active = true, updated_at = now()
  RETURNING id
)
INSERT INTO cquiz2_questions (quiz_id, position, prompt, answer)
SELECT quiz_row.id, seed.position, seed.prompt, seed.answer
FROM quiz_row
CROSS JOIN (
  VALUES
    (1, 'What does it mean when a device is managed by an organization?', 'The organization can set rules, install settings, and protect the device.'),
    (2, 'Why do schools or companies use managed accounts?', 'They help protect data, enforce rules, and provide access to approved tools.'),
    (3, 'What is an acceptable use policy?', 'A set of rules for how technology and accounts may be used.'),
    (4, 'Why might an organization block some websites?', 'To protect users, reduce distractions, and lower security risks.'),
    (5, 'What is device monitoring used for?', 'It helps detect misuse, security issues, or devices that need support.'),
    (6, 'Why should you not try to bypass management settings?', 'Bypassing settings can violate policy and create security risks.'),
    (7, 'What is the principle of least privilege?', 'Users should only have the access they need to do their work.'),
    (8, 'Why are software updates often controlled by an organization?', 'Updates can be tested and scheduled to keep devices secure and reliable.'),
    (9, 'What should you do if a managed device blocks something needed for class?', 'Ask the teacher or technology support for help.'),
    (10, 'What kind of data should not be stored on a school or company device?', 'Personal, private, or unauthorized data that does not belong on the device.')
) AS seed(position, prompt, answer)
ON CONFLICT (quiz_id, position)
DO UPDATE SET
  prompt = EXCLUDED.prompt,
  answer = EXCLUDED.answer,
  active = true,
  updated_at = now();

WITH teacher AS (
  INSERT INTO cquiz2_teachers (display_name)
  VALUES ('Magbr')
  ON CONFLICT (display_name)
  DO UPDATE SET display_name = EXCLUDED.display_name
  RETURNING id
),
unit_row AS (
  INSERT INTO cquiz2_units (teacher_id, name)
  SELECT id, 'Digital Citizenship'
  FROM teacher
  ON CONFLICT (teacher_id, name)
  DO UPDATE SET name = EXCLUDED.name
  RETURNING id, teacher_id
),
section_row AS (
  INSERT INTO cquiz2_sections (unit_id, name)
  SELECT id, 'Device Care'
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
    quiz_number
  )
  SELECT
    teacher.id,
    unit_row.id,
    section_row.id,
    'Chromebook Care',
    5
  FROM teacher, unit_row, section_row
  ON CONFLICT (teacher_id, unit_id, section_id, quiz_number, quiz_name)
  DO UPDATE SET active = true, updated_at = now()
  RETURNING id
)
INSERT INTO cquiz2_questions (quiz_id, position, prompt, answer)
SELECT quiz_row.id, seed.position, seed.prompt, seed.answer
FROM quiz_row
CROSS JOIN (
  VALUES
    (1, 'How should you carry a Chromebook?', 'Carry it closed with two hands or in a protective case.'),
    (2, 'Why should food and drinks stay away from a Chromebook?', 'Spills and crumbs can damage the keyboard and internal parts.'),
    (3, 'What should you do before closing a Chromebook?', 'Make sure nothing is on the keyboard or screen.'),
    (4, 'Why should you not pick up a Chromebook by the screen?', 'It can damage the hinges, display, or frame.'),
    (5, 'How should you clean a Chromebook screen?', 'Use a soft, dry microfiber cloth or approved screen cleaner.'),
    (6, 'What should you do if a Chromebook is not charging?', 'Check the charger, outlet, and charging port, then report the problem.'),
    (7, 'Why is it important to restart a Chromebook sometimes?', 'Restarting can apply updates and fix temporary software problems.'),
    (8, 'What should you do if a key comes loose?', 'Do not pull on it; report it to the teacher or tech support.'),
    (9, 'Why should Chromebooks be stored in the correct cart slot?', 'It helps keep them charged, organized, and easy to find.'),
    (10, 'What should you do if a Chromebook is damaged?', 'Report it right away instead of hiding or continuing to use it.')
) AS seed(position, prompt, answer)
ON CONFLICT (quiz_id, position)
DO UPDATE SET
  prompt = EXCLUDED.prompt,
  answer = EXCLUDED.answer,
  active = true,
  updated_at = now();

WITH teacher AS (
  INSERT INTO cquiz2_teachers (display_name)
  VALUES ('Magbr')
  ON CONFLICT (display_name)
  DO UPDATE SET display_name = EXCLUDED.display_name
  RETURNING id
),
unit_row AS (
  INSERT INTO cquiz2_units (teacher_id, name)
  SELECT id, 'Careers'
  FROM teacher
  ON CONFLICT (teacher_id, name)
  DO UPDATE SET name = EXCLUDED.name
  RETURNING id, teacher_id
),
section_row AS (
  INSERT INTO cquiz2_sections (unit_id, name)
  SELECT id, 'Technology Careers'
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
    quiz_number
  )
  SELECT
    teacher.id,
    unit_row.id,
    section_row.id,
    'Careers in Tech',
    6
  FROM teacher, unit_row, section_row
  ON CONFLICT (teacher_id, unit_id, section_id, quiz_number, quiz_name)
  DO UPDATE SET active = true, updated_at = now()
  RETURNING id
)
INSERT INTO cquiz2_questions (quiz_id, position, prompt, answer)
SELECT quiz_row.id, seed.position, seed.prompt, seed.answer
FROM quiz_row
CROSS JOIN (
  VALUES
    (1, 'What does a help desk technician do?', 'They help users solve computer, account, software, and device problems.'),
    (2, 'What does a software developer create?', 'They design, write, test, and maintain computer programs and apps.'),
    (3, 'What does a cybersecurity analyst help protect?', 'They help protect systems, networks, accounts, and data from threats.'),
    (4, 'What does a network administrator manage?', 'They manage network devices, connections, users, and network reliability.'),
    (5, 'What does a data analyst look for?', 'They study data to find patterns, answer questions, and support decisions.'),
    (6, 'What does a UX designer focus on?', 'They focus on making technology easier and better for people to use.'),
    (7, 'What is an IT project manager responsible for?', 'They organize people, tasks, timelines, and resources for technology projects.'),
    (8, 'Why are communication skills important in technology careers?', 'Tech workers often explain problems, teach users, and work on teams.'),
    (9, 'What is one way to prepare for a tech career while in school?', 'Practice problem-solving, learn basic coding or hardware skills, and build projects.'),
    (10, 'Why do technology workers keep learning?', 'Technology changes often, so workers need to keep their skills current.')
) AS seed(position, prompt, answer)
ON CONFLICT (quiz_id, position)
DO UPDATE SET
  prompt = EXCLUDED.prompt,
  answer = EXCLUDED.answer,
  active = true,
  updated_at = now();

COMMIT;
