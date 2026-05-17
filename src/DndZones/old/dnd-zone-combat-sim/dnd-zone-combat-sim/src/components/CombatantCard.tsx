import { Box, Card, CardContent, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import type { Combatant } from "../engine/types/character";
import { calculateEvasion, calculateMovementCount, getTotalEquipmentWeight } from "../engine/rules/evasionResolver";

interface CombatantCardProps {
  combatant: Combatant;
  selected?: boolean;
  onClick?: () => void;
}

export function CombatantCard({ combatant, selected, onClick }: CombatantCardProps) {
  const fightPercent = combatant.health.maxFight === 0 ? 0 : (combatant.health.fight / combatant.health.maxFight) * 100;
  const weaponNames = combatant.equipment.weapons.map((weapon) => weapon.name).join(", ");

  return (
    <Card
      onClick={onClick}
      variant={selected ? "elevation" : "outlined"}
      sx={{
        cursor: onClick ? "pointer" : "default",
        border: selected ? 2 : undefined,
        borderColor: selected ? "primary.main" : undefined,
        minHeight: 150,
      }}
    >
      <CardContent>
        <Stack spacing={1}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{combatant.name}</Typography>
            <Typography variant="caption" color="text.secondary">{combatant.team}</Typography>
          </Box>
          <Box>
            <Stack direction="row" sx={{ justifyContent: "space-between" }}>
              <Typography variant="caption">Fight</Typography>
              <Typography variant="caption">{combatant.health.fight}/{combatant.health.maxFight}</Typography>
            </Stack>
            <LinearProgress variant="determinate" value={fightPercent} />
          </Box>
          <Typography variant="caption">Weapon: {weaponNames}</Typography>
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }} useFlexGap>
            <Chip size="small" label={`Move ${calculateMovementCount(combatant)}`} />
            <Chip size="small" label={`Eva ${calculateEvasion(combatant)}`} />
            <Chip size="small" label={`Wt ${getTotalEquipmentWeight(combatant)}`} />
          </Stack>
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }} useFlexGap>
            {combatant.statuses.length === 0 ? <Chip size="small" variant="outlined" label="No status" /> : combatant.statuses.map((status, index) => (
              <Chip key={`${status.id}-${index}`} size="small" color="warning" label={status.name} />
            ))}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
