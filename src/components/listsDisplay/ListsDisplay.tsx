import { Stack } from "@mui/material";
import React from "react";
import PillarDisplay from "./PillarDisplay";
import { useSelector } from "react-redux";
import { RootState } from "store/store";
import RandomStudentButton from "./RandomStudentButton";

const ListsDisplay: React.FC = () => {
  const masterStudentList = useSelector((state: RootState) => state.students.students);
  console.log("masterStudentList: ", masterStudentList);
  const pillarOptions = [
    { title: "Respect", startingState: masterStudentList },
    { title: "Responsible", startingState: [] },
    { title: "On Task", startingState: [] },
    { title: "Achieve", startingState: [] },
  ];
  return (
    <Stack
      direction='row'
      sx={{ justifyContent: "space-around", flexWrap: "wrap" }}>
      {pillarOptions.map((pillar) => {
        const { title, startingState } = pillar;
        return (
          <Stack key={pillar.title}>
            <PillarDisplay
              title={title}
              startingState={startingState}
            />

            {title === "Responsible" && <RandomStudentButton list={masterStudentList} />}
          </Stack>
        );
      })}
    </Stack>
  );
};

export default ListsDisplay;
