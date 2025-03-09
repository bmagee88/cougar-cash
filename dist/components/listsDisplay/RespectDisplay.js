"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var jsx_runtime_1 = require("react/jsx-runtime");
var material_1 = require("@mui/material");
var material_2 = require("@mui/material");
var react_1 = require("react");
var icons_material_1 = require("@mui/icons-material");
var react_redux_1 = require("react-redux");
var RespectDisplay = function () {
    var _a = (0, react_1.useState)(null), value = _a[0], setValue = _a[1];
    var _b = (0, react_1.useState)(""), inputValue = _b[0], setInputValue = _b[1];
    var students = (0, react_redux_1.useSelector)(function (state) { return state.students.students; });
    console.log("students:", students);
    console.log("value:", value);
    var handleKeyDown = function (event) {
        if (event.key === "Enter") {
            var filteredOptions = students.filter(function (student) {
                return student.name.toLowerCase().includes(inputValue.toLowerCase());
            });
            if (filteredOptions.length > 0) {
                setValue(filteredOptions[0]); // Select the first option from the filtered list
            }
        }
    };
    return ((0, jsx_runtime_1.jsxs)(material_1.Stack, { children: [(0, jsx_runtime_1.jsx)(material_1.Autocomplete, { sx: { width: "300px" }, value: value, onChange: function (event, newValue) { return setValue(newValue); }, options: students, inputValue: inputValue, onInputChange: function (event, newInputValue) { return setInputValue(newInputValue); }, onKeyDown: handleKeyDown, renderInput: function (params) { return ((0, jsx_runtime_1.jsx)(material_1.TextField, __assign({}, params, { label: 'Students' }))); } }), (0, jsx_runtime_1.jsxs)(material_2.List, { children: [(0, jsx_runtime_1.jsxs)(material_2.ListItem, { children: [(0, jsx_runtime_1.jsx)(material_2.ListItemIcon, { children: (0, jsx_runtime_1.jsx)(icons_material_1.Inbox, {}) }), (0, jsx_runtime_1.jsx)(material_2.ListItemText, { primary: 'Inbox' })] }), (0, jsx_runtime_1.jsx)(material_2.Divider, {}), (0, jsx_runtime_1.jsxs)(material_2.ListItem, { children: [(0, jsx_runtime_1.jsx)(material_2.ListItemIcon, { children: (0, jsx_runtime_1.jsx)(icons_material_1.Star, {}) }), (0, jsx_runtime_1.jsx)(material_2.ListItemText, { primary: 'Starred' })] }), (0, jsx_runtime_1.jsx)(material_2.Divider, {})] })] }));
};
exports.default = RespectDisplay;
