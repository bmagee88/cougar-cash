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
  const melee = projectile.bossAttack === "bite" || projectile.bossAttack === "tailWhip";
  const goldenShield = projectile.moveId === "goldShield";

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
  const color = goldenShield ? "#fde047" : dodged ? "#86efac" : projectile.kind === "boss" ? "#fda4af" : ["heal", "resurrect"].includes(projectile.kind) ? "#86efac" : "#7dd3fc";
  const amount = Number((projectile.amount || 0).toFixed(2));
  const crit = projectile.critical && amount > 0 && !["miss", "evade"].includes(projectile.result);
  const hitAge = projectile.resolvedAt ? Math.max(0, now - projectile.resolvedAt) : 0;
  const label = goldenShield ? `SHIELD +${amount}` : dodged ? "DODGED!" : projectile.result === "evade" ? "EVADE" : projectile.result === "miss" ? "MISS" : projectile.kind === "buff" ? "BUFF" : `${["heal", "resurrect"].includes(projectile.kind) ? "+" : "−"}${amount}`;
  const angle = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
  return <>
    {!melee && !goldenShield && <div ref={flight} className="boss-projectile" style={{ visibility: flying ? "visible" : "hidden", transform: `translate(${to.x}%, ${to.y}%)` }} aria-hidden="true">
      <div className="boss-projectile-art">
        {art ? <img src={art.src} alt="" draggable={false} style={{ width: art.size, height: art.size, objectFit: "contain", imageRendering: "pixelated", transform: `rotate(${angle}deg) scale(${projectile.moveId === "strong" ? 1.2 : 1})`, filter: `drop-shadow(0 0 7px ${art.glow})` }} /> : <div style={{ width: 20, height: 20, background: color, borderRadius: "50%" }} />}
      </div>
    </div>}
    {visibleHit && goldenShield && hitAge < 900 && <svg className="boss-golden-shield" viewBox="0 0 100 108" aria-hidden="true"
      style={{ left: `${to.x}%`, top: `${to.y}%`, animationDelay: `-${hitAge}ms` }}>
      <path d="M50 6Q69 19 91 22V51Q91 79 50 102Q9 79 9 51V22Q31 19 50 6Z" fill="#facc1550" stroke="#fde047" strokeWidth="5" />
      <path d="M50 17Q65 27 80 30V51Q80 72 50 91Q20 72 20 51V30Q35 27 50 17Z" fill="none" stroke="#fef3c7" strokeWidth="2" />
      <path d="M50 32L55 48L70 53L55 58L50 75L45 58L30 53L45 48Z" fill="#fef9c3" />
    </svg>}
    {visibleHit && melee && hitAge < 420 && <div className={`boss-melee-effect ${projectile.bossAttack === "bite" ? "boss-bite-effect" : "boss-tail-effect"}`}
      aria-hidden="true" style={{ left: `${to.x}%`, top: `${to.y}%`, animationDelay: `-${hitAge}ms` }}>
      {projectile.bossAttack === "bite" ? <svg viewBox="0 0 92 80">
        <path className="boss-bite-upper" d="M4 33Q46 2 88 33L81 46L72 34L65 49L55 35L46 49L36 35L27 49L19 34L11 46Z" />
        <path className="boss-bite-lower" d="M4 57Q46 88 88 57L81 44L72 56L65 41L55 55L46 41L36 55L27 41L19 56L11 44Z" />
      </svg> : <svg viewBox="0 0 100 76">
        <path d="M4 66Q50 58 93 11M13 72Q61 62 96 24M3 52Q45 47 76 15" fill="none" stroke="#fde68a" strokeWidth="4" strokeLinecap="round" />
      </svg>}
    </div>}
    {visibleHit && crit && hitAge < 600 && <div aria-hidden="true" className="boss-crit-impact" style={{ left: `${to.x}%`, top: `${to.y}%`, animationDelay: `-${hitAge}ms` }}><i /><b /></div>}
    {visibleHit && <div className={`boss-impact${crit ? " boss-impact-crit" : ""}`} style={{ left: `${(hitPoint || to).x}%`, top: `${(hitPoint || to).y + labelOffset}%`, zIndex: 10, color: crit ? "#fff2a8" : color, animationDelay: `-${hitAge}ms` }}>
      {crit && <span className="boss-crit-label">{projectile.balanced ? "SKILL!" : "CRIT!"}</span>}
      {showName && projectile.kind === "damage" && `${projectile.sourceName || "Player"} `}{label}{projectile.moveId === "strong" && !dodged && " ★"}
    </div>}
  </>;
}
