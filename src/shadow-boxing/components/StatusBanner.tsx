import { Chip, Paper, Stack, Typography } from "@mui/material";
import { GameState } from "../types/shadowBoxing";
import { TOPIC_LABELS } from "../data/vocabulary";

interface StatusBannerProps {
  state: GameState;
}

export default function StatusBanner({ state }: StatusBannerProps) {
  const attacker = state.players[state.attackerId];
  const defender = state.players[state.defenderId];
  const playerIsAttacking = state.attackerId === "player";
  const headline =
    state.phase === "defender-live" && state.defenderId === "player"
      ? "DEFEND"
      : playerIsAttacking
      ? "YOU ARE ATTACKING"
      : "COMPUTER ATTACKING";

  return (
    <Paper
      elevation={3}
      sx={{
        borderRadius: 2,
        p: { xs: 1.5, sm: 2 },
        bgcolor: "rgba(255,255,255,0.9)",
        border: "1px solid rgba(15,23,42,0.1)",
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.25}
        alignItems={{ xs: "stretch", md: "center" }}
        justifyContent="space-between"
      >
        <Stack spacing={0.25}>
          <Typography
            variant="overline"
            sx={{ color: "#64748b", fontWeight: 900, letterSpacing: 0 }}
          >
            {state.message}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 950, color: "#0f172a" }}>
            {headline}
          </Typography>
          <Typography variant="body2" sx={{ color: "#475569" }}>
            {attacker.label} attacks. {defender.label} defends.
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label={state.settings.difficulty.toUpperCase()} color="primary" />
          <Chip label={TOPIC_LABELS[state.settings.topic]} />
          <Chip label={`COMBO ${state.comboFailures}/3`} color="warning" />
          {state.settings.trickMe && <Chip label="TRICK ME" color="secondary" />}
        </Stack>
      </Stack>
    </Paper>
  );
}

