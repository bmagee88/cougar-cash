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
import { DEFAULT_SOCCER_CONFIG } from "./engine/config";
import { constrainPhraseAnchor } from "./engine/geometry";
import {
  checkHiddenDeadlines,
  createInitialSoccerMatch,
  getActivePlayer,
  getModeledBallPosition,
  getSelectableOffenseTargets,
  handleTypingKey,
  selectDefender,
  selectOffensiveTarget,
  shiftActiveClocks,
} from "./engine/gameEngine";
import { TypingChallenge, PlayerState, Point } from "./engine/types";

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
  return key === "Backspace" || key.length === 1;
}

function formatSeconds(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function percent(point: Point) {
  return {
    left: `${point.x}%`,
    top: `${point.y}%`,
  };
}

function ChallengeText({ challenge }: { challenge: TypingChallenge }) {
  const chars = challenge.phrase.split("");

  return (
    <Box
      aria-label="Typing challenge"
      sx={{
        display: "inline-flex",
        flexWrap: "wrap",
        gap: 0.2,
        px: 1.2,
        py: 0.9,
        maxWidth: { xs: 260, sm: 360, md: 460 },
        borderRadius: 1,
        border: "1px solid rgba(255,255,255,0.28)",
        bgcolor: "rgba(6, 24, 22, 0.9)",
        boxShadow: "0 14px 40px rgba(0,0,0,0.26)",
        backdropFilter: "blur(8px)",
      }}
    >
      {chars.map((char, index) => {
        const typedChar = challenge.typed[index];
        const hasTyped = typedChar !== undefined;
        const correct = hasTyped && typedChar === char;
        const incorrect = hasTyped && typedChar !== char;
        const active = index === challenge.typed.length;

        return (
          <Box
            key={`${char}-${index}`}
            component="span"
            sx={{
              minWidth: char === " " ? 11 : 13,
              height: 27,
              px: 0.25,
              borderRadius: 0.5,
              display: "inline-grid",
              placeItems: "center",
              fontFamily: "monospace",
              fontSize: { xs: 18, sm: 20 },
              fontWeight: 900,
              lineHeight: 1,
              color: correct
                ? "#052e16"
                : incorrect
                ? "#450a0a"
                : active
                ? "#fff7ed"
                : "rgba(241,245,249,0.78)",
              bgcolor: correct
                ? "#86efac"
                : incorrect
                ? "#fca5a5"
                : active
                ? "rgba(251,191,36,0.35)"
                : "transparent",
              outline: active ? "2px solid rgba(251,191,36,0.78)" : "none",
            }}
          >
            {char === " " ? "·" : char}
          </Box>
        );
      })}
    </Box>
  );
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

  return (
    <g
      role="button"
      aria-label={`${team.name} ${player.name} ${player.key}`}
      onClick={onClick}
      style={{ cursor: "pointer" }}
    >
      <circle
        cx={player.position.x}
        cy={player.position.y}
        r={active ? 3.3 : 2.85}
        fill={team.color}
        stroke={selected ? "#f97316" : active ? "#fefce8" : eligible ? "#ffffff" : team.accent}
        strokeWidth={active || selected || eligible ? 0.85 : 0.45}
        strokeDasharray={isTemporary ? "1.4 1.1" : undefined}
      />
      {active && (
        <circle
          cx={player.position.x}
          cy={player.position.y}
          r={4.55}
          fill="none"
          stroke="rgba(254,252,232,0.82)"
          strokeWidth={0.45}
        />
      )}
      {player.hasBall && (
        <circle
          cx={player.position.x}
          cy={player.position.y}
          r={5.25}
          fill="none"
          stroke="#fb923c"
          strokeWidth={0.55}
        />
      )}
      <text
        x={player.position.x}
        y={player.position.y + 0.9}
        textAnchor="middle"
        fontSize="3.7"
        fontWeight="900"
        fill={team.accent}
        pointerEvents="none"
      >
        {team.marker}
      </text>
      <rect
        x={player.position.x - 2.8}
        y={player.position.y + 3.8}
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
        y={player.position.y + 6.35}
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
  }, []);

  const resumeFromPause = useCallback(() => {
    const startedAt = pauseStartedAtRef.current;
    const currentNow = nowMs();
    const pauseMs = startedAt === null ? 0 : currentNow - startedAt;
    pauseStartedAtRef.current = null;
    setPaused(false);
    setMatch((current) => shiftActiveClocks(current, pauseMs));
    setRenderNow(currentNow);
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
      if (event.key.toLowerCase() === "h") {
        setHelpOpen(true);
        return;
      }
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        restart();
        return;
      }
      if (event.key.toLowerCase() === "p") {
        event.preventDefault();
        if (pausedRef.current) resumeFromPause();
        else pauseGame();
        return;
      }
      if (pausedRef.current || isEditableTarget(event.target) || !isGameTypingKey(event.key)) {
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

    const deadline =
      match.phase === "DEFENSE_TYPING"
        ? match.currentPlay?.defenseDeadlineAtMs
        : match.selectionDeadlineAtMs;
    if (deadline === undefined) return undefined;

    const delay = Math.max(0, deadline - nowMs());
    const timeoutId = window.setTimeout(() => {
      const currentNow = nowMs();
      setRenderNow(currentNow);
      setMatch((current) => checkHiddenDeadlines(current, currentNow, CONFIG));
    }, delay + 12);

    return () => window.clearTimeout(timeoutId);
  }, [match.phase, match.selectionDeadlineAtMs, match.currentPlay?.defenseDeadlineAtMs, paused]);

  useEffect(() => {
    if (paused || match.phase !== "DEFENSE_TYPING") return undefined;

    let frameId = 0;
    const tick = () => {
      setRenderNow(nowMs());
      frameId = window.requestAnimationFrame(tick);
    };
    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [match.phase, paused]);

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
  const offenseTargetKeys = new Set(offenseTargets.map((target) => target.key));
  const eligibleDefenderKeys = new Set(
    match.phase === "DEFENSE_SELECT" || match.phase === "DEFENSE_TYPING"
      ? match.currentPlay?.eligibleInterceptions.map((option) => option.defenderKey) ?? []
      : []
  );
  const selectedDefenderId = match.currentPlay?.selectedInterception?.defenderId;
  const ball = getModeledBallPosition(match, renderNow);
  const phrasePlayer =
    match.phase === "DEFENSE_TYPING" && selectedDefenderId
      ? match.players.find((player) => player.id === selectedDefenderId) ?? activePlayer
      : activePlayer;
  const phraseAnchor = constrainPhraseAnchor(phrasePlayer.position, CONFIG.field);
  const possessionTeam = CONFIG.teams[match.possessionTeam];
  const statusLine =
    match.phase === "OFFENSE_SELECT"
      ? `${possessionTeam.name}: choose a teammate or goal target`
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

  const handleGoalClick = (goalKey: string) => {
    if (!paused && matchRef.current.phase === "OFFENSE_SELECT") {
      actOnKey(goalKey);
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
              <Tooltip title={paused ? "Resume" : "Pause"}>
                <IconButton
                  onClick={paused ? resumeFromPause : pauseGame}
                  sx={{ color: "#f8fafc" }}
                  aria-label={paused ? "Resume match" : "Pause match"}
                >
                  {paused ? <PlayArrowIcon /> : <PauseIcon />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Help">
                <IconButton
                  onClick={() => setHelpOpen(true)}
                  sx={{ color: "#f8fafc" }}
                  aria-label="Open help"
                >
                  <HelpOutlineIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Restart">
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
              sx={{
                position: "relative",
                width: "100%",
                aspectRatio: "5 / 3",
                minHeight: { xs: 310, sm: 430, lg: 560 },
                overflow: "hidden",
                borderRadius: 1,
                border: "2px solid rgba(240,253,244,0.7)",
                bgcolor: "#16803c",
              }}
            >
              <svg
                viewBox="-5 -4 110 68"
                role="img"
                aria-label="Soccer field"
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
                <rect x="-3.4" y="23" width="3.4" height="14" rx="0.4" fill="#e2e8f0" stroke="#0f172a" strokeWidth="0.28" />
                <rect x="100" y="23" width="3.4" height="14" rx="0.4" fill="#e2e8f0" stroke="#0f172a" strokeWidth="0.28" />

                {CONFIG.goals.map((goal) => (
                  <g key={goal.id} onClick={() => handleGoalClick(goal.key)} style={{ cursor: "pointer" }} role="button">
                    <circle
                      cx={goal.point.x}
                      cy={goal.point.y}
                      r={3.2}
                      fill={CONFIG.teams[goal.scoringTeam].color}
                      stroke={offenseTargetKeys.has(goal.key) ? "#f97316" : "#f8fafc"}
                      strokeWidth={offenseTargetKeys.has(goal.key) ? 0.8 : 0.45}
                    />
                    <text
                      x={goal.point.x}
                      y={goal.point.y + 1.05}
                      textAnchor="middle"
                      fontSize="3.2"
                      fontWeight="950"
                      fill={CONFIG.teams[goal.scoringTeam].accent}
                      pointerEvents="none"
                    >
                      {goal.key}
                    </text>
                  </g>
                ))}

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
                  <circle cx={ball.x} cy={ball.y} r="1.95" fill="#f8fafc" stroke="#0f172a" strokeWidth="0.35" />
                  <path
                    d={`M ${ball.x - 1.2} ${ball.y} L ${ball.x + 1.2} ${ball.y} M ${ball.x} ${ball.y - 1.2} L ${ball.x} ${ball.y + 1.2}`}
                    stroke="#0f172a"
                    strokeWidth="0.18"
                    strokeLinecap="round"
                  />
                </g>
              </svg>

              {match.activeChallenge && (
                <Box
                  sx={{
                    position: "absolute",
                    ...percent(phraseAnchor),
                    transform: "translate(-50%, -50%)",
                    zIndex: 3,
                    pointerEvents: "none",
                  }}
                >
                  <ChallengeText challenge={match.activeChallenge} />
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
                      Resume
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
                  {match.phase === "OFFENSE_SELECT" &&
                    offenseTargets.map((target) => (
                      <Chip
                        key={`${target.kind}-${target.id}`}
                        label={`${target.key} ${target.kind === "goal" ? "goal" : target.label}`}
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
              The team with the ball types a teammate letter to pass or the opponent goal letter to shoot.
              Then type the phrase exactly. Mistakes stay in the text until you backspace and fix them.
            </Typography>
            <Typography>
              After a pass or shot phrase is complete, the defending team can type an eligible defender
              letter. A defender near the path gets a shorter phrase, but must finish before the ball
              reaches the interception point.
            </Typography>
            <Typography>
              Interceptors keep their new field spot briefly, which can open new passing lanes. First team
              to {CONFIG.winningScore} goals wins.
            </Typography>
            <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
              <Button startIcon={<PauseIcon />} onClick={pauseGame}>
                Pause
              </Button>
              <Button startIcon={<RestartAltIcon />} onClick={restart}>
                Restart
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
