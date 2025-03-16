import { createSlice } from "@reduxjs/toolkit";
import { Student } from "store/student/studentsSlice";

interface AppState {
  activeTeacher: string;
  respectList: Student[] | null;
  responsibleList: Student[] | null;
  onTaskList: Student[] | null;
  achieveList: Student[] | null;
}

let initialState: AppState = {
  activeTeacher: "",
  respectList: [],
  responsibleList: [],
  onTaskList: [],
  achieveList: [],
};

const appSlice = createSlice({
  name: "app",
  initialState,
  reducers: {},
});

// export const {} = teacherSlice.actions;

export default appSlice.reducer;
