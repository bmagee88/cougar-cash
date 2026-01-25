import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  Box,
  Button,
  Grid,
  LinearProgress,
  Paper,
  Typography,
  TextField,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItemButton,
  ListItemText,
  Radio,
  Divider,
  Tooltip as MuiTooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  Chip,
  IconButton,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import { createTheme, ThemeProvider, CssBaseline, alpha } from "@mui/material";
import {
  DndContext,
  useSensor,
  useSensors,
  PointerSensor,
  DragEndEvent,
  TouchSensor,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

/**
 * ✅ Fetch CSVs:
 * Put files in /public/csv/... so they're served at /csv/...
 */

type CsvItem = { label: string; url: string };
type CsvLibrary = Record<string, Record<string, CsvItem[]>>;

// ✅ Your hard-coded library
const CSV_LIBRARY: CsvLibrary = {
  Magbr: {
    ACert: [
      {
        label: "Cloud Computing 1",
        url: "/csv/Magbr/ACert/cloud_computing_1.csv",
      },
      { label: "Hardware 1", url: "/csv/Magbr/ACert/hardware_1.csv" },
      {
        label: "Hardware and Network Troubleshooting 1",
        url: "/csv/Magbr/ACert/hardware_and_network_troubleshooting.csv",
      },
      {
        label: "Mobile Devices 1",
        url: "/csv/Magbr/ACert/mobile_devices_1.csv",
      },
      { label: "Networking 1", url: "/csv/Magbr/ACert/networking_1.csv" },
      {
        label: "Operating Systems 1",
        url: "/csv/Magbr/ACert/operating_systems_1.csv",
      },
      {
        label: "Operational Procedures 1",
        url: "/csv/Magbr/ACert/operational_procedures_1.csv",
      },
      {
        label: "Operational Procedures 2",
        url: "/csv/Magbr/ACert/operational_procedures_2.csv",
      },
      { label: "Security 1", url: "/csv/Magbr/ACert/security_1.csv" },
      {
        label: "Software Troubleshooting 1",
        url: "/csv/Magbr/ACert/software_troubleshooting_1.csv",
      },
      {
        label: "Software Troubleshooting 2",
        url: "/csv/Magbr/ACert/software_troubleshooting_2.csv",
      },
    ],
  },
};

interface QAData {
  id: string;
  questions: string;
  answers: string;
  isCorrect?: boolean;
}

interface Attempt {
  timestamp: number;
  score: number; // 0-100
  date: string; // YYYY-MM-DD
}

type CapState = "grey" | "yellow" | null;

type StreakStatus = {
  green: number;
  cap: CapState; // grey if due-at-start + no attempts today; yellow if due-at-start + attempted today but no 100
  due: boolean; // ✅ CURRENTLY due (after considering today's attempts)
  dueDate: string; // next due date after processing up to today
  daysUntilDue: number; // 0 if due today, otherwise positive
};

const STORAGE_PREFIX = "csvMatchGameAttempts";

const LAST_PLAYER_KEY = "csvMatchLastPlayer";
const LAST_TEACHER_KEY = "csvMatchLastTeacher";
const LAST_UNIT_KEY = "csvMatchLastUnit";

// theme persistence
const THEME_MODE_KEY = "csvMatchThemeMode";

// 🔧 Dev options (change here only)
const DEV_OPTIONS = {
  MASTER_DEBUG: false,
  MAX_TRIES_PER_DAY: 3,
} as const;

const MASTER_DEBUG = DEV_OPTIONS.MASTER_DEBUG;
const MAX_TRIES_PER_DAY = DEV_OPTIONS.MAX_TRIES_PER_DAY;

const toDateKey = (timestamp: number | Date): string => {
  const d = typeof timestamp === "number" ? new Date(timestamp) : timestamp;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const withPublicUrl = (p: string) => {
  const base = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
  const path = p.startsWith("/") ? p : `/${p}`;
  return `${base}${path}`;
};

const dateKeyToDate = (key: string) => {
  const [y, m, d] = key.split("-").map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d, 12, 0, 0, 0); // noon to avoid DST weirdness
};

const addDaysKey = (key: string, days: number) => {
  const dt = dateKeyToDate(key);
  dt.setDate(dt.getDate() + days);
  return toDateKey(dt);
};

const daysBetweenKeys = (fromKey: string, toKey: string) => {
  const a = dateKeyToDate(fromKey).getTime();
  const b = dateKeyToDate(toKey).getTime();
  const diff = b - a;
  return Math.round(diff / (1000 * 60 * 60 * 24));
};

// ✅ spaced repetition interval: 1,2,3,4,5... (linear, equals green count)
const nextIntervalDays = (greenAfterWin: number) => Math.max(1, greenAfterWin);

/** =========================
 *  ✅ Theme (light/dark)
 *  ========================= */
type ThemeMode = "light" | "dark";

const buildTheme = (mode: ThemeMode) =>
  createTheme({
    palette: {
      mode,
      // friendly teal + violet accents
      primary: { main: mode === "dark" ? "#62d6c4" : "#0ea5a5" },
      secondary: { main: mode === "dark" ? "#b7a6ff" : "#6d28d9" },
      success: { main: mode === "dark" ? "#66e2a5" : "#16a34a" },
      warning: { main: mode === "dark" ? "#ffd36e" : "#f59e0b" },
      error: { main: mode === "dark" ? "#ff7a7a" : "#dc2626" },
      background: {
        default: mode === "dark" ? "#0b1220" : "#f7fafc",
        paper: mode === "dark" ? "#111a2e" : "#ffffff",
      },
    },
    shape: { borderRadius: 14 },
    typography: {
      fontFamily:
        'system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif',
      h6: { fontWeight: 800, letterSpacing: 0.2 },
      subtitle1: { fontWeight: 700 },
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: ({ theme }) => ({
            border:
              theme.palette.mode === "dark"
                ? `1px solid ${alpha("#ffffff", 0.08)}`
                : `1px solid ${alpha("#0b1220", 0.08)}`,
            backgroundImage:
              theme.palette.mode === "dark"
                ? `linear-gradient(180deg, ${alpha(
                    theme.palette.background.paper,
                    0.98,
                  )} 0%, ${alpha(theme.palette.background.paper, 0.92)} 100%)`
                : "none",
          }),
        },
      },
      MuiAccordion: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 18,
            overflow: "hidden",
            boxShadow:
              theme.palette.mode === "dark"
                ? `0 8px 22px ${alpha("#000", 0.35)}`
                : `0 10px 26px ${alpha("#0b1220", 0.1)}`,
            "&:before": { display: "none" },
            marginBottom: theme.spacing(2),
          }),
        },
      },
      MuiAccordionSummary: {
        styleOverrides: {
          root: ({ theme }) => ({
            background:
              theme.palette.mode === "dark"
                ? alpha(theme.palette.primary.main, 0.08)
                : alpha(theme.palette.primary.main, 0.06),
          }),
        },
      },
      MuiButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 12,
            textTransform: "none",
            fontWeight: 800,
            boxShadow:
              theme.palette.mode === "dark"
                ? `0 10px 20px ${alpha("#000", 0.3)}`
                : `0 10px 20px ${alpha(theme.palette.primary.main, 0.18)}`,
          }),
        },
      },
      MuiTextField: {
        defaultProps: { size: "small" },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 999,
            height: 10,
            backgroundColor:
              theme.palette.mode === "dark"
                ? alpha("#ffffff", 0.08)
                : alpha("#0b1220", 0.08),
          }),
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 14,
            marginBottom: theme.spacing(1),
            border:
              theme.palette.mode === "dark"
                ? `1px solid ${alpha("#ffffff", 0.08)}`
                : `1px solid ${alpha("#0b1220", 0.08)}`,
            "&.Mui-selected": {
              backgroundColor:
                theme.palette.mode === "dark"
                  ? alpha(theme.palette.primary.main, 0.16)
                  : alpha(theme.palette.primary.main, 0.1),
            },
            "&.Mui-selected:hover": {
              backgroundColor:
                theme.palette.mode === "dark"
                  ? alpha(theme.palette.primary.main, 0.2)
                  : alpha(theme.palette.primary.main, 0.14),
            },
            "&:hover": {
              backgroundColor:
                theme.palette.mode === "dark"
                  ? alpha("#ffffff", 0.06)
                  : alpha("#0b1220", 0.03),
            },
          }),
        },
      },
    },
  });

