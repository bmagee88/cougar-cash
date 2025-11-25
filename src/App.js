import "./App.css";
import Home from "./pages/Home";
import CougarCash from "./pages/CougarCash";
import Directions from "./pages/Directions";
import About from "./pages/About";
// import Header from "./components/Header";
import { Box } from "@mui/material";
import SheetsTestPage from "./pages/SheetsTestPage";
import TypingGamePage from "./typingProject/pages/TypingGamePage";
import TypingMarathonMode from "./typingProject/pages/TypingMarathonMode";
import SnakeGamePage from "./SnakeGamePage";
import ComplianceQuizPage from "./ComplianceQuizProject/ComplianceQuizPage";
import TimerApp from "./TimerApp/TimerApp";
import Demo from "./components/FetchProgressModal/Demo";
import Oroboros from "./oroboros/Oroboros";
import MazeQuiz from "./MazeQuiz/MazeQuiz";
import PieTimer from "./NewTimer/PieTimer";
import PizzaGame from "./pizzaGame/PizzaGame";
import DnDKeyboard from "./DndKeyboard/DragNDropKeyboard";
import MapVisualizer from "./RegionsMapApp/MapVisualizer";
import OneWordTenSeconds from "./OneWordTenSeconds/OneWordTenSeconds";
import TypingPong from "./TypingPong/TypingPong";
import ZombieTyping from "./ZombieTyping/ZombieTypingGame";

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

function App() {
  return (
    <Box>
      <Router>
        {/* <Header /> */}
        <Routes>
          <Route
            path='/'
            element={<Home />}></Route>
          <Route
            path='/cougar-cash'
            element={<CougarCash />}></Route>
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
          <Route
            path='/typing/marathon'
            element={<TypingMarathonMode />}></Route>
          <Route
            path='/snake'
            element={<SnakeGamePage />}></Route>
          <Route
            path='/c-quiz'
            element={<ComplianceQuizPage />}></Route>
          <Route
            path='/timer'
            element={<TimerApp />}></Route>
          <Route
            path='/fpm'
            element={<Demo />}></Route>
          <Route
            path='/oroboros'
            element={<Oroboros />}></Route>
          <Route
            path='/maze-quiz'
            element={<MazeQuiz />}></Route>
          <Route
            path='/pie-timer'
            element={<PieTimer />}></Route>
          <Route
            path='/pizza-game'
            element={<PizzaGame />}></Route>
          <Route
            path='/keyboard'
            element={<DnDKeyboard />}></Route>
          <Route
            path='/map'
            element={<MapVisualizer />}></Route>
          <Route
            path='/one-word'
            element={<OneWordTenSeconds />}></Route>
          <Route
            path='/pong'
            element={<TypingPong />}></Route>
          <Route
            path='/zombie'
            element={<ZombieTyping />}></Route>
        </Routes>
      </Router>
    </Box>
  );
}

export default App;
