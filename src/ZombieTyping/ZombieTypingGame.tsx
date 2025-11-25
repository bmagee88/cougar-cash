import React, {
  useState,
  useEffect,
  useRef,
  KeyboardEvent,
} from "react";
import {
  Box,
  Button,
  Container,
  LinearProgress,
  Paper,
  TextField,
  Typography,
  Stack,
} from "@mui/material";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// Larger word list; covers all letters A–Z multiple times
const WORDS = [
  "apple",
  "armor",
  "anchor",
  "bat",
  "blast",
  "boxing",
  "blaze",
  "castle",
  "cactus",
  "coding",
  "crystal",
  "dragon",
  "desert",
  "dizzy",
  "eagle",
  "energy",
  "engine",
  "forest",
  "flame",
  "fuzzy",
  "galaxy",
  "glitch",
  "ghost",
  "goblin",
  "horizon",
  "hunter",
  "hazard",
  "igloo",
  "inbox",
  "island",
  "jigsaw",
  "jungle",
  "jacket",
  "kayak",
  "knight",
  "keypad",
  "lantern",
  "lizard",
  "level",
  "matrix",
  "magic",
  "meteor",
  "ninja",
  "nebula",
  "night",
  "oxygen",
  "obelisk",
  "orbit",
  "pixel",
  "portal",
  "puzzle",
  "quartz",
  "quest",
  "quiver",
  "rocket",
  "rhythm",
  "radius",
  "shield",
  "shadow",
  "squeaky",
  "tunnel",
  "turret",
  "thunder",
  "umbrella",
  "uplink",
  "unicorn",
  "vortex",
  "vampire",
  "vector",
  "wizard",
  "whisper",
  "window",
  "xylophone",
  "xenon",
  "xray",
  "yonder",
  "yellow",
  "yogurt",
  "zebra",
  "zodiac",
  "zombie",
];

const TICK_MS = 80;
const BASE_SPEED = 0.001;        // slow zombies
const SPEED_PER_WAVE = 0.00075;  // slow ramp
const BULLET_SPEED = 0.03;       // slow bullet for visible travel
const ZOMBIE_KILL_POINTS = 10;
const PERFECT_WORD_POINTS = 50;

type ColumnLetter = (typeof LETTERS)[number];

interface Zombie {
  id: number;
  column: ColumnLetter;
  y: number; // 0 = top, 1 = bottom
  hp: number;
  maxHp: number;
}

interface Bullet {
  id: number;
  column: ColumnLetter;
  y: number; // starts near bottom, moves up (towards 0)
}

const createInitialMatchMask = (word: string): boolean[] =>
  Array(word.length).fill(false);

