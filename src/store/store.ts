import { configureStore } from "@reduxjs/toolkit";
import { combineReducers } from "redux";
import studentsReducer from "./student/studentsSlice";

const reducers = combineReducers({
  user: studentsReducer,
});

export const store = configureStore({ reducer: reducers });

export type RootState = ReturnType<typeof store.getState>;

export type AppDispatch = typeof store.dispatch;
