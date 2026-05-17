import { List, ListItem, ListItemText, Paper, Typography } from "@mui/material";

interface CombatLogProps {
  logs: string[];
}

export function CombatLog({ logs }: CombatLogProps) {
  return (
    <Paper variant="outlined" sx={{ p: 2, maxHeight: 360, overflow: "auto" }}>
      <Typography variant="h6">Combat Log</Typography>
      <List dense>
        {logs.map((log, index) => (
          <ListItem key={`${log}-${index}`} disableGutters>
            <ListItemText primary={log} />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
}
