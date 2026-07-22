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
  SELECT id, 'Digital Citizenship'
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
    'Digital Citizenship Concepts',
    7,
    6
  FROM teacher, unit_row, section_row
  ON CONFLICT (teacher_id, unit_id, section_id, quiz_number, quiz_name)
  DO UPDATE SET grade_level = EXCLUDED.grade_level, active = true, updated_at = now()
  RETURNING id
),
concept_bank (
  position,
  concept_key,
  concept_name,
  confusability_group,
  question_texts,
  answer_texts
) AS (
  VALUES
    (
      1,
      'personal-information',
      'Personal information',
      'online-privacy',
      ARRAY[
        'What counts as personal information online?',
        'What information should you keep private when using websites or apps?',
        'Which details can identify you and should be shared carefully?',
        'What kind of information can reveal who or where you are?',
        'What does personal information mean in digital citizenship?'
      ]::text[],
      ARRAY[
        'Details like full name, address, phone number, birth date, school, or login info.',
        'Information that can identify, locate, or contact you in real life.',
        'Private details about who you are, where you are, or how to reach you.',
        'Data such as passwords, home address, phone number, or personal accounts.',
        'Identifying details that should only be shared with trusted permission.'
      ]::text[]
    ),
    (
      2,
      'strong-passwords',
      'Strong passwords',
      'account-security',
      ARRAY[
        'What makes a password strong?',
        'How can you create a safer password for an account?',
        'Why should passwords be long and hard to guess?',
        'What kind of password is harder for others to break?',
        'What is the main goal of using a strong password?'
      ]::text[],
      ARRAY[
        'A long, unique password that others cannot easily guess.',
        'A password with enough length and variety to protect an account.',
        'A secret sign-in phrase that is difficult to predict or reuse.',
        'A unique password that avoids names, birthdays, and common words.',
        'A password designed to keep other people out of your account.'
      ]::text[]
    ),
    (
      3,
      'password-manager',
      'Password manager',
      'account-security',
      ARRAY[
        'What does a password manager help you do?',
        'Why might someone use a password manager?',
        'How does a password manager support safer accounts?',
        'What tool can store many unique passwords for you?',
        'What is the purpose of a password manager?'
      ]::text[],
      ARRAY[
        'It stores and helps create unique passwords for different accounts.',
        'It keeps passwords organized so you do not have to reuse weak ones.',
        'It protects many account passwords behind one strong master password.',
        'It helps you use different secure passwords without memorizing every one.',
        'It is a secure place to save and manage login passwords.'
      ]::text[]
    ),
    (
      4,
      'multi-factor-authentication',
      'Multi-factor authentication',
      'account-security',
      ARRAY[
        'What is multi-factor authentication?',
        'Why does a code from your phone make logging in safer?',
        'What security step asks for more than just a password?',
        'How does two-step login help protect an account?',
        'What does MFA add to the sign-in process?'
      ]::text[],
      ARRAY[
        'It requires another proof of identity in addition to a password.',
        'It adds a second check, such as a code, app prompt, or security key.',
        'It makes sign-in safer by needing more than one kind of evidence.',
        'It protects accounts by combining a password with another verification step.',
        'It is an extra login layer that confirms the user is really you.'
      ]::text[]
    ),
    (
      5,
      'phishing',
      'Phishing',
      'online-scams',
      ARRAY[
        'What is phishing?',
        'What kind of message tries to trick you into giving private information?',
        'Why should you be careful with urgent links asking for login details?',
        'What scam pretends to be a trusted person or company online?',
        'What is happening when a fake message asks for passwords or account info?'
      ]::text[],
      ARRAY[
        'A scam message that tries to steal information by pretending to be trusted.',
        'A trick that uses fake emails, texts, or sites to get private data.',
        'An online scam that asks for passwords, codes, money, or personal details.',
        'A fake request designed to make people click, sign in, or share secrets.',
        'A deceptive message that impersonates someone to steal account information.'
      ]::text[]
    ),
    (
      6,
      'secure-websites',
      'Secure websites',
      'online-safety',
      ARRAY[
        'What does HTTPS usually show about a website connection?',
        'Why should you look for a secure connection before entering private details?',
        'What does the lock symbol near a web address usually mean?',
        'How does a secure website connection help protect information?',
        'What website sign suggests data is encrypted while it travels?'
      ]::text[],
      ARRAY[
        'The connection is encrypted, which helps protect data sent to the site.',
        'It means information traveling between your browser and the site is better protected.',
        'It shows the site is using HTTPS to help keep communication private.',
        'It reduces the chance that others can read information you send online.',
        'A lock or HTTPS means the browser is using an encrypted web connection.'
      ]::text[]
    ),
    (
      7,
      'privacy-settings',
      'Privacy settings',
      'online-privacy',
      ARRAY[
        'What do privacy settings control?',
        'Why should you check privacy settings on an app or website?',
        'What settings decide who can see your posts or profile?',
        'How can privacy settings help protect your information?',
        'What tool lets you limit sharing on an online account?'
      ]::text[],
      ARRAY[
        'They control who can see your information, activity, or posts.',
        'They let you limit what an app or website shares about you.',
        'They help decide what is public, private, or visible to certain people.',
        'They are account controls for audience, data sharing, and visibility.',
        'They help protect privacy by reducing who can access your content.'
      ]::text[]
    ),
    (
      8,
      'digital-footprint',
      'Digital footprint',
      'online-privacy',
      ARRAY[
        'What is a digital footprint?',
        'What do your online posts, searches, and accounts leave behind?',
        'Why can online actions affect your reputation later?',
        'What term means the trail of information you create online?',
        'How do likes, comments, and uploads connect to digital citizenship?'
      ]::text[],
      ARRAY[
        'The trail of information you leave through online activity.',
        'Records and clues created by what you post, share, click, or upload.',
        'A lasting online trace that can affect how others see you.',
        'The collection of data connected to your actions on the internet.',
        'Your online history made from posts, accounts, comments, and other activity.'
      ]::text[]
    ),
    (
      9,
      'cyberbullying',
      'Cyberbullying',
      'digital-citizenship',
      ARRAY[
        'What is cyberbullying?',
        'What should you call repeated mean behavior using digital tools?',
        'Why is posting hurtful messages about someone online a serious problem?',
        'What online behavior uses technology to harass or embarrass another person?',
        'What digital citizenship issue involves repeated online cruelty?'
      ]::text[],
      ARRAY[
        'Using digital tools to repeatedly hurt, threaten, embarrass, or harass someone.',
        'Online bullying through messages, posts, images, games, or social media.',
        'Repeated harmful behavior toward another person using technology.',
        'Cruel or threatening digital actions meant to upset or shame someone.',
        'Bullying that happens through phones, computers, apps, or websites.'
      ]::text[]
    ),
    (
      10,
      'malware',
      'Malware',
      'online-safety',
      ARRAY[
        'What is malware?',
        'What type of software is designed to damage or take over a device?',
        'Why can suspicious downloads be dangerous for a computer?',
        'What do viruses, spyware, and ransomware all have in common?',
        'What term describes harmful software on a device?'
      ]::text[],
      ARRAY[
        'Harmful software made to damage, spy on, lock, or control a device.',
        'Software that can steal data, break systems, or cause unwanted actions.',
        'A general name for viruses, spyware, ransomware, and other harmful programs.',
        'Code installed on a device to do something unsafe or unwanted.',
        'Malicious software that can hurt privacy, files, accounts, or performance.'
      ]::text[]
    ),
    (
      11,
      'software-updates',
      'Software updates',
      'device-care',
      ARRAY[
        'Why are software updates important?',
        'How can updating an app or operating system improve safety?',
        'What do updates often fix besides adding new features?',
        'Why should devices not ignore important security updates?',
        'What helps patch known problems in software?'
      ]::text[],
      ARRAY[
        'Updates can fix bugs and security weaknesses in software.',
        'They patch problems that attackers or errors could use.',
        'They improve safety, reliability, and sometimes add useful features.',
        'They help keep apps and devices protected from known issues.',
        'They repair software flaws and keep systems working more securely.'
      ]::text[]
    ),
    (
      12,
      'backups',
      'Backups',
      'device-care',
      ARRAY[
        'What is a backup?',
        'Why should important files be backed up?',
        'How can a backup help after a device breaks or files are deleted?',
        'What do you call an extra copy of important data?',
        'Why are backups part of responsible device use?'
      ]::text[],
      ARRAY[
        'An extra copy of files saved somewhere safe.',
        'A saved copy that can restore work if the original is lost.',
        'A way to recover data after deletion, damage, theft, or device failure.',
        'A duplicate of important information kept in another location.',
        'Protection for files so one problem does not erase everything.'
      ]::text[]
    ),
    (
      13,
      'public-wifi',
      'Public Wi-Fi',
      'online-safety',
      ARRAY[
        'Why can public Wi-Fi be risky?',
        'What should you remember when using Wi-Fi in a public place?',
        'Why is it safer to avoid private account work on unknown networks?',
        'How can open Wi-Fi make personal information less protected?',
        'What network safety issue comes with using free public Wi-Fi?'
      ]::text[],
      ARRAY[
        'Other people on the network may be able to interfere with or watch traffic.',
        'Open networks can be less secure than trusted home or school networks.',
        'It may be easier for attackers to trick users or capture information.',
        'Unknown Wi-Fi should be used carefully, especially for private accounts.',
        'Public networks can expose data if sites, apps, or settings are unsafe.'
      ]::text[]
    ),
    (
      14,
      'safe-downloads',
      'Safe downloads',
      'online-safety',
      ARRAY[
        'How can you download files or apps more safely?',
        'Why should downloads come from trusted sources?',
        'What should you check before installing an app or file?',
        'Why can random download links be unsafe?',
        'What habit helps prevent harmful downloads?'
      ]::text[],
      ARRAY[
        'Use trusted sources and avoid suspicious links, pop-ups, or attachments.',
        'Check the source, reviews, permissions, and whether the file seems expected.',
        'Download only from official stores, known websites, or teacher-approved sources.',
        'Be cautious because fake downloads can install malware or steal information.',
        'Verify the file and source before opening or installing anything.'
      ]::text[]
    ),
    (
      15,
      'reliable-sources',
      'Reliable sources',
      'information-literacy',
      ARRAY[
        'What makes an online source reliable?',
        'How can you judge whether a website is trustworthy?',
        'Why should you check the author, date, and evidence of a source?',
        'What kind of source is better for research or learning?',
        'How do reliable sources help prevent misinformation?'
      ]::text[],
      ARRAY[
        'It has accurate information from a trustworthy author or organization.',
        'It provides evidence, clear authorship, current details, and a serious purpose.',
        'It can be checked against other trustworthy sources and facts.',
        'It is a source with credible information, not just opinion or rumor.',
        'It supports claims with facts so readers are less likely to be misled.'
      ]::text[]
    ),
    (
      16,
      'search-keywords',
      'Search keywords',
      'information-literacy',
      ARRAY[
        'What are search keywords?',
        'How do keywords help you find better information online?',
        'Why should you choose important words instead of typing a whole paragraph?',
        'What search strategy uses the main words from your question?',
        'How can changing keywords improve search results?'
      ]::text[],
      ARRAY[
        'Important words or short phrases used to search for information.',
        'Main terms that tell a search engine what topic you need.',
        'Focused words that help narrow results to the idea you are researching.',
        'The key ideas from a question written as searchable terms.',
        'Words you adjust to get more useful and accurate search results.'
      ]::text[]
    ),
    (
      17,
      'copyright',
      'Copyright',
      'digital-citizenship',
      ARRAY[
        'What is copyright?',
        'Why can you not freely copy every image, song, video, or article online?',
        'What protects creators'' original work from being used without permission?',
        'Why should you credit or get permission for someone else''s digital work?',
        'What rule gives creators control over how their work is used?'
      ]::text[],
      ARRAY[
        'A legal protection for original creative work.',
        'A rule that gives creators rights over copying, sharing, and using their work.',
        'Protection that means online content still belongs to its creator.',
        'A reason to get permission, follow licenses, or give credit when using work.',
        'Creators'' control over how others use their writing, images, music, or videos.'
      ]::text[]
    ),
    (
      18,
      'cloud-storage',
      'Cloud storage',
      'device-care',
      ARRAY[
        'What is cloud storage?',
        'How can saving a file to the cloud help you access it later?',
        'Why might cloud storage help when you switch devices?',
        'What does it mean when files are stored online instead of only on one device?',
        'How does cloud storage support backups and collaboration?'
      ]::text[],
      ARRAY[
        'Saving files on internet-connected servers so they can be accessed online.',
        'Online storage that can sync files across devices.',
        'A way to keep files available from different devices with the same account.',
        'Storage outside one computer, often used for backup, sharing, or teamwork.',
        'A service that stores files online and can update copies automatically.'
      ]::text[]
    ),
    (
      19,
      'file-organization',
      'File organization',
      'device-care',
      ARRAY[
        'Why is file organization important?',
        'How do folders and clear file names help with school work?',
        'What habit makes saved work easier to find later?',
        'Why should files be named and stored in a planned way?',
        'What does organizing digital files help you avoid?'
      ]::text[],
      ARRAY[
        'It makes files easier to find, use, share, and turn in.',
        'Clear names and folders prevent lost work and confusion.',
        'It keeps digital work sorted so you can locate the right version quickly.',
        'A planned folder and naming system helps manage many documents.',
        'It reduces wasted time searching for misplaced or poorly named files.'
      ]::text[]
    ),
    (
      20,
      'netiquette',
      'Netiquette',
      'digital-citizenship',
      ARRAY[
        'What is netiquette?',
        'How should people communicate respectfully online?',
        'What digital citizenship concept means using good manners on the internet?',
        'Why should tone and word choice matter in online messages?',
        'What behavior helps online spaces stay respectful and useful?'
      ]::text[],
      ARRAY[
        'Respectful and responsible manners for communicating online.',
        'Using kind, clear, and appropriate behavior in digital spaces.',
        'Online etiquette that helps people treat each other well.',
        'Choosing words and actions that are respectful in messages, posts, and chats.',
        'Good digital manners that support safe and productive communication.'
      ]::text[]
    )
),
concept_rows AS (
  INSERT INTO cquiz2_concepts (
    quiz_id,
    concept_key,
    concept_name,
    position,
    confusability_group,
    active
  )
  SELECT
    quiz_row.id,
    concept_bank.concept_key,
    concept_bank.concept_name,
    concept_bank.position,
    concept_bank.confusability_group,
    true
  FROM quiz_row
  CROSS JOIN concept_bank
  ON CONFLICT (quiz_id, concept_key)
  DO UPDATE SET
    concept_name = EXCLUDED.concept_name,
    position = EXCLUDED.position,
    confusability_group = EXCLUDED.confusability_group,
    active = true,
    updated_at = now()
  RETURNING id, concept_key
),
all_concepts AS (
  SELECT
    concept_rows.id,
    concept_bank.position,
    concept_bank.concept_name,
    concept_bank.question_texts,
    concept_bank.answer_texts
  FROM concept_rows
  JOIN concept_bank ON concept_bank.concept_key = concept_rows.concept_key
),
question_rows AS (
  INSERT INTO cquiz2_question_variants (
    concept_id,
    question_text,
    relationship_type,
    difficulty,
    active
  )
  SELECT
    all_concepts.id,
    format(
      '[Concept %s: %s | Question %s] %s',
      lpad(all_concepts.position::text, 2, '0'),
      all_concepts.concept_name,
      lpad(question_variant.ordinality::text, 2, '0'),
      question_variant.question_text
    ),
    'direct',
    question_variant.ordinality::integer,
    true
  FROM all_concepts
  CROSS JOIN LATERAL unnest(all_concepts.question_texts)
    WITH ORDINALITY AS question_variant(question_text, ordinality)
  ON CONFLICT (concept_id, question_text)
  DO UPDATE SET
    relationship_type = EXCLUDED.relationship_type,
    difficulty = EXCLUDED.difficulty,
    active = true,
    updated_at = now()
  RETURNING id, concept_id
),
answer_rows AS (
  INSERT INTO cquiz2_answer_variants (
    concept_id,
    answer_text,
    difficulty,
    active
  )
  SELECT
    all_concepts.id,
    format(
      '[Concept %s: %s | Answer %s] %s',
      lpad(all_concepts.position::text, 2, '0'),
      all_concepts.concept_name,
      lpad(answer_variant.ordinality::text, 2, '0'),
      answer_variant.answer_text
    ),
    answer_variant.ordinality::integer,
    true
  FROM all_concepts
  CROSS JOIN LATERAL unnest(all_concepts.answer_texts)
    WITH ORDINALITY AS answer_variant(answer_text, ordinality)
  ON CONFLICT (concept_id, answer_text)
  DO UPDATE SET
    difficulty = EXCLUDED.difficulty,
    active = true,
    updated_at = now()
  RETURNING id, concept_id
)
INSERT INTO cquiz2_valid_matches (question_variant_id, answer_variant_id)
SELECT question_rows.id, answer_rows.id
FROM question_rows
JOIN answer_rows ON answer_rows.concept_id = question_rows.concept_id
ON CONFLICT (question_variant_id, answer_variant_id)
DO NOTHING;

