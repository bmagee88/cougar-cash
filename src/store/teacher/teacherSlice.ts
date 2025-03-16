import { createSlice } from "@reduxjs/toolkit";
import { Student } from "store/student/studentsSlice";

export interface Teacher {
  id: number;
  name: string;
  studentsRoster: Student[];
}

interface TeacherState {
  teachers: { [teacherRoster: string]: Teacher[] };
}

let initialState: TeacherState = {
  teachers: {},
};

const teacherSlice = createSlice({
  name: "teacher",
  initialState,
  reducers: {},
});

// export const {} = teacherSlice.actions;

export default teacherSlice.reducer;
