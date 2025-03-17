import { configureStore } from "@reduxjs/toolkit";
import { combineReducers } from "redux";
import teacherReducer from "./teacher/teacherSlice";
import achieveReducer from "./achieve/achieveSlice";
import onTaskReducer from "./onTask/onTaskSlice";
import responsibleReducer from "./responsible/responsibleSlice";
import respectReducer from "./respect/respectSlice";

const reducers = combineReducers({
  teachers: teacherReducer,
  achieve: achieveReducer,
  onTask: onTaskReducer,
  responsible: responsibleReducer,
  respect: respectReducer,
});

export const store = configureStore({ reducer: reducers });

export type RootState = ReturnType<typeof store.getState>;

export type AppDispatch = typeof store.dispatch;
