import React from "react";
import { Box, Typography } from "@mui/material";
import { QuizSource } from "./types";

// All three values share each grid row's height, even if a long book title wraps.
const QuizSources: React.FC<{ sources: QuizSource[] }> = ({ sources }) => (
  <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 13fr) minmax(0, 8fr) minmax(0, 8fr)", rowGap: 1,
    "& > p": { px: 1, minWidth: 0, overflowWrap: "anywhere", fontSize: 13 } }}>
    {sources.map((source, index) => (
      <React.Fragment key={`${source.textbook}-${index}`}>
        <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>{source.textbook}</Typography>
        <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>{source.chapters}</Typography>
        <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>{source.sections}</Typography>
      </React.Fragment>
    ))}
  </Box>
);

export default QuizSources;
