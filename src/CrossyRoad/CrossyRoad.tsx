import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./CrossyRoad.css";

type LaneKind = "goal" | "grass" | "road" | "river" | "rail";
type Direction = "up" | "down" | "left" | "right";
type PlayerId = "duck" | "chicken";

type MovingThing = {
  id: string;
  start: number;
  length: number;
  emoji: string;
};

type LaneDefinition = {
  row: number;
  kind: LaneKind;
  direction: 1 | -1;
  speed: number;
  things?: MovingThing[];
};

type RuntimeThing = MovingThing & {
  lane: LaneDefinition;
  x: number;
};

type PlayerState = {
  id: PlayerId;
  name: string;
  emoji: string;
  accent: string;
  row: number;
  col: number;
  score: number;
  laps: number;
  squishes: number;
  bestProgress: number;
  stunnedUntil: number;
  facing: Direction;
};

type FeedItem = {
  id: string;
  text: string;
};

type ControlAction = {
  playerId: PlayerId;
  rowDelta: number;
  colDelta: number;
};

const COLS = 13;
const ROWS = 17;
const START_ROW = ROWS - 1;

const PLAYER_START_COLS: Record<PlayerId, number> = {
  duck: 5,
  chicken: 7,
};

const PLAYER_META: Record<PlayerId, Pick<PlayerState, "name" | "emoji" | "accent">> = {
  duck: {
    name: "Duck",
    emoji: "🦆",
    accent: "#facc15",
  },
  chicken: {
    name: "Chicken",
    emoji: "🐔",
    accent: "#fb7185",
  },
};

const LANES: LaneDefinition[] = [
  { row: 0, kind: "goal", direction: 1, speed: 0 },
  {
    row: 1,
    kind: "road",
    direction: -1,
    speed: 2.8,
    things: [
      { id: "r1-a", start: 1, length: 1.1, emoji: "🚕" },
      { id: "r1-b", start: 6.5, length: 1.1, emoji: "🚗" },
      { id: "r1-c", start: 11, length: 1.1, emoji: "🚙" },
    ],
  },
  {
    row: 2,
    kind: "road",
    direction: 1,
    speed: 2.15,
    things: [
      { id: "r2-a", start: -2, length: 1.25, emoji: "🚓" },
      { id: "r2-b", start: 4.5, length: 1.25, emoji: "🚙" },
      { id: "r2-c", start: 9.5, length: 1.25, emoji: "🚕" },
    ],
  },
  {
    row: 3,
    kind: "rail",
    direction: -1,
    speed: 7.8,
    things: [
      { id: "t3-a", start: 3, length: 5.7, emoji: "🚂🚃🚃" },
      { id: "t3-b", start: 15, length: 5.7, emoji: "🚂🚃🚃" },
    ],
  },
  { row: 4, kind: "grass", direction: 1, speed: 0 },
  {
    row: 5,
    kind: "river",
    direction: 1,
    speed: 1.35,
    things: [
      { id: "w5-a", start: -1, length: 3.2, emoji: "🪵🪵🪵" },
      { id: "w5-b", start: 5.8, length: 2.7, emoji: "🪵🪵" },
      { id: "w5-c", start: 10.5, length: 3.1, emoji: "🪵🪵🪵" },
    ],
  },
  {
    row: 6,
    kind: "river",
    direction: -1,
    speed: 1.75,
    things: [
      { id: "w6-a", start: 1.2, length: 2.8, emoji: "🪵🪵" },
      { id: "w6-b", start: 7.5, length: 3.6, emoji: "🪵🪵🪵" },
      { id: "w6-c", start: 14, length: 2.4, emoji: "🪵🪵" },
    ],
  },
  {
    row: 7,
    kind: "river",
    direction: 1,
    speed: 1.05,
    things: [
      { id: "w7-a", start: 0, length: 3.8, emoji: "🪵🪵🪵" },
      { id: "w7-b", start: 8.2, length: 3.4, emoji: "🪵🪵🪵" },
    ],
  },
  { row: 8, kind: "grass", direction: 1, speed: 0 },
  {
    row: 9,
    kind: "road",
    direction: 1,
    speed: 2.45,
    things: [
      { id: "r9-a", start: -2, length: 1.2, emoji: "🚗" },
      { id: "r9-b", start: 3.25, length: 1.2, emoji: "🚕" },
      { id: "r9-c", start: 8.5, length: 1.2, emoji: "🚙" },
    ],
  },
  {
    row: 10,
    kind: "rail",
    direction: 1,
    speed: 6.7,
    things: [
      { id: "t10-a", start: -5, length: 6.4, emoji: "🚂🚃🚃🚃" },
      { id: "t10-b", start: 11, length: 6.4, emoji: "🚂🚃🚃🚃" },
    ],
  },
  {
    row: 11,
    kind: "road",
    direction: -1,
    speed: 1.9,
    things: [
      { id: "r11-a", start: 0.5, length: 1.25, emoji: "🚕" },
      { id: "r11-b", start: 6.75, length: 1.25, emoji: "🚙" },
      { id: "r11-c", start: 12, length: 1.25, emoji: "🚗" },
    ],
  },
  { row: 12, kind: "grass", direction: 1, speed: 0 },
  {
    row: 13,
    kind: "river",
    direction: -1,
    speed: 1.2,
    things: [
      { id: "w13-a", start: 2, length: 3.25, emoji: "🪵🪵🪵" },
      { id: "w13-b", start: 9.25, length: 3.25, emoji: "🪵🪵🪵" },
      { id: "w13-c", start: 15.5, length: 2.7, emoji: "🪵🪵" },
    ],
  },
  {
    row: 14,
    kind: "road",
    direction: 1,
    speed: 2.7,
    things: [
      { id: "r14-a", start: -1, length: 1.15, emoji: "🚓" },
      { id: "r14-b", start: 4, length: 1.15, emoji: "🚗" },
      { id: "r14-c", start: 9.25, length: 1.15, emoji: "🚕" },
    ],
  },
  {
    row: 15,
    kind: "road",
    direction: -1,
    speed: 2.25,
    things: [
      { id: "r15-a", start: 2, length: 1.2, emoji: "🚙" },
      { id: "r15-b", start: 7.25, length: 1.2, emoji: "🚗" },
      { id: "r15-c", start: 12.5, length: 1.2, emoji: "🚕" },
    ],
  },
  { row: 16, kind: "grass", direction: 1, speed: 0 },
];

