# Shared word bank

`homeRowWords.json` retains the existing length buckets, `items`, and `powerups`.
Every entry is now an object:

```json
{ "word": "cat", "gradeLevel": 0, "sentiment": "neutral" }
```

`gradeLevel` estimates the US school grade when a student may first learn the
word's meaning: **0 = kindergarten**, then 1–12. Familiar preschool vocabulary
is grouped under 0. These are editorial estimates of vocabulary exposure,
not validated reading levels, spelling mastery levels, or curriculum standards.
Ordinary words use a common everyday meaning; computing abbreviations and
specialist terms use their technical meaning. Context, instruction, and prior
exposure can shift the appropriate grade. Do not use the estimates to assess a
student's ability.

Unknown or potentially misspelled forms have `gradeLevel: null` and a
`reviewNote`, rather than an invented grade. No entries currently need review; unclear forms were removed during the classroom review.

Use `homeRowWordBank` when consuming the bank:

- `entriesByLength` provides the annotated objects for future grade filtering.
- `wordsByLength` provides the original string arrays for gameplay.
- `staticData.ts` exports those views as `wordEntries` and `words`, respectively.

Home Row Run and Typing Marathon use `staticData.words`. Typing Boss uses
`homeRowWordBank.wordsByLength`. All entries, duplicates, bucket names, and
ordering are preserved, so the migration does not change random word selection
or deterministic multiplayer word sequences. No grade filtering is enabled yet.

## Sentiment and filters

Every entry has `sentiment`: `positive`, `negative`, or `neutral`. These are
editorial estimates of the usual standalone emotional meaning, not a contextual
sentiment model. Ambiguous everyday words, technical terms, and unclear forms
are usually neutral. Phrases can have a different sentiment from their words.
Duplicate words have identical tags.

`filterWordsByLength(gradeMask?, sentimentMask?)` returns string buckets matching
both filters. Bits 0–12 represent grades; sentiment bits 0, 1, 2 represent
positive, negative, neutral. An omitted mask means All. A grade filter excludes
unreviewed grades; All preserves the original pool, including those entries.
Filters preserve ordering and duplicate frequency. No matching combination
returns empty buckets, never an unfiltered fallback.

Home Row Run Settings, Marathon's Word filters menu, and Typing Boss host setup
share checkbox chips. All selects and disables the individual options in its
group. Turn All off to edit a multi-selection. Within a group selection is OR;
between groups it is AND. Home Row Run also filters collectible/powerup and pair
insertions. Typing Fishing and DDR's key/note games do not use these filters.

## Classroom content review — November 10, 2026

Reviewed all 946 distinct words in the prior bank, including item and powerup
buckets. No explicit profanity or sexual terms were identified. Removed eight
entries as a conservative classroom editorial decision:

- `ogle`: leering/objectifying connotation.
- `blazin`: ambiguous slang, including possible drug association.
- `slaps`, `sus`: slang or potentially unhelpful classroom connotations.
- `upn`, `xen`, `xylos`, `jocky`: unclear fragments or nonstandard/misspelled forms.

The reviewed bank has 1,175 entries and 938 distinct words. Normal negative
vocabulary (such as anxiety, conflict, error, and loss), anatomy, computing terms,
and ordinary polysemous words remain. Sentiment is not an appropriateness rating.
This is a human-style editorial review of this word bank, not a blanket guarantee
about every possible interpretation or other text elsewhere in the apps.
Future additions should receive the same review; a regression test prevents
these eight exclusions from being reintroduced accidentally.
