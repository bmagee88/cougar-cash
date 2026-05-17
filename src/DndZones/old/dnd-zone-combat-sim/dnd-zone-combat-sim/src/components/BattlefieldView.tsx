import { Box, Paper, Stack, Typography } from "@mui/material";
import type { BattleState } from "../engine/types/battlefield";
import { BattleGroupCard } from "./BattleGroupCard";

interface BattlefieldViewProps {
  state: BattleState;
  selectedGroupId: string;
  onSelectGroup: (id: string) => void;
}

export function BattlefieldView({ state, selectedGroupId, onSelectGroup }: BattlefieldViewProps) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6">Battlefield Groups</Typography>
          <Typography variant="body2" color="text.secondary">Groups are abstract areas. Adjacency does not affect range.</Typography>
        </Box>
        <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }} useFlexGap>
          {state.groups.map((group) => (
            <BattleGroupCard key={group.id} group={group} selected={group.id === selectedGroupId} onClick={() => onSelectGroup(group.id)} />
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}
