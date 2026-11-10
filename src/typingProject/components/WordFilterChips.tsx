import React from "react";
import { Alert, Box, Chip, Stack, Typography } from "@mui/material";
import { entriesByLength, filterWordsByLength, SENTIMENTS } from "../resources/homeRowWordBank";

export type WordFilters = { gradeMask?: number; sentimentMask?: number };
const entries = Object.entries(entriesByLength).filter(([key]) => !isNaN(Number(key))).flatMap(([, values]) => values);
const grades = Array.from({ length: 13 }, (_, grade) => ({ grade, available: entries.some(entry => entry.gradeLevel === grade) }));
export const numericWordPool = (bank: Record<string, string[]>) => Object.keys(bank).filter(key => !isNaN(Number(key))).flatMap(key => bank[key]);
export const filteredWordCount = (value: WordFilters) => numericWordPool(filterWordsByLength(value.gradeMask, value.sentimentMask)).length;
const chipStyle = (selected: boolean, available = true) => ({
  fontWeight: selected ? 800 : 600,
  color: selected ? "#082f49" : "#e2e8f0",
  bgcolor: selected ? "#67e8f9" : "#182334",
  border: `1px solid ${selected ? "#a5f3fc" : "#64748b"}`,
  "&:hover": { color: selected ? "#082f49" : "#fff", bgcolor: selected ? "#a5f3fc" : "#334155" },
  "&.Mui-disabled": { opacity: 1, color: available ? "#e2e8f0" : "#94a3b8", bgcolor: available ? "#334155" : "#18202c", borderColor: available ? "#64748b" : "#334155" },
});

export default function WordFilterChips({ value, onChange, disabled = false }: {
  value: WordFilters; onChange: (value: WordFilters) => void; disabled?: boolean;
}) {
  function group(field: keyof WordFilters, title: string, options: { label: string; bit: number; available: boolean }[]) {
    const all = value[field] === undefined;
    return <Box role="group" aria-label={title}>
      <Typography fontWeight={800} sx={{ mb: 1 }}>{title}</Typography>
      <Stack direction="row" flexWrap="wrap" gap={1}>
        <Chip label="All" role="checkbox" aria-checked={all} color={all ? "primary" : "default"} variant={all ? "filled" : "outlined"}
          sx={chipStyle(all)}
          disabled={disabled} onClick={() => onChange({ ...value, [field]: all ? options.filter(option => option.available).reduce((mask, option) => mask | option.bit, 0) : undefined })} />
        {options.map(option => {
          const checked = option.available && (all || !!(value[field]! & option.bit));
          return <Chip key={option.bit} label={option.label} role="checkbox" aria-checked={checked}
            sx={chipStyle(checked, option.available)}
            color={checked ? "primary" : "default"} variant={checked ? "filled" : "outlined"}
            disabled={disabled || all || !option.available}
            onClick={() => { const mask = value[field]! ^ option.bit; if (mask) onChange({ ...value, [field]: mask }); }} />;
        })}
      </Stack>
    </Box>;
  }
  return <Stack spacing={2} sx={{ my: 2 }}>
    {group("gradeMask", "Word grades", grades.map(({ grade, available }) => ({ label: grade === 0 ? "Kindergarten" : `Grade ${grade}`, bit: 1 << grade, available })))}
    {group("sentimentMask", "Word sentiment", SENTIMENTS.map((sentiment, index) => ({ label: sentiment[0].toUpperCase() + sentiment.slice(1), bit: 1 << index, available: true })))}
    {!filteredWordCount(value) && <Alert severity="warning">No words match this combination. Choose another grade or sentiment.</Alert>}
  </Stack>;
}
