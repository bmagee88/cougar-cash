import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import type { BattleGroup } from "../engine/types/battlefield";
import type { Combatant } from "../engine/types/character";
import { CombatantCard } from "./CombatantCard";

const rowLabels: Record<number, string> = {
  0: "Hero Back Row",
  1: "Hero Front Row",
  2: "Enemy Front Row",
  3: "Enemy Back Row",
};

interface GroupInteriorProps {
  group: BattleGroup;
  combatants: Record<string, Combatant>;
  selectedAttackerId?: string;
  selectedDefenderId?: string;
  onSelectCombatant: (id: string) => void;
}

export function GroupInterior({ group, combatants, selectedAttackerId, selectedDefenderId, onSelectCombatant }: GroupInteriorProps) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6">{group.name}</Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }} useFlexGap>
            {group.effects.map((effect) => <Chip key={effect.id} size="small" label={effect.name} />)}
          </Stack>
        </Box>

        {[0, 1, 2, 3].map((row) => (
          <Box key={row}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>{rowLabels[row]}</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(120px, 1fr))", gap: 1 }}>
              {group.slots.filter((slot) => slot.row === row).map((slot) => {
                const occupant = slot.occupantId ? combatants[slot.occupantId] : undefined;
                return (
                  <Paper key={slot.id} variant="outlined" sx={{ p: 1, minHeight: 170, bgcolor: "background.default" }}>
                    {occupant ? (
                      <CombatantCard
                        combatant={occupant}
                        selected={occupant.id === selectedAttackerId || occupant.id === selectedDefenderId}
                        onClick={() => onSelectCombatant(occupant.id)}
                      />
                    ) : (
                      <Typography variant="caption" color="text.secondary">Empty</Typography>
                    )}
                  </Paper>
                );
              })}
            </Box>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}
