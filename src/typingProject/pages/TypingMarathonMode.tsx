import { useState, useEffect, useCallback } from "react";
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
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Link } from "react-router";

const DIFFICULTY_SETTINGS = {
  easy: { timer: 5, value: 10 },
  medium: { timer: 3, value: 12 },
  hard: { timer: 1, value: 15 },
  veryhard: { timer: 0.75, value: 100 },
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "#22c55e", // green
  medium: "#3b82f6", // blue
  hard: "#f97316", // orange
  veryhard: "#ef4444", // red
};

const MAX_CONSECUTIVE_ERRORS = 5;

const LEADERBOARD_KEY = "marathon_leaderboard";
const GAME_NUMBER_KEY = "marathon_game_number";
const PLAYERS_KEY = "marathon_players";

const getAllWords = () => {
  return Object.keys(wordsByLength)
    .filter((key) => !isNaN(Number(key)))
    .flatMap((key) => wordsByLength[key]);
};

const generateWords = (n: number) => {
  const sampleWords = getAllWords();
  return Array.from(
    { length: n },
    () => sampleWords[Math.floor(Math.random() * sampleWords.length)]
  );
};

export default function TypingMarathonMode() {
  const [difficulty, setDifficulty] =
    useState<keyof typeof DIFFICULTY_SETTINGS>("medium");
  const [wordList, setWordList] = useState<string[]>(generateWords(50));
  const [input, setInput] = useState("");
  const [typedChars, setTypedChars] = useState(0);
  const [incorrectChars, setIncorrectChars] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DIFFICULTY_SETTINGS["medium"].timer);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Error / loss tracking
  const [consecutiveErrors, setConsecutiveErrors] = useState(0); // incorrect words in a row
  const [lastChar, setLastChar] = useState<string | null>(null);
  const [repeatCharCount, setRepeatCharCount] = useState(0);
  const [lossReason, setLossReason] = useState<
    "timeout" | "errors" | "repeatChar" | null
  >(null);

  const [finalStats, setFinalStats] = useState({
    characters: 0,
    elapsedTime: 0,
    accuracy: 0, // percent
    rating: 0,
  });

  const computeStats = (
    finalChars: number,
    finalIncorrect: number,
    finalElapsed: number,
    diff: keyof typeof DIFFICULTY_SETTINGS
  ) => {
    const acc =
      finalChars === 0 ? 0 : (finalChars - finalIncorrect) / finalChars;
    const ratingRaw =
      finalElapsed > 0
        ? finalChars *
          (finalChars / finalElapsed) *
          acc *
          DIFFICULTY_SETTINGS[diff].value
        : 0;

    return {
      characters: finalChars,
      elapsedTime: Number(finalElapsed.toFixed(1)),
      accuracy: Number((acc * 100).toFixed(1)), // store as %
      rating: Number(ratingRaw.toFixed(2)),
    };
  };

  // Leaderboard & run tracking
  const [playerName, setPlayerName] = useState(""); // used for autocomplete & score
  const [playerOptions, setPlayerOptions] = useState<string[]>([]);
  const [leaderboard, setLeaderboard] = useState<
    {
      name: string;
      gameNumber: number;
      difficulty: string;
      characters: number;
      accuracy: number;
      elapsedTime: number;
      rating: number;
      lostBy: string | null;
      timestamp: string;
    }[]
  >([]);
  const [gameNumber, setGameNumber] = useState(1);
  const [leaderboardFilter, setLeaderboardFilter] = useState<
    "all" | "easy" | "medium" | "hard" | "veryhard"
  >("all");
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<string | null>(
    null
  );

  // Load leaderboard, game number, and players from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedLeaderboard = window.localStorage.getItem(LEADERBOARD_KEY);
    if (savedLeaderboard) {
      try {
        const parsed = JSON.parse(savedLeaderboard);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLeaderboard(parsed);

          // highlight most recent saved run overall on load
          const latestTs = parsed.reduce(
            (acc: string, e: any) =>
              e.timestamp && e.timestamp > acc ? e.timestamp : acc,
            parsed[0].timestamp
          );
          setLastSavedTimestamp(latestTs);
        }
      } catch {
        // ignore parse errors
      }
    }

    const savedGameNum = window.localStorage.getItem(GAME_NUMBER_KEY);
    if (savedGameNum) {
      try {
        const parsed = JSON.parse(savedGameNum);
        if (typeof parsed === "number" && !Number.isNaN(parsed)) {
          setGameNumber(parsed);
        }
      } catch {
        // ignore parse errors
      }
    }

    const savedPlayers = window.localStorage.getItem(PLAYERS_KEY);
    if (savedPlayers) {
      try {
        const parsed = JSON.parse(savedPlayers);
        if (Array.isArray(parsed)) {
          setPlayerOptions(parsed);
        }
      } catch {
        // ignore parse errors
      }
    }
  }, []);

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
    setConsecutiveErrors(0);
    setLastChar(null);
    setRepeatCharCount(0);
    setLossReason(null);
  };

  const handlePlayAgain = () => {
    // Increment game/run number for the next run
    setGameNumber((prev) => {
      const next = prev + 1;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(GAME_NUMBER_KEY, JSON.stringify(next));
      }
      return next;
    });

    setShowResults(false);
    resetGame();
  };

  const registerPlayerName = () => {
    const trimmed = playerName.trim().slice(0, 10);
    if (!trimmed) return;

    setPlayerName(trimmed);

    setPlayerOptions((prev) => {
      if (prev.includes(trimmed)) return prev;
      const updated = [...prev, trimmed].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
      );
      if (typeof window !== "undefined") {
        window.localStorage.setItem(PLAYERS_KEY, JSON.stringify(updated));
      }
      return updated;
    });
  };

  const saveScore = (
    reason: "timeout" | "errors" | "repeatChar",
    stats: {
      characters: number;
      elapsedTime: number;
      accuracy: number;
      rating: number;
    }
  ) => {
    const trimmedName = playerName.trim().slice(0, 10); // blank allowed
    const timestamp = new Date().toISOString();

    const entry = {
      name: trimmedName,
      gameNumber,
      difficulty,
      characters: stats.characters,
      accuracy: stats.accuracy,
      elapsedTime: stats.elapsedTime,
      rating: stats.rating,
      lostBy: reason,
      timestamp,
    };

    const updated = [...leaderboard, entry].sort((a, b) => b.rating - a.rating);

    setLeaderboard(updated);
    setLastSavedTimestamp(timestamp);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(updated));
    }
  };

  const endGame = useCallback(
    (
      reason: "timeout" | "errors" | "repeatChar",
      statsOverride?: {
        characters: number;
        elapsedTime: number;
        accuracy: number;
        rating: number;
      }
    ) => {
      const stats =
        statsOverride ??
        computeStats(typedChars, incorrectChars, elapsedTime, difficulty);

      setIsRunning(false);
      setLossReason(reason);
      setFinalStats(stats); // ← for the modal
      saveScore(reason, stats); // ← for the leaderboard
      setShowResults(true);
    },
    [saveScore]
  );

  const countMistakes = (typed: string, actual: string) => {
    let mistakes = 0;
    const minLen = Math.min(typed.length, actual.length);

    for (let i = 0; i < minLen; i++) {
      if (typed[i] !== actual[i]) mistakes++;
    }

    mistakes += Math.abs(typed.length - actual.length);
    return mistakes;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Start timer on first key press
    const startingNow = !startTime;
    if (startingNow) {
      // Register current player name when run starts
      registerPlayerName();

      const now = Date.now();
      setStartTime(now);
      setIsRunning(true);
      setTimeLeft(DIFFICULTY_SETTINGS[difficulty].timer);
    }

    if (!isRunning && !startingNow) return;

    // Detect same character pressed 3 times in a row (excluding special keys)
    if (
      e.key.length === 1 &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      e.key !== " "
    ) {
      if (e.key === lastChar) {
        const newCount = repeatCharCount + 1;
        setRepeatCharCount(newCount);
        if (newCount >= 3) {
          const stats = computeStats(
            typedChars,
            incorrectChars,
            elapsedTime,
            difficulty
          );
          endGame("repeatChar", stats);
          return;
        }
      } else {
        setLastChar(e.key);
        setRepeatCharCount(1);
      }
    }

    if (!isRunning && !startingNow) return;

    if (e.key !== "Backspace") {
      setTimeLeft(DIFFICULTY_SETTINGS[difficulty].timer);
    }

    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      const targetWord = wordList[0];
      const trimmedInput = input.trim();
      const errors = countMistakes(trimmedInput, targetWord);
      const wordChars = Math.max(trimmedInput.length, targetWord.length);

      const newIncorrect = incorrectChars + errors;
      const newChars = typedChars + wordChars;
      const isCorrect = errors === 0;
      const newConsecutiveErrors = isCorrect ? 0 : consecutiveErrors + 1;

      setIncorrectChars(newIncorrect);
      setTypedChars(newChars);
      setWordList((prev) => [...prev.slice(1), generateWords(1)[0]]);
      setInput("");
      setConsecutiveErrors(
        Math.min(newConsecutiveErrors, MAX_CONSECUTIVE_ERRORS)
      );

      // If this word triggers game over, compute stats from *new* values
      if (!isCorrect && newConsecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        const stats = computeStats(
          newChars,
          newIncorrect,
          elapsedTime,
          difficulty
        );
        endGame("errors", stats);
        return;
      }
    }
  };

  // Main timer & elapsed time
  useEffect(() => {
    if (!isRunning) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, +(prev - 0.1).toFixed(1)));
      setElapsedTime((prev) => +(prev + 0.1).toFixed(1));
    }, 100);

    return () => clearInterval(timer);
  }, [isRunning]);

  // Check for timeout loss
  useEffect(() => {
    if (!isRunning) return;
    if (timeLeft <= 0) {
      const stats = computeStats(
        typedChars,
        incorrectChars,
        elapsedTime,
        difficulty
      );
      endGame("timeout", stats);
    }
  }, [
    timeLeft,
    isRunning,
    typedChars,
    incorrectChars,
    elapsedTime,
    difficulty,
    endGame,
  ]);

  const accuracy =
    typedChars === 0 ? 0 : (typedChars - incorrectChars) / typedChars;
  const rating =
    elapsedTime > 0
      ? typedChars *
        (typedChars / elapsedTime) *
        accuracy *
        DIFFICULTY_SETTINGS[difficulty].value
      : 0;

  const timePercent = isRunning
    ? Math.max(
        0,
        Math.min(100, (timeLeft / DIFFICULTY_SETTINGS[difficulty].timer) * 100)
      )
    : 0;

  const errorPercent = Math.max(
    0,
    Math.min(100, (consecutiveErrors / MAX_CONSECUTIVE_ERRORS) * 100)
  );

  const lossMessage = (() => {
    switch (lossReason) {
      case "timeout":
        return "You ran out of time! Keep your flow going so the timer bar doesn’t empty.";
      case "errors":
        return `Too many mistakes in a row! ${MAX_CONSECUTIVE_ERRORS} incorrect words filled the error bar.`;
      case "repeatChar":
        return "You pressed the same key 3 times in a row. Try not to ‘mash’ one key!";
      default:
        return "";
    }
  })();

  const filteredLeaderboard =
    leaderboardFilter === "all"
      ? leaderboard
      : leaderboard.filter((entry) => entry.difficulty === leaderboardFilter);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#0f172a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Top bar with Back button */}
      <Box
        width="100%"
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        sx={{
          bgcolor: "#1e293b",
          px: 2,
          py: 2,
        }}
      >
        <Link to={"../typing"}>
          <Button
            variant="text"
            sx={{
              color: "#facc15",
              textTransform: "none",
              fontWeight: "bold",
              fontSize: "1rem",
              "&:hover": { color: "#fde047" },
            }}
          >
            ← Back
          </Button>
        </Link>
      </Box>

      <Container
        maxWidth={false}
        sx={{
          py: 4,
          flexGrow: 1,
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: { xs: "center", md: "space-between" },
            alignItems: { xs: "center", md: "flex-start" },
            flexDirection: { xs: "column-reverse", md: "row" },
            gap: 3,
          }}
        >
          {/* LEFT COLUMN – Leaderboard */}
          <Box
            sx={{
              width: { xs: "100%", md: "300px" },
              bgcolor: "#0f172a",
              color: "#e2e8f0",
              borderRadius: 2,
              border: "1px solid #1e293b",
              p: 2,
            }}
          >
            <Typography
              variant="h6"
              sx={{ color: "#facc15", mb: 1, fontSize: "1rem" }}
            >
              🏆 Leaderboard
            </Typography>

            {leaderboard.length === 0 ? (
              <Typography variant="body2" sx={{ color: "#94a3b8" }}>
                No scores yet. Finish a run to add your first score.
              </Typography>
            ) : (
              <>
                <Tabs
                  value={leaderboardFilter}
                  onChange={(_, val) =>
                    setLeaderboardFilter(
                      val as "all" | "easy" | "medium" | "hard" | "veryhard"
                    )
                  }
                  variant="fullWidth"
                  textColor="inherit"
                  indicatorColor="secondary"
                  sx={{
                    minHeight: 28,
                    mb: 1,
                    "& .MuiTab-root": {
                      minHeight: 28,
                      fontSize: "0.7rem",
                      textTransform: "none",
                      padding: 0,
                      minWidth: 0,
                    },
                  }}
                >
                  <Tab disableRipple label="All" value="all" />
                  <Tab disableRipple label="Easy" value="easy" />
                  <Tab disableRipple label="Medium" value="medium" />
                  <Tab disableRipple label="Hard" value="hard" />
                  <Tab disableRipple label="Very Hard" value="veryhard" />
                </Tabs>

                {filteredLeaderboard.length === 0 ? (
                  <Typography variant="body2" sx={{ color: "#94a3b8", mt: 1 }}>
                    No scores for this difficulty yet.
                  </Typography>
                ) : (
                  <Box
                    sx={{
                      fontSize: "0.85rem",
                      maxHeight: 400,
                      overflowY: "auto",
                      scrollbarWidth: "none", // Firefox
                      msOverflowStyle: "none", // IE/Edge
                      "&::-webkit-scrollbar": {
                        display: "none", // Chrome, Safari, etc.
                      },
                    }}
                  >
                    {filteredLeaderboard.slice(0, 40).map((entry, index) => {
                      const difficultyColor =
                        DIFFICULTY_COLORS[entry.difficulty] || "#64748b";

                      let displayName = entry.name || "";
                      if (displayName.toLowerCase() === "anon") {
                        displayName = "";
                      }
                      if (displayName.length > 10) {
                        displayName = displayName.slice(0, 10) + "…";
                      }

                      const isLatest =
                        lastSavedTimestamp &&
                        entry.timestamp === lastSavedTimestamp;

                      return (
                        <Accordion
                          key={`${entry.timestamp}-${index}`}
                          disableGutters
                          square
                          sx={{
                            bgcolor: isLatest ? "#02091f" : "#020617",
                            color: "#e2e8f0",
                            borderBottom: "1px solid #1e293b",
                            boxShadow: "none",
                            "&:before": { display: "none" },
                            borderLeft: `4px solid ${difficultyColor}`,
                            outline: isLatest
                              ? "1px solid #facc15"
                              : "1px solid transparent",
                          }}
                        >
                          <AccordionSummary
                            expandIcon={
                              <ExpandMoreIcon sx={{ color: "#e5e7eb" }} />
                            }
                            sx={{
                              minHeight: 32,
                              "& .MuiAccordionSummary-content": {
                                margin: 0,
                                alignItems: "center",
                              },
                              "& .MuiAccordionSummary-content.Mui-expanded": {
                                margin: 0,
                              },
                            }}
                          >
                            <Box
                              sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                width: "100%",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <Box
                                sx={{
                                  fontSize: "0.8rem",
                                  wordBreak: "break-word",
                                  flexGrow: 1,
                                }}
                              >
                                {index + 1}.
                                {/* space + name + run in parens if name exists */}
                                {displayName &&
                                  "  " +
                                    `${displayName}` +
                                    ` (${entry.gameNumber})`}
                                {entry.lostBy !== "timeout"
                                  ? `[${entry.lostBy}]`
                                  : ""}
                              </Box>
                              <Box
                                sx={{
                                  fontSize: "0.8rem",
                                  textAlign: "right",
                                  flexShrink: 0,
                                }}
                              >
                                {entry.rating.toFixed(2)}
                              </Box>
                            </Box>
                          </AccordionSummary>

                          <AccordionDetails
                            sx={{ pt: 0.5, pb: 1.5, fontSize: "0.75rem" }}
                          >
                            <Box
                              sx={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 0.25,
                                color: "#cbd5f5",
                              }}
                            >
                              <span>Chars: {entry.characters}</span>
                              <span>Accuracy: {entry.accuracy}%</span>
                              <span>Time: {entry.elapsedTime}s</span>
                              {entry.lostBy && (
                                <span>Lost by: {entry.lostBy}</span>
                              )}
                              <span>Run: #{entry.gameNumber}</span>
                              <span>
                                Played:{" "}
                                {new Date(entry.timestamp).toLocaleString()}
                              </span>
                            </Box>
                          </AccordionDetails>
                        </Accordion>
                      );
                    })}
                  </Box>
                )}
              </>
            )}
          </Box>

          {/* RIGHT COLUMN – Game UI */}
          <Box
            id={"right-col"}
            sx={{
              width: { xs: "100%", md: "50%" },
              bgcolor: "#0f172a",
              color: "#e2e8f0",
              borderRadius: 2,
              p: 3,
              border: "1px solid #1e293b",
              display: "flex",
              flexDirection: "column",
              gap: 3,
              alignItems: "center",
            }}
          >
            <Typography
              variant="h4"
              fontWeight="bold"
              gutterBottom
              sx={{ color: "#facc15" }}
            >
              Marathon Mode
            </Typography>

            {/* Player name autocomplete */}
            <Autocomplete
              freeSolo
              options={playerOptions}
              value={playerName}
              onChange={(_, newValue) => {
                const val = (newValue || "").slice(0, 10);
                setPlayerName(val);
              }}
              onInputChange={(_, newInputValue) => {
                const val = (newInputValue || "").slice(0, 10);
                setPlayerName(val);
              }}
              sx={{ width: "100%", maxWidth: 260 }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Player Name"
                  size="small"
                  InputLabelProps={{ sx: { color: "#facc15" } }}
                  sx={{
                    "& .MuiInputBase-root": {
                      bgcolor: "#1e293b",
                      color: "#f1f5f9",
                    },
                  }}
                />
              )}
            />

            {/* Timer bar */}
            <Box
              width="100%"
              sx={{
                bgcolor: "#1e293b",
                borderRadius: 1,
                overflow: "hidden",
                height: 10,
                position: "relative",
              }}
            >
              <Box
                sx={{
                  width: `${timePercent}%`,
                  height: "100%",
                  bgcolor:
                    timePercent < 25
                      ? "#8b3a3a"
                      : timePercent < 50
                      ? "#8a7234"
                      : "#475569",
                  transition: "width 0.1s linear",
                  borderTopLeftRadius: 4,
                  borderBottomLeftRadius: 4,
                }}
              />
            </Box>

            {/* Error bar */}
            <Box
              width="100%"
              sx={{
                bgcolor: "#1e293b",
                borderRadius: 1,
                overflow: "hidden",
                height: 6,
                position: "relative",
              }}
            >
              <Box
                sx={{
                  width: `${errorPercent}%`,
                  height: "100%",
                  bgcolor: "#b91c1c",
                  transition: "width 0.2s ease-out",
                  borderTopLeftRadius: 4,
                  borderBottomLeftRadius: 4,
                }}
              />
            </Box>

            <FormControl
              sx={{ minWidth: 120, alignSelf: "flex-start" }}
              size="small"
            >
              <InputLabel sx={{ color: "#facc15" }}>Difficulty</InputLabel>
              <Select
                value={difficulty}
                label="Difficulty"
                onChange={(e) => {
                  const newDiff = e.target
                    .value as keyof typeof DIFFICULTY_SETTINGS;
                  setDifficulty(newDiff);
                  setTimeLeft(DIFFICULTY_SETTINGS[newDiff].timer);
                }}
                sx={{ color: "#e2e8f0", borderColor: "#facc15" }}
              >
                <MenuItem value="easy">Easy</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="hard">Hard</MenuItem>
                <MenuItem value="veryhard">Very Hard</MenuItem>
              </Select>
            </FormControl>

            <Paper
              variant="outlined"
              sx={{
                width: "100%",
                height: 60,
                p: 2,
                overflow: "hidden",
                whiteSpace: "nowrap",
                bgcolor: "#1e293b",
                color: "#f1f5f9",
                borderColor: "#94a3b8",
              }}
            >
              {wordList.map((w, i) => (
                <Box
                  key={i}
                  component="span"
                  sx={{
                    color: i === 0 ? "#4ade80" : "#f1f5f9",
                    fontWeight: i === 0 ? 600 : 400,
                    mr: 1,
                  }}
                >
                  {w}
                </Box>
              ))}
            </Paper>

            <TextField
              fullWidth
              variant="outlined"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Start typing here..."
              sx={{
                input: { fontSize: "1.25rem", color: "#f1f5f9" },
                bgcolor: "#1e293b",
                borderRadius: 1,
              }}
            />
          </Box>

          {/* RIGHT-MOST COLUMN – Stats */}
          <Box
            id="stats"
            display="flex"
            flexDirection={"column"}
            alignItems={"center"}
            maxWidth={"20%"}
            width="100%"
            fontFamily="monospace"
            flexWrap="wrap"
            rowGap={1}
          >
            <div>
              <Typography variant={"h4"} color="info" fontWeight={"bold"}>
                Rating:{rating.toFixed(2)}
              </Typography>
            </div>
            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "row", md: "column" },
                gap: "20px",
              }}
            >
              <Typography>
                Run: <strong>#{gameNumber}</strong>
              </Typography>
              <Typography>
                Time Elapsed: <strong>{elapsedTime.toFixed(1)}s</strong>
              </Typography>
              <Box>
                <strong>Characters Seen:</strong> {typedChars}
              </Box>
              <Box>
                <strong>Accuracy:</strong> {(accuracy * 100).toFixed(1)}%
              </Box>
            </Box>
          </Box>
        </Box>
      </Container>

      {/* Game Over Modal */}
      <Modal
        open={showResults}
        onClose={() => setShowResults(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handlePlayAgain();
          }
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 320,
            bgcolor: "#1e293b",
            color: "#f1f5f9",
            borderRadius: 2,
            boxShadow: 24,
            p: 4,
            textAlign: "center",
          }}
        >
          <Typography
            variant="h6"
            fontWeight="bold"
            gutterBottom
            color="#facc15"
          >
            Game Over
          </Typography>
          {lossMessage && (
            <Typography
              variant="body2"
              sx={{ mb: 2, color: "#fecaca", fontStyle: "italic" }}
            >
              {lossMessage}
            </Typography>
          )}
          <Typography>
            Characters Seen: <strong>{finalStats.characters}</strong>
          </Typography>
          <Typography>
            Time Elapsed: <strong>{finalStats.elapsedTime.toFixed(1)}s</strong>
          </Typography>
          <Typography>
            Accuracy: <strong>{finalStats.accuracy.toFixed(1)}%</strong>
          </Typography>
          <Typography gutterBottom>
            Final Rating: <strong>{finalStats.rating.toFixed(2)}</strong>
          </Typography>

          <TextField
            fullWidth
            label="Player"
            variant="outlined"
            size="small"
            value={playerName}
            disabled
            sx={{
              mt: 2,
              mb: 1,
              "& .MuiInputBase-root": {
                bgcolor: "#0f172a",
                color: "#f1f5f9",
              },
              "& .MuiInputLabel-root": {
                color: "#e5e7eb",
              },
            }}
          />

          <Button
            variant="contained"
            fullWidth
            onClick={handlePlayAgain}
            sx={{
              mt: 1,
              bgcolor: "#3b82f6",
              "&:hover": { bgcolor: "#2563eb" },
            }}
          >
            Play Again
          </Button>
        </Box>
      </Modal>
    </Box>
  );
}
