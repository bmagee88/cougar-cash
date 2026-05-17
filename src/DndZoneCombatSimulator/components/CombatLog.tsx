import React from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";

function renderLogEntry(entry: string) {
  const parts = entry.split(/(\*\*.*?\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <Box component="strong" key={index} sx={{ color: "warning.light" }}>{part.slice(2, -2)}</Box>;
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

export function CombatLog({ log }: { log: string[] }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" fontWeight={800} gutterBottom>Combat Log</Typography>
        <Box sx={{ maxHeight: 360, overflowY: "auto", bgcolor: "grey.950", color: "grey.100", borderRadius: 2, p: 2 }}>
          {log.map((entry, index) => (
            <Box key={`${entry}-${index}`} sx={{ borderBottom: "1px solid", borderColor: "grey.800", py: 1, fontSize: 14 }}>
              {renderLogEntry(entry)}
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}
