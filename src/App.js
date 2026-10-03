import "./App.css";
import { lazy, Suspense } from "react";
// import Header from "./components/Header";
import { Box, CircularProgress } from "@mui/material";

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

const Home = lazy(() => import("./pages/Home"));
const CougarCash = lazy(() => import("./pages/CougarCash"));
const Directions = lazy(() => import("./pages/Directions"));
const About = lazy(() => import("./pages/About"));
const SheetsTestPage = lazy(() => import("./pages/SheetsTestPage"));
const TypingGamePage = lazy(() => import("./typingProject/pages/TypingGamePage"));
const TypingMarathonMode = lazy(() => import("./typingProject/pages/TypingMarathonMode"));
const SnakeGamePage = lazy(() => import("./SnakeGamePage"));
const ComplianceQuizPage = lazy(() => import("./ComplianceQuizProject/ComplianceQuizPage"));
const CQuiz2Page = lazy(() => import("./CQuiz2/CQuiz2Page"));
const TimerApp = lazy(() => import("./TimerApp/TimerApp"));
const Demo = lazy(() => import("./components/FetchProgressModal/Demo"));
const Oroboros = lazy(() => import("./oroboros/Oroboros"));
const MazeQuiz = lazy(() => import("./MazeQuiz/MazeQuiz"));
const PieTimer = lazy(() => import("./NewTimer/PieTimer"));
const PizzaGame = lazy(() => import("./pizzaGame/PizzaGame"));
const DnDKeyboard = lazy(() => import("./DndKeyboard/DragNDropKeyboard"));
const MapVisualizer = lazy(() => import("./RegionsMapApp/MapVisualizer"));
const OneWordTenSeconds = lazy(() => import("./OneWordTenSeconds/OneWordTenSeconds"));
const TypingPong = lazy(() => import("./TypingPong/TypingPong"));
const HallPassRoutes = lazy(() => import("./HallPassApp/HallPassRoutes"));
const PawPassApp = lazy(() => import("./PawPassApp/PawPassApp"));
const MultipleChoiceQuiz = lazy(() => import("./MultipleChoiceQuiz/MultipleChoiceQuiz"));
const ParentLetter = lazy(() => import("./ParentLetter/ParentLetter"));
const SoundButton = lazy(() => import("./SoundButton/SoundButton"));
const DndZoneCombatSimulator = lazy(() => import("./DndZoneCombatSimulator/DndZoneCombatSimulator"));
const CuriosityApp = lazy(() => import("./Curiosity App/CuriosityApp"));
const IrregularShapeGenerator = lazy(() => import("./IrregularShapeGenerator/IrregularShapeGenerator"));
const PadletSessionApp = lazy(() => import("./PadletSessions/PadletSessionApp"));
const TypingBossApp = lazy(() => import("./TypingBoss/TypingBossApp"));
const PatternGameApp = lazy(() => import("./PatternGame/PatternGameApp"));
const FishingCardGame = lazy(() => import("./FishingCardGame/FishingCardGame"));
const CrossyRoad = lazy(() => import("./CrossyRoad/CrossyRoad"));
const CaptiveChess = lazy(() => import("./CaptiveChess/CaptiveChess"));

function RouteFallback() {
  return (
    <Box
      role="status"
      aria-label="Loading page"
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        bgcolor: "background.default",
      }}
    >
      <CircularProgress size={32} />
    </Box>
  );
}

function App() {
  return (
    <Box>
      <Router>
        {/* <Header /> */}
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Home />}></Route>
            <Route path="/cougar-cash" element={<CougarCash />}></Route>
            <Route path="/directions" element={<Directions />}></Route>
            <Route path="/about" element={<About />}></Route>
            <Route path="/sheets" element={<SheetsTestPage />}></Route>
            <Route path="/typing" element={<TypingGamePage />}></Route>
            <Route
              path="/typing/marathon"
              element={<TypingMarathonMode />}
            ></Route>
            <Route path="/snake" element={<SnakeGamePage />}></Route>
            <Route path="/c-quiz" element={<ComplianceQuizPage />}></Route>
            <Route path="/c-quiz-2" element={<CQuiz2Page />}></Route>
            <Route path="/timer" element={<TimerApp />}></Route>
            <Route path="/fpm" element={<Demo />}></Route>
            <Route path="/oroboros" element={<Oroboros />}></Route>
            <Route path="/maze-quiz" element={<MazeQuiz />}></Route>
            <Route path="/pie-timer" element={<PieTimer />}></Route>
            <Route path="/pizza-game" element={<PizzaGame />}></Route>
            <Route path="/keyboard" element={<DnDKeyboard />}></Route>
            <Route path="/map" element={<MapVisualizer />}></Route>
            <Route path="/one-word" element={<OneWordTenSeconds />}></Route>
            <Route path="/pong" element={<TypingPong />}></Route>
            <Route path="/hall-pass/*" element={<HallPassRoutes />} />
            <Route path="/paw-pass" element={<PawPassApp />} />
            <Route path="/mc-quiz" element={<MultipleChoiceQuiz />} />
            <Route path="/parent-letter" element={<ParentLetter />} />
            <Route path="/sound" element={<SoundButton />} />
            <Route path="/combat-sim" element={<DndZoneCombatSimulator />} />
            <Route path="/curiosity" element={<CuriosityApp />} />
            <Route
              path="/shape-gen"
              element={<IrregularShapeGenerator />}
            />
            <Route path="/padlet/*" element={<PadletSessionApp />} />
            <Route path="/typing-boss/*" element={<TypingBossApp />} />
            <Route path="/the-pattern/*" element={<PatternGameApp />} />
            <Route path="/fishing-card-game" element={<FishingCardGame />} />
            <Route path="/crossy-road" element={<CrossyRoad />} />
            <Route path="/captive-chess" element={<CaptiveChess />} />
          </Routes>
        </Suspense>
      </Router>
    </Box>
  );
}

export default App;
