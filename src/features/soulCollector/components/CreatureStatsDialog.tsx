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
import { LevelDisplay } from "./LevelDisplay";

function normalizeValue(value: number, min: number, max: number) {
  if (max === min) return 100;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

export function CreatureStatsDialog({
  creature,
  onClose,
}: {
  creature: Creature | null;
  onClose: () => void;
}) {
  const groupedSkills = creature
    ? {
        "Damage Attack": Object.entries(creature.hiddenSkills).filter(
          ([skillName]) => skillName.endsWith("Attack"),
        ),
        "Damage Defense": Object.entries(creature.hiddenSkills).filter(
          ([skillName]) => skillName.endsWith("Defense"),
        ),
        Utility: Object.entries(creature.hiddenSkills).filter(
          ([skillName]) =>
            !skillName.endsWith("Attack") && !skillName.endsWith("Defense"),
        ),
      }
    : {};

  const allSkills = creature ? Object.values(creature.hiddenSkills) : [];

  const minCurrent =
    allSkills.length > 0
      ? Math.min(...allSkills.map((skill) => skill.current))
      : 0;
  const maxCurrent =
    allSkills.length > 0
      ? Math.max(...allSkills.map((skill) => skill.current))
      : 1000;

  const minGrowth =
    allSkills.length > 0
      ? Math.min(...allSkills.map((skill) => skill.growthPotential))
      : 0;
  const maxGrowth =
    allSkills.length > 0
      ? Math.max(...allSkills.map((skill) => skill.growthPotential))
      : 10;

  return (
    <Dialog open={Boolean(creature)} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>
        {creature
          ? `${creature.emoji} ${creature.name} Stats`
          : "Creature Stats"}
      </DialogTitle>

      <DialogContent>
        {creature && (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Card variant="outlined">
              <CardContent>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  gap={1}
                  justifyContent="space-between"
                >
                  <Box>
                    <Typography variant="h5" fontWeight={800}>
                      {creature.emoji} {creature.name}
                    </Typography>
                    <Typography color="text.secondary">
                      Type: {creature.type}
                    </Typography>
                  </Box>

                  <Stack
                    direction="row"
                    gap={2}
                    flexWrap="wrap"
                    alignItems="center"
                  >
                    <Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        fontWeight="bold"
                      >
                        Level
                      </Typography>
                      <LevelDisplay level={creature.level} />
                    </Box>
                    <Box sx={{ minWidth: 160 }}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">
                          HP
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {creature.hp}/{creature.maxHp}
                        </Typography>
                      </Stack>

                      <LinearProgress
                        variant="determinate"
                        value={Math.max(
                          0,
                          Math.min(100, (creature.hp / creature.maxHp) * 100),
                        )}
                        sx={{
                          height: 8,
                          borderRadius: 999,
                          mt: 0.5,
                        }}
                      />
                    </Box>{" "}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            {Object.entries(groupedSkills).map(([groupName, skills]) => (
              <TableContainer
                key={groupName}
                component={Paper}
                variant="outlined"
              >
                <Typography
                  variant="subtitle1"
                  fontWeight={800}
                  sx={{ px: 2, pt: 2 }}
                >
                  {groupName}
                </Typography>

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
                    {skills.map(([skillName, skill]: [string, HiddenSkill]) => {
                      const normalizedCurrent = normalizeValue(
                        skill.current,
                        minCurrent,
                        maxCurrent,
                      );
                      const normalizedGrowth = normalizeValue(
                        skill.growthPotential,
                        minGrowth,
                        maxGrowth,
                      );

                      return (
                        <TableRow key={skillName}>
                          <TableCell>{skillName}</TableCell>

                          <TableCell align="right" sx={{ minWidth: 150 }}>
                            <Typography variant="caption">
                              {skill.current.toFixed(2)}
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={normalizedCurrent}
                              sx={{ height: 7, borderRadius: 999, mt: 0.5 }}
                            />
                          </TableCell>

                          <TableCell align="right">
                            {Math.floor(skill.current)}
                          </TableCell>

                          <TableCell align="right">
                            {skill.maxReached.toFixed(2)}
                          </TableCell>

                          <TableCell align="right" sx={{ minWidth: 150 }}>
                            <Typography variant="caption">
                              {skill.growthPotential.toFixed(2)}/10
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={normalizedGrowth}
                              sx={{ height: 7, borderRadius: 999, mt: 0.5 }}
                            />
                          </TableCell>

                          <TableCell>
                            <Typography
                              variant="body2"
                              sx={getTraitSx(skill.trait)}
                            >
                              {skill.trait}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
