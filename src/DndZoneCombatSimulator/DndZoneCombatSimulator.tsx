import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Card, CardContent, Container, CssBaseline, Grid, Paper, Stack, Typography } from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import type { AttackPlan, AttackStep, BattleState, Combatant, RowIndex, Team } from "./engine/types/combat";
import { createInitialState } from "./engine/data/initialState";
import { randomCombatant } from "./engine/data/characters";
import { getTotalWeight } from "./engine/rules/characterRules";
import { canMeleeAttack } from "./engine/rules/targetingRules";
import { AttackPanel } from "./components/AttackPanel";
import { BattleGroupView } from "./components/BattleGroupView";
import { BodyCoverageView } from "./components/BodyCoverageView";
import { CombatLog } from "./components/CombatLog";
import { RosterPanel } from "./components/RosterPanel";
import { StatsModal } from "./components/StatsModal";

type FieldSlots = Record<string, number>;

function slotToRow(slot: number): RowIndex {
  return (slot % 4) as RowIndex;
}

function teamCanUseSlot(team: Team, slot: number): boolean {
  const col = slot % 4;
  return team === "heroes" ? col === 0 || col === 1 : col === 2 || col === 3;
}

function firstOpenSlotForRow(row: RowIndex, occupied: Set<number>): number | undefined {
  for (let visualRow = 0; visualRow < 4; visualRow++) {
    const slot = visualRow * 4 + row;
    if (!occupied.has(slot)) return slot;
  }
  return undefined;
}

function buildInitialFieldSlots(state: BattleState): FieldSlots {
  const slots: FieldSlots = {};
  const occupied = new Set<number>();

  state.groups[0].combatantIds.forEach((id) => {
    const character = state.combatants[id];
    if (!character) return;
    const slot = firstOpenSlotForRow(character.row, occupied);
    if (slot === undefined) return;
    slots[id] = slot;
    occupied.add(slot);
  });

  return slots;
}

function normalizeFieldSlots(state: BattleState, current: FieldSlots): FieldSlots {
  const activeIds = state.groups[0].combatantIds;
  const activeSet = new Set(activeIds);
  const next: FieldSlots = {};
  const occupied = new Set<number>();
  let changed = false;

  activeIds.forEach((id) => {
    const character = state.combatants[id];
    const currentSlot = current[id];
    const currentIsValid =
      character &&
      currentSlot !== undefined &&
      slotToRow(currentSlot) === character.row &&
      !occupied.has(currentSlot) &&
      teamCanUseSlot(character.team, currentSlot);

    if (character && currentIsValid) {
      next[id] = currentSlot;
      occupied.add(currentSlot);
      return;
    }

    if (character) {
      const fallbackSlot = firstOpenSlotForRow(character.row, occupied);
      if (fallbackSlot !== undefined) {
        next[id] = fallbackSlot;
        occupied.add(fallbackSlot);
      }
    }
    changed = true;
  });

  Object.keys(current).forEach((id) => {
    if (!activeSet.has(id)) changed = true;
  });

  return changed ? next : current;
}

function characterIcon(character: Combatant): string {
  if (character.team === "monsters") return character.name.toLowerCase().includes("bone") ? "💀" : "👹";
  if (character.name.toLowerCase().includes("borin")) return "🛡️";
  return "🧝";
}

