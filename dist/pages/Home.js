"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var jsx_runtime_1 = require("react/jsx-runtime");
var material_1 = require("@mui/material");
var CashBalancesDisplay_1 = __importDefault(require("../components/listsDisplay/CashBalancesDisplay"));
var ListsDisplay_1 = __importDefault(require("components/listsDisplay/ListsDisplay"));
var RewardButton_1 = __importDefault(require("components/RewardButton"));
var react_redux_1 = require("react-redux");
var studentsSlice_1 = require("store/student/studentsSlice");
var Home = function () {
    var testStudents = [
        { label: "morty", name: "morty" },
        { label: "Larry", name: "larry" },
        { label: "Moe", name: "moe" },
        { label: "Curly", name: "curly" },
    ];
    var dispatch = (0, react_redux_1.useDispatch)();
    dispatch((0, studentsSlice_1.setStudents)(testStudents));
    return ((0, jsx_runtime_1.jsxs)(material_1.Stack, { children: [(0, jsx_runtime_1.jsx)(CashBalancesDisplay_1.default, {}), (0, jsx_runtime_1.jsx)(ListsDisplay_1.default, {}), (0, jsx_runtime_1.jsx)(RewardButton_1.default, {})] }));
};
exports.default = Home;
