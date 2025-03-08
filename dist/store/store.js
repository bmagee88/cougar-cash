"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.store = void 0;
var toolkit_1 = require("@reduxjs/toolkit");
var redux_1 = require("redux");
var studentsSlice_1 = __importDefault(require("./student/studentsSlice"));
var reducers = (0, redux_1.combineReducers)({
    user: studentsSlice_1.default,
});
exports.store = (0, toolkit_1.configureStore)({ reducer: reducers });
