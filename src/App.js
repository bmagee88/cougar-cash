import "./App.css";
import Home from "./pages/Home";
import Directions from "./pages/Directions";
import About from "./pages/About";
import Header from "./components/Header";
import { Box } from "@mui/material";

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
        </Routes>
      </Router>
    </Box>
  );
}

export default App;