const ScoreChart: React.FC<{ attempts: Attempt[] }> = ({ attempts }) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const hasAttempts = attempts.length > 0;

  const data = attempts.map((attempt, index) => ({
    attempt: index + 1,
    score: attempt.score,
    date: attempt.date,
    datetime: new Date(attempt.timestamp).toLocaleString(),
  }));

  const desiredWidth = attempts.length * 55;
  const minWidth = 100;
  const targetWidth = Math.max(desiredWidth, minWidth);
  const chartWidth =
    containerWidth > 0 ? Math.min(containerWidth, targetWidth) : targetWidth;

  return (
    <Box ref={containerRef} sx={{ width: "100%", height: 220 }}>
      {hasAttempts && chartWidth > 0 && (
        <LineChart
          width={chartWidth}
          height={200}
          data={data}
          margin={{ top: 20, right: 30, left: 10, bottom: 30 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="attempt"
            label={{ value: "Attempt #", position: "insideBottom", offset: -5 }}
          />
          <YAxis
            domain={[0, 100]}
            label={{
              value: "Score",
              angle: -90,
              position: "insideLeft",
              offset: 10,
            }}
          />
          <Tooltip
            formatter={(value: any, name: any) => {
              if (name === "score") return [`${value}%`, "Score"];
              return [value, name];
            }}
            labelFormatter={(_label: any, payload: any) => {
              if (!payload || !payload[0]) return "";
              const p = payload[0].payload as any;
              return `Attempt #${p.attempt} — ${p.date} (${p.datetime})`;
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="score"
            name="Score"
            stroke="currentColor"
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      )}
    </Box>
  );
};

interface SortableAnswerProps {
  item: QAData;
  refMap: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  checkedAnswers: Record<string, boolean>;
  setCheckedAnswers: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
}

const SortableAnswer: React.FC<SortableAnswerProps> = ({
  item,
  refMap,
  checkedAnswers,
  setCheckedAnswers,
}) => {
  const { setNodeRef, attributes, listeners, transform, isDragging } =
    useSortable({ id: item.id });

  const isChecked = checkedAnswers[item.id] || false;

  const style: React.CSSProperties = {
    touchAction: "none",
    transform: CSS.Transform.toString(transform),
    transition: undefined,
    backgroundColor: isChecked
      ? "rgba(102, 226, 165, 0.25)"
      : isDragging
        ? "rgba(98, 214, 196, 0.20)"
        : "transparent",
    borderRadius: 14,
    padding: "8px 12px",
    boxShadow: isDragging ? "0 8px 18px rgba(0,0,0,0.25)" : undefined,
    cursor: "grab",
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    userSelect: "none",
  };

  const combinedRef = (el: HTMLDivElement | null) => {
    setNodeRef(el);
    refMap.current[item.id] = el;
  };

  return (
    <Paper
      ref={combinedRef}
      style={style}
      {...attributes}
      {...listeners}
      elevation={0}
      tabIndex={0}
      sx={{ backdropFilter: "blur(6px)" }}
    >
      <Checkbox
        checked={isChecked}
        color="success"
        onChange={(e) =>
          setCheckedAnswers((prev) => ({
            ...prev,
            [item.id]: e.target.checked,
          }))
        }
        onPointerDown={(e) => e.stopPropagation()}
      />
      {item.answers}
    </Paper>
  );
};

const StreakMarks: React.FC<{
  status: StreakStatus;
  hasAnyAttemptsEver: boolean;
}> = ({ status, hasAnyAttemptsEver }) => {
  const greenCount = Math.max(0, status.green);
  const cap = status.cap;

  const greenTip =
    greenCount === 0
      ? "No 100% streak yet"
      : `Streak level: ${greenCount} (next interval: ${nextIntervalDays(greenCount)} day${
          nextIntervalDays(greenCount) === 1 ? "" : "s"
        })`;

  const capTip =
    cap === "grey"
      ? "Due today (no attempts yet)"
      : cap === "yellow"
        ? "Attempted today but no 100% (due again tomorrow)"
        : "";

  return (
    <Box
      display="inline-flex"
      alignItems="center"
      sx={{ ml: 1, gap: 0.5, flexWrap: "wrap" }}
    >
      <MuiTooltip title={greenTip}>
        <Box display="inline-flex" alignItems="center" sx={{ gap: 0.25 }}>
          {Array.from({ length: greenCount }).map((_, idx) => (
            <Typography
              key={idx}
              component="span"
              sx={{ fontWeight: 900, fontSize: 14, color: "success.main" }}
            >
              ✓
            </Typography>
          ))}
        </Box>
      </MuiTooltip>

      {cap && (
        <MuiTooltip title={capTip}>
          <Typography
            component="span"
            sx={{
              fontWeight: 900,
              fontSize: 14,
              color: cap === "yellow" ? "warning.main" : "text.disabled",
            }}
          >
            ✓
          </Typography>
        </MuiTooltip>
      )}

      {!hasAnyAttemptsEver && greenCount === 0 && (
        <Typography
          component="span"
          sx={{ fontSize: 12, color: "text.secondary", ml: 0.5 }}
        >
          (start)
        </Typography>
      )}
    </Box>
  );
};

/** =========================
 *  ✅ Uploaded CSV management
 *  ========================= */
type UploadedCsv = {
  id: string;
  teacher: string;
  unit: string;
  label: string;
  filename: string;
  createdAt: number;
  csvText: string;
};

const UPLOADED_CSVS_KEY = "csvMatchUploadedCSVs_v1";

const loadUploadedCSVs = (): UploadedCsv[] => {
  try {
    const raw = localStorage.getItem(UPLOADED_CSVS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr as UploadedCsv[];
  } catch {
    return [];
  }
};

const saveUploadedCSVs = (items: UploadedCsv[]) => {
  try {
    localStorage.setItem(UPLOADED_CSVS_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
};

const makeUploadedUrl = (id: string) => `local://uploaded/${id}`;

const CSVMatchGame: React.FC = () => {
  const debug = MASTER_DEBUG;

  // theme mode (persisted)
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(THEME_MODE_KEY);
    return saved === "dark" || saved === "light" ? saved : "light";
  });
  useEffect(() => {
    try {
      localStorage.setItem(THEME_MODE_KEY, themeMode);
    } catch {
      // ignore
    }
  }, [themeMode]);

  const theme = useMemo(() => buildTheme(themeMode), [themeMode]);

  // ✅ now tick so system-time changes reflect quickly
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const todayKey = useMemo(() => toDateKey(nowTick), [nowTick]);

  const [checkedAnswers, setCheckedAnswers] = useState<Record<string, boolean>>(
    {},
  );
  const [masterQuestions, setMasterQuestions] = useState<QAData[]>([]);
  const [currentQuestions, setCurrentQuestions] = useState<QAData[]>([]);
  const [shuffledAnswers, setShuffledAnswers] = useState<QAData[]>([]);
  const [scorePercent, setScorePercent] = useState<number | null>(null);
  const [showSubmit, setShowSubmit] = useState(true);

  const [playerName, setPlayerName] = useState("");

  const [fileDisplayName, setFileDisplayName] = useState("");
  const [fileKey, setFileKey] = useState("");

  const [attempts, setAttempts] = useState<Attempt[]>([]);

  const [playerAccordionOpen, setPlayerAccordionOpen] = useState(true);
  const [openClassAccordionOpen, setOpenClassAccordionOpen] = useState(true);

  // ---- uploaded state ----
  const [uploadedCSVs, setUploadedCSVs] = useState<UploadedCsv[]>([]);
  const [uploadMetaTeacher, setUploadMetaTeacher] = useState("");
  const [uploadMetaUnit, setUploadMetaUnit] = useState("");
  const [uploadMetaLabel, setUploadMetaLabel] = useState("");
  const [manageAccordionOpen, setManageAccordionOpen] = useState(false);
  const [selectedUploadIds, setSelectedUploadIds] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    setUploadedCSVs(loadUploadedCSVs());
  }, []);

  // ---- localStorage tiny helpers ----
  const lsGet = (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  };
  const lsSet = (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      // ignore
    }
  };
  const lsDel = (k: string) => {
    try {
      localStorage.removeItem(k);
    } catch {
      // ignore
    }
  };

  // ✅ Load last player on refresh
  useEffect(() => {
    const saved = lsGet(LAST_PLAYER_KEY);
    if (saved) setPlayerName(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Save player name whenever it changes
  useEffect(() => {
    const name = playerName.trim();
    if (name) lsSet(LAST_PLAYER_KEY, name);
    else lsDel(LAST_PLAYER_KEY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerName]);

  /** merge hard-coded + uploaded into one library shape */
  const mergedLibrary: CsvLibrary = useMemo(() => {
    const base: CsvLibrary = JSON.parse(JSON.stringify(CSV_LIBRARY));

    for (const u of uploadedCSVs) {
      if (!base[u.teacher]) base[u.teacher] = {};
      if (!base[u.teacher][u.unit]) base[u.teacher][u.unit] = [];
      base[u.teacher][u.unit].push({
        label: u.label,
        url: makeUploadedUrl(u.id),
      });
    }

    return base;
  }, [uploadedCSVs]);

  // ---- Teacher/Unit persistence ----
  const teacherOptions = useMemo(
    () => Object.keys(mergedLibrary),
    [mergedLibrary],
  );

  const [selectedTeacher, setSelectedTeacher] = useState<string>(() => {
    const savedTeacher = localStorage.getItem(LAST_TEACHER_KEY);
    if (savedTeacher && CSV_LIBRARY[savedTeacher]) return savedTeacher;
    return Object.keys(CSV_LIBRARY)[0] ?? "";
  });

  const unitOptions = useMemo(() => {
    if (!selectedTeacher) return [];
    return Object.keys(mergedLibrary[selectedTeacher] ?? {});
  }, [selectedTeacher, mergedLibrary]);

  const [selectedUnit, setSelectedUnit] = useState<string>(() => {
    const savedTeacher = localStorage.getItem(LAST_TEACHER_KEY);
    const teacher =
      savedTeacher && mergedLibrary[savedTeacher]
        ? savedTeacher
        : (Object.keys(mergedLibrary)[0] ?? "");
    const units = Object.keys(mergedLibrary[teacher] ?? {});
    const savedUnit = localStorage.getItem(LAST_UNIT_KEY);
    if (savedUnit && units.includes(savedUnit)) return savedUnit;
    return units[0] ?? "";
  });

  const [selectedCsvUrl, setSelectedCsvUrl] = useState<string>("");

  useEffect(() => {
    if (!selectedTeacher) return;

    lsSet(LAST_TEACHER_KEY, selectedTeacher);

    const units = Object.keys(mergedLibrary[selectedTeacher] ?? {});
    if (!units.length) {
      setSelectedUnit("");
      lsDel(LAST_UNIT_KEY);
      return;
    }

    if (!units.includes(selectedUnit)) {
      setSelectedUnit(units[0]);
      lsSet(LAST_UNIT_KEY, units[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeacher, mergedLibrary]);

  useEffect(() => {
    if (!selectedTeacher || !selectedUnit) return;
    lsSet(LAST_UNIT_KEY, selectedUnit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUnit, selectedTeacher]);

  useEffect(() => {
    setSelectedCsvUrl("");
  }, [selectedUnit]);

  const csvList: CsvItem[] = useMemo(() => {
    if (!selectedTeacher || !selectedUnit) return [];
    return mergedLibrary[selectedTeacher]?.[selectedUnit] ?? [];
  }, [mergedLibrary, selectedTeacher, selectedUnit]);

  // ---- Attempts storage ----
  const getStorageKey = (fk: string, player: string) =>
    `${STORAGE_PREFIX}::${fk}::${player}`;

  const loadAttemptsFor = (fk: string, player: string): Attempt[] => {
    try {
      const raw = localStorage.getItem(getStorageKey(fk, player));
      if (!raw) return [];
      const parsed = JSON.parse(raw) as any[];
      return parsed
        .map((a) => {
          const timestamp =
            typeof a.timestamp === "number" ? a.timestamp : Date.now();
          const score = typeof a.score === "number" ? a.score : 0;
          const date = a.date ?? toDateKey(timestamp);
          return { timestamp, score, date } as Attempt;
        })
        .sort((a, b) => a.timestamp - b.timestamp);
    } catch {
      return [];
    }
  };

  useEffect(() => {
    if (!fileKey || !playerName) {
      setAttempts([]);
      return;
    }
    setAttempts(loadAttemptsFor(fileKey, playerName));
  }, [fileKey, playerName]);

  const recordAttempt = (score: number) => {
    if (!fileKey || !playerName) return;

    const now = Date.now();
    const dateKey = toDateKey(now);

    setAttempts((prev) => {
      const next: Attempt[] = [
        ...prev,
        { timestamp: now, score, date: dateKey },
      ];
      try {
        localStorage.setItem(
          getStorageKey(fileKey, playerName),
          JSON.stringify(next),
        );
      } catch (err) {
        console.error("Failed to save attempts", err);
      }
      return next;
    });
  };

  const attemptsToday = useMemo(
    () => attempts.filter((a) => a.date === todayKey),
    [attempts, todayKey],
  );

  function shuffleArray<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  const generateCurrentQuestionSet = (allQs: QAData[]) => {
    if (!allQs.length) {
      setCurrentQuestions([]);
      setShuffledAnswers([]);
      return;
    }

    const incorrect = allQs.filter((q) => !q.isCorrect);
    const correct = allQs.filter((q) => q.isCorrect);

    const targetCount = Math.min(10, allQs.length);

    const basePool = incorrect.length ? incorrect : allQs;
    const remainingSlots = Math.max(0, targetCount - basePool.length);
    const sampledCorrect = shuffleArray(correct).slice(0, remainingSlots);

    const mixed = [...basePool, ...sampledCorrect];
    const finalQuestions = shuffleArray(mixed).slice(0, targetCount);
    const finalAnswers = shuffleArray([...finalQuestions]);

    setCurrentQuestions(finalQuestions);
    setShuffledAnswers(finalAnswers);
    setScorePercent(null);
    setShowSubmit(true);
  };

  // ✅ each day starts with ALL correctness = false (no persistence)
  const parseAndStartQuiz = (rows: any[]) => {
    const parsedWithFlags: QAData[] = rows
      .filter(
        (row) => row.questions || row.answers || row.Questions || row.Answers,
      )
      .map((row, index) => ({
        id: row.id ?? String(index),
        questions: row.questions ?? row.Questions ?? "",
        answers: row.answers ?? row.Answers ?? "",
        isCorrect: false,
      }));

    setMasterQuestions(parsedWithFlags);
    generateCurrentQuestionSet(parsedWithFlags);
    setCheckedAnswers({});
  };

  // If player changes, do NOT carry correctness
  useEffect(() => {
    setMasterQuestions((prev) => prev.map((q) => ({ ...q, isCorrect: false })));
    setScorePercent(null);
    setShowSubmit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerName]);

  // ---- DnD ----
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
  );

  const answerRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = shuffledAnswers.findIndex((item) => item.id === active.id);
    const newIndex = shuffledAnswers.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newAnswers = [...shuffledAnswers];
    [newAnswers[oldIndex], newAnswers[newIndex]] = [
      newAnswers[newIndex],
      newAnswers[oldIndex],
    ];
    setShuffledAnswers(newAnswers);

    setCheckedAnswers((prev) => {
      const next = { ...prev };
      const movedId = String(active.id);
      const displacedId = String(over.id);
      next[movedId] = true;
      if (displacedId !== movedId) next[displacedId] = false;
      return next;
    });

    setTimeout(() => {
      const focusedItem = newAnswers[newIndex];
      const node = answerRefs.current[focusedItem.id];
      node?.focus();
    }, 0);
  };

  // ---- Streak + due/grey/yellow cap (linear intervals + countdown) ----
  const computeStreakStatus = (allAttempts: Attempt[], today: string) => {
    const byDate: Record<string, { attempted: boolean; got100: boolean }> = {};
    for (const a of allAttempts) {
      const k = a.date;
      if (!byDate[k]) byDate[k] = { attempted: false, got100: false };
      byDate[k].attempted = true;
      if (a.score === 100) byDate[k].got100 = true;
    }

    const hasAnyAttemptsEver = allAttempts.length > 0;

    // No attempts ever: due today with grey (Day 1 pre-anything)
    if (!hasAnyAttemptsEver) {
      const status: StreakStatus = {
        green: 0,
        cap: "grey",
        due: true,
        dueDate: today,
        daysUntilDue: 0,
      };
      return { status, hasAnyAttemptsEver };
    }

    const dates = Object.keys(byDate).sort();
    const start = dates[0] ?? today;

    let green = 0;
    let dueDate = start; // due immediately at the very beginning

    // Simulate up to yesterday only (no "today" decay before they act)
    const yesterday = addDaysKey(today, -1);
    let d = start;

    while (d <= yesterday) {
      const info = byDate[d];
      const isDueThatDay = d >= dueDate;

      if (isDueThatDay) {
        if (info?.attempted) {
          if (info.got100) {
            green += 1;
            dueDate = addDaysKey(d, nextIntervalDays(green));
          } else {
            dueDate = addDaysKey(d, 1);
          }
        } else {
          green = Math.max(0, green - 1);
          dueDate = d; // stay due
        }
      } else {
        // not due yet; but if they get 100 anyway, treat as win and reset schedule
        if (info?.attempted && info.got100) {
          green += 1;
          dueDate = addDaysKey(d, nextIntervalDays(green));
        }
      }

      d = addDaysKey(d, 1);
    }

    // Start-of-day due for today (used ONLY for cap/decay logic)
    const dueAtStartToday = today >= dueDate;

    const todayInfo = byDate[today];
    const attemptedToday = !!todayInfo?.attempted;
    const got100Today = !!todayInfo?.got100;

    let cap: CapState = null;

    // Apply TODAY outcome (this updates dueDate/green)
    if (dueAtStartToday) {
      if (!attemptedToday) {
        cap = "grey";
        // dueDate stays today
      } else if (got100Today) {
        green += 1;
        dueDate = addDaysKey(today, nextIntervalDays(green));
        cap = null;
      } else {
        cap = "yellow";
        dueDate = addDaysKey(today, 1);
      }
    } else {
      // Not due at start; if they still got 100 today, count it as a win
      if (attemptedToday && got100Today) {
        green += 1;
        dueDate = addDaysKey(today, nextIntervalDays(green));
      }
      cap = null;
    }

    // ✅ CURRENT due (after applying today outcome)
    const dueNow = today >= dueDate;

    const daysUntilDue = Math.max(0, daysBetweenKeys(today, dueDate));

    const status: StreakStatus = {
      green,
      cap,
      due: dueNow,
      dueDate,
      daysUntilDue,
    };
    return { status, hasAnyAttemptsEver };
  };

  const streakStatusByUrl = useMemo(() => {
    const out: Record<
      string,
      { status: StreakStatus; hasAnyAttemptsEver: boolean } | null
    > = {};
    if (!playerName) {
      for (const item of csvList) out[item.url] = null;
      return out;
    }
    for (const item of csvList) {
      const all = loadAttemptsFor(item.url, playerName);
      out[item.url] = computeStreakStatus(all, todayKey);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csvList, playerName, todayKey, attempts]);

  const sortedCsvList: CsvItem[] = useMemo(() => {
    // If we don't know the player, we can't compute due timing meaningfully.
    if (!playerName) return csvList;

    const withMeta = csvList.map((c, idx) => {
      const pack = streakStatusByUrl[c.url];
      const daysUntilDue =
        pack?.status?.daysUntilDue ?? Number.POSITIVE_INFINITY;

      const isDueNow = !!pack?.status?.due;

      return { c, idx, daysUntilDue, isDueNow };
    });

    withMeta.sort((a, b) => {
      // 1) due sooner first (0 = due today)
      if (a.daysUntilDue !== b.daysUntilDue)
        return a.daysUntilDue - b.daysUntilDue;

      // 2) if tied, due-now items first
      if (a.isDueNow !== b.isDueNow) return a.isDueNow ? -1 : 1;

      // 3) keep original order stable
      return a.idx - b.idx;
    });

    return withMeta.map((x) => x.c);
  }, [csvList, playerName, streakStatusByUrl]);

  const loadCsvFromUrl = async (url: string, labelForDisplay: string) => {
    try {
      setFileDisplayName(labelForDisplay);
      setFileKey(url); // stable key for localStorage across builds

      // ✅ Uploaded CSV
      if (url.startsWith("local://uploaded/")) {
        const id = url.replace("local://uploaded/", "");
        const found = uploadedCSVs.find((u) => u.id === id);
        if (!found) throw new Error("Uploaded CSV not found in localStorage.");

        const parsed = Papa.parse(found.csvText, {
          header: true,
          skipEmptyLines: true,
        });
        if (parsed.errors?.length)
          console.warn("CSV parse warnings:", parsed.errors);

        parseAndStartQuiz((parsed.data as any[]) ?? []);
        setOpenClassAccordionOpen(false);
        return;
      }

      // ✅ Public CSV
      const finalUrl = withPublicUrl(url);

      const res = await fetch(finalUrl, { cache: "no-cache" });
      const text = await res.text();

      const looksLikeHtml = /^\s*</.test(text) && /<html|<!doctype/i.test(text);

      if (!res.ok || looksLikeHtml) {
        console.error("CSV fetch failed / returned HTML:", {
          requestedUrl: url,
          finalUrl,
          status: res.status,
          preview: text.slice(0, 200),
        });
        throw new Error(
          `Could not load CSV. HTTP=${res.status}. URL=${finalUrl}.` +
            (looksLikeHtml ? " Got HTML fallback." : ""),
        );
      }

      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      if (parsed.errors?.length)
        console.warn("CSV parse warnings:", parsed.errors);

      parseAndStartQuiz((parsed.data as any[]) ?? []);
      setOpenClassAccordionOpen(false);
    } catch (err) {
      console.error("Failed to load CSV:", err);
      alert(`Could not load that CSV.\n\n${String(err)}`);
    }
  };

  const handleManagedUpload = async (file: File) => {
    const teacher = uploadMetaTeacher.trim();
    const unit = uploadMetaUnit.trim();
    const label = uploadMetaLabel.trim();

    if (!teacher || !unit || !label) {
      alert("Please enter Teacher, Unit, and Label before uploading.");
      return;
    }

    const csvText = await file.text();

    const newItem: UploadedCsv = {
      id:
        crypto?.randomUUID?.() ??
        `u_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      teacher,
      unit,
      label,
      filename: file.name,
      createdAt: Date.now(),
      csvText,
    };

    setUploadedCSVs((prev) => {
      const next = [...prev, newItem];
      saveUploadedCSVs(next);
      return next;
    });

    // open it right away
    setSelectedTeacher(teacher);
    setSelectedUnit(unit);
    const uUrl = makeUploadedUrl(newItem.id);
    setSelectedCsvUrl(uUrl);
    loadCsvFromUrl(uUrl, label);

    setOpenClassAccordionOpen(false);
    setUploadMetaLabel("");
  };

  const handleSubmit = () => {
    if (fileKey && playerName && attemptsToday.length >= MAX_TRIES_PER_DAY) {
      alert(
        `Daily limit reached: ${MAX_TRIES_PER_DAY} attempts per day for this player & file.`,
      );
      return;
    }

    const updated = masterQuestions.map((q) => {
      const i = currentQuestions.findIndex((cq) => cq.id === q.id);
      if (i === -1) return q;
      const answerItem = shuffledAnswers[i];
      const isCorrect = q.answers.trim() === (answerItem?.answers ?? "").trim();
      return { ...q, isCorrect };
    });

    setMasterQuestions(updated);

    const totalCount = updated.length || 1;
    const correctCount = updated.filter((q) => q.isCorrect).length;
    const newScore = Math.round((correctCount / totalCount) * 100);

    setScorePercent(newScore);
    recordAttempt(newScore);
    setShowSubmit(false);
  };

  const handleKeepGoing = () => {
    generateCurrentQuestionSet(masterQuestions);
    setCheckedAnswers({});
    setShowSubmit(true);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        p={3}
        sx={{
          minHeight: "100vh",
          background:
            themeMode === "dark"
              ? `radial-gradient(1200px 600px at 20% 10%, rgba(98,214,196,0.12), transparent 55%),
                 radial-gradient(1000px 500px at 90% 25%, rgba(183,166,255,0.10), transparent 55%),
                 radial-gradient(1000px 500px at 60% 100%, rgba(255,211,110,0.08), transparent 55%)`
              : `radial-gradient(1200px 600px at 20% 10%, rgba(14,165,165,0.12), transparent 55%),
                 radial-gradient(1000px 500px at 90% 25%, rgba(109,40,217,0.08), transparent 55%),
                 radial-gradient(1000px 500px at 60% 100%, rgba(245,158,11,0.06), transparent 55%)`,
        }}
      >
        {/* Header */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 2,
            borderRadius: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
              CSV Match Game
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Drag answers to match questions • track attempts • spaced
              repetition streaks
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              size="small"
              label={themeMode === "dark" ? "Dark" : "Light"}
              variant="outlined"
            />
            <MuiTooltip title="Toggle light/dark mode">
              <IconButton
                onClick={() =>
                  setThemeMode((m) => (m === "dark" ? "light" : "dark"))
                }
                color="primary"
              >
                {themeMode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </MuiTooltip>
          </Stack>
        </Paper>

        {/* Player + Graph Accordion */}
        <Accordion
          expanded={playerAccordionOpen}
          onChange={(_, ex) => setPlayerAccordionOpen(ex)}
          sx={{ mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Player & Progress</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Paper elevation={0} sx={{ p: 0 }}>
              <Box
                display="flex"
                flexWrap="wrap"
                gap={2}
                alignItems="center"
                mb={2}
              >
                <TextField
                  label="Player name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                />
                <Typography variant="body2" color="text.secondary">
                  File: {fileDisplayName || "—"}
                </Typography>
                {fileKey && playerName && (
                  <Typography variant="body2" color="text.secondary">
                    Today ({todayKey}) attempts: {attemptsToday.length} /{" "}
                    {MAX_TRIES_PER_DAY}
                  </Typography>
                )}
              </Box>

              <Typography variant="subtitle1" gutterBottom>
                Results over time (every attempt)
              </Typography>

              {!playerName || !fileKey ? (
                <Typography variant="body2" color="text.secondary">
                  Enter a player name and open a file to track attempts.
                </Typography>
              ) : attempts.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No attempts recorded yet.
                </Typography>
              ) : (
                <ScoreChart attempts={attempts} />
              )}
            </Paper>
          </AccordionDetails>
        </Accordion>

        {/* Open Class Accordion */}
        <Accordion
          expanded={openClassAccordionOpen}
          onChange={(_, ex) => setOpenClassAccordionOpen(ex)}
          sx={{ mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Open a Class</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Paper elevation={0} sx={{ p: 0 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Teacher</InputLabel>
                    <Select
                      label="Teacher"
                      value={selectedTeacher}
                      onChange={(e) =>
                        setSelectedTeacher(String(e.target.value))
                      }
                    >
                      {teacherOptions.map((t) => (
                        <MenuItem key={t} value={t}>
                          {t}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl
                    fullWidth
                    size="small"
                    disabled={!selectedTeacher}
                  >
                    <InputLabel>Unit</InputLabel>
                    <Select
                      label="Unit"
                      value={selectedUnit}
                      onChange={(e) => setSelectedUnit(String(e.target.value))}
                    >
                      {unitOptions.map((u) => (
                        <MenuItem key={u} value={u}>
                          {u}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              {/* Upload metadata + upload */}
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 2 }}>
                <TextField
                  label="Teacher (for upload)"
                  value={uploadMetaTeacher}
                  onChange={(e) => setUploadMetaTeacher(e.target.value)}
                />
                <TextField
                  label="Unit (for upload)"
                  value={uploadMetaUnit}
                  onChange={(e) => setUploadMetaUnit(e.target.value)}
                />
                <TextField
                  label="Label / Name (for upload)"
                  value={uploadMetaLabel}
                  onChange={(e) => setUploadMetaLabel(e.target.value)}
                />
              </Box>

              <Button variant="contained" component="label" sx={{ mb: 2 }}>
                Upload CSV (saved locally)
                <input
                  type="file"
                  accept=".csv"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    handleManagedUpload(file);
                    e.target.value = "";
                  }}
                />
              </Button>

              <Typography
                variant="subtitle2"
                color="text.secondary"
                gutterBottom
              >
                Quiz list{" "}
                {playerName
                  ? `(streak + due countdown for ${playerName})`
                  : `(enter player name to see streaks)`}
              </Typography>

              {csvList.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No CSVs listed for this teacher/unit yet.
                </Typography>
              ) : (
                <List dense sx={{ maxHeight: 260, overflow: "auto" }}>
                  {sortedCsvList.map((c) => {
                    const pack = playerName ? streakStatusByUrl[c.url] : null;
                    const ss = pack?.status ?? null;
                    const hasAnyAttemptsEver =
                      pack?.hasAnyAttemptsEver ?? false;

                    const waitingText =
                      ss && ss.due
                        ? "Due today"
                        : ss && ss.daysUntilDue > 0
                          ? `${ss.daysUntilDue} day${
                              ss.daysUntilDue === 1 ? "" : "s"
                            } until due`
                          : "";

                    return (
                      <ListItemButton
                        key={c.url}
                        selected={selectedCsvUrl === c.url}
                        onClick={() => {
                          setSelectedCsvUrl(c.url);
                          loadCsvFromUrl(c.url, c.label);
                          setOpenClassAccordionOpen(false);
                        }}
                        sx={{
                          outline: ss?.cap
                            ? `1px dashed ${alpha("#000", 0.25)}`
                            : "none",
                          outlineOffset: ss?.cap ? "2px" : undefined,
                        }}
                      >
                        <Radio checked={selectedCsvUrl === c.url} />
                        <ListItemText
                          primary={
                            <Box
                              display="flex"
                              alignItems="center"
                              flexWrap="wrap"
                            >
                              <Typography component="span">
                                {c.label}
                              </Typography>

                              {playerName && ss && (
                                <StreakMarks
                                  status={ss}
                                  hasAnyAttemptsEver={hasAnyAttemptsEver}
                                />
                              )}

                              {playerName && ss && (
                                <Typography
                                  component="span"
                                  sx={{
                                    ml: 1,
                                    fontSize: 12,
                                    color: ss.due
                                      ? "text.primary"
                                      : "text.secondary",
                                  }}
                                >
                                  {waitingText}
                                </Typography>
                              )}
                            </Box>
                          }
                          secondary={c.url}
                          secondaryTypographyProps={{
                            sx: { fontFamily: "monospace" },
                          }}
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              )}
            </Paper>
          </AccordionDetails>
        </Accordion>

        {/* Manage Uploaded CSVs */}
        <Accordion
          expanded={manageAccordionOpen}
          onChange={(_, ex) => setManageAccordionOpen(ex)}
          sx={{ mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Manage Uploaded CSVs</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {uploadedCSVs.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No uploaded CSVs saved yet.
              </Typography>
            ) : (
              <>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      const all: Record<string, boolean> = {};
                      for (const u of uploadedCSVs) all[u.id] = true;
                      setSelectedUploadIds(all);
                    }}
                  >
                    Select all
                  </Button>

                  <Button
                    variant="outlined"
                    onClick={() => setSelectedUploadIds({})}
                  >
                    Clear selection
                  </Button>

                  <Button
                    color="error"
                    variant="contained"
                    onClick={() => {
                      const ids = Object.keys(selectedUploadIds).filter(
                        (k) => selectedUploadIds[k],
                      );
                      if (ids.length === 0) {
                        alert("Select one or more uploaded files to delete.");
                        return;
                      }

                      setUploadedCSVs((prev) => {
                        const next = prev.filter((u) => !ids.includes(u.id));
                        saveUploadedCSVs(next);
                        return next;
                      });

                      setSelectedUploadIds({});
                    }}
                  >
                    Delete selected
                  </Button>

                  <Button
                    color="error"
                    variant="outlined"
                    onClick={() => {
                      if (
                        !window.confirm(
                          "Remove ALL uploaded CSVs? (Hard-coded ones stay)",
                        )
                      )
                        return;
                      setUploadedCSVs([]);
                      saveUploadedCSVs([]);
                      setSelectedUploadIds({});
                    }}
                  >
                    Remove all uploaded
                  </Button>
                </Box>

                <List dense sx={{ maxHeight: 260, overflow: "auto" }}>
                  {uploadedCSVs
                    .slice()
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .map((u) => {
                      const checked = !!selectedUploadIds[u.id];
                      return (
                        <ListItemButton
                          key={u.id}
                          onClick={() =>
                            setSelectedUploadIds((prev) => ({
                              ...prev,
                              [u.id]: !prev[u.id],
                            }))
                          }
                        >
                          <Checkbox checked={checked} />
                          <ListItemText
                            primary={`${u.label}  (${u.teacher} → ${u.unit})`}
                            secondary={`${u.filename} • ${new Date(
                              u.createdAt,
                            ).toLocaleString()}`}
                          />
                        </ListItemButton>
                      );
                    })}
                </List>
              </>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Debug */}
        {debug && (
          <Box mt={2}>
            <Typography variant="subtitle1" gutterBottom>
              🔍 Master Question Debug View
            </Typography>
            <Paper
              elevation={0}
              sx={{ p: 1, display: "flex", flexWrap: "wrap", gap: 1 }}
            >
              {masterQuestions.map((q, i) => (
                <Box
                  key={q.id}
                  sx={{
                    px: 1,
                    py: 0.5,
                    bgcolor: q.isCorrect
                      ? alpha(theme.palette.success.main, 0.25)
                      : alpha(theme.palette.error.main, 0.2),
                    border:
                      theme.palette.mode === "dark"
                        ? `1px solid ${alpha("#fff", 0.1)}`
                        : `1px solid ${alpha("#000", 0.1)}`,
                    borderRadius: 2,
                    fontSize: "0.75rem",
                    userSelect: "none",
                    fontWeight: 800,
                  }}
                >
                  {i + 1}. {q.isCorrect ? "✔" : "✘"}
                </Box>
              ))}
            </Paper>
          </Box>
        )}

        {/* Quiz */}
        {currentQuestions.length > 0 && (
          <Box mt={3}>
            <Box mb={2}>
              {scorePercent !== null && (
                <>
                  <Typography
                    variant="body1"
                    gutterBottom
                    sx={{ fontWeight: 800 }}
                  >
                    Score: {scorePercent}%
                  </Typography>
                  <LinearProgress variant="determinate" value={scorePercent} />
                </>
              )}
            </Box>

            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>

            {showSubmit ? (
              <Button
                variant="contained"
                color="primary"
                onClick={handleSubmit}
                sx={{ mb: 2, mr: 2 }}
              >
                Submit
              </Button>
            ) : (
              <Button
                variant="contained"
                color="secondary"
                onClick={handleKeepGoing}
                sx={{ mb: 2, mr: 2 }}
              >
                Keep Going!
              </Button>
            )}
            </Box>

            <Paper
              elevation={0}
              sx={{
                p: 2,
                userSelect: "none",
                WebkitUserSelect: "none",
                msUserSelect: "none",
                borderRadius: 2,
              }}
            >
              <Grid container>
                <Grid item xs={6}>
                  <Typography variant="h6">Questions</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="h6">Answers (Drag to Match)</Typography>
                </Grid>
              </Grid>

              <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <SortableContext
                  items={shuffledAnswers.map((a) => a.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {currentQuestions.map((q, i) => {
                    const ans = shuffledAnswers[i];

                    return (
                      <Grid
                        container
                        key={q.id}
                        spacing={2}
                        alignItems="center"
                        sx={{ mt: 1 }}
                      >
                        <Grid item xs={6}>
                          <Typography sx={{ userSelect: "none" }}>
                            {q.questions}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          {ans && (
                            <SortableAnswer
                              item={ans}
                              refMap={answerRefs}
                              checkedAnswers={checkedAnswers}
                              setCheckedAnswers={setCheckedAnswers}
                            />
                          )}
                        </Grid>
                      </Grid>
                    );
                  })}
                </SortableContext>
              </DndContext>
            </Paper>
            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
              {showSubmit ? (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSubmit}
                >
                  Submit
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={handleKeepGoing}
                >
                  Keep Going!
                </Button>
              )}
            </Box>
          </Box>
        )}
      </Box>
    </ThemeProvider>
  );
};

export default CSVMatchGame;
