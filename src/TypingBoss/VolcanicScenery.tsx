import React from "react";
import "./volcanicScenery.css";

const ASSETS = `${(process.env.PUBLIC_URL || "").replace(/\/$/, "")}/assets/typing-boss`;

export function VolcanicBackdrop() {
  return <div className="volcanic-scenery" aria-hidden="true"
    style={{ "--volcanic-arena": `url("${ASSETS}/volcanic-valley-arena.png")` } as React.CSSProperties}>
    <div className="volcanic-distance" data-scenery-layer="distance" />
    <div className="volcanic-ground" data-scenery-layer="battle-ground" />
    <div className="volcanic-haze" data-scenery-layer="haze" />
  </div>;
}

export function VolcanicForeground() {
  return <img className="volcanic-foreground" data-scenery-layer="foreground"
    src={`${ASSETS}/volcanic-foreground.png`} alt="" aria-hidden="true" draggable={false} />;
}
