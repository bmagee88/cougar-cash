import { createSlice, PayloadAction } from "@reduxjs/toolkit";

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
        state.responsible = [...state.responsible, action.payload].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
      }
    },
    addOnTask: (state, action: { payload: Student }) => {
      if (!state.onTask.some((student) => student.id === action.payload.id)) {
        state.onTask = [...state.onTask, action.payload].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
      }
    },
    addAchieve: (state, action: { payload: Student }) => {
      if (!state.achieve.some((student) => student.id === action.payload.id)) {
        state.achieve = [...state.achieve, action.payload].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
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

    updateBalances: (state, action: PayloadAction<Student[]>) => {
      const updatedStudents = action.payload;
      const updateList = (list: Student[]) =>
        list.map((student) => {
          const updatedStudent = updatedStudents.find((s) => s.id === student.id);
          return updatedStudent ? { ...student, balance: updatedStudent.balance } : student;
        });

      state.students = updateList(state.students);
      // state.respect = updateList(state.respect);
      // state.responsible = updateList(state.responsible);
      // state.onTask = updateList(state.onTask);
      // state.achieve = updateList(state.achieve);

      // Save updated state to local storage
      localStorage.setItem("students", JSON.stringify(state));
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
  updateBalances,
} = studentsSlice.actions;

export default studentsSlice.reducer;