UPDATE cquiz2_question_variants qv
SET active = false,
    updated_at = now()
FROM cquiz2_concepts c
JOIN cquiz2_quizzes q ON q.id = c.quiz_id
JOIN cquiz2_sections s ON s.id = q.section_id
JOIN cquiz2_units u ON u.id = q.unit_id
WHERE qv.concept_id = c.id
  AND q.quiz_name = 'Digital Citizenship Concepts'
  AND q.quiz_number = 7
  AND q.grade_level = 6
  AND u.name = 'Digital Literacy'
  AND s.name = 'Digital Citizenship'
  AND qv.question_text NOT LIKE '[Concept % | Question %] %';

UPDATE cquiz2_answer_variants av
SET active = false,
    updated_at = now()
FROM cquiz2_concepts c
JOIN cquiz2_quizzes q ON q.id = c.quiz_id
JOIN cquiz2_sections s ON s.id = q.section_id
JOIN cquiz2_units u ON u.id = q.unit_id
WHERE av.concept_id = c.id
  AND q.quiz_name = 'Digital Citizenship Concepts'
  AND q.quiz_number = 7
  AND q.grade_level = 6
  AND u.name = 'Digital Literacy'
  AND s.name = 'Digital Citizenship'
  AND av.answer_text NOT LIKE '[Concept % | Answer %] %';

COMMIT;
