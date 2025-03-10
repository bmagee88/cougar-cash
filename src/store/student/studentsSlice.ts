import { createSlice } from "@reduxjs/toolkit";

export interface Student {
  id: number;
  label: string;
  name: string;
  balance: number;
}

interface StudentState {
  students: Student[] | null;
  master: Student[] | null;
  respect: Student[] | null;
  responsible: Student[] | null;
  onTask: Student[] | null;
  achieve: Student[] | null;
}

let initialState: StudentState = {
  students: null,
  master: null,
  respect: null,
  responsible: null,
  onTask: null,
  achieve: null,
};

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
