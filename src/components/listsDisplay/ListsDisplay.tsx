import { Stack } from "@mui/material";
import React, { useEffect } from "react";
import PillarDisplay from "./PillarDisplay";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "store/store";
import RandomStudentButton from "./RandomStudentButton";
import { setRespect } from "store/student/studentsSlice";

const ListsDisplay: React.FC = () => {
  const activeRosterTeacher = useSelector((state: RootState) => state.students.activeRoster);
  const masterStudentList = useSelector((state: RootState) => state.students.students); // Get the list from Redux store
  const activeRosterStudents = masterStudentList[activeRosterTeacher];
  console.log("masterStudentList: ", masterStudentList);
  const pillarOptions = [
    { title: "Respect" },
    { title: "On Task" },
    { title: "Achieve" },
    { title: "Responsible" },
  ];

  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(setRespect(activeRosterStudents));
  }, [dispatch, activeRosterStudents]);

  return (
    <Stack
      direction='row'
      sx={{ justifyContent: "space-around", flexWrap: "wrap" }}>
      {pillarOptions.map((pillar) => {
        const { title } = pillar;
        return (
          <Stack key={pillar.title}>
            <PillarDisplay title={title} />

            {title === "Responsible" && <RandomStudentButton list={activeRosterStudents} />}
          </Stack>
        );
      })}
    </Stack>
  );
};

export default ListsDisplay;
