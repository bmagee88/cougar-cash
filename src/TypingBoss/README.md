# Typing Boss modes

The creation screen defaults to **Proportional**. **Old mode** retains the original quiz challenges, class HP, moves, damage calculations, and timed automatic boss attacks. Requests from older clients that omit `mode` still create old-mode sessions.

## Proportional rules (Balanced off)

- The host plays the Ancient Red Dragon. Up to 30 players choose a class; all start with 100 HP and have a unique gold-word ability.
- The roster locks at Start. Dragon HP is `100 × starting player count`. Each dragon attack rolls 30% Bite, 30% Fireball, 30% Tail Whip, or 10% Flamethrower. Bite and Fireball focus all power on one random living player. Tail Whip chooses a random living anchor and its nearest living neighbors in the host's formation, targeting 30% of survivors (rounded to the nearest whole player, minimum one). Flamethrower hits every survivor. Power is divided evenly among the selected targets before dodge and shields; a target's avoided damage is not redistributed.
- Before Start, the host can choose a 1×–100× HP multiplier (default 1×). It applies equally to every player's HP and dragon HP, with unchanged damage. The server validates and locks it when the battle starts.
- Both sides continuously type random words from the exact numeric word pools used by Home Row Run. The data lives in one shared JSON file. Each attack normally shows ten words on a single clipped line that moves left per character. Words advance after a required trailing space, except the final word, which fires on its last letter. Correct characters (including required spaces) add damage. Input continues while requests and projectiles are in flight.
- Gold appears on 5% of words without changing the other color odds. A perfect gold word earns an ability at release. Cleric heals the lowest-HP wounded survivor; Necromancer revives a knocked-out ally; Paladin gives another survivor a one-hit shield, prioritizing an unshielded ally and stacking flat shield HP otherwise. Support replaces the attack, using its power; healing/revival cap at max HP. If no target qualifies, the regular attack goes through. Blue reduction applies before flat shield absorption; dodge preserves both.
- Barbarian and Ancient Red Dragon add two words to the current run per perfect gold, including gold found in added words. The added words can have any normal colors. They grant nothing until typed. A perfect gold extending the former final word requires its separating Space; an incorrect final gold does not extend the run. Both reset to ten words on release and have no gold damage multiplier or carryover. The dragon ability is selected independently from player classes so future bosses can have separate abilities.
- Monk starts the next attack at ten words, then halves it once per gold word (round up: 10 → 5 → 3 → 2 → 1). The shorter attack uses the same damage formula and may earn gold again. Rogue gains one extra independent dodge roll per gold word for the next incoming hit; the displayed chance is the chance any of those rolls succeeds, and the rolls are consumed together.
- Create/join requests opt in to gold words so older clients keep ten-word attacks with the original color set. The host receives progress for the server-known attack window; each typist sees their current progress immediately.
- Rhythm uses actual native key-event timestamp deltas, their mean, and standard deviation: `clamp(1.5 − max(0, SD − 200 ms) / max(mean, 200 ms), 0.5, 1.5)`. The small timing tolerance prevents tiny fast-key differences from dominating the bonus. Perfectly even fast or slow typing gives 1.5×; sufficiently irregular timing reaches 0.5×. Pauses within an attack count. The clock resets after release: the first letter of each new attack starts timing, so resting between attacks is free. Insufficient samples give 1×. After a reload, the unavailable first interval is omitted instead of invented. Required separating spaces are timed as their own keys.
- Each word independently has a 30% chance of being colored, with equal chance of each color. Only a completely correct word earns its bonus. Blue immediately adds 10 percentage points of shielding for the next incoming hit, capped at 100%. Orange adds 10% base attack damage. Red adds ten percentage points of crit chance, capped at 100%. Each green word adds 4% base attack damage for every subsequent fully correct word before release; multiple green words accumulate independently.
- Attack power is `correct characters × rhythm × (1 + orange + green growth) × critical`. Only characters matching the expected letter at the same position add damage, including within partially correct words. Critical is 2× on a successful red roll, otherwise 1×. Orange, red, and green reset on release. Blue persists until the next incoming hit and can be earned while that hit is traveling. The host earns the same bonuses and defenses.
- A player hits the dragon for their attack power. The host splits its power equally among the targets of its selected attack, with each target's defenses applied on impact. HP and totals keep fractional precision internally; displays show up to two decimals. Actual damage credit is capped by remaining HP.
- At least 2× base attack power selects the power attack art/animation; smaller attacks select the weak attack. The host's volley uses one shared 700 ms impact timer. The fight ends when the dragon or the entire party reaches zero HP; finished fights cancel remaining in-flight damage.

## Balanced rules

The host's Balanced switch defaults off and locks at Start. It applies only to
Proportional mode. Old Mode and the randomized Proportional rules are retained.

