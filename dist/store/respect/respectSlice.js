"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeStudent = exports.addStudent = exports.setStudents = void 0;
var toolkit_1 = require("@reduxjs/toolkit");
var initialState = { respectfulStudents: null };
var respectfulStudentsSlice = (0, toolkit_1.createSlice)({
    name: "respect",
    initialState: initialState,
    reducers: {
        setStudents: function (state, action) {
            state.respectfulStudents = action.payload;
        },
        addStudent: function (state, action) {
            state.respectfulStudents.push(action.payload);
        },
        removeStudent: function (state, action) {
            state.respectfulStudents = state.respectfulStudents.filter(function (student) { return student.name !== action.payload; });
        },
    },
});
exports.setStudents = (_a = respectfulStudentsSlice.actions, _a.setStudents), exports.addStudent = _a.addStudent, exports.removeStudent = _a.removeStudent;
exports.default = respectfulStudentsSlice.reducer;
