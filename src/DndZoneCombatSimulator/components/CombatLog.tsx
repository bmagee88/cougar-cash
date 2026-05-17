import React from "react";
import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from "@mui/material";

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
    <Accordion disableGutters>
      <AccordionSummary expandIcon={<Box component="span">v</Box>}>
        <Typography fontWeight={900}>Combat Log</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ maxHeight: 360, overflowY: "auto", bgcolor: "#020617", color: "grey.100", border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
          {log.map((entry, index) => (
            <Box key={`${entry}-${index}`} sx={{ borderBottom: "1px solid", borderColor: "grey.800", py: 1, fontSize: 14 }}>
              {renderLogEntry(entry)}
            </Box>
          ))}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}
