import { clamp, distance } from "./geometry";
import { PlayerState, Point, Rng, SoccerTypingConfig } from "./types";

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function constrainPlayerPosition(point: Point, player: PlayerState, config: SoccerTypingConfig): Point {
  if (player.role === "goalkeeper") {
    const onLeft = player.home.x < config.field.width / 2;
    return {
      x: clamp(point.x, onLeft ? 3.5 : config.field.width - 12, onLeft ? 12 : config.field.width - 3.5),
      y: clamp(point.y, config.field.height / 2 - 7, config.field.height / 2 + 7),
    };
  }
  return {
    x: clamp(point.x, 4, config.field.width - 4),
    y: clamp(point.y, 10, config.field.height - 7),
  };
}

export function repositionOffBallPlayers(
  players: PlayerState[],
  config: SoccerTypingConfig,
  rng: Rng = Math.random
): PlayerState[] {
  const carriers = players.filter((player) => player.hasBall);
  // Place keepers first because their available space is smaller than an outfield player's.
  const offBallPlayers = players.filter((player) => !player.hasBall).sort(
    (a, b) => Number(b.role === "goalkeeper") - Number(a.role === "goalkeeper")
  );

  let bestFormation = new Map(carriers.map((player) => [player.id, player.position]));
  let bestFormationClearance = -1;
  // Retry the whole formation if an early placement blocks a later player's home area.
  for (let layout = 0; layout < 24; layout += 1) {
    const placed = new Map(carriers.map((player) => [player.id, player.position]));
    let formationClearance = Infinity;
    for (const player of offBallPlayers) {
      let best = player.position;
      let bestClearance = -1;
      for (let attempt = 0; attempt < 128; attempt += 1) {
        const sample = layout * 128 + attempt;
        const angle = rng() * Math.PI * 2 + sample * GOLDEN_ANGLE;
        const radius = config.movement.radius * Math.sqrt(0.2 + 0.8 * ((rng() + sample * 0.61803398875) % 1));
        const candidate = constrainPlayerPosition({
          x: player.home.x + Math.cos(angle) * radius,
          y: player.home.y + Math.sin(angle) * radius,
        }, player, config);
        if (distance(candidate, player.position) < 1) continue;

        const clearance = Math.min(...Array.from(placed.values(), (position) => Math.max(
          Math.abs(candidate.x - position.x) / 8.4,
          Math.abs(candidate.y - position.y) / 15.5
        )));
        if (clearance > bestClearance) {
          best = candidate;
          bestClearance = clearance;
        }
        if (clearance >= 1) break;
      }
      placed.set(player.id, best);
      formationClearance = Math.min(formationClearance, bestClearance);
    }
    if (formationClearance > bestFormationClearance) {
      bestFormation = placed;
      bestFormationClearance = formationClearance;
    }
    if (formationClearance >= 1) break;
  }

  return players.map((player) => player.hasBall ? player : {
    ...player,
    position: bestFormation.get(player.id) ?? player.position,
    temporary: undefined,
  });
}
