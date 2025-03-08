import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Student } from "store/student/studentsSlice";

interface OnTaskState {
  onTaskStudents: Student[] | null;
}

let initialState: OnTaskState = { onTaskStudents: null };

const onTaskStudentsSlice = createSlice({
  name: "onTask",
  initialState,
  reducers: {
    setStudents: (state, action: PayloadAction<Student[]>) => {
      state.onTaskStudents = action.payload;
    },
    addStudent: (state, action: PayloadAction<Student>) => {
      state.onTaskStudents.push(action.payload);
    },
    removeStudent: (state, action: PayloadAction<string>) => {
      state.onTaskStudents = state.onTaskStudents.filter(
        (student) => student.name !== action.payload
      );
    },
  },
});

export const { setStudents, addStudent, removeStudent } = onTaskStudentsSlice.actions;

export default onTaskStudentsSlice.reducer;
