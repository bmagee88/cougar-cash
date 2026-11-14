import React from "react";
import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import { TypingBossLeaderboardEntry } from "./types";
import { COMBAT_COLORS } from "./combatFeedback";

const num = (value: number) => Number(value.toFixed(2)).toLocaleString();

function LeaderboardCard({ entry }: { entry: TypingBossLeaderboardEntry }) {
  const skill = entry.typingStats;
  const metrics = [
    { label: "Total damage", value: num(entry.totalDamage), color: COMBAT_COLORS.damage },
    { label: "DPS", value: entry.dps === undefined ? "—" : num(entry.dps), color: COMBAT_COLORS.damage },
    { label: "Strongest attack", value: entry.strongestAttack ? `${num(entry.strongestAttack.power)} power` : "No landed attack", color: "#facc15" },
  ];
  return <Paper component="article" aria-label={`${entry.name} battle results`} variant="outlined"
    sx={{ p: 2, borderColor: entry.isBoss ? "#fb923c" : entry.rank === 1 ? "#facc15" : "#344256" }}>
    <Stack direction="row" alignItems="center" gap={1}>
      <Typography fontWeight={900}>{entry.isBoss ? entry.name : `#${entry.rank} ${entry.name}`}</Typography>
      {entry.isBoss && <Chip label="Boss" size="small" sx={{ color: "#fb923c" }} />}
    </Stack>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 1, mt: 1.5 }}>
      {metrics.map(metric => <Box key={metric.label}>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>{metric.label}</Typography>
        <Typography fontWeight={900} sx={{ color: metric.color }}>{metric.value}</Typography>
      </Box>)}
    </Box>
    <Stack direction="row" flexWrap="wrap" columnGap={2} rowGap={.5} sx={{ mt: 1.5, color: "#cbd5e1", fontSize: 13 }}>
      <span>Accuracy: {skill ? `${Number((skill.accuracy * 100).toFixed(1))}%` : "—"}</span>
      <span>WPM: {skill ? num(skill.wpm) : "—"}</span>
      <span>Mean key gap: {skill ? `${num(skill.meanIntervalMs)} ms` : "—"}</span>
      <span>Timing variation: {skill ? `${num(skill.intervalStdDevMs)} ms` : "—"}</span>
    </Stack>
  </Paper>;
}

export default function BattleLeaderboard({ entries }: { entries: TypingBossLeaderboardEntry[] }) {
  const boss = entries.find(entry => entry.isBoss);
  const players = entries.filter(entry => !entry.isBoss);
  return <Box sx={{ mt: 2 }}>
    <Typography variant="h6" fontWeight={900}>Battle leaderboard</Typography>
    <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
      Players ranked by total damage. DPS and WPM average the battle duration. Strongest attack shows power before defenses.
    </Typography>
    <Stack spacing={1.5}>
      {boss && <LeaderboardCard entry={boss} />}
      {players.map(entry => <LeaderboardCard key={entry.code} entry={entry} />)}
    </Stack>
  </Box>;
}
