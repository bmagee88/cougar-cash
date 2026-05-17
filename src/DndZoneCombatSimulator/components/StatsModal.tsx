import React from "react";
import { Box, Button, Card, CardContent, Dialog, DialogContent, DialogTitle, Grid, Stack, Typography } from "@mui/material";
import type { Combatant } from "../engine/types/combat";
import { getEvasion, getMovementCategory, getTotalWeight } from "../engine/rules/characterRules";
import { ProgressBar, StatPill } from "./SmallBits";

const statLabels: Record<string, string> = {
  physicalStrength: "STR",
  dexterity: "DEX",
  balance: "BAL",
  magicka: "MAG",
  willpower: "WIL",
  intellect: "INT",
  charisma: "CHA",
  guts: "GUT",
  toughness: "CON",
};

export function StatsModal({ character, initiative, onClose }: { character: Combatant | null; initiative?: number; onClose: () => void }) {
  if (!character) return null;
  const weapon = character.weapons[0];
  const statRows = [
    ...Object.entries(character.stats).map(([key, value]) => ({ label: statLabels[key] ?? key, value })),
    { label: "WT", value: getTotalWeight(character) },
    { label: "EVA", value: getEvasion(character) },
    { label: "MOV", value: getMovementCategory(character) },
    { label: "INIT", value: initiative ?? character.stats.physicalStrength + character.stats.toughness - getTotalWeight(character) },
  ];

  return (
    <Dialog open={!!character} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h5" fontWeight={900}>{character.name}</Typography>
            <Typography variant="body2" color="text.secondary">{character.team}</Typography>
          </Box>
          <Button variant="outlined" onClick={onClose}>Close</Button>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card variant="outlined"><CardContent>
              <Typography fontWeight={900} gutterBottom>Stats</Typography>
              <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, overflow: "hidden" }}>
                <Grid container>
                  {statRows.map((stat) => (
                    <Grid item xs={4} key={stat.label}>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          alignItems: "center",
                          gap: 0.5,
                          bgcolor: "action.hover",
                          borderRight: "1px solid",
                          borderBottom: "1px solid",
                          borderColor: "divider",
                          px: 1,
                          py: 0.75,
                        }}
                      >
                        <Typography variant="caption" fontWeight={900} color="text.secondary">{stat.label}</Typography>
                        <Typography fontWeight={900}>{stat.value}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </CardContent></Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card variant="outlined"><CardContent>
              <Typography fontWeight={800} gutterBottom>Combat</Typography>
              <Stack gap={1.25}>
                <ProgressBar label="Fight" value={character.fight} max={character.maxFight} />
                <ProgressBar label="Blood" value={character.blood} max={character.maxBlood} />
                <ProgressBar label="Concussion" value={character.concussion} max={character.maxConcussion} />
                <Stack direction="row" gap={1} flexWrap="wrap">
                  <StatPill label="Evasion" value={getEvasion(character)} />
                  <StatPill label="Movement" value={getMovementCategory(character)} />
                  <StatPill label="Weight" value={getTotalWeight(character)} />
                </Stack>
              </Stack>
            </CardContent></Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card variant="outlined"><CardContent>
              <Typography fontWeight={800} gutterBottom>Weapon</Typography>
              <Typography fontWeight={800}>{weapon.name}</Typography>
              <Typography variant="body2">Type: {weapon.weaponType}</Typography>
              <Typography variant="body2">Weight: {weapon.weight}</Typography>
              <Typography variant="body2">Reach: {weapon.reach}</Typography>
              <Typography variant="body2">Sharp/Pierce/Blunt: {weapon.sharpness.toFixed(1)} / {weapon.piercing.toFixed(1)} / {weapon.bluntForce.toFixed(1)}</Typography>
              <Typography variant="body2">Training: {character.weaponTraining[weapon.weaponType] ?? 0}</Typography>
              <Typography variant="body2">Attunement: {character.weaponAttunement[weapon.id]?.level ?? 0} ({character.weaponAttunement[weapon.id]?.xp ?? 0} xp)</Typography>
            </CardContent></Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card variant="outlined"><CardContent>
              <Typography fontWeight={800} gutterBottom>Armor</Typography>
              <Stack gap={1}>
                {character.armor.map((armor) => (
                  <Box key={armor.id} sx={{ bgcolor: "action.hover", border: "1px solid", borderColor: "divider", borderRadius: 2, p: 1 }}>
                    <Typography fontWeight={800}>{armor.name}</Typography>
                    <Typography variant="body2">Ranges: {armor.coverageRanges.map((r) => `${r.start}-${r.end}`).join(", ")}</Typography>
                    <Typography variant="body2">Mitigation S/P/B: {armor.sharpMitigation}%/{armor.pierceMitigation}%/{armor.bluntMitigation}%</Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent></Card>
          </Grid>
        </Grid>
      </DialogContent>
    </Dialog>
  );
}
