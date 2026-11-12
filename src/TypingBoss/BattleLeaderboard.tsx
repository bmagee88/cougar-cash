import React from "react";
import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import { TypingBossLeaderboardEntry } from "./types";
import { COMBAT_COLORS } from "./combatFeedback";

const num = (value: number) => Number(value.toFixed(2)).toLocaleString();
const percent = (value: number) => `${Number((value * 100).toFixed(1))}%`;

export default function BattleLeaderboard({ entries }: { entries: TypingBossLeaderboardEntry[] }) {
  return <Box sx={{ mt: 2 }}>
    <Typography variant="h6" fontWeight={900}>Damage leaderboard</Typography>
    <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
      Ranked by total damage dealt. Strongest attack means the highest attack power that landed, before blocking and remaining-HP limits.
    </Typography>
    <Stack spacing={1.5}>
      {entries.map(entry => {
        const attack = entry.strongestAttack;
        return <Paper key={entry.code} variant="outlined" sx={{ p: 2, borderColor: entry.rank === 1 ? "#facc15" : "#344256" }}>
          <Stack direction="row" justifyContent="space-between" gap={1} flexWrap="wrap">
            <Typography fontWeight={900}>#{entry.rank} {entry.name}</Typography>
            <Chip label={`${num(entry.totalDamage)} total damage`} sx={{ color: COMBAT_COLORS.damage }} />
          </Stack>
          {attack ? <>
            <Typography sx={{ mt: 1, fontWeight: 800 }}>Strongest attack: {num(attack.power)} power · {num(attack.actualDamage)} damage dealt</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)" }, gap: 1, mt: 1, color: "#cbd5e1", fontSize: 14 }}>
              <span>Magnitude: {attack.base} characters</span>
              <span>Consistency: ×{num(attack.consistency)}</span>
              <span>Mean key gap: {num(attack.meanIntervalMs)} ms</span>
              <span>Timing variation: {num(attack.intervalStdDevMs)} ms</span>
              <span>Total multiplier: ×{num(attack.multiplier)}</span>
              <span>Orange: +{attack.balanced ? `${num(attack.orangePower || 0)} power` : percent(attack.orangeBonus)}</span>
              <span>Green: +{percent(attack.greenBonus)} ({attack.greenStacks} stacked)</span>
              <span>Red: {attack.balanced ? `+${percent(attack.criticalBonus || 0)} crit damage` : `${percent(attack.criticalChance)} crit chance`}</span>
              <span style={{ color: COMBAT_COLORS.shield }}>Blue block ready at release: {percent(attack.blueShield)}</span>
              <span>{attack.balanced ? `Critical: ${attack.critical ? "Yes · bank released" : "No"}` : `Critical: ${attack.critical ? "Yes · ×2" : "No · ×1"}`}</span>
              {attack.balanced && <><span>Earned power: {num(attack.earnedPower || 0)}</span><span>Support used: {num(attack.supportUsed || 0)}</span><span style={{ color: COMBAT_COLORS.shield }}>Block earned: {num(attack.guardPower || 0)}</span></>}
              {!!attack.powerBonus && <span>Golden power: +{percent(attack.powerBonus)}</span>}
              <span style={{ color: COMBAT_COLORS.shield }}>Blocked: {num(attack.blockedDamage)}</span>
              <span>{attack.moveId === "strong" ? "Power attack" : "Weak attack"} · attack #{attack.attackNumber}</span>
            </Box>
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1 }}>
              {attack.balanced ? `${num(attack.earnedPower || 0)} base power − ${num((attack.supportUsed || 0) + (attack.guardPower || 0))} class/defense power + ${num(attack.orangePower || 0)} orange + ${num(attack.criticalPower || 0)} crit ≈ ${num(attack.power)} attack power` : <>{attack.base} × {num(attack.consistency)} × (1 + {num(attack.orangeBonus)} + {num(attack.greenBonus)}) × {attack.critical ? 2 : 1}{attack.powerBonus ? ` × ${num(1 + attack.powerBonus)}` : ""} ≈ {num(attack.power)} power (rounded factors)</>}
            </Typography>
          </> : <Typography sx={{ mt: 1, color: "text.secondary" }}>No attacks landed this battle.</Typography>}
        </Paper>;
      })}
    </Stack>
  </Box>;
}
