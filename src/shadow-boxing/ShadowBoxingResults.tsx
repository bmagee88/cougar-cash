import ReplayIcon from "@mui/icons-material/Replay";
import TuneIcon from "@mui/icons-material/Tune";
import {
  Box,
  Button,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { TOPIC_LABELS } from "./data/vocabulary";
import {
  getAttackAccuracy,
  getDefenseAccuracy,
} from "./engine/gameEngine";
import { formatSeconds } from "./engine/timing";
import { GameState } from "./types/shadowBoxing";

interface ShadowBoxingResultsProps {
  state: GameState;
  onPlayAgain: () => void;
  onChangeSettings: () => void;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function StatLine({ label, value }: { label: string; value: string | number }) {
  return (
    <Stack direction="row" justifyContent="space-between" gap={2}>
      <Typography variant="body2" sx={{ color: "#475569" }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 800, color: "#0f172a" }}>
        {value}
      </Typography>
    </Stack>
  );
}

export default function ShadowBoxingResults({
  state,
  onPlayAgain,
  onChangeSettings,
}: ShadowBoxingResultsProps) {
  const humanStats = state.stats.byPlayer.player;
  const computerStats = state.stats.byPlayer.computer;
  const winner = state.winnerId ? state.players[state.winnerId].label : "No winner";
  const fastestAttack =
    humanStats.attackTimesMs.length > 0
      ? Math.min(...humanStats.attackTimesMs)
      : 0;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        p: { xs: 2, sm: 4 },
        background:
          "linear-gradient(135deg, #ecfeff 0%, #fef3c7 48%, #fce7f3 100%)",
      }}
    >
      <Paper
        elevation={10}
        sx={{
          width: "100%",
          maxWidth: 860,
          borderRadius: 2,
          p: { xs: 2.5, sm: 4 },
        }}
      >
        <Stack spacing={3}>
          <Stack spacing={1} textAlign="center">
            <Typography variant="overline" sx={{ fontWeight: 900, letterSpacing: 0 }}>
              GAME OVER
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 950, color: "#0f172a" }}>
              {winner} Wins
            </Typography>
            <Typography variant="body1" sx={{ color: "#475569" }}>
              {TOPIC_LABELS[state.settings.topic]} |{" "}
              {state.settings.difficulty.toUpperCase()} |{" "}
              {state.settings.trickMe ? "Trick Me ON" : "Trick Me OFF"}
            </Typography>
          </Stack>

          <Divider />

          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={3}
            alignItems="stretch"
          >
            <Stack spacing={1.25} sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>
                Human
              </Typography>
              <StatLine
                label="Hearts remaining"
                value={state.players.player.hearts}
              />
              <StatLine
                label="Average attack"
                value={formatSeconds(average(humanStats.attackTimesMs))}
              />
              <StatLine
                label="Fastest attack"
                value={fastestAttack ? formatSeconds(fastestAttack) : "0.00 s"}
              />
              <StatLine
                label="Attack accuracy"
                value={percent(getAttackAccuracy(humanStats))}
              />
              <StatLine
                label="Defense accuracy"
                value={percent(getDefenseAccuracy(humanStats))}
              />
              <StatLine
                label="Defensive timeouts"
                value={humanStats.defenseTimeouts}
              />
              <StatLine
                label="Successful counters"
                value={humanStats.successfulCounters}
              />
              <StatLine label="Hearts lost" value={humanStats.heartsLost} />
            </Stack>

            <Divider orientation="vertical" flexItem />

            <Stack spacing={1.25} sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>
                Computer
              </Typography>
              <StatLine
                label="Hearts remaining"
                value={state.players.computer.hearts}
              />
              <StatLine
                label="Attack accuracy"
                value={percent(getAttackAccuracy(computerStats))}
              />
              <StatLine
                label="Defense accuracy"
                value={percent(getDefenseAccuracy(computerStats))}
              />
              <StatLine
                label="Defensive timeouts"
                value={computerStats.defenseTimeouts}
              />
              <StatLine
                label="Successful counters"
                value={computerStats.successfulCounters}
              />
              <StatLine label="Hearts lost" value={computerStats.heartsLost} />
              <StatLine
                label="Concepts missed"
                value={
                  humanStats.conceptsMissed.length +
                  computerStats.conceptsMissed.length
                }
              />
              <StatLine
                label="Corrected later"
                value={
                  humanStats.conceptsCorrected.length +
                  computerStats.conceptsCorrected.length
                }
              />
            </Stack>
          </Stack>

          <Paper
            variant="outlined"
            sx={{ p: 2, borderRadius: 2, bgcolor: "rgba(15,23,42,0.03)" }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 0.75 }}>
              Concepts missed
            </Typography>
            <Typography variant="body2" sx={{ color: "#475569" }}>
              {[...humanStats.conceptsMissed, ...computerStats.conceptsMissed].join(
                ", "
              ) || "None"}
            </Typography>
          </Paper>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button
              variant="contained"
              size="large"
              startIcon={<ReplayIcon />}
              onClick={onPlayAgain}
              sx={{ flex: 1, borderRadius: 2, fontWeight: 900 }}
            >
              PLAY AGAIN
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<TuneIcon />}
              onClick={onChangeSettings}
              sx={{ flex: 1, borderRadius: 2, fontWeight: 900 }}
            >
              CHANGE SETTINGS
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}

