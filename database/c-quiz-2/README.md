# C-Quiz-2 Database Setup

Run these against the Postgres database on your server:

```sql
\i database/c-quiz-2/schema.sql
\i database/c-quiz-2/seed-sample.sql
\i database/c-quiz-2/seed-five-more-quizzes.sql
\i database/c-quiz-2/seed-digital-citizenship-concepts.sql
```

For an existing database created before the concept-variant question bank,
run `database/c-quiz-2/migration-concept-variant-bank.sql` before loading
`seed-digital-citizenship-concepts.sql`.

For an existing database created before teacher settings/dark theme support,
run `database/c-quiz-2/migration-user-settings.sql`.

The digital citizenship seed is test data. Rerunning it labels each active
question and answer variant with its concept and variant number, then disables
older unlabeled variants for that quiz.

Netlify environment variables needed by the backend:

```text
CQUIZ2_DATABASE_URL=postgres://user:password@your-postgres-host:5432/database
CQUIZ2_IDENTITY_PEPPER=<long random secret, 24+ chars>
CQUIZ2_SESSION_SECRET=<long random secret, 24+ chars>
GOOGLE_CLIENT_ID=<Google Identity Services web client id>
REACT_APP_GOOGLE_CLIENT_ID=<same Google web client id, used only to render the button>
CQUIZ2_ALLOWED_ORIGINS=https://your-netlify-site.netlify.app,https://your-custom-domain.example
CQUIZ2_AUTH_REDIRECT=/c-quiz-2
CQUIZ2_TIME_ZONE=America/New_York
```

For local `netlify dev` over plain HTTP, add:

```text
CQUIZ2_COOKIE_SECURE=false
```

If Netlify Functions connect to a Postgres server inside your building, that server must be reachable from Netlify's hosted runtime. In practice that means a secure public hostname, VPN/tunnel, or another controlled network path. Keep Postgres behind TLS or a private tunnel, restrict inbound IPs where possible, and use a database user limited to the `cquiz2_*` tables.

Privacy model:

- The frontend receives only `anonId`, role, quiz metadata, public round ids, question text, and answer text.
- The raw Google account id is never stored. The backend stores an HMAC hash of the Google `sub` claim.
- The session cookie is `HttpOnly`, `Secure`, `SameSite=Lax` by default, and expires after 20 minutes.
- Write requests require the session cookie plus the C-Quiz-2 CSRF header.
- The backend ignores client-supplied student ids and computes scores from server-owned round mappings.
