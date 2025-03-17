import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Student } from "store/teacher/teacherSlice";

interface RespectState {
  respectfulStudents: Student[] | null;
}

let initialState: RespectState = { respectfulStudents: null };

const respectfulStudentsSlice = createSlice({
  name: "respect",
  initialState,
  reducers: {
    setStudents: (state, action: PayloadAction<Student[]>) => {
      state.respectfulStudents = action.payload;
    },
    addStudent: (state, action: PayloadAction<Student>) => {
      state.respectfulStudents.push(action.payload);
    },
    removeStudent: (state, action: PayloadAction<string>) => {
      state.respectfulStudents = state.respectfulStudents.filter(
        (student) => student.name !== action.payload
      );
    },
  },
});

export const { setStudents, addStudent, removeStudent } = respectfulStudentsSlice.actions;

export default respectfulStudentsSlice.reducer;
