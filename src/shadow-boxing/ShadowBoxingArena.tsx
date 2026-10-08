import {
  Box,
  Button,
  FormControlLabel,
  LinearProgress,
  Paper,
  Stack,
  Switch,
  Typography,
  alpha,
} from "@mui/material";
import DirectionalChoices from "./components/DirectionalChoices";
import HeartDisplay from "./components/HeartDisplay";
import {
  ComboRecap,
  Direction,
  DirectionalOption,
  GameState,
  PlayerId,
} from "./types/shadowBoxing";

export interface ActiveActionView {
  actorId: PlayerId;
  promptLabel: string;
  options: DirectionalOption[];
  mode: "attack" | "defense" | "correction";
  highlightedDirection?: Direction;
  isRecap?: boolean;
}

export interface PlayerRecapStatus {
  index: number;
  total: number;
  frozen: boolean;
}

export interface PhaseEvent {
  id: number;
  playerId: PlayerId;
  symbol: string;
  color: string;
}

interface ShadowBoxingArenaProps {
  state: GameState;
  activeViews: Record<PlayerId, ActiveActionView | undefined>;
  activeDirection?: Direction;
  phaseEvents: PhaseEvent[];
  darkMode: boolean;
  debugMode: boolean;
  paused: boolean;
  recapStatus: Record<PlayerId, PlayerRecapStatus>;
  onChoose: (playerId: PlayerId, direction: Direction) => void;
  onChangeSettings: () => void;
  onDarkModeChange: (checked: boolean) => void;
  onDebugModeChange: (checked: boolean) => void;
}

function getRoleMode(state: GameState, playerId: PlayerId): "attack" | "defense" {
  return state.attackerId === playerId ? "attack" : "defense";
}

function panelColors(
  mode: "attack" | "defense",
  darkMode: boolean,
  active: boolean
) {
  if (mode === "attack") {
    return {
      bg: darkMode ? "#3f2227" : "#ebc8c8",
      border: active ? "#dc2626" : alpha("#dc2626", 0.35),
    };
  }

  return {
    bg: darkMode ? "#203545" : "#d4e3ee",
    border: active ? "#2563eb" : alpha("#2563eb", 0.32),
  };
}

