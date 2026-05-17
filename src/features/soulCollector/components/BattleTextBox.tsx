import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import { keyframes } from "@mui/material/styles";
import type { BattleAnimation, BattleMessage, Effectiveness } from "../types";
import { StyledBattleText } from "../uiHelpers";
import { RollBandBar } from "./RollBandBar";

const TYPE_SPEED_MS = 12;
const ANIMATION_MS = 900;

const lungeRight = keyframes`
  0% { transform: translateX(0) scale(1); }
  35% { transform: translateX(34px) scale(1.08); }
  55% { transform: translateX(18px) scale(1.04); }
  100% { transform: translateX(0) scale(1); }
`;

const lungeLeft = keyframes`
  0% { transform: translateX(0) scale(1); }
  35% { transform: translateX(-34px) scale(1.08); }
  55% { transform: translateX(-18px) scale(1.04); }
  100% { transform: translateX(0) scale(1); }
`;

const projectileRight = keyframes`
  0% { left: 30%; opacity: 0; transform: translate(-50%, -50%) scale(0.35); }
  18% { opacity: 1; }
  72% { left: 70%; opacity: 1; transform: translate(-50%, -50%) scale(1.15); }
  100% { left: 76%; opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
`;

const projectileLeft = keyframes`
  0% { left: 70%; opacity: 0; transform: translate(-50%, -50%) scale(0.35); }
  18% { opacity: 1; }
  72% { left: 30%; opacity: 1; transform: translate(-50%, -50%) scale(1.15); }
  100% { left: 24%; opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
`;

const shieldPulse = keyframes`
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.55); }
  25% { opacity: 1; transform: translate(-50%, -50%) scale(1.12); }
  65% { opacity: 0.82; transform: translate(-50%, -50%) scale(0.95); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1.22); }
`;

const impactBurst = keyframes`
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.4) rotate(0deg); }
  22% { opacity: 1; transform: translate(-50%, -50%) scale(1.2) rotate(18deg); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1.7) rotate(45deg); }
`;

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  18% { transform: translateX(-8px); }
  36% { transform: translateX(8px); }
  54% { transform: translateX(-5px); }
  72% { transform: translateX(5px); }
`;

const glow = keyframes`
  0%, 100% { box-shadow: 0 0 0 rgba(255, 255, 255, 0); }
  45% { box-shadow: 0 0 26px rgba(255, 255, 255, 0.86); }
