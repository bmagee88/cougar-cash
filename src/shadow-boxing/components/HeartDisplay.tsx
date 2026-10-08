import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import { Stack, Typography } from "@mui/material";

interface HeartDisplayProps {
  label: string;
  hearts: number;
  maxHearts: number;
  scale?: number;
  darkMode?: boolean;
}

export default function HeartDisplay({
  label,
  hearts,
  maxHearts,
  scale = 1,
  darkMode = false,
}: HeartDisplayProps) {
  return (
    <Stack spacing={0.75} alignItems="center" aria-label={`${label} hearts ${hearts}`}>
      <Typography
        variant="caption"
        sx={{ fontWeight: 800, color: darkMode ? "#cbd5e1" : "#334155" }}
      >
        {label.toUpperCase()}
      </Typography>
      <Stack direction="row" spacing={0.25}>
        {Array.from({ length: maxHearts }).map((_, index) =>
          index < hearts ? (
            <FavoriteIcon
              key={index}
              sx={{ color: "#e11d48", fontSize: 20 * scale }}
            />
          ) : (
            <FavoriteBorderIcon
              key={index}
              sx={{ color: darkMode ? "#64748b" : "#94a3b8", fontSize: 20 * scale }}
            />
          )
        )}
      </Stack>
    </Stack>
  );
}

