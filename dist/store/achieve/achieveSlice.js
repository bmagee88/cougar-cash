"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeStudent = exports.addStudent = exports.setStudents = void 0;
var toolkit_1 = require("@reduxjs/toolkit");
var initialState = { achieveStudents: null };
var achieveStudentsSlice = (0, toolkit_1.createSlice)({
    name: "achieve",
    initialState: initialState,
    reducers: {
        setStudents: function (state, action) {
            state.achieveStudents = action.payload;
        },
        addStudent: function (state, action) {
            state.achieveStudents.push(action.payload);
        },
        removeStudent: function (state, action) {
            state.achieveStudents = state.achieveStudents.filter(function (student) { return student.name !== action.payload; });
        },
    },
});
exports.setStudents = (_a = achieveStudentsSlice.actions, _a.setStudents), exports.addStudent = _a.addStudent, exports.removeStudent = _a.removeStudent;
exports.default = achieveStudentsSlice.reducer;
