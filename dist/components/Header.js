"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var jsx_runtime_1 = require("react/jsx-runtime");
var material_1 = require("@mui/material");
var NavItem_1 = __importDefault(require("./NavItem"));
var nav_items = [
    { title: "home", linkTo: "/" },
    { title: "directions", linkTo: "/directions" },
    { title: "about", linkTo: "/about" },
];
var Header = function () {
    return ((0, jsx_runtime_1.jsx)(material_1.Stack, { direction: "row", justifyContent: "center", sx: { backgroundColor: "#000080", color: "#C0C0C0" }, children: (0, jsx_runtime_1.jsx)(material_1.Stack, { direction: "row", gap: "2rem", children: nav_items.map(function (item) {
                return (0, jsx_runtime_1.jsx)(NavItem_1.default, { data: item });
            }) }) }));
};
exports.default = Header;
