# Word Web (`/word-web`)

This is a copy of Rabbit Hole's graph explorer for Cougar Cash. It preserves the
graph layout, definition links, synonyms/antonyms, long-press discovery, trails,
selection, zoom/pan/fit, seven moods, menus, browser saves, and JSON export/import.
Its browser storage uses `word-web-student-*` keys, separate from Rabbit Hole.

## Student dictionary setup

Live definitions use only [Merriam-Webster's Elementary Dictionary (grades 3–5)](https://dictionaryapi.com/products/api-elementary-dictionary),
the `sd2` API. Obtain an **Elementary Dictionary** key from
[dictionaryapi.com](https://dictionaryapi.com/register/index), then configure the
server environment variable `MERRIAM_WEBSTER_STUDENT_API_KEY`.

- **Netlify:** add the variable in the site's environment settings and redeploy.
  `/api/word-web/dictionary` is rewritten to the bundled Netlify function.
- **Local PowerShell:** set `$env:MERRIAM_WEBSTER_STUDENT_API_KEY` in the backend
  terminal, then run `npm run start:backend`. Run the React frontend in another
  terminal; its existing proxy forwards API requests to port 4000. Alternatively,
  `npm run dev:netlify` serves the function using Netlify's local environment.
- Do not give the key a `REACT_APP_` prefix. It must never enter the browser bundle.

Seven original, reviewed starter entries work without configuration and are
clearly attributed as **Word Web starter vocabulary**, not Merriam-Webster text.
Other lookups show a teacher-help message until the key is configured.
No Wiktionary, FreeDictionaryAPI, or dictionaryapi.dev fallback is used.

## Content policy

The server accepts only `sd2` entries explicitly marked `meta.offensive: false`.
It checks queries, headwords, labels, definitions, examples, inflections, and
related words against a conservative classroom content filter. Sensitive senses
are omitted; wholly filtered entries return a generic choose-another-word message.
Raw spelling suggestions, histories, and quotations are not sent to the browser.
Dictionary markup becomes plain text. No dictionary links open external pages.

The browser checks response entries again. Saved/imported webs must have student
source metadata and pass the same content checks before rendering or caching.
Unrestricted Rabbit Hole exports are rejected. This combines a children's source
with filtering; an automated filter cannot guarantee suitability of every possible
definition for every classroom. Review the policy in `studentSafety.js` as needed.

Synonyms come from available dictionary relationship lists and marked terms in
synonym discussion paragraphs. Antonyms display only when supplied by the student
API. Missing relationships leave their row empty; they are not invented or fetched
from an adult thesaurus. Inflection aliases use provider-confirmed forms.

## Verification

```powershell
node --test server/wordWeb.test.js
$env:CI='true'
node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand --testPathPattern=WordWeb --cacheDirectory=node_modules/.cache/word-web-tests
npm run build
```

The server tests use representative Merriam-Webster JSON fixtures. A real lookup
requires an Elementary Dictionary API key and is not verified without one.
