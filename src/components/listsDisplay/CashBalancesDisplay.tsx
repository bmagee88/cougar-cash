import { Paper, Stack, Typography } from "@mui/material";
import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "store/store";
import { Student } from "store/student/studentsSlice";

const CashBalancesDisplay: React.FC = () => {
  const activeTeacher = useSelector((state: RootState) => state.teachers.activeTeacher);
  const studentList =
    useSelector((state: RootState) => state.teachers.teachers[activeTeacher]) || []; // Get the list from Redux store

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
        {studentList.map((student: Student) => (
          <Paper key={student.name}>
            <Stack
              direction={"row"}
              sx={{
                minWidth: "100px", // Fixed width for each cell
                display: "flex",
                justifyContent: "space-between",
                gap: ".5rem",
                padding: "8px",
                border: "1px solid lightgray",
              }}>
              <Stack>
                <Typography variant='body1'>{student.name}</Typography>
                <Typography
                  variant='body2'
                  color='grey'
                  sx={{ marginTop: "-5px" }}>
                  {student.id}
                </Typography>
              </Stack>

              <Typography variant='body2'>{student.balance}</Typography>
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Stack>
  );
};

export default CashBalancesDisplay;
