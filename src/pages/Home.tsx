import { Box, Grid, Paper, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

const tiles = [
  {
    path: "/cougar-cash",
    title: "Cougar Cash",
    subtitle: "Classroom economy & rewards",
    emoji: "💰",
    gradient: "linear-gradient(135deg, #f97316, #facc15)",
    category: "utility",
  },
  {
    path: "/typing",
    title: "Home Row Run",
    subtitle: "Warm-up typing practice.  Whats your level?  Focus on home row.",
    emoji: "⌨️",
    gradient: "linear-gradient(135deg, #22c55e, #a3e635)",
    category: "typing",
  },
  {
    path: "/typing/marathon",
    title: "Typing Marathon",
    subtitle: "Endurance mode challenge",
    emoji: "🏃‍♂️",
    gradient: "linear-gradient(135deg, #3b82f6, #0ea5e9)",
    category: "typing",
    multiplayer: true,
  },
  {
    path: "/pie-timer",
    title: "Pie Timer App",
    subtitle: "Focus & activity timers",
    emoji: "⏱️",
    gradient: "linear-gradient(135deg, #6366f1, #a855f7)",
    category: "utility",
  },
  {
    path: "/oroboros",
    title: "Oroboros",
    subtitle: "Endless loop demo",
    emoji: "🐍",
    gradient: "linear-gradient(135deg, #ec4899, #f97316)",
    category: "concept",
  },
  {
    path: "/maze-quiz",
    title: "Maze Quiz",
    subtitle: "Find your way with answers",
    emoji: "🧩",
    gradient: "linear-gradient(135deg, #0ea5e9, #22c55e)",
    category: "game",
  },
  {
    path: "/pizza-game",
    title: "Pizza Game",
    subtitle: "Slice up some fun",
    emoji: "🍕",
    gradient: "linear-gradient(135deg, #ef4444, #f97316)",
    category: "game",
  },
  {
    path: "/keyboard",
    title: "Drag & Drop Keyboard",
    subtitle: "Build the keyboard layout",
    emoji: "🎹",
    gradient: "linear-gradient(135deg, #14b8a6, #22c55e)",
    category: "typing",
  },
  {
    path: "/c-quiz",
    title: "Compliance Quiz",
    subtitle: "Policy & rules check",
    emoji: "📋",
    gradient: "linear-gradient(135deg, #64748b, #0f172a)",
    category: "utility",
  },
  {
    path: "/map",
    title: "Regions Map",
    subtitle: "World Generation",
    emoji: "🗺️",
    gradient: "linear-gradient(135deg, #648b70ff, #0f2a1dff)",
    category: "concept",
  },
  {
    path: "/one-word",
    title: "One Word Ten Seconds",
    subtitle: "Speed Typing One Word Challenge",
    emoji: "⚡",
    gradient: "linear-gradient(135deg, #d9ff00ff, #768b00ff)",
    category: "typing",
    multiplayer: true,
  },
  {
    path: "/pong",
    title: "Typing Pong",
    subtitle: "Play pong but you have to type to move the paddle.",
    emoji: "🕹️",
    gradient: "linear-gradient(135deg, #ffffffff, #000000ff)",
    category: "typing",
    multiplayer: true,
  },
];

const CATEGORY_SECTIONS: {
  key: "utility" | "game" | "typing" | "concept";
  title: string;
  description: string;
}[] = [
  {
    key: "typing",
    title: "Typing Activities",
    description: "Warm-ups and challenges to build keyboard fluency.",
  },
  {
    key: "game",
    title: "Games",
    description: "Fun, interactive games to practice skills.",
  },
  {
    key: "utility",
    title: "Utilities",
    description: "Tools that support focus, organization, and class systems.",
  },
  {
    key: "concept",
    title: "Concept Demos",
    description: "Experiments, ideas, and concept explorations.",
  },
];

function TileCard({ tile }: { tile: (typeof tiles)[number] }) {
  return (
    <Grid item xs={12} sm={6} md={4} key={tile.path}>
      <Paper
        component={RouterLink}
        to={tile.path}
        elevation={4}
        sx={{
          position: "relative",
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
        {/* Multiplayer badge */}
        {tile.multiplayer && (
          <Box
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              px: 1.5,
              py: 0.5,
              borderRadius: 999,
              bgcolor: "rgba(15, 23, 42, 0.85)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              fontSize: 12,
              zIndex: 1,
            }}
          >
            <span>👥</span>
            <span>Multiplayer</span>
          </Box>
        )}

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
  );
}

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

      {CATEGORY_SECTIONS.map((section) => {
        const sectionTiles = tiles.filter((t) => t.category === section.key);
        if (sectionTiles.length === 0) return null;

        return (
          <Box key={section.key} sx={{ mb: 5 }}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                {section.title}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", mt: 0.5 }}
              >
                {section.description}
              </Typography>
            </Box>

            <Grid container spacing={3}>
              {sectionTiles.map((tile) => (
                <TileCard key={tile.path} tile={tile} />
              ))}
            </Grid>
          </Box>
        );
      })}
    </Box>
  );
}
