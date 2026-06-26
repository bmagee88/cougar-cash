import React, { useMemo, useRef, useState } from "react";
import { Box, Button, Card, CardContent, Chip, Divider, Popover, Stack, Typography } from "@mui/material";
import type { AttackMove, AttackPlan, AttackStep, BattleState, Combatant, RowIndex, Team } from "../engine/types/combat";
import { applyAttackPlan, buildAttackPlan } from "../engine/rules/attackResolver";
import { moveLabel } from "../engine/rules/labels";
import { canMeleeAttack } from "../engine/rules/targetingRules";

type MainMenuId = "attack" | "guard" | "move" | "item";

const mainMenu: { id: MainMenuId; label: string; icon: string }[] = [
  { id: "attack", label: "Attack", icon: "⚔️" },
  { id: "guard", label: "Guard", icon: "🛡️" },
  { id: "move", label: "Move", icon: "↔" },
  { id: "item", label: "Item", icon: "🧪" },
];

const attackGroups: { title: string; icon: string; moves: AttackMove[] }[] = [
  { title: "Slashes", icon: "🗡️", moves: ["slashHigh", "slashMid", "slashLow", "cleave"] },
  { title: "Stabs", icon: "📍", moves: ["stabHead", "stabChest", "stabLegs"] },
];

function slotToRow(slot: number): RowIndex {
  return (slot % 4) as RowIndex;
}

function frontRowForTeam(team: Team): RowIndex {
  return team === "heroes" ? 1 : 2;
}

function backRowForTeam(team: Team): RowIndex {
  return team === "heroes" ? 0 : 3;
}

function rowLabelForMove(team: Team, row: RowIndex): string {
  return row === frontRowForTeam(team) ? "Front" : "Back";
}

