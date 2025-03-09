import { Grid, Stack, Typography } from "@mui/material";
import Grid2 from "@mui/material/Unstable_Grid2"; // Make sure you're importing from the right location

import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "store/store";
import { Student } from "store/student/studentsSlice";

const CashBalancesDisplay: React.FC = () => {
  const masterStudentList = useSelector((state: RootState) => state.students.students); // Get the list from Redux store

  return (
    <Stack sx={{ marginX: "10px" }}>
      <Typography
        fontWeight={"bold"}
        fontSize={"large"}>
        Balances
      </Typography>
      <Stack
        direction='row'
        sx={{
          flexWrap: "wrap",
          gap: 2, // Space between items
          justifyContent: "flex-start",
        }}>
        {masterStudentList.map((student: Student) => (
          <Stack
            direction={"row"}
            key={student.name}
            sx={{
              width: "150px", // Fixed width for each cell
              display: "flex",
              justifyContent: "space-between",
              padding: "8px",
              border: "1px solid lightgray",
            }}>
            <Typography variant='body1'>{student.name}</Typography>
            <Typography variant='body2'>{student.balance}</Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
};

export default CashBalancesDisplay;
