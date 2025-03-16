import { FormControl, MenuItem, Select, SelectChangeEvent, Stack, Typography } from "@mui/material";
import React from "react";
import AddClass from "./AddClass";

const ClassDropdown: React.FC = () => {
  const [selectedClass, setSelectedClass] = React.useState("Caver");

  const handleChange = (event: SelectChangeEvent) => {
    setSelectedClass(event.target.value as string);
  };
  return (
    <Stack
      gap={"1rem"}
      margin={"1rem"}>
      <FormControl fullWidth>
        <Typography>Choose a Class:</Typography>

        <Select
          id='class-dropdown'
          size='small'
          value={selectedClass}
          label=''
          onChange={handleChange}>
          {" "}
          {["DeBowes", "Caver"].map((roster) => {
            return (
              <MenuItem
                key='roster'
                value={roster}>
                {roster}
              </MenuItem>
            );
          })}
        </Select>
      </FormControl>
      <AddClass />
    </Stack>
  );
};

export default ClassDropdown;
