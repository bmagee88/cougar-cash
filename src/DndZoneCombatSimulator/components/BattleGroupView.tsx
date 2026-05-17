import React from "react";
import { Box, Button, Card, CardContent, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import type { AttackPlan, AttackStep, BattleState, Combatant, RowIndex, Team, WeaponType } from "../engine/types/combat";
import { BODY_SCALE_MAX, BODY_SCALE_MIN, bodyMap, missZones } from "../engine/data/bodyMap";
import { clamp } from "../engine/utils/math";

const FLESH_COLOR = "#d8c39f";
const MISS_COLOR = "#22c55e";
const ARMOR_COLOR = "#4682b4";

function slotToRow(slot: number): RowIndex {
  return (slot % 4) as RowIndex;
}

function teamCanUseSlot(team: Team, slot: number): boolean {
  const col = slot % 4;
  return team === "heroes" ? col === 0 || col === 1 : col === 2 || col === 3;
}

function rowName(row: RowIndex): string {
  if (row === 0 || row === 3) return "back";
  return "front";
}

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

function shortName(name: string): string {
  return name.length > 16 ? `${name.slice(0, 14)}...` : name;
}

function motionForCharacter(character: Combatant, plan: AttackPlan | null, step: AttackStep): string | undefined {
  if (!plan) return undefined;

  const lunge = character.team === "heroes" ? "lungeRight" : "lungeLeft";
  const evade = character.team === "heroes" ? "evadeLeft" : "evadeRight";
  const flesh = character.team === "heroes" ? "fleshLeft" : "fleshRight";

  if (character.id === plan.attackerId && (step === "initial" || step === "corrected")) return `${lunge} 0.48s ease-in-out`;
  if (character.id === plan.defenderId && step === "evaded") return `${evade} 0.48s ease-in-out`;
  if (character.id === plan.defenderId && step === "resolved") {
    if (plan.hitKind === "miss") return "missImpact 0.7s ease-in-out";
    if (plan.hitKind === "armor") return "armorImpact 0.72s ease-in-out";
    return `${flesh} 0.95s ease-in-out`;
  }

  return undefined;
}

function BodyCoverageBar({ character, plan, step }: { character: Combatant; plan: AttackPlan | null; step: AttackStep }) {
  const armorSegments = character.armor.flatMap((piece) =>
    piece.coverageRanges.map((range) => ({
      id: `${piece.id}-${range.start}-${range.end}`,
      start: clamp(range.start, BODY_SCALE_MIN, BODY_SCALE_MAX),
      end: clamp(range.end, BODY_SCALE_MIN, BODY_SCALE_MAX),
    })),
  );

  const markers =
    plan?.defenderId === character.id
      ? [
          { value: plan.initialMarker, show: ["initial", "evaded", "corrected", "resolved"].includes(step), color: "primary.light" },
          { value: plan.afterDefenderMarker, show: ["evaded", "corrected", "resolved"].includes(step), color: "warning.main" },
          { value: plan.finalMarker, show: ["corrected", "resolved"].includes(step), color: plan.hitKind === "flesh" ? "error.light" : plan.hitKind === "armor" ? "primary.main" : "success.main" },
        ].filter((marker) => marker.show)
      : [];

  return (
    <Box
      aria-label={`${character.name} body coverage`}
      sx={{
        position: "relative",
        width: 18,
        height: 110,
        flex: "0 0 18px",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 999,
        overflow: "hidden",
        bgcolor: FLESH_COLOR,
        boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.2)",
      }}
    >
      {bodyMap.map((range) => {
        const bottom = (range.start / BODY_SCALE_MAX) * 100;
        const height = ((range.end - range.start + 1) / (BODY_SCALE_MAX + 1)) * 100;
        return (
          <Box
            key={range.part}
            sx={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: `${bottom}%`,
              height: `${height}%`,
              bgcolor: FLESH_COLOR,
              borderTop: "1px solid rgba(0, 0, 0, 0.18)",
            }}
          />
        );
      })}
      {missZones.map((zone) => {
        const bottom = (zone.start / BODY_SCALE_MAX) * 100;
        const height = ((zone.end - zone.start + 1) / (BODY_SCALE_MAX + 1)) * 100;
        return <Box key={zone.label} sx={{ position: "absolute", left: 0, right: 0, bottom: `${bottom}%`, height: `${height}%`, bgcolor: MISS_COLOR }} />;
      })}
      {armorSegments.map((segment) => {
        const bottom = (segment.start / BODY_SCALE_MAX) * 100;
        const height = ((segment.end - segment.start + 1) / (BODY_SCALE_MAX + 1)) * 100;
        return <Box key={segment.id} sx={{ position: "absolute", left: 4, right: 4, bottom: `${bottom}%`, height: `${height}%`, bgcolor: ARMOR_COLOR, borderRadius: 999 }} />;
      })}
      {markers.map((marker, index) => (
        <Box
          key={`${marker.value}-${index}`}
          sx={{
            position: "absolute",
            right: -2,
            bottom: `calc(${clamp((marker.value / BODY_SCALE_MAX) * 100, -4, 104)}% - 6px)`,
            color: marker.color,
            fontSize: 13,
            lineHeight: 1,
            textShadow: "0 1px 4px rgba(0, 0, 0, 0.9)",
          }}
        >
          ◀
        </Box>
      ))}
    </Box>
  );
}

