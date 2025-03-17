import { FormControl, MenuItem, Select, SelectChangeEvent, Stack, Typography } from "@mui/material";
import React, { useEffect } from "react";
import AddClass from "./AddClass";
import { useDispatch } from "react-redux";
import { setActiveTeacher } from "store/student/studentsSlice";
import { useSelector } from "react-redux";
import { RootState } from "store/store";

const ClassDropdown: React.FC = () => {
  const dispatch = useDispatch();
  const activeTeacher = useSelector((state: RootState) => state.teachers.activeTeacher);
  const teachers = useSelector((state: RootState) => state.teachers.teachers);
  console.log("teachers", teachers);
  const teachersList = Object.keys(teachers) || [];
  console.log("teachersList", teachersList);

  // useEffect(() => {
  //   dispatch(setActiveTeacher(activeTeacher));
  // }, []);

  const handleChange = (event: SelectChangeEvent) => {
    dispatch(setActiveTeacher(event.target.value as string));
  };
  return (
    <Stack
      gap={"1rem"}
      margin={"1rem"}>
      <AddClass />
      <FormControl fullWidth>
        <Typography>Switch to teacher..</Typography>

        <Select
          id='class-dropdown'
          size='small'
          value={activeTeacher}
          label=''
          onChange={handleChange}>
          {" "}
          {teachersList.map((teacher) => {
            return (
              <MenuItem
                key={teacher}
                value={teacher}>
                {teacher}
              </MenuItem>
            );
          })}
        </Select>
      </FormControl>
    </Stack>
  );
};

export default ClassDropdown;
