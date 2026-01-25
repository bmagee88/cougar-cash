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
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
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

// ✅ Your library
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
    backgroundColor: isChecked ? "#d0f0c0" : isDragging ? "#e3f2fd" : "white",
    borderRadius: 4,
    padding: "8px 12px",
    boxShadow: isDragging ? "0 2px 6px rgba(0,0,0,0.2)" : undefined,
    cursor: "grab",
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "8px",
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
      elevation={2}
      tabIndex={0}
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
              sx={{ fontWeight: 900, fontSize: 14, color: "#2e7d32" }}
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
              color: cap === "yellow" ? "#f9a825" : "#9e9e9e",
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

const CSVMatchGame: React.FC = () => {
  const debug = MASTER_DEBUG;

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

  // ---- Teacher/Unit persistence ----
  const teacherOptions = useMemo(() => Object.keys(CSV_LIBRARY), []);

  const [selectedTeacher, setSelectedTeacher] = useState<string>(() => {
    const savedTeacher = lsGet(LAST_TEACHER_KEY);
    if (savedTeacher && CSV_LIBRARY[savedTeacher]) return savedTeacher;
    return teacherOptions[0] ?? "";
  });

  const unitOptions = useMemo(() => {
    if (!selectedTeacher) return [];
    return Object.keys(CSV_LIBRARY[selectedTeacher] ?? {});
  }, [selectedTeacher]);

  const [selectedUnit, setSelectedUnit] = useState<string>(() => {
    const savedTeacher = lsGet(LAST_TEACHER_KEY);
    const teacher =
      savedTeacher && CSV_LIBRARY[savedTeacher]
        ? savedTeacher
        : (Object.keys(CSV_LIBRARY)[0] ?? "");
    const units = Object.keys(CSV_LIBRARY[teacher] ?? {});
    const savedUnit = lsGet(LAST_UNIT_KEY);
    if (savedUnit && units.includes(savedUnit)) return savedUnit;
    return units[0] ?? "";
  });

  const [selectedCsvUrl, setSelectedCsvUrl] = useState<string>("");

  useEffect(() => {
    if (!selectedTeacher) return;

    lsSet(LAST_TEACHER_KEY, selectedTeacher);

    const units = Object.keys(CSV_LIBRARY[selectedTeacher] ?? {});
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
  }, [selectedTeacher]);

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
    return CSV_LIBRARY[selectedTeacher]?.[selectedUnit] ?? [];
  }, [selectedTeacher, selectedUnit]);

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileDisplayName(file.name);
    setFileKey(file.name); // localStorage key for uploads

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: Papa.ParseResult<any>) => {
        parseAndStartQuiz(results.data as any[]);
        setOpenClassAccordionOpen(false);
      },
      error: (err) => {
        console.error("CSV parse error:", err);
        alert("Could not parse that CSV. Check the file format/headers.");
      },
    });

    e.target.value = "";
  };

  const loadCsvFromUrl = async (url: string, labelForDisplay: string) => {
    try {
      setFileDisplayName(labelForDisplay);
      setFileKey(url); // stable key for localStorage across builds

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
      alert(
        `Could not load that CSV.\n\n` +
          `Make sure it exists in /public${url}\n` +
          `AND the folder/file casing matches EXACTLY.\n\n` +
          `Tried: ${withPublicUrl(url)}`,
      );
    }
  };

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
  // ✅ FIX: after earning a green check today, "due" becomes false immediately and countdown shows.
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
    <Box p={3}>
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
                size="small"
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
                    onChange={(e) => setSelectedTeacher(String(e.target.value))}
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
                <FormControl fullWidth size="small" disabled={!selectedTeacher}>
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

            <Button variant="contained" component="label" sx={{ mb: 2 }}>
              Upload CSV (from computer)
              <input
                type="file"
                accept=".csv"
                hidden
                onChange={handleFileUpload}
              />
            </Button>

            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
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
                  const hasAnyAttemptsEver = pack?.hasAnyAttemptsEver ?? false;

                  // ✅ show countdown right away after a 100% win (due becomes false immediately now)
                  const waitingText =
                    ss && ss.due
                      ? "Due today"
                      : ss && ss.daysUntilDue > 0
                        ? `${ss.daysUntilDue} day${ss.daysUntilDue === 1 ? "" : "s"} until due`
                        : "";

                  return (
                    <ListItemButton
                      key={c.url}
                      selected={selectedCsvUrl === c.url}
                      onClick={() => {
                        setSelectedCsvUrl(c.url);
                        loadCsvFromUrl(c.url, c.label); // auto-load
                        setOpenClassAccordionOpen(false); // minimize accordion on select
                      }}
                      sx={{
                        borderRadius: 1,
                        outline: ss?.cap
                          ? "1px dashed rgba(0,0,0,0.25)"
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
                            <Typography component="span">{c.label}</Typography>

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

      {/* Debug */}
      {debug && (
        <Box mt={2}>
          <Typography variant="subtitle1" gutterBottom>
            🔍 Master Question Debug View
          </Typography>
          <Paper
            elevation={1}
            sx={{ p: 1, display: "flex", flexWrap: "wrap", gap: 1 }}
          >
            {masterQuestions.map((q, i) => (
              <Box
                key={q.id}
                sx={{
                  px: 1,
                  py: 0.5,
                  bgcolor: q.isCorrect ? "success.light" : "error.light",
                  color: "black",
                  borderRadius: 1,
                  fontSize: "0.75rem",
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
                <Typography variant="body1" gutterBottom>
                  Score: {scorePercent}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={scorePercent}
                  sx={{ height: 10, borderRadius: 5, mb: 2 }}
                />
              </>
            )}
          </Box>

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

          <Paper elevation={3} sx={{ p: 2, userSelect: "none" }}>
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
                  const answerItem = shuffledAnswers[i];
                  return (
                    <Grid
                      container
                      key={q.id}
                      spacing={2}
                      alignItems="center"
                      sx={{ mt: 1 }}
                    >
                      <Grid item xs={6}>
                        <Typography>{q.questions}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        {answerItem && (
                          <SortableAnswer
                            item={answerItem}
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
        </Box>
      )}
    </Box>
  );
};

export default CSVMatchGame;
