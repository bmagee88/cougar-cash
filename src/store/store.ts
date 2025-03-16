import { configureStore } from "@reduxjs/toolkit";
import { combineReducers } from "redux";
import studentsReducer from "./student/studentsSlice";
import achieveReducer from "./achieve/achieveSlice";
import onTaskReducer from "./onTask/onTaskSlice";
import responsibleReducer from "./responsible/responsibleSlice";
import respectReducer from "./respect/respectSlice";
import teacherReducer from "./teacher/teacherSlice";
import schoolReducer from "./school/schoolSlice";
import listsReducer from "./lists/listsSlice";

const reducers = combineReducers({
  school: schoolReducer,
  teacher: teacherReducer,
  students: studentsReducer,
  achieve: achieveReducer,
  onTask: onTaskReducer,
  responsible: responsibleReducer,
  respect: respectReducer,
  lists: listsReducer,
});

export const store = configureStore({ reducer: reducers });

export type RootState = ReturnType<typeof store.getState>;

export type AppDispatch = typeof store.dispatch;
