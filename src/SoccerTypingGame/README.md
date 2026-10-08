# Soccer Typing

Route: `/typing/soccer`

Soccer Typing is a local two-team typing strategy game. The team with possession selects a teammate letter to pass or the opposing goal letter to shoot, then types the generated phrase. Phrase length scales with pass or shot distance.

Defenders can choose an eligible player whose perpendicular interception point lands on the locked ball path. The defender phrase length scales with distance from that path, and the hidden time allowance is based on where the interception point falls along the pass.

Typing challenges intentionally allow mistakes to remain in the entered text. Players must use Backspace to reach and repair errors before a phrase can complete. The engine records elapsed time, corrected mistakes, backspaces, and accuracy for match statistics.

Default rules:

- First team to 3 goals wins.
- Offense and defense selection windows are hidden.
- A missed defensive selection lets the pass or shot continue.
- An offensive selection timeout turns the ball over to the closest opposing player.
- An interceptor keeps the temporary interception position for the next action and one additional resolved turn.

The implementation keeps core geometry, phrase scaling, typing state, possession, scoring, and temporary-position rules in pure TypeScript functions under `src/SoccerTypingGame/engine`.
