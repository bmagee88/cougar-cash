import { Autocomplete, Box, Stack, TextField } from "@mui/material";
import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "store/store";
import ListItemDisplay from "./ListItemDisplay";
import { Student } from "store/student/studentsSlice";

interface RespectDisplayProps {
  startingState: Student[];
}

const RespectDisplay: React.FC<RespectDisplayProps> = ({ startingState }) => {
  console.log("startingState:", startingState);
  const [value, setValue] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const masterStudentsList = useSelector((state: RootState) => state.students.students);
  const respectStudentsList = useSelector((state: RootState) => state.students.respect);
  const [respectStudents, setRespecStudents] = useState<Student[]>([]);

  useEffect(() => {
    setRespecStudents(startingState);
  }, [startingState]);

  console.log("students:", masterStudentsList);
  console.log("respectStudentsList:", respectStudentsList);
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
      const filteredOptions = masterStudentsList.filter((student: Student) =>
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
        onChange={(event, newValue) => setValue(newValue)}
        options={inputValue ? masterStudentsList : []}
        inputValue={inputValue}
        onInputChange={(event, newInputValue) => setInputValue(newInputValue)}
        onKeyDown={handleKeyDown}
        open={Boolean(inputValue)}
        getOptionLabel={(option) => option.name || ""}
        renderInput={(params) => (
          <TextField
            {...params}
            label=''
            InputProps={{
              ...params.InputProps,
              endAdornment: null,
            }}
          />
        )}
      />

      <Box sx={{ height: "200px", overflowY: "scroll" }}>
        {respectStudents.map((student) => {
          console.log("in list");
          console.log("list student::", student);
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
