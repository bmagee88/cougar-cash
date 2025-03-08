"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setStudents = void 0;
var toolkit_1 = require("@reduxjs/toolkit");
var initialState = { students: null };
var studentsSlice = (0, toolkit_1.createSlice)({
    name: "students",
    initialState: initialState,
    reducers: {
        setStudents: function (state, action) {
            state.students = action.payload;
        },
    },
});
exports.setStudents = studentsSlice.actions.setStudents;
exports.default = studentsSlice.reducer;
