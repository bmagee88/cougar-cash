"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = __importDefault(require("react"));
var material_1 = require("@mui/material");
var NavItem_1 = __importDefault(require("./NavItem"));
var nav_items = [
    { title: "home", linkTo: "/" },
    { title: "directions", linkTo: "/directions" },
    { title: "about", linkTo: "/about" },
];
var Header = function () {
    return (react_1.default.createElement(material_1.Stack, { direction: "row", justifyContent: "center", sx: { backgroundColor: "#000080", color: "#C0C0C0" } },
        react_1.default.createElement(material_1.Stack, { direction: "row", gap: "2rem" }, nav_items.map(function (item) {
            return react_1.default.createElement(NavItem_1.default, { data: item });
        }))));
};
exports.default = Header;
