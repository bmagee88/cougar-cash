# Interactive retrieve rules

Checked October 13, 2026. The existing [tackle research](tackle-research.md)
and feeding tables supply species, lure, color, rig, seasonal, time, moon and
weather weights. The keyboard classifier and probabilities below are game
rules; they are not measured fish feeding probabilities.

Primary guidance rechecked:

- [Minnesota DNR: walleye](https://www.dnr.state.mn.us/gofishing/how-catch-walleye.html)
  describes gentle jig/minnow presentations, hovering slip-float bait, slow
  hard-bait retrieves, and allowing several seconds after light bait taps.
- [Minnesota DNR: bass](https://www.dnr.state.mn.us/gofishing/how-catch-largemouth-bass.html)
  describes vegetation/cover, weedless soft plastics and surface presentations.
- [Minnesota DNR: equipment](https://www.dnr.state.mn.us/fishing/fin/equipment.html)
  describes bottom-bouncing jigs and predator crankbaits.
- [Rapala: X-Rap Haku](https://www.rapala.co.uk/uk_en/blog/how-to-master-the-x-rap-haku)
  gives first-hand slower early-spring presentations with longer pauses.
- [Rapala: Shadow Rap](https://www.rapala.com/us_en/shadow-rap)
  describes action during the twitch, fading fall and restart.

## Classification and presentation

Each accepted printable keyboard event enters a rolling five-second window.
No typing for five seconds is dead stick. A pause of at least one second,
an inter-key gap of at least 900 ms, or gap coefficient of variation above
0.65 is stop-and-go. Otherwise movement is steady. Corrections affect rhythm
but only new correctly completed characters reel line or roll a contact.
Paste, modified shortcuts and composition events never generate contacts.

Steady movement maps to slow drag/slow roll or swimming according to the
lure and rig. At least three keys at 2.5 keys/second allow moderate swimming;
at least ten keys at five keys/second allow a fast retrieve on compatible
blade lures. Stop-and-go maps to lifts, twitches or pop-and-pause. Dead stick
is still bait, or a long pause with a suspending jerkbait. The selected muskie
figure-eight presentation applies to a steady retrieve in the last 20% of
line. Actions poorly suited to the lure/rig receive a 0.35 stationary or
0.55 moving presentation penalty. Existing cold-water, habitat and species
affinities still apply. A paused spinner cannot gain the same presentation
benefit as still bait merely by sharing the dead-stick label.

## Contacts and nibbles

For a new correct letter, elapsed time since the previous printable key is
clamped to 100–1000 ms. Contact probability is
`1 - exp(-elapsed / meanWait * (1 - 0.92 * reeledFraction) * coverBonus)`.
The minimum distance factor is 0.08. Cover bonus is 1.35 for dead stick in
grass and 1 otherwise. This keeps contacts scaled to bite time while bounding
repeated-key and long-pause catch-up behavior. No fish is the remaining
probability; a contact selects a fish from the existing conditional weights.
40% of contacts bite immediately; 60% nibble. After five seconds still, a
single five-second contact roll occurs, repeating every five seconds. A
hidden tab does not run a backlog of missed rolls when it returns.

A nibble retains its candidate and resolves uniformly 5–10 seconds later.
Any retrieve input releases it. Holding still can turn it into a bite with
probability `clamp(0.30 + retrieveFactor * 0.22 + min(1, lureAffinity) * 0.15
+ grassDeadStickBonus, 0.20, 0.85)`; grass dead-stick bonus is 0.12. A failed
nibble resumes retrieval, with no escaped-fish statistic. It never exposes
the candidate species before the catch.

## Grass, distance and difficulty

Letters have a 5% seed trial, excluding spaces and existing neighboring
cover. Each seed has independent 25% left and right growth trials. Clusters
stay separated and contain at most three adjacent letters; final coverage
is slightly above the seed rate. A contact while the lure rests on a green
cursor letter promotes the candidate to the next species rarity tier using
conditional weights within that tier. Ultra-Rare stays Ultra-Rare. Quality
and albino draws remain independent and occur when the fish bites.

Wind distance factors are 1.20 for wind, 1.35 for thunderstorm, 1.50 for
blizzard and 1.65 for hurricane, otherwise 1.00. Initial bobber position and
battle character budget scale with that cast snapshot. Interactive battle
budget is further multiplied by `max(0.15, 1 - reeledFraction)` after the
usual WPM bell curve. The existing 10-second fish-on deadline stays in place;
retrieving a complete haiku has no timer. Battle phrase selection retains
complete poems or natural clauses near the resulting character target.

All waits now multiply the old range by two, with another factor of two in
winter. Requested spring fast-moving-lure bonus is 0.75 for swimming/fast
crankbaits, spinnerbaits, spoons and bucktails. It is an explicit game rule,
not a universal biological claim; real early-spring cold water can favor
slower presentations. Interactive contact hazards use these same modifiers.

Standard is the legacy/default mode; Interactive is saved in Settings.
Active casts lock changes. Empty retrieves may be reeled in and recast and
do not award catches or escapes. Interactive catches retain both their
retrieve haiku and their fish-on typing text in the livewell.
