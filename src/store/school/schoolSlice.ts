import { createSlice } from "@reduxjs/toolkit";
import { Teacher } from "store/teacher/teacherSlice";

export interface School {
  id: number;
  name: string;
  teacherRoster: Teacher[];
}

interface SchoolState {
  schools: { [schoolRoster: string]: School[] };
}

let initialState: SchoolState = {
  schools: {},
};

const schoolSlice = createSlice({
  name: "school",
  initialState,
  reducers: {
    setSchool: () => {},
  },
});

export const {} = schoolSlice.actions;

export default schoolSlice.reducer;
