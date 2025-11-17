import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Autocomplete,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Divider,
  CssBaseline,
  Switch,
  FormControlLabel,
  Snackbar,
} from "@mui/material";
import { keyframes } from "@mui/system";
import { ThemeProvider, createTheme } from "@mui/material/styles";

// ---- Types & constants -----------------------------------------------------

interface LeaderboardEntry {
  id: string;
  word: string;
  playerName: string;
  score: number;
  completedCount: number;
  partialCorrect: number;
  wordLength: number;
  runNumber: number;
  createdAt: number;
}

type LeaderboardMap = Record<string, LeaderboardEntry[]>;

const LEADERBOARD_STORAGE_KEY = "oneWord10Seconds_leaderboard_v1";

const SAMPLE_WORDS: string[] = [
  "forest",
  "dragon",
  "wizard",
  "keyboard",
  "cougar",
  "coding",
  "marathon",
  "practice",
  "student",
  "teacher",
  "rocket",
  "galaxy",
  "planet",
  "comet",
  "asteroid",
  "satellite",
  "orbit",
  "gravity",
  "experiment",
  "science",
  "energy",
  "motion",
  "friction",
  "circuit",
  "battery",
  "magnet",
  "robot",
  "sensor",
  "program",
  "variable",
  "function",
  "object",
  "array",
  "string",
  "boolean",
  "loop",
  "debug",
  "compile",
  "network",
  "browser",
  "window",
  "cursor",
  "monitor",
  "laptop",
  "tablet",
  "headphones",
  "printer",
  "scanner",
  "projector",
  "classroom",
  "notebook",
  "pencil",
  "marker",
  "eraser",
  "folder",
  "backpack",
  "locker",
  "hallway",
  "library",
  "reading",
  "writing",
  "story",
  "chapter",
  "paragraph",
  "sentence",
  "grammar",
  "vocabulary",
  "spelling",
  "dictionary",
  "partner",
  "group",
  "teamwork",
  "respect",
  "kindness",
  "honesty",
  "courage",
  "effort",
  "focus",
  "patience",
  "mountain",
  "valley",
  "river",
  "ocean",
  "desert",
  "tundra",
  "meadow",
  "island",
  "jungle",
  "swamp",
  "bridge",
  "tunnel",
  "highway",
  "village",
  "castle",
  "tower",
  "harbor",
  "airport",
  "station",
  "factory",
  "morning",
  "evening",
  "midnight",
  "sunrise",
  "sunset",
  "thunder",
  "lightning",
  "rainbow",
  "weather",
  "season",
  "spring",
  "summer",
  "autumn",
  "winter",
  "breeze",
  "shadow",
  "mirror",
  "crystal",
  "diamond",
  "metal",
  "copper",
  "silver",
  "golden",
  "carbon",
  "oxygen",
  "hydrogen",
  "nitrogen",
  "plasma",
  "particle",
  "atom",
  "fraction",
  "decimal",
  "pattern",
  "sequence",
  "graph",
  "angle",
  "circle",
  "triangle",
  "square",
  "polygon",
  "artist",
  "musician",
  "painter",
  "dancer",
  "singer",
  "actor",
  "designer",
  "builder",
  "gardener",
  "chef",
  "pixel",
  "sprite",
  "avatar",
  "texture",
  "canvas",
  "palette",
  "contrast",
  "brightness",
  "portal",
  "quest",
  "battle",
  "puzzle",
  "riddle",
  "treasure",
  "journey",
  "kingdom",
  "market",
  "balance",
  "rhythm",
  "tempo",
  "harmony",
  "melody",
  "chorus",
  "volume",
  "silence",
  "whisper",
  "bubble",
  "marble",
  "ribbon",
  "feather",
  "shell",
  "pebble",
  "crackle",
  "sparkle",
  "glimmer",
  "twinkle",
  "cactus",
  "orchard",
  "prairie",
  "harvest",
  "blossom",
  "acorn",
  "maple",
  "willow",
  "cedar",
  "sequoia",
  "compass",
  "adventure",
  "voyage",
  "explorer",
  "captain",
  "pirate",
  "sailor",
  "pilot",
  "ranger",
  "biology",
  "physics",
  "chemistry",
  "algebra",
  "geometry",
  "history",
  "geology",
  "ecology",
  "culture",
  "language",
  "strategy",
  "tactics",
  "victory",
  "defeat",
  "progress",
  "level",
  "mission",
  "achievement",
];

// ---- Random name generator word lists --------------------------------------

