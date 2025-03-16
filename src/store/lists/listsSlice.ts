import { createSlice } from "@reduxjs/toolkit";
import { Student } from "store/student/studentsSlice";

export interface Lists {
  respect: Student[] | null;
  responsible: Student[] | null;
  onTask: Student[] | null;
  achieve: Student[] | null;
}

let initialState: Lists = {
  respect: [],
  responsible: [],
  onTask: [],
  achieve: [],
};

const listsSlice = createSlice({
  name: "lists",
  initialState,
  reducers: {},
});

// export const {} = teacherSlice.actions;

export default listsSlice.reducer;
