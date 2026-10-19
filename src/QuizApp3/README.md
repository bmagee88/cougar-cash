# Quiz App 3

Open `/quiz-app-3`, or choose **Quiz App 3** on the home page. The app starts in dark mode and needs no login or backend. There are no due dates, decay, score pages, or settings pages.

The matching board is the same component used by C-Quiz-2, including answer swaps and personal checkboxes, with keyboard support added. The local engine preserves C-Quiz-2's concept matching, independently chosen question/answer variants, practice selection, required passes, and cumulative concept scoring. This app shows **at most four questions**. Each quiz allows `ceil(concept count / 4)` regular attempts per calendar day on the device. Missing a question earns **one bonus round per quiz per day**, regardless of how many questions were missed. The bonus follows the regular attempts and prioritizes a random batch of missed concepts before filling remaining slots with other concepts. Progress and the day's session survive returning to the table or reloading.

Each **Submit** records an attempt, as in C-Quiz-2. Its score is the percentage of all concepts whose latest answer is correct, including concepts answered in earlier attempts. A checkbox is only a placement reminder and does not affect grading. Time never changes progress.

The quiz table's **Proficiency** is the number of completed quiz runs finishing at 100% divided by all completed runs of that quiz. A run finishes after its regular daily rounds and any earned bonus round. Intermediate four-question submissions do not count toward either side of the fraction. For example, 3 perfect completed quizzes out of 5 completed quizzes give **60%** proficiency. The large percentage is dark yellow below 80%, yellow from 80% to below 90%, green from 90% through 95%, and bright green above 95%. A dash means no completed quizzes yet. **Daily progress** shows today's completed attempts / total allowed, with a **+1** badge when the single bonus has been earned. The denominator already includes that bonus. Daily counters reset at local midnight without changing lifetime proficiency or saved concept progress.

The recent section shows the three most recently attempted distinct quizzes, regardless of search filters. Each card has its bold quiz title, lifetime proficiency, last-taken date, and a separate **Attempt x / daily allowance** box at the bottom right.

## Add a quiz

1. Use the small **Quiz prompt** button at the top right, then **Copy prompt**.
2. Fill in the textbook sources (one or more titles, editions, and chapter/section ranges) and other variables at the beginning. Send the prompt and each source's relevant material to AI.
3. Save the returned JSON as `src/QuizApp3/quizzes/<unique-quiz-id>.json`.
4. Push the file to the repository and rebuild/deploy normally. All JSON files in that folder are included automatically; there is no index to update.

The prompt requests as many distinct, assessable concepts as the reading supports, with no fixed concept count. It requires coverage of every selected section and merges repeated underlying concepts into one concept with multiple variants. The resulting study bank prepares students for a separate 10-question test spanning the same range, with questions rephrased from the study questions. The app output remains the full study bank; the test can be created from that bank later. If the exact textbook material is unavailable, the prompt asks for the relevant pages instead of inventing chapter contents.

Each file contains one quiz object with `id`, `quizName`, `quizNumber`, `gradeLevel`, `teacher`, `sources`, and `concepts`. `sources` is a nonempty array of objects with `textbook`, `chapters`, and `sections` strings. Use an empty string for unspecified sections. Multiple books appear as aligned lines under **Textbook**, **Chapters**, and **Sections** in a single quiz entry. These three filters match references belonging to the same book. Concepts keep the C-Quiz-2 format: `position`, `conceptKey`, `conceptName`, `confusabilityGroup`, `questionVariants`, and `answerVariants`. The prompt deduplicates underlying concepts across all books.

The seven initial quizzes copy the existing repository seed banks; six legacy banks have one variant of each kind per concept. Their old unit labels now identify textbooks. Their old sections are assigned chapter numbers starting at Chapter 1 per book, ordered by quiz number; sections are blank. Quiz IDs and concept keys are preserved so saved progress continues to match.

Every question variant must match every answer variant of its own concept. No variant may reasonably match another concept. Use unique quiz IDs and concept keys. Keep IDs and keys stable for ordinary wording edits; use a new quiz ID when replacing the subject or meaning of concepts, so earlier device progress is not reused for different material. `quizNumber` is a positive integer and `gradeLevel` is 0â€“12 or `null`.

## Local data

Completed attempts, concept state, and daily session state are stored in browser `localStorage` under `quiz-app-3.progress.v1`. The seven filters persist under `quiz-app-3.filters.v1`. Data stays on the same browser profile and site origin; it does not sync to another device. Clearing browser site data clears this progress. An unfinished, unsubmitted round is not saved. Storage failures are displayed, and an attempt is only marked saved after the write succeeds. Older saved attempts remain compatible and count toward lifetime proficiency and their original calendar day's progress.

## Checks

`npm test -- --watchAll=false --runInBand --testPathPattern=QuizApp3`

`npm run build`
