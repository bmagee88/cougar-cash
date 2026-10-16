import React, { CSSProperties, memo, useId } from 'react';
import { showerRadiant, SkyEvent, SkyEvents as Events, skyRandom } from '../engine/astronomy';

export const Aurora = memo(function Aurora({ event }: { event: SkyEvent }) {
  const id = `aurora-${useId().replace(/:/g, '')}`;
  return <svg data-sky-event="aurora" data-event-id={event.id} className="f-aurora" viewBox="0 0 1000 500" preserveAspectRatio="none" style={{ opacity: event.strength * .9 }}>
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#bd7f9c" stopOpacity="0" /><stop offset=".2" stopColor="#b5809c" stopOpacity=".12" />
      <stop offset=".62" stopColor="#62c78c" stopOpacity=".3" /><stop offset=".88" stopColor="#79e6a0" stopOpacity=".7" /><stop offset="1" stopColor="#a2ebba" stopOpacity="0" />
    </linearGradient></defs>
    <g className="f-aurora-curtain">
      <path d="M-80 225 C80 190 160 260 280 205 S480 195 580 150 S850 200 1080 120 L1080 20 C850 50 750 85 580 35 S360 130 280 85 S80 100 -80 55Z" fill={`url(#${id})`} />
      {Array.from({ length: 128 }, (_, i) => {
        const x = i * 9 - 60 + skyRandom(i + 19) * 6, bottom = 195 + Math.sin(x * .005) * 20 - x * .055;
        const top = bottom - 65 - skyRandom(i + event.night * 71) * 105;
        return <path key={i} d={`M${x} ${top} Q${x - 15} ${(top + bottom) / 2} ${x - 28} ${bottom}`} fill="none" stroke={`url(#${id})`} strokeWidth={.4 + skyRandom(i + 87) * 2} opacity={.1 + skyRandom(i + 81) * .6} />;
      })}
    </g>
    <path className="f-aurora-distant" d="M-40 180 Q190 110 400 165 T1040 98 L1040 45 Q700 100 400 100 T-40 115Z" fill={`url(#${id})`} />
  </svg>;
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