- All actors receive the same word seed and filters. Colors follow a repeating
  character-work schedule rather than independent rolls; gold becomes available
  after every 100 correct characters and stays available until mastered.
- Every correct character earns 1–1.25 power. A key gap within the greater of
  200 ms or twice the recent within-word median earns 1.25; a hesitation earns 1.
  The median uses up to 21 within-word gaps. Attack-opening gaps are omitted.
  Errors earn zero; WPM is not multiplied again. Each character contributes once,
  independently of run length, so Green/Orange no longer compound across runs.
- Damage gets at least 80% of earned power. Up to 20% can be converted to a class
  effect. A gold Cleric/Necromancer/Paladin spends only that reserve. Unused
  healing/revival power remains damage. The rest of the attack still deals damage.
- Blue converts the reserve to stored guard; Rogue converts it according to
  recent transition fluency, or the full reserve after gold. Guard caps at one
  health bar, with overflow returned to damage. It prevents only the amount earned,
  never random immunity. Readiness is stored capacity, not a probability.
- Paladin shields persist until their capacity is spent in Balanced mode. All
  defensive capacity is funded by reduced outgoing damage. Overkill and eventual
  shield use are tactical considerations, not a promise of equal match win rates.
- Red grants a visual SKILL strike at high quality without doubling damage.
  Barbarian/dragon extensions and Monk shortened runs keep the same power per
  correct character. Gold creates no extra multiplier.
- Boss patterns follow Bite, Fireball, Tail Whip three times, then Flamethrower.
  Target anchors rotate through survivors. Balanced damage and defense never roll dice.
- Balanced submissions include each completed word's key gaps. The server checks
  them against the aggregate timing and computes quality itself. They are sent in
  existing batches, never as per-key network updates. This validates consistency,
  not human authenticity; timing supplied by a modified client is not cheat-proof.

Run the multiplayer verifier with TYPING_BOSS_BALANCED=1 for Balanced, or omit
that variable for Randomized. Deploy both frontend and backend and create a new room.

## Internet traffic and animation

The existing HTTP/SSE transport is retained. No key-by-key messages or animation frames are transmitted.

- Each client builds its words locally from a server-issued seed and word index. Randomized submissions contain completed word text and aggregate key interval count/sum/sum-of-squares. Balanced submissions also contain the measured gaps needed to score each character; neither mode sends absolute key timestamps or per-key requests.
- The scene is above the typing panel. The chip row always shows the current Dodge percentage, including 0%. The dragon lunges and snaps its jaws for Bite, swings its tail for Tail Whip, and uses the existing fire projectile art for Fireball and Flamethrower. Target shields are applied on impact.
- Attack-charge bars sit immediately above health bars. Own charge updates locally on every character. A compact word/character cursor goes to the server at most once per 400 ms, with one request in flight. The host sees all player charges; each player receives only their own charge plus the dragon's. Progress is cosmetic, validated, and cannot award damage or alter typing statistics.
- Completed words are batched until an attack releases; Randomized also flushes when a perfect blue word grants a shield or the dodge percentage changes. Requests serialize while typing continues; sequence numbers make retries idempotent. Batches are validated atomically and capped at 20 words.
- Dodge averages the last five Space-to-next-word transition scores, from 0% to 25%. Each score compares the transition gap with the average of the remaining gaps in that word (with a 40 ms minimum pace): up to 1.25× the pace earns full credit, 2.5× or more earns zero, and in-between scores taper linearly. Accuracy does not enter the score. The first word of each attack has no transition, and firing does not reset the rolling average. The server rolls at impact before applying shields, for both the dragon and players. Dodges deal no damage, preserve the shield, and do not qualify for strongest landed attack. New servers accept the original five-field word records; clients include the optional transition only when the server advertises dodge state.
- Each player receives only their character and projectiles they send or receive. The host receives the full roster and all combat events. Full snapshots are sent on first connection/reconnect; subsequent events contain only changed fields, including small impact-result patches.
- Simultaneous events are coalesced for 100 ms (at most ten stream updates/second). Idle rooms only send a 25-second connection keepalive. A slow stream is disconnected before it can accumulate unbounded writes, and reconnect receives a fresh authoritative snapshot.
- Projectile movement uses browser-driven transform animations, with local impact expiry. React no longer rerenders the projectile layer on a frame timer. Character assets are reused, and host impacts appear beside the corresponding player to avoid a pile of labels on the dragon. Per-player totals stay visible beneath all 30 host avatars.
- Session and game state remain in memory, matching the existing backend. A backend restart ends rooms. A single room must stay on one backend process; this change does not add distributed room storage.
- At the end, players receive a damage-ranked leaderboard with each player's strongest landed attack: base characters, power, actual damage, total multiplier, timing mean/variation, consistency, orange/green bonuses, red chance and critical outcome, and blue defense ready at release. Strongest is ranked by power before defenses and overkill limits; canceled in-flight attacks do not qualify. Shared results are sent only after the fight ends and remain available after reconnect.

