import { Autocomplete, Box, Stack, TextField } from "@mui/material";
import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "store/store";
import ListItemDisplay from "./ListItemDisplay";
import {
  addAchieve,
  addOnTask,
  addRespect,
  addResponsible,
  rmAchieve,
  rmOnTask,
  rmRespect,
  rmResponsible,
  Student,
  TeacherState,
} from "store/student/studentsSlice";

interface RespectDisplayProps {
  title: string;
}

const RespectDisplay: React.FC<RespectDisplayProps> = ({ title }) => {
  const dispatch = useDispatch();
  const [value, setValue] = useState<Student | null>(null);
  const [inputValue, setInputValue] = useState("");
  const studentState: TeacherState = useSelector((state: RootState) => state.teachers);

  const activeTeacher = useSelector((state: RootState) => state.teachers.activeTeacher);
  const { teachers, lists } = studentState;
  const { respect = [], responsible = [], onTask = [], achieve = [] } = lists;
  const studentList = teachers[activeTeacher] || [];

  const handleRemove = (studentId: number) => {
    switch (title) {
      case "Respect":
        dispatch(rmRespect(studentId)); // Dispatch Redux action
        break;
      case "Responsible":
        dispatch(rmResponsible(studentId)); // Dispatch Redux action
        break;
      case "On Task":
        dispatch(rmOnTask(studentId)); // Dispatch Redux action
        break;
      case "Achieve":
        dispatch(rmAchieve(studentId)); // Dispatch Redux action
        break;
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      const filteredOptions = studentList.filter((student: Student) =>
        student.name.toLowerCase().includes(inputValue.toLowerCase())
      );
      if (filteredOptions.length > 0) {
        const selectedStudent = filteredOptions[0];

        // Dispatch Redux action instead of modifying state
        switch (title) {
          case "Respect":
            if (!respect.some((student) => student.id === selectedStudent.id)) {
              dispatch(addRespect(selectedStudent));
            }
            break;
          case "Responsible":
            if (!responsible.some((student) => student.id === selectedStudent.id)) {
              dispatch(addResponsible(selectedStudent));
            }
            break;
          case "On Task":
            if (!onTask.some((student) => student.id === selectedStudent.id)) {
              dispatch(addOnTask(selectedStudent));
            }
            break;
          case "Achieve":
            if (!achieve.some((student) => student.id === selectedStudent.id)) {
              dispatch(addAchieve(selectedStudent));
            }
            break;
          default:
            console.log("defaulted");
            break;
        }

        setValue(null); // Reset selection
        setInputValue(""); // Clear input
      }
    }
  };

  return (
    <Stack sx={{ width: "250px" }}>
      <Autocomplete
        id={`autocomplete-${title}`}
        key={`autocomplete-${title}`}
        sx={{ width: "250px" }}
        value={value}
        size='small'
        onChange={(event, newValue) => {
          console.log("Selected:", newValue);
          setValue(newValue);
          // i think i need to dispatch here
        }}
        options={inputValue ? studentList : []}
        inputValue={inputValue.replace("\n", "")}
        onInputChange={(_, newInputValue) => setInputValue(newInputValue)}
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
        {title === "Respect" && (
          <>
            {respect.map((student) => (
              <ListItemDisplay
                key={student.id}
                name={student.name}
                onRemove={() => handleRemove(student.id)}
              />
            ))}
          </>
        )}
        {title === "Responsible" && (
          <>
            {responsible.map((student) => (
              <ListItemDisplay
                key={student.id}
                name={student.name}
                onRemove={() => handleRemove(student.id)}
              />
            ))}
          </>
        )}
        {title === "On Task" && (
          <>
            {onTask.map((student) => (
              <ListItemDisplay
                key={student.id}
                name={student.name}
                onRemove={() => handleRemove(student.id)}
              />
            ))}
          </>
        )}
        {title === "Achieve" && (
          <>
            {achieve.map((student) => (
              <ListItemDisplay
                key={student.id}
                name={student.name}
                onRemove={() => handleRemove(student.id)}
              />
            ))}
          </>
        )}
      </Box>
    </Stack>
  );
};

export default RespectDisplay;
