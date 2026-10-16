# Fish Fight rules

Select **Fish Fight** in Settings. The existing untimed retrieval haiku continues
at the player's current position after a bite. Standard and Interactive retain
their original rules. Nibbles pulse the next character and jiggle the bobber.

During a jolt, the fish cursor steps backward one character at a time. The
characters between it and the player are the tension segment. Its color moves
from yellow to red with `gap / equipped lb test`; reaching 1 snaps the line.
The bobber uses the fish cursor's progress while the jolt is active. Backspace
reduces the player's position and tension. Giving more line than the fish took
loses extra progress without creating negative tension. At rest, the fish cursor
rejoins the player and the colored segment clears. Complete the haiku at rest
to land the fish. Wrong letters still require correction.

Word checkpoints clamp the fish cursor to the start of the player's current
word, recalculated after each input. They do not prevent voluntary backspacing.

`FIGHT_PERSONAS` contains a separate weighted table for all eight fish species.
Tap, burst, run, and surge differ in distance, interval and stamina cost.
These are fictional gameplay estimates. Individual temperament ranges from
0.65 to 1.4 and modifies strength, interval, rest and stamina, allowing species
to overlap. Weight increases stamina and pull distance. Every backward step
costs stamina; recovery is one point per three active seconds, capped at the
individual's starting maximum. Step intervals never fall below 300 ms, and
there is no multi-step catch-up after a stalled frame. Suspended fights pause.

Each 6, 10, 15, 20, 30 and 50 lb test starts with a separate 300 m spool.
Light line multiplies contact odds by `sqrt(10 / test)`, bounded to 0.45–1.45.
A snap removes the cast length (30 m times the weather distance multiplier),
capped at the available spool. Other spools are unaffected. Loss is persisted
once at the result transition. Fewer than 5 m blocks casting in Fish Fight;
players can equip another spool. No shop purchases or replenishment exist yet.
Older saves receive the starter spools and default to checkpoints off.

The fight engine is pure and uses the existing game's scheduled rule updates
at 100 ms during combat. It does not write saves or animate DOM elements.
The React challenge renders its cursors, meters, input and release action.
