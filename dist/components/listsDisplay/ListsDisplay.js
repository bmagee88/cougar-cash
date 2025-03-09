"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var jsx_runtime_1 = require("react/jsx-runtime");
var material_1 = require("@mui/material");
var RespectDisplay_1 = __importDefault(require("./RespectDisplay"));
var ResponsibleDisplay_1 = __importDefault(require("./ResponsibleDisplay"));
var OnTaskDisplay_1 = __importDefault(require("./OnTaskDisplay"));
var AchieveDisplay_1 = __importDefault(require("./AchieveDisplay"));
var ListsDisplay = function () {
    return ((0, jsx_runtime_1.jsxs)(material_1.Stack, { direction: 'row', children: [(0, jsx_runtime_1.jsx)(RespectDisplay_1.default, {}), (0, jsx_runtime_1.jsx)(ResponsibleDisplay_1.default, {}), (0, jsx_runtime_1.jsx)(OnTaskDisplay_1.default, {}), (0, jsx_runtime_1.jsx)(AchieveDisplay_1.default, {})] }));
};
exports.default = ListsDisplay;
