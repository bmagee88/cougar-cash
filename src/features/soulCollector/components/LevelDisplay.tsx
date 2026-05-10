import { Box, Typography } from "@mui/material";

export function LevelDisplay({ level }: { level: string }) {
  const [min = "0", avg = "0", max = "0"] = level.split(":");

  return (
    <Typography
      component="span"
      sx={{
        fontSize: "1.25em",
        fontWeight: 900,
        lineHeight: 1,
        whiteSpace: "nowrap",
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      &nbsp;{avg}

      <Box
        component="span"
        sx={{
          display: "inline-flex",
          flexDirection: "column",
          ml: 0.35,
          lineHeight: 0.85,
        }}
      >
        <Box component="sup" sx={{ fontSize: "0.5em" }}>
          {max}
        </Box>
        <Box component="sub" sx={{ fontSize: ".5em" }}>
          {min}
        </Box>
      </Box>
    </Typography>
  );
}