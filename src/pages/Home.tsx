import { Box, Grid, Paper, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

const tiles = [
  {
    path: "/cougar-cash",
    title: "Cougar Cash",
    subtitle: "Classroom economy & rewards",
    emoji: "💰",
    gradient: "linear-gradient(135deg, #f97316, #facc15)",
  },
  {
    path: "/typing",
    title: "Typing Game",
    subtitle: "Warm-up typing practice",
    emoji: "⌨️",
    gradient: "linear-gradient(135deg, #22c55e, #a3e635)",
  },
  {
    path: "/typing/marathon",
    title: "Typing Marathon",
    subtitle: "Endurance mode challenge",
    emoji: "🏃‍♂️",
    gradient: "linear-gradient(135deg, #3b82f6, #0ea5e9)",
  },
  {
    path: "/pie-timer",
    title: "Pie Timer App",
    subtitle: "Focus & activity timers",
    emoji: "⏱️",
    gradient: "linear-gradient(135deg, #6366f1, #a855f7)",
  },
  {
    path: "/oroboros",
    title: "Oroboros",
    subtitle: "Endless loop demo",
    emoji: "🐍",
    gradient: "linear-gradient(135deg, #ec4899, #f97316)",
  },
  {
    path: "/maze-quiz",
    title: "Maze Quiz",
    subtitle: "Find your way with answers",
    emoji: "🧩",
    gradient: "linear-gradient(135deg, #0ea5e9, #22c55e)",
  },
  {
    path: "/pizza-game",
    title: "Pizza Game",
    subtitle: "Slice up some fun",
    emoji: "🍕",
    gradient: "linear-gradient(135deg, #ef4444, #f97316)",
  },
  {
    path: "/keyboard",
    title: "Drag & Drop Keyboard",
    subtitle: "Build the keyboard layout",
    emoji: "🎹",
    gradient: "linear-gradient(135deg, #14b8a6, #22c55e)",
  },
  {
    path: "/c-quiz",
    title: "Compliance Quiz",
    subtitle: "Policy & rules check",
    emoji: "📋",
    gradient: "linear-gradient(135deg, #64748b, #0f172a)",
  },
  {
    path: "/c-quiz",
    title: "Compliance Quiz",
    subtitle: "Policy & rules check",
    emoji: "📋",
    gradient: "linear-gradient(135deg, #64748b, #0f172a)",
  },
  {
    path: "/map",
    title: "Regions Map",
    subtitle: "World Generation",
    emoji: "🗺️",
    gradient: "linear-gradient(135deg, #648b70ff, #0f2a1dff)",
  },
];

export default function Home() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        py: 6,
        px: { xs: 2, sm: 3, md: 6 },
        background: "radial-gradient(circle at top left, #e0f2fe, #f9fafb)",
      }}
    >
      <Box sx={{ mb: 4, textAlign: "center" }}>
        <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
          Cougar Tech Lab
        </Typography>
        <Typography variant="subtitle1" sx={{ color: "text.secondary" }}>
          Choose an activity to get started
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {tiles.map((tile) => (
          <Grid item xs={12} sm={6} md={4} key={tile.path}>
            <Paper
              component={RouterLink}
              to={tile.path}
              elevation={4}
              sx={{
                textDecoration: "none",
                borderRadius: 4,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                height: "100%",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                "&:hover": {
                  transform: "translateY(-4px)",
                  boxShadow: 8,
                },
              }}
            >
              {/* “Image” area */}
              <Box
                sx={{
                  background: tile.gradient,
                  minHeight: 140,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Typography
                  component="span"
                  sx={{ fontSize: 56, textAlign: "center" }}
                >
                  {tile.emoji}
                </Typography>
              </Box>

              {/* Text area */}
              <Box sx={{ p: 2.5 }}>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 600, mb: 0.5, color: "text.primary" }}
                >
                  {tile.title}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", minHeight: 36 }}
                >
                  {tile.subtitle}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
