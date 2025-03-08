import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Student } from "store/student/studentsSlice";

interface ResponsibleState {
  responsibleStudents: Student[] | null;
}

let initialState: ResponsibleState = { responsibleStudents: null };

const responsibleStudentsSlice = createSlice({
  name: "responsible",
  initialState,
  reducers: {
    setStudents: (state, action: PayloadAction<Student[]>) => {
      state.responsibleStudents = action.payload;
    },
    addStudent: (state, action: PayloadAction<Student>) => {
      state.responsibleStudents.push(action.payload);
    },
    removeStudent: (state, action: PayloadAction<string>) => {
      state.responsibleStudents = state.responsibleStudents.filter(
        (student) => student.name !== action.payload
      );
    },
  },
});

export const { setStudents, addStudent, removeStudent } = responsibleStudentsSlice.actions;

export default responsibleStudentsSlice.reducer;
