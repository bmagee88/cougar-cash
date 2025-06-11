import { useState, useEffect, useRef } from "react";
import { words as wordsByLength } from "typingProject/resources/staticData";
import {
  Box,
  Button,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Paper,
  Modal,
} from "@mui/material";
import { Link } from "react-router";

const DIFFICULTY_SETTINGS = {
  easy: { timer: 5, value: 10 },
  medium: { timer: 3, value: 12 },
  hard: { timer: 1, value: 15 },
  veryhard: { timer: 0.75, value: 100 },
};

const getAllWords = () => {
  return Object.keys(wordsByLength)
    .filter((key) => !isNaN(Number(key)))
    .flatMap((key) => wordsByLength[key]);
};

const generateWords = (n) => {
  const sampleWords = getAllWords();
  return Array.from(
    { length: n },
    () => sampleWords[Math.floor(Math.random() * sampleWords.length)]
  );
};

export default function TypingMarathonMode() {
  const [difficulty, setDifficulty] = useState("medium");
  const [wordList, setWordList] = useState(generateWords(50));
  const [input, setInput] = useState("");
  const [typedChars, setTypedChars] = useState(0);
  const [incorrectChars, setIncorrectChars] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DIFFICULTY_SETTINGS[difficulty].timer);
  const [startTime, setStartTime] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  const timerRef = useRef(null);

  const resetGame = () => {
    setWordList(generateWords(50));
    setElapsedTime(0);
    setInput("");
    setTypedChars(0);
    setIncorrectChars(0);
    setStartTime(null);
    setTimeLeft(DIFFICULTY_SETTINGS[difficulty].timer);
    setIsRunning(false);
    setShowResults(false);
  };

  const handleKeyDown = (e) => {
    if (!startTime) {
      const now = Date.now();
      setStartTime(now);
      setIsRunning(true);
      setTimeLeft(DIFFICULTY_SETTINGS[difficulty].timer);
    }

    if (!isRunning) return;

    if (e.key !== "Backspace") {
      setTimeLeft(DIFFICULTY_SETTINGS[difficulty].timer);
    }

    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      const targetWord = wordList[0];
      const trimmedInput = input.trim();
      const errors = countMistakes(trimmedInput, targetWord);
      setIncorrectChars((prev) => prev + errors);
      setTypedChars((prev) => prev + Math.max(trimmedInput.length, targetWord.length));
      setWordList((prev) => [...prev.slice(1), generateWords(1)[0]]);
      setInput("");
    }
  };

  const countMistakes = (typed, actual) => {
    let mistakes = 0;
    const minLen = Math.min(typed.length, actual.length);

    // Count character mismatches up to the shorter length
    for (let i = 0; i < minLen; i++) {
      if (typed[i] !== actual[i]) mistakes++;
    }

    // Add difference in length as mistakes (extra/missing chars)
    mistakes += Math.abs(typed.length - actual.length);

    return mistakes;
  };

  useEffect(() => {
    if (!isRunning) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, +(prev - 0.1).toFixed(1)));
      setElapsedTime((prev) => +(prev + 0.1).toFixed(1));
    }, 100);

    return () => clearInterval(timer);
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning) return;
    if (timeLeft <= 0) {
      setIsRunning(false);
      setShowResults(true);
      return;
    }

    timerRef.current = setTimeout(() => {
      setTimeLeft((prev) => Math.max(0, +(prev - 0.1).toFixed(1)));
    }, 100);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timeLeft, isRunning]);

  const accuracy = typedChars === 0 ? 0 : (typedChars - incorrectChars) / typedChars;
  const rating =
    elapsedTime > 0
      ? typedChars * (typedChars / elapsedTime) * accuracy * DIFFICULTY_SETTINGS[difficulty].value
      : 0;
  const timePercent = isRunning
    ? Math.max(0, Math.min(100, (timeLeft / DIFFICULTY_SETTINGS[difficulty].timer) * 100))
    : 0;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#0f172a", // match the main container
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}>
      <Box
        width='100%'
        display='flex'
        justifyContent='space-between'
        alignItems='start'
        sx={{
          bgcolor: "#1e293b",
          borderRadius: 1,
          px: 2,
          mt: "-4.5rem",
        }}>
        <Link to={"../typing"}>
          <Button
            variant='text'
            sx={{
              color: "#facc15",
              textTransform: "none",
              fontWeight: "bold",
              fontSize: "1rem",
              "&:hover": { color: "#fde047" },
            }}>
            ← Back
          </Button>
        </Link>
      </Box>
      <Container
        maxWidth='md'
        sx={{
          py: 6,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 3,
          bgcolor: "#0f172a",
          color: "#e2e8f0",
          borderRadius: 2,
        }}>
        <Typography
          variant='h4'
          fontWeight='bold'
          gutterBottom
          sx={{ color: "#facc15" }}>
          🔥 Marathon Mode 🔥
        </Typography>

        <Box
          width='100%'
          sx={{
            bgcolor: "#1e293b",
            borderRadius: 1,
            overflow: "hidden",
            height: 10,
            position: "relative",
          }}>
          <Box
            sx={{
              width: `${timePercent}%`,
              height: "100%",
              bgcolor:
                timePercent < 25
                  ? "#8b3a3a" // darker muted red
                  : timePercent < 50
                  ? "#8a7234" // darker golden/mustard
                  : "#475569", // darker slate gray

              transition: "width 0.1s linear",
              borderTopLeftRadius: 4,
              borderBottomLeftRadius: 4,
            }}
          />
        </Box>

        <FormControl
          sx={{ minWidth: 120 }}
          size='small'>
          <InputLabel sx={{ color: "#facc15" }}>Difficulty</InputLabel>
          <Select
            value={difficulty}
            label='Difficulty'
            onChange={(e) => {
              const newDiff = e.target.value;
              setDifficulty(newDiff);
              setTimeLeft(DIFFICULTY_SETTINGS[newDiff].timer);
            }}
            sx={{ color: "#e2e8f0", borderColor: "#facc15" }}>
            <MenuItem value='easy'>Easy</MenuItem>
            <MenuItem value='medium'>Medium</MenuItem>
            <MenuItem value='hard'>Hard</MenuItem>
            <MenuItem value='veryhard'>Very Hard</MenuItem>
          </Select>
        </FormControl>

        <Paper
          variant='outlined'
          sx={{
            width: "100%",
            maxWidth: "90%",
            height: 60,
            p: 2,
            overflow: "hidden",
            whiteSpace: "nowrap",
            bgcolor: "#1e293b",
            color: "#f1f5f9",
            borderColor: "#94a3b8",
          }}>
          {wordList.map((w, i) => (
            <Box
              key={i}
              component='span'
              sx={{
                color: i === 0 ? "#4ade80" : "#f1f5f9",
                fontWeight: i === 0 ? 600 : 400,
                mr: 1,
              }}>
              {w}
            </Box>
          ))}
        </Paper>

        <TextField
          fullWidth
          variant='outlined'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Start typing here...'
          sx={{
            input: { fontSize: "1.25rem", color: "#f1f5f9" },
            bgcolor: "#1e293b",
            borderRadius: 1,
          }}
        />

        <Box
          display='flex'
          justifyContent='space-between'
          width='100%'
          fontFamily='monospace'>
          <Typography>
            Time Elapsed: <strong>{elapsedTime.toFixed(1)}s</strong>
          </Typography>
          <div>
            <strong>Characters Seen:</strong> {typedChars}
          </div>
          <div>
            <strong>Accuracy:</strong> {(accuracy * 100).toFixed(1)}%
          </div>
          <div>
            <strong>Rating:</strong> {rating.toFixed(2)}
          </div>
        </Box>

        <Modal
          open={showResults}
          onClose={() => setShowResults(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setShowResults(false);
              resetGame();
            }
          }}>
          <Box
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 300,
              bgcolor: "#1e293b",
              color: "#f1f5f9",
              borderRadius: 2,
              boxShadow: 24,
              p: 4,
              textAlign: "center",
            }}>
            <Typography
              variant='h6'
              fontWeight='bold'
              gutterBottom
              color='#facc15'>
              Game Over
            </Typography>
            <Typography>
              Characters Seen: <strong>{typedChars}</strong>
            </Typography>
            <Typography>
              Time Elapsed: <strong>{elapsedTime.toFixed(1)}s</strong>
            </Typography>
            <Typography>
              Accuracy: <strong>{(accuracy * 100).toFixed(1)}%</strong>
            </Typography>
            <Typography gutterBottom>
              Final Rating: <strong>{rating.toFixed(2)}</strong>
            </Typography>
            <Button
              variant='contained'
              fullWidth
              onClick={resetGame}
              sx={{ mt: 2, bgcolor: "#3b82f6", "&:hover": { bgcolor: "#2563eb" } }}>
              Play Again
            </Button>
          </Box>
        </Modal>
      </Container>
    </Box>
  );
}
