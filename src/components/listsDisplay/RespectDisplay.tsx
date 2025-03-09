import { Autocomplete, Box, Stack, TextField } from "@mui/material";
import { List, ListItem, ListItemText, ListItemIcon, Divider } from "@mui/material";
import React, { useState } from "react";
import { Inbox, Star } from "@mui/icons-material";
import { useSelector } from "react-redux";
import { RootState } from "store/store";
import ListItemDisplay from "./ListItemDisplay";
import { Student } from "store/student/studentsSlice";

interface RespectDisplayProps {
  startingState: Student[];
}

const RespectDisplay: React.FC<RespectDisplayProps> = ({ startingState }) => {
  const [value, setValue] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const masterStudentsList = useSelector((state: RootState) => state.students.students);
  const [respectStudents, setRespecStudents] = useState(startingState);
  console.log("students:", masterStudentsList);
  console.log("value:", value);
  console.log("respectStudents:", respectStudents);
  console.log("inputValue:", inputValue);

  const handleRemove = (studentName: string) => {
    setRespecStudents(
      (prev) =>
        prev
          .filter((student) => student.name !== studentName) // Remove the student
          .sort((a, b) => a.name.localeCompare(b.name)) // Sort alphabetically by name
    );
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      const filteredOptions = masterStudentsList.filter((student) =>
        student.name.toLowerCase().includes(inputValue.toLowerCase())
      );
      if (filteredOptions.length > 0) {
        setValue(filteredOptions[0]); // Select the first option from the filtered list
        const selectedStudent = filteredOptions[0];

        // Only add if the student isn't already in the list
        if (!respectStudents.some((student) => student.name === selectedStudent.name)) {
          setRespecStudents((prev) =>
            [...prev, selectedStudent].sort((a, b) => a.name.localeCompare(b.name))
          ); // Add and sort alphabetically by name
        }

        setValue([]);
      }
    }
  };

  return (
    <Stack sx={{ width: "250px" }}>
      <Autocomplete
        sx={{ width: "250px" }}
        value={value}
        size='small'
        onChange={(event, newValue) => setValue(newValue)} // When a selection is made
        options={inputValue ? masterStudentsList : []}
        inputValue={inputValue} // Control input value
        onInputChange={(event, newInputValue) => setInputValue(newInputValue)}
        onKeyDown={handleKeyDown} // Handle Enter key press
        open={Boolean(inputValue)} // Hide dropdown when input is empty
        // open={
        //   inputValue.length > 0 &&
        //   students.some((student) => student.name.toLowerCase().includes(inputValue.toLowerCase()))
        // }
        getOptionLabel={(option) => option.name || ""}
        // getOptionLabel={(option) => option.label} // Specify the field to display in the dropdown
        renderInput={(params) => (
          <TextField
            {...params}
            label=''
            InputProps={{
              ...params.InputProps,
              endAdornment: null, // Remove the arrow icon from the input field
            }}
          />
        )}
      />
      {/* <List>
        <ListItem>
          <ListItemIcon>
            <Inbox />
          </ListItemIcon>
          <ListItemText primary='Inbox' />
        </ListItem>
        <Divider />
        <ListItem>
          <ListItemIcon>
            <Star />
          </ListItemIcon>
          <ListItemText primary='Starred' />
        </ListItem>
        <Divider />
      </List> */}
      <Box sx={{ height: "200px", overflowY: "auto" }}>
        {respectStudents.map((student) => {
          return (
            <ListItemDisplay
              key={student.name}
              name={student.name}
              onRemove={() => handleRemove(student.name)}
            />
          );
        })}
      </Box>
    </Stack>
  );
};

export default RespectDisplay;