export function BattleGroupView({
  state,
  fieldSlots,
  placingCharacterId,
  selectedDefenderId,
  activeTurnId,
  initiativeOrder,
  initiativeScores,
  unreachableTargetId,
  plan,
  step,
  onTileClick,
  onCancelPlacement,
  onNextTurn,
  onAttemptTarget,
  onStats,
  onHeal,
}: {
  state: BattleState;
  fieldSlots: Record<string, number>;
  placingCharacterId: string | null;
  selectedDefenderId: string;
  activeTurnId: string;
  initiativeOrder: string[];
  initiativeScores: Record<string, number>;
  unreachableTargetId: string | null;
  plan: AttackPlan | null;
  step: AttackStep;
  onTileClick: (slot: number) => void;
  onCancelPlacement: () => void;
  onNextTurn: () => void;
  onAttemptTarget: (id: string) => void;
  onStats: (c: Combatant) => void;
  onHeal: (id: string) => void;
}) {
  const group = state.groups[0];
  const activeCharacter = state.combatants[activeTurnId];
  const placingCharacter = placingCharacterId ? state.combatants[placingCharacterId] : undefined;

  const activeCombatants = group.combatantIds
    .map((id) => state.combatants[id])
    .filter((character): character is Combatant => Boolean(character));

  const bySlot = Object.fromEntries(
    activeCombatants
      .map((character) => [fieldSlots[character.id], character] as const)
      .filter(([slot]) => slot !== undefined),
  ) as Record<number, Combatant>;

  const renderToken = (character: Combatant) => {
    const isActive = character.id === activeTurnId;
    const isTarget = character.id === selectedDefenderId;
    const isUnreachable = character.id === unreachableTargetId;
    const isOpponent = Boolean(activeCharacter && activeCharacter.team !== character.team);
    const fightPercent = Math.max(0, Math.min(100, (character.fight / character.maxFight) * 100));
    const weapon = character.weapons[0];
    const showShield = plan?.defenderId === character.id && step === "resolved" && plan.hitKind === "armor";

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
            "0%, 100%": { transform: "translateX(0)" },
            "20%": { transform: "translateX(-8px)" },
            "40%": { transform: "translateX(8px)" },
            "60%": { transform: "translateX(-5px)" },
            "80%": { transform: "translateX(5px)" },
          },
          "@keyframes lungeRight": {
            "0%, 100%": { transform: "translateX(0)" },
            "45%": { transform: "translateX(18px)" },
          },
          "@keyframes lungeLeft": {
            "0%, 100%": { transform: "translateX(0)" },
            "45%": { transform: "translateX(-18px)" },
          },
          "@keyframes evadeRight": {
            "0%, 100%": { transform: "translateX(0)" },
            "45%": { transform: "translateX(18px)" },
          },
          "@keyframes evadeLeft": {
            "0%, 100%": { transform: "translateX(0)" },
            "45%": { transform: "translateX(-18px)" },
          },
          "@keyframes missImpact": {
            "0%, 100%": { transform: "translateY(0)", backgroundColor: "rgba(15, 23, 42, 0.92)" },
            "45%": { transform: "translateY(12px)", backgroundColor: "rgba(34, 197, 94, 0.32)" },
          },
          "@keyframes armorImpact": {
            "0%, 100%": { transform: "translateY(0)", backgroundColor: "rgba(15, 23, 42, 0.92)" },
            "45%": { transform: "translateY(10px)", backgroundColor: "rgba(70, 130, 180, 0.38)" },
          },
          "@keyframes fleshRight": {
            "0%, 100%": { transform: "translateX(0)", backgroundColor: "rgba(15, 23, 42, 0.92)" },
            "48%": { transform: "translateX(22px)", backgroundColor: "rgba(248, 113, 113, 0.34)" },
          },
          "@keyframes fleshLeft": {
            "0%, 100%": { transform: "translateX(0)", backgroundColor: "rgba(15, 23, 42, 0.92)" },
            "48%": { transform: "translateX(-22px)", backgroundColor: "rgba(248, 113, 113, 0.34)" },
          },
          "@keyframes shieldPop": {
            "0%": { opacity: 0, transform: "translate(-50%, -50%) scale(0.6)" },
            "35%": { opacity: 1, transform: "translate(-50%, -60%) scale(1.2)" },
            "100%": { opacity: 0, transform: "translate(-50%, -78%) scale(0.9)" },
          },
          position: "relative",
          height: "100%",
          minHeight: 158,
          border: "1px solid",
          borderColor: isActive ? "primary.main" : isTarget ? "error.main" : "divider",
          bgcolor: isActive
            ? "rgba(125, 211, 252, 0.16)"
            : isTarget
              ? "rgba(251, 113, 133, 0.16)"
              : "rgba(15, 23, 42, 0.92)",
          boxShadow: isActive
            ? "0 0 0 2px rgba(125, 211, 252, 0.28), 0 18px 30px rgba(0, 0, 0, 0.34)"
            : isTarget
              ? "0 0 0 2px rgba(251, 113, 133, 0.26), 0 14px 24px rgba(0, 0, 0, 0.3)"
              : "0 12px 26px rgba(0, 0, 0, 0.28)",
          borderRadius: 2,
          cursor: isOpponent ? "crosshair" : "default",
          p: 1,
          overflow: "visible",
          opacity: character.fight <= 0 ? 0.52 : 1,
          filter: character.fight <= 0 ? "grayscale(0.8)" : undefined,
          animation: isUnreachable ? "targetShake 0.34s ease-in-out 2" : motionForCharacter(character, plan, step),
          transition: "background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
          "& .shield-pop": {
            animation: showShield ? "shieldPop 0.75s ease-in-out" : undefined,
          },
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
              top: -27,
              color: "primary.light",
              fontSize: 22,
              fontWeight: 900,
              lineHeight: 1,
              textAlign: "center",
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
              bottom: 44,
              width: 78,
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

        {showShield && (
          <Box
            className="shield-pop"
            sx={{
              position: "absolute",
              left: "50%",
              top: "44%",
              zIndex: 9,
              fontSize: 42,
              opacity: 0,
              pointerEvents: "none",
              filter: "drop-shadow(0 4px 10px rgba(0, 0, 0, 0.8))",
            }}
          >
            🛡️
          </Box>
        )}

        <Stack direction="row" gap={1} alignItems="stretch" sx={{ height: "100%" }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ position: "relative", textAlign: "center", minHeight: 60 }}>
              <Box
                sx={{
                  position: "absolute",
                  top: 35,
                  right: character.team === "heroes" ? 14 : "auto",
                  left: character.team === "monsters" ? 14 : "auto",
                  zIndex: 4,
                  fontSize: 19,
                  filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.7))",
                }}
                title={weapon.name}
              >
                {weaponEmoji(weapon.weaponType)}
              </Box>
              <Box sx={{ position: "relative", zIndex: 3, fontSize: 48, lineHeight: 1 }}>
                {characterEmoji(character)}
              </Box>
            </Box>

            <Typography fontWeight={900} sx={{ fontSize: 14, lineHeight: 1.15, textAlign: "center" }}>
              {shortName(character.name)}
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
          <BodyCoverageBar character={character} plan={plan} step={step} />
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
            {placingCharacter && (
              <Chip
                color="secondary"
                label={`Place ${characterEmoji(placingCharacter)} ${placingCharacter.name}`}
                onDelete={onCancelPlacement}
                sx={{ fontWeight: 900 }}
              />
            )}
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

        <Box
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            p: 1.5,
            overflowX: "auto",
            background:
              "linear-gradient(90deg, rgba(14, 165, 233, 0.15), rgba(148, 163, 184, 0.08) 48%, rgba(251, 113, 133, 0.15)), radial-gradient(circle at 50% 45%, rgba(250, 204, 21, 0.1), transparent 42%)",
          }}
        >
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography fontWeight={900} color="primary.light">Heroes</Typography>
            <Typography fontWeight={900} color="error.light">Enemies</Typography>
          </Stack>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(126px, 1fr))",
              gridTemplateRows: "repeat(4, minmax(158px, auto))",
              gap: 1.25,
              minWidth: 640,
              borderRadius: 2,
            }}
          >
            {Array.from({ length: 16 }, (_, slot) => {
              const occupant = bySlot[slot];
              const row = slotToRow(slot);
              const isValidPlacement = Boolean(placingCharacter && teamCanUseSlot(placingCharacter.team, slot));

              return (
                <Box
                  key={slot}
                  role={placingCharacter ? "button" : undefined}
                  tabIndex={placingCharacter ? 0 : undefined}
                  aria-label={`Battle tile ${slot + 1} ${rowName(row)}`}
                  onClick={() => {
                    if (isValidPlacement) onTileClick(slot);
                  }}
                  onKeyDown={(event) => {
                    if (!isValidPlacement || (event.key !== "Enter" && event.key !== " ")) return;
                    event.preventDefault();
                    onTileClick(slot);
                  }}
                  sx={{
                    minHeight: 158,
                    border: "1px solid",
                    borderColor: isValidPlacement ? "secondary.main" : "rgba(203, 213, 225, 0.09)",
                    bgcolor: isValidPlacement ? "rgba(192, 132, 252, 0.1)" : "rgba(15, 23, 42, 0.16)",
                    borderRadius: 2,
                    p: 0.5,
                    cursor: isValidPlacement ? "copy" : "default",
                    transition: "border-color 160ms ease, background-color 160ms ease",
                    "&:focus-visible": {
                      outline: "2px solid",
                      outlineColor: "secondary.light",
                      outlineOffset: 2,
                    },
                  }}
                >
                  {occupant ? (
                    renderToken(occupant)
                  ) : (
                    <Box sx={{ height: "100%", minHeight: 142, display: "grid", placeItems: "center", color: "text.secondary", fontSize: 12 }}>
                      {isValidPlacement ? `Place on ${rowName(row)}` : ""}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
          <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">Front row gaps collapse reach by one step.</Typography>
            <Typography variant="caption" color="text.secondary">
              {placingCharacter ? "Click a highlighted tile to place or replace." : "Click an opposing emoji to target."}
            </Typography>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
