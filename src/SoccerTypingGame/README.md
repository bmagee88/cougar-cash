# Soccer Typing

Route: `/typing/soccer`

Soccer Typing is a local two-team typing strategy game. The team with possession selects a teammate letter to pass or S to shoot at the opposing goal. S is reserved and cannot be assigned to a player. Pass phrase length scales with distance. Pass prompts wrap inside a bounded area of the field, including when a goalkeeper has possession.

Defenders can choose an eligible player whose perpendicular interception point lands on the locked ball path. The defender phrase length scales with distance from that path, and the hidden time allowance is based on where the interception point falls along the pass.

Typing challenges intentionally allow mistakes to remain in the entered text. Players must use Backspace to reach and repair errors before a phrase can complete. The engine records elapsed time, corrected mistakes, backspaces, and accuracy for match statistics.

Default rules:

- First team to 3 goals wins.
- Offense and defense selection windows are hidden.
- Enter gates separate passing turns and the next player selection. Selection clocks start only after Enter; leftover letters are ignored while waiting.
- A missed defensive selection lets the pass continue.
- An offensive selection timeout turns the ball over to the closest opposing player.
- After a selected defender's attempt succeeds or fails, every off-ball player moves to a fresh spot within nine field units of their original home. The resolved ball carrier stays put. Missed defensive selections do not trigger movement.
- Goalkeepers participate in passing and interceptions, and their off-ball movement stays within their own goal-mouth area.

The implementation keeps core geometry, phrase scaling, typing state, possession, scoring, and temporary-position rules in pure TypeScript functions under `src/SoccerTypingGame/engine`.

## Shooting

The head-on goal view has five locations: top left, top right, center, bottom left, bottom right. Each uses a 12-character phrase with a unique initial letter. Both teams type the same five phrases in any order. The first letter locks the phrase and starts its timer; Enter is required after each completed phrase and before each team's round. Mistakes and corrections count toward the time. A strictly faster defender blocks that location; ties remain open for the attacker.

Shot distance uses the actual shooter-to-goal distance. Each quarter of the field width reduces the number of chances: less than 25 units gives four rolls, 25-49 gives three, 50-74 gives two, and 75 or more gives one on the default field. Rolls independently choose from all five locations with replacement. Any roll hitting an open location scores. The animation chooses randomly among successful rolls, or among blocked rolls if none succeeds.

The shooting header shows the offense's live goal probability instead of a completion counter. Untyped attacking locations count as closed; completed attacking locations count as open unless the keeper has finished faster. Pending defensive challenges, ties, and attacker wins remain open. With `open` locations and `rolls` chances, the probability is `1 - (1 - open / 5)^rolls`, displayed as a percentage rounded to one decimal place. This is provisional while battles remain unfinished and stays independent of the eventual random shot result.

After typing, the camera pulls back according to distance, then runs a three-second countdown and an arcing ball flight. Corner saves use four directional dive SVG poses; center saves keep the standing goalkeeper. Results last four seconds. A save hands possession to the goalkeeper and refreshes off-ball positions. A goal increments the score and restores the starting formation, with the conceding team's back (sweeper Q or A) starting with the ball. `goalKickoffPlayerByTeam` configures post-goal possession separately from the initial kickoff. The third goal completes the match after the celebration. Pause shifts all active typing and animation clocks without changing the stored shot outcome.

Both teams use mirrored small-sided formations spanning both halves, with a goalkeeper, a defensive sweeper, a central midfielder, two wide players, and a forward near the opposing goal. Player positions are foot locations on the 100-by-60 field. `movement.radius` configures off-ball movement; each new position is sampled around the original home rather than the previous position to prevent drift. Placement checks reserve room for the player figure and letter label.

`components/SoccerPlayerSvg.tsx` and `components/SoccerGoalkeeperSvg.tsx` render the artwork as inline SVG. Goalkeepers wear contrasting long-sleeved kits and gloves. The optional `colors` fields on team and player definitions accept `shirt`, `shorts`, `socks`, `trim`, `skin`, `hair`, `boots`, and goalkeeper `gloves` colors. Team colors default to the existing team `color` and `accent`; individual player colors override team colors. For example, `colors: { shirt: "#ef4444", shorts: "#ffffff", boots: "#111827" }` changes a player's kit without changing their team or game rules.
