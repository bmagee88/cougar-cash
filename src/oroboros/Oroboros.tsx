// import * as React from "react";
import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

/**
 * Dragon Head — circular board (0..99). Multiplayer.
 * Rules implemented from Brian's spec (2025‑09‑30):
 * - Dragon moves 2d4 at the start of each round.
 * - Each player rolls a d8 and a d10 and moves forward sum.
 * - Double 1s => instant WIN → retire character & auto‑create new.
 * - Any other doubles => player must add a custom Life Event (free text).
 * - A player also WINS if their move overtakes the dragon head (passes it forward along the track). They keep playing their new character.
 * - A player LOSES if the dragon head overtakes them during the dragon movement.
 * - If exactly one die shows 1 ("only a 1"), downgrade THAT die to the next lower step (d10→d8→d6→d4→d2→d1). d1 is the floor.
 * - Landing on any multiple of 25 (25,50,75,0) levels BOTH dice up one step each (ceiling d12).
 * - Each character tracks turns played.
 * - Max die size is d12. Default starting dice: d8 and d10.
 *
 * Notes:
 * - "Overtake" detection uses modular arc crossing on [0..99] (see crossesForward()).
 * - Retiring creates a new character for the same player slot with fresh dice (d8,d10), pos preserved at their last tile (can be changed if desired).
 */

// ---- Types & utilities ------------------------------------------------------

type DieStep = 1 | 2 | 4 | 6 | 8 | 10 | 12;
const DIE_STEPS: DieStep[] = [1, 2, 4, 6, 8, 10, 12];
// const START_DICE: [DieStep, DieStep] = [8, 10];
const MAX_POS = 100; // 0..99 inclusive ring length

type Settings = {
  downgradeOnSingleOne: boolean;
  playerStartA: DieStep;
  playerStartB: DieStep;
  dragonDieA: DieStep;
  dragonDieB: DieStep;
  lifeEventsEnabled: boolean;
};

const randInt = (n: number) => Math.floor(Math.random() * n) + 1; // 1..n
const wrap = (p: number) => ((p % MAX_POS) + MAX_POS) % MAX_POS;

function nextStepUp(s: DieStep): DieStep {
  const i = DIE_STEPS.indexOf(s);
  return DIE_STEPS[Math.min(DIE_STEPS.length - 1, i + 1)] as DieStep;
}
function nextStepDown(s: DieStep): DieStep {
  const i = DIE_STEPS.indexOf(s);
  return DIE_STEPS[Math.max(0, i - 1)] as DieStep;
}

function crossesForward(aStart: number, aEnd: number, bPos: number): boolean {
  // Does the forward move from aStart -> aEnd (mod 100, excluding start, including end)
  // pass over bPos at any point?
  const end = wrap(aEnd);
  const start = wrap(aStart);
  const b = wrap(bPos);
  if (start === end) return false;
  if (end > start) {
    return b > start && b <= end;
  } else {
    // wrapped around zero
    return b > start || b <= end;
  }
}

function isLevelUpTile(pos: number): boolean {
  const p = wrap(pos);
  return p % 25 === 0 && p !== 0 ? true : p === 0; // 0,25,50,75
}

const aheadOf = (pos: number, n: number) => wrap(pos + n);

// ---- Game state -------------------------------------------------------------

type Character = {
  id: string;
  name: string;
  turns: number;
  lifeEvents: string[];
  dieA: DieStep; // usually small die
  dieB: DieStep; // usually big die
  pos: number; // 0..99
  retired: boolean; // won or lost → retired
  retiredReason?: "win" | "loss" | "double-ones";
};

type Player = {
  id: string;
  label: string;
  current: Character; // active character
  graveyard: Character[]; // retired chars (history)
};

type GameState = {
  round: number;
  dragonPos: number; // 0..99
  players: Player[];
  log: string[];
};

const uid = (p = "id") => `${p}_${Math.random().toString(36).slice(2, 9)}`;

function makeNewCharacter(
  name: string,
  pos = 18,
  dieA: DieStep,
  dieB: DieStep
): Character {
  return {
    id: uid("char"),
    name,
    turns: 0,
    lifeEvents: [],
    dieA,
    dieB,
    pos: wrap(pos),
    retired: false,
  };
}

