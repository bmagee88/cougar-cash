import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Container, CssBaseline, Grid, Paper, Stack, Typography } from "@mui/material";
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

  useEffect(() => {
    if (initiativeOrder.length > 0 && turnIndex >= initiativeOrder.length) setTurnIndex(0);
  }, [initiativeOrder.length, turnIndex]);

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

    if (canMeleeAttack(attacker, defender, weapon)) {
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

  const swapIn = (id: string) => {
    setState((current) => {
      const incoming = current.combatants[id];
      if (!incoming) return current;

      const activeSameTeam = current.groups[0].combatantIds.filter((cid) => current.combatants[cid]?.team === incoming.team);
      const outgoingId = activeSameTeam[0];
      const newActive = current.groups[0].combatantIds.filter((cid) => cid !== outgoingId).concat(id);

      const newTavern =
        incoming.team === "heroes"
          ? current.tavernIds.filter((x) => x !== id).concat(outgoingId ? [outgoingId] : [])
          : current.tavernIds;

      const newLair =
        incoming.team === "monsters"
          ? current.lairIds.filter((x) => x !== id).concat(outgoingId ? [outgoingId] : [])
          : current.lairIds;

      const row: RowIndex = incoming.team === "heroes" ? 1 : 2;

      return {
        ...current,
        combatants: { ...current.combatants, [id]: { ...incoming, row } },
        groups: [{ ...current.groups[0], combatantIds: newActive }],
        tavernIds: newTavern,
        lairIds: newLair,
        log: [
          `${incoming.name} enters the play area${outgoingId ? `, replacing ${current.combatants[outgoingId].name}` : ""}.`,
          ...current.log,
        ],
      };
    });
    setTurnIndex(0);
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
        <StatsModal character={statsCharacter} onClose={() => setStatsCharacter(null)} />
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
                      setState(createInitialState());
                      setSelectedAttackerId("aria");
                      setSelectedDefenderId("goblin");
                      setTurnIndex(0);
                      setUnreachableTargetId(null);
                      resetStepAttack();
                    }}
                  >
                    Reset
                  </Button>
                </Stack>
              </Stack>
            </Paper>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <RosterPanel title="Tavern" ids={state.tavernIds} state={state} onGenerate={() => generate("heroes")} onSwapIn={swapIn} onStats={setStatsCharacter} />
              </Grid>
              <Grid item xs={12} md={6}>
                <RosterPanel title="Lair" ids={state.lairIds} state={state} onGenerate={() => generate("monsters")} onSwapIn={swapIn} onStats={setStatsCharacter} />
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid item xs={12} lg={7}>
                <Stack gap={2}>
                  <BattleGroupView
                    state={state}
                    selectedDefenderId={selectedDefenderId}
                    activeTurnId={activeTurnId}
                    initiativeOrder={initiativeOrder}
                    initiativeScores={initiativeScores}
                    unreachableTargetId={unreachableTargetId}
                    onNextTurn={nextTurn}
                    onAttemptTarget={attemptTarget}
                    onStats={setStatsCharacter}
                    onHeal={healCharacter}
                  />
                  <CombatLog log={state.log} />
                </Stack>
              </Grid>
              <Grid item xs={12} lg={5}>
                <Stack gap={2}>
                  <AttackPanel
                    state={state}
                    setState={setState}
                    selectedAttackerId={selectedAttackerId}
                    selectedDefenderId={selectedDefenderId}
                    plan={plan}
                    setPlan={setPlan}
                    step={step}
                    setStep={setStep}
                  />
                  {selectedDefender && <BodyCoverageView defender={selectedDefender} plan={plan} step={step} />}
                </Stack>
              </Grid>
            </Grid>
          </Stack>
        </Container>
      </Box>
    </ThemeProvider>
  );
}
