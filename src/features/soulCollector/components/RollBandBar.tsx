import { Box, Stack, Typography } from "@mui/material";
import type { RollBandData } from "../types";
import { getBandThresholds } from "../battleMath";
import { getTraitLabel } from "../uiHelpers";

export function RollBandBar({ data }: { data: RollBandData }) {
  const bands = getBandThresholds(data.skillValue);
  const superWidth = (Math.max(0, bands.superEnd) / 1000) * 100;
  const effectiveWidth = (Math.max(0, bands.effectiveEnd - bands.effectiveStart + 1) / 1000) * 100;
  const notEffectiveWidth = (Math.max(0, 1000 - bands.notEffectiveStart + 1) / 1000) * 100;
  const rollLeft = Math.min(100, Math.max(0, (data.roll / 1000) * 100));

  return (
    <Box sx={{ mt: 1.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
        <Typography variant="caption" fontWeight={800}>{data.title}: {data.skillName}</Typography>
        <Typography variant="caption">Roll {data.roll} | Skill {data.skillValue} | Trait {getTraitLabel(data.trait)}</Typography>
      </Stack>
      <Box sx={{ position: "relative", pt: 2, pb: 0.5 }}>
        <Box sx={{ position: "absolute", left: `${rollLeft}%`, top: 0, transform: "translateX(-50%)", fontSize: 18, lineHeight: 1 }}>▼</Box>
        <Stack direction="row" sx={{ height: 18, borderRadius: 999, overflow: "hidden", border: "1px solid", borderColor: "divider" }}>
          <Box sx={{ width: `${superWidth}%`, bgcolor: "success.light" }} />
          <Box sx={{ width: `${effectiveWidth}%`, bgcolor: "warning.light" }} />
          <Box sx={{ width: `${notEffectiveWidth}%`, bgcolor: "error.light" }} />
        </Stack>
      </Box>
      <Stack direction="row" justifyContent="space-between" gap={1} flexWrap="wrap">
        <Typography variant="caption"><strong>Super Effective</strong>: {bands.superStart}-{bands.superEnd}</Typography>
        <Typography variant="caption"><span style={{ textDecoration: "underline" }}>Effective</span>: {bands.effectiveStart}-{bands.effectiveEnd}</Typography>
        <Typography variant="caption"><em>Not Effective</em>: {bands.notEffectiveStart <= 1000 ? `${bands.notEffectiveStart}-1000` : "none"}</Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary">{data.note}</Typography>
    </Box>
  );
}
