# Typing Boss input and player integrity

## Implemented protections

New proportional rooms use word protocol version 1. The authoritative state enables it; removing the flag in a modified browser does not downgrade server validation. Old-mode player authentication uses the same private-token protection.

### Private player credentials

- Joining returns a random 256-bit `playerToken`, independent of the public actor `code`. The room stores only its SHA-256 hash.
- Snapshots, event streams, verification, progress, word submission and old-mode challenges/actions require the private token. A public code alone cannot authenticate or recover a private token. A token combined with another actor's code is rejected.
- Tokens are scoped to their room. Public rosters, projectile events, leaderboard entries and snapshots never include player tokens or token hashes. Verification returns only the authenticated player's identity and state.
- Browser storage retains the private credential with the existing room-expiry limit. Public legacy codes cannot be exchanged for new credentials. Deploy frontend and backend together, create fresh rooms, and have students rejoin after upgrading. New clients explicitly reject old join responses without private credentials.

### Correct key to advance

- Wrong keys leave the word cursor in place. The matching key advances one position and earns its normal power once. Repeat, paste and drop remain blocked in the normal UI.
- Completed words contain the exact required text and separator. The server independently checks that exact text, so a modified client cannot submit wrong text to skip a word.
- Correcting a typo never subtracts earned ATK or drains a color bank. The word's mistake count prevents a corrected trigger from claiming a **perfect** bonus. Corrected letters still fund their normal ATK/bank earnings.
- Attempted wrong keys count toward positional accuracy. Accepted-letter timing includes the time spent correcting mistakes after the clock starts. Error counts never become a damage deduction.

### Issued words and observed arrival limits

- The actual sequence seed stays on the server. Client snapshots expose a placeholder seed and only the current and next unseen word, plus already-issued words in the current attack for display/reconnect. Unissued future positions cannot be typed or submitted.
- Each issued index has a cryptographically random per-actor ticket. Guessing a word, copying another actor's ticket, skipping an index, or submitting an unissued word is rejected. The same tickets survive refreshes and retries.
- Every submitted word carries its ticket, mistake count and validated timing aggregates. Balanced words retain actual accepted-letter gaps. Client absolute timestamps are never trusted or transmitted.
- Claimed typing time must fit server-observed time since issuance (with 150 ms tolerance). Zero/implausibly tiny aggregate timing is rejected. A server-clock token bucket refills at 30 accepted characters/second and stores at most 64 characters of arrival credit; idling cannot bank unlimited future submissions. This constrains arrival rate, not attack damage.
- The client sends completed words promptly and can continue through its two-word buffer while a request is in flight. HTTP acknowledgements supply the next window; older stream snapshots cannot erase a newer acknowledged window. If the connection falls behind, input waits for the next issued word without inventing future text or changing power.

### Atomic validation and retries

- A whole batch validates before any combat state, attack, arrival-credit debit or receipt is committed.
- Acknowledged indices must match their original receipt. Exact retries return the current acknowledgement without awarding a second attack; altered retries are rejected. Receipts are bounded to the latest 64 words, and stale results outside that retention require reconnecting.
- Server handling is synchronous during validation/commit, so simultaneous requests cannot interleave awards. Cosmetic progress cannot change earned combat power and is bounded to the issued lookahead.

## Honest boundary: this is not proof of a human typist

The displayed word must be readable by the student's browser. A macro that reads it, uses the student's own private token/ticket, waits a plausible amount of real time, and submits internally consistent timing can still imitate legitimate input. Timing aggregates and mistake counts are claims, constrained by server observations; they are not authenticated keyboard measurements. Browser event flags or additional JavaScript obfuscation cannot solve that trust boundary.

These changes close public-ID impersonation, wrong-word skipping, unissued/precomputed batch submissions, stolen word tickets, unlimited idle credit and duplicate attack awards. They do not claim to eliminate all well-paced automation. Stronger classroom assurance requires supervision or a trusted input environment. Do not flag a student solely for fast or steady typing, and do not reduce earned damage as a bot detector.

## Verification

`npm run test:typing-boss` covers token ownership, opaque windows, actor-specific tickets, exact text, atomic rejection, server-time checks, bounded credit, corrected-word rewards and duplicate receipts. UI checks cover the cursor gate, preserved power, trigger eligibility, private credentials and window exhaustion/acknowledgement recovery.

`node scripts/verify-typing-boss-performance.cjs` starts an isolated server and runs 31 real HTTP/SSE clients. It attempts public-code access, mismatched token/actor access, stolen tickets, skipped words, forged timing and altered replays, then checks normal combat, exact retries, reconnects, ending results and old-mode authentication. Use `TYPING_BOSS_BALANCED=1` and `TYPING_BOSS_SCHEDULED=1` to exercise scheduled Balanced.

Authentication design references: [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) and [object-level authorization](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/).
