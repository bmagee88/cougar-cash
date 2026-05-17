import React, { useMemo, useState } from "react";
import { Box, Button, Container, Grid, Paper, Stack, Typography } from "@mui/material";
import type { AttackPlan, AttackStep, BattleState, Combatant, RowIndex, Team } from "./engine/types/combat";
import { createInitialState } from "./engine/data/initialState";
import { randomCombatant } from "./engine/data/characters";
import { AttackPanel } from "./components/AttackPanel";
import { BattleGroupView } from "./components/BattleGroupView";
import { BodyCoverageView } from "./components/BodyCoverageView";
import { CombatLog } from "./components/CombatLog";
import { RosterPanel } from "./components/RosterPanel";
import { StatsModal } from "./components/StatsModal";

export default function DndZoneCombatSimulator() {
  const [state, setState] = useState<BattleState>(() => createInitialState());
  const [selectedAttackerId, setSelectedAttackerId] = useState("aria");
  const [selectedDefenderId, setSelectedDefenderId] = useState("goblin");
  const [statsCharacter, setStatsCharacter] = useState<Combatant | null>(null);
  const [plan, setPlan] = useState<AttackPlan | null>(null);
  const [step, setStep] = useState<AttackStep>("idle");

  const activeIds = state.groups[0].combatantIds;
  const selectedDefender = state.combatants[selectedDefenderId] ?? state.combatants[activeIds[0]];

  const livingCount = useMemo(
    () => Object.values(state.combatants).filter((c) => c.fight > 0 && activeIds.includes(c.id)).length,
    [state, activeIds],
  );

  const resetStepAttack = () => {
    setPlan(null);
    setStep("idle");
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
    resetStepAttack();
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100", py: 3 }}>
      <StatsModal character={statsCharacter} onClose={() => setStatsCharacter(null)} />
      <Container maxWidth="xl">
        <Stack gap={2.5}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} gap={2}>
              <Box>
                <Typography variant="h4" fontWeight={900}>DND Zone Combat Simulator</Typography>
                <Typography color="text.secondary">
                  Generate Tavern heroes and Lair enemies, swap them into the play area, inspect stats, heal, and step through body-marker combat.
                </Typography>
              </Box>
              <Stack direction="row" gap={1} flexWrap="wrap">
                <Button variant="contained" color="inherit">{livingCount} active standing</Button>
                <Button variant="outlined" onClick={healAll}>Heal All</Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setState(createInitialState());
                    setSelectedAttackerId("aria");
                    setSelectedDefenderId("goblin");
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
                  selectedAttackerId={selectedAttackerId}
                  selectedDefenderId={selectedDefenderId}
                  setSelectedAttackerId={(id) => {
                    setSelectedAttackerId(id);
                    resetStepAttack();
                  }}
                  setSelectedDefenderId={(id) => {
                    setSelectedDefenderId(id);
                    resetStepAttack();
                  }}
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
  );
}
