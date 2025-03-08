import { createSlice } from "@reduxjs/toolkit";

export interface Student {
  name: string;
}

interface StudentState {
  students: Student[] | null;
}

let initialState: StudentState = { students: null };

const studentsSlice = createSlice({
  name: "students",
  initialState,
  reducers: {
    setStudents: (state, action: { payload: Student[] }) => {
      state.students = action.payload;
    },
  },
});

export const { setStudents } = studentsSlice.actions;

export default studentsSlice.reducer;
