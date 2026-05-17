import React from "react";
import { Box, Chip, LinearProgress, Stack, Typography } from "@mui/material";

export function StatPill({ label, value }: { label: string; value: React.ReactNode }) {
  return <Chip size="small" label={<span>{label}: <b>{value}</b></span>} variant="outlined" />;
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="caption" color="text.secondary">{value}/{max}</Typography>
      </Stack>
      <LinearProgress variant="determinate" value={percent} sx={{ height: 8, borderRadius: 999 }} />
    </Box>
  );
}
