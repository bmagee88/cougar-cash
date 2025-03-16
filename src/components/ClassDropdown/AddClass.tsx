import { Button, Stack, TextField } from "@mui/material";
import React from "react";

const AddClass: React.FC = () => {
  return (
    <Stack
      direction={"row"}
      gap={"1rem"}>
      <TextField
        id='add-class_text-field'
        variant='outlined'
        size='small'
        placeholder='enter a new class'
      />
      <Button variant='contained'>Add Class</Button>
    </Stack>
  );
};

export default AddClass;