`;

function effectivenessColor(effectiveness?: Effectiveness) {
  if (effectiveness === "Super Effective") return "#16a34a";
  if (effectiveness === "Effective") return "#d97706";
  if (effectiveness === "Not Effective") return "#dc2626";
  return "#2563eb";
}

function BattleAnimationView({
  animation,
  complete,
}: {
  animation: BattleAnimation;
  complete: boolean;
}) {
  const attackerIsLeft = animation.attackerSide === "player";
  const left = attackerIsLeft
    ? {
        name: animation.attackerName,
        emoji: animation.attackerEmoji,
        isAttacker: true,
      }
    : {
        name: animation.defenderName,
        emoji: animation.defenderEmoji,
        isAttacker: false,
      };
  const right = attackerIsLeft
    ? {
        name: animation.defenderName,
        emoji: animation.defenderEmoji,
        isAttacker: false,
      }
    : {
        name: animation.attackerName,
        emoji: animation.attackerEmoji,
        isAttacker: true,
      };
  const activeColor = effectivenessColor(animation.effectiveness);
  const lungeAnimation = attackerIsLeft ? lungeRight : lungeLeft;
  const projectileAnimation = attackerIsLeft ? projectileRight : projectileLeft;

  const creatureTile = (side: typeof left) => {
    const isDefender = !side.isAttacker;
    const isActing =
      animation.kind === "attack" ? side.isAttacker : isDefender;
    const shouldLunge = animation.kind === "attack" && side.isAttacker;
    const shouldShake = animation.kind === "impact" && isDefender;
    const showShield = animation.kind === "defense" && isDefender && !complete;
    const showImpact = animation.kind === "impact" && isDefender && !complete;

    return (
      <Stack
        alignItems="center"
        spacing={0.5}
        sx={{
          minWidth: 92,
          width: "30%",
          animation:
            !complete && shouldLunge
              ? `${lungeAnimation} ${ANIMATION_MS}ms cubic-bezier(0.2, 0.9, 0.2, 1)`
              : !complete && shouldShake
                ? `${shake} 520ms ease-out`
                : "none",
          "@media (prefers-reduced-motion: reduce)": {
            animation: "none",
          },
        }}
      >
        <Box
          sx={{
            position: "relative",
            width: 70,
            height: 70,
            borderRadius: 2,
            display: "grid",
            placeItems: "center",
            bgcolor: isActing ? "rgba(37, 99, 235, 0.12)" : "rgba(15, 23, 42, 0.05)",
            border: "1px solid",
            borderColor: isActing ? activeColor : "divider",
            animation:
              !complete && isActing
                ? `${glow} ${ANIMATION_MS}ms ease-in-out`
                : "none",
            "@media (prefers-reduced-motion: reduce)": {
              animation: "none",
            },
          }}
        >
          <Typography aria-hidden variant="h3" sx={{ lineHeight: 1 }}>
            {side.emoji}
          </Typography>

          {showShield && (
            <Box
              sx={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 88,
                height: 88,
                borderRadius: "50%",
                border: "3px solid",
                borderColor: activeColor,
                background:
                  "radial-gradient(circle, rgba(255,255,255,0.75), rgba(37,99,235,0.18) 48%, rgba(37,99,235,0) 70%)",
                animation: `${shieldPulse} ${ANIMATION_MS}ms ease-out`,
                pointerEvents: "none",
              }}
            />
          )}

          {showImpact && (
            <Box
              sx={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 70,
                height: 70,
                borderRadius: "18px",
                border: "3px solid",
                borderColor: activeColor,
                bgcolor: "rgba(255,255,255,0.45)",
                animation: `${impactBurst} ${ANIMATION_MS}ms ease-out`,
                pointerEvents: "none",
              }}
            />
          )}
        </Box>

        <Typography
          variant="caption"
          fontWeight={800}
          noWrap
          sx={{ maxWidth: 116 }}
        >
          {side.name}
        </Typography>
      </Stack>
    );
  };

  return (
    <Box
      sx={{
        position: "relative",
        minHeight: 128,
        borderRadius: 2,
        px: 2,
        py: 1.5,
        overflow: "hidden",
        bgcolor: "rgba(15, 23, 42, 0.04)",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        {creatureTile(left)}

        <Stack alignItems="center" spacing={0.75} sx={{ width: "38%" }}>
          <Typography
            variant="caption"
            fontWeight={900}
            textAlign="center"
            noWrap
            sx={{ maxWidth: "100%" }}
          >
            {animation.moveEmoji} {animation.moveName ?? animation.kind.toUpperCase()}
          </Typography>

          <Box
            sx={{
              position: "relative",
              width: "100%",
              height: 36,
              borderTop: "1px dashed",
              borderBottom: "1px dashed",
              borderColor: "rgba(15,23,42,0.16)",
            }}
          >
            {!complete && animation.kind !== "impact" && (
              <Box
                sx={{
                  position: "absolute",
                  top: "50%",
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  bgcolor: activeColor,
                  border: "2px solid white",
                  boxShadow: `0 0 22px ${activeColor}`,
                  animation: `${projectileAnimation} ${ANIMATION_MS}ms ease-out`,
                  "@media (prefers-reduced-motion: reduce)": {
                    animation: "none",
                    opacity: 0,
                  },
                }}
              />
            )}
          </Box>

          <Stack direction="row" spacing={0.75} flexWrap="wrap" justifyContent="center">
            {animation.effectiveness && (
              <Chip
                size="small"
                label={animation.effectiveness}
                sx={{
                  bgcolor: activeColor,
                  color: "white",
                  fontWeight: 800,
                }}
              />
            )}
            {typeof animation.damage === "number" && (
              <Chip size="small" color="error" label={`${animation.damage} dmg`} />
            )}
            {typeof animation.roll === "number" && (
              <Chip size="small" variant="outlined" label={`Roll ${animation.roll}`} />
            )}
          </Stack>
        </Stack>

        {creatureTile(right)}
      </Stack>
    </Box>
  );
}

export function BattleTextBox({
  messages,
  onAdvance,
  devMode,
}: {
  messages: BattleMessage[];
  onAdvance: () => void;
  devMode: boolean;
}) {
  const [visibleText, setVisibleText] = useState("");
  const [animationComplete, setAnimationComplete] = useState(true);
  const timersRef = useRef<{ typing?: number; animation?: number }>({});
  const currentMessage = messages[0];
  const currentText = currentMessage?.text ?? "";

  const clearRunningTimers = () => {
    if (timersRef.current.typing !== undefined) {
      window.clearInterval(timersRef.current.typing);
    }
    if (timersRef.current.animation !== undefined) {
      window.clearTimeout(timersRef.current.animation);
    }
    timersRef.current = {};
  };

  useEffect(() => {
    clearRunningTimers();
    setVisibleText("");
    setAnimationComplete(!currentMessage?.animation);
    if (!currentText) return;

    let index = 0;
    const typingTimer = window.setInterval(() => {
      index += 1;
      setVisibleText(currentText.slice(0, index));
      if (index >= currentText.length) {
        window.clearInterval(typingTimer);
        timersRef.current.typing = undefined;
      }
    }, TYPE_SPEED_MS);

    const animationTimer = currentMessage?.animation
      ? window.setTimeout(() => {
          setAnimationComplete(true);
          timersRef.current.animation = undefined;
        }, ANIMATION_MS)
      : undefined;
    timersRef.current = { typing: typingTimer, animation: animationTimer };

    return clearRunningTimers;
  }, [currentMessage?.id, currentMessage?.animation, currentText]);

  if (!currentMessage) return null;

  const isFinishedTyping = visibleText.length >= currentText.length;
  const isComplete = isFinishedTyping && animationComplete;

  const finishOrAdvance = () => {
    if (isComplete) {
      clearRunningTimers();
      onAdvance();
      return;
    }

    clearRunningTimers();
    setVisibleText(currentText);
    setAnimationComplete(true);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    finishOrAdvance();
  };

  return (
    <Paper
      role="button"
      tabIndex={0}
      onClick={finishOrAdvance}
      onKeyDown={handleKeyDown}
      sx={{
        p: 2,
        borderRadius: 3,
        border: "3px solid",
        borderColor: "text.primary",
        cursor: "pointer",
        bgcolor: "background.paper",
        boxShadow: 6,
      }}
    >
      <Stack spacing={1.25}>
        {currentMessage.animation && (
          <BattleAnimationView
            key={currentMessage.id}
            animation={currentMessage.animation}
            complete={animationComplete}
          />
        )}

        <Typography variant="body1" fontWeight={700} sx={{ minHeight: 56 }}>
          <StyledBattleText text={visibleText} />
        </Typography>

        {devMode && isFinishedTyping && currentMessage.rollBar && (
          <RollBandBar data={currentMessage.rollBar} />
        )}

        <Typography variant="caption" color="text.secondary">
          {isComplete ? "Click for next" : "Click to finish"}
        </Typography>
      </Stack>
    </Paper>
  );
}
