import {
  Box,
  Stack,
  TextField,
  Typography,
  Modal,
  Button,
  styled,
  IconButton,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  FormGroup,
} from "@mui/material";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { words } from "typingProject/resources/staticData";
/** @jsxImportSource @emotion/react */
import { keyframes } from "@emotion/react";
import Confetti from "typingProject/Confetti";
import { usePersistedLevel } from "typingProject/hooks/usePersistedLevel";
import { usePersistedHighscore } from "typingProject/hooks/usePersistedHighscore";
import SettingsIcon from "@mui/icons-material/Settings";
import BackpackIcon from "@mui/icons-material/Backpack";
import Drawer from "@mui/material/Drawer";
import Badge from "@mui/material/Badge";

const pulseBadge = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.4); }
  100% { transform: scale(1); }
`;

const glow = keyframes`
    0% { text-shadow: 0 0 5px #fff, 0 0 10px #ff00ff, 0 0 15px #00ffff; }
    50% { text-shadow: 0 0 10px #ffff00, 0 0 20px #00ff00, 0 0 30px #ff0000; }
    100% { text-shadow: 0 0 5px #fff, 0 0 10px #ff00ff, 0 0 15px #00ffff; }
  `;

const shake = keyframes`
    0%   { transform: translate(0, 0) rotate(0deg); font-size: 1rem; color: #2980b9; }  /* Blue */
    10%  { transform: translate(-3px, 2px) rotate(-1deg); font-size: 1.05rem; color: #16a085; }  /* Teal */
    20%  { transform: translate(4px, -1px) rotate(1deg); font-size: 0.95rem; color: #27ae60; }  /* Green */
    30%  { transform: translate(-2px, 3px) rotate(0deg); font-size: 1.1rem; color: #f39c12; }  /* Yellow */
    40%  { transform: translate(3px, -2px) rotate(1deg); font-size: 0.9rem; color: #8e44ad; }  /* Purple */
    50%  { transform: translate(-4px, 1px) rotate(-1deg); font-size: 1.05rem; color: #e67e22; }  /* Orange */
    60%  { transform: translate(2px, -3px) rotate(0deg); font-size: 0.97rem; color: #d35400; }  /* Dark Orange */
    70%  { transform: translate(-1px, 2px) rotate(1deg); font-size: 1.08rem; color: #c0392b; }  /* Red */
    80%  { transform: translate(3px, -1px) rotate(-1deg); font-size: 0.92rem; color: #f1c40f; }  /* Yellow-Green */
    90%  { transform: translate(-2px, 1px) rotate(0deg); font-size: 1.03rem; color: #34495e; }  /* Dark Blue */
    100% { transform: translate(0, 0) rotate(0deg); font-size: 1rem; color: #2980b9; }  /* Back to Blue */
  `;

const pulse = keyframes`
    0% {
      transform: scale(1);
      color: inherit;
    }
    50% {
      transform: scale(1.5);
      color: red;
    }
    100% {
      transform: scale(1);
      color: inherit;
    }
  `;

// const AnimatedTimer = styled(Typography, {
//   shouldForwardProp: (prop) => prop !== "animate",
// })<{ animate?: boolean }>(({ animate }) => ({
//   ...(animate && {
//     animation: `${pulse} 0.5s ease-in-out`,
//   }),
// }));

const AnimatedTimer = styled(Typography)(({ theme }) => ({
  transition: "transform 0.5s ease-in-out",
  display: "inline-block",
}));

const TIMER = 60;

const TypingGamePage: React.FC = () => {
  const getTodayKey = () => new Date().toISOString().split("T")[0];
  const calculateStreak = (): number => {
    const saved = localStorage.getItem("dailies");
    if (!saved) return 0;
    const dailies = JSON.parse(saved);

    let streak = 0;
    const today = new Date();

    for (let i = 0; i < 100; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const key = date.toISOString().split("T")[0];

      if (dailies[key]?.goalMet) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  };
  const leagueTrophies = {
    bronze: { emoji: "🥉", color: "#cd7f32" },
    silver: { emoji: "🥈", color: "#c0c0c0" },
    gold: { emoji: "🥇", color: "#ffd700" },
    platinum: { emoji: "🌟", color: "#e5e4e2" }, // or pick a custom
  };

  const [drawerOpen, setDrawerOpen] = useState(false);

  const collectiblePairs = {
    Social: [
      "kind heart",
      "help hand",
      "warm hug",
      "soft smile",
      "open arms",
      "gentle touch",
      "bright eyes",
      "true friend",
      "peace talk",
      "safe space",
      "sweet words",
      "calm voice",
      "caring soul",
      "friendly wave",
      "hopeful glance",
      "shared joy",
      "silent support",
      "trust earned",
      // "deep compassion",
      "love shared",
      "brave ally",
      "cheer given",
      "fair play",
      "joyful hug",
      "honest answer",
      "respect shown",
      "welcoming grin",
      "good neighbor",
      "grateful heart",
      // "thoughtful gift",
      "nice gesture",
      "giving nature",
      "kindness returned",
      "shared laugh",
      "listening ear",
      "patient friend",
      "gentle word",
      "grace offered",
      "support system",
      "faith kept",
      "bond made",
      "sincere thanks",
      "sweet gesture",
      "forgive quickly",
      "soft heart",
      "true smile",
      "thank you",
      "empathy given",
      "warm welcome",
      "comfort offered",
      "uplifting word",
      "smiling eyes",
      "reliable friend",
      // "neighborly wave",
      "steady hand",
      "light touch",
      "open heart",
      "pure intent",
      "compassion offered",
      "loyal friend",
      "trusting bond",
      "support beam",
      "shared secret",
      "peace offering",
      "emotional support",
      "healing hug",
      "gentle eyes",
      "safe feeling",
      "welcomed warmly",
      "open door",
      "quiet listener",
      "tender care",
      "shared burden",
      "mutual respect",
      "common ground",
      "family bond",
      "happy tears",
      "laugh shared",
      "comfort zone",
      "moral support",
      "healing space",
      "helpful hand",
      "kind act",
      "gentle gesture",
      "relief given",
      "true empathy",
      "good vibes",
      "group hug",
      "trusted friend",
      "shared love",
      "respect offered",
      // "lasting friendship",
      "peace made",
      "open ears",
      "steady smile",
      "cheerful grin",
      "healing words",
      "support given",
      "warmth shared",
      "gentle help",
    ],
    Technology: [
      "binary code",
      "server stack",
      "data stream",
      "cloud storage",
      "wifi signal",
      "usb port",
      "api call",
      "network node",
      "logic gate",
      "debug tool",
      "smart device",
      "web page",
      "code editor",
      "system boot",
      "drive error",
      "gpu driver",
      "bit rate",
      "ping test",
      "cpu core",
      "disk space",
      "cache miss",
      "router config",
      "mobile app",
      "tech stack",
      "internet browser",
      "domain name",
      "protocol switch",
      // "javascript loop",
      "file path",
      "loop function",
      "error log",
      "byte stream",
      "logic error",
      "html tag",
      "css grid",
      "security patch",
      "device sync",
      "signal boost",
      "code base",
      "stack trace",
      "packet loss",
      "dns query",
      "code branch",
      "test case",
      "build error",
      "terminal command",
      "debug console",
      "sql query",
      "memory leak",
      "input device",
      "output port",
      "mouse click",
      "keyboard shortcut",
      "email client",
      "spam filter",
      "syntax error",
      "git repo",
      "merge conflict",
      "commit log",
      "deploy script",
      "server uptime",
      "dev tool",
      "frontend framework",
      "backend route",
      // "form validation",
      "render loop",
      "viewport width",
      "media query",
      // "responsive design",
      "docker image",
      "version control",
      "database table",
      "login form",
      "session timeout",
      "cookie tracker",
      "firewall rule",
      "ssl cert",
      "crypto hash",
      "function call",
      // "websocket connection",
      "user auth",
      "error handler",
      "dark mode",
      "code snippet",
      "clipboard copy",
      "cli tool",
      "terminal shell",
      "dev mode",
      "build pipeline",
      "query param",
      "api endpoint",
      "node module",
      "npm package",
      "react hook",
      "redux store",
      "token auth",
      "machine code",
      "boot sequence",
      "static site",
      "landing page",
    ],
    Success: [
      "big goal",
      "clear plan",
      "daily grind",
      "small win",
      "smart move",
      "bold step",
      "hard work",
      "focused mind",
      "good habit",
      "next level",
      "sharp vision",
      "firm decision",
      "strong will",
      "goal achieved",
      "win streak",
      "dream job",
      "clear path",
      "long run",
      "high bar",
      "growth mindset",
      "task done",
      "grit shown",
      "value added",
      "earn trust",
      "well done",
      "bright future",
      "deep focus",
      "solid plan",
      "true grit",
      // "worthwhile effort",
      "top form",
      "goal reached",
      "sharp mind",
      "effort shown",
      "key step",
      "major win",
      "long haul",
      "level up",
      "great pitch",
      "work ethic",
      "lucky break",
      "clean win",
      "firm goal",
      "big picture",
      "vision board",
      "grind mode",
      "steady climb",
      "team win",
      "quick win",
      "bold vision",
      "daily hustle",
      "keep going",
      "push forward",
      "strong finish",
      "sharp turn",
      "right move",
      "big idea",
      "deep dive",
      "new skill",
      "value earned",
      "worth fight",
      "steady growth",
      "right call",
      "final push",
      "team effort",
      "career move",
      "action plan",
      "next step",
      "smart risk",
      "new role",
      "steady pace",
      "quick pivot",
      "goal met",
      "deadline hit",
      "promotion earned",
      "plan made",
      "vision clear",
      "wise move",
      "bright path",
      "calm mind",
      "bold action",
      "quick adapt",
      "timely fix",
      "major shift",
      "level gain",
      "dream reach",
      "small step",
      "goal list",
      "hope held",
      "top mark",
      "peak form",
      "game face",
      "win goal",
      "fast lane",
      "career climb",
      "lead role",
      "goal chain",
      "task beat",
      "hustle paid",
      "aim true",
      "chicken jocky",
      "locked in",
    ],
    Academia: [
      "study guide",
      "test day",
      "quiz score",
      "pencil case",
      "note card",
      "school desk",
      "open book",
      "sharp mind",
      "final exam",
      "lab coat",
      "class rules",
      "group project",
      "book report",
      "math test",
      "lunch break",
      "pop quiz",
      "science lab",
      "chalk board",
      "pen ink",
      "college prep",
      "grade level",
      "school bell",
      "study hour",
      "field trip",
      "lesson plan",
      "white board",
      "text book",
      "quiz time",
      "classmate help",
      "teacher aid",
      "paper due",
      "home work",
      "class note",
      "book stack",
      "math quiz",
      "history test",
      "reading log",
      "word list",
      "science fair",
      "quiz grade",
      "test prep",
      "open notes",
      "school pride",
      "honor roll",
      "desk chair",
      "subject guide",
      "brain storm",
      "chalk dust",
      "lab sheet",
      "school zone",
      "field notes",
      "desk drawer",
      "tutor help",
      "term paper",
      "reading lamp",
      "quiz board",
      "note pad",
      "math notes",
      "school play",
      "extra credit",
      "study tool",
      "exam review",
      "peer review",
      "project rubric",
      "final grade",
      "bell ring",
      "study break",
      "daily planner",
      "grade scale",
      "exam hall",
      "study snacks",
      "learning aid",
      "class pet",
      "test anxiety",
      "quiz app",
      "lesson test",
      "extra help",
      "group study",
      "exam question",
      "rubric score",
      "essay topic",
      "proof read",
      "school bus",
      "academic goal",
      "notebook paper",
      "sharpener edge",
      "tardy slip",
      "school trip",
      "teacher lounge",
      "library pass",
      "lab notebook",
      "quiz sheet",
      "home pass",
      "lesson guide",
      "grade boost",
      "brain work",
      "exam desk",
      "teacher note",
      "extra worksheet",
      "review sheet",
    ],
  };

  // const flyRef = useRef<HTMLDivElement>(null);

  const [foundNewPair, setFoundNewPair] = useState(false);
  const [newlyCollectedCount, setNewlyCollectedCount] = useState(0);

  const [collectedPairs, setCollectedPairs] = useState<string[]>(() => {
    const stored = localStorage.getItem("collectedPairs");
    return stored ? JSON.parse(stored) : [];
  });

  const [currentLevel, setCurrentLevel] = usePersistedLevel();
  const [scrollAnchorLine] = useState(0);

  const [shouldShake, setShouldShake] = useState(false);
  const [highscore, setHighscore] = usePersistedHighscore();
  const [activeWordList, setActiveWordList] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [statuses, setStatuses] = useState<(null | "correct" | "incorrect")[]>(
    Array(activeWordList.join(" ").length).fill(null)
  );
  const [timer, setTimer] = useState(TIMER);
  const [timerStarted, setTimerStarted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [highscoreUpdated, setHighscoreUpdated] = useState(false);
  // const [levelCompleted, setLevelCompleted] = useState(false);
  const [isNewHighscore, setIsNewHighscore] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const [lineCharCount, setLineCharCount] = useState<number[]>([]);

  const [currentLine, setCurrentLine] = useState(0);

  const [pausedForInactivity, setPausedForInactivity] = useState(false);

  const [goalMetFromStorage, setGoalMetFromStorage] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState("bronze");
  const [difficulties, setDifficulties] = useState({
    casual: false,
    hardcore: false,
    perfection: false,
  });
  const [playTime, setPlayTime] = useState(() => {
    const saved = localStorage.getItem("dailies");
    const dailies = saved ? JSON.parse(saved) : {};
    const today = getTodayKey();
    return dailies[today]?.playTime || 0;
  });

  const [correctWordCount, setCorrectWordCount] = useState(() => {
    const saved = localStorage.getItem("dailies");
    const dailies = saved ? JSON.parse(saved) : {};
    const today = getTodayKey();
    return dailies[today]?.correctWordCount || 0;
  });

  const [streak, setStreak] = useState(() => calculateStreak());

  const handleDifficultiesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target;
    console.log("name checked", name, checked);
    console.log("difficulties", difficulties);
    setDifficulties((prev) => {
      const newDifficulties = { ...prev, [name]: checked };

      if (name === "casual" && prev.casual && !checked) {
        // Reset game only if casual is turned OFF
        resetGame(true, false);
      }

      return newDifficulties;
    });
  };

  // const handleLeagueChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  //   setSelectedLeague(event.target.value);
  // };

  const isCasual = difficulties.casual;

  const checkForNewPairs = (fullText: string) => {
    const allPairs = Object.values(collectiblePairs).flat();

    for (const pair of allPairs) {
      if (fullText.includes(pair) && !collectedPairs.includes(pair)) {
        const updated = [...collectedPairs, pair];
        setCollectedPairs(updated);
        localStorage.setItem("collectedPairs", JSON.stringify(updated));
        setNewlyCollectedCount((prev) => prev + 1); // 🔥 Increment new count
        setFoundNewPair(true);
        setTimeout(() => setFoundNewPair(false), 1000);

        // 🔍 Find the first character span of the matched pair
        // const pairWords = pair.split(" ");
        // const pairStart = fullText.indexOf(pair);
        // const charEls = document.querySelectorAll("#active-word-list-box span");

        // const startEl = charEls[pairStart] as HTMLElement;
        // const backpackEl = document.getElementById("backpack-icon");

        // if (startEl && backpackEl) {
        //   animatePairToBackpack(startEl, backpackEl);
        // }

        break; // animate only one pair per call
      }
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("dailies");
    if (saved) {
      const dailies = JSON.parse(saved);
      const today = getTodayKey();
      if (dailies[today]?.goalMet) {
        setGoalMetFromStorage(true);
      }
    }
  }, []);

  const lineHeight = 24 * 1.2; // or whatever you used for lineHeight in your Box

  const DAILY_GOAL_SECONDS = 15 * 60;

  const inactivityRef = useRef<NodeJS.Timeout | null>(null);

  const resetInactivityTimer = () => {
    // if (isCasual) return; // Don't set inactivity timer in casual mode

    if (inactivityRef.current) clearTimeout(inactivityRef.current);

    inactivityRef.current = setTimeout(() => {
      setPausedForInactivity(true);
    }, 5000);
  };

  useEffect(() => {
    if (!timerStarted || gameCompleted) return;
    ensureTodayInitialized();

    const today = getTodayKey();
    const saved = localStorage.getItem("dailies");
    const dailies = saved ? JSON.parse(saved) : {};

    dailies[today] = {
      ...(dailies[today] || {}),
      correctWordCount,
    };

    localStorage.setItem("dailies", JSON.stringify(dailies));
  }, [correctWordCount, timerStarted, gameCompleted]);

  useEffect(() => {
    console.log("correctWordCount", correctWordCount);
    if (!timerStarted || gameCompleted || pausedForInactivity) return;

    const interval = setInterval(() => {
      const today = getTodayKey();
      ensureTodayInitialized();

      setPlayTime((prev) => {
        const updated = prev + 1;

        const saved = localStorage.getItem("dailies");
        const dailies = saved ? JSON.parse(saved) : {};
        dailies[today] = {
          ...(dailies[today] || {}),
          playTime: updated,
          correctWordCount, // save the latest word count as well
        };
        localStorage.setItem("dailies", JSON.stringify(dailies));

        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerStarted, gameCompleted, pausedForInactivity]);

  const dailyGoalMet =
    correctWordCount >= 75 && playTime >= DAILY_GOAL_SECONDS && currentLevel >= 5;

  useEffect(() => {
    const today = getTodayKey();
    const saved = localStorage.getItem("dailies");
    const dailies = saved ? JSON.parse(saved) : {};
    ensureTodayInitialized();

    if (dailyGoalMet && !dailies[today]?.goalMet) {
      dailies[today] = {
        ...(dailies[today] || {}),
        goalMet: true,
        playTime,
        correctWordCount,
      };
      localStorage.setItem("dailies", JSON.stringify(dailies));
      setGoalMetFromStorage(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyGoalMet]);

  const ensureTodayInitialized = () => {
    console.log("in ensuretodayinit===");
    const today = new Date().toISOString().split("T")[0];

    const lastInitializedDate = localStorage.getItem("dailies_last_initialized");

    if (lastInitializedDate === today) {
      console.log("stopping early");
      return; // Already initialized today
    }

    console.log("initing today");

    // Mark that we've initialized for today
    localStorage.setItem("dailies_last_initialized", today);

    const saved = localStorage.getItem("dailies");
    const dailies = saved ? JSON.parse(saved) : {};

    if (!dailies[today]) {
      dailies[today] = {
        playTime: 0,
        correctWordCount: 0,
        goalMet: false,
      };
      localStorage.setItem("dailies", JSON.stringify(dailies));
    }
  };

  // streak
  useEffect(() => {
    if (dailyGoalMet) {
      setStreak(calculateStreak());
    }
  }, [dailyGoalMet]);

  // updates playtime each second in local storage

  useEffect(() => {
    const totalCharsSoFar = lineCharCount
      .slice(0, currentLine + 1)
      .reduce((acc, val) => acc + val, 0);

    console.log("totalCharSoFar", totalCharsSoFar);

    if (currentIndex >= totalCharsSoFar && currentLine < lineCharCount.length - 1) {
      console.log("current index exceeds line");
      setCurrentLine((prev) => prev + 1);

      if (containerRef.current) {
        console.log("scrolling");
        containerRef.current.scrollBy({
          top: lineHeight,
          behavior: "smooth",
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, lineCharCount]);

  const calculateLineWidths = (containerRef, activeWordList): number[] => {
    const containerWidth = containerRef.current?.offsetWidth;
    console.log("containerWidth", containerWidth);
    const charWidth = containerRef.current?.querySelector("span")?.offsetWidth; // Measure a single character's width
    console.log("charwidth", charWidth);

    if (!containerWidth || !charWidth) return [];

    let lineWidths = []; // array of numbers
    let currentLineWidth = 0; // pixels // updates
    let currentLine = 0;
    let charsInCurrentLine = 0; // numbers
    let wordsInCurrentLine = 0;
    let spacesInLine = 0;

    // Split the word list into individual words
    activeWordList.forEach((word) => {
      console.log(word);
      const wordLength = word.length; // number of cahracters in the word
      const wordWidth = wordLength * charWidth; // pixels in the word
      // wordsInCurrentLine++;

      console.log(
        "currentLineWidth + wordWidth > containerWidth",
        currentLineWidth,
        wordWidth,
        currentLineWidth + wordWidth,
        containerWidth
      );
      // Check if adding this word exceeds the container width
      currentLineWidth += 10;
      if (currentLineWidth + wordWidth > containerWidth) {
        // If it does, move to the next line
        spacesInLine = wordsInCurrentLine - 1;
        lineWidths[currentLine] = charsInCurrentLine + spacesInLine; // Save the number of characters for this line
        currentLine++;
        currentLineWidth = 0; // Reset width for new line
        charsInCurrentLine = 0; // Reset characters in line
        wordsInCurrentLine = 0;
      }

      console.log("lineWidths", lineWidths);

      // Add word width to current line width
      // adds the word that exceeded the width to the next line
      currentLineWidth -= 10;
      currentLineWidth += wordWidth;
      charsInCurrentLine += wordLength; // Count characters in current line
      wordsInCurrentLine++;
    });

    // Store the last line characters count
    spacesInLine = wordsInCurrentLine - 1;
    lineWidths[currentLine] = charsInCurrentLine + spacesInLine;
    console.log("lineWidths", lineWidths);

    return lineWidths[0] === -1 ? lineWidths.splice(1, lineWidths.length) : lineWidths;
  };

  useEffect(() => {
    setLineCharCount(calculateLineWidths(containerRef, activeWordList));
    let debounceTimeout: NodeJS.Timeout;

    const handleResize = () => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        setLineCharCount(calculateLineWidths(containerRef, activeWordList));
      }, 2000); // 2 seconds
    };
    window.addEventListener("resize", handleResize); // Recalculate on window resize
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [activeWordList, containerRef]);

  // useEffect(() => {}, [currentLevel]);

  const handleWin = () => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 4000);
  };

  // const handleLevelComplete = () => {
  //   setLevelCompleted(true);

  //   // Reset the state after 2 seconds (so confetti animation runs)
  //   setTimeout(() => {
  //     setLevelCompleted(false);
  //   }, 2000); // Duration to match confetti animation time
  // };

  // useEffect(() => {
  //   const newRandomWords = getRandomWords(currentLevel);

  //   if (containerRef.current) {
  //     const widths = calculateLineWidths(containerRef, newRandomWords);
  //     setLineCharCount(widths);
  //   }
  //   setActiveWordList(newRandomWords); // Set active words when level changes or game resets
  // }, [currentLevel]);

  useEffect(() => {
    const newWords = getRandomWords(currentLevel);
    setActiveWordList(newWords);
    setStatuses(Array(newWords.join(" ").length).fill(null)); // immediate sync
    if (containerRef.current) {
      const widths = calculateLineWidths(containerRef, newWords);
      setLineCharCount(widths);
    }
  }, [currentLevel]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!timerStarted || gameCompleted) return;

    // Stop timer if paused
    if (pausedForInactivity || isCasual) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    // Start timer
    if (!timerIntervalRef.current) {
      timerIntervalRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current as NodeJS.Timeout);
            timerIntervalRef.current = null;
            handleTimeOut();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [timerStarted, gameCompleted, pausedForInactivity, isCasual]);

  useEffect(() => {
    if (gameCompleted) {
      checkForNewPairs(fullText);
      startNextLevel(); // Start the next level automatically when the game is completed
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameCompleted]);

  // Add this inside your TypingGamePage component
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        resetGame(false, true); // Trigger reset game when Enter key is pressed
      }
    };

    // Add event listener when modal is open
    if (showModal) {
      document.addEventListener("keydown", handleKeyDown);
    }

    // Clean up the event listener when the modal is closed
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal]); // Run this effect when 'showModal' changes

  const getRandomWords = (level: number): string[] => {
    const wordLengths = Object.keys(words); // ["3", "4", "5", ...]
    const result: string[] = [];

    for (let i = 0; i < level; i++) {
      const randomLengthKey = wordLengths[Math.floor(Math.random() * wordLengths.length)];
      const wordList = words[randomLengthKey];
      const randomWord = wordList[Math.floor(Math.random() * wordList.length)];
      result.push(randomWord);
    }

    return result;
  };

  const fullText = useMemo(() => activeWordList.join(" "), [activeWordList]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const lastChar = value[value.length - 1];
    const justTypedChar = fullText[currentIndex];
    const newIndex = currentIndex + 1;

    resetInactivityTimer();
    if (pausedForInactivity) setPausedForInactivity(false);

    // Check if space was just typed and we're on a word boundary
    if (lastChar === " " && justTypedChar === " ") {
      // Get the word the user just typed (excluding the space)
      const typedWords = value.trimEnd().split(" ");
      const lastTypedWord = typedWords[typedWords.length - 1];

      // Get the corresponding word from the target text
      const fullWords = fullText.split(" ");
      const targetWord = fullWords[typedWords.length - 1];

      if (lastTypedWord === targetWord) {
        setCorrectWordCount((prev) => prev + 1);
        checkForNewPairs(value.trim());
      }
    }

    const isBackspace = value.length < input.length;

    if (isBackspace) {
      const newStatuses = [...statuses];
      newStatuses[currentIndex - 1] = null;
      setStatuses(newStatuses);
      setCurrentIndex((prev) => Math.max(prev - 1, 0));
      setInput(value);
      return;
    }

    // If the first character typed is a space, start the timer but don't advance index or change status
    if (value.length === 1 && lastChar === " " && !timerStarted) {
      setTimerStarted(true);
      setInput(value);
      return;
    }

    if (currentIndex >= fullText.length) return; // prevent typing beyond the word list

    const newStatuses = [...statuses];
    if (lastChar === fullText[currentIndex]) {
      newStatuses[currentIndex] = "correct";
    } else {
      newStatuses[currentIndex] = "incorrect";
    }

    setStatuses(newStatuses);
    setCurrentIndex(currentIndex + 1);
    setInput(value);

    const totalCharsBeforeNextLine = lineCharCount
      .slice(0, currentLine + 1)
      .reduce((acc, val) => acc + val, 0);

    console.log("totalCharsBeforeNextLine", totalCharsBeforeNextLine);
    console.log("index", currentIndex);
    console.log("currentLine", currentLine);

    // newIndex = currentIndex + 1;
    if (newIndex > totalCharsBeforeNextLine && currentLine < lineCharCount.length - 1) {
      console.log("setting current Line + 1");
      setCurrentLine((prev) => prev + 1);
      if (containerRef.current && currentLine >= scrollAnchorLine + 3) {
        const lineHeight = 21.84 * 1.2; // adjust if needed /////////////////////////////
        console.log("scrolling");
        containerRef.current.scrollBy({
          top: lineHeight,
          behavior: "smooth",
        });
      }
    }

    // Update highscore based on the number of correct characters typed so far
    const correctCount = newStatuses.filter((s) => s === "correct").length;
    const score = `${currentLevel}.${correctCount}`;

    // Update highscore if the new count is greater
    if (
      score.split(".")[0] >= highscore.split(".")[0] &&
      parseFloat(score.split(".")[1]) > parseFloat(highscore.split(".")[1]) &&
      !isCasual
    ) {
      setIsNewHighscore(true);
      setHighscore(score);
      setShouldShake(true);
      setHighscoreUpdated(true);
      setTimeout(() => setShouldShake(false), 300); // Match the duration of animation
    }

    // Check if all the letters are correct before timer runs out
    const totalCorrect = newStatuses.filter((s) => s === "correct").length;
    if (totalCorrect === fullText.length) {
      checkForNewPairs(fullText);
      startNextLevel();
    }

    // Start the timer on the first key press if not already started
    if (!timerStarted) {
      setTimerStarted(true);
    }
  };

  const handleTimeOut = () => {
    setShowModal(true);
  };

  const startNextLevel = () => {
    // handleLevelComplete();
    handleWin();
    setGameCompleted(true);
    setCurrentLevel((prev) => prev + 1);
    const score = `${currentLevel + 1}.0`;
    if (parseFloat(score) > parseFloat(highscore) && !isCasual) {
      setHighscore(score); // Update highscore if new one is better
    }
    setCurrentLine(0);
    setActiveWordList(getRandomWords(currentLevel + 1)); // Generate random words for the next level
    setTimer(TIMER); // Reset the timer
    setInput(""); // Clear the input field
    setStatuses(Array(fullText.length).fill(null)); // Reset statuses
    setCurrentIndex(0); // Reset index
    setTimerStarted(false); // Reset the timer start flag
    setGameCompleted(false); // Reset the game completed flag
    setCorrectWordCount((prev) => prev + 1);
    if (containerRef.current) {
      console.log("scrolling up====================================");
      containerRef.current.scrollBy({
        top: -10000,
        behavior: "smooth",
      });
    }
  };

  const resetGame = (offCasual?: boolean, fromHighscoreModal?: boolean) => {
    // const shouldResetToLevel1 = offCasual && !fromHighscoreModal;
    if (containerRef.current) {
      console.log("scrolling up====================================");
      containerRef.current.scrollBy({
        top: -10000,
        behavior: "smooth",
      });
    }
    setCurrentLine(0);
    setIsNewHighscore(false);
    setHighscoreUpdated(false); // call this wherever you reset game
    setTimer(TIMER); // Reset timer
    setGameCompleted(false);
    setShowModal(false);
    setInput(""); // Reset input field
    setCurrentIndex(0); // Reset index
    //   setCurrentLevel((prev) => { if(shouldResetToLevel1) return 1; return prev> 1? prev - 1: 1})
    setCurrentLevel((prev) =>
      prev > 1 ? (fromHighscoreModal ? prev - 1 : offCasual ? 1 : prev - 1) : 1
    );
    setStatuses(Array(activeWordList.join(" ").length).fill(null)); // Reset statuses
    setTimerStarted(false); // Reset timer start flag
    setActiveWordList(getRandomWords(offCasual ? 1 : currentLevel - 1)); // Start with one word at level 1
  };

  // const [leaderboard, setLeaderboard] = useState([
  //   { name: "brian", highscore: 12 },
  //   { name: "derp", highscore: 16 },
  // ]);

  // useEffect(() => {
  //   const ws = new WebSocket("ws://localhost:3001");

  //   ws.onmessage = (event) => {
  //     const msg = JSON.parse(event.data);
  //     if (msg.type === "leaderboard") {
  //       setLeaderboard(msg.data); // Set state
  //     }
  //   };

  //   ws.onopen = () => {
  //     const name = localStorage.getItem("username") || "Guest";
  //     const highscore = localStorage.getItem("highscore") || "0.0";
  //     ws.send(JSON.stringify({ name, highscore }));
  //   };

  //   return () => ws.close();
  // }, []);

  // const animatePairToBackpack = (fromEl: HTMLElement, toEl: HTMLElement) => {
  //   const flyEl = flyRef.current;
  //   if (!flyEl) return;

  //   const fromRect = fromEl.getBoundingClientRect();
  //   const toRect = toEl.getBoundingClientRect();

  //   flyEl.style.left = `${fromRect.left}px`;
  //   flyEl.style.top = `${fromRect.top}px`;
  //   flyEl.style.opacity = "1";
  //   flyEl.style.transform = "translate(0, 0)";

  //   // Force reflow to start transition
  //   void flyEl.offsetWidth;

  //   const dx = toRect.left - fromRect.left;
  //   const dy = toRect.top - fromRect.top;

  //   flyEl.style.transform = `translate(${dx}px, ${dy}px) scale(0.2)`;
  //   flyEl.style.opacity = "0";

  //   setTimeout(() => {
  //     flyEl.style.transform = "";
  //     flyEl.style.opacity = "0";
  //   }, 1000);
  // };

  return (
    <Stack
      sx={{
        justifyContent: "center",
        alignItems: "center",
        minHeight: "calc(100vh - 1.5rem)",
        background: "linear-gradient(to right, #283c86, #45a247)",
      }}>
      {/* <div
        ref={flyRef}
        style={{
          position: "fixed",
          pointerEvents: "none",
          zIndex: 2000,
          opacity: 0,
          fontWeight: "bold",
          color: "gold",
          fontSize: "1rem",
          transition: "transform 0.8s ease-in-out, opacity 0.3s ease-in",
        }}>
        🎒+
      </div> */}

      <Drawer
        anchor='right'
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setNewlyCollectedCount(0);
        }}
        PaperProps={{
          sx: {
            width: "33%",
            backgroundColor: "#1c1c1c",
            color: "white",
            padding: 2,
          },
        }}>
        <Typography
          variant='h5'
          sx={{ mb: 2, color: "marigold", textAlign: "center", fontWeight: "bold" }}>
          🎒 Word Pair Collection
        </Typography>

        {Object.entries(collectiblePairs).map(([theme, pairs]) => {
          const collectedCount = pairs.filter((pair) => collectedPairs.includes(pair)).length;
          return (
            <Box
              key={theme}
              sx={{ mb: 3 }}>
              <Typography
                variant='h6'
                sx={{ color: "gold", mb: 1 }}>
                {theme} ({collectedCount} / {pairs.length})
              </Typography>
              <Stack spacing={1}>
                {pairs.map((pair) => (
                  <Typography
                    key={pair}
                    sx={{
                      color: collectedPairs.includes(pair) ? "marigold" : "#888",
                      fontWeight: collectedPairs.includes(pair) ? "bold" : "normal",
                      textTransform: "capitalize",
                    }}>
                    {pair}
                  </Typography>
                ))}
              </Stack>
            </Box>
          );
        })}
      </Drawer>
      <Stack
        direction={"row"}
        sx={{ position: "absolute", top: 10, right: 10 }}>
        <Stack
          direction='row'
          alignItems='center'
          spacing={1}>
          <Typography>{correctWordCount}/500</Typography>
          <Typography sx={{ color: leagueTrophies[selectedLeague].color, fontWeight: "bold" }}>
            {leagueTrophies[selectedLeague].emoji}
          </Typography>
          <Typography sx={{ color: "white", fontWeight: "bold", textTransform: "capitalize" }}>
            {selectedLeague} League
          </Typography>
        </Stack>
        <Stack>
          <IconButton
            onClick={() => setSettingsOpen(true)}
            sx={{ color: "white" }}>
            <SettingsIcon />
          </IconButton>
          <Badge
            badgeContent={newlyCollectedCount}
            color='warning'
            invisible={newlyCollectedCount === 0}
            sx={{
              "& .MuiBadge-badge": {
                animation: foundNewPair ? `${pulseBadge} 0.8s ease` : "",
                fontSize: "0.75rem",
                fontWeight: "bold",
                minWidth: 20,
                height: 20,
              },
            }}>
            <IconButton
              id='backpack-icon'
              onClick={() => setDrawerOpen(true)}
              sx={{ color: "white", ml: 2 }}>
              <BackpackIcon />
            </IconButton>
          </Badge>
        </Stack>
      </Stack>

      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            bgcolor: "#2e2e2e",
            color: "white",
            p: 4,
            borderRadius: 3,
            boxShadow: 5,
            width: 300,
          }}>
          <Typography
            variant='h6'
            sx={{ mb: 2, textAlign: "center", color: "gold" }}>
            League
          </Typography>
          <RadioGroup
            value={selectedLeague}
            onChange={(e) => setSelectedLeague(e.target.value)}
            sx={{ display: "flex", gap: 1 }}>
            {["bronze", "silver", "gold", "platinum"].map((league) => (
              <FormControlLabel
                key={league}
                value={league}
                // name={league}
                control={<Radio sx={{ display: "none" }} />}
                label={
                  <Box
                    sx={{
                      textTransform: "capitalize",
                      border: selectedLeague === league ? "2px solid #ffe135" : "1px solid grey",
                      borderRadius: 2,
                      px: 2,
                      py: 1,
                      backgroundColor: selectedLeague === league ? "#3D2E00" : "#1c1c1c",
                      color: "white",
                      cursor: "pointer",
                      fontWeight: selectedLeague === league ? "bold" : "normal",
                      textAlign: "center",
                      ":hover": {
                        backgroundColor: "#333",
                      },
                    }}>
                    {league}
                  </Box>
                }
                sx={{ m: 0 }}
              />
            ))}
          </RadioGroup>
          <Typography
            variant='h6'
            sx={{ mt: 3, mb: 1, textAlign: "center", color: "gold" }}>
            Difficulties
          </Typography>
          <FormGroup>
            {["casual", "hardcore", "perfection"].map((diff) => (
              <FormControlLabel
                key={diff}
                name={diff}
                control={
                  <Checkbox
                    checked={difficulties[diff]}
                    onChange={
                      (e) => handleDifficultiesChange(e)
                      // (e) => {
                      //   // setDifficulties((prev) => ({ ...prev, [diff]: e.target.checked }));
                      //   handleDifficultiesChange(e);
                      //   return;
                      // }
                      // (e) => setDifficulties((prev) => ({ ...prev, [diff]: e.target.checked }))
                    }
                    sx={{ color: "white" }}
                    disabled={diff !== "casual"} // ⬅️ Only allow "casual"
                  />
                }
                label={
                  <Typography sx={{ textTransform: "capitalize", color: "white" }}>
                    {diff}
                  </Typography>
                }
              />
            ))}
          </FormGroup>
        </Box>
      </Modal>

      {/* <Dialog
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}>
          <DialogTitle>Settings</DialogTitle>
          <DialogContent>
            <FormControl
              component='fieldset'
              sx={{ mb: 2 }}>
              <FormLabel component='legend'>League</FormLabel>
              <RadioGroup
                value={selectedLeague}
                onChange={handleLeagueChange}
                row>
                <FormControlLabel
                  value='bronze'
                  control={<Radio />}
                  label='Bronze'
                />
                <FormControlLabel
                  value='silver'
                  control={<Radio />}
                  label='Silver'
                />
                <FormControlLabel
                  value='gold'
                  control={<Radio />}
                  label='Gold'
                />
                <FormControlLabel
                  value='platinum'
                  control={<Radio />}
                  label='Platinum'
                />
              </RadioGroup>
            </FormControl>
  
            <FormControl component='fieldset'>
              <FormLabel component='legend'>Difficulties</FormLabel>
              <Box sx={{ display: "flex", flexDirection: "column" }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={difficulties.casual}
                      onChange={handleDifficultyChange}
                      name='casual'
                    />
                  }
                  label='Casual'
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={difficulties.hardcore}
                      onChange={handleDifficultyChange}
                      name='hardcore'
                    />
                  }
                  label='Hardcore'
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={difficulties.perfection}
                      onChange={handleDifficultyChange}
                      name='perfection'
                    />
                  }
                  label='Perfection'
                />
              </Box>
            </FormControl>
          </DialogContent>
        </Dialog> */}
      {/* {leaderboard.map((entry, i) => (
          <Typography key={entry.name}>
            {i + 1}. {entry.name} — {entry.highscore}
          </Typography>
        ))} */}
      <Typography
        variant='subtitle1'
        color='gold'
        sx={{ fontWeight: "bold", mb: 1 }}>
        🔥 Streak: {streak} day{streak === 1 ? "" : "s"}
      </Typography>
      <Typography
        variant='h5'
        color='white'
        sx={{
          animation: goalMetFromStorage ? `${glow} 1.5s infinite alternate` : undefined,
          fontWeight: goalMetFromStorage ? "bold" : "normal",
          letterSpacing: goalMetFromStorage ? 1.5 : "normal",
          textTransform: goalMetFromStorage ? "uppercase" : "none",
          mb: ".5rem",
        }}>
        Daily Goal {goalMetFromStorage ? "COMPLETE" : "Progress"}
      </Typography>

      {!goalMetFromStorage && (
        <Box
          sx={{ width: "80%", bgcolor: "#2e2e2e", height: 12, borderRadius: "12px", mb: ".3rem" }}>
          <Box
            sx={{
              width: `${
                playTime / DAILY_GOAL_SECONDS >= 1 ? 100 : (playTime / DAILY_GOAL_SECONDS) * 100
              }%`,
              height: "100%",
              borderRadius: "12px",
              bgcolor: correctWordCount >= 75 && currentLevel >= 5 ? "green" : "grey",
              transition: "width 0.5s ease",
            }}
          />
        </Box>
      )}
      {/* <Typography
          variant='caption'
          color='white'
          textAlign='center'
          sx={{ marginBottom: "1rem" }}>
          {Math.floor(playTime / 60)}m {playTime % 60}s / 15m
        </Typography> */}
      {!goalMetFromStorage && (
        <Box
          sx={{ width: "80%", bgcolor: "#2e2e2e", height: 12, borderRadius: "12px", mb: ".3rem" }}>
          <Box
            sx={{
              width: `${correctWordCount >= 75 ? 100 : (correctWordCount / 75) * 100}%`,
              height: "100%",
              borderRadius: "12px",
              bgcolor: correctWordCount >= 75 ? "green" : "grey",
              transition: "width 0.5s ease",
            }}
          />
        </Box>
      )}
      {/* <Typography
          variant='caption'
          color='white'
          textAlign='center'
          sx={{ marginBottom: "1rem" }}>
          {correctWordCount + "/ 75"}
        </Typography> */}

      {!goalMetFromStorage && (
        <Box
          sx={{ width: "80%", bgcolor: "#2e2e2e", height: 12, borderRadius: "12px", mb: ".5rem" }}>
          <Box
            sx={{
              width: `${currentLevel >= 5 ? 100 : (currentLevel / 5) * 100}%`,
              height: "100%",
              borderRadius: "12px",
              bgcolor: currentLevel >= 5 ? "green" : "grey",
              transition: "width 0.5s ease",
            }}
          />
        </Box>
      )}
      {/* <Typography
          variant='caption'
          color='white'
          textAlign='center'
          sx={{ marginBottom: "1rem" }}>
          {currentLevel + "/ 5"}
        </Typography> */}

      <Box
        id='box_for_level'
        sx={{
          fontFamily: "monospace",
          padding: 3,
          borderRadius: 3,
          backgroundColor: "#2e2e2e",
          width: "80%",
          // maxWidth: "600px",
        }}>
        <Typography sx={{ color: "#fff", textAlign: "center", fontSize: 28, marginBottom: 2 }}>
          Level {currentLevel}
        </Typography>
        <Box
          sx={{
            fontSize: 24,
            color: "#fff",
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 2,
          }}>
          <Typography>
            HighScore:{" "}
            <Box
              component={"span"}
              sx={{
                display: "inline-block",
                fontWeight: highscoreUpdated ? "bold" : "normal",
                animation: shouldShake ? `${shake} 0.3s ease-in-out` : "none",
              }}>
              {highscore}
            </Box>
          </Typography>

          {isCasual ? (
            <Typography sx={{ color: "lightgreen", fontWeight: "bold" }}>Mode: Casual</Typography>
          ) : pausedForInactivity ? (
            <Typography
              sx={{ color: "orange", fontWeight: "bold", animation: `${pulse} 1s infinite` }}>
              ⏸ Paused
            </Typography>
          ) : timer <= 5 ? (
            <AnimatedTimer
              key={"timer-" + timer}
              sx={{
                animation: `${pulse} 0.5s ease-in-out`,
              }}>
              Time left: {timer}s
            </AnimatedTimer>
          ) : (
            <Typography>Time left: {timer}s</Typography>
          )}
        </Box>

        <Box
          id='active-word-list-box'
          ref={containerRef}
          sx={{
            fontSize: 21.84,
            marginBottom: 2,
            lineHeight: 1.2,
            // maxHeight: `${24 * 1.2 * 3}px`, // 3 lines
            maxHeight: "80vh",
            overflowY: "auto",
            scrollbarWidth: "none", // Firefox
            "&::-webkit-scrollbar": {
              display: "none", // Chrome, Safari
            },
          }}>
          {activeWordList
            .join(" ")
            .split("")
            .map((char, i) => {
              const isActive = i === currentIndex;
              const status = statuses[i];

              const baseColor = isActive
                ? "#3D2E00" // Dark yellow font color for current character
                : status === "correct"
                ? "green"
                : status === "incorrect"
                ? "red"
                : "lightgray";

              const backgroundColor = isActive
                ? "#ffe135" // Banana yellow background for current character
                : status === "correct"
                ? "lightgreen"
                : status === "incorrect"
                ? "lightcoral"
                : "transparent";

              return (
                <span
                  key={"awl-" + i}
                  style={{
                    color: baseColor,
                    backgroundColor,
                    padding: "2px 5px",
                    borderRadius: isActive ? "4px" : "0px",
                    fontWeight: isActive ? "bold" : "normal",
                  }}>
                  {char}
                </span>
              );
            })}
        </Box>

        {/* {lineCharCount.map((w, index) => {
            // console.log("linewidths", lineWidths);
            return (
              <Typography
                key={w + "-" + index}
                color='white'>
                {w}
              </Typography>
            );
          })} */}

        <TextField
          type='text'
          inputRef={inputRef}
          value={input}
          onChange={handleChange}
          sx={{
            fontSize: 24,
            width: "100%",
            padding: 2,
            backgroundColor: "#fff",
            borderRadius: 1,
            color: "#333",
          }}
        />

        <Modal
          open={showModal}
          onClose={() => resetGame(false, true)}
          aria-labelledby='modal-title'
          aria-describedby='modal-description'>
          <Box
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              backgroundColor: "white",
              padding: 4,
              borderRadius: 3,
              boxShadow: 5,
              width: "340px",
              textAlign: "center",
              border: isNewHighscore ? "3px solid #4caf50" : "none",
            }}>
            <Typography
              id='modal-title'
              variant='h5'
              sx={{
                fontWeight: "bold",
                color: isNewHighscore ? "#4caf50" : "text.primary",
                mb: 2,
              }}>
              {isNewHighscore ? "🏆 New High Score!" : "So close, try again!"}
            </Typography>

            {isNewHighscore && (
              <Typography
                sx={{
                  fontSize: 16,
                  color: "#388e3c",
                  mb: 2,
                }}>
                You're improving fast — keep it up!
              </Typography>
            )}

            <Button
              onClick={() => resetGame(false, true)}
              variant='contained'
              sx={{
                marginTop: 1,
                borderRadius: 2,
                fontSize: 16,
                backgroundColor: "#45a247",
                "&:hover": {
                  backgroundColor: "#3c8e3c",
                },
              }}>
              {isNewHighscore ? "Keep Going! 🔥" : "Try Again! 💪"}
            </Button>
          </Box>
        </Modal>
      </Box>
      {/* Show Confetti when a level is completed */}
      {showConfetti && <Confetti />}
    </Stack>
  );
};

export default TypingGamePage;
