import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "store/store";
import { Student } from "store/teacher/teacherSlice";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

const CashBalancesDisplay: React.FC = () => {
  let activeTeacher = useSelector((state: RootState) => state.teachers.activeTeacher);
  console.log("active teacher", activeTeacher);

  const studentList = useSelector((state: RootState) => {
    if (!activeTeacher) return []; // Prevents errors
    return state.teachers.teachers[activeTeacher] || [];
  });
  console.log("studentList", studentList);
  return (
    <Accordion>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls='accordion-summary-cash'
        id='accordion-summary-cash'>
        <Typography
          component='span'
          fontWeight={"bold"}
          fontSize={"large"}>
          Balances
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack sx={{ marginX: "10px" }}>
          {/* <Typography
        fontWeight={"bold"}
        fontSize={"large"}>
        Balances
      </Typography> */}
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
      </AccordionDetails>
    </Accordion>
  );
};

export default CashBalancesDisplay;
