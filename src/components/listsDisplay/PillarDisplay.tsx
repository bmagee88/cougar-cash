import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";
import RespectDisplay from "./RespectDisplay";
import { Student } from "store/student/studentsSlice";
import { Paper } from "@mui/material";

interface PillarDisplayProps {
  title: string;
  startingState: Student[];
}

const PillarDisplay: React.FC<PillarDisplayProps> = ({ title, startingState }) => {
  return (
    <Stack>
      <Typography
        fontSize={"large"}
        fontWeight={"bold"}>
        {title}
      </Typography>
      <Paper sx={{ padding: "5px" }}>
        <RespectDisplay startingState={startingState} />
      </Paper>
    </Stack>
  );
};

export default PillarDisplay;
