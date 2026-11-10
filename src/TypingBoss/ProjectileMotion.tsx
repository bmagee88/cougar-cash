import React, { useEffect, useRef, useState } from "react";
import { TypingBossProjectile } from "./types";
import "./continuousBattle.css";

export function ProjectileMotion({ projectile, from, to, art, serverOffset, labelOffset = 0, showName = false, hitPoint }: {
  projectile: TypingBossProjectile; from: { x: number; y: number }; to: { x: number; y: number };
  art: { src: string; size: number; glow: string } | null; serverOffset: number; labelOffset?: number; showName?: boolean;
  hitPoint?: { x: number; y: number };
}) {
  const flight = useRef<HTMLDivElement>(null);
  const offset = useRef(serverOffset);
  const [, redraw] = useState(0);
  const now = Date.now() + offset.current;
  const flying = projectile.result === "pending" && now < projectile.impactAt;
  const visibleHit = projectile.resolvedAt && now - projectile.resolvedAt < 2200;

  useEffect(() => {
    const elapsed = Math.max(0, Date.now() + offset.current - projectile.startedAt);
    const duration = projectile.impactAt - projectile.startedAt;
    const animation = flight.current?.animate?.([
      { transform: `translate(${from.x}%, ${from.y}%)` },
      { transform: `translate(${to.x}%, ${to.y}%)` },
    ], { duration, delay: -Math.min(duration, elapsed), easing: "cubic-bezier(.2,.6,.4,1)", fill: "both" });
    return () => animation?.cancel();
  }, [from.x, from.y, to.x, to.y, projectile.startedAt, projectile.impactAt]);

  useEffect(() => {
    const target = projectile.resolvedAt ? projectile.resolvedAt + 2200 : projectile.impactAt;
    const timer = setTimeout(() => redraw(value => value + 1), Math.max(0, target - Date.now() - offset.current) + 10);
    return () => clearTimeout(timer);
  }, [projectile.impactAt, projectile.resolvedAt]);

  const dodged = projectile.evadeType === "dodge";
  const color = dodged ? "#86efac" : projectile.kind === "boss" ? "#fda4af" : ["heal", "resurrect"].includes(projectile.kind) ? "#86efac" : "#7dd3fc";
  const amount = Number((projectile.amount || 0).toFixed(2));
  const crit = projectile.critical && amount > 0 && !["miss", "evade"].includes(projectile.result);
  const hitAge = projectile.resolvedAt ? Math.max(0, now - projectile.resolvedAt) : 0;
  const label = dodged ? "DODGED!" : projectile.result === "evade" ? "EVADE" : projectile.result === "miss" ? "MISS" : projectile.kind === "buff" ? "BUFF" : `${["heal", "resurrect"].includes(projectile.kind) ? "+" : "−"}${amount}`;
  const angle = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
  return <>
    <div ref={flight} className="boss-projectile" style={{ visibility: flying ? "visible" : "hidden", transform: `translate(${to.x}%, ${to.y}%)` }} aria-hidden="true">
      <div className="boss-projectile-art">
        {art ? <img src={art.src} alt="" draggable={false} style={{ width: art.size, height: art.size, objectFit: "contain", imageRendering: "pixelated", transform: `rotate(${angle}deg) scale(${projectile.moveId === "strong" ? 1.2 : 1})`, filter: `drop-shadow(0 0 7px ${art.glow})` }} /> : <div style={{ width: 20, height: 20, background: color, borderRadius: "50%" }} />}
      </div>
    </div>
    {visibleHit && crit && hitAge < 600 && <div aria-hidden="true" className="boss-crit-impact" style={{ left: `${to.x}%`, top: `${to.y}%`, animationDelay: `-${hitAge}ms` }}><i /><b /></div>}
    {visibleHit && <div className={`boss-impact${crit ? " boss-impact-crit" : ""}`} style={{ left: `${(hitPoint || to).x}%`, top: `${(hitPoint || to).y + labelOffset}%`, zIndex: 10, color: crit ? "#fff2a8" : color, animationDelay: `-${hitAge}ms` }}>
      {crit && <span className="boss-crit-label">CRIT!</span>}
      {showName && projectile.kind === "damage" && `${projectile.sourceName || "Player"} `}{label}{projectile.moveId === "strong" && !dodged && " ★"}
    </div>}
  </>;
}
