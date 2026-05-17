import React from "react";
import { Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import type { Combatant } from "../engine/types/combat";
import { getEvasion, getMovementCategory, getTotalWeight } from "../engine/rules/characterRules";
import { rowLabel } from "../engine/rules/labels";
import { ProgressBar, StatPill } from "./SmallBits";

export function CombatantCard({
  character,
  selected,
  targetSelected,
  onClick,
  onTarget,
  onStats,
  onHeal,
}: {
  character: Combatant;
  selected?: boolean;
  targetSelected?: boolean;
  onClick?: () => void;
  onTarget?: () => void;
  onStats?: () => void;
  onHeal?: () => void;
}) {
  const weapon = character.weapons[0];
  const attune = character.weaponAttunement[weapon.id] ?? { xp: 0, level: 0 };

  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: selected ? "grey.900" : targetSelected ? "error.main" : "divider",
        bgcolor: selected ? "grey.100" : targetSelected ? "error.50" : "background.paper",
      }}
    >
      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Box component="button" onClick={onClick} sx={{ all: "unset", display: "block", width: "100%", cursor: "pointer" }}>
          <Stack direction="row" justifyContent="space-between" gap={1} alignItems="flex-start">
            <Box>
              <Typography fontWeight={800}>{character.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {character.team} · row {character.row} · {rowLabel(character.row)}
              </Typography>
            </Box>
            <Chip size="small" label={weapon.name} color="primary" />
          </Stack>

          <Box sx={{ mt: 1.5 }}>
            <ProgressBar label="Fight" value={character.fight} max={character.maxFight} />
            <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 1 }}>
              <StatPill label="Move" value={getMovementCategory(character)} />
              <StatPill label="Eva" value={getEvasion(character)} />
              <StatPill label="Wt" value={getTotalWeight(character)} />
              <StatPill label="Attune" value={`${attune.level} (${attune.xp} xp)`} />
            </Stack>
          </Box>
        </Box>

        {character.statuses.length > 0 && (
          <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 1 }}>
            {character.statuses.slice(-4).map((status) => <Chip key={status.id} size="small" color="error" label={status.name} />)}
          </Stack>
        )}

        <Stack direction="row" gap={1} sx={{ mt: 1.5 }}>
          <Button size="small" variant="outlined" onClick={onTarget}>Target</Button>
          <Button size="small" variant="outlined" onClick={onStats}>Stats</Button>
          <Button size="small" variant="outlined" onClick={onHeal}>Heal</Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
