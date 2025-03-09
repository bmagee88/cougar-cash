"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var jsx_runtime_1 = require("react/jsx-runtime");
var material_1 = require("@mui/material");
var react_router_dom_1 = require("react-router-dom");
var NavItemDisplay = function (_a) {
    var data = _a.data;
    var title = data.title, linkTo = data.linkTo;
    return ((0, jsx_runtime_1.jsx)(material_1.Box, { children: (0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: linkTo, children: title }) }));
};
exports.default = NavItemDisplay;
