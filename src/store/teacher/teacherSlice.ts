import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface Student {
  id: number;
  label: string;
  name: string;
  balance: number;
}

export interface TeacherState {
  activeTeacher: string;
  teachers: { [teachers: string]: Student[] };
  lists: {
    respect: Student[];
    responsible: Student[];
    onTask: Student[];
    achieve: Student[];
  };
}

// const storedData = localStorage.getItem("students");
let initialState: TeacherState =
  // storedData
  //   ? JSON.parse(storedData)
  //   :
  {
    activeTeacher: "prime",
    teachers: {} as { [teachers: string]: Student[] },
    lists: { respect: [], responsible: [], onTask: [], achieve: [] },
  };

const teacherSlice = createSlice({
  name: "teachers",
  initialState,
  reducers: {
    loadFromLocal: (state) => {
      const storedData = localStorage.getItem("students");
      state = storedData
        ? JSON.parse(storedData)
        : {
            activeTeacher: "prime",
            teachers: {} as { [teachers: string]: Student[] },
            lists: { respect: [], responsible: [], onTask: [], achieve: [] },
          };
    },
    // set all students to a category
    setStudents: (state, action: { payload: { [teachers: string]: Student[] } }) => {
      state.teachers = action.payload;
      localStorage.setItem("students", JSON.stringify(state));
    },
    setRespect: (state, action: { payload: Student[] }) => {
      state.lists.respect = action.payload;
    },
    setResponsible: (state, action: { payload: Student[] }) => {
      state.lists.responsible = action.payload;
    },
    setOnTask: (state, action: { payload: Student[] }) => {
      state.lists.onTask = action.payload;
    },
    setAchieve: (state, action: { payload: Student[] }) => {
      state.lists.achieve = action.payload;
    },
    setActiveTeacher: (state, action: { payload: string }) => {
      state.activeTeacher = action.payload;
      state.lists.achieve = [];
      state.lists.respect = [];
      state.lists.responsible = [];
      state.lists.onTask = [];

      localStorage.setItem("students", JSON.stringify(state));
    },

    // Add student to a category if they are not already present
    addRespect: (state, action: { payload: Student }) => {
      if (!state.lists.respect.some((student) => student.id === action.payload.id)) {
        state.lists.respect = [...state.lists.respect, action.payload].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
      }
    },
    addResponsible: (state, action: { payload: Student }) => {
      if (!state.lists.responsible.some((student) => student.id === action.payload.id)) {
        state.lists.responsible = [...state.lists.responsible, action.payload].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
      }
    },
    addOnTask: (state, action: { payload: Student }) => {
      if (!state.lists.onTask.some((student) => student.id === action.payload.id)) {
        state.lists.onTask = [...state.lists.onTask, action.payload].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
      }
    },
    addAchieve: (state, action: { payload: Student }) => {
      if (!state.lists.achieve.some((student) => student.id === action.payload.id)) {
        state.lists.achieve = [...state.lists.achieve, action.payload].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
      }
    },
    addNewTeacher: (state, action: { payload: string }) => {
      console.log("error spot?", action.payload);
      if (!state.teachers) {
        state.teachers = {}; // Initialize teachers if it's undefined
      }
      if (!state.teachers[action.payload]) {
        state.teachers[action.payload] = [];
        localStorage.setItem("students", JSON.stringify(state));
      }
      state.activeTeacher = action.payload;
    },

    // Remove student from a category
    rmRespect: (state, action: { payload: number }) => {
      state.lists.respect = state.lists.respect
        .filter((student) => student.id !== action.payload)
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    rmResponsible: (state, action: { payload: number }) => {
      state.lists.responsible = state.lists.responsible.filter(
        (student) => student.id !== action.payload
      );
    },
    rmOnTask: (state, action: { payload: number }) => {
      state.lists.onTask = state.lists.onTask.filter((student) => student.id !== action.payload);
    },
    rmAchieve: (state, action: { payload: number }) => {
      state.lists.achieve = state.lists.achieve.filter((student) => student.id !== action.payload);
    },

    updateBalances: (state, action: PayloadAction<Student[]>) => {
      const updatedStudents = action.payload;
      const updateList = (list: Student[]) =>
        list.map((student) => {
          const updatedStudent = updatedStudents.find((s) => s.id === student.id);
          return updatedStudent ? { ...student, balance: updatedStudent.balance } : student;
        });

      // Update the main student list for the active teacher
      if (state.teachers[state.activeTeacher]) {
        state.teachers[state.activeTeacher] = updateList(state.teachers[state.activeTeacher]);
      }

      // Clear out the lists while keeping the main student list intact
      state.lists = { respect: [], responsible: [], onTask: [], achieve: [] };

      // Persist updated data to localStorage
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
  setActiveTeacher,
  addNewTeacher,
} = teacherSlice.actions;

export default teacherSlice.reducer;