// 100 school-appropriate adjectives
const ADJECTIVES: string[] = [
  "Brave",
  "Bright",
  "Clever",
  "Curious",
  "Quick",
  "Gentle",
  "Happy",
  "Calm",
  "Mighty",
  "Lucky",
  "Swift",
  "Quiet",
  "Loyal",
  "Kind",
  "Friendly",
  "Silly",
  "Serious",
  "Noble",
  "Epic",
  "Awesome",
  "Cheerful",
  "Bold",
  "Brilliant",
  "Creative",
  "Energetic",
  "Funny",
  "Trusty",
  "Honest",
  "Helpful",
  "Hopeful",
  "Joyful",
  "Patient",
  "Polite",
  "Playful",
  "Powerful",
  "Proud",
  "Radiant",
  "Shiny",
  "Sparkling",
  "Steady",
  "Strong",
  "Talented",
  "Thoughtful",
  "Upbeat",
  "Vivid",
  "Wise",
  "Zippy",
  "Daring",
  "Eager",
  "Fearless",
  "Gentlehearted",
  "Glowing",
  "Heroic",
  "Inventive",
  "Jolly",
  "Kindhearted",
  "Lively",
  "Magical",
  "Marvelous",
  "Neat",
  "Observant",
  "Patienthearted",
  "Playfulhearted",
  "Quickwitted",
  "Quiethearted",
  "Ready",
  "Reliable",
  "Resilient",
  "Respectful",
  "Shimmering",
  "Smiling",
  "Steadfast",
  "Sunny",
  "Supportive",
  "Thoughtfulhearted",
  "Thunderous",
  "Trustworthy",
  "Vibrant",
  "Warm",
  "Welcoming",
  "Whimsical",
  "Winning",
  "Zesty",
  "Ambitious",
  "Balanced",
  "Careful",
  "Determined",
  "Focused",
  "Genuine",
  "Grateful",
  "Imaginative",
  "Inspiring",
  "Motivated",
  "Positive",
  "Prepared",
  "Resourceful",
  "Responsible",
  "Strategic",
  "Unique",
];

// 100 school-appropriate -ing verbs
const VERBS_ING: string[] = [
  "Running",
  "Jumping",
  "Flying",
  "Reading",
  "Writing",
  "Coding",
  "Typing",
  "Thinking",
  "Learning",
  "Sharing",
  "Helping",
  "Smiling",
  "Laughing",
  "Drawing",
  "Painting",
  "Building",
  "Creating",
  "Playing",
  "Studying",
  "Listening",
  "Watching",
  "Searching",
  "Solving",
  "Climbing",
  "Exploring",
  "Traveling",
  "Walking",
  "Chasing",
  "Racing",
  "Practicing",
  "Balancing",
  "Focusing",
  "Organizing",
  "Comparing",
  "Measuring",
  "Counting",
  "Sorting",
  "Connecting",
  "Imagining",
  "Wondering",
  "Dreaming",
  "Designing",
  "Inventing",
  "Testing",
  "Fixing",
  "Improving",
  "Reviewing",
  "Repeating",
  "Training",
  "Encouraging",
  "Coaching",
  "Guiding",
  "Teaching",
  "Collaborating",
  "Leading",
  "Supporting",
  "Cheering",
  "Celebrating",
  "Sketching",
  "Coloring",
  "Modeling",
  "Acting",
  "Singing",
  "Dancing",
  "Drumming",
  "Juggling",
  "Gliding",
  "Hiking",
  "Rowing",
  "Sailing",
  "Surfing",
  "Gardening",
  "Planting",
  "Harvesting",
  "Cooking",
  "Baking",
  "Mixing",
  "Tasting",
  "Cleaning",
  "Recycling",
  "Revising",
  "Highlighting",
  "Annotating",
  "Brainstorming",
  "Outlining",
  "Presenting",
  "Explaining",
  "Questioning",
  "Researching",
  "Strategizing",
  "Planning",
  "Refining",
  "Leveling",
];

