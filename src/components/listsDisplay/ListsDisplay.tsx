import { Stack } from "@mui/material";
import React, { useEffect } from "react";
import PillarDisplay from "./PillarDisplay";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "store/store";
import RandomStudentButton from "./RandomStudentButton";
import { setRespect } from "store/student/studentsSlice";

const ListsDisplay: React.FC = () => {
  const masterStudentList = useSelector((state: RootState) => state.students.students);
  console.log("masterStudentList: ", masterStudentList);
  const pillarOptions = [
    { title: "Respect" },
    { title: "Responsible" },
    { title: "On Task" },
    { title: "Achieve" },
  ];

  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(setRespect(masterStudentList));
  }, [dispatch, masterStudentList]);

  return (
    <Stack
      direction='row'
      sx={{ justifyContent: "space-around", flexWrap: "wrap" }}>
      {pillarOptions.map((pillar) => {
        const { title } = pillar;
        return (
          <Stack key={pillar.title}>
            <PillarDisplay title={title} />

            {title === "Responsible" && <RandomStudentButton list={masterStudentList} />}
          </Stack>
        );
      })}
    </Stack>
  );
};

export default ListsDisplay;