function ComboChain({
  recaps,
  recapStatus,
  activeViews,
  phaseEvents,
  darkMode,
}: {
  recaps: ComboRecap[];
  recapStatus: Record<PlayerId, PlayerRecapStatus>;
  activeViews: Record<PlayerId, ActiveActionView | undefined>;
  phaseEvents: PhaseEvent[];
  darkMode: boolean;
}) {
  const primaryActiveView = activeViews.player ?? activeViews.computer;
  const finalLabel =
    primaryActiveView?.mode === "defense" || primaryActiveView?.mode === "correction"
      ? "DEFEND"
      : primaryActiveView?.actorId === "computer"
      ? "COMPUTER ATTACK"
      : "PLAYER ATTACK";
  const finalColor =
    primaryActiveView?.mode === "defense" || primaryActiveView?.mode === "correction"
      ? "#2563eb"
      : "#dc2626";
  const eventByPlayer = phaseEvents.reduce<
    Record<PlayerId, PhaseEvent | undefined>
  >(
    (events, event) => ({
      ...events,
      [event.playerId]: event,
    }),
    { player: undefined, computer: undefined }
  );
  const getLaneMarker = (playerId: PlayerId) => {
    const event = eventByPlayer[playerId];
    if (event) {
      return {
        symbol: event.symbol,
        color: event.color,
      };
    }

    const view = activeViews[playerId];
    if (!view || view.isRecap) return undefined;

    if (view.mode === "defense" || view.mode === "correction") {
      return {
        symbol: "🛡️",
        color: "#2563eb",
      };
    }

    return {
      symbol: playerId === "computer" ? "↓" : "↑",
      color: "#dc2626",
    };
  };
  const computerMarker = getLaneMarker("computer");
  const playerMarker = getLaneMarker("player");
  const displayedFinalColor =
    playerMarker?.color ?? computerMarker?.color ?? finalColor;

  const renderBar = (playerId: PlayerId, index: number) => {
    const status = recapStatus[playerId];
    const view = activeViews[playerId];
    const isActive =
      view?.actorId === playerId &&
      ((view.isRecap && index === status.index) ||
        (!view.isRecap && index === recaps.length));

    return (
      <Stack spacing={0.2}>
        {playerId === "computer" && (
          <Typography
            component="span"
            sx={{
              height: 9,
              fontSize: 8,
              lineHeight: "9px",
              fontWeight: 950,
              textAlign: "center",
              color: darkMode ? "#bfdbfe" : "#1e3a8a",
              opacity: isActive ? 1 : 0,
            }}
          >
            COMPUTER
          </Typography>
        )}
        <LinearProgress
          variant="determinate"
          value={isActive ? 100 : 0}
          sx={{
            height: 7,
            borderRadius: 2,
            bgcolor: darkMode
              ? "rgba(148,163,184,0.18)"
              : "rgba(148,163,184,0.24)",
            opacity: isActive ? 1 : 0,
            "& .MuiLinearProgress-bar": {
              bgcolor: status.frozen ? "#60a5fa" : "#2563eb",
            },
          }}
        />
        {playerId === "player" && (
          <Typography
            component="span"
            sx={{
              height: 9,
              fontSize: 8,
              lineHeight: "9px",
              fontWeight: 950,
              textAlign: "center",
              color: darkMode ? "#bfdbfe" : "#1e3a8a",
              opacity: isActive ? 1 : 0,
            }}
          >
            YOU
          </Typography>
        )}
      </Stack>
    );
  };

  const renderLaneMarker = (
    marker: { symbol: string; color: string } | undefined,
    playerId: PlayerId
  ) => (
    <Typography
      component="div"
      sx={{
        minHeight: 28,
        fontSize: marker ? 24 : 20,
        lineHeight: 1.15,
        fontWeight: 950,
        color: marker?.color ?? (darkMode ? "rgba(226,232,240,0.22)" : "rgba(15,23,42,0.16)"),
      }}
      aria-label={`${playerId} phase marker`}
    >
      {marker?.symbol ?? ""}
    </Typography>
  );

  return (
    <Paper
      elevation={3}
      sx={{
        p: { xs: 1, sm: 1.25 },
        borderRadius: 2,
        bgcolor: darkMode ? "rgba(15,23,42,0.88)" : "rgba(255,255,255,0.78)",
        border: darkMode
          ? "1px solid rgba(226,232,240,0.18)"
          : "1px solid rgba(15,23,42,0.1)",
      }}
    >
      <Stack spacing={0.5}>
        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
          useFlexGap
          justifyContent="center"
          alignItems="stretch"
          sx={{ minHeight: 68 }}
        >
          {recaps.map((recap, index) => {
              const computerActive =
                activeViews.computer?.isRecap &&
                recapStatus.computer.index === index;
              const playerActive =
                activeViews.player?.isRecap && recapStatus.player.index === index;
              const frozenHere =
                (computerActive && recapStatus.computer.frozen) ||
                (playerActive && recapStatus.player.frozen);
              const isActive = computerActive || playerActive;

              return (
                <Box
                  key={`${recap.conceptId}-${index}`}
                  sx={{
                    position: "relative",
                    minWidth: 126,
                    maxWidth: 170,
                    px: 1,
                    py: 0.75,
                    borderRadius: 1.25,
                    bgcolor: frozenHere
                      ? "rgba(125,211,252,0.28)"
                      : darkMode
                      ? "rgba(30,41,59,0.9)"
                      : "#eef2ff",
                    color: darkMode ? "#f8fafc" : "#1e293b",
                    boxShadow: frozenHere
                      ? "0 0 18px rgba(96,165,250,0.95)"
                      : isActive
                      ? "0 0 0 2px rgba(37,99,235,0.26)"
                      : "none",
                  }}
                >
                  {renderBar("computer", index)}
                  {frozenHere && (
                    <Box
                      sx={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: 1.25,
                        bgcolor: "rgba(125,211,252,0.18)",
                        pointerEvents: "none",
                      }}
                    />
                  )}
                  <Typography
                    component="div"
                    sx={{
                      position: "relative",
                      zIndex: 1,
                      fontSize: recap.prompt.length + recap.correctAnswer.length > 18 ? 10 : 12,
                      lineHeight: 1.1,
                      fontWeight: 900,
                      textAlign: "center",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {recap.prompt.toUpperCase()} {"->"}{" "}
                    {recap.correctAnswer.toUpperCase()}
                  </Typography>
                  {renderBar("player", index)}
                </Box>
              );
          })}

            <Box
              sx={{
                minWidth: 88,
                px: 1,
                py: 0.75,
                borderRadius: 1.25,
                bgcolor: darkMode ? "rgba(15,23,42,0.78)" : "rgba(255,255,255,0.78)",
                color: displayedFinalColor,
                border: `2px solid ${alpha(displayedFinalColor, primaryActiveView || playerMarker || computerMarker ? 0.75 : 0.24)}`,
                textAlign: "center",
                fontWeight: 950,
              }}
              aria-label={`${finalLabel} marker`}
            >
              {renderBar("computer", recaps.length)}
              {renderLaneMarker(computerMarker, "computer")}
              {renderLaneMarker(playerMarker, "player")}
              {renderBar("player", recaps.length)}
            </Box>
        </Stack>
      </Stack>
    </Paper>
  );
}

function ActionPanel({
  playerId,
  label,
  state,
  activeView,
  activeDirection,
  darkMode,
  debugMode,
  paused,
  frozen,
  onChoose,
}: {
  playerId: PlayerId;
  label: string;
  state: GameState;
  activeView?: ActiveActionView;
  activeDirection?: Direction;
  darkMode: boolean;
  debugMode: boolean;
  paused: boolean;
  frozen: boolean;
  onChoose: (playerId: PlayerId, direction: Direction) => void;
}) {
  const roleMode = getRoleMode(state, playerId);
  const isActive = activeView?.actorId === playerId;
  const colors = panelColors(roleMode, darkMode, isActive);
  const showChoices = isActive && (playerId !== "computer" || debugMode);

  return (
    <Paper
      elevation={isActive ? 8 : 2}
      sx={{
        position: "relative",
        minHeight: { xs: 132, sm: 158 },
        borderRadius: 2,
        p: { xs: 1, sm: 1.25 },
        bgcolor: colors.bg,
        border: `2px solid ${colors.border}`,
        opacity: isActive ? 1 : 0.86,
        overflow: "hidden",
        boxShadow: frozen
          ? "0 0 24px rgba(96,165,250,0.85)"
          : isActive
          ? undefined
          : "none",
      }}
    >
      {frozen && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            zIndex: 2,
            bgcolor: "rgba(125,211,252,0.24)",
            display: "grid",
            placeItems: "center",
            pointerEvents: "none",
          }}
        >
          <Typography sx={{ fontWeight: 950, color: "#1e3a8a" }}>
            FROZEN
          </Typography>
        </Box>
      )}

      <Stack spacing={0.75}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography
            variant="caption"
            sx={{
              fontWeight: 950,
              color: darkMode ? "#f8fafc" : "#0f172a",
            }}
          >
            {label.toUpperCase()}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 950,
              color: roleMode === "attack" ? "#991b1b" : "#1d4ed8",
            }}
          >
            {roleMode === "attack" ? "ATTACKER" : "DEFENDER"}
          </Typography>
        </Stack>

        {showChoices && activeView ? (
          <DirectionalChoices
            promptLabel={activeView.promptLabel}
            options={activeView.options}
            onChoose={(direction) => onChoose(playerId, direction)}
            disabled={paused || frozen}
            highlightedDirection={activeView.highlightedDirection}
            selectedDirection={activeDirection}
            darkMode={darkMode}
            mode={activeView.mode}
          />
        ) : (
          <Box
            aria-label={isActive ? `${label} hidden action` : `${label} inactive`}
            sx={{
              minHeight: { xs: 92, sm: 118 },
              borderRadius: 2,
              bgcolor: darkMode
                ? "rgba(15,23,42,0.32)"
                : "rgba(255,255,255,0.24)",
            }}
          />
        )}
      </Stack>
    </Paper>
  );
}

export default function ShadowBoxingArena({
  state,
  activeViews,
  activeDirection,
  phaseEvents,
  darkMode,
  debugMode,
  paused,
  recapStatus,
  onChoose,
  onChangeSettings,
  onDarkModeChange,
  onDebugModeChange,
}: ShadowBoxingArenaProps) {
  const pageBg = darkMode
    ? "linear-gradient(135deg, #020617 0%, #111827 46%, #1e1b4b 100%)"
    : "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 48%, #f8d4d4 100%)";

  return (
    <Box
      sx={{
        minHeight: "100vh",
        position: "relative",
        p: { xs: 1.5, sm: 2.5, md: 3 },
        background: pageBg,
        color: darkMode ? "#f8fafc" : "#0f172a",
        overflow: "hidden",
      }}
    >
      <Box sx={{ position: "absolute", top: 14, left: 14, zIndex: 4 }}>
        <HeartDisplay
          label="Computer"
          hearts={state.players.computer.hearts}
          maxHearts={state.settings.hearts}
          darkMode={darkMode}
        />
      </Box>

      <Box sx={{ position: "absolute", right: 16, bottom: 16, zIndex: 4 }}>
        <HeartDisplay
          label="Human"
          hearts={state.players.player.hearts}
          maxHearts={state.settings.hearts}
          scale={2}
          darkMode={darkMode}
        />
      </Box>

      <Stack spacing={1.15} sx={{ maxWidth: 880, mx: "auto", pt: { xs: 7, sm: 6 } }}>
        <Stack
          direction="row"
          spacing={1.25}
          justifyContent="center"
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
        >
          <FormControlLabel
            control={
              <Switch
                checked={darkMode}
                onChange={(event) => onDarkModeChange(event.target.checked)}
              />
            }
            label="Dark"
          />
          {process.env.NODE_ENV !== "production" && (
            <FormControlLabel
              control={
                <Switch
                  checked={debugMode}
                  onChange={(event) => onDebugModeChange(event.target.checked)}
                />
              }
              label="Debug"
            />
          )}
          {paused && (
            <Typography variant="caption" sx={{ fontWeight: 900, color: "#f59e0b" }}>
              PAUSED
            </Typography>
          )}
        </Stack>

        <ActionPanel
          playerId="computer"
          label="Computer"
          state={state}
          activeView={activeViews.computer}
          activeDirection={activeDirection}
          darkMode={darkMode}
          debugMode={debugMode}
          paused={paused}
          frozen={recapStatus.computer.frozen}
          onChoose={onChoose}
        />

        <ComboChain
          recaps={state.comboRecaps}
          recapStatus={recapStatus}
          activeViews={activeViews}
          phaseEvents={phaseEvents}
          darkMode={darkMode}
        />

        <ActionPanel
          playerId="player"
          label="You"
          state={state}
          activeView={activeViews.player}
          activeDirection={activeDirection}
          darkMode={darkMode}
          debugMode={debugMode}
          paused={paused}
          frozen={recapStatus.player.frozen}
          onChoose={onChoose}
        />

        <Stack direction="row" justifyContent="center">
          <Button
            variant="text"
            onClick={onChangeSettings}
            sx={{ color: darkMode ? "#cbd5e1" : "#334155", fontWeight: 800 }}
          >
            CHANGE SETTINGS
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

