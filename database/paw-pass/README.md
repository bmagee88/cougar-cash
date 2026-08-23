# Paw Pass Database Setup

Run this against the local Postgres database you want to use for Paw Pass:

```sql
\i database/paw-pass/schema.sql
```

Suggested local environment variable:

```text
PAW_PASS_DATABASE_URL=postgres://user:password@localhost:5432/cougar_cash
```

Sample upload rosters are in `database/paw-pass/sample-rosters`. They are
split by teacher and period so you can pick the period in Paw Pass, choose the
matching CSV, preview it, and then save it.

Production/internal-server notes:

- Keep Paw Pass staff-operated. Students should not have accounts or direct access.
- Store only generated student usernames, medical-priority flags, and a server-side HMAC/fingerprint of the internal student id.
- Do not store full student names, birth dates, addresses, parent data, or raw internal student ids in Paw Pass tables.
- Use school Google domains and staff role approval before allowing sign-in.
- Keep audit events for roster edits, requests, permits, dismissals, freezes, returns, eloper flags, and accounted-for actions.
- Configure data retention with the district before production use.
- Use TLS, least-privilege database credentials, regular backups, and restricted admin access before putting this on an internal server.