// Safe helper: compute next word using arrays/index loops (no for-of on Set)
// Prefers words that:
// 1) Use at least one unused letter (if any unused remain)
// 2) Use at least one active zombie column letter (if any zombies exist)
// 3) Among candidates, maximizes the number of unused letters used
const computeNextWord = (
  unusedLetters: Set<string>,
  activeZombieLetters: Set<string>
): { word: string; nextUnused: Set<string> } => {
  let candidates = WORDS;

  if (unusedLetters.size > 0) {
    const filtered: string[] = [];
    for (let i = 0; i < WORDS.length; i++) {
      const w = WORDS[i];
      const lettersSet = new Set(w.toUpperCase());
      const lettersArr = Array.from(lettersSet);

      let usesUnused = false;
      for (let j = 0; j < lettersArr.length; j++) {
        const ch = lettersArr[j];
        if (unusedLetters.has(ch)) {
          usesUnused = true;
          break;
        }
      }
      if (usesUnused) {
        filtered.push(w);
      }
    }
    if (filtered.length > 0) {
      candidates = filtered;
    }
  }

  if (activeZombieLetters.size > 0) {
    const filtered: string[] = [];
    for (let i = 0; i < candidates.length; i++) {
      const w = candidates[i];
      const lettersSet = new Set(w.toUpperCase());
      const lettersArr = Array.from(lettersSet);

      let usesActive = false;
      for (let j = 0; j < lettersArr.length; j++) {
        const ch = lettersArr[j];
        if (activeZombieLetters.has(ch)) {
          usesActive = true;
          break;
        }
      }
      if (usesActive) {
        filtered.push(w);
      }
    }

    if (filtered.length > 0) {
      candidates = filtered;
    }
  }

  let best: string[] = [];
  let bestScore = -1;

  for (let i = 0; i < candidates.length; i++) {
    const w = candidates[i];
    const lettersSet = new Set(w.toUpperCase());
    const lettersArr = Array.from(lettersSet);

    let score = 0;
    for (let j = 0; j < lettersArr.length; j++) {
      const ch = lettersArr[j];
      if (unusedLetters.has(ch)) {
        score++;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = [w];
    } else if (score === bestScore) {
      best.push(w);
    }
  }

  const chosen =
    best.length > 0
      ? best[Math.floor(Math.random() * best.length)]
      : WORDS[0];

  const nextUnused = new Set<string>(unusedLetters);
  const wordUpper = chosen.toUpperCase();

  for (let i = 0; i < wordUpper.length; i++) {
    nextUnused.delete(wordUpper[i]);
  }

  return { word: chosen, nextUnused };
};

const ZombieTypingGame: React.FC = () => {
  const [zombies, setZombies] = useState<Zombie[]>([]);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [wave, setWave] = useState(1);
  const [lives, setLives] = useState(3);
  const [hasStarted, setHasStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const [wordQueue, setWordQueue] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0); // index in current word
  const [matchMask, setMatchMask] = useState<boolean[]>([]);
  const [displayInput, setDisplayInput] = useState<string>("");

  const [score, setScore] = useState(0);
  const [waveBanner, setWaveBanner] = useState<string | null>(null);

  const unusedLettersRef = useRef<Set<string>>(new Set(LETTERS));
  const firstRunRef = useRef(true);

  const boardHeight = 420;

  const resetUnusedLetters = () => {
    unusedLettersRef.current = new Set(LETTERS);
  };

  const getActiveZombieLetters = (): Set<string> => {
    const active = new Set<string>();
    for (let i = 0; i < zombies.length; i++) {
      active.add(zombies[i].column);
    }
    return active;
  };

  const pickNextWordString = (): string => {
    let currentUnused = unusedLettersRef.current;
    if (currentUnused.size === 0) {
      currentUnused = new Set(LETTERS);
    }

    const activeZombieLetters = getActiveZombieLetters();
    const { word, nextUnused } = computeNextWord(
      currentUnused,
      activeZombieLetters
    );
    unusedLettersRef.current = nextUnused;
    return word;
  };

  const bootstrapWordQueue = (count: number) => {
    const queue: string[] = [];
    for (let i = 0; i < count; i++) {
      queue.push(pickNextWordString());
    }
    return queue;
  };

  const resetWords = () => {
    resetUnusedLetters();
    const initialQueue = bootstrapWordQueue(6);
    setWordQueue(initialQueue);
    setCurrentIndex(0);
    setMatchMask(createInitialMatchMask(initialQueue[0]));
    setDisplayInput("");
  };

  const resetGame = () => {
    setWave(1);
    setLives(3);
    setHasStarted(false);
    setGameOver(false);
    setZombies([]);
    setBullets([]);
    setScore(0);
    resetWords();
    setWaveBanner(null);
    firstRunRef.current = true;
  };

  const spawnWave = (waveNumber: number) => {
    const count = 4 + waveNumber * 3;
    const hpBase = 1;

    const now = Date.now();
    const newZombies: Zombie[] = [];

    for (let i = 0; i < count; i++) {
      const columnIndex = Math.floor(Math.random() * LETTERS.length);
      newZombies.push({
        id: now + i,
        column: LETTERS[columnIndex] as ColumnLetter,
        y: Math.random() * -0.6,
        hp: hpBase,
        maxHp: hpBase,
      });
    }

    setZombies(newZombies);
    setBullets([]);
  };

  const showWaveBanner = (waveNumber: number) => {
    setWaveBanner(`Wave ${waveNumber}`);
    window.setTimeout(() => {
      setWaveBanner((current) => {
        if (current === `Wave ${waveNumber}`) return null;
        return current;
      });
    }, 2000);
  };

  const startGame = () => {
    resetGame();
    setHasStarted(true);
    spawnWave(1);
    showWaveBanner(1);
  };

  const handleLetterKey = (rawKey: string) => {
    if (!hasStarted || gameOver) return;
    if (wordQueue.length === 0) return;

    const currentWord = wordQueue[0];
    if (currentIndex >= currentWord.length) return;

    const letter = rawKey.toLowerCase();
    const expected = currentWord[currentIndex].toLowerCase();

    setMatchMask((prev) => {
      const next = [...prev];
      next[currentIndex] = letter === expected;
      return next;
    });

    setDisplayInput((prev) => prev + rawKey.toLowerCase());

    if (letter === expected) {
      const upper = letter.toUpperCase();
      const idx = LETTERS.indexOf(upper);
      if (idx !== -1) {
        const column = LETTERS[idx] as ColumnLetter;
        const now = Date.now();
        setBullets((prev) => [
          ...prev,
          {
            id: now,
            column,
            y: 0.96,
          },
        ]);
      }
    }

    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);

    if (nextIndex >= currentWord.length) {
      setMatchMask((finalMask) => {
        const wasPerfect =
          finalMask.length === currentWord.length &&
          finalMask.every((v) => v);

        if (wasPerfect) {
          setScore((prevScore) => prevScore + PERFECT_WORD_POINTS);
        }

        setWordQueue((prevQueue) => {
          const newQueue = prevQueue.slice(1);
          newQueue.push(pickNextWordString());
          const newCurrentWord = newQueue[0];
          setCurrentIndex(0);
          setMatchMask(createInitialMatchMask(newCurrentWord));
          setDisplayInput("");
          return newQueue;
        });

        return finalMask;
      });
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (gameOver) return;

    if (e.key === "Backspace") {
      e.preventDefault();
      return;
    }

    if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault();
      handleLetterKey(e.key);
      return;
    }
  };

  useEffect(() => {
    if (!hasStarted || gameOver) return;

    const intervalId = window.setInterval(() => {
      const speed = BASE_SPEED + wave * SPEED_PER_WAVE;

      let movedZombies: Zombie[] = [];
      let lifeLost = 0;

      for (let i = 0; i < zombies.length; i++) {
        const z = zombies[i];
        const newY = z.y + speed;
        if (newY >= 1) {
          lifeLost += 1;
        } else {
          movedZombies.push({ ...z, y: newY });
        }
      }

      if (lifeLost > 0) {
        setLives((currentLives) => {
          const newLives = currentLives - lifeLost;
          if (newLives <= 0) {
            setGameOver(true);
            return 0;
          }
          return newLives;
        });
      }

      let killsThisTick = 0;

      setBullets((prevBullets) => {
        let zList = movedZombies.map((z) => ({ ...z }));
        const bulletsNext: Bullet[] = [];

        for (let i = 0; i < prevBullets.length; i++) {
          const b = prevBullets[i];
          const oldY = b.y;
          const newY = b.y - BULLET_SPEED;

          if (newY < -0.1) {
            continue;
          }

          let didHit = false;
          const hits: { z: Zombie; idx: number }[] = [];

          for (let j = 0; j < zList.length; j++) {
            const z = zList[j];
            if (
              z.column === b.column &&
              z.y <= oldY &&
              z.y >= newY &&
              z.y >= 0
            ) {
              hits.push({ z, idx: j });
            }
          }

          if (hits.length > 0) {
            didHit = true;
            hits.sort((a, b2) => a.z.y - b2.z.y);
            const { z, idx } = hits[0];
            const originalHp = z.hp;
            const newHp = z.hp - 1;
            zList[idx] = { ...z, hp: newHp };
            if (newHp <= 0 && originalHp > 0) {
              killsThisTick++;
            }
          }

          if (!didHit) {
            bulletsNext.push({ ...b, y: newY });
          }
        }

        movedZombies = [];
        for (let i = 0; i < zList.length; i++) {
          const z = zList[i];
          if (z.hp > 0) movedZombies.push(z);
        }
        setZombies(movedZombies);

        return bulletsNext;
      });

      if (killsThisTick > 0) {
        setScore((prev) => prev + killsThisTick * ZOMBIE_KILL_POINTS);
      }
    }, TICK_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [hasStarted, gameOver, wave, zombies]);

  useEffect(() => {
    if (!hasStarted || gameOver) return;

    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }

    if (zombies.length === 0) {
      setWave((prevWave) => {
        const nextWave = prevWave + 1;
        spawnWave(nextWave);
        showWaveBanner(nextWave);
        return nextWave;
      });
    }
  }, [zombies.length, hasStarted, gameOver]); // eslint-disable-line react-hooks/exhaustive-deps

  const getColumnXPercent = (letter: ColumnLetter) => {
    const index = LETTERS.indexOf(letter);
    return ((index + 0.5) / LETTERS.length) * 100;
  };

  const currentWord = wordQueue[0] ?? "";
  const remainingWords = wordQueue.slice(1);

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* HUD */}
      <Box
        sx={{
          mb: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "stretch",
          gap: 2,
        }}
      >
        <Box
          sx={{
            flex: 1,
            p: 1.5,
            borderRadius: 2,
            bgcolor: "#111827",
            border: "1px solid rgba(248,113,113,0.6)",
          }}
        >
          <Typography
            variant="h4"
            fontWeight="bold"
            sx={{
              color: "#f97373",
              textShadow: "0 0 12px rgba(248,113,113,0.8)",
            }}
          >
            🧟‍♂️ ZOMBIE TYPING APOCALYPSE
          </Typography>
          <Typography variant="body2" sx={{ color: "#e5e7eb", mt: 0.5 }}>
            Type each word in order. Every correct letter fires a shot. No
            backspace. Survive as long as you can.
          </Typography>
        </Box>

        <Box
          sx={{
            minWidth: 190,
            p: 1.5,
            borderRadius: 2,
            bgcolor: "#020617",
            border: "1px solid rgba(148,163,184,0.7)",
            display: "flex",
            flexDirection: "column",
            gap: 0.5,
          }}
        >
          <Typography
            variant="caption"
            sx={{ color: "#9ca3af", textTransform: "uppercase" }}
          >
            Status
          </Typography>
          <Box display="flex" justifyContent="space-between">
            <Typography sx={{ color: "#e5e7eb" }}>Wave</Typography>
            <Typography sx={{ color: "#f97373", fontWeight: 700 }}>
              {wave}
            </Typography>
          </Box>
          <Box display="flex" justifyContent="space-between">
            <Typography sx={{ color: "#e5e7eb" }}>Lives</Typography>
            <Typography sx={{ color: "#4ade80", fontWeight: 700 }}>
              {lives}
            </Typography>
          </Box>
          <Box display="flex" justifyContent="space-between">
            <Typography sx={{ color: "#e5e7eb" }}>Score</Typography>
            <Typography sx={{ color: "#60a5fa", fontWeight: 700 }}>
              {score}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Game board */}
      <Paper
        elevation={6}
        sx={{
          p: 2,
          mb: 2,
          borderRadius: 3,
          background:
            "radial-gradient(circle at top, #4b5563 0, #020617 50%, #000000 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(to bottom, rgba(248,113,113,0.35), transparent 40%)",
            pointerEvents: "none",
            mixBlendMode: "screen",
          }}
        />

        <Box
          sx={{
            position: "relative",
            height: boardHeight,
            borderRadius: 2,
            border: "1px solid rgba(248,113,113,0.4)",
            overflow: "hidden",
          }}
        >
          {zombies.map((z) => {
            const xPercent = getColumnXPercent(z.column);
            const yPercent = Math.min(100, Math.max(0, z.y * 100));
            return (
              <Box
                key={z.id}
                sx={{
                  position: "absolute",
                  left: `${xPercent}%`,
                  top: `${yPercent}%`,
                  transform: "translate(-50%, -50%)",
                  textAlign: "center",
                  pointerEvents: "none",
                }}
              >
                <Box sx={{ mb: 0.5 }}>
                  <Box
                    sx={{
                      width: 28,
                      borderRadius: 999,
                      bgcolor: "rgba(31,41,55,0.9)",
                      overflow: "hidden",
                    }}
                  >
                    <LinearProgress
                      variant="determinate"
                      value={(z.hp / z.maxHp) * 100}
                      sx={{
                        height: 4,
                        "& .MuiLinearProgress-bar": {
                          backgroundColor: "#f97373",
                          transition: "width 120ms linear",
                        },
                      }}
                    />
                  </Box>
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: 20,
                    textShadow: "0 0 8px rgba(248,250,252,0.9)",
                  }}
                >
                  🧟
                </Typography>
              </Box>
            );
          })}

          {bullets.map((b) => {
            const xPercent = getColumnXPercent(b.column);
            const yPercent = Math.min(100, Math.max(0, b.y * 100));
            return (
              <Box
                key={b.id}
                sx={{
                  position: "absolute",
                  left: `${xPercent}%`,
                  top: `${yPercent}%`,
                  transform: "translate(-50%, -50%)",
                  pointerEvents: "none",
                }}
              >
                <Box
                  sx={{
                    width: 4,
                    height: 18,
                    borderRadius: 999,
                    bgcolor: "#60a5fa",
                    boxShadow: "0 0 10px rgba(59,130,246,0.9)",
                  }}
                />
              </Box>
            );
          })}

          {LETTERS.map((letter, idx) => {
            const xPercent = ((idx + 0.5) / LETTERS.length) * 100;
            return (
              <Box
                key={letter}
                sx={{
                  position: "absolute",
                  left: `${xPercent}%`,
                  bottom: 6,
                  transform: "translateX(-50%)",
                  textAlign: "center",
                }}
              >
                <Typography sx={{ fontSize: 16, lineHeight: 1 }}>🧍</Typography>
                <Typography
                  variant="caption"
                  sx={{
                    lineHeight: 1,
                    fontFamily: "monospace",
                    color: "#e5e7eb",
                  }}
                >
                  {letter}
                </Typography>
              </Box>
            );
          })}

          {waveBanner && (
            <Box
              sx={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                px: 3,
                py: 1.5,
                borderRadius: 999,
                bgcolor: "rgba(15,23,42,0.95)",
                border: "2px solid rgba(248,113,113,0.9)",
                boxShadow: "0 0 20px rgba(248,113,113,0.7)",
                zIndex: 5,
              }}
            >
              <Typography
                variant="h5"
                sx={{
                  color: "#f97373",
                  fontWeight: 800,
                  letterSpacing: 2,
                }}
              >
                {waveBanner.toUpperCase()}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Word row – ONE LINE, no pills */}
        <Box
          sx={{
            mt: 2,
            p: 1.5,
            borderRadius: 2,
            bgcolor: "rgba(15,23,42,0.9)",
            border: "1px solid rgba(148,163,184,0.6)",
            overflowX: "auto",
            whiteSpace: "nowrap",
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{
              color: "#e5e7eb",
              fontWeight: 600,
              mb: 1,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Incoming word stream
          </Typography>

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              whiteSpace: "nowrap",
            }}
          >
            {/* Current word letters inline */}
            <Box sx={{ display: "inline-flex", gap: 0.1 }}>
              {currentWord.split("").map((ch, idx) => {
                const typed = idx < currentIndex;
                const correct = typed && matchMask[idx];
                return (
                  <Box
                    key={idx}
                    component="span"
                    sx={{
                      display: "inline-flex",
                      minWidth: 18,
                      justifyContent: "center",
                      alignItems: "center",
                      px: 0.3,
                      fontFamily: "monospace",
                      fontSize: 18,
                      fontWeight: 700,
                      color: typed
                        ? correct
                          ? "#bbf7d0"
                          : "#fecaca"
                        : "#e5e7eb",
                      bgcolor: typed
                        ? correct
                          ? "rgba(22,163,74,0.4)"
                          : "rgba(248,113,113,0.4)"
                        : "transparent",
                      borderRadius: typed ? 0.5 : 0,
                    }}
                  >
                    {ch.toUpperCase()}
                  </Box>
                );
              })}
            </Box>

            {/* Spacer between current word and next */}
            <Typography
              component="span"
              sx={{ color: "#6b7280", fontFamily: "monospace" }}
            >
              |
            </Typography>

            {/* Remaining words as plain inline text */}
            <Typography
              component="span"
              sx={{
                color: "#9ca3af",
                fontFamily: "monospace",
                fontSize: 14,
              }}
            >
              {remainingWords.map((w, i) =>
                i === remainingWords.length - 1
                  ? w.toUpperCase()
                  : w.toUpperCase() + " "
              )}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Input + controls */}
      <Paper
        elevation={4}
        sx={{
          p: 2,
          borderRadius: 3,
          bgcolor: "#020617",
          border: "1px solid rgba(148,163,184,0.4)",
        }}
      >
        <Stack spacing={1.5}>
          <Typography variant="subtitle1" sx={{ color: "#e5e7eb" }}>
            Focus on the highlighted word. Every correct letter fires
            instantly. There is <strong>no backspace</strong>.
          </Typography>
          <TextField
            label="Your typing (letters only)"
            value={displayInput}
            onKeyDown={handleKeyDown}
            onChange={() => {
              // ignore direct changes; we only use keyDown
            }}
            fullWidth
            InputProps={{
              sx: {
                bgcolor: "#020617",
                color: "#e5e7eb",
                fontFamily: "monospace",
              },
            }}
          />
          <Box display="flex" gap={1} alignItems="center">
            <Button
              variant="contained"
              onClick={startGame}
              sx={{
                bgcolor: "#ef4444",
                "&:hover": { bgcolor: "#b91c1c" },
              }}
            >
              {hasStarted && !gameOver ? "Restart" : "Start Apocalypse"}
            </Button>
            {gameOver && (
              <Typography variant="body2" sx={{ color: "#fecaca", mt: 0.7 }}>
                Game over. The horde broke through.
              </Typography>
            )}
          </Box>
        </Stack>
      </Paper>
    </Container>
  );
};

export default ZombieTypingGame;
