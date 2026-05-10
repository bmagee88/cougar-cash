import type React from "react";
import { Button, ListItem, ListItemText, Stack } from "@mui/material";
import type { Creature } from "../types";

export function SmallCreatureRow({ creature, actions, onViewStats, devMode }: { creature: Creature; actions: React.ReactNode; onViewStats: (creature: Creature) => void; devMode: boolean }) {
  return (
    <ListItem
      divider
      secondaryAction={
        <Stack direction="row" gap={1} alignItems="center">
          {devMode && <Button size="small" onClick={() => onViewStats(creature)}>Stats</Button>}
          {actions}
        </Stack>
      }
      sx={{ alignItems: "flex-start", pr: 18 }}
    >
      <ListItemText primary={`${creature.emoji} ${creature.name}`} secondary={devMode ? `Type: ${creature.type} | Level: ${creature.level} | HP: ${creature.hp}/${creature.maxHp}` : `Type: ${creature.type} | HP: ${creature.hp}/${creature.maxHp}`} />
    </ListItem>
  );
}
