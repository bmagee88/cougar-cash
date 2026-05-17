import React from "react";
import { Box, Button, Card, CardContent, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import type { BattleState, Combatant, RowIndex, WeaponType } from "../engine/types/combat";

function weaponEmoji(type: WeaponType): string {
  const icons: Record<WeaponType, string> = {
    sword: "⚔️",
    spear: "🔱",
    axe: "🪓",
    mace: "🔨",
    dagger: "🗡️",
    bow: "🏹",
  };

  return icons[type];
}

function characterEmoji(character: Combatant): string {
  const name = character.name.toLowerCase();
  if (character.team === "monsters") {
    if (name.includes("bone")) return "💀";
    if (name.includes("imp")) return "😈";
    return "👹";
  }

  if (name.includes("borin") || name.includes("dain") || name.includes("galen")) return "🛡️";
  if (name.includes("nox") || name.includes("mira")) return "🧙";
  return "🧝";
}

function tokenPosition(character: Combatant, laneIndex: number, laneSize: number): { x: number; y: number } {
  const offset = (laneIndex - (laneSize - 1) / 2) * 15;

  if (character.row === 0) return { x: 15, y: 38 + offset };
  if (character.row === 1) return { x: 33, y: 52 + offset };
  if (character.row === 2) return { x: 67, y: 52 + offset };
  return { x: 85, y: 38 + offset };
}

function rowLabel(row: RowIndex): string {
  if (row === 0 || row === 3) return "Back";
  return "Front";
}

function sortForField(a: Combatant, b: Combatant): number {
  if (a.row !== b.row) return a.row - b.row;
  return a.name.localeCompare(b.name);
}

export function BattleGroupView({
  state,
  selectedDefenderId,
  activeTurnId,
  initiativeOrder,
  initiativeScores,
  unreachableTargetId,
  onNextTurn,
  onAttemptTarget,
  onStats,
  onHeal,
}: {
  state: BattleState;
  selectedDefenderId: string;
  activeTurnId: string;
  initiativeOrder: string[];
  initiativeScores: Record<string, number>;
  unreachableTargetId: string | null;
  onNextTurn: () => void;
  onAttemptTarget: (id: string) => void;
  onStats: (c: Combatant) => void;
  onHeal: (id: string) => void;
}) {
  const group = state.groups[0];
  const combatants = group.combatantIds
    .map((id) => state.combatants[id])
    .filter((character): character is Combatant => Boolean(character))
    .sort(sortForField);
  const activeCharacter = state.combatants[activeTurnId];

  const renderToken = (character: Combatant) => {
    const laneMates = combatants.filter((candidate) => candidate.row === character.row);
    const laneIndex = laneMates.findIndex((candidate) => candidate.id === character.id);
    const position = tokenPosition(character, laneIndex, laneMates.length);
    const isActive = character.id === activeTurnId;
    const isTarget = character.id === selectedDefenderId;
    const isUnreachable = character.id === unreachableTargetId;
    const isOpponent = Boolean(activeCharacter && activeCharacter.team !== character.team);
    const fightPercent = Math.max(0, Math.min(100, (character.fight / character.maxFight) * 100));
    const weapon = character.weapons[0];

    const handleClick = () => {
      if (isOpponent) onAttemptTarget(character.id);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!isOpponent || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      onAttemptTarget(character.id);
    };

    return (
      <Box
        key={character.id}
        role={isOpponent ? "button" : undefined}
        tabIndex={isOpponent ? 0 : undefined}
        aria-label={isOpponent ? `Target ${character.name}` : character.name}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        sx={{
          "@keyframes turnBob": {
            "0%, 100%": { transform: "translateY(0)" },
            "50%": { transform: "translateY(-8px)" },
          },
          "@keyframes ringPulse": {
            "0%, 100%": { opacity: 0.58, transform: "translateX(-50%) scale(1)" },
            "50%": { opacity: 1, transform: "translateX(-50%) scale(1.08)" },
          },
          "@keyframes targetShake": {
            "0%, 100%": { transform: "translate(-50%, -50%)" },
            "20%": { transform: "translate(calc(-50% - 8px), -50%)" },
            "40%": { transform: "translate(calc(-50% + 8px), -50%)" },
            "60%": { transform: "translate(calc(-50% - 5px), -50%)" },
            "80%": { transform: "translate(calc(-50% + 5px), -50%)" },
          },
          position: "absolute",
          left: `${position.x}%`,
          top: `${position.y}%`,
          width: 126,
          minHeight: 146,
          transform: "translate(-50%, -50%)",
          animation: isUnreachable ? "targetShake 0.34s ease-in-out 2" : undefined,
          border: "1px solid",
          borderColor: isActive ? "primary.main" : isTarget ? "error.main" : "divider",
          bgcolor: isActive
            ? "rgba(125, 211, 252, 0.16)"
            : isTarget
              ? "rgba(251, 113, 133, 0.16)"
              : "rgba(15, 23, 42, 0.9)",
          boxShadow: isActive
            ? "0 0 0 2px rgba(125, 211, 252, 0.28), 0 18px 30px rgba(0, 0, 0, 0.34)"
            : isTarget
              ? "0 0 0 2px rgba(251, 113, 133, 0.26), 0 14px 24px rgba(0, 0, 0, 0.3)"
              : "0 12px 26px rgba(0, 0, 0, 0.28)",
          borderRadius: 2,
          cursor: isOpponent ? "crosshair" : "default",
          p: 1,
          textAlign: "center",
          transition: "background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
          zIndex: isActive ? 5 : isTarget ? 4 : 3,
          "&:focus-visible": {
            outline: "2px solid",
            outlineColor: "primary.light",
            outlineOffset: 3,
          },
        }}
      >
        {isActive && (
          <Box
            sx={{
              position: "absolute",
              left: 0,
              right: 0,
              top: -32,
              color: "primary.light",
              fontSize: 24,
              fontWeight: 900,
              lineHeight: 1,
              textShadow: "0 3px 10px rgba(0, 0, 0, 0.8)",
              animation: "turnBob 1.1s ease-in-out infinite",
            }}
          >
            ▼
          </Box>
        )}

        {isActive && (
          <Box
            sx={{
              position: "absolute",
              left: "50%",
              bottom: 38,
              width: 80,
              height: 18,
              border: "2px solid",
              borderColor: "primary.light",
              borderRadius: "50%",
              bgcolor: "rgba(125, 211, 252, 0.14)",
              boxShadow: "0 0 20px rgba(125, 211, 252, 0.5)",
              animation: "ringPulse 1.3s ease-in-out infinite",
            }}
          />
        )}

        <Box
          sx={{
            position: "absolute",
            top: 42,
            right: character.team === "heroes" ? 17 : "auto",
            left: character.team === "monsters" ? 17 : "auto",
            zIndex: 4,
            fontSize: 20,
            filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.7))",
          }}
          title={weapon.name}
        >
          {weaponEmoji(weapon.weaponType)}
        </Box>

        <Box sx={{ position: "relative", zIndex: 3, fontSize: 52, lineHeight: 1, mb: 0.75 }}>
          {characterEmoji(character)}
        </Box>

        <Typography fontWeight={900} sx={{ fontSize: 14, lineHeight: 1.15 }}>
          {character.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          {rowLabel(character.row)} · init {initiativeScores[character.id] ?? 0}
        </Typography>

        <Box sx={{ mt: 0.75 }}>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="caption" color="text.secondary">Fight</Typography>
            <Typography variant="caption" color="text.secondary">{character.fight}/{character.maxFight}</Typography>
          </Stack>
          <LinearProgress variant="determinate" value={fightPercent} sx={{ height: 6, borderRadius: 999 }} />
        </Box>

        <Stack direction="row" gap={0.5} justifyContent="center" sx={{ mt: 0.9 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={(event) => {
              event.stopPropagation();
              onStats(character);
            }}
            sx={{ minWidth: 48, px: 0.75 }}
          >
            Stats
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={(event) => {
              event.stopPropagation();
              onHeal(character.id);
            }}
            sx={{ minWidth: 44, px: 0.75 }}
          >
            Heal
          </Button>
        </Stack>
      </Box>
    );
  };

  return (
    <Card>
      <CardContent>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "flex-start" }} gap={1.5} sx={{ mb: 1.5 }}>
          <Box>
            <Typography variant="h6" fontWeight={900}>{group.name}</Typography>
            <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.75 }}>
              {group.effects.map((effect) => <Chip key={effect} size="small" label={effect} color="warning" variant="outlined" />)}
            </Stack>
          </Box>

          <Stack direction="row" gap={1} flexWrap="wrap" justifyContent={{ xs: "flex-start", md: "flex-end" }}>
            {activeCharacter && (
              <Chip
                color="primary"
                label={`Turn: ${characterEmoji(activeCharacter)} ${activeCharacter.name}`}
                sx={{ fontWeight: 900 }}
              />
            )}
            <Button variant="outlined" onClick={onNextTurn}>Next Turn</Button>
          </Stack>
        </Stack>

        <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mb: 1.5 }}>
          {initiativeOrder.map((id, index) => {
            const character = state.combatants[id];
            if (!character) return null;
            const active = id === activeTurnId;

            return (
              <Chip
                key={id}
                size="small"
                color={active ? "primary" : "default"}
                variant={active ? "filled" : "outlined"}
                label={`${index + 1}. ${characterEmoji(character)} ${character.name} (${initiativeScores[id] ?? 0})`}
                sx={{ fontWeight: active ? 900 : 700 }}
              />
            );
          })}
        </Stack>

        <Box sx={{ overflowX: "auto", pb: 0.5 }}>
          <Box
            sx={{
              position: "relative",
              width: "100%",
              minWidth: 620,
              minHeight: 470,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              overflow: "hidden",
              background:
                "linear-gradient(90deg, rgba(14, 165, 233, 0.15), rgba(148, 163, 184, 0.08) 48%, rgba(251, 113, 133, 0.15)), radial-gradient(circle at 50% 45%, rgba(250, 204, 21, 0.1), transparent 42%)",
            }}
          >
            <Box
              sx={{
                position: "absolute",
                inset: "42px 44px",
                borderTop: "1px solid",
                borderBottom: "1px solid",
                borderColor: "rgba(203, 213, 225, 0.24)",
                transform: "skewY(-8deg)",
              }}
            />
            <Box
              sx={{
                position: "absolute",
                left: "50%",
                top: 34,
                bottom: 34,
                borderLeft: "1px dashed",
                borderColor: "rgba(203, 213, 225, 0.32)",
              }}
            />
            <Typography sx={{ position: "absolute", left: 24, top: 18, fontWeight: 900, color: "primary.light" }}>
              Heroes
            </Typography>
            <Typography sx={{ position: "absolute", right: 24, top: 18, fontWeight: 900, color: "error.light" }}>
              Enemies
            </Typography>
            <Typography variant="caption" sx={{ position: "absolute", left: 28, bottom: 18, color: "text.secondary" }}>
              Weight: lower is faster · Con: toughness
            </Typography>
            <Typography variant="caption" sx={{ position: "absolute", right: 28, bottom: 18, color: "text.secondary" }}>
              Click an opposing emoji to target
            </Typography>

            {combatants.map(renderToken)}

            {combatants.length === 0 && (
              <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "text.secondary" }}>
                Empty group
              </Box>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
