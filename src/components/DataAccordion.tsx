import { Accordion, AccordionDetails, AccordionSummary, Divider, Typography } from "@mui/material";
import React from "react";
import ClassDropdown from "./ClassDropdown/ClassDropdown";
import LoadCSV from "./loadCsv/LoadCSV";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

const DataAccordion: React.FC = () => {
  return (
    <Accordion>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls='accordion-summary'
        id='accordion-summary'>
        <Typography component='span'>Data</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <ClassDropdown />
        <Divider />
        <LoadCSV />
      </AccordionDetails>
    </Accordion>
  );
};

export default DataAccordion;
