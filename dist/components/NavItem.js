"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var material_1 = require("@mui/material");
var react_router_dom_1 = require("react-router-dom");
var react_1 = __importDefault(require("react"));
var NavItemDisplay = function (_a) {
    var data = _a.data;
    var title = data.title, linkTo = data.linkTo;
    return (react_1.default.createElement(material_1.Box, null,
        react_1.default.createElement(react_router_dom_1.Link, { to: linkTo }, title)));
};
exports.default = NavItemDisplay;
