import { Badge, Card, CardActionArea, CardContent, Stack, Typography } from "@mui/material";
import type { BattleGroup } from "../engine/types/battlefield";

interface BattleGroupCardProps {
  group: BattleGroup;
  selected?: boolean;
  onClick: () => void;
}

export function BattleGroupCard({ group, selected, onClick }: BattleGroupCardProps) {
  const occupied = group.slots.filter((slot) => slot.occupantId).length;
  return (
    <Badge badgeContent={occupied} color="primary">
      <Card variant={selected ? "elevation" : "outlined"} sx={{ border: selected ? 2 : undefined, borderColor: "primary.main", minWidth: 180 }}>
        <CardActionArea onClick={onClick}>
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="h6">{group.name}</Typography>
              <Typography variant="caption" color="text.secondary">Grid: {group.gridX}, {group.gridY}</Typography>
              <Typography variant="caption">{group.effects.map((effect) => effect.name).join(", ") || "No terrain"}</Typography>
            </Stack>
          </CardContent>
        </CardActionArea>
      </Card>
    </Badge>
  );
}
