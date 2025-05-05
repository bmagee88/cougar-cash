import { Box, Stack, TextField, Typography, Modal, Button, styled } from "@mui/material";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { words } from "typingProject/resources/staticData";
/** @jsxImportSource @emotion/react */
import { keyframes } from "@emotion/react";
import Confetti from "typingProject/Confetti";
import { usePersistedLevel } from "typingProject/hooks/usePersistedLevel";
import { usePersistedHighscore } from "typingProject/hooks/usePersistedHighscore";

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
    if (inactivityRef.current) clearTimeout(inactivityRef.current);

    inactivityRef.current = setTimeout(() => {
      setPausedForInactivity(true);
    }, 5000); // 5 seconds
  };

  const getTodayKey = () => new Date().toISOString().split("T")[0];
  const [correctWordCount, setCorrectWordCount] = useState(() => {
    const saved = localStorage.getItem("dailies");
    const dailies = saved ? JSON.parse(saved) : {};
    const today = getTodayKey();
    return dailies[today]?.correctWordCount || 0;
  });

  useEffect(() => {
    if (!timerStarted || gameCompleted) return;

    const today = getTodayKey();
    const saved = localStorage.getItem("dailies");
    const dailies = saved ? JSON.parse(saved) : {};

    dailies[today] = {
      ...(dailies[today] || {}),
      correctWordCount,
    };

    localStorage.setItem("dailies", JSON.stringify(dailies));
  }, [correctWordCount, timerStarted, gameCompleted]);

  const [playTime, setPlayTime] = useState(() => {
    const saved = localStorage.getItem("dailies");
    const dailies = saved ? JSON.parse(saved) : {};
    const today = getTodayKey();
    return dailies[today]?.playTime || 0;
  });

  const dailyGoalMet =
    correctWordCount >= 75 && playTime >= DAILY_GOAL_SECONDS && currentLevel >= 5;

  useEffect(() => {
    const today = getTodayKey();
    const saved = localStorage.getItem("dailies");
    const dailies = saved ? JSON.parse(saved) : {};

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

  const [streak, setStreak] = useState(() => calculateStreak());

  useEffect(() => {
    if (dailyGoalMet) {
      setStreak(calculateStreak());
    }
  }, [dailyGoalMet]);

  useEffect(() => {
    console.log("correctWordCount", correctWordCount);
    if (!timerStarted || gameCompleted || pausedForInactivity) return;

    const interval = setInterval(() => {
      const today = getTodayKey();

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
    if (pausedForInactivity) {
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
  }, [timerStarted, gameCompleted, pausedForInactivity]);

  useEffect(() => {
    if (gameCompleted) {
      startNextLevel(); // Start the next level automatically when the game is completed
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameCompleted]);

  // Add this inside your TypingGamePage component
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        resetGame(); // Trigger reset game when Enter key is pressed
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
      parseFloat(score.split(".")[1]) > parseFloat(highscore.split(".")[1])
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
    if (parseFloat(score) > parseFloat(highscore)) {
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

  const resetGame = () => {
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
    setCurrentLevel((prev) => prev - 2);
    setStatuses(Array(activeWordList.join(" ").length).fill(null)); // Reset statuses
    setTimerStarted(false); // Reset timer start flag
    setActiveWordList(getRandomWords(currentLevel - 2)); // Start with one word at level 1
  };

  return (
    <Stack
      sx={{
        justifyContent: "center",
        alignItems: "center",
        minHeight: "calc(100vh - 1.5rem)",
        background: "linear-gradient(to right, #283c86, #45a247)",
      }}>
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

          {pausedForInactivity ? (
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
          onClose={resetGame}
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
              onClick={resetGame}
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