function GraveyardPanel({
  ids,
  state,
  onRevive,
}: {
  ids: string[];
  state: BattleState;
  onRevive: (id: string) => void;
}) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" fontWeight={900} gutterBottom>Graveyard</Typography>
        <Stack gap={1} sx={{ maxHeight: 220, overflowY: "auto" }}>
          {ids.length === 0 && (
            <Box sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 2, p: 2, textAlign: "center", color: "text.secondary" }}>
              Empty
            </Box>
          )}

          {ids.map((id) => {
            const character = state.combatants[id];
            if (!character) return null;

            return (
              <Box key={id} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 1.25, bgcolor: "action.hover" }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={900} noWrap>{characterIcon(character)} {character.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Returns to {character.team === "heroes" ? "Tavern" : "Lair"}
                    </Typography>
                  </Box>
                  <Button size="small" variant="contained" onClick={() => onRevive(id)}>Revive</Button>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}

const combatTheme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: "#080b12",
      paper: "#121826",
    },
    primary: {
      main: "#7dd3fc",
      light: "#bae6fd",
      dark: "#0284c7",
      contrastText: "#06111c",
    },
    secondary: {
      main: "#c084fc",
    },
    success: {
      main: "#34d399",
    },
    warning: {
      main: "#fbbf24",
    },
    error: {
      main: "#fb7185",
      light: "#fda4af",
      dark: "#be123c",
    },
    divider: "rgba(148, 163, 184, 0.22)",
    text: {
      primary: "#f8fafc",
      secondary: "#cbd5e1",
    },
  },
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 800,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid rgba(148, 163, 184, 0.22)",
          boxShadow: "0 18px 44px rgba(0, 0, 0, 0.28)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundImage: "none",
          border: "1px solid rgba(148, 163, 184, 0.24)",
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(148, 163, 184, 0.2)",
        },
      },
    },
  },
});

