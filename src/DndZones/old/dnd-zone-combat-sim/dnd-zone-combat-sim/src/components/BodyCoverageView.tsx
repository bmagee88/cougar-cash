import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import { BODY_SCALE_MAX, humanoidBodyMap, missZones } from "../engine/data/bodyMaps";
import type { Combatant } from "../engine/types/character";
import type { AttackResult } from "../engine/types/combat";

interface BodyCoverageViewProps {
  combatant?: Combatant;
  result?: AttackResult;
}

export function BodyCoverageView({ combatant, result }: BodyCoverageViewProps) {
  if (!combatant) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6">Body Coverage</Typography>
        <Typography variant="body2" color="text.secondary">Select a defender to inspect armor coverage.</Typography>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="h6">{combatant.name} Body Coverage</Typography>
        <Box sx={{ position: "relative", height: 460, border: 1, borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
          {humanoidBodyMap.map((part) => {
            const top = ((BODY_SCALE_MAX - part.end) / BODY_SCALE_MAX) * 100;
            const height = ((part.end - part.start + 1) / BODY_SCALE_MAX) * 100;
            return (
              <Box key={part.id} sx={{ position: "absolute", top: `${top}%`, height: `${height}%`, left: 0, right: 0, borderBottom: 1, borderColor: "divider", px: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography variant="caption">{part.name}</Typography>
                <Typography variant="caption">{part.start}-{part.end}</Typography>
              </Box>
            );
          })}
          {missZones.map((zone) => {
            const top = ((BODY_SCALE_MAX - zone.end) / BODY_SCALE_MAX) * 100;
            const height = ((zone.end - zone.start + 1) / BODY_SCALE_MAX) * 100;
            return <Box key={zone.id} sx={{ position: "absolute", top: `${top}%`, height: `${height}%`, left: 0, right: 0, bgcolor: "rgba(0,0,0,0.08)", borderTop: 1, borderBottom: 1, borderColor: "text.secondary" }} />;
          })}
          {combatant.equipment.armor.flatMap((armor) => armor.coverageRanges.map((range, index) => {
            const top = ((BODY_SCALE_MAX - range.end) / BODY_SCALE_MAX) * 100;
            const height = ((range.end - range.start + 1) / BODY_SCALE_MAX) * 100;
            return (
              <Box key={`${armor.id}-${index}`} sx={{ position: "absolute", top: `${top}%`, height: `${height}%`, left: `${10 + index * 8}%`, width: "32%", bgcolor: "rgba(25, 118, 210, 0.25)", border: 1, borderColor: "primary.main", borderRadius: 1, px: 0.5, overflow: "hidden" }}>
                <Typography variant="caption" noWrap>{armor.name}</Typography>
              </Box>
            );
          }))}
          {result && (
            <Box sx={{ position: "absolute", top: `${((BODY_SCALE_MAX - result.finalMarker) / BODY_SCALE_MAX) * 100}%`, left: 0, right: 0, height: 3, bgcolor: "error.main" }} />
          )}
        </Box>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }} useFlexGap>
          {combatant.equipment.armor.map((armor) => <Chip key={armor.id} size="small" label={armor.name} />)}
        </Stack>
      </Stack>
    </Paper>
  );
}
