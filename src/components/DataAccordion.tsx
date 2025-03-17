import { Accordion, AccordionDetails, AccordionSummary, Typography } from "@mui/material";
import React from "react";
import ClassDropdown from "./ClassDropdown/ClassDropdown";
import LoadCSV from "./loadCsv/LoadCSV";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useSelector } from "react-redux";
import { RootState } from "store/store";

const DataAccordion: React.FC = () => {
  const activeTeacher = useSelector((state: RootState) => state.teachers.activeTeacher);
  return (
    <Accordion>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls='accordion-summary'
        id='accordion-summary'>
        <Typography
          component='span'
          fontWeight={"bold"}
          fontSize={"large"}>
          {activeTeacher ? activeTeacher : "upload data"}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <ClassDropdown />
        <LoadCSV />
      </AccordionDetails>
    </Accordion>
  );
};

export default DataAccordion;
