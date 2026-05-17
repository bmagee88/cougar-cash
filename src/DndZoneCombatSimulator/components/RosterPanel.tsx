import React from "react";
import { Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import type { BattleState, Combatant } from "../engine/types/combat";

export function RosterPanel({
  title,
  ids,
  state,
  selectedId,
  onGenerate,
  onSwapIn,
  onStats,
}: {
  title: string;
  ids: string[];
  state: BattleState;
  selectedId?: string | null;
  onGenerate: () => void;
  onSwapIn: (id: string) => void;
  onStats: (c: Combatant) => void;
}) {
  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography variant="h6" fontWeight={800}>{title}</Typography>
          <Button variant="contained" onClick={onGenerate}>Generate</Button>
        </Stack>

        <Stack gap={1} sx={{ maxHeight: 260, overflowY: "auto" }}>
          {ids.length === 0 && (
            <Box sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 2, p: 2, textAlign: "center", color: "text.secondary" }}>
              Empty
            </Box>
          )}

          {ids.map((id) => {
            const c = state.combatants[id];
            if (!c) return null;

            return (
              <Box
                key={id}
                sx={{
                  border: "1px solid",
                  borderColor: selectedId === id ? "primary.main" : "divider",
                  borderRadius: 2,
                  p: 1.5,
                  bgcolor: selectedId === id ? "rgba(125, 211, 252, 0.14)" : "action.hover",
                }}
              >
                <Stack direction="row" justifyContent="space-between" gap={1} alignItems="flex-start">
                  <Box>
                    <Typography fontWeight={800}>{c.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {c.weapons[0].name} - Fight {c.fight}/{c.maxFight}
                    </Typography>
                  </Box>
                  <Stack direction="row" gap={1}>
                    <Button size="small" variant="outlined" onClick={() => onStats(c)}>Stats</Button>
                    <Button size="small" variant={selectedId === id ? "contained" : "outlined"} onClick={() => onSwapIn(id)}>
                      {selectedId === id ? "Placing" : "Place"}
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}