export default function DndZoneCombatSimulator() {
  const [state, setState] = useState<BattleState>(() => createInitialState());
  const [selectedAttackerId, setSelectedAttackerId] = useState("aria");
  const [selectedDefenderId, setSelectedDefenderId] = useState("goblin");
  const [statsCharacter, setStatsCharacter] = useState<Combatant | null>(null);
  const [plan, setPlan] = useState<AttackPlan | null>(null);
  const [step, setStep] = useState<AttackStep>("idle");
  const [turnIndex, setTurnIndex] = useState(0);
  const [unreachableTargetId, setUnreachableTargetId] = useState<string | null>(null);
  const [fieldSlots, setFieldSlots] = useState<FieldSlots>(() => buildInitialFieldSlots(createInitialState()));
  const [placingCharacterId, setPlacingCharacterId] = useState<string | null>(null);

  const activeIds = state.groups[0].combatantIds;
  const selectedDefender = state.combatants[selectedDefenderId] ?? state.combatants[activeIds[0]];
  const initiativeScores = useMemo(
    () =>
      Object.fromEntries(
        activeIds
          .map((id) => state.combatants[id])
          .filter(Boolean)
          .map((character) => [
            character.id,
            character.stats.physicalStrength + character.stats.toughness - getTotalWeight(character),
          ]),
      ) as Record<string, number>,
    [activeIds, state.combatants],
  );
  const initiativeOrder = useMemo(
    () =>
      activeIds
        .map((id) => state.combatants[id])
        .filter((character): character is Combatant => Boolean(character) && character.fight > 0)
        .sort((a, b) => {
          const scoreDifference = (initiativeScores[b.id] ?? 0) - (initiativeScores[a.id] ?? 0);
          if (scoreDifference !== 0) return scoreDifference;
          return b.stats.dexterity - a.stats.dexterity;
        })
        .map((character) => character.id),
    [activeIds, initiativeScores, state.combatants],
  );
  const activeTurnId = initiativeOrder.length > 0 ? initiativeOrder[turnIndex % initiativeOrder.length] : "";

  const livingCount = useMemo(
    () => Object.values(state.combatants).filter((c) => c.fight > 0 && activeIds.includes(c.id)).length,
    [state, activeIds],
  );
  const graveyardIds = useMemo(
    () => Object.values(state.combatants).filter((character) => character.fight <= 0).map((character) => character.id),
    [state.combatants],
  );

  useEffect(() => {
    if (initiativeOrder.length > 0 && turnIndex >= initiativeOrder.length) setTurnIndex(0);
  }, [initiativeOrder.length, turnIndex]);

  useEffect(() => {
    setFieldSlots((current) => normalizeFieldSlots(state, current));
  }, [state]);

  useEffect(() => {
    if (activeTurnId) setSelectedAttackerId(activeTurnId);
  }, [activeTurnId]);

  useEffect(() => {
    const attacker = state.combatants[activeTurnId];
    if (!attacker) return;

    const currentDefender = state.combatants[selectedDefenderId];
    if (currentDefender && currentDefender.team !== attacker.team && currentDefender.fight > 0) return;

    const fallbackTarget = activeIds
      .map((id) => state.combatants[id])
      .find((character) => character && character.team !== attacker.team && character.fight > 0);

    if (fallbackTarget) setSelectedDefenderId(fallbackTarget.id);
  }, [activeIds, activeTurnId, selectedDefenderId, state.combatants]);

  const resetStepAttack = () => {
    setPlan(null);
    setStep("idle");
  };

  const nextTurn = () => {
    if (initiativeOrder.length === 0) return;
    setTurnIndex((current) => (current + 1) % initiativeOrder.length);
    setUnreachableTargetId(null);
    resetStepAttack();
  };

  const attemptTarget = (id: string) => {
    const attacker = state.combatants[activeTurnId];
    const defender = state.combatants[id];
    const weapon = attacker?.weapons[0];

    if (!attacker || !defender || !weapon || attacker.team === defender.team) return;

    if (canMeleeAttack(attacker, defender, weapon, state)) {
      setSelectedDefenderId(id);
      setUnreachableTargetId(null);
      resetStepAttack();
      return;
    }

    setUnreachableTargetId(id);
    setState((current) => ({
      ...current,
      log: [`${attacker.name} cannot reach ${defender.name}.`, ...current.log],
    }));
    window.setTimeout(() => setUnreachableTargetId((current) => (current === id ? null : current)), 650);
  };

  const healCharacter = (id: string) => {
    setState((current) => {
      const character = current.combatants[id];
      return {
        ...current,
        combatants: {
          ...current.combatants,
          [id]: {
            ...character,
            fight: character.maxFight,
            blood: character.maxBlood,
            concussion: character.maxConcussion,
            statuses: [],
          },
        },
        log: [`${character.name} is healed.`, ...current.log],
      };
    });
  };

  const healAll = () => {
    setState((current) => ({
      ...current,
      combatants: Object.fromEntries(
        Object.entries(current.combatants).map(([id, c]) => [
          id,
          {
            ...c,
            fight: c.maxFight,
            blood: c.maxBlood,
            concussion: c.maxConcussion,
            statuses: [],
          },
        ]),
      ) as Record<string, Combatant>,
      log: ["Everyone is healed.", ...current.log],
    }));
  };

  const generate = (team: Team) => {
    setState((current) => {
      const c = randomCombatant(team);
      return {
        ...current,
        combatants: { ...current.combatants, [c.id]: c },
        tavernIds: team === "heroes" ? [c.id, ...current.tavernIds] : current.tavernIds,
        lairIds: team === "monsters" ? [c.id, ...current.lairIds] : current.lairIds,
        log: [`Generated ${c.name} in the ${team === "heroes" ? "Tavern" : "Lair"}.`, ...current.log],
      };
    });
  };

  const placeCharacterOnSlot = (slot: number) => {
    if (!placingCharacterId) return;
    const incoming = state.combatants[placingCharacterId];
    if (!incoming || !teamCanUseSlot(incoming.team, slot)) return;

    const occupantId = activeIds.find((id) => fieldSlots[id] === slot);

    setState((current) => {
      const currentIncoming = current.combatants[placingCharacterId];
      const occupant = occupantId ? current.combatants[occupantId] : undefined;
      if (!currentIncoming) return current;

      const activeWithoutOccupant = current.groups[0].combatantIds.filter((id) => id !== occupantId && id !== placingCharacterId);
      const nextActiveIds = occupantId
        ? current.groups[0].combatantIds.map((id) => (id === occupantId ? placingCharacterId : id)).filter((id, index, list) => list.indexOf(id) === index)
        : [...activeWithoutOccupant, placingCharacterId];

      const nextTavernIds = current.tavernIds
        .filter((id) => id !== placingCharacterId)
        .concat(occupant?.team === "heroes" ? [occupant.id] : []);
      const nextLairIds = current.lairIds
        .filter((id) => id !== placingCharacterId)
        .concat(occupant?.team === "monsters" ? [occupant.id] : []);

      return {
        ...current,
        combatants: {
          ...current.combatants,
          [placingCharacterId]: { ...currentIncoming, row: slotToRow(slot) },
        },
        groups: [{ ...current.groups[0], combatantIds: nextActiveIds }],
        tavernIds: nextTavernIds,
        lairIds: nextLairIds,
        log: [
          `${currentIncoming.name} takes a battlefield tile${occupant ? `, sending ${occupant.name} back to the ${occupant.team === "heroes" ? "Tavern" : "Lair"}` : ""}.`,
          ...current.log,
        ],
      };
    });
    setFieldSlots((current) => {
      const next = { ...current, [placingCharacterId]: slot };
      if (occupantId) delete next[occupantId];
      return next;
    });
    setPlacingCharacterId(null);
    setTurnIndex(0);
    setUnreachableTargetId(null);
    resetStepAttack();
  };

  const swapIn = (id: string) => {
    setPlacingCharacterId(id);
    setUnreachableTargetId(null);
  };

  const swapWithAlly = (allyId: string) => {
    const activeSlot = fieldSlots[activeTurnId];
    const allySlot = fieldSlots[allyId];

    setState((current) => {
      const active = current.combatants[activeTurnId];
      const ally = current.combatants[allyId];
      if (!active || !ally || active.team !== ally.team) return current;
      const nextActiveSlot = allySlot ?? fieldSlots[active.id];
      const nextAllySlot = activeSlot ?? fieldSlots[ally.id];

      return {
        ...current,
        combatants: {
          ...current.combatants,
          [active.id]: { ...active, row: nextActiveSlot !== undefined ? slotToRow(nextActiveSlot) : ally.row },
          [ally.id]: { ...ally, row: nextAllySlot !== undefined ? slotToRow(nextAllySlot) : active.row },
        },
        log: [`${active.name} shifts positions with ${ally.name}.`, ...current.log],
      };
    });
    if (activeSlot !== undefined && allySlot !== undefined) {
      setFieldSlots((current) => ({ ...current, [activeTurnId]: allySlot, [allyId]: activeSlot }));
    }
    setUnreachableTargetId(null);
    resetStepAttack();
    nextTurn();
  };

  const moveToSlot = (slot: number) => {
    const active = state.combatants[activeTurnId];
    if (!active || !teamCanUseSlot(active.team, slot) || Object.values(fieldSlots).includes(slot)) return;

    setState((current) => {
      const currentActive = current.combatants[activeTurnId];
      if (!currentActive) return current;
      return {
        ...current,
        combatants: {
          ...current.combatants,
          [activeTurnId]: { ...currentActive, row: slotToRow(slot) },
        },
        log: [`${currentActive.name} moves to an open ${slotToRow(slot) === (currentActive.team === "heroes" ? 1 : 2) ? "front" : "back"} tile.`, ...current.log],
      };
    });
    setFieldSlots((current) => ({ ...current, [activeTurnId]: slot }));
    setUnreachableTargetId(null);
    resetStepAttack();
    nextTurn();
  };

  const reviveToBench = (id: string) => {
    setState((current) => {
      const character = current.combatants[id];
      if (!character) return current;
      const destination = character.team === "heroes" ? "Tavern" : "Lair";
      const tavernIds = character.team === "heroes" && !current.tavernIds.includes(id) ? [id, ...current.tavernIds] : current.tavernIds;
      const lairIds = character.team === "monsters" && !current.lairIds.includes(id) ? [id, ...current.lairIds] : current.lairIds;

      return {
        ...current,
        combatants: {
          ...current.combatants,
          [id]: {
            ...character,
            fight: character.maxFight,
            blood: character.maxBlood,
            concussion: character.maxConcussion,
            statuses: [],
          },
        },
        groups: [{ ...current.groups[0], combatantIds: current.groups[0].combatantIds.filter((activeId) => activeId !== id) }],
        tavernIds,
        lairIds,
        log: [`${character.name} is revived and returns to the ${destination}.`, ...current.log],
      };
    });
    setFieldSlots((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    resetStepAttack();
  };

  return (
    <ThemeProvider theme={combatTheme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: "background.default",
          color: "text.primary",
          background:
            "linear-gradient(135deg, #080b12 0%, #101522 48%, #0b1118 100%)",
          py: 3,
        }}
      >
        <StatsModal character={statsCharacter} initiative={statsCharacter ? initiativeScores[statsCharacter.id] : undefined} onClose={() => setStatsCharacter(null)} />
        <Container maxWidth="xl">
          <Stack gap={2.5}>
            <Paper sx={{ p: 3, borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
              <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} gap={2}>
                <Box>
                  <Typography variant="h4" fontWeight={900}>DND Zone Combat Simulator</Typography>
                  <Typography color="text.secondary">
                    Generate Tavern heroes and Lair enemies, swap them into the play area, inspect stats, heal, and step through body-marker combat.
                  </Typography>
                </Box>
                <Stack direction="row" gap={1} flexWrap="wrap">
                  <Button variant="contained">{livingCount} active standing</Button>
                  <Button variant="outlined" onClick={healAll}>Heal All</Button>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      const nextInitialState = createInitialState();
                      setState(nextInitialState);
                      setFieldSlots(buildInitialFieldSlots(nextInitialState));
                      setSelectedAttackerId("aria");
                      setSelectedDefenderId("goblin");
                      setTurnIndex(0);
                      setUnreachableTargetId(null);
                      setPlacingCharacterId(null);
                      resetStepAttack();
                    }}
                  >
                    Reset
                  </Button>
                </Stack>
              </Stack>
            </Paper>

            <Grid container spacing={2}>
              <Grid item xs={12} lg={8}>
                <Stack gap={2}>
                  <BattleGroupView
                    state={state}
                    fieldSlots={fieldSlots}
                    placingCharacterId={placingCharacterId}
                    selectedDefenderId={selectedDefenderId}
                    activeTurnId={activeTurnId}
                    initiativeOrder={initiativeOrder}
                    initiativeScores={initiativeScores}
                    unreachableTargetId={unreachableTargetId}
                    plan={plan}
                    step={step}
                    onTileClick={placeCharacterOnSlot}
                    onCancelPlacement={() => setPlacingCharacterId(null)}
                    onNextTurn={nextTurn}
                    onAttemptTarget={attemptTarget}
                    onStats={setStatsCharacter}
                    onHeal={healCharacter}
                  />
                  <AttackPanel
                    state={state}
                    setState={setState}
                    selectedAttackerId={selectedAttackerId}
                    selectedDefenderId={selectedDefenderId}
                    plan={plan}
                    setPlan={setPlan}
                    step={step}
                    setStep={setStep}
                    fieldSlots={fieldSlots}
                    onSwapWithAlly={swapWithAlly}
                    onMoveToSlot={moveToSlot}
                    onTurnComplete={nextTurn}
                  />
                </Stack>
              </Grid>
              <Grid item xs={12} lg={4}>
                <Stack gap={2}>
                  <RosterPanel title="Tavern" ids={state.tavernIds} state={state} selectedId={placingCharacterId} onGenerate={() => generate("heroes")} onSwapIn={swapIn} onStats={setStatsCharacter} />
                  <RosterPanel title="Lair" ids={state.lairIds} state={state} selectedId={placingCharacterId} onGenerate={() => generate("monsters")} onSwapIn={swapIn} onStats={setStatsCharacter} />
                  <GraveyardPanel ids={graveyardIds} state={state} onRevive={reviveToBench} />
                  {selectedDefender && <BodyCoverageView defender={selectedDefender} plan={plan} step={step} />}
                  <CombatLog log={state.log} />
                </Stack>
              </Grid>
            </Grid>
          </Stack>
        </Container>
      </Box>
    </ThemeProvider>
  );
}