function makeDefaultPlayers(n: number, dieA: DieStep, dieB: DieStep): Player[] {
  return Array.from({ length: n }).map((_, i) => ({
    id: uid("p"),
    label: `P${i + 1}`,
    current: makeNewCharacter(`P${i + 1}`, 18, dieA, dieB),
    graveyard: [],
  }));
}

// ---- Root component ---------------------------------------------------------

export default function Oroboros() {
  const [playerCount, setPlayerCount] = useState(3);
  const [settings, setSettings] = useState<Settings>({
    downgradeOnSingleOne: true,
    playerStartA: 8,
    playerStartB: 10,
    dragonDieA: 4,
    dragonDieB: 4,
    lifeEventsEnabled: true,
  });

  const [state, setState] = useState<GameState>(() => ({
    round: 0,
    dragonPos: 0,
    players: makeDefaultPlayers(3, 8, 10),
    log: ["Game created."],
  }));

  const [pendingLifeEvent, setPendingLifeEvent] = useState<{
    playerIdx: number;
    text: string;
  } | null>(null);

  const alivePlayers = useMemo(
    () => state.players.map((p) => p.current).filter((c) => !c.retired).length,
    [state.players]
  );

  // Reset & player count controls
  const resetGame = (count: number) => {
    setState({
      round: 0,
      dragonPos: 0,
      players: makeDefaultPlayers(
        count,
        settings.playerStartA,
        settings.playerStartB
      ),
      log: [`New game: ${count} player${count === 1 ? "" : "s"}.`],
    });
  };

  // Life event dialog handlers
  const confirmLifeEvent = () => {
    if (!pendingLifeEvent) return;
    setState((s) => {
      const players = [...s.players];
      const p = { ...players[pendingLifeEvent.playerIdx] };
      const c = { ...p.current };
      c.lifeEvents = [
        ...c.lifeEvents,
        pendingLifeEvent.text.trim() || "(unnamed event)",
      ];
      p.current = c;
      players[pendingLifeEvent.playerIdx] = p;
      return {
        ...s,
        players,
        log: [
          ...s.log,
          `${p.label} logged a Life Event: "${pendingLifeEvent.text}"`,
        ],
      };
    });
    setPendingLifeEvent(null);
  };

  const cancelLifeEvent = () => setPendingLifeEvent(null);

  // Core round progression
const playRound = () => {
  setState((s0) => {
    let s = { ...s0 } as GameState;
    const roundStart = s.round + 1;
    let dragonSkipped = false;

    // optional: log divider
    s.log.push(`=== ROUND ${roundStart} START ===`);

    // 1) PLAYERS MOVE FIRST
    const playersPostTurns: Player[] = s.players.map((pl, idx) => {
      let p = { ...pl };
      let c = { ...p.current };
      if (c.retired) {
        s.log.push(`--- TURN END — ${p.label} (skipped) ---`);
        return p;
      }

      const rA = randInt(c.dieA);
      const rB = randInt(c.dieB);
      const rolledText = `${rA} + ${rB}`;

      // Double 1s => WIN, retire, respawn at dragon+18
      if (rA === 1 && rB === 1) {
        const retired: Character = {
          ...c,
          retired: true,
          retiredReason: "double-ones",
        };
        const spawn = aheadOf(s.dragonPos, 18);
        p = {
          ...p,
          current: makeNewCharacter(
            p.label,
            spawn,
            settings.playerStartA,
            settings.playerStartB
          ),
          graveyard: [retired, ...p.graveyard],
        };
        s.log.push(
          `${p.label} rolled DOUBLE ONES! — WIN (retired). Respawn @ ${spawn}.`
        );
        s.log.push(`--- TURN END — ${p.label} ---`);
        return p;
      }

      // Other doubles => Life Event (only if enabled)
      if (rA === rB && !(rA === 1 && rB === 1)) {
        if (settings.lifeEventsEnabled) {
          setTimeout(
            () => setPendingLifeEvent({ playerIdx: idx, text: "" }),
            0
          );
          s.log.push(
            `${p.label} rolled doubles (${rA},${rB}) — add a Life Event.`
          );
        } else {
          s.log.push(
            `${p.label} rolled doubles (${rA},${rB}) — life events OFF.`
          );
        }
      }

      // “Only a 1” => downgrade that die (optional)
      if (settings.downgradeOnSingleOne && (rA === 1) !== (rB === 1)) {
        if (rA === 1) c.dieA = nextStepDown(c.dieA);
        if (rB === 1) c.dieB = nextStepDown(c.dieB);
        s.log.push(
          `${p.label} rolled a single 1 → die downgraded (now d${c.dieA} & d${c.dieB}).`
        );
      }

      const startPos = c.pos;
      const endPos = wrap(startPos + rA + rB);
      c.turns += 1;

      // If player passes the dragon: WIN but KEEP PLAYING (no retire/respawn)
      if (crossesForward(startPos, endPos, s.dragonPos)) {
        // NEW: mark that dragon skips its move this round
        dragonSkipped = true;

        c.pos = endPos;
        s.log.push(
          `${p.label} moves ${rolledText} to ${endPos} and OVERTAKES the dragon — WIN (keeps playing).`
        );
      } else {
        // Normal move
        c.pos = endPos;
        s.log.push(`${p.label} moves ${rolledText} to ${endPos}.`);
      }

      // 100-turn milestone WIN (keeps playing)
      if (c.turns === 100) {
        s.log.push(
          `${p.label} reached 100 turns — WIN milestone! (keeps playing).`
        );
      }

      // Level-up on 0/25/50/75
      if (isLevelUpTile(c.pos)) {
        const beforeA = c.dieA,
          beforeB = c.dieB;
        c.dieA = nextStepUp(c.dieA);
        c.dieB = nextStepUp(c.dieB);
        if (c.dieA !== beforeA || c.dieB !== beforeB) {
          s.log.push(
            `${p.label} hit a Level-Up tile! Dice → d${c.dieA} & d${c.dieB}.`
          );
        }
      }

      p.current = c;
      s.log.push(`--- TURN END — ${p.label} ---`);
      return p;
    });

    s = { ...s, players: playersPostTurns };

    // 2) DRAGON MOVES AFTER PLAYERS — unless any player overtook it
    if (dragonSkipped) {
      s = {
        ...s,
        round: roundStart,
        // dragonPos unchanged
        log: [
          ...s.log,
          `Round ${roundStart}: Dragon skips its move (a player overtook it).`,
          `=== ROUND ${roundStart} END ===`,
        ],
      };
      return s;
    }

    // Normal dragon move
    const before = s.dragonPos;
    const dA = randInt(settings.dragonDieA);
    const dB = randInt(settings.dragonDieB);
    const dragonMove = dA + dB;
    const after = wrap(before + dragonMove);

    // Any player overtaken by the dragon => LOSS, retire, respawn at dragon+18
    const newPlayersAfterDragon = s.players.map((pl) => {
      const c0 = pl.current;
      if (!c0.retired && crossesForward(before, after, c0.pos)) {
        const retiredChar: Character = {
          ...c0,
          retired: true,
          retiredReason: "loss",
        };
        const spawn = aheadOf(after, 18);
        const replacement = makeNewCharacter(
          pl.label,
          spawn,
          settings.playerStartA,
          settings.playerStartB
        );
        s.log.push(
          `${pl.label} was overtaken by the dragon — LOSS (retired). Respawn @ ${spawn}.`
        );
        return {
          ...pl,
          current: replacement,
          graveyard: [retiredChar, ...pl.graveyard],
        };
      }
      return pl;
    });

    s = {
      ...s,
      round: roundStart,
      dragonPos: after,
      players: newPlayersAfterDragon,
      log: [
        ...s.log,
        `Round ${roundStart}: Dragon moves ${dA}+${dB} = ${dragonMove} to ${after}.`,
        `=== ROUND ${roundStart} END ===`,
      ],
    };

    return s;
  });
};


  // UI helpers
  const tokenColor = (i: number) => {
    const colors = [
      "#1976d2",
      "#9c27b0",
      "#2e7d32",
      "#ef6c00",
      "#d32f2f",
      "#455a64",
    ];
    return colors[i % colors.length];
  };

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h5" fontWeight={700}>
          🐲 Dragon Head
        </Typography>
        <Stack direction="row" spacing={1}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="pcnt">Players</InputLabel>
            <Select
              labelId="pcnt"
              label="Players"
              value={playerCount}
              onChange={(e) => setPlayerCount(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <MenuItem key={n} value={n}>
                  {n}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="psa">Player die A</InputLabel>
            <Select
              labelId="psa"
              label="Player die A"
              value={settings.playerStartA}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  playerStartA: e.target.value as DieStep,
                }))
              }
            >
              {DIE_STEPS.map((n) => (
                <MenuItem key={n} value={n}>
                  d{n}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="psb">Player die B</InputLabel>
            <Select
              labelId="psb"
              label="Player die B"
              value={settings.playerStartB}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  playerStartB: e.target.value as DieStep,
                }))
              }
            >
              {DIE_STEPS.map((n) => (
                <MenuItem key={n} value={n}>
                  d{n}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="dda">Dragon die A</InputLabel>
            <Select
              labelId="dda"
              label="Dragon die A"
              value={settings.dragonDieA}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  dragonDieA: e.target.value as DieStep,
                }))
              }
            >
              {DIE_STEPS.map((n) => (
                <MenuItem key={n} value={n}>
                  d{n}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="ddb">Dragon die B</InputLabel>
            <Select
              labelId="ddb"
              label="Dragon die B"
              value={settings.dragonDieB}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  dragonDieB: e.target.value as DieStep,
                }))
              }
            >
              {DIE_STEPS.map((n) => (
                <MenuItem key={n} value={n}>
                  d{n}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="downgrade">Downgrade on single 1</InputLabel>
            <Select
              labelId="downgrade"
              label="Downgrade on single 1"
              value={settings.downgradeOnSingleOne ? "on" : "off"}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  downgradeOnSingleOne: e.target.value === "on",
                }))
              }
            >
              <MenuItem value="on">On</MenuItem>
              <MenuItem value="off">Off</MenuItem>
            </Select>
          </FormControl>
          <FormControlLabel
            control={
              <Switch
                checked={settings.lifeEventsEnabled}
                onChange={(_, checked) =>
                  setSettings((s) => {
                    // if turning OFF while a dialog is open, close it
                    if (!checked) setPendingLifeEvent(null);
                    return { ...s, lifeEventsEnabled: checked };
                  })
                }
              />
            }
            label="Life Events"
          />

          <Tooltip title="Reset game with chosen player count">
            <IconButton onClick={() => resetGame(playerCount)}>
              <RestartAltIcon />
            </IconButton>
          </Tooltip>
          <Button variant="contained" onClick={playRound}>
            Play Round
          </Button>
        </Stack>
      </Stack>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        {/* Board */}
        <Card sx={{ flex: 2 }}>
          <CardHeader
            title={`Round ${state.round} • Dragon at ${state.dragonPos} • Active players: ${alivePlayers}`}
          />
          <CardContent>
            <Board
              dragon={state.dragonPos}
              players={state.players.map((p) => ({
                label: p.label,
                pos: p.current.pos,
              }))}
            />
            <Divider sx={{ my: 2 }} />
            <Stack direction="row" spacing={2} flexWrap="wrap">
              {state.players.map((p, idx) => (
                <Chip
                  key={p.id}
                  sx={{ bgcolor: tokenColor(idx), color: "#fff" }}
                  label={`${p.label}: @${p.current.pos} • d${p.current.dieA}+d${p.current.dieB} • turns ${p.current.turns}`}
                />
              ))}
            </Stack>
          </CardContent>
        </Card>

        {/* Sidebar: players & history */}
        <Stack spacing={2} sx={{ flex: 1 }}>
          {state.players.map((p, idx) => (
            <Card key={p.id}>
              <CardHeader
                title={`${p.label} — ${p.current.name}`}
                subheader={`d${p.current.dieA} + d${p.current.dieB} • pos ${p.current.pos} • turns ${p.current.turns}`}
              />
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  Graveyard ({p.graveyard.length})
                </Typography>
                <Stack spacing={1}>
                  {p.graveyard.slice(0, 4).map((g) => (
                    <Typography key={g.id} variant="caption">
                      {g.name} — {g.retiredReason} — turns {g.turns}
                    </Typography>
                  ))}
                  {p.graveyard.length === 0 && (
                    <Typography variant="caption" color="text.secondary">
                      No retired characters yet.
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>
          ))}

          {/* Log */}
          <Card>
            <CardHeader title="Event Log" />
            <CardContent>
              <Stack spacing={0.75} sx={{ maxHeight: 300, overflow: "auto" }}>
                {[...state.log].reverse().map((t, i) => (
                  <Typography key={i} variant="body2">
                    • {t}
                  </Typography>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Stack>

      {/* Life Event dialog */}
      <Dialog
        open={!!pendingLifeEvent}
        onClose={cancelLifeEvent}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Add a Life Event</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Life event description"
            placeholder="Won a village pie‑eating contest"
            value={pendingLifeEvent?.text || ""}
            onChange={(e) =>
              setPendingLifeEvent((p) =>
                p ? { ...p, text: e.target.value } : p
              )
            }
          />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1, display: "block" }}
          >
            Triggered by rolling doubles (except double 1s).
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelLifeEvent}>Cancel</Button>
          <Button variant="contained" onClick={confirmLifeEvent}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

// ---- Board viz --------------------------------------------------------------

type BoardProps = {
  dragon: number;
  players: { label: string; pos: number }[];
};

function Board({ dragon, players }: BoardProps) {
  const size = 420; // board design size (circle math uses this)
  const padding = 25; // half of the extra frame you added (50 / 2)
  const svgSize = size + 2 * padding;

  // keep the board radius the same so the circle doesn't stretch
  const r = size / 2 - 20;

  // ⬇️ center everything in the expanded SVG
  const center = { x: svgSize / 2, y: svgSize / 2 };

  const tiles = Array.from({ length: 100 }).map((_, i) => i);

  const toXY = (idx: number) => {
    const angle = (idx / 100) * 2 * Math.PI - Math.PI / 2;
    return {
      x: center.x + r * Math.cos(angle),
      y: center.y + r * Math.sin(angle),
    };
  };

  return (
    <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
      {/* ⬇️ use svgSize here */}
      <svg width={svgSize} height={svgSize}>
        <circle
          cx={center.x}
          cy={center.y}
          r={r}
          fill="#fafafa"
          stroke="#ddd"
          strokeWidth={2}
        />
        {/* ticks */}
        {tiles.map((i) => {
          const a = (i / 100) * 2 * Math.PI - Math.PI / 2;
          const inner = r - (i % 5 === 0 ? 18 : 8);
          const outer = r;
          const x1 = center.x + inner * Math.cos(a);
          const y1 = center.y + inner * Math.sin(a);
          const x2 = center.x + outer * Math.cos(a);
          const y2 = center.y + outer * Math.sin(a);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#ccc"
              strokeWidth={i % 25 === 0 ? 2 : 1}
            />
          );
        })}
        {/* /* labels for 0/25/50/75 */}
        {[0, 25, 50, 75].map((i) => {
          const a = (i / 100) * 2 * Math.PI - Math.PI / 2; // same angle as ticks
          const labelOffset = 20; // tweak 18–24 to taste
          const x = center.x + (r + labelOffset) * Math.cos(a);
          const y = center.y + (r + labelOffset) * Math.sin(a);
          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={12}
              fill="#666"
            >
              {i}
            </text>
          );
        })}
        {/* Dragon token */}
        {(() => {
          const { x, y } = toXY(dragon);
          return (
            <g transform={`translate(${x},${y})`}>
              <circle r={10} fill="#d32f2f" stroke="#b71c1c" strokeWidth={2} />
              <text x={0} y={3} textAnchor="middle" fontSize={10} fill="#fff">
                DR
              </text>
            </g>
          );
        })()}
        {/* Player tokens */}
        {players.map((p, idx) => {
          const { x, y } = toXY(p.pos);
          const off = 20 + idx * 16;
          const angle = (p.pos / 100) * 2 * Math.PI - Math.PI / 2;
          const xOff = x + (off - 20) * Math.cos(angle);
          const yOff = y + (off - 20) * Math.sin(angle);
          const color = [
            "#1976d2",
            "#9c27b0",
            "#2e7d32",
            "#ef6c00",
            "#d32f2f",
            "#455a64",
          ][idx % 6];
          return (
            <g key={idx} transform={`translate(${xOff},${yOff})`}>
              <circle r={9} fill={color} stroke="#00000020" strokeWidth={1} />
              <text x={0} y={3} textAnchor="middle" fontSize={10} fill="#fff">
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
    </Box>
  );
}
