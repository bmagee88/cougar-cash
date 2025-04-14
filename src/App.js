import "./App.css";
import Home from "./pages/Home";
import Directions from "./pages/Directions";
import About from "./pages/About";
import Header from "./components/Header";
import { Box } from "@mui/material";
import SheetsTestPage from "./pages/SheetsTestPage";
import TypingGamePage from "./typingProject/pages/TypingGamePage";

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import React from "react";

function App() {
  return (
    <Box>
      <Router>
        <Header />
        <Routes>
          <Route
            path='/'
            element={<Home />}></Route>
          <Route
            path='/directions'
            element={<Directions />}></Route>
          <Route
            path='/about'
            element={<About />}></Route>
          <Route
            path='/sheets'
            element={<SheetsTestPage />}></Route>
          <Route
            path='/typing'
            element={<TypingGamePage />}></Route>
        </Routes>
      </Router>
    </Box>
  );
}

export default App;
