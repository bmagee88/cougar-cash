import { Stack } from "@mui/material";
import React, { useEffect } from "react";
import PillarDisplay from "./PillarDisplay";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "store/store";
import RandomStudentButton from "./RandomStudentButton";
import { setRespect } from "store/student/studentsSlice";

const ListsDisplay: React.FC = () => {
  const activeTeacher = useSelector((state: RootState) => state.teachers.activeTeacher);
  const studentList = useSelector((state: RootState) => state.teachers.teachers[activeTeacher]);
  console.log("masterStudentList: ", studentList);
  const pillarOptions = [
    { title: "Respect" },
    { title: "On Task" },
    { title: "Achieve" },
    { title: "Responsible" },
  ];

  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(setRespect(studentList));
  }, [dispatch, studentList]);

  return (
    <Stack
      direction='row'
      sx={{ justifyContent: "space-around", flexWrap: "wrap" }}>
      {pillarOptions.map((pillar) => {
        const { title } = pillar;
        return (
          <Stack key={pillar.title}>
            <PillarDisplay title={title} />

            {title === "Responsible" && <RandomStudentButton list={studentList} />}
          </Stack>
        );
      })}
    </Stack>
  );
};

export default ListsDisplay;
