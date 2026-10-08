import { FieldSize, InterceptionOption, LockedPlay, PlayerState, Point, TeamId } from "./types";

const EPSILON = 0.000001;

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function distance(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function lerpPoint(a: Point, b: Point, t: number): Point {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

export function pointsEqual(a: Point, b: Point) {
  return Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON;
}

export function projectPointToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared < EPSILON) {
    return {
      point: start,
      t: 0,
      distance: distance(point, start),
      onSegment: pointsEqual(point, start),
    };
  }

  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
  const projected = lerpPoint(start, end, t);

  return {
    point: projected,
    t,
    distance: distance(point, projected),
    onSegment: t >= -EPSILON && t <= 1 + EPSILON,
  };
}

export function computeDefensiveTimeLimitMs(
  offensiveElapsedMs: number,
  passDistance: number,
  distanceFromOrigin: number
) {
  if (passDistance <= EPSILON) return 0;
  return offensiveElapsedMs * clamp(distanceFromOrigin / passDistance, 0, 1);
}

export function createInterceptionOptions(
  players: PlayerState[],
  play: LockedPlay,
  defenseTeam: TeamId
): InterceptionOption[] {
  return players
    .filter((player) => player.team === defenseTeam)
    .map((defender) => {
      const projection = projectPointToSegment(defender.position, play.origin, play.target.point);
      if (!projection.onSegment) return null;

      const distanceFromOrigin = distance(play.origin, projection.point);
      const defensiveTimeLimitMs = computeDefensiveTimeLimitMs(
        play.offenseElapsedMs ?? 0,
        play.distance,
        distanceFromOrigin
      );

      return {
        defenderId: defender.id,
        defenderKey: defender.key,
        defenderTeam: defender.team,
        defenderPosition: defender.position,
        interceptionPoint: projection.point,
        pathT: clamp(projection.t, 0, 1),
        distanceToPath: projection.distance,
        distanceFromOrigin,
        defensiveTimeLimitMs,
      };
    })
    .filter((option): option is InterceptionOption => option !== null)
    .sort((a, b) => a.distanceToPath - b.distanceToPath || a.pathT - b.pathT);
}

export function constrainPhraseAnchor(point: Point, field: FieldSize) {
  return {
    x: clamp(point.x, 10, field.width - 10),
    y: point.y < field.height / 2 ? clamp(point.y + 9, 8, field.height - 6) : clamp(point.y - 9, 6, field.height - 8),
  };
}