// 100 school-appropriate nouns
const NOUNS: string[] = [
  "Dragon",
  "Wizard",
  "Cougar",
  "Phoenix",
  "Rocket",
  "Galaxy",
  "Planet",
  "Comet",
  "Asteroid",
  "Robot",
  "Keyboard",
  "Notebook",
  "Backpack",
  "Pencil",
  "Marker",
  "Eraser",
  "Folder",
  "Chromebook",
  "Laptop",
  "Tablet",
  "Monitor",
  "Headphones",
  "Projector",
  "Classroom",
  "Teacher",
  "Student",
  "Scientist",
  "Engineer",
  "Artist",
  "Musician",
  "Coder",
  "Gamer",
  "Builder",
  "Explorer",
  "Captain",
  "Pilot",
  "Ranger",
  "Detective",
  "Champion",
  "Hero",
  "Knight",
  "Guardian",
  "Scholar",
  "Reader",
  "Writer",
  "Editor",
  "Helper",
  "Leader",
  "Friend",
  "Teammate",
  "Partner",
  "Neighbor",
  "Inventor",
  "Designer",
  "Navigator",
  "Adventurer",
  "Traveler",
  "Sprinter",
  "Thinker",
  "Strategist",
  "Planner",
  "Creator",
  "Painter",
  "Dancer",
  "Singer",
  "Drummer",
  "Helperbot",
  "Sidekick",
  "ChampionFox",
  "LightningBolt",
  "Star",
  "CometTrail",
  "Sunbeam",
  "Moonlight",
  "Starlight",
  "Thundercloud",
  "Rainstorm",
  "Rainbow",
  "Breeze",
  "Shadow",
  "Trailblazer",
  "Pathfinder",
  "Firework",
  "Spark",
  "Glimmer",
  "Torch",
  "Lantern",
  "Beacon",
  "Harbor",
  "Tower",
  "Castle",
  "Village",
  "Workshop",
  "Lab",
  "Library",
  "Studio",
  "Arena",
  "Stage",
];

const randomFrom = (arr: string[]) =>
  arr[Math.floor(Math.random() * arr.length)];

const generateRandomName = (): string => {
  const adj = randomFrom(ADJECTIVES);
  const verb = randomFrom(VERBS_ING);
  const noun = randomFrom(NOUNS);
  return `${adj} ${verb} ${noun}`;
};

// ---- Profanity / inappropriate word filter --------------------------------

const BANNED_WORDS: string[] = [
  // "examplebadword",
  // "anotherbadword",
];

const BANNED_PATTERNS: RegExp[] = [
  // /somepattern/i,
];

const isInappropriateWord = (raw: string): boolean => {
  const word = raw.trim().toLowerCase();
  if (!word) return false;

  if (BANNED_WORDS.some((w) => word === w || word.includes(w))) return true;
  if (BANNED_PATTERNS.some((re) => re.test(word))) return true;

  return false;
};

// ---- Simple sound engine (Web Audio) ---------------------------------------

const useSoundEngine = () => {
  const audioCtxRef = useRef<AudioContext | null>(null);

  const ensureCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }
    return audioCtxRef.current;
  };

  const playTone = useCallback(
    (freq: number, durationMs: number, volume = 0.15) => {
      const ctx = ensureCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.value = volume;

      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      osc.start(now);
      osc.stop(now + durationMs / 1000);
    },
    []
  );

  const playPositiveLetter = useCallback(() => {
    playTone(880, 60);
  }, [playTone]);

  const playNegativeLetter = useCallback(() => {
    playTone(220, 90);
  }, [playTone]);

  const playNeutralBackspace = useCallback(() => {
    playTone(440, 40);
  }, [playTone]);

  const playWordSuccess = useCallback(() => {
    playTone(880, 80, 0.18);
    setTimeout(() => playTone(1320, 110, 0.18), 90);
  }, [playTone]);

  const playFanfare = useCallback(() => {
    const seq = [
      { freq: 523.25, dur: 140, delay: 0 },
      { freq: 659.25, dur: 160, delay: 130 },
      { freq: 783.99, dur: 200, delay: 280 },
      { freq: 987.77, dur: 220, delay: 500 },
    ];

    seq.forEach((note) => {
      setTimeout(() => playTone(note.freq, note.dur, 0.22), note.delay);
    });
  }, [playTone]);

  const playBigFanfare = useCallback(() => {
    const seq = [
      { freq: 523.25, dur: 160, delay: 0 },
      { freq: 587.33, dur: 160, delay: 140 },
      { freq: 659.25, dur: 180, delay: 280 },
      { freq: 783.99, dur: 200, delay: 460 },
      { freq: 880.0, dur: 220, delay: 660 },
      { freq: 987.77, dur: 260, delay: 880 },
      { freq: 1046.5, dur: 320, delay: 1150 },
    ];

    seq.forEach((note) => {
      setTimeout(() => playTone(note.freq, note.dur, 0.28), note.delay);
    });

    setTimeout(() => playTone(1174.66, 120, 0.26), 1450);
    setTimeout(() => playTone(1318.51, 140, 0.26), 1580);
  }, [playTone]);

  return {
    playPositiveLetter,
    playNegativeLetter,
    playNeutralBackspace,
    playWordSuccess,
    playFanfare,
    playBigFanfare,
  };
};

