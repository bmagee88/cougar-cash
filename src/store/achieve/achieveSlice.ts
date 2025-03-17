import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Student } from "store/teacher/teacherSlice";

interface AchieveState {
  achieveStudents: Student[] | null;
}

let initialState: AchieveState = { achieveStudents: null };

const achieveStudentsSlice = createSlice({
  name: "achieve",
  initialState,
  reducers: {
    setStudents: (state, action: PayloadAction<Student[]>) => {
      state.achieveStudents = action.payload;
    },
    addStudent: (state, action: PayloadAction<Student>) => {
      state.achieveStudents.push(action.payload);
    },
    removeStudent: (state, action: PayloadAction<string>) => {
      state.achieveStudents = state.achieveStudents.filter(
        (student) => student.name !== action.payload
      );
    },
  },
});

export const { setStudents, addStudent, removeStudent } = achieveStudentsSlice.actions;

export default achieveStudentsSlice.reducer;
