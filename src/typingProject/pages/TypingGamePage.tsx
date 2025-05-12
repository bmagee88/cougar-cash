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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  Snackbar,
  Alert,
  Tooltip,
} from "@mui/material";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { collectiblePairs, leagueTrophies, words } from "typingProject/resources/staticData";
/** @jsxImportSource @emotion/react */
import Confetti from "typingProject/Confetti";
import { usePersistedLevel } from "typingProject/hooks/usePersistedLevel";
import { usePersistedHighscore } from "typingProject/hooks/usePersistedHighscore";
import SettingsIcon from "@mui/icons-material/Settings";
import BackpackIcon from "@mui/icons-material/Backpack";
import Drawer from "@mui/material/Drawer";
import Badge from "@mui/material/Badge";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { glow, pulse, pulseBadge, shake } from "typingProject/keyframes/keyframes";
import { INACTIVITY_PAUSE_SECONDS, TIMER } from "typingProject/constants/constants";

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

  const [drawerOpen, setDrawerOpen] = useState(false);

  const [collectedWords, setCollectedWords] = useState<string[]>(() => {
    const stored = localStorage.getItem("collectedWords");
    return stored ? JSON.parse(stored) : [];
  });

  // const flyRef = useRef<HTMLDivElement>(null);

  const lastWordRef = useRef<string>("");

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

  const [snackbar, setSnackbar] = useState<{
    message: string;
    open: boolean;
    severity?: "success" | "info" | "warning" | "error";
  }>({ message: "", open: false });

  const showSnackbar = (
    message: string,
    severity: "success" | "info" | "warning" | "error" = "info"
  ) => {
    setSnackbar({ message, open: true, severity });
  };

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState("bronze");
  const [difficulties, setDifficulties] = useState({
    casual: false,
    hardcore: false,
    perfection: false,
  });
  const isHardcore = difficulties.hardcore;

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

  useEffect(() => {
    showSnackbar(
      "+Hardcore, Perfection and Casual settings now available! +New Single Word collection available!",
      "info"
    );
  }, []);

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
    }, INACTIVITY_PAUSE_SECONDS * 1000);
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
    lastWordRef.current = newWords[newWords.length - 1]; // ✅ Store last word
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

        if (!collectedWords.includes(targetWord)) {
          const updatedWords = [...collectedWords, targetWord];
          setCollectedWords(updatedWords);
          localStorage.setItem("collectedWords", JSON.stringify(updatedWords));
        }
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
    const isCorrect = lastChar === fullText[currentIndex];
    newStatuses[currentIndex] = isCorrect ? "correct" : "incorrect";

    // 🔥 Perfection mode ends the game immediately on mistake
    if (difficulties.perfection && !isCorrect) {
      setStatuses(newStatuses);
      setGameCompleted(true);
      setShowModal(true);
      return;
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
      // collectLastTypedWord(); // ✅ Collect the final word before state resets
      checkForNewPairs(fullText);
      startNextLevel();
    }

    // Start the timer on the first key press if not already started
    if (!timerStarted) {
      setTimerStarted(true);
    }
  };

  const handleTimeOut = () => {
    // collectLastTypedWord();
    setShowModal(true);
  };

  const startNextLevel = () => {
    const typedWords = input.trim().split(" ");
    const lastTypedWord = typedWords[typedWords.length - 1];
    const lastWord = lastWordRef.current;

    if (lastTypedWord === lastWord && !collectedWords.includes(lastTypedWord)) {
      const updated = [...collectedWords, lastTypedWord];
      setCollectedWords(updated);
      localStorage.setItem("collectedWords", JSON.stringify(updated));
    }
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
    setCurrentLevel((prev) => {
      if (offCasual) return 1;
      if (isHardcore) return 1;
      if (fromHighscoreModal) return Math.max(1, prev - 1);
      return Math.max(1, prev - 1);
    });
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

  const totalWordCount = Object.values(words).flat().length;
  const collectedWordCount = collectedWords.length;
  const wordCollectionPercent = Math.round((collectedWordCount / totalWordCount) * 100);

  const collectedWordsByLength: { [length: string]: string[] } = {};

  for (const word of collectedWords) {
    const len = word.length.toString();
    if (!collectedWordsByLength[len]) {
      collectedWordsByLength[len] = [];
    }
    collectedWordsByLength[len].push(word);
  }

  // const collectLastTypedWord = () => {
  //   const fullWords = fullText.split(" ");
  //   const typedUpTo = fullText.slice(0, currentIndex);
  //   const typedWords = typedUpTo.trim().split(" ");
  //   const lastIndex = typedWords.length - 1;

  //   if (lastIndex >= 0 && lastIndex < fullWords.length) {
  //     const typedWord = typedWords[lastIndex];
  //     const expectedWord = fullWords[lastIndex];

  //     if (typedWord === expectedWord && !collectedWords.includes(typedWord)) {
  //       const updated = [...collectedWords, typedWord];
  //       setCollectedWords(updated);
  //       localStorage.setItem("collectedWords", JSON.stringify(updated));
  //     }
  //   }
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
          📘 Word Collection
        </Typography>
        <Typography
          variant='h5'
          sx={{
            mb: 2,
            color: "marigold",
            textAlign: "center",
            fontWeight: "bold",
            lineHeight: ".25rem",
          }}>
          {" "}
          ({collectedWordCount} / {totalWordCount}) {wordCollectionPercent}%
        </Typography>

        <Accordion
          defaultExpanded={false}
          sx={{
            backgroundColor: "#2e2e2e",
            color: "white",
            border: "1px solid #555",
            borderRadius: "8px",
            mb: 1,
            "&:before": { display: "none" },
          }}>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon sx={{ color: "gold" }} />}
            sx={{
              backgroundColor: "#1c1c1c",
              borderBottom: "1px solid #333",
              borderRadius: "8px 8px 0 0",
              "& .MuiTypography-root": {
                color: "gold",
                fontWeight: "bold",
              },
            }}>
            <Typography sx={{ color: "gold", mb: 1 }}>Single Words</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {Object.entries(words)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([length, wordList]) => (
                <Box
                  key={length}
                  sx={{ mb: 2 }}>
                  <Typography sx={{ color: "#aaa", fontWeight: "bold", mb: 1 }}>
                    Length {length}
                  </Typography>
                  <List
                    dense
                    sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                    {wordList.sort().map((word) => (
                      <ListItem
                        key={word}
                        sx={{
                          width: "auto",
                          p: 0.5,
                          pl: 1,
                          pr: 1,
                          backgroundColor: "#333",
                          borderRadius: 1,
                          color: collectedWords.includes(word) ? "white" : "#888",
                          fontWeight: collectedWords.includes(word) ? "bold" : "normal",
                          textTransform: "capitalize",
                        }}>
                        {word}
                      </ListItem>
                    ))}
                  </List>
                </Box>
              ))}
          </AccordionDetails>
        </Accordion>

        <Typography
          variant='h5'
          sx={{ mb: 2, color: "marigold", textAlign: "center", fontWeight: "bold" }}>
          🎒 Word Pair Collection
        </Typography>

        {Object.entries(collectiblePairs).map(([theme, pairs]) => {
          const collectedCount = pairs.filter((pair) => collectedPairs.includes(pair)).length;
          return (
            // <Box
            //   key={theme}
            //   sx={{ mb: 3 }}>
            <Accordion
              key={theme}
              defaultExpanded={false}
              sx={{
                backgroundColor: "#2e2e2e",
                color: "white",
                border: "1px solid #555",
                borderRadius: "8px",
                mb: 1,
                "&:before": { display: "none" },
              }}>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: "gold" }} />}
                sx={{
                  backgroundColor: "#1c1c1c",
                  borderBottom: "1px solid #333",
                  borderRadius: "8px 8px 0 0",
                  "& .MuiTypography-root": {
                    color: "gold",
                    fontWeight: "bold",
                  },
                }}>
                <Typography>
                  {theme} ({collectedCount} / {pairs.length})
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ backgroundColor: "#1c1c1c" }}>
                <List dense>
                  {pairs.map((pair) => (
                    <Typography
                      key={pair}
                      sx={{
                        color: collectedPairs.includes(pair) ? "marigold" : "#888",
                        fontWeight: collectedPairs.includes(pair) ? "bold" : "normal",
                        textTransform: "capitalize",
                        px: 1,
                        py: 0.5,
                      }}>
                      {pair}
                    </Typography>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>

            // {/* <Typography
            //   variant='h6'
            //   sx={{ color: "gold", mb: 1 }}>
            //   {theme} ({collectedCount} / {pairs.length})
            // </Typography>
            // <Stack spacing={1}>
            //   {pairs.map((pair, index) => (
            //     <Typography
            //       key={pair}
            //       sx={{
            //         color: collectedPairs.includes(pair) ? "marigold" : "#888",
            //         fontWeight: collectedPairs.includes(pair) ? "bold" : "normal",
            //         textTransform: "capitalize",
            //       }}>
            //       {pair}
            //     </Typography>
            //   ))}
            // </Stack> */}
            // </Box>
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
        <Tooltip
          title={`${Math.floor(playTime / 60)}m ${playTime % 60}s / 15m — Play Time Goal`}
          arrow>
          <Box
            sx={{
              width: "80%",
              bgcolor: "#2e2e2e",
              height: 12,
              borderRadius: "12px",
              mb: ".3rem",
            }}>
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
        </Tooltip>
      )}
      {/* <Typography
          variant='caption'
          color='white'
          textAlign='center'
          sx={{ marginBottom: "1rem" }}>
          {Math.floor(playTime / 60)}m {playTime % 60}s / 15m
        </Typography> */}
      {!goalMetFromStorage && (
        <Tooltip
          title={`${correctWordCount} / 75 correct words — Word Accuracy Goal`}
          arrow>
          <Box
            sx={{
              width: "80%",
              bgcolor: "#2e2e2e",
              height: 12,
              borderRadius: "12px",
              mb: ".3rem",
            }}>
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
        </Tooltip>
      )}
      {/* <Typography
          variant='caption'
          color='white'
          textAlign='center'
          sx={{ marginBottom: "1rem" }}>
          {correctWordCount + "/ 75"}
        </Typography> */}

      {!goalMetFromStorage && (
        <Tooltip
          title={`Level ${currentLevel} / 5 — Minimum Level Goal`}
          arrow>
          <Box
            sx={{
              width: "80%",
              bgcolor: "#2e2e2e",
              height: 12,
              borderRadius: "12px",
              mb: ".5rem",
            }}>
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
        </Tooltip>
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

          <Typography
            sx={{
              fontWeight: "bold",
              display: "flex",
              gap: 1,
              alignItems: "center",
              color: "white",
            }}>
            <>
              {difficulties.hardcore && (
                <span style={{ color: "#ff6347", fontWeight: "bold" }}>HARDCORE</span>
              )}
              {difficulties.perfection && (
                <span style={{ color: "#ff69b4", fontWeight: "bold" }}>PERFECTION</span>
              )}
              {difficulties.casual ? (
                <span style={{ color: "lightgreen", fontWeight: "bold" }}>CASUAL</span>
              ) : pausedForInactivity ? (
                <span style={{ color: "orange", animation: `${pulse} 1s infinite` }}>⏸ Paused</span>
              ) : timer <= INACTIVITY_PAUSE_SECONDS ? (
                <AnimatedTimer
                  key={"timer-" + timer}
                  sx={{
                    animation: `${pulse} 0.5s ease-in-out`,
                  }}>
                  Time left: {timer}s
                </AnimatedTimer>
              ) : (
                <span>Time left: {timer}s</span>
              )}
            </>
          </Typography>
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
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
};

export default TypingGamePage;
