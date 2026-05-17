import React, { useState } from "react";
import { Box, Button, Card, CardContent, Grid, Stack, Typography } from "@mui/material";
import type { AttackMove, AttackPlan, AttackStep, BattleState } from "../engine/types/combat";
import { moveTargetRanges } from "../engine/data/bodyMap";
import { applyAttackPlan, buildAttackPlan } from "../engine/rules/attackResolver";
import { moveLabel } from "../engine/rules/labels";
import { canMeleeAttack } from "../engine/rules/targetingRules";

export function AttackPanel({
  state,
  setState,
  selectedAttackerId,
  selectedDefenderId,
  plan,
  setPlan,
  step,
  setStep,
}: {
  state: BattleState;
  setState: React.Dispatch<React.SetStateAction<BattleState>>;
  selectedAttackerId: string;
  selectedDefenderId: string;
  plan: AttackPlan | null;
  setPlan: (p: AttackPlan | null) => void;
  step: AttackStep;
  setStep: (s: AttackStep) => void;
}) {
  const [move, setMove] = useState<AttackMove>("slashMid");

  const attacker = state.combatants[selectedAttackerId];
  const defender = state.combatants[selectedDefenderId];
  const weapon = attacker?.weapons[0];
  const reachable = attacker && defender && weapon ? canMeleeAttack(attacker, defender, weapon) : false;

  const startPlan = () => {
    const p = buildAttackPlan(state, selectedAttackerId, selectedDefenderId, weapon?.id ?? "", move);
    if (p) {
      setPlan(p);
      setStep("initial");
    }
  };

  const nextStep = () => {
    if (step === "initial") setStep("evaded");
    else if (step === "evaded") setStep("corrected");
    else if (step === "corrected") setStep("resolved");
    else if (step === "resolved" && plan) {
      setState((current) => applyAttackPlan(current, plan));
      setPlan({ ...plan, applied: true });
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" fontWeight={900} gutterBottom>Attack Controls</Typography>

        <Box sx={{ bgcolor: "action.hover", border: "1px solid", borderColor: "divider", borderRadius: 2, p: 1.5, mb: 2 }}>
          <Typography variant="body2"><b>Attacker:</b> {attacker?.name}</Typography>
          <Typography variant="body2"><b>Target:</b> {defender?.name}</Typography>
          <Typography variant="body2"><b>Weapon:</b> {weapon?.name} · reach: {weapon?.reach}</Typography>
          <Typography variant="body2"><b>Can reach?</b> <Box component="span" sx={{ color: reachable ? "success.main" : "error.main" }}>{reachable ? "Yes" : "No"}</Box></Typography>
          {plan && (
            <Box sx={{ mt: 1, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 2, p: 1 }}>
              <Typography variant="body2"><b>Step:</b> {step}</Typography>
              <Typography variant="caption">Initial {plan.initialMarker} → Evade {plan.afterDefenderMarker} → Final {plan.finalMarker}</Typography>
            </Box>
          )}
        </Box>

        <Grid container spacing={1} sx={{ mb: 2 }}>
          {(Object.keys(moveTargetRanges) as AttackMove[]).map((m) => (
            <Grid item xs={6} key={m}>
              <Button
                fullWidth
                variant={move === m ? "contained" : "outlined"}
                onClick={() => {
                  setMove(m);
                  setPlan(null);
                  setStep("idle");
                }}
              >
                {moveLabel(m)}
              </Button>
            </Grid>
          ))}
        </Grid>

        <Stack direction="row" gap={1}>
          <Button fullWidth variant="contained" onClick={startPlan}>Start Step Attack</Button>
          <Button fullWidth variant="outlined" disabled={!plan || plan.applied} onClick={nextStep}>
            {step === "resolved" ? "Apply Damage" : "Next Step"}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
