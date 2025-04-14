import { Box, Stack, TextField, Typography, Modal, Button } from "@mui/material";
import React, { useEffect, useRef, useState } from "react";
import { words } from "typingProject/resources/staticData";
/** @jsxImportSource @emotion/react */
import { keyframes } from "@emotion/react";
import Confetti from "typingProject/Confetti";
import { usePersistedLevel } from "typingProject/hooks/usePersistedLevel";

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

const TIMER = 60;

const TypingGamePage: React.FC = () => {
  const [currentLevel, setCurrentLevel] = usePersistedLevel();

  const [shouldShake, setShouldShake] = useState(false);
  const [highscore, setHighscore] = useState<string>("1.0");
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
  const [levelCompleted, setLevelCompleted] = useState(false);

  const [showConfetti, setShowConfetti] = useState(false);

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

  useEffect(() => {
    setActiveWordList(getRandomWords(currentLevel)); // Set active words when level changes or game resets
  }, [currentLevel]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    let timerInterval: NodeJS.Timeout | null = null;

    if (timerStarted && !gameCompleted) {
      // Start the timer countdown
      timerInterval = setInterval(() => {
        setTimer((prev) => {
          if (prev === 1) {
            clearInterval(timerInterval as NodeJS.Timeout); // Stop the timer when it reaches 0
            handleTimeOut();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerInterval) clearInterval(timerInterval); // Clean up the timer on unmount
    };
  }, [timerStarted, gameCompleted]);

  useEffect(() => {
    if (gameCompleted) {
      startNextLevel(); // Start the next level automatically when the game is completed
    }
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const lastChar = value[value.length - 1];
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

    if (currentIndex >= activeWordList.join(" ").length) return; // prevent typing beyond the word list

    const newStatuses = [...statuses];
    if (lastChar === activeWordList.join(" ")[currentIndex]) {
      newStatuses[currentIndex] = "correct";
    } else {
      newStatuses[currentIndex] = "incorrect";
    }

    setStatuses(newStatuses);
    setCurrentIndex(currentIndex + 1);
    setInput(value);

    // Update highscore based on the number of correct characters typed so far
    const correctCount = newStatuses.filter((s) => s === "correct").length;
    const score = `${currentLevel}.${correctCount}`;

    // Update highscore if the new count is greater
    if (
      score.split(".")[0] >= highscore.split(".")[0] &&
      parseFloat(score.split(".")[1]) > parseFloat(highscore.split(".")[1])
    ) {
      setHighscore(score);
      setShouldShake(true);
      setHighscoreUpdated(true);
      setTimeout(() => setShouldShake(false), 300); // Match the duration of animation
    }

    // Check if all the letters are correct before timer runs out
    const totalCorrect = newStatuses.filter((s) => s === "correct").length;
    if (totalCorrect === activeWordList.join(" ").length) {
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

    setActiveWordList(getRandomWords(currentLevel + 1)); // Generate random words for the next level
    setTimer(TIMER); // Reset the timer
    setInput(""); // Clear the input field
    setStatuses(Array(activeWordList.join(" ").length).fill(null)); // Reset statuses
    setCurrentIndex(0); // Reset index
    setTimerStarted(false); // Reset the timer start flag
    setGameCompleted(false); // Reset the game completed flag
  };

  const resetGame = () => {
    setHighscoreUpdated(false); // call this wherever you reset game
    setTimer(TIMER); // Reset timer
    setGameCompleted(false);
    setShowModal(false);
    setInput(""); // Reset input field
    setCurrentIndex(0); // Reset index
    setCurrentLevel(1);
    setStatuses(Array(activeWordList.join(" ").length).fill(null)); // Reset statuses
    setTimerStarted(false); // Reset timer start flag
    setActiveWordList(getRandomWords(1)); // Start with one word at level 1
  };

  return (
    <Stack
      sx={{
        justifyContent: "center",
        alignItems: "center",
        minHeight: "calc(100vh - 1.5rem)",
        background: "linear-gradient(to right, #283c86, #45a247)",
      }}>
      <Box
        sx={{
          fontFamily: "monospace",
          padding: 3,
          borderRadius: 3,
          backgroundColor: "#2e2e2e",
          width: "80%",
          maxWidth: "600px",
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
          <Typography>Time left: {timer}s</Typography>
        </Box>
        <Box sx={{ fontSize: 24, marginBottom: 2 }}>
          {activeWordList
            .join(" ")
            .split("")
            .map((char, i) => (
              <span
                key={i}
                style={{
                  color:
                    statuses[i] === "correct"
                      ? "green"
                      : statuses[i] === "incorrect"
                      ? "red"
                      : "lightgray",
                  backgroundColor:
                    statuses[i] === "correct"
                      ? "lightgreen"
                      : statuses[i] === "incorrect"
                      ? "lightcoral"
                      : "transparent",
                  padding: "2px 5px", // Add padding for better visual
                }}>
                {char}
              </span>
            ))}
        </Box>

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
              padding: "20px",
              borderRadius: "8px",
              boxShadow: 3,
              width: "300px",
              textAlign: "center",
            }}>
            <Typography
              id='modal-title'
              variant='h6'>
              So close, try again!
            </Typography>
            <Button
              onClick={resetGame}
              variant='contained'
              sx={{
                marginTop: 2,
                borderRadius: 2,
                fontSize: 16,
                backgroundColor: "#45a247",
                "&:hover": {
                  backgroundColor: "#3c8e3c",
                },
              }}>
              Try Again
            </Button>
          </Box>
        </Modal>
        {gameCompleted && (
          <Typography sx={{ color: "green", textAlign: "center" }}>🎉 All correct!</Typography>
        )}
      </Box>
      {/* Show Confetti when a level is completed */}
      {showConfetti && <Confetti />}
    </Stack>
  );
};

export default TypingGamePage;