// ---- Confetti animation ----------------------------------------------------

const fall = keyframes`
  0% {
    transform: translate3d(0, -10vh, 0) rotateZ(0deg);
    opacity: 1;
  }
  100% {
    transform: translate3d(0, 130vh, 0) rotateZ(360deg);
    opacity: 0;
  }
`;

const ConfettiBurst: React.FC<{ special?: boolean }> = ({
  special = false,
}) => {
  const baseColors = [
    "#22c55e",
    "#3b82f6",
    "#f97316",
    "#eab308",
    "#ec4899",
    "#a855f7",
  ];
  const colors = special
    ? [...baseColors, "#facc15", "#facc15", "#facc15"]
    : baseColors;

  const pieces = useMemo(() => {
    const count = special ? 260 : 180;
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: (special ? 12 : 10) + Math.random() * (special ? 20 : 16),
      delay: Math.random() * (special ? 1 : 0.8),
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
  }, [special, colors]);

  const durationMs = special ? 2800 : 2200;

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 2000,
      }}
    >
      {pieces.map((p) => (
        <Box
          key={p.id}
          sx={{
            position: "absolute",
            left: `${p.left}%`,
            top: "-12vh",
            width: p.size,
            height: p.size * 0.7,
            bgcolor: p.color,
            borderRadius: "3px",
            animation: `${fall} ${durationMs}ms ease-out forwards`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </Box>
  );
};

// ---- Main Component --------------------------------------------------------

const OneWordTenSeconds: React.FC = () => {
  const [playerName, setPlayerName] = useState("");
  const [customWord, setCustomWord] = useState("");
  const [wordError, setWordError] = useState<string | null>(null);

  const [targetWord, setTargetWord] = useState("");
  const [currentInput, setCurrentInput] = useState("");
  const [completedCount, setCompletedCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(10);
  const [isRunning, setIsRunning] = useState(false);
  const [isCountdown, setIsCountdown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [leaderboard, setLeaderboard] = useState<LeaderboardMap>({});
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [lastSummary, setLastSummary] = useState<{
    completedCount: number;
    partialCorrect: number;
    wordLength: number;
  } | null>(null);
  const [selectedLeaderboardWord, setSelectedLeaderboardWord] = useState<
    string | null
  >(null);
  const [lastTypedIndex, setLastTypedIndex] = useState<number | null>(null);
  const [lastTypedCorrect, setLastTypedCorrect] = useState<boolean | null>(
    null
  );
  const [showConfetti, setShowConfetti] = useState(false);
  const [isPersonalBestCelebration, setIsPersonalBestCelebration] =
    useState(false);

  const [darkMode, setDarkMode] = useState<boolean>(true);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const inputRef = useRef<HTMLInputElement | null>(null);

  const {
    playPositiveLetter,
    playNegativeLetter,
    playNeutralBackspace,
    playWordSuccess,
    playFanfare,
    playBigFanfare,
  } = useSoundEngine();

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setToastOpen(true);
  }, []);

  const handleToastClose = (
    _event?: React.SyntheticEvent | Event,
    reason?: string
  ) => {
    if (reason === "clickaway") return;
    setToastOpen(false);
  };

  // Theme --------------------------------------------------------------------

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: darkMode ? "dark" : "light",
          primary: { main: "#3b82f6" },
          secondary: { main: "#22c55e" },
        },
        shape: { borderRadius: 16 },
      }),
    [darkMode]
  );

  // Load leaderboard from localStorage once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LEADERBOARD_STORAGE_KEY);
      if (raw) {
        const parsed: LeaderboardMap = JSON.parse(raw);
        setLeaderboard(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist leaderboard on change
  useEffect(() => {
    try {
      localStorage.setItem(
        LEADERBOARD_STORAGE_KEY,
        JSON.stringify(leaderboard)
      );
    } catch {
      // ignore
    }
  }, [leaderboard]);

  const allWordsWithRecords = useMemo(
    () =>
      Object.keys(leaderboard)
        .filter((w) => !isInappropriateWord(w))
        .sort(),
    [leaderboard]
  );

  // Names that already appear in the leaderboard (real existing players)
  const knownPlayerNames = useMemo(() => {
    const set = new Set<string>();
    Object.values(leaderboard).forEach((entries) =>
      entries.forEach((e) => set.add(e.playerName))
    );
    return Array.from(set).sort();
  }, [leaderboard]);

  // Autocomplete options = known names only
  const playerNameOptions = useMemo(() => knownPlayerNames, [knownPlayerNames]);

  const currentLeaderboardEntries = useMemo(() => {
    if (!selectedLeaderboardWord) return [];
    return leaderboard[selectedLeaderboardWord.toLowerCase()] ?? [];
  }, [leaderboard, selectedLeaderboardWord]);

  // ---- Game start logic ----------------------------------------------------

  const resetRoundState = useCallback(() => {
    setCurrentInput("");
    setCompletedCount(0);
    setTimeLeft(10);
    setIsRunning(false);
    setIsCountdown(false);
    setCountdown(3);
    setLastScore(null);
    setLastSummary(null);
    setLastTypedIndex(null);
    setLastTypedCorrect(null);
    setIsPersonalBestCelebration(false);
  }, []);

  const beginCountdownForWord = (word: string) => {
    if (!word) return;
    resetRoundState();
    setTargetWord(word.toLowerCase());
    setIsCountdown(true);
    setCountdown(3);
  };

  const startCustomWordRound = () => {
    const typedWord = customWord.trim();
    if (!typedWord) return;
    if (!playerName.trim()) return;
    if (isRunning || isCountdown) return;

    const wordKey = typedWord.toLowerCase();

    // If the word already has a leaderboard (chosen from leaderboard or typed),
    // play THAT word normally.
    if (leaderboard[wordKey]) {
      setCustomWord(wordKey);
      setWordError(null);
      setSelectedLeaderboardWord(wordKey);
      beginCountdownForWord(wordKey);
      return;
    }

    // Otherwise: troll them with a random word.
    const randomWord =
      SAMPLE_WORDS[Math.floor(Math.random() * SAMPLE_WORDS.length)];
    setCustomWord(randomWord);
    setWordError(null);
    setSelectedLeaderboardWord(randomWord.toLowerCase());
    beginCountdownForWord(randomWord);
    showToast("You really thought I'd let your do that?");
  };

  const chooseRandomWord = () => {
    const word = SAMPLE_WORDS[Math.floor(Math.random() * SAMPLE_WORDS.length)];
    setCustomWord(word);
    setWordError(null);
    setSelectedLeaderboardWord(word.toLowerCase());
    beginCountdownForWord(word);
  };

  // Autofocus the typing area when countdown or round is active
  useEffect(() => {
    if (isCountdown || isRunning) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
    }
  }, [isCountdown, isRunning]);

  // Countdown effect
  useEffect(() => {
    if (!isCountdown) return;
    if (countdown <= 0) {
      setIsCountdown(false);
      setIsRunning(true);
      setTimeLeft(10);
      return;
    }
    const id = setTimeout(() => {
      setCountdown((c) => c - 1);
    }, 1000);
    return () => clearTimeout(id);
  }, [isCountdown, countdown]);

  // Confetti lifetime
  useEffect(() => {
    if (!showConfetti) return;
    const id = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(id);
  }, [showConfetti]);

  // End-of-round logic
  const endRound = useCallback(() => {
    if (!targetWord) return;
    setIsRunning(false);
    setTimeLeft(0);

    const wordLength = targetWord.length;
    let partialCorrect = 0;
    const limit = Math.min(currentInput.length, wordLength);
    for (let i = 0; i < limit; i++) {
      if (currentInput[i].toLowerCase() === targetWord[i].toLowerCase()) {
        partialCorrect++;
      }
    }
    const fractional = wordLength > 0 ? partialCorrect / wordLength : 0;
    const rawScore = completedCount + fractional;

    setLastScore(rawScore);
    setLastSummary({ completedCount, partialCorrect, wordLength });

    const trimmedName = playerName.trim();
    let isPersonalBest = false;
    const wordKey = targetWord.toLowerCase();

    if (trimmedName) {
      const prevEntriesForWord = leaderboard[wordKey] ?? [];
      const prevEntriesForPlayer = prevEntriesForWord.filter(
        (e) => e.playerName === trimmedName
      );
      const prevBestScore =
        prevEntriesForPlayer.length > 0
          ? Math.max(...prevEntriesForPlayer.map((e) => e.score))
          : -Infinity;

      isPersonalBest =
        prevEntriesForPlayer.length === 0 || rawScore > prevBestScore;

      setLeaderboard((prev) => {
        const prevEntries = prev[wordKey] ? [...prev[wordKey]] : [];
        const previousRuns = prevEntries.filter(
          (e) => e.playerName === trimmedName
        ).length;
        const runNumber = previousRuns + 1;

        const newEntry: LeaderboardEntry = {
          id: `${wordKey}-${trimmedName}-${Date.now()}`,
          word: wordKey,
          playerName: trimmedName,
          score: Number(rawScore.toFixed(3)),
          completedCount,
          partialCorrect,
          wordLength,
          runNumber,
          createdAt: Date.now(),
        };

        prevEntries.push(newEntry);
        prevEntries.sort(
          (a, b) => b.score - a.score || a.createdAt - b.createdAt
        );

        const newMap: LeaderboardMap = {
          ...prev,
          [wordKey]: prevEntries,
        };

        return newMap;
      });

      setSelectedLeaderboardWord((prevSel) => prevSel ?? wordKey);
    }

    if (isPersonalBest) {
      playBigFanfare();
      setIsPersonalBestCelebration(true);
    } else {
      playFanfare();
      setIsPersonalBestCelebration(false);
    }
    setShowConfetti(true);
  }, [
    completedCount,
    currentInput,
    playerName,
    targetWord,
    leaderboard,
    playFanfare,
    playBigFanfare,
  ]);

  // Timer effect
  useEffect(() => {
    if (!isRunning) return;
    if (timeLeft <= 0) {
      endRound();
      return;
    }
    const id = setTimeout(() => {
      setTimeLeft((t) => Number((t - 0.1).toFixed(1)));
    }, 100);
    return () => clearTimeout(id);
  }, [isRunning, timeLeft, endRound]);

  // ---- Typing handler ------------------------------------------------------

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isRunning || !targetWord) return;

    const wordLength = targetWord.length;

    if (
      e.key === "Backspace" ||
      e.key.length === 1 ||
      e.key === "Enter" ||
      e.key === "Tab"
    ) {
      e.preventDefault();
    }

    if (e.key === " " || e.code === "Space") {
      if (currentInput.length === 0) return;

      const normalizedInput = currentInput.trim().toLowerCase();
      const isWholeCorrect =
        normalizedInput === targetWord.toLowerCase() &&
        normalizedInput.length === targetWord.length;

      if (isWholeCorrect) {
        setCompletedCount((c) => c + 1);
        playWordSuccess();
      } else {
        playNegativeLetter();
      }

      setCurrentInput("");
      setLastTypedIndex(null);
      setLastTypedCorrect(null);
      return;
    }

    if (e.key === "Backspace") {
      if (currentInput.length > 0) {
        setCurrentInput((prev) => prev.slice(0, -1));
        setLastTypedIndex(currentInput.length - 1);
        setLastTypedCorrect(null);
        playNeutralBackspace();
      }
      return;
    }

    if (e.key === "Enter" || e.key === "Tab") {
      return;
    }

    if (e.key.length === 1) {
      if (currentInput.length >= wordLength) {
        return;
      }

      const nextChar = e.key;
      const expectedChar = targetWord[currentInput.length];

      const isCorrect = nextChar.toLowerCase() === expectedChar.toLowerCase();

      setCurrentInput((prev) => prev + nextChar);
      setLastTypedIndex(currentInput.length);
      setLastTypedCorrect(isCorrect);

      if (isCorrect) {
        playPositiveLetter();
      } else {
        playNegativeLetter();
      }
    }
  };

  // ---- Render helpers ------------------------------------------------------

  const renderTargetWord = () => {
    if (!targetWord) {
      return (
        <Typography variant="h5" textAlign="center" sx={{ opacity: 0.6 }}>
          Choose a word to start
        </Typography>
      );
    }

    const chars = targetWord.split("");

    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          gap: 0.5,
          flexWrap: "wrap",
          fontSize: "2.5rem",
          fontWeight: 700,
          letterSpacing: 0.12,
        }}
      >
        {chars.map((ch, index) => {
          const typedChar = currentInput[index];
          let color: string | undefined;
          if (typedChar) {
            color =
              typedChar.toLowerCase() === ch.toLowerCase()
                ? "#22c55e"
                : "#ef4444";
          } else {
            color = undefined;
          }

          const isAnimated = lastTypedIndex === index;

          return (
            <Box
              key={`${ch}-${index}`}
              sx={{
                position: "relative",
                minWidth: "2rem",
                textAlign: "center",
                transform: isAnimated ? "scale(1.2)" : "scale(1)",
                transition: "transform 120ms ease-out",
                color,
              }}
            >
              {ch}
              <Box
                sx={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: -6,
                  height: 2,
                  borderRadius: 999,
                  bgcolor: typedChar
                    ? color || "text.secondary"
                    : "text.disabled",
                  opacity: 0.7,
                }}
              />
            </Box>
          );
        })}
      </Box>
    );
  };

  // ---- Custom word change handler ------------------------------------------

  const handleCustomWordChange = (value: string) => {
    setCustomWord(value);
    if (!value.trim()) {
      setWordError(null);
      return;
    }
    if (isInappropriateWord(value)) {
      setWordError("Please choose a school-appropriate word.");
    } else {
      setWordError(null);
    }
  };

  // ---- Player name confirm logic -------------------------------------------

  const handleConfirmPlayerName = useCallback(() => {
    const typed = playerName.trim();
    if (!typed) return;

    const normalized = typed.toLowerCase();

    // Only names that have actually appeared in the leaderboard count as "existing"
    const existing = knownPlayerNames.find(
      (name) => name.toLowerCase() === normalized
    );

    if (existing) {
      setPlayerName(existing);
      showToast(`Welcome back, ${existing}!`);
      return;
    }

    // Otherwise: replace with random generated name
    const randomName = generateRandomName();
    setPlayerName(randomName);
    showToast("I can't let you do that.");
  }, [playerName, knownPlayerNames, showToast]);

  const handlePlayerNameKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirmPlayerName();
    }
  };

  // ---- Word field key handling (Enter to start) ----------------------------

  const handleWordFieldKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (
        !isRunning &&
        !isCountdown &&
        customWord.trim() &&
        playerName.trim()
      ) {
        e.preventDefault();
        startCustomWordRound();
      }
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {showConfetti && <ConfettiBurst special={isPersonalBestCelebration} />}
      <Snackbar
        open={toastOpen}
        autoHideDuration={3000}
        onClose={handleToastClose}
        message={toastMessage}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: 1 }}
        >
          <Typography variant="h3" gutterBottom>
            1 Word • 10 Seconds
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={darkMode}
                onChange={(_, checked) => setDarkMode(checked)}
              />
            }
            label={darkMode ? "Dark mode" : "Light mode"}
          />
        </Stack>

        <Typography variant="subtitle1" textAlign="center" sx={{ mb: 3 }}>
          Type one word as many times as you can in 10 seconds. Score ={" "}
          <b>full words</b> completed + <b>partial credit</b> on your last
          attempt.
        </Typography>

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={3}
          alignItems="stretch"
        >
          {/* Left: Game panel */}
          <Paper
            elevation={3}
            sx={{
              flex: 3,
              p: 3,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <Typography variant="h5" gutterBottom>
              Play
            </Typography>

            {/* Player name + submit */}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ flexGrow: 1 }}>
                  <Autocomplete
                    freeSolo
                    options={playerNameOptions}
                    value={playerName}
                    onChange={(_, value) => setPlayerName(value ?? "")}
                    inputValue={playerName}
                    onInputChange={(_, value) => setPlayerName(value)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Player name"
                        size="small"
                        fullWidth
                        onKeyDown={handlePlayerNameKeyDown}
                      />
                    )}
                  />
                </Box>
                <Button
                  variant="outlined"
                  onClick={handleConfirmPlayerName}
                  disabled={!playerName.trim()}
                >
                  Save
                </Button>
              </Stack>
            </Box>

            {/* Word selection */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                label="Word to practice"
                size="small"
                fullWidth
                value={customWord}
                onChange={(e) => handleCustomWordChange(e.target.value)}
                onKeyDown={handleWordFieldKeyDown}
                disabled={isRunning || isCountdown}
                error={!!wordError}
                helperText={
                  wordError ??
                  "Enter any appropriate word you want to practice."
                }
              />
              <Button
                variant="contained"
                onClick={startCustomWordRound}
                disabled={
                  !customWord.trim() ||
                  isRunning ||
                  isCountdown ||
                  !playerName.trim()
                }
              >
                Start
              </Button>
              <Button
                variant="outlined"
                onClick={chooseRandomWord}
                disabled={isRunning || isCountdown || !playerName.trim()}
              >
                Random word
              </Button>
            </Stack>

            {/* Timers */}
            <Stack
              direction="row"
              spacing={2}
              justifyContent="center"
              sx={{ mt: 1 }}
            >
              <Box textAlign="center">
                <Typography variant="caption">Status</Typography>
                <Typography variant="h6">
                  {isCountdown
                    ? `Get Ready: ${countdown}`
                    : isRunning
                    ? "GO!"
                    : lastScore != null
                    ? "Round finished"
                    : "Idle"}
                </Typography>
              </Box>
              <Box textAlign="center">
                <Typography variant="caption">Time left</Typography>
                <Typography variant="h6">
                  {isRunning
                    ? `${timeLeft.toFixed(1)}s`
                    : isCountdown
                    ? "—"
                    : "0.0s"}
                </Typography>
              </Box>
              <Box textAlign="center">
                <Typography variant="caption">Completed words</Typography>
                <Typography variant="h6">{completedCount}</Typography>
              </Box>
            </Stack>

            <Divider sx={{ my: 2 }} />

            {/* Target word */}
            <Box sx={{ mb: 2 }}>{renderTargetWord()}</Box>

            {/* Input field */}
            <Box sx={{ mt: 1 }}>
              <TextField
                label={
                  isRunning
                    ? "Type here (space submits the word)"
                    : "Type here (when round is active)"
                }
                fullWidth
                value={currentInput}
                inputRef={inputRef}
                onKeyDown={handleKeyDown}
                onChange={() => {
                  // Intentionally ignored to keep control inside onKeyDown
                }}
                disabled={!isRunning}
                autoComplete="off"
              />
            </Box>

            {/* Last round summary */}
            {lastScore != null && lastSummary && (
              <Paper
                variant="outlined"
                sx={{ mt: 2, p: 2, bgcolor: "background.default" }}
              >
                <Typography variant="subtitle1" gutterBottom>
                  Last Round
                </Typography>
                <Typography variant="body2">
                  Word: <b>{targetWord}</b>
                </Typography>
                <Typography variant="body2">
                  Completed words: <b>{lastSummary.completedCount}</b>
                </Typography>
                <Typography variant="body2">
                  Partial letters on last attempt:{" "}
                  <b>
                    {lastSummary.partialCorrect}/{lastSummary.wordLength}
                  </b>{" "}
                  (
                  {(
                    (lastSummary.partialCorrect /
                      Math.max(1, lastSummary.wordLength)) *
                    100
                  ).toFixed(1)}
                  %)
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Final score:{" "}
                  <b>
                    {lastSummary.completedCount} +{" "}
                    {(
                      lastSummary.partialCorrect /
                      Math.max(1, lastSummary.wordLength)
                    ).toFixed(3)}{" "}
                    = {lastScore.toFixed(3)}
                  </b>
                </Typography>
              </Paper>
            )}
          </Paper>

          {/* Right: Leaderboard panel */}
          <Paper
            elevation={3}
            sx={{
              flex: 2,
              p: 3,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <Typography variant="h5" gutterBottom>
              Leaderboards
            </Typography>

            <Typography variant="body2">
              Leaderboards are separate for each word. Choose a word below to
              see all recorded runs.
            </Typography>

            <Autocomplete
              options={allWordsWithRecords}
              value={selectedLeaderboardWord}
              onChange={(_, value) => {
                setSelectedLeaderboardWord(value);
                if (value) {
                  setCustomWord(value);
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select word with scores"
                  size="small"
                  placeholder={
                    allWordsWithRecords.length === 0
                      ? "No scores yet — play a round!"
                      : "Start typing a word..."
                  }
                />
              )}
            />

            {selectedLeaderboardWord && currentLeaderboardEntries.length > 0 ? (
              <Box sx={{ mt: 2, maxHeight: 360, overflowY: "auto" }}>
                <Typography variant="subtitle1" gutterBottom>
                  Word: <b>{selectedLeaderboardWord}</b>
                </Typography>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Rank</TableCell>
                      <TableCell>Player</TableCell>
                      <TableCell>Run #</TableCell>
                      <TableCell align="right">Score</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {currentLeaderboardEntries.map((entry, index) => (
                      <TableRow key={entry.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{entry.playerName}</TableCell>
                        <TableCell>{entry.runNumber}</TableCell>
                        <TableCell align="right">
                          {entry.score.toFixed(3)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            ) : (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" sx={{ opacity: 0.7 }}>
                  {allWordsWithRecords.length === 0
                    ? "No scores have been recorded yet. Play a round to create your first leaderboard!"
                    : "Select a word above to view its leaderboard."}
                </Typography>
              </Box>
            )}
          </Paper>
        </Stack>
      </Container>
    </ThemeProvider>
  );
};

export default OneWordTenSeconds;
