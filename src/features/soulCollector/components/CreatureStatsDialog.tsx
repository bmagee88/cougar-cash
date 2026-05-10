import {
  Box,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { Creature, HiddenSkill } from "../types";
import { getTraitSx } from "../uiHelpers";

export function CreatureStatsDialog({ creature, onClose }: { creature: Creature | null; onClose: () => void }) {
  const groupedSkills = creature
    ? {
        "Damage Attack": Object.entries(creature.hiddenSkills).filter(([skillName]) => skillName.endsWith("Attack")),
        "Damage Defense": Object.entries(creature.hiddenSkills).filter(([skillName]) => skillName.endsWith("Defense")),
        Utility: Object.entries(creature.hiddenSkills).filter(([skillName]) => !skillName.endsWith("Attack") && !skillName.endsWith("Defense")),
      }
    : {};

  return (
    <Dialog open={Boolean(creature)} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>{creature ? `${creature.emoji} ${creature.name} Stats` : "Creature Stats"}</DialogTitle>
      <DialogContent>
        {creature && (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Card variant="outlined">
              <CardContent>
                <Stack direction={{ xs: "column", sm: "row" }} gap={1} justifyContent="space-between">
                  <Box>
                    <Typography variant="h5" fontWeight={800}>{creature.emoji} {creature.name}</Typography>
                    <Typography color="text.secondary">Type: {creature.type}</Typography>
                  </Box>
                  <Stack direction="row" gap={1} flexWrap="wrap">
                    <Chip label={`Level ${creature.level}`} />
                    <Chip label={`HP ${creature.hp}/${creature.maxHp}`} />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
            {Object.entries(groupedSkills).map(([groupName, skills]) => (
              <TableContainer key={groupName} component={Paper} variant="outlined">
                <Typography variant="subtitle1" fontWeight={800} sx={{ px: 2, pt: 2 }}>{groupName}</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Skill</TableCell>
                      <TableCell align="right">Current</TableCell>
                      <TableCell align="right">Used Value</TableCell>
                      <TableCell align="right">Max Reached</TableCell>
                      <TableCell align="right">Growth</TableCell>
                      <TableCell>Trait</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {skills.map(([skillName, skill]: [string, HiddenSkill]) => (
                      <TableRow key={skillName}>
                        <TableCell>{skillName}</TableCell>
                        <TableCell align="right" sx={{ minWidth: 150 }}>
                          <Typography variant="caption">{skill.current.toFixed(2)}</Typography>
                          <LinearProgress variant="determinate" value={Math.min(100, (skill.current / 1000) * 100)} sx={{ height: 7, borderRadius: 999, mt: 0.5 }} />
                        </TableCell>
                        <TableCell align="right">{Math.floor(skill.current)}</TableCell>
                        <TableCell align="right">{skill.maxReached.toFixed(2)}</TableCell>
                        <TableCell align="right" sx={{ minWidth: 150 }}>
                          <Typography variant="caption">{skill.growthPotential.toFixed(2)}/10</Typography>
                          <LinearProgress variant="determinate" value={Math.min(100, (skill.growthPotential / 10) * 100)} sx={{ height: 7, borderRadius: 999, mt: 0.5 }} />
                        </TableCell>
                        <TableCell><Typography variant="body2" sx={getTraitSx(skill.trait)}>{skill.trait}</Typography></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ))}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
