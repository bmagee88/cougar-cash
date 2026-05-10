import { Box, Button, Card, CardContent, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import type { Creature } from "../types";

export function CreatureCard({ creature, title, onViewStats, devMode }: { creature: Creature | null; title: string; onViewStats: (creature: Creature) => void; devMode: boolean }) {
  if (!creature) {
    return (
      <Card variant="outlined" sx={{ minHeight: 190 }}>
        <CardContent>
          <Typography variant="h6">{title}</Typography>
          <Typography color="text.secondary">Empty</Typography>
        </CardContent>
      </Card>
    );
  }

  const hpPercent = Math.max(0, (creature.hp / creature.maxHp) * 100);

  return (
    <Card variant="outlined" sx={{ minHeight: 190 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
          <Typography variant="h6">{title}</Typography>
          <Chip label={creature.level} size="small" />
        </Stack>
        <Typography variant="h3" sx={{ my: 1 }}>{creature.emoji}</Typography>
        <Typography variant="subtitle1" fontWeight={700}>{creature.name}</Typography>
        <Typography variant="body2" color="text.secondary">Type: {creature.type}</Typography>
        {devMode && <Button size="small" sx={{ mt: 1 }} onClick={() => onViewStats(creature)}>View Stats</Button>}
        <Box sx={{ mt: 1 }}>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="caption">HP</Typography>
            <Typography variant="caption">{creature.hp}/{creature.maxHp}</Typography>
          </Stack>
          <LinearProgress variant="determinate" value={hpPercent} sx={{ height: 8, borderRadius: 999 }} />
        </Box>
      </CardContent>
    </Card>
  );
}
