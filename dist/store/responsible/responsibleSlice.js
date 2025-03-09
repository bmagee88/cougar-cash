"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeStudent = exports.addStudent = exports.setStudents = void 0;
var toolkit_1 = require("@reduxjs/toolkit");
var initialState = { responsibleStudents: null };
var responsibleStudentsSlice = (0, toolkit_1.createSlice)({
    name: "responsible",
    initialState: initialState,
    reducers: {
        setStudents: function (state, action) {
            state.responsibleStudents = action.payload;
        },
        addStudent: function (state, action) {
            state.responsibleStudents.push(action.payload);
        },
        removeStudent: function (state, action) {
            state.responsibleStudents = state.responsibleStudents.filter(function (student) { return student.name !== action.payload; });
        },
    },
});
exports.setStudents = (_a = responsibleStudentsSlice.actions, _a.setStudents), exports.addStudent = _a.addStudent, exports.removeStudent = _a.removeStudent;
exports.default = responsibleStudentsSlice.reducer;
