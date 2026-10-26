export const quizPrompt = `VARIABLES — edit these values before sending this prompt to AI
TEXTBOOK_SOURCES = [list one entry per textbook and chapter/section range; add entries for additional books or separate ranges]
[
  {
    "textbook": "[full textbook title]",
    "edition": "[edition, year, or ISBN if known]",
    "chapters": "[e.g. Chapter 1 or Chapters 2–4]",
    "sections": "[e.g. 1.1–1.4, or leave blank to cover all specified chapters]",
    "sourceMaterial": "[paste or attach the relevant pages, or provide an accessible source for this edition and range]"
  }
]
QUIZ_ID = [unique-stable-kebab-case-id]
FILE_NAME = [same-as-quiz-id.json]
QUIZ_NAME = [quiz title]
QUIZ_NUMBER = [positive integer]
GRADE_LEVEL = [integer 0–12, or null for unassigned]
TEACHER = [teacher display name]
QUESTION_VARIANTS_PER_CONCEPT = [number, e.g. 5]
ANSWER_VARIANTS_PER_CONCEPT = [number, e.g. 5]
ADDITIONAL_CRITERIA = [standards, vocabulary, difficulty, exclusions, or "none"]

Create one comprehensive concept-based study quiz for Quiz App 3 covering all entries in TEXTBOOK_SOURCES above. Multiple textbooks belong to the same quiz and the same JSON file.

Study goal and later test:
- Students will study this question bank before taking a separate 10-question test encompassing the specified chapter/section ranges across all selected textbooks.
- Those 10 test questions will be rephrased from the study questions generated for this app. Help students understand the concepts well enough to recognize new wording and apply the same ideas.
- Generate as many distinct, meaningful, assessable concepts as the specified material supports. There is no fixed concept count or arbitrary maximum. Do not limit the study bank to 10 questions or concepts.
- Cover every section in the requested range, including its important terms, facts, functions, relationships, comparisons, processes, and applications when supported by the textbook. Build broad coverage so the later 10-question test can draw from across the specified range.
- Do not invent extra concepts or add trivial distinctions just to increase the count. If the source supports fewer than 10 distinct concepts, include only those supported concepts; never create duplicates to reach 10.

Source and coverage rules:
- For each entry in TEXTBOOK_SOURCES, verify its textbook edition and exact chapter/section boundaries using its sourceMaterial or an accessible, reliable copy of the specified material. A textbook title alone is not evidence of the contents of a particular chapter or edition.
- If you cannot access or verify the requested material, ask me to paste or attach the relevant pages before generating the bank. Do not invent textbook contents or substitute generic topic knowledge for the specified reading.
- Stay within each textbook's own chapters and sections. An empty sections value means the whole specified chapter range. Use the selected textbook material as the content anchor and follow ADDITIONAL_CRITERIA.
- Before writing the JSON, inventory the assessable concepts in each included section. Then consolidate that inventory by meaning across the entire range.
- One underlying learning target belongs to one concept, even if several textbooks or chapters repeat it. Deduplicate by meaning across ALL sources. Rewordings, synonyms, reverse questions, and examples that test the exact same idea belong under that concept's variants, not in additional concepts.
- Keep genuinely different learning targets separate, even when related. Arrange concepts in the listed textbook order, then chapter/section order within each book. Check that every selected source's distinct learning targets are represented.

How the quiz works:
- A concept is one specific idea, fact, definition, skill, or relationship.
- The app shows up to four concepts at a time, choosing one question variant and one answer variant per concept independently.
- Include a short, grade-appropriate description of what the quiz covers. This appears below the Directions accordion before students begin; summarize the topics without showing quiz questions or answer pairs.
- Students rearrange answers to match the questions. Matches are graded by concept, not exact wording.
- EVERY question variant for a concept must correctly match EVERY answer variant of that same concept, in any combination.
- Keep concepts clearly distinct. No answer from one concept may reasonably answer a question from another concept, and no question may reasonably accept an answer from another concept.
- Group related concepts with confusabilityGroup, but do not make their meanings interchangeable.
- Avoid broad prompts, opinion questions, trick questions, and multiple reasonable answers. Use specific, concise, grade-appropriate language and write original study questions in your own words.
- Rephrase question variants meaningfully while preserving the same learning target and answer meaning. Do not just change a word or rearrange a sentence. Each variant should prepare students to recognize that concept in a differently worded test question.
- Answers must supply the missing idea, not repeat the question or restate its subject. Omit device names, concept labels, and distinctive keywords already supplied by the question when repeating them would reveal the match. Use a concise description of the function, action, or relationship instead. Students should match by understanding, not by spotting the same words on both cards.
- For example, for "What two things does a touchscreen do that give it an input role and an output role?", use an answer such as "Detects where you press and displays pictures and text." Do not use "A touchscreen senses touches as input and shows information as output." Apply this rule across EVERY question variant and EVERY answer variant within the concept, since the app pairs them independently.
- Check for giveaway wording in both directions: do not put the answer term into a question asking students to identify that term, and do not copy the question's identifying words into its answer. Ordinary shared words are fine. Keep an essential technical term when removing it would make the answer inaccurate or ambiguous; rewrite the question to avoid supplying that term when possible. Do not replace clear wording with awkward synonyms, vague pronouns, or incomplete answers just to avoid overlap.
- Keep each concept's variants equal in scope: do not add a fact, condition, or subskill to just one variant if the other answer variants would no longer fully answer it.
- If an image is attached, extract usable concepts and rewrite unclear material into clean variants.
- Audit every question variant against every answer variant in every OTHER concept. Revise any ambiguity before returning the quiz. Also audit the entire bank for repeated underlying concepts and omissions from the selected sections. Audit every within-concept question/answer pairing for repeated identifying words or phrases that give away the match without understanding, and revise those pairs while preserving correctness and distinct meanings.

Return only one valid JSON object, with no Markdown fences or explanation, ready to save as FILE_NAME in src/QuizApp3/quizzes/ and push to the repository. Do not return CSV, SQL, JavaScript, or a JSON array. Use exactly this structure:
{
  "id": "[QUIZ_ID]",
  "quizName": "[QUIZ_NAME]",
  "description": "[short grade-appropriate overview of the quiz topics]",
  "quizNumber": 1,
  "gradeLevel": 6,
  "teacher": "[TEACHER]",
  "sources": [
    {
      "textbook": "[textbook title, including edition if supplied]",
      "chapters": "[this textbook's chapter label or range]",
      "sections": "[this textbook's section label or range, or an empty string]"
    }
  ],
  "concepts": [
    {
      "position": 1,
      "conceptKey": "unique-concept-key",
      "conceptName": "Specific concept name",
      "confusabilityGroup": "related-concept-group",
      "questionVariants": ["Question wording 1", "Question wording 2"],
      "answerVariants": ["Answer wording 1", "Answer wording 2"]
    }
  ]
}

Source metadata rules:
- sources must be a nonempty array. Include one object per textbook/range entry in TEXTBOOK_SOURCES, in the same order.
- Keep textbook, chapters, and sections together in each object so references cannot become mismatched between books.
- The app automatically displays these objects as aligned lines under Textbook, Chapters, and Sections within ONE quiz entry. Do not combine books into a comma-separated string, insert manual line breaks to represent separate books, or return separate quiz objects for the books.
- textbook, chapters, and sections must be strings. Use "" for unspecified sections. Do not invent section numbers.
- Return sources instead of the old unit and section fields. Only output source metadata, not the sourceMaterial or original textbook passages.

Replace example values with the variables. quizNumber and gradeLevel must be JSON numbers (or JSON null for an unassigned grade), never quoted strings. Include the full set of distinct concepts identified across the specified sources, numbered consecutively from 1, with the requested count of each kind of variant for every concept. conceptKey must be unique across the entire quiz, including all books, and use short kebab-case. All variant entries must be nonempty strings. Escape quotes and line breaks as valid JSON. Return the complete bank without placeholders, ellipses, comments, or trailing commas. The requested output is the full study bank for this app; the separate 10-question test will be created from it later.

Keep QUIZ_ID and conceptKey stable when revising the same quiz so existing device progress continues to match. Use a new QUIZ_ID for a new or substantially different quiz. Only include quiz content and metadata; the app manages attempts, scores, percentages, and local storage.`;
