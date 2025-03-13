import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";
import RespectDisplay from "./RespectDisplay";
import { Paper } from "@mui/material";

interface PillarDisplayProps {
  title: string;
}

const PillarDisplay: React.FC<PillarDisplayProps> = ({ title }) => {
  console.log("starting state: pillar display:", title);

  return (
    <Stack alignItems={"center"}>
      <Typography
        fontSize={"large"}
        fontWeight={"bold"}>
        {title}
      </Typography>
      <Paper sx={{ padding: "5px" }}>
        <RespectDisplay title={title} />
      </Paper>
    </Stack>
  );
};

export default PillarDisplay;
