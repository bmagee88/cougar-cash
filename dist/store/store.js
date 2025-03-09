"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.store = void 0;
var toolkit_1 = require("@reduxjs/toolkit");
var redux_1 = require("redux");
var studentsSlice_1 = __importDefault(require("./student/studentsSlice"));
var achieveSlice_1 = __importDefault(require("./achieve/achieveSlice"));
var onTaskSlice_1 = __importDefault(require("./onTask/onTaskSlice"));
var responsibleSlice_1 = __importDefault(require("./responsible/responsibleSlice"));
var respectSlice_1 = __importDefault(require("./respect/respectSlice"));
var reducers = (0, redux_1.combineReducers)({
    students: studentsSlice_1.default,
    achieve: achieveSlice_1.default,
    onTask: onTaskSlice_1.default,
    responsible: responsibleSlice_1.default,
    respect: respectSlice_1.default,
});
exports.store = (0, toolkit_1.configureStore)({ reducer: reducers });
