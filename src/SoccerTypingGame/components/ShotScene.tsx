import React from "react";
import { Box, Button, Typography } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { MatchState, SoccerTypingConfig } from "../engine/types";
import { getShotGoalProbability, SHOT_DURATIONS, SHOT_POINTS } from "../engine/shooting";
import { clamp } from "../engine/geometry";
import { createTypingChallenge } from "../engine/typingChallenge";
import ChallengeText from "./ChallengeText";
import SoccerPlayerSvg from "./SoccerPlayerSvg";
import SoccerGoalkeeperSvg from "./SoccerGoalkeeperSvg";
import SoccerGoalkeeperDiveSvg from "./SoccerGoalkeeperDiveSvg";

export default function ShotScene({ match, config, now, onProceed }: { match: MatchState; config: SoccerTypingConfig; now: number; onProceed: () => void }) {
  const shot = match.shot!;
  const keeper = match.players.find((player) => player.id === shot.goalkeeperId)!;
  const shooter = match.players.find((player) => player.id === shot.shooterId)!;
  const keeperColors = { ...config.teams[keeper.team].colors, ...keeper.colors };
  const typing = ["SHOT_READY", "SHOT_TYPING", "SHOT_WORD_READY"].includes(match.phase);
  const elapsed = Math.max(0, now - shot.phaseStartedAtMs);
  const cameraProgress = match.phase === "SHOT_CAMERA" ? clamp(elapsed / SHOT_DURATIONS.SHOT_CAMERA, 0, 1) : typing ? 0 : 1;
  const finalScale = 1 - clamp(shot.distance / config.field.width, 0, 1) * 0.65;
  const scale = 1 - (1 - finalScale) * cameraProgress;
  const flight = match.phase === "SHOT_FLIGHT" ? clamp(elapsed / SHOT_DURATIONS.SHOT_FLIGHT, 0, 1) : match.phase === "SHOT_RESULT" ? 1 : 0;
  const target = SHOT_POINTS[shot.result?.location ?? "c"];
  const end = { x: 50 + (target.x - 50) * scale, y: 54 + (target.y - 54) * scale };
  const ball = { x: 50 + (end.x - 50) * flight, y: 94 + (end.y - 94) * flight - Math.sin(flight * Math.PI) * 27 };
  const keeperLocation = shot.result?.scored
    ? shot.result.blocked[0] ?? (shot.result.location === "tl" ? "tr" : "tl")
    : shot.result?.location ?? "c";
  const keeperTarget = SHOT_POINTS[keeperLocation];
  const dive = shot.result && flight > 0.4;
  const keeperX = dive ? 50 + (keeperTarget.x - 50) * clamp((flight - 0.4) / 0.4, 0, 1) : 50;
  const keeperY = dive ? 61 + (keeperTarget.y - 61) * clamp((flight - 0.4) / 0.4, 0, 1) : 61;
  const needsEnter = match.phase === "SHOT_READY" || match.phase === "SHOT_WORD_READY";
  const goalPercent = Number((getShotGoalProbability(shot) * 100).toFixed(1));
  return <Box aria-label="Shooting arena" sx={{ position: "absolute", inset: 0, overflow: "hidden", bgcolor: "#208647" }}>
    <svg role="img" aria-label="Player eye-level view of the goal" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block" }}>
      <defs>
        <pattern id="shot-net" width="3" height="5" patternUnits="userSpaceOnUse"><path d="M3 0 H0 V5" fill="none" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="0.2" /></pattern>
        <pattern id="shot-crowd" width="5" height="4" patternUnits="userSpaceOnUse"><rect width="5" height="4" fill="#453e49" /><circle cx="1" cy="1" r="0.5" fill="#f6c5ac" /><circle cx="4" cy="3" r="0.5" fill="#8bc9e0" /></pattern>
      </defs>
      <rect width="100" height="14" fill="#bce7eb" />
      <rect y="14" width="100" height="18" fill="url(#shot-crowd)" />
      <rect y="30" width="100" height="4" fill="#f4f4f5" />
      <path d="M0 96 L37 34 M100 96 L63 34 M0 87 H100" stroke="#edf8eb" strokeWidth="0.6" fill="none" />
      <g transform={`translate(50 54) scale(${scale}) translate(-50 -54)`}>
        <path d="M5 84 V16 H95 V84 L91 79 V21 H9 V79 Z" fill="#f1f5f9" stroke="#d4d4d8" strokeWidth="0.6" />
        <rect x="9" y="21" width="82" height="59" fill="#143b2b" fillOpacity="0.52" />
        <rect x="9" y="21" width="82" height="59" fill="url(#shot-net)" />
        <path d="M9 80 H91 M5 84 L9 80 M95 84 L91 80" stroke="#ffffff" strokeWidth="0.5" />
        {dive && keeperLocation !== "c"
          ? <SoccerGoalkeeperDiveSvg location={keeperLocation} x={keeperX - 17} y={keeperY - 14} width="34" height="28" colors={keeperColors} />
          : <SoccerGoalkeeperSvg x="41" y="47" width="18" height="33" colors={keeperColors} />}
      </g>
      {!typing && match.players.filter((player) => {
        const fromGoal = shot.offenseTeam === "X" ? config.field.width - player.position.x : player.position.x;
        return player.id !== keeper.id && player.id !== shooter.id && fromGoal >= 0 && fromGoal <= shot.distance;
      }).map((player) => {
        const fromGoal = shot.offenseTeam === "X" ? config.field.width - player.position.x : player.position.x;
        const depth = clamp(fromGoal / Math.max(10, shot.distance), 0, 1);
        const x = 50 + (player.position.y - config.field.height / 2) * (0.45 + depth * 1.2) * scale;
        const y = 54 + (12 + depth * 34) * scale;
        const size = (4 + depth * 7) * scale;
        return <SoccerPlayerSvg key={player.id} x={x - size / 3} y={y - size} width={size * 0.66} height={size}
          opacity={cameraProgress}
          colors={{ shirt: config.teams[player.team].color, ...config.teams[player.team].colors, ...player.colors }} />;
      })}
      {!typing && <g transform={`translate(${ball.x} ${ball.y})`}>
        <ellipse cy={Math.sin(flight * Math.PI) * 15} rx={2.6 - flight * 1.5} ry="0.6" fill="#102d18" fillOpacity="0.4" />
      </g>}
    </svg>
    {!typing && <Box sx={{ position: "absolute", left: `${ball.x}%`, top: `${ball.y}%`, width: { xs: 32, sm: 54 }, height: { xs: 32, sm: 54 }, transform: `translate(-50%, -50%) scale(${1 - flight * 0.62})`, opacity: shot.result?.scored ? 1 - clamp((flight - 0.9) / 0.1, 0, 1) : 1, pointerEvents: "none" }}>
      <svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden="true">
        <circle cx="20" cy="20" r="18" fill="#ffffff" stroke="#17202a" strokeWidth="1.2" />
        <path d="M20 12 L28 18 L25 27 H15 L12 18 Z M9 5 L13 7 L9 13 L3 13 M31 5 L27 7 L31 13 L37 13 M3 26 L9 25 L13 33 L10 36 M37 26 L31 25 L27 33 L30 36 M15 37 L17 33 H23 L25 37" fill="#17202a" />
        <path d="M13 7 L20 12 L27 7 M9 25 L12 18 L9 13 M31 25 L28 18 L31 13 M17 33 L15 27 M23 33 L25 27" fill="none" stroke="#17202a" strokeWidth="0.8" />
      </svg>
    </Box>}
    <Box sx={{ position: "absolute", top: 8, left: 8, right: 8, display: "flex", justifyContent: "space-between", gap: 1, color: "#ffffff" }}>
      <Typography component="div" sx={{ fontWeight: 900, fontSize: { xs: 12, sm: 16 }, bgcolor: "#182b20", px: 1 }}>
        <Box component="span" sx={{ display: "block" }}>{typing ? `${config.teams[shot.round === "attacker" ? shot.offenseTeam : shot.defenseTeam].name} ${shot.round === "attacker" ? "shooting" : "saving"}` : `${Math.round(shot.distance)}m`}</Box>
        <Box component="span" aria-label="Offense goal probability" sx={{ display: "block", color: "#facc15", fontVariantNumeric: "tabular-nums" }}>Goal {goalPercent}%</Box>
      </Typography>
      <Typography sx={{ fontWeight: 900, fontSize: { xs: 13, sm: 16 }, bgcolor: "#182b20", px: 1 }}>{shot.chances} {shot.chances === 1 ? "chance" : "chances"}</Typography>
    </Box>
    {typing && shot.targets.map((entry) => {
      const point = SHOT_POINTS[entry.location];
      const selected = shot.activeLocation === entry.location;
      const done = (shot.round === "attacker" ? entry.attackerMs : entry.defenderMs) !== undefined;
      const challenge = selected && match.activeChallenge ? match.activeChallenge : { ...createTypingChallenge(entry.phrase, 0), typed: done ? entry.phrase : "" };
      return <Box key={entry.location} data-shot-target={entry.location} sx={{ position: "absolute", left: `${point.x}%`, top: `${entry.location === "c" ? 40 : point.y}%`,
        transform: "translate(-50%, -50%)", width: "43%", maxWidth: 220, boxSizing: "border-box", opacity: done && !selected ? 0.8 : 1,
        outline: selected ? "3px solid #facc15" : "none", borderRadius: 1 }}>
        <ChallengeText challenge={challenge} compact />
        <Typography sx={{ textAlign: "center", fontSize: { xs: 10, sm: 12 }, fontWeight: 900, bgcolor: "#182b20", color: "#ffffff", whiteSpace: "nowrap" }}>
          {entry.attackerMs === undefined ? "\u2014" : `${(entry.attackerMs / 1000).toFixed(2)}s`}
          {" / "}{entry.defenderMs === undefined ? "\u2014" : `${(entry.defenderMs / 1000).toFixed(2)}s`}
          {entry.defenderMs !== undefined ? entry.defenderMs < entry.attackerMs! ? " BLOCK" : " OPEN" : ""}
        </Typography>
      </Box>;
    })}
    {needsEnter && <Box sx={{ position: "absolute", bottom: "9%", left: 0, right: 0, display: "flex", justifyContent: "center" }}>
      <Button onClick={onProceed} startIcon={<PlayArrowIcon />} sx={{ color: "#ffffff", bgcolor: "#182b20", fontWeight: 900, "&:hover": { bgcolor: "#244432" } }}>Enter</Button>
    </Box>}
    {match.phase === "SHOT_COUNTDOWN" && <Typography aria-label="Shot countdown" sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 80, fontWeight: 950, color: "#ffffff", textShadow: "0 3px 3px #17202a" }}>{Math.max(1, 3 - Math.floor(elapsed / 1000))}</Typography>}
    {match.phase === "SHOT_RESULT" && (shot.result?.scored
      ? <Typography aria-label="Goal scored" sx={{ position: "absolute", top: "40%", left: "50%", fontSize: { xs: 32, sm: 56 }, whiteSpace: "nowrap", fontWeight: 950,
        color: "#facc15", textShadow: "0 3px 2px #17202a", transform: `translateX(${200 - (elapsed / SHOT_DURATIONS.SHOT_RESULT) * 500}%)` }}>GOOOOOOOOOOOOAL!</Typography>
      : <Typography sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 64, fontWeight: 950, color: "#ffffff", textShadow: "0 3px 3px #17202a" }}>SAVE!</Typography>)}
  </Box>;
}