Implementation references: [Node writable-stream backpressure](https://nodejs.org/api/stream.html), [HTML EventSource reconnection](https://html.spec.whatwg.org/dev/server-sent-events.html).

## Verification

### Deploying the backend on Render

Proportional mode runs on the same classroom Node web service as Old Mode. It
does not require a separate Render service, database, or Typing Boss environment
variable on Render.

1. In the existing Render web service, use the `bmagee88/cougar-cash` repository
   and `main` at merge commit `bac96ed` or a newer revision that includes
   `server/proportionalBoss.js`. Use matching word-bank revisions on Netlify
   and Render because both generate words from the same shared list.
2. Set **Root Directory** to the repository root (leave it blank), **Build
   Command** to `npm ci`, **Start Command** to `node server/appServer.js`, and
   **Health Check Path** to `/api/health`. Use the Node runtime. Leave `PORT` to
   Render; remove old custom port overrides if they conflict. Keep a single
   instance because active rooms are stored in that instance's memory.
   If Render reports `Missing script: "start:backend"`, check the commit in
   the deploy log and the service's Root Directory. The merged `main` commit
   `bac96ed` has both the npm alias and `server/appServer.js` at the repository
   root. The direct Node command bypasses the alias, but still needs that file
   and its dependencies in the deployed checkout.
   If the startup banner says `cougar-classroom-backend@1.0.0 start` and
   startup fails with `Cannot find module 'pg'`, Render is running the
   `server/package.json` script. Install dependencies from the repository root
   instead: clear Root Directory, run `npm ci` there, and start
   `node server/appServer.js`. The root manifest and lockfile include `pg` and
   `google-auth-library`, and the backend also loads shared code from `src/`.
3. Choose **Manual Deploy → Deploy latest commit**. A service restart alone
   will not pick up code from the branch. Existing rooms end when the old
   process stops. With the updated diagnostics, `GET /api/health` includes
   `"typingBossModes":["old","proportional"]`. Commit `15b15b0` already supports
   the new mode but does not have this diagnostics field.
4. For a separate Typing Boss service, set `REACT_APP_TYPING_BOSS_API_URL` in
   Netlify's build environment to its public HTTPS base URL (for example,
   `https://cougar-cash-boss-battle.onrender.com`, without `/api` or
   `/typing-boss`). Redeploy Netlify with the updated frontend code. This
   variable takes precedence for Typing Boss only. Leave
   `REACT_APP_COUGAR_API_URL` unchanged for the other classroom apps. When the
   dedicated URL is unset, Typing Boss continues to use the shared URL.
5. Open `/typing-boss` on your Netlify site, create a fresh **Proportional · Host
   vs players** room, and join from a second browser. The Ancient Red Dragon and
   the host's grade and sentiment filters confirm the new setup. The frontend
   reports an error if the backend returns a different mode than requested.

Render references: [Web Services](https://render.com/docs/web-services),
[Manual deploys](https://render.com/docs/deploys#manual-deploys),
[Health Checks](https://render.com/docs/health-checks).

### Local checks

```text
node --test server/proportionalBoss.test.js
npm run test:typing-boss-ui
npx tsc --noEmit
npm run build
```

With the classroom backend running, `node scripts/verify-typing-boss.cjs` opens 31 SSE clients, checks 30-player scaling, personal event filtering, simultaneous attacks, sequence retries, reconnect snapshots, and the original mode's challenge/action routes. It closes its rooms afterward.

One local run produced 60 projectiles (30 player shots plus 30 host targets), including one progress update per actor, using 32,813 host payload bytes and an average 1,442 payload bytes per player, with four host updates. These are measured SSE event payloads for that one attack burst, excluding initial snapshots, uploads, HTTP/TLS overhead, and real-world latency. Word lengths and scheduling change the exact totals. This is a local concurrency test, not an internet latency or classroom hardware benchmark.

Every word must end with a typed space, except word ten, which fires on its last letter. Spaces count as correct damage characters and their key intervals are included in rhythm. Rhythm is clamp(1.5 - max(0, SD - 200ms) / max(mean, 200ms), 0.5, 1.5); there is no WPM bypass for long pauses.

Before starting proportional mode, the host can select one or more grade chips. Everyone uses the union of those grades; unreviewed entries with null grades are excluded. Grades without words are disabled. Selection locks at Start. A compact grade bitmask in each typing state lets clients and the server derive the same filtered pool without sending word lists or changing color odds. Legacy API callers omitting grades retain the full original pool.

Host setup includes shared grade and sentiment checkbox chips. Each group has All, which disables individual chips until toggled off. Selected grades and sentiments intersect; empty combinations cannot start. Both masks are locked at Start and distributed in actor typing states. Color-bonus probabilities remain independent of sentiment.