export function AttackPanel({
  state,
  setState,
  selectedAttackerId,
  selectedDefenderId,
  plan,
  setPlan,
  step,
  setStep,
  fieldSlots,
  onSwapWithAlly,
  onMoveToSlot,
  onTurnComplete,
}: {
  state: BattleState;
  setState: React.Dispatch<React.SetStateAction<BattleState>>;
  selectedAttackerId: string;
  selectedDefenderId: string;
  plan: AttackPlan | null;
  setPlan: (p: AttackPlan | null) => void;
  step: AttackStep;
  setStep: (s: AttackStep) => void;
  fieldSlots: Record<string, number>;
  onSwapWithAlly: (allyId: string) => void;
  onMoveToSlot: (slot: number) => void;
  onTurnComplete: () => void;
}) {
  const [selectedMenuIndex, setSelectedMenuIndex] = useState(0);
  const [openMenu, setOpenMenu] = useState<MainMenuId | null>(null);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);
  const [lastMove, setLastMove] = useState<AttackMove>("slashMid");
  const menuRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const attacker = state.combatants[selectedAttackerId];
  const defender = state.combatants[selectedDefenderId];
  const weapon = attacker?.weapons[0];
  const reachable = attacker && defender && weapon ? canMeleeAttack(attacker, defender, weapon, state) : false;
  const allies = useMemo(
    () =>
      state.groups[0].combatantIds
        .map((id) => state.combatants[id])
        .filter((character): character is Combatant => Boolean(character) && Boolean(attacker) && character.team === attacker.team && character.id !== attacker.id),
    [attacker, state.combatants, state.groups],
  );
  const flatAttackMoves = attackGroups.flatMap((group) => group.moves);
  const moveSlots = useMemo(() => {
    if (!attacker) return [];
    const occupiedSlots = new Set(Object.values(fieldSlots));
    const allowedRows = [frontRowForTeam(attacker.team), backRowForTeam(attacker.team)];

    return Array.from({ length: 16 }, (_, slot) => slot)
      .filter((slot) => allowedRows.includes(slotToRow(slot)) && !occupiedSlots.has(slot))
      .map((slot) => ({ slot, label: `${rowLabelForMove(attacker.team, slotToRow(slot))} tile ${Math.floor(slot / 4) + 1}` }));
  }, [attacker, fieldSlots]);
  const optionCount = openMenu === "attack" ? flatAttackMoves.length : openMenu === "move" ? allies.length + moveSlots.length : 0;

  const startPlan = (chosenMove: AttackMove) => {
    setLastMove(chosenMove);
    const p = buildAttackPlan(state, selectedAttackerId, selectedDefenderId, weapon?.id ?? "", chosenMove);
    if (p) {
      setPlan(p);
      setStep("initial");
      return;
    }

    if (attacker && defender) {
      setState((current) => ({
        ...current,
        log: [`${attacker.name} cannot reach ${defender.name}. Choose another target.`, ...current.log],
      }));
    }
  };

  const quickCombat = (chosenMove = lastMove) => {
    setLastMove(chosenMove);
    const p = buildAttackPlan(state, selectedAttackerId, selectedDefenderId, weapon?.id ?? "", chosenMove);
    if (p) {
      setState((current) => applyAttackPlan(current, p));
      setPlan(null);
      setStep("idle");
      onTurnComplete();
      return;
    }

    if (attacker && defender) {
      setState((current) => ({
        ...current,
        log: [`${attacker.name} cannot reach ${defender.name}. Choose another target.`, ...current.log],
      }));
    }
  };

  const nextStep = () => {
    if (step === "initial") setStep("evaded");
    else if (step === "evaded") setStep("corrected");
    else if (step === "corrected") setStep("resolved");
    else if (step === "resolved" && plan) {
      setState((current) => applyAttackPlan(current, plan));
      setPlan(null);
      setStep("idle");
      onTurnComplete();
    }
  };

  const guard = () => {
    if (!attacker) return;
    setState((current) => ({ ...current, log: [`${attacker.name} guards and holds position.`, ...current.log] }));
    setPlan(null);
    setStep("idle");
    onTurnComplete();
  };

  const itemAction = () => {
    if (!attacker) return;
    setState((current) => ({ ...current, log: [`${attacker.name} checks their pack, but has no item ready.`, ...current.log] }));
    setPlan(null);
    setStep("idle");
    onTurnComplete();
  };

  const activateMain = (index = selectedMenuIndex) => {
    const id = mainMenu[index].id;
    setSelectedMenuIndex(index);

    if (id === "attack" || id === "move") {
      setOpenMenu(id);
      setSelectedOptionIndex(0);
      return;
    }

    setOpenMenu(null);
    if (id === "guard") guard();
    if (id === "item") itemAction();
  };

  const chooseSelectedOption = () => {
    if (openMenu === "attack") {
      const chosenMove = flatAttackMoves[selectedOptionIndex] ?? flatAttackMoves[0];
      if (chosenMove) startPlan(chosenMove);
    } else if (openMenu === "move") {
      const moveSlot = moveSlots[selectedOptionIndex];
      const ally = allies[selectedOptionIndex - moveSlots.length];
      if (moveSlot) onMoveToSlot(moveSlot.slot);
      else if (ally) onSwapWithAlly(ally.id);
    }

    setOpenMenu(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (openMenu) {
      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        setSelectedOptionIndex((current) => (optionCount > 0 ? (current + 1) % optionCount : 0));
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        setSelectedOptionIndex((current) => (optionCount > 0 ? (current - 1 + optionCount) % optionCount : 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        chooseSelectedOption();
      } else if (event.key === "Escape") {
        event.preventDefault();
        setOpenMenu(null);
      }
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      setSelectedMenuIndex((current) => (current + 1) % mainMenu.length);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      setSelectedMenuIndex((current) => (current - 1 + mainMenu.length) % mainMenu.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      activateMain();
    }
  };

  const renderAttackOptions = () => {
    let optionIndex = 0;

    return attackGroups.map((group) => (
      <Box key={group.title}>
        <Typography variant="caption" fontWeight={900} color="text.secondary">{group.icon} {group.title}</Typography>
        <Stack gap={0.75} sx={{ mt: 0.75 }}>
          {group.moves.map((move) => {
            const currentIndex = optionIndex;
            optionIndex += 1;

            return (
              <Button
                key={move}
                variant={selectedOptionIndex === currentIndex ? "contained" : "outlined"}
                onMouseEnter={() => setSelectedOptionIndex(currentIndex)}
                onClick={() => {
                  setSelectedOptionIndex(currentIndex);
                  startPlan(move);
                  setOpenMenu(null);
                }}
                sx={{ justifyContent: "flex-start" }}
              >
                {moveLabel(move)}
              </Button>
            );
          })}
        </Stack>
      </Box>
    ));
  };

  const renderMoveOptions = () => (
    <>
      <Typography variant="caption" fontWeight={900} color="text.secondary">↔ Open Tiles</Typography>
      <Stack gap={0.75}>
        {moveSlots.length === 0 && <Typography variant="body2" color="text.secondary">No open front or back tile.</Typography>}
        {moveSlots.map((moveSlot, index) => (
          <Button
            key={moveSlot.slot}
            variant={selectedOptionIndex === index ? "contained" : "outlined"}
            onMouseEnter={() => setSelectedOptionIndex(index)}
            onClick={() => {
              onMoveToSlot(moveSlot.slot);
              setOpenMenu(null);
            }}
            sx={{ justifyContent: "flex-start" }}
          >
            Move to {moveSlot.label}
          </Button>
        ))}
      </Stack>

      <Typography variant="caption" fontWeight={900} color="text.secondary">Swap With Ally</Typography>
      <Stack gap={0.75}>
        {allies.length === 0 && <Typography variant="body2" color="text.secondary">No ally in battle.</Typography>}
        {allies.map((ally, index) => {
          const optionIndex = moveSlots.length + index;

          return (
            <Button
              key={ally.id}
              variant={selectedOptionIndex === optionIndex ? "contained" : "outlined"}
              onMouseEnter={() => setSelectedOptionIndex(optionIndex)}
              onClick={() => {
                onSwapWithAlly(ally.id);
                setOpenMenu(null);
              }}
              sx={{ justifyContent: "flex-start" }}
            >
              Shift with {ally.name}
            </Button>
          );
        })}
      </Stack>
    </>
  );

  return (
    <Card>
      <CardContent>
        <Stack
          tabIndex={0}
          onKeyDown={handleKeyDown}
          gap={1.5}
          sx={{
            outline: "none",
            "&:focus-visible": {
              boxShadow: "0 0 0 2px rgba(125, 211, 252, 0.55)",
              borderRadius: 2,
            },
          }}
        >
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1.5}>
            <Box>
              <Typography variant="h6" fontWeight={900}>Turn Menu</Typography>
              <Typography variant="body2" color="text.secondary">
                {attacker?.name ?? "No attacker"} → {defender?.name ?? "No target"}
              </Typography>
            </Box>
            <Stack direction="row" gap={0.75} flexWrap="wrap">
              <Chip label={weapon ? `${weapon.name} · ${weapon.reach}` : "No weapon"} />
              <Chip color={reachable ? "success" : "error"} label={reachable ? "Reach OK" : "Out of reach"} />
              <Button size="small" variant="contained" onClick={() => quickCombat()}>
                Quick Combat
              </Button>
            </Stack>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} gap={1}>
            {mainMenu.map((item, index) => (
              <Button
                key={item.id}
                ref={(element) => {
                  menuRefs.current[index] = element;
                }}
                fullWidth
                variant={selectedMenuIndex === index ? "contained" : "outlined"}
                onMouseEnter={() => setSelectedMenuIndex(index)}
                onClick={() => activateMain(index)}
              >
                <Box component="span" sx={{ mr: 1 }}>{item.icon}</Box>
                {item.label}
              </Button>
            ))}
          </Stack>

          {plan && (
            <Box sx={{ bgcolor: "action.hover", border: "1px solid", borderColor: "divider", borderRadius: 2, p: 1.25 }}>
              <Stack direction={{ xs: "column", sm: "row" }} gap={1} justifyContent="space-between">
                <Box>
                  <Typography variant="body2"><b>Step:</b> {step}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Initial {plan.initialMarker} → Evade {plan.afterDefenderMarker} → Final {plan.finalMarker}
                  </Typography>
                </Box>
                <Button variant="contained" disabled={!plan || plan.applied} onClick={nextStep}>
                  {step === "resolved" ? "Apply Damage" : "Next Step"}
                </Button>
              </Stack>
            </Box>
          )}
        </Stack>

        <Popover
          open={Boolean(openMenu)}
          anchorEl={openMenu ? menuRefs.current[selectedMenuIndex] : null}
          onClose={() => setOpenMenu(null)}
          anchorOrigin={{ vertical: "top", horizontal: "left" }}
          transformOrigin={{ vertical: "bottom", horizontal: "left" }}
          PaperProps={{
            sx: {
              p: 1.25,
              width: 270,
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
            },
          }}
        >
          <Stack gap={1.25}>
            {openMenu === "attack" && renderAttackOptions()}
            {openMenu === "move" && renderMoveOptions()}
            <Divider />
            <Typography variant="caption" color="text.secondary">Arrow keys choose. Enter confirms.</Typography>
          </Stack>
        </Popover>
      </CardContent>
    </Card>
  );
}
