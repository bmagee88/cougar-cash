import React, { CSSProperties, memo, useId } from 'react';
import { showerRadiant, SkyEvent, SkyEvents as Events, skyRandom } from '../engine/astronomy';
import { artwork } from '../engine/artwork';

const AURORA_ART = artwork('sky/aurora-painted.png');

export const Aurora = memo(function Aurora({ event }: { event: SkyEvent }) {
  return <div data-sky-event="aurora" data-event-id={event.id} className="f-aurora" style={{ opacity: event.strength * .95 }}>
    <img className="f-aurora-curtain" src={AURORA_ART} alt="" aria-hidden="true" draggable={false} decoding="async" width={2172} height={724} />
  </div>;
});

export const MeteorShower = memo(function MeteorShower({ event, angle, shoreline }: { event: SkyEvent; angle: number; shoreline: number }) {
  const id = `meteor-${useId().replace(/:/g, '')}`;
  const radiant = showerRadiant(event, angle, shoreline);
  const trails = Array.from({ length: 5 }, (_, i) => {
    const seed = event.night * 97 + i * 317;
    const x = 60 + skyRandom(seed + 1) * 880, y = 12 + skyRandom(seed + 2) * 125;
    const dx = x - radiant.x * 1000, dy = y - radiant.y * 500, length = Math.max(1, Math.hypot(dx, dy));
    const trail = 60 + skyRandom(seed + 3) * 95;
    return { x, y, endX: x + dx / length * trail, endY: y + dy / length * trail, seed };
  });
  return <svg data-sky-event="meteors" data-event-id={event.id} className="f-meteor-shower" viewBox="0 0 1000 500" preserveAspectRatio="none">
    <defs>{trails.map((p, i) => <linearGradient key={i} id={`${id}-${i}`} gradientUnits="userSpaceOnUse" x1={p.x} y1={p.y} x2={p.endX} y2={p.endY}><stop offset="0" stopColor="#f1efdf" stopOpacity="0" /><stop offset=".85" stopColor="#e7eaf0" stopOpacity=".65" /><stop offset="1" stopColor="#fff9e8" /></linearGradient>)}</defs>
    {trails.map((p, i) => <line key={i} className="f-meteor" x1={p.x} y1={p.y} x2={p.endX} y2={p.endY} stroke={`url(#${id}-${i})`} strokeWidth={.65 + skyRandom(p.seed + 4) * .7} strokeLinecap="round" pathLength="1"
      style={{ '--meteor-period': `${12 + skyRandom(p.seed + 5) * 12}s`, '--meteor-delay': `${-skyRandom(p.seed + 6) * 24}s` } as CSSProperties} />)}
  </svg>;
});

export default function SkyEvents({ events, angle, shoreline }: { events: Events; angle: number; shoreline: number }) {
  return <>{events.aurora && <Aurora event={events.aurora} />}{events.meteors && <MeteorShower event={events.meteors} angle={angle} shoreline={shoreline} />}</>;
}