const LANE_BY_ROW = new Map(LANES.map((lane) => [lane.row, lane]));

const KEYBOARD_CONTROLS: Record<string, ControlAction> = {
  w: { playerId: "duck", rowDelta: -1, colDelta: 0 },
  a: { playerId: "duck", rowDelta: 0, colDelta: -1 },
  s: { playerId: "duck", rowDelta: 1, colDelta: 0 },
  d: { playerId: "duck", rowDelta: 0, colDelta: 1 },
  arrowup: { playerId: "chicken", rowDelta: -1, colDelta: 0 },
  arrowleft: { playerId: "chicken", rowDelta: 0, colDelta: -1 },
  arrowdown: { playerId: "chicken", rowDelta: 1, colDelta: 0 },
  arrowright: { playerId: "chicken", rowDelta: 0, colDelta: 1 },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function positiveModulo(value: number, modulo: number) {
  return ((value % modulo) + modulo) % modulo;
}

function getLane(row: number) {
  return LANE_BY_ROW.get(row) ?? LANES[LANES.length - 1];
}

function getFacing(rowDelta: number, colDelta: number): Direction {
  if (rowDelta < 0) return "up";
  if (rowDelta > 0) return "down";
  if (colDelta < 0) return "left";
  return "right";
}

function getMovingX(thing: MovingThing, lane: LaneDefinition, seconds: number) {
  const loopWidth = COLS + thing.length + 6;
  return positiveModulo(thing.start + lane.direction * lane.speed * seconds + 3, loopWidth) - 3;
}

function getMovingThingsForLane(lane: LaneDefinition, seconds: number): RuntimeThing[] {
  if (!lane.things) return [];
  return lane.things.map((thing) => ({
    ...thing,
    lane,
    x: getMovingX(thing, lane, seconds),
  }));
}

function overlapsThing(playerCol: number, thing: RuntimeThing, margin = 0.18) {
  const playerCenter = playerCol + 0.5;
  return playerCenter >= thing.x - margin && playerCenter <= thing.x + thing.length + margin;
}

function isOnLog(playerCol: number, thing: RuntimeThing) {
  const playerCenter = playerCol + 0.5;
  return playerCenter >= thing.x + 0.06 && playerCenter <= thing.x + thing.length - 0.06;
}

function makeInitialPlayers(): PlayerState[] {
  return (["duck", "chicken"] as PlayerId[]).map((id) => ({
    id,
    ...PLAYER_META[id],
    row: START_ROW,
    col: PLAYER_START_COLS[id],
    score: 0,
    laps: 0,
    squishes: 0,
    bestProgress: 0,
    stunnedUntil: 0,
    facing: "up",
  }));
}

function cellTokenFor(lane: LaneDefinition, col: number) {
  const seed = (lane.row * 19 + col * 11) % 17;
  if (lane.kind === "goal") return seed % 3 === 0 ? "🏁" : seed % 7 === 0 ? "⭐" : "";
  if (lane.kind === "grass") return seed % 6 === 0 ? "🌱" : seed % 11 === 0 ? "🌼" : "";
  if (lane.kind === "river") return seed % 8 === 0 ? "💧" : "";
  if (lane.kind === "rail") return seed % 5 === 0 ? "🚧" : "";
  return "";
}

function restartPlayer(player: PlayerState, timestamp: number, messages: string[], text: string) {
  messages.push(text);
  return {
    ...player,
    row: START_ROW,
    col: PLAYER_START_COLS[player.id],
    squishes: player.squishes + 1,
    stunnedUntil: timestamp + 850,
    facing: "up" as Direction,
  };
}

function resolvePlayers(
  players: PlayerState[],
  seconds: number,
  timestamp: number,
  dt: number,
  messages: string[],
) {
  return players.map((player) => {
    if (timestamp < player.stunnedUntil) return player;

    const lane = getLane(Math.round(player.row));

    if (lane.kind === "goal") {
      messages.push(`${player.emoji} ${player.name} crossed the finish.`);
      return {
        ...player,
        row: START_ROW,
        col: PLAYER_START_COLS[player.id],
        score: player.score + 75,
        laps: player.laps + 1,
        stunnedUntil: timestamp + 650,
        facing: "up" as Direction,
      };
    }

    if (lane.kind === "river") {
      const log = getMovingThingsForLane(lane, seconds).find((thing) => isOnLog(player.col, thing));
      if (!log) {
        return restartPlayer(player, timestamp, messages, `${player.emoji} ${player.name} splashed.`);
      }

      const carriedCol = player.col + lane.direction * lane.speed * dt;
      if (carriedCol < -0.45 || carriedCol > COLS - 0.55) {
        return restartPlayer(player, timestamp, messages, `${player.emoji} ${player.name} rode a log off the edge.`);
      }

      return {
        ...player,
        col: carriedCol,
      };
    }

    if (lane.kind === "road" || lane.kind === "rail") {
      const hazard = getMovingThingsForLane(lane, seconds).find((thing) => overlapsThing(player.col, thing));
      if (hazard) {
        const message =
          lane.kind === "rail"
            ? `${player.emoji} ${player.name} met the train.`
            : `${player.emoji} ${player.name} got squished.`;
        return restartPlayer(player, timestamp, messages, message);
      }
    }

    return player;
  });
}

function DPad({
  player,
  running,
  onMove,
}: {
  player: PlayerState;
  running: boolean;
  onMove: (playerId: PlayerId, rowDelta: number, colDelta: number) => void;
}) {
  return (
    <div className="crossy-pad" style={{ "--player-accent": player.accent } as React.CSSProperties}>
      <div className="crossy-pad-avatar" aria-hidden="true">
        {player.emoji}
      </div>
      <button type="button" disabled={!running} aria-label={`${player.name} up`} onClick={() => onMove(player.id, -1, 0)}>
        ↑
      </button>
      <button type="button" disabled={!running} aria-label={`${player.name} left`} onClick={() => onMove(player.id, 0, -1)}>
        ←
      </button>
      <button type="button" disabled={!running} aria-label={`${player.name} down`} onClick={() => onMove(player.id, 1, 0)}>
        ↓
      </button>
      <button type="button" disabled={!running} aria-label={`${player.name} right`} onClick={() => onMove(player.id, 0, 1)}>
        →
      </button>
    </div>
  );
}

export default function CrossyRoad() {
  const [players, setPlayers] = useState<PlayerState[]>(() => makeInitialPlayers());
  const [feed, setFeed] = useState<FeedItem[]>([{ id: "ready", text: "🟩 Course loaded." }]);
  const [running, setRunning] = useState(true);
  const [gameSeconds, setGameSeconds] = useState(0);

  const playersRef = useRef(players);
  const runningRef = useRef(running);
  const secondsRef = useRef(0);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  const appendFeed = useCallback((messages: string[]) => {
    if (messages.length === 0) return;
    setFeed((current) => [
      ...messages.map((text, index) => ({
        id: `${Date.now()}-${index}-${Math.random()}`,
        text,
      })),
      ...current,
    ].slice(0, 5));
  }, []);

  const movePlayer = useCallback(
    (playerId: PlayerId, rowDelta: number, colDelta: number) => {
      if (!runningRef.current) return;
      const timestamp = performance.now();
      const nextPlayers = playersRef.current.map((player) => {
        if (player.id !== playerId || timestamp < player.stunnedUntil) return player;

        const nextRow = clamp(Math.round(player.row) + rowDelta, 0, START_ROW);
        const nextCol = clamp(Math.round(player.col) + colDelta, 0, COLS - 1);
        const progress = START_ROW - nextRow;
        const progressGain = Math.max(0, progress - player.bestProgress);

        return {
          ...player,
          row: nextRow,
          col: nextCol,
          score: player.score + progressGain * 5,
          bestProgress: Math.max(player.bestProgress, progress),
          facing: getFacing(rowDelta, colDelta),
        };
      });

      playersRef.current = nextPlayers;
      setPlayers(nextPlayers);
    },
    [],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const control = KEYBOARD_CONTROLS[event.key.toLowerCase()];
      if (!control) return;
      event.preventDefault();
      movePlayer(control.playerId, control.rowDelta, control.colDelta);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [movePlayer]);

  useEffect(() => {
    let frame = 0;
    let lastTimestamp = performance.now();

    const tick = (timestamp: number) => {
      const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.06);
      lastTimestamp = timestamp;

      if (runningRef.current) {
        secondsRef.current += dt;
        const messages: string[] = [];
        const nextPlayers = resolvePlayers(playersRef.current, secondsRef.current, timestamp, dt, messages);

        playersRef.current = nextPlayers;
        setPlayers(nextPlayers);
        setGameSeconds(secondsRef.current);
        appendFeed(messages);
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [appendFeed]);

  const movingThings = useMemo(
    () => LANES.flatMap((lane) => getMovingThingsForLane(lane, gameSeconds)),
    [gameSeconds],
  );

  const resetRun = useCallback(() => {
    const nextPlayers = makeInitialPlayers();
    playersRef.current = nextPlayers;
    secondsRef.current = 0;
    setPlayers(nextPlayers);
    setGameSeconds(0);
    setFeed([{ id: "reset", text: "🟩 New run ready." }]);
    setRunning(true);
  }, []);

  return (
    <main className="crossy-road-shell">
      <header className="crossy-topbar">
        <div>
          <p className="crossy-eyebrow">Emoji prototype</p>
          <h1>Crossy Road</h1>
        </div>
        <div className="crossy-actions">
          <button type="button" onClick={() => setRunning((value) => !value)}>
            {running ? "Pause" : "Play"}
          </button>
          <button type="button" onClick={resetRun}>
            New Run
          </button>
        </div>
      </header>

      <section className="crossy-layout">
        <div className="crossy-board-section">
          <div className="crossy-racer-strip">
            {players.map((player) => (
              <div
                key={player.id}
                className="crossy-racer"
                style={{ "--player-accent": player.accent } as React.CSSProperties}
              >
                <span className="crossy-racer-emoji" aria-hidden="true">
                  {player.emoji}
                </span>
                <span>{player.name}</span>
                <strong>{player.score}</strong>
                <span>🏁 {player.laps}</span>
                <span>💥 {player.squishes}</span>
              </div>
            ))}
          </div>

          <div className="crossy-board-wrap">
            <div
              className="crossy-board"
              style={
                {
                  "--crossy-cols": String(COLS),
                  "--crossy-rows": String(ROWS),
                } as React.CSSProperties
              }
              aria-label="Crossy Road emoji game board"
            >
              {LANES.map((lane) => (
                <div
                  key={lane.row}
                  className={`crossy-lane crossy-lane--${lane.kind}`}
                  style={{ top: `calc(${lane.row} * var(--crossy-cell))` }}
                >
                  {Array.from({ length: COLS }, (_, col) => (
                    <div key={`${lane.row}-${col}`} className="crossy-cell">
                      <span aria-hidden="true">{cellTokenFor(lane, col)}</span>
                    </div>
                  ))}
                </div>
              ))}

              {movingThings.map((thing) => (
                <div
                  key={`${thing.lane.row}-${thing.id}`}
                  className={`crossy-moving crossy-moving--${thing.lane.kind}`}
                  style={{
                    left: `calc(${thing.x} * var(--crossy-cell))`,
                    top: `calc(${thing.lane.row} * var(--crossy-cell) + 4px)`,
                    width: `calc(${thing.length} * var(--crossy-cell))`,
                  }}
                  aria-hidden="true"
                >
                  <span>{thing.emoji}</span>
                </div>
              ))}

              {players.map((player) => {
                const stunned = performance.now() < player.stunnedUntil;
                return (
                  <div
                    key={player.id}
                    className={`crossy-player crossy-player--${player.facing}${stunned ? " is-stunned" : ""}`}
                    style={
                      {
                        "--player-accent": player.accent,
                        left: `calc(${player.col} * var(--crossy-cell))`,
                        top: `calc(${player.row} * var(--crossy-cell))`,
                      } as React.CSSProperties
                    }
                    aria-label={player.name}
                  >
                    <span aria-hidden="true">{player.emoji}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="crossy-side-panel">
          <div className="crossy-feed" aria-live="polite">
            {feed.map((item) => (
              <div key={item.id}>{item.text}</div>
            ))}
          </div>

          <div className="crossy-pads">
            {players.map((player) => (
              <DPad key={player.id} player={player} running={running} onMove={movePlayer} />
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
