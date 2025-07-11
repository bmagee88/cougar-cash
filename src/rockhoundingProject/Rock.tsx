// Rock.tsx
import React, { useState } from "react";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { generateRockSVG } from "./generateRockSVG";

const Rock: React.FC = () => {
  // State now holds a React element, not a string
  const [rockSvgEl, setRockSvgEl] = useState(() => generateRockSVG());

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        borderRadius: 4,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        alignItems: "center",
      }}>
      {/* Render the SVG element right in place */}
      <Box sx={{ maxWidth: 400, width: "100%" }}>{rockSvgEl}</Box>

      <Button
        variant='outlined'
        onClick={() => setRockSvgEl(generateRockSVG())}>
        New Rock
      </Button>
    </Paper>
  );
};

export default Rock;
