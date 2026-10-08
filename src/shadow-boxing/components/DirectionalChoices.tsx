import { Box, ButtonBase, Paper, Typography, alpha } from "@mui/material";
import { Direction, DirectionalOption, DIRECTIONS } from "../types/shadowBoxing";

const GRID_POSITIONS: Record<Direction, { gridColumn: string; gridRow: string }> = {
  up: { gridColumn: "2", gridRow: "1" },
  left: { gridColumn: "1", gridRow: "2" },
  right: { gridColumn: "3", gridRow: "2" },
  down: { gridColumn: "2", gridRow: "3" },
};

interface DirectionalChoicesProps {
  promptLabel: string;
  options: DirectionalOption[];
  onChoose: (direction: Direction) => void;
  disabled?: boolean;
  highlightedDirection?: Direction;
  selectedDirection?: Direction;
  darkMode?: boolean;
  mode?: "attack" | "defense" | "correction";
}

export default function DirectionalChoices({
  promptLabel,
  options,
  onChoose,
  disabled = false,
  highlightedDirection,
  selectedDirection,
  darkMode = false,
  mode = "attack",
}: DirectionalChoicesProps) {
  const byDirection = new Map(options.map((option) => [option.direction, option]));
  const promptBg = darkMode ? "#111827" : "#fff";
  const promptColor = darkMode ? "#f8fafc" : "#0f172a";
  const modeColor =
    mode === "defense" ? "#6f93ad" : mode === "correction" ? "#86efac" : "#a34848";
  const promptFontSize =
    promptLabel.length > 16
      ? { xs: "0.96rem", sm: "1.18rem", md: "1.34rem" }
      : promptLabel.length > 10
      ? { xs: "1.08rem", sm: "1.42rem", md: "1.58rem" }
      : { xs: "1.24rem", sm: "1.68rem", md: "1.9rem" };

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "minmax(150px, 0.8fr) minmax(260px, 1fr)" },
        gap: { xs: 1.25, sm: 1.5 },
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        maxWidth: 680,
        mx: "auto",
      }}
    >
      <Paper
        elevation={5}
        sx={{
          minHeight: { xs: 76, sm: 132 },
          borderRadius: 2,
          p: { xs: 1.5, sm: 2 },
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: promptBg,
          color: promptColor,
          border: `2px solid ${alpha(modeColor, darkMode ? 0.58 : 0.35)}`,
        }}
      >
        <Typography
          component="span"
          sx={{
            fontWeight: 950,
            textTransform: "uppercase",
            textAlign: "center",
            lineHeight: 1,
            fontSize: promptFontSize,
            overflowWrap: "anywhere",
          }}
        >
          {promptLabel}
        </Typography>
      </Paper>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(72px, 1fr))",
          gridTemplateRows: "repeat(3, minmax(58px, auto))",
          gap: { xs: 0.75, sm: 1 },
          alignItems: "stretch",
          maxWidth: 420,
          width: "100%",
          mx: "auto",
        }}
      >
        {DIRECTIONS.map((direction) => {
          const option = byDirection.get(direction);
          const highlighted = highlightedDirection === direction;
          const selected = selectedDirection === direction;
          const optionFontSize =
            (option?.label.length ?? 0) > 14
              ? { xs: "0.68rem", sm: "0.78rem", md: "0.86rem" }
              : (option?.label.length ?? 0) > 9
              ? { xs: "0.78rem", sm: "0.9rem", md: "0.98rem" }
              : { xs: "0.9rem", sm: "1rem", md: "1.08rem" };

          if (!option) {
            return (
              <Box
                key={direction}
                sx={{
                  ...GRID_POSITIONS[direction],
                  minHeight: { xs: 58, sm: 68 },
                }}
              />
            );
          }

          return (
            <ButtonBase
              key={direction}
              disabled={disabled}
              focusRipple
              onClick={() => onChoose(direction)}
              aria-label={`${direction} ${option.label}`}
              sx={{
                ...GRID_POSITIONS[direction],
                minHeight: { xs: 58, sm: 68 },
                borderRadius: 2,
                outline: "3px solid transparent",
                outlineOffset: 2,
                "&:focus-visible": {
                  outlineColor: darkMode ? "#f8fafc" : "#111827",
                },
              }}
            >
              <Paper
                elevation={highlighted || selected ? 7 : 2}
                sx={{
                  width: "100%",
                  height: "100%",
                  p: { xs: 1, sm: 1.25 },
                  borderRadius: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "3px solid",
                  borderColor: highlighted
                    ? "#16a34a"
                    : selected
                    ? "#f59e0b"
                    : darkMode
                    ? "rgba(226,232,240,0.26)"
                    : "rgba(15, 23, 42, 0.14)",
                  bgcolor: highlighted
                    ? alpha("#22c55e", 0.2)
                    : selected
                    ? alpha("#f59e0b", 0.18)
                    : darkMode
                    ? "rgba(15,23,42,0.86)"
                    : "rgba(255, 255, 255, 0.95)",
                  color: darkMode ? "#f8fafc" : "#0f172a",
                  transition:
                    "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease",
                  "@media (prefers-reduced-motion: reduce)": {
                    transition: "none",
                  },
                  ".MuiButtonBase-root:hover &": {
                    transform: disabled ? "none" : "translateY(-1px)",
                  },
                }}
              >
                <Typography
                  component="span"
                  sx={{
                    fontWeight: 900,
                    textTransform: "uppercase",
                    textAlign: "center",
                    lineHeight: 1.05,
                    fontSize: optionFontSize,
                    overflowWrap: "anywhere",
                  }}
                >
                  {option.label}
                </Typography>
              </Paper>
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
}


