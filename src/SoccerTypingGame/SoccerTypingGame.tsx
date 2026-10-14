import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import SoccerPlayerSvg from "./components/SoccerPlayerSvg";
import SoccerGoalkeeperSvg from "./components/SoccerGoalkeeperSvg";
import ChallengeText from "./components/ChallengeText";
import ShotScene from "./components/ShotScene";
import { DEFAULT_SOCCER_CONFIG } from "./engine/config";
import { getShotDeadline } from "./engine/shooting";
import {
  checkHiddenDeadlines,
  createInitialSoccerMatch,
  getActivePlayer,
  getModeledBallPosition,
  getSelectableOffenseTargets,
  handleTypingKey,
  proceedToNextPlay,
  selectDefender,
  selectOffensiveTarget,
  shiftActiveClocks,
} from "./engine/gameEngine";
import { PlayerState, GoalTarget } from "./engine/types";

const CONFIG = DEFAULT_SOCCER_CONFIG;

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    tag === "button" ||
    tag === "a" ||
    target.isContentEditable ||
    target.closest('[role="button"], [role="slider"], [role="combobox"]') !== null
  );
}

function isGameTypingKey(key: string) {
  return key === "Enter" || key === "Backspace" || key.length === 1;
}

function formatSeconds(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function PlayerMarker({
  player,
  active,
  selected,
  eligible,
  onClick,
}: {
  player: PlayerState;
  active: boolean;
  selected: boolean;
  eligible: boolean;
  onClick: () => void;
}) {
  const team = CONFIG.teams[player.team];
  const isTemporary = Boolean(player.temporary);
  const PlayerArtwork = player.role === "goalkeeper" ? SoccerGoalkeeperSvg : SoccerPlayerSvg;

  return (
    <g
      role="button"
      aria-label={`${team.name} ${player.name} ${player.key}`}
      onClick={onClick}
      style={{ cursor: "pointer" }}
    >
      <rect
        x={player.position.x - 4.2}
        y={player.position.y - 9}
        width="8.4"
        height="15.5"
        fill="transparent"
      />
      <ellipse
        cx={player.position.x}
        cy={player.position.y}
        rx={3.5}
        ry={1.25}
        fill="rgba(3,17,11,0.35)"
        stroke={selected ? "#f97316" : active ? "#fefce8" : eligible ? "#ffffff" : team.accent}
        strokeWidth={active || selected || eligible ? 0.55 : 0.25}
        strokeDasharray={isTemporary ? "1.4 1.1" : undefined}
      />
      {active && (
        <ellipse
          cx={player.position.x}
          cy={player.position.y}
          rx={4.3}
          ry={1.8}
          fill="none"
          stroke="rgba(254,252,232,0.82)"
          strokeWidth={0.45}
        />
      )}
      {player.hasBall && (
        <ellipse
          cx={player.position.x}
          cy={player.position.y}
          rx={5}
          ry={2.1}
          fill="none"
          stroke="#fb923c"
          strokeWidth={0.55}
        />
      )}
      <PlayerArtwork
        x={player.position.x - 3.2}
        y={player.position.y - 8.8}
        width="6.4"
        height="9.6"
        facing={player.team === "X" ? "right" : "left"}
        colors={{
          shirt: team.color,
          shorts: team.accent,
          socks: team.color,
          trim: team.accent,
          ...team.colors,
          ...player.colors,
        }}
        pointerEvents="none"
      />
      <rect
        x={player.position.x - 2.8}
        y={player.position.y + 2.5}
        width="5.6"
        height="3.5"
        rx="0.75"
        fill={active ? "#f97316" : "rgba(15,23,42,0.9)"}
        stroke="rgba(255,255,255,0.48)"
        strokeWidth="0.28"
        pointerEvents="none"
      />
      <text
        x={player.position.x}
        y={player.position.y + 5.05}
        textAnchor="middle"
        fontSize="2.65"
        fontWeight="900"
        fill="#ffffff"
        pointerEvents="none"
      >
        {player.key}
      </text>
    </g>
  );
}

export default function SoccerTypingGame() {
  const [match, setMatch] = useState(() => createInitialSoccerMatch(CONFIG, nowMs()));
  const [renderNow, setRenderNow] = useState(() => nowMs());
  const [helpOpen, setHelpOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const pauseStartedAtRef = useRef<number | null>(null);
  const matchRef = useRef(match);
  const pausedRef = useRef(paused);
  const gameSurfaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    matchRef.current = match;
  }, [match]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const restart = useCallback(() => {
    const nextNow = nowMs();
    setPaused(false);
    pauseStartedAtRef.current = null;
    setMatch(createInitialSoccerMatch(CONFIG, nextNow));
    setRenderNow(nextNow);
    gameSurfaceRef.current?.focus({ preventScroll: true });
  }, []);

  const resumeFromPause = useCallback(() => {
    const startedAt = pauseStartedAtRef.current;
    const currentNow = nowMs();
    const pauseMs = startedAt === null ? 0 : currentNow - startedAt;
    pauseStartedAtRef.current = null;
    setPaused(false);
    setMatch((current) => shiftActiveClocks(current, pauseMs));
    setRenderNow(currentNow);
    gameSurfaceRef.current?.focus({ preventScroll: true });
  }, []);

  const pauseGame = useCallback(() => {
    if (pausedRef.current) return;
    pauseStartedAtRef.current = nowMs();
    setPaused(true);
  }, []);

  const actOnKey = useCallback((key: string) => {
    const currentNow = nowMs();
    setRenderNow(currentNow);
    setMatch((current) => {
      const checked = checkHiddenDeadlines(current, currentNow, CONFIG);

      if (checked.shot) return handleTypingKey(checked, key, currentNow, CONFIG);
      if (key === "Enter") return proceedToNextPlay(checked, currentNow, CONFIG);

      if (checked.phase === "OFFENSE_SELECT") {
        return selectOffensiveTarget(checked, key, currentNow, CONFIG);
      }
      if (checked.phase === "DEFENSE_SELECT") {
        return selectDefender(checked, key, currentNow, CONFIG);
      }
      if (checked.phase === "OFFENSE_TYPING" || checked.phase === "DEFENSE_TYPING") {
        return handleTypingKey(checked, key, currentNow, CONFIG);
      }
      return checked;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        event.preventDefault();
        if (event.repeat) return;
        if (event.altKey && event.shiftKey) setHelpOpen(true);
        else if (event.shiftKey) restart();
        else if (pausedRef.current) resumeFromPause();
        else pauseGame();
        return;
      }
      if (event.repeat && event.key === "Enter") return;
      if (event.ctrlKey || event.metaKey || event.altKey || pausedRef.current || isEditableTarget(event.target) || !isGameTypingKey(event.key)) {
        return;
      }

      event.preventDefault();
      actOnKey(event.key);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actOnKey, pauseGame, restart, resumeFromPause]);

  useEffect(() => {
    if (paused || match.phase === "MATCH_COMPLETE") return undefined;

    const deadline = getShotDeadline(match) ?? (
      match.phase === "DEFENSE_TYPING"
        ? match.currentPlay?.defenseDeadlineAtMs
        : match.selectionDeadlineAtMs);
    if (deadline === undefined) return undefined;

    const delay = Math.max(0, deadline - nowMs());
    const timeoutId = window.setTimeout(() => {
      const currentNow = nowMs();
      setRenderNow(currentNow);
      setMatch((current) => checkHiddenDeadlines(current, currentNow, CONFIG));
    }, delay + 12);

    return () => window.clearTimeout(timeoutId);
  }, [match, paused]);

  useEffect(() => {
    if (paused || (match.phase !== "DEFENSE_TYPING" && !match.shot)) return undefined;

    let frameId = 0;
    const tick = () => {
      setRenderNow(nowMs());
      frameId = window.requestAnimationFrame(tick);
    };
    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [match.phase, match.shot, paused]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) pauseGame();
    };
    const onBlur = () => pauseGame();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
    };
  }, [pauseGame]);

  const activePlayer = getActivePlayer(match);
  const offenseTargets = useMemo(
    () => (match.phase === "OFFENSE_SELECT" ? getSelectableOffenseTargets(match, CONFIG) : []),
    [match]
  );
  const offenseTargetIds = new Set(offenseTargets.map((target) => target.id));
  const eligibleDefenderKeys = new Set(
    match.phase === "DEFENSE_SELECT" || match.phase === "DEFENSE_TYPING"
      ? match.currentPlay?.eligibleInterceptions.map((option) => option.defenderKey) ?? []
      : []
  );
  const selectedDefenderId = match.currentPlay?.selectedInterception?.defenderId;
  const ball = getModeledBallPosition(match, renderNow);
  const displayedBall =
    match.phase === "DEFENSE_TYPING"
      ? ball
      : { x: ball.x + (match.possessionTeam === "X" ? 3.6 : -3.6), y: ball.y + 0.3 };
  const possessionTeam = CONFIG.teams[match.possessionTeam];
  const statusLine =
    match.shot && ["SHOT_CAMERA", "SHOT_COUNTDOWN", "SHOT_FLIGHT", "SHOT_RESULT"].includes(match.phase)
      ? match.phase === "SHOT_RESULT" ? match.lastEvent : `${CONFIG.teams[match.shot.offenseTeam].name}: shooting`
      : match.shot
      ? `${CONFIG.teams[match.shot.round === "attacker" ? match.shot.offenseTeam : match.shot.defenseTeam].name}: ${match.shot.round === "attacker" ? "shot" : "save"}`
      : match.phase === "OFFENSE_READY" || match.phase === "DEFENSE_READY"
      ? `${match.lastEvent} (Enter)`
      : match.phase === "OFFENSE_SELECT"
      ? `${possessionTeam.name}: choose a teammate or shoot (S)`
      : match.phase === "OFFENSE_TYPING"
      ? `${activePlayer.key} is typing the play`
      : match.phase === "DEFENSE_SELECT"
      ? `${CONFIG.teams[match.currentPlay?.defenseTeam ?? "O"].name}: choose an interceptor`
      : match.phase === "DEFENSE_TYPING"
      ? `${match.currentPlay?.selectedInterception?.defenderKey ?? ""} is racing the ball`
      : match.phase === "MATCH_COMPLETE"
      ? `${CONFIG.teams[match.winner ?? "X"].name} win`
      : match.lastEvent;

  const handlePlayerClick = (player: PlayerState) => {
    if (paused) return;
    if (matchRef.current.phase === "OFFENSE_SELECT" || matchRef.current.phase === "DEFENSE_SELECT") {
      actOnKey(player.key);
    }
  };

  const handleGoalClick = (goal: GoalTarget) => {
    if (!paused && matchRef.current.phase === "OFFENSE_SELECT" && goal.scoringTeam === matchRef.current.possessionTeam) {
      actOnKey(goal.key);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#07130d",
        color: "#f8fafc",
        px: { xs: 1.5, md: 3 },
        py: { xs: 1.5, md: 2.5 },
        background:
          "linear-gradient(180deg, #07130d 0%, #0f2f1d 48%, #07130d 100%)",
      }}
    >
      <Stack spacing={2} sx={{ maxWidth: 1360, mx: "auto" }}>
        <Paper
          elevation={6}
          sx={{
            p: { xs: 1.5, md: 2 },
            borderRadius: 1,
            bgcolor: "rgba(2, 6, 23, 0.82)",
            color: "#f8fafc",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", md: "center" }}
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={1.2} alignItems="center">
              <SportsSoccerIcon sx={{ color: "#facc15" }} />
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 950, lineHeight: 1.1 }}>
                  Soccer Typing
                </Typography>
                <Typography sx={{ color: "rgba(226,232,240,0.72)", fontSize: 13, fontWeight: 700 }}>
                  {statusLine}
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Chip
                label={`${CONFIG.teams.X.name} ${match.scores.X}`}
                sx={{ bgcolor: CONFIG.teams.X.color, color: CONFIG.teams.X.accent, fontWeight: 950 }}
              />
              <Chip
                label={`${CONFIG.teams.O.name} ${match.scores.O}`}
                sx={{ bgcolor: CONFIG.teams.O.color, color: CONFIG.teams.O.accent, fontWeight: 950 }}
              />
              <Chip
                label={`Ball: ${activePlayer.key}`}
                variant="outlined"
                sx={{ color: "#f8fafc", borderColor: "rgba(255,255,255,0.3)", fontWeight: 850 }}
              />
              <Tooltip title={paused ? "Resume (Tab)" : "Pause (Tab)"}>
                <IconButton
                  onClick={paused ? resumeFromPause : pauseGame}
                  sx={{ color: "#f8fafc" }}
                  aria-label={paused ? "Resume match" : "Pause match"}
                >
                  {paused ? <PlayArrowIcon /> : <PauseIcon />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Help (Alt+Shift+Tab)">
                <IconButton
                  onClick={() => setHelpOpen(true)}
                  sx={{ color: "#f8fafc" }}
                  aria-label="Open help"
                >
                  <HelpOutlineIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Restart (Shift+Tab)">
                <IconButton onClick={restart} sx={{ color: "#f8fafc" }} aria-label="Restart match">
                  <RestartAltIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Paper>

        <Stack direction={{ xs: "column", lg: "row" }} spacing={2} alignItems="stretch">
          <Paper
            elevation={8}
            sx={{
              position: "relative",
              flex: 1,
              minWidth: 0,
              p: { xs: 1, sm: 1.5 },
              borderRadius: 1,
              bgcolor: "rgba(3, 17, 11, 0.96)",
              border: "1px solid rgba(255,255,255,0.12)",
              overflow: "hidden",
            }}
          >
            <Box
              ref={gameSurfaceRef}
              role="region"
              aria-label="Soccer game"
              tabIndex={-1}
              onPointerDown={() => gameSurfaceRef.current?.focus({ preventScroll: true })}
              sx={{
                position: "relative",
                width: "100%",
                aspectRatio: "5 / 3",
                minHeight: { xs: 360, sm: 430, lg: 560 },
                overflow: "hidden",
                borderRadius: 1,
                border: "2px solid rgba(240,253,244,0.7)",
                bgcolor: "#16803c",
                outline: "none",
              }}
            >
              <svg
                viewBox="-5 -4 110 68"
                role="img"
                aria-label="Soccer field"
                aria-hidden={Boolean(match.shot)}
                style={{ width: "100%", height: "100%", display: "block" }}
                preserveAspectRatio="xMidYMid meet"
              >
                <defs>
                  <pattern id="soccer-stripes" width="10" height="60" patternUnits="userSpaceOnUse">
                    <rect width="5" height="60" fill="#177f3e" />
                    <rect x="5" width="5" height="60" fill="#1f9349" />
                  </pattern>
                  <filter id="ball-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="0.55" stdDeviation="0.55" floodColor="#0f172a" floodOpacity="0.48" />
                  </filter>
                </defs>

                <rect x="0" y="0" width="100" height="60" rx="0.8" fill="url(#soccer-stripes)" />
                <line x1="50" y1="0" x2="50" y2="60" stroke="rgba(240,253,244,0.82)" strokeWidth="0.45" />
                <circle cx="50" cy="30" r="9.5" fill="none" stroke="rgba(240,253,244,0.82)" strokeWidth="0.45" />
                <circle cx="50" cy="30" r="0.85" fill="rgba(240,253,244,0.9)" />
                <rect x="0" y="14" width="14" height="32" fill="none" stroke="rgba(240,253,244,0.8)" strokeWidth="0.45" />
                <rect x="86" y="14" width="14" height="32" fill="none" stroke="rgba(240,253,244,0.8)" strokeWidth="0.45" />
                <rect x="0" y="22" width="6" height="16" fill="none" stroke="rgba(240,253,244,0.82)" strokeWidth="0.45" />
                <rect x="94" y="22" width="6" height="16" fill="none" stroke="rgba(240,253,244,0.82)" strokeWidth="0.45" />

                {CONFIG.goals.map((goal) => {
                  const available = offenseTargetIds.has(goal.id);
                  const badgeX = goal.point.x < CONFIG.field.width / 2 ? -1.7 : 101.7;
                  return (
                    <g
                      key={goal.id}
                      onClick={() => handleGoalClick(goal)}
                      style={{ cursor: available ? "pointer" : "default" }}
                      role="button"
                      aria-label={`Shoot at ${goal.label} (S)`}
                      aria-disabled={!available}
                    >
                      <rect
                        x={badgeX - 1.7}
                        y="23"
                        width="3.4"
                        height="14"
                        rx="0.4"
                        fill={available ? CONFIG.teams[goal.scoringTeam].color : "#e2e8f0"}
                        stroke={available ? "#f97316" : "#0f172a"}
                        strokeWidth={available ? 0.65 : 0.28}
                      />
                      {goal.scoringTeam === match.possessionTeam && (
                        <text
                          x={badgeX}
                          y="31.05"
                          textAnchor="middle"
                          fontSize="3.2"
                          fontWeight="950"
                          fill={CONFIG.teams[goal.scoringTeam].accent}
                          pointerEvents="none"
                        >
                          {goal.key}
                        </text>
                      )}
                    </g>
                  );
                })}

                {match.currentPlay && (
                  <line
                    x1={match.currentPlay.origin.x}
                    y1={match.currentPlay.origin.y}
                    x2={match.currentPlay.target.point.x}
                    y2={match.currentPlay.target.point.y}
                    stroke="#f97316"
                    strokeWidth="0.9"
                    strokeLinecap="round"
                    strokeDasharray={match.phase === "OFFENSE_TYPING" ? "1.5 1.2" : undefined}
                  />
                )}

                {(match.phase === "DEFENSE_SELECT" || match.phase === "DEFENSE_TYPING") &&
                  match.currentPlay?.eligibleInterceptions.map((option) => (
                    <g key={`${option.defenderId}-${option.pathT}`}>
                      <line
                        x1={option.defenderPosition.x}
                        y1={option.defenderPosition.y}
                        x2={option.interceptionPoint.x}
                        y2={option.interceptionPoint.y}
                        stroke={option.defenderId === selectedDefenderId ? "#facc15" : "rgba(255,255,255,0.62)"}
                        strokeWidth={option.defenderId === selectedDefenderId ? 0.75 : 0.42}
                        strokeDasharray={option.defenderId === selectedDefenderId ? undefined : "1 1.1"}
                      />
                      <circle
                        cx={option.interceptionPoint.x}
                        cy={option.interceptionPoint.y}
                        r={option.defenderId === selectedDefenderId ? 1.45 : 1.05}
                        fill={option.defenderId === selectedDefenderId ? "#facc15" : "rgba(255,255,255,0.76)"}
                      />
                    </g>
                  ))}

                {match.players.map((player) => (
                  <PlayerMarker
                    key={player.id}
                    player={player}
                    active={player.id === match.activePlayerId}
                    selected={player.id === selectedDefenderId}
                    eligible={eligibleDefenderKeys.has(player.key)}
                    onClick={() => handlePlayerClick(player)}
                  />
                ))}

                <g filter="url(#ball-shadow)">
                  <circle cx={displayedBall.x} cy={displayedBall.y} r="1.35" fill="#f8fafc" stroke="#0f172a" strokeWidth="0.25" />
                  <path
                    d={`M ${displayedBall.x - 0.85} ${displayedBall.y} L ${displayedBall.x + 0.85} ${displayedBall.y} M ${displayedBall.x} ${displayedBall.y - 0.85} L ${displayedBall.x} ${displayedBall.y + 0.85}`}
                    stroke="#0f172a"
                    strokeWidth="0.18"
                    strokeLinecap="round"
                  />
                </g>
              </svg>

              {match.shot && <ShotScene match={match} config={CONFIG} now={renderNow} onProceed={() => {
                if (paused) return;
                actOnKey("Enter");
                gameSurfaceRef.current?.focus({ preventScroll: true });
              }} />}

              {!match.shot && match.activeChallenge && (
                <Box
                  sx={{
                    position: "absolute",
                    left: 8,
                    right: 8,
                    bottom: 8,
                    display: "flex",
                    justifyContent: "center",
                    zIndex: 3,
                    pointerEvents: "none",
                  }}
                >
                  <ChallengeText challenge={match.activeChallenge} />
                </Box>
              )}

              {(match.phase === "OFFENSE_READY" || match.phase === "DEFENSE_READY") && (
                <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", bgcolor: "rgba(3,17,11,0.25)" }}>
                  <Button startIcon={<PlayArrowIcon />} onClick={() => {
                    if (paused) return;
                    actOnKey("Enter");
                    gameSurfaceRef.current?.focus({ preventScroll: true });
                  }} sx={{ bgcolor: "#182b20", color: "#ffffff", fontWeight: 900, fontSize: 20 }}>Enter</Button>
                </Box>
              )}

              {paused && (
                <Box
                  role="dialog"
                  aria-label="Match paused"
                  sx={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 5,
                    display: "grid",
                    placeItems: "center",
                    bgcolor: "rgba(2,6,23,0.56)",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  <Stack
                    spacing={1.25}
                    alignItems="center"
                    sx={{
                      px: 3,
                      py: 2.5,
                      borderRadius: 1,
                      bgcolor: "rgba(15,23,42,0.92)",
                      border: "1px solid rgba(255,255,255,0.14)",
                    }}
                  >
                    <Typography sx={{ fontWeight: 950, fontSize: 24 }}>Paused</Typography>
                    <Button
                      startIcon={<PlayArrowIcon />}
                      variant="contained"
                      onClick={resumeFromPause}
                      sx={{ bgcolor: "#22c55e", color: "#052e16", fontWeight: 900 }}
                    >
                      Resume (Tab)
                    </Button>
                  </Stack>
                </Box>
              )}
            </Box>
          </Paper>

          <Paper
            elevation={6}
            sx={{
              width: { xs: "100%", lg: 330 },
              p: 2,
              borderRadius: 1,
              bgcolor: "rgba(2, 6, 23, 0.86)",
              color: "#f8fafc",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <Stack spacing={1.5}>
              <Box>
                <Typography sx={{ fontSize: 12, color: "rgba(226,232,240,0.62)", fontWeight: 900 }}>
                  Current Play
                </Typography>
                <Typography sx={{ fontWeight: 900, fontSize: 18 }}>{match.lastEvent}</Typography>
              </Box>

              <Divider sx={{ borderColor: "rgba(255,255,255,0.12)" }} />

              <Box>
                <Typography sx={{ fontSize: 12, color: "rgba(226,232,240,0.62)", fontWeight: 900 }}>
                  Available Keys
                </Typography>
                <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap sx={{ mt: 0.8 }}>
                  {(match.phase === "OFFENSE_READY" || match.phase === "DEFENSE_READY" || match.phase === "SHOT_READY" || match.phase === "SHOT_WORD_READY") && <Typography sx={{ fontWeight: 900 }}>Enter</Typography>}
                  {match.phase === "OFFENSE_SELECT" &&
                    offenseTargets.map((target) => (
                      <Chip
                        key={`${target.kind}-${target.id}`}
                        label={`${target.key} ${target.kind === "goal" ? "Shoot" : target.label}`}
                        size="small"
                        sx={{ bgcolor: "#dcfce7", color: "#052e16", fontWeight: 900 }}
                      />
                    ))}
                  {match.phase === "DEFENSE_SELECT" &&
                    match.currentPlay?.eligibleInterceptions.map((option) => (
                      <Chip
                        key={option.defenderId}
                        label={option.defenderKey}
                        size="small"
                        sx={{ bgcolor: "#e0f2fe", color: "#082f49", fontWeight: 900 }}
                      />
                    ))}
                  {(match.phase === "OFFENSE_TYPING" || match.phase === "DEFENSE_TYPING") && (
                    <Chip
                      label="Type the phrase"
                      size="small"
                      sx={{ bgcolor: "#fef3c7", color: "#78350f", fontWeight: 900 }}
                    />
                  )}
                  {match.phase === "MATCH_COMPLETE" && (
                    <Chip
                      label="Match complete"
                      size="small"
                      sx={{ bgcolor: "#fef3c7", color: "#78350f", fontWeight: 900 }}
                    />
                  )}
                </Stack>
              </Box>

              <Divider sx={{ borderColor: "rgba(255,255,255,0.12)" }} />

              <Stack spacing={0.75}>
                <Typography sx={{ fontSize: 12, color: "rgba(226,232,240,0.62)", fontWeight: 900 }}>
                  Match Stats
                </Typography>
                <Typography sx={{ fontWeight: 750 }}>Passes: {match.stats.passesCompleted}</Typography>
                <Typography sx={{ fontWeight: 750 }}>
                  Shots: {match.stats.shotsTaken}
                </Typography>
                <Typography sx={{ fontWeight: 750 }}>
                  Interceptions: X {match.stats.interceptions.X} / O {match.stats.interceptions.O}
                </Typography>
                <Typography sx={{ fontWeight: 750 }}>
                  Typing: {match.stats.offenseChallenges.length + match.stats.defenseChallenges.length} challenges
                </Typography>
                {match.stats.offenseChallenges.length > 0 && (
                  <Typography sx={{ color: "rgba(226,232,240,0.74)", fontSize: 13, fontWeight: 700 }}>
                    Last offense:{" "}
                    {formatSeconds(
                      match.stats.offenseChallenges[match.stats.offenseChallenges.length - 1].elapsedMs
                    )}
                  </Typography>
                )}
                {match.phase === "MATCH_COMPLETE" && (
                  <Button
                    startIcon={<RestartAltIcon />}
                    variant="contained"
                    onClick={restart}
                    sx={{ mt: 1, bgcolor: "#facc15", color: "#422006", fontWeight: 950 }}
                  >
                    New Match
                  </Button>
                )}
              </Stack>
            </Stack>
          </Paper>
        </Stack>
      </Stack>

      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 950 }}>How to Play</DialogTitle>
        <DialogContent>
          <Stack spacing={1.4} sx={{ color: "text.secondary" }}>
            <Typography>
              The team with the ball types a teammate letter to pass or S to shoot at the opposing goal.
              Then type the phrase exactly. Mistakes stay in the text until you backspace and fix them.
            </Typography>
            <Typography>
              Press Enter between plays and before the defending turn. After a pass phrase is complete, the defending team can type an eligible defender
              letter. A defender near the path gets a shorter phrase, but must finish before the ball
              reaches the interception point.
            </Typography>
            <Typography>
              For shots, both teams type the five 12-character phrases. The first letter locks a location;
              Enter advances after each phrase. A faster keeper blocks that location. Closer shots get
              up to four chances; distant shots get one. A save gives the keeper possession.
            </Typography>
            <Typography>
              After an interception attempt, off-ball players move around their starting spots. First team
              to {CONFIG.winningScore} goals wins.
            </Typography>
            <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
              <Button startIcon={<PauseIcon />} onClick={pauseGame}>
                Pause (Tab)
              </Button>
              <Button startIcon={<RestartAltIcon />} onClick={restart}>
                Restart (Shift+Tab)
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
