import { createSlice } from "@reduxjs/toolkit";

export interface Student {
  id: number;
  label: string;
  name: string;
  balance: number;
}

export interface StudentState {
  students: Student[] | [];
  respect: Student[] | null;
  responsible: Student[] | null;
  onTask: Student[] | null;
  achieve: Student[] | null;
}

let initialState: StudentState = {
  students: [],
  respect: [],
  responsible: [],
  onTask: [],
  achieve: [],
};

const studentsSlice = createSlice({
  name: "students",
  initialState,
  reducers: {
    // set all students to a category
    setStudents: (state, action: { payload: Student[] }) => {
      state.students = action.payload;
    },
    setRespect: (state, action: { payload: Student[] }) => {
      state.respect = action.payload;
    },
    setResponsible: (state, action: { payload: Student[] }) => {
      state.responsible = action.payload;
    },
    setOnTask: (state, action: { payload: Student[] }) => {
      state.onTask = action.payload;
    },
    setAchieve: (state, action: { payload: Student[] }) => {
      state.achieve = action.payload;
    },

    // Add student to a category if they are not already present
    addRespect: (state, action: { payload: Student }) => {
      if (!state.respect.some((student) => student.id === action.payload.id)) {
        state.respect = [...state.respect, action.payload].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
      }
    },
    addResponsible: (state, action: { payload: Student }) => {
      if (!state.responsible.some((student) => student.id === action.payload.id)) {
        state.responsible.push(action.payload);
      }
    },
    addOnTask: (state, action: { payload: Student }) => {
      if (!state.onTask.some((student) => student.id === action.payload.id)) {
        state.onTask.push(action.payload);
      }
    },
    addAchieve: (state, action: { payload: Student }) => {
      if (!state.achieve.some((student) => student.id === action.payload.id)) {
        state.achieve.push(action.payload);
      }
    },

    // Remove student from a category
    rmRespect: (state, action: { payload: number }) => {
      state.respect = state.respect
        .filter((student) => student.id !== action.payload)
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    rmResponsible: (state, action: { payload: number }) => {
      state.responsible = state.responsible.filter((student) => student.id !== action.payload);
    },
    rmOnTask: (state, action: { payload: number }) => {
      state.onTask = state.onTask.filter((student) => student.id !== action.payload);
    },
    rmAchieve: (state, action: { payload: number }) => {
      state.achieve = state.achieve.filter((student) => student.id !== action.payload);
    },
  },
});

export const {
  setStudents,
  setRespect,
  setResponsible,
  setOnTask,
  setAchieve,
  addAchieve,
  addOnTask,
  addRespect,
  addResponsible,
  rmAchieve,
  rmOnTask,
  rmRespect,
  rmResponsible,
} = studentsSlice.actions;

export default studentsSlice.reducer;
