import React from "react";
import { Box, Card, CardContent, Chip, Grid, Stack, Typography } from "@mui/material";
import type { BattleState, Combatant, RowIndex } from "../engine/types/combat";
import { rowLabel } from "../engine/rules/labels";
import { CombatantCard } from "./CombatantCard";

export function BattleGroupView({
  state,
  selectedAttackerId,
  selectedDefenderId,
  setSelectedAttackerId,
  setSelectedDefenderId,
  onStats,
  onHeal,
}: {
  state: BattleState;
  selectedAttackerId: string;
  selectedDefenderId: string;
  setSelectedAttackerId: (id: string) => void;
  setSelectedDefenderId: (id: string) => void;
  onStats: (c: Combatant) => void;
  onHeal: (id: string) => void;
}) {
  const group = state.groups[0];
  const combatants = group.combatantIds.map((id) => state.combatants[id]).filter(Boolean);

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography variant="h6" fontWeight={900}>{group.name}</Typography>
          <Stack direction="row" gap={0.5}>
            {group.effects.map((effect) => <Chip key={effect} size="small" label={effect} color="warning" variant="outlined" />)}
          </Stack>
        </Stack>

        <Stack gap={1.5}>
          {([0, 1, 2, 3] as RowIndex[]).map((row) => {
            const rowCombatants = combatants.filter((c) => c.row === row);

            return (
              <Box key={row} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, bgcolor: "grey.50", p: 1.5 }}>
                <Typography variant="caption" fontWeight={900} color="text.secondary">
                  Row {row}: {rowLabel(row)}
                </Typography>
                <Grid container spacing={1} sx={{ mt: .5 }}>
                  {rowCombatants.map((character) => (
                    <Grid item xs={12} md={6} key={character.id}>
                      <CombatantCard
                        character={character}
                        selected={selectedAttackerId === character.id}
                        targetSelected={selectedDefenderId === character.id}
                        onClick={() => setSelectedAttackerId(character.id)}
                        onTarget={() => setSelectedDefenderId(character.id)}
                        onStats={() => onStats(character)}
                        onHeal={() => onHeal(character.id)}
                      />
                    </Grid>
                  ))}
                  {rowCombatants.length === 0 && (
                    <Grid item xs={12}>
                      <Box sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 2, p: 2, textAlign: "center", color: "text.secondary" }}>Empty row</Box>
                    </Grid>
                  )}
                </Grid>
              </Box>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}
