import { Button, Stack, TextField } from "@mui/material";
import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { addNewTeacher } from "store/teacher/teacherSlice";

const AddClass: React.FC = () => {
  const [newTeacher, setNewTeacher] = useState<string>("");
  const dispatch = useDispatch();

  const handleNewClassChange = (e) => {
    setNewTeacher(e.target.value);
  };

  const handleAddNewTeacher = (e) => {
    dispatch(addNewTeacher(newTeacher));
  };

  return (
    <Stack
      direction={"row"}
      gap={"1rem"}>
      <TextField
        id='add-class_text-field'
        variant='outlined'
        size='small'
        placeholder='enter a new class'
        value={newTeacher ?? ""}
        onChange={handleNewClassChange}
      />
      <Button
        variant='contained'
        onClick={handleAddNewTeacher}>
        Add Class
      </Button>
    </Stack>
  );
};

export default AddClass;
