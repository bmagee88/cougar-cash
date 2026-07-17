import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  CssBaseline,
  Divider,
  FormControl,
  InputLabel,
  LinearProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Tabs,
  TextField,
  ThemeProvider,
  Tooltip,
  Typography,
  alpha,
  createTheme,
} from "@mui/material";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BarChartIcon from "@mui/icons-material/BarChart";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import LogoutIcon from "@mui/icons-material/Logout";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import QuizIcon from "@mui/icons-material/Quiz";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SettingsIcon from "@mui/icons-material/Settings";
import TodayIcon from "@mui/icons-material/Today";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiGet, apiPost, ApiError } from "./api";
import {
  CQuiz2View,
  DashboardResponse,
  QuizAttempt,
  QuizSummary,
  RoundAnswer,
  RoundQuestion,
  RoundResponse,
  SessionResponse,
  SubmitRoundResponse,
  TeacherDashboardResponse,
  TeacherQuizSummary,
  TeacherStudentSummary,
} from "./types";

declare global {
  interface Window {
    google?: any;
  }
}

const idleTimeoutMs = 20 * 60 * 1000;

const theme = createTheme({
  palette: {
    primary: { main: "#0f766e" },
    secondary: { main: "#4338ca" },
    success: { main: "#16803c" },
    warning: { main: "#b77905" },
    background: {
      default: "#f5f7fb",
      paper: "#ffffff",
    },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h5: { fontWeight: 800 },
    h6: { fontWeight: 800 },
    button: { fontWeight: 700, textTransform: "none" },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none", borderRadius: 8 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid rgba(15, 23, 42, 0.08)",
        },
      },
    },
  },
});

type NavItem = { id: CQuiz2View; label: string; icon: React.ReactNode };

const studentNavItems: NavItem[] = [
  { id: "account", label: "Account", icon: <AccountCircleIcon /> },
  { id: "due", label: "Due Today", icon: <TodayIcon /> },
  { id: "quizzes", label: "Quizzes", icon: <QuizIcon /> },
  { id: "scores", label: "Scores", icon: <BarChartIcon /> },
  { id: "settings", label: "Settings", icon: <SettingsIcon /> },
];

const teacherNavItems: NavItem[] = [
  { id: "account", label: "Account", icon: <AccountCircleIcon /> },
  { id: "teacher-create", label: "Create", icon: <QuizIcon /> },
  { id: "teacher-data", label: "Data", icon: <BarChartIcon /> },
  { id: "settings", label: "Settings", icon: <SettingsIcon /> },
];

const isTeacherUser = (user: SessionResponse["user"]) =>
  user?.role === "teacher" || user?.role === "admin";

const unique = <T,>(values: T[]) =>
  Array.from(new Set(values.filter((value) => value !== null && value !== undefined)));

const formatQuizNumber = (value: number | null | undefined) =>
  value == null ? "" : String(value);

const formatGradeLevel = (value: number | null | undefined) =>
  value == null ? "Unassigned" : `Grade ${value}`;

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const formatDueText = (due: boolean, daysUntilDue: number) => {
  if (due || daysUntilDue <= 0) return "due today";
  return `${daysUntilDue} ${daysUntilDue === 1 ? "day" : "days"} till due`;
};

const compareText = (left: unknown, right: unknown) =>
  String(left || "").localeCompare(String(right || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });

const compareNumber = (left: unknown, right: unknown) =>
  Number(left ?? -1) - Number(right ?? -1);

const weekKey = (dateKey: string) => {
  const date = new Date(`${dateKey}T12:00:00`);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date.toISOString().slice(0, 10);
};

const groupGreenChecks = (
  quizzes: QuizSummary[],
  range: "daily" | "weekly" | "monthly",
) => {
  const counts = new Map<string, number>();
  quizzes.forEach((quiz) => {
    quiz.attempts.forEach((attempt) => {
      if (attempt.score !== 100) return;
      const key =
        range === "monthly"
          ? attempt.attemptDate.slice(0, 7)
          : range === "weekly"
            ? weekKey(attempt.attemptDate)
            : attempt.attemptDate;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, checks]) => ({ period, checks }));
};

const formatChartDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });

const totalGreenChecks = (quizzes: QuizSummary[]) =>
  quizzes.reduce((total, quiz) => total + quiz.greenChecks, 0);

const buildCheckStatusHistory = (quizzes: QuizSummary[], today: string) => {
  const dates = new Set<string>([today]);

  quizzes.forEach((quiz) => {
    if (quiz.dueDate) {
      const dueDate = quiz.dueDate.slice(0, 10);
      if (dueDate <= today) dates.add(dueDate);
    }
    quiz.attempts.forEach((attempt) => dates.add(attempt.attemptDate));
  });

  return Array.from(dates)
    .filter((date) => Boolean(date) && date <= today)
    .sort((a, b) => a.localeCompare(b))
    .map((date) => {
      let grey = 0;
      let yellow = 0;
      let green = 0;

      quizzes.forEach((quiz) => {
        const attemptsOnDate = quiz.attempts.filter(
          (attempt) => attempt.attemptDate === date,
        );
        if (attemptsOnDate.some((attempt) => attempt.score === 100)) {
          green += 1;
        } else if (attemptsOnDate.length) {
          yellow += 1;
        } else if (quiz.dueDate && quiz.dueDate.slice(0, 10) <= date) {
          grey += 1;
        }
      });

      return { date, grey, yellow, green };
    });
};

const GoogleSignInButton: React.FC<{ signedIn: boolean }> = ({ signedIn }) => {
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";

  useEffect(() => {
    if (signedIn || !clientId || !buttonRef.current) return;

    let cancelled = false;
    const render = () => {
      if (cancelled || !window.google || !buttonRef.current) return;
      buttonRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: clientId,
        login_uri: `${window.location.origin}/.netlify/functions/c-quiz-2-auth`,
        ux_mode: "redirect",
        auto_select: false,
        use_fedcm_for_prompt: true,
        use_fedcm_for_button: true,
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: "standard",
        theme: "outline",
        size: "medium",
        shape: "rectangular",
        text: "signin_with",
      });
      window.google.accounts.id.prompt();
    };

    const existing = document.getElementById("google-identity-services");
    if (existing) {
      render();
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement("script");
    script.id = "google-identity-services";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = render;
    document.head.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [clientId, signedIn]);

  if (signedIn) return null;

  if (!clientId) {
    return (
      <Tooltip title="Set REACT_APP_GOOGLE_CLIENT_ID to enable Google sign-in.">
        <span>
          <Button disabled variant="outlined">
            Sign in
          </Button>
        </span>
      </Tooltip>
    );
  }

  return <Box ref={buttonRef} sx={{ minWidth: 190, minHeight: 40 }} />;
};

const CheckSymbols: React.FC<{
  count: number;
  color?: "success" | "warning";
  label?: string;
}> = ({ count, color = "success", label = "total checks" }) => (
  <Stack
    direction="row"
    spacing={1}
    alignItems="center"
    justifyContent="flex-end"
    aria-label={`${count} ${label}`}
  >
    {!!count && (
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "flex-end",
          gap: 0.25,
          maxWidth: { xs: 150, sm: 220, lg: 280 },
          lineHeight: 0,
        }}
      >
        {Array.from({ length: count }).map((_, index) => (
          <CheckCircleIcon
            key={index}
            color={color}
            sx={{ fontSize: 16, flex: "0 0 auto" }}
          />
        ))}
      </Box>
    )}
    <Typography component="span" sx={{ minWidth: 24, fontWeight: 800 }}>
      {count}
    </Typography>
  </Stack>
);

const EmptyState: React.FC<{ title: string; detail: string }> = ({ title, detail }) => (
  <Paper elevation={0} sx={{ p: 3 }}>
    <Typography variant="h6">{title}</Typography>
    <Typography color="text.secondary" sx={{ mt: 0.5 }}>
      {detail}
    </Typography>
  </Paper>
);

const AttemptScoreChart: React.FC<{ attempts: QuizAttempt[] }> = ({ attempts }) => {
  const data = attempts.map((attempt, index) => ({
    attempt: index + 1,
    score: attempt.score,
    date: attempt.attemptDate,
    label: formatDateTime(attempt.createdAt),
  }));

  return (
    <Box sx={{ height: 320 }}>
      {data.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 16, right: 24, left: 6 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="attempt" allowDecimals={false} />
            <YAxis domain={[0, 100]} />
            <RechartsTooltip
              formatter={(value) => [`${value}%`, "Score"]}
              labelFormatter={(label) => `Attempt ${label}`}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#4338ca"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <EmptyState title="No attempts for this quiz" detail="Attempt scores will appear after submissions." />
      )}
    </Box>
  );
};

const CheckStatusChart: React.FC<{
  title: string;
  data: Array<{ date: string; grey: number; yellow: number; green: number }>;
  dueCount: number;
  totalChecks: number;
}> = ({ title, data, dueCount, totalChecks }) => (
  <Paper elevation={0} sx={{ p: 2, minHeight: 240 }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="h6">{title}</Typography>
      <Stack direction="row" spacing={0.75} alignItems="center">
        <Chip size="small" icon={<TodayIcon />} label={`${dueCount} due`} />
        <Chip
          size="small"
          icon={<CheckCircleIcon />}
          color="success"
          variant="outlined"
          label={`${totalChecks} total`}
        />
      </Stack>
    </Stack>
    <Box sx={{ height: 170, mt: 1 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tickFormatter={formatChartDate} minTickGap={24} />
          <YAxis allowDecimals={false} />
          <RechartsTooltip labelFormatter={(label) => formatChartDate(String(label))} />
          <Legend verticalAlign="top" height={28} />
          <Line
            type="monotone"
            dataKey="grey"
            name="Not attempted / decline"
            stroke="#64748b"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="yellow"
            name="Attempted, not 100%"
            stroke="#b77905"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="green"
            name="Attempted, 100%"
            stroke="#16803c"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  </Paper>
);

const SummaryBand: React.FC<{
  dashboard: DashboardResponse;
  filteredQuizzes: QuizSummary[];
}> = ({ dashboard, filteredQuizzes }) => {
  const chartData = useMemo(
    () => buildCheckStatusHistory(dashboard.quizzes, dashboard.today),
    [dashboard.quizzes, dashboard.today],
  );
  const filteredChartData = useMemo(
    () => buildCheckStatusHistory(filteredQuizzes, dashboard.today),
    [dashboard.today, filteredQuizzes],
  );
  const filteredTotalChecks = useMemo(
    () => totalGreenChecks(filteredQuizzes),
    [filteredQuizzes],
  );
  const filteredDueCount = useMemo(
    () => filteredQuizzes.filter((quiz) => quiz.due).length,
    [filteredQuizzes],
  );

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 180px" },
        gap: 2,
        mb: 2,
      }}
    >
      <Stack spacing={2}>
        <CheckStatusChart
          title="Total checks"
          data={chartData}
          dueCount={dashboard.totals.dueToday}
          totalChecks={dashboard.totals.greenChecks}
        />
        <CheckStatusChart
          title="Filtered total checks"
          data={filteredChartData}
          dueCount={filteredDueCount}
          totalChecks={filteredTotalChecks}
        />
      </Stack>

      <Paper
        elevation={0}
        sx={{
          p: 2,
          aspectRatio: "1 / 1",
          minHeight: 180,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          bgcolor: alpha(theme.palette.success.main, 0.08),
        }}
      >
        <Box>
          <CheckCircleIcon color="success" sx={{ fontSize: 34 }} />
          <Typography variant="h4" sx={{ fontWeight: 900 }}>
            {dashboard.totals.greenChecks}
          </Typography>
          <Typography color="text.secondary">total checks</Typography>
        </Box>
      </Paper>
    </Box>
  );
};

type QuizSortKey =
  | "quizNumber"
  | "quizName"
  | "teacher"
  | "unit"
  | "section"
  | "gradeLevel"
  | "greenChecks";
type QuizSortDirection = "asc" | "desc";

const quizTableColumns: Array<{
  key: QuizSortKey;
  label: string;
  align?: "right";
  width: number;
}> = [
  { key: "quizNumber", label: "Quiz #", width: 92 },
  { key: "quizName", label: "Quiz name", width: 270 },
  { key: "teacher", label: "Teacher", width: 150 },
  { key: "gradeLevel", label: "Grade", width: 120 },
  { key: "unit", label: "Unit", width: 150 },
  { key: "section", label: "Section", width: 150 },
  { key: "greenChecks", label: "Total checks", align: "right", width: 190 },
];
const quizTableGridTemplate = quizTableColumns
  .map((column) => `${column.width}px`)
  .join(" ");
const quizTableMinWidth = quizTableColumns.reduce(
  (total, column) => total + column.width,
  0,
);
const quizTableFilterCellSx = { px: { lg: 2 }, minWidth: 0 };

type StoredQuizFilters = {
  teacher: string | null;
  gradeLevel: number | null;
  unit: string | null;
  section: string | null;
  quizNumber: number | null;
  quizName: string | null;
};

const emptyQuizFilters: StoredQuizFilters = {
  teacher: null,
  gradeLevel: null,
  unit: null,
  section: null,
  quizNumber: null,
  quizName: null,
};

const readQuizFilters = (storageKey: string): StoredQuizFilters => {
  const parse = (raw: string | null) => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<StoredQuizFilters>;
      return {
        teacher: typeof parsed.teacher === "string" ? parsed.teacher : null,
        gradeLevel:
          typeof parsed.gradeLevel === "number" ? parsed.gradeLevel : null,
        unit: typeof parsed.unit === "string" ? parsed.unit : null,
        section: typeof parsed.section === "string" ? parsed.section : null,
        quizNumber:
          typeof parsed.quizNumber === "number" ? parsed.quizNumber : null,
        quizName: typeof parsed.quizName === "string" ? parsed.quizName : null,
      };
    } catch {
      return null;
    }
  };

  try {
    const saved = parse(window.localStorage.getItem(storageKey));
    if (saved) return saved;
  } catch {
    // Fall back to session storage below.
  }

  try {
    const saved = parse(window.sessionStorage.getItem(storageKey));
    if (saved) return saved;
  } catch {
    // Ignore unavailable browser storage.
  }

  return emptyQuizFilters;
};

const writeQuizFilters = (storageKey: string, filters: StoredQuizFilters) => {
  const payload = JSON.stringify(filters);
  try {
    window.localStorage.setItem(storageKey, payload);
    return;
  } catch {
    // Fall back to session storage below.
  }

  try {
    window.sessionStorage.setItem(storageKey, payload);
  } catch {
    // Ignore unavailable browser storage.
  }
};

const hasStoredOption = <T,>(options: T[], value: T | null) =>
  value == null || options.some((option) => Object.is(option, value));

const QuizTable: React.FC<{
  quizzes: QuizSummary[];
  onOpenQuiz: (quiz: QuizSummary) => void;
}> = ({ quizzes, onOpenQuiz }) => {
  const [sortKey, setSortKey] = useState<QuizSortKey>("quizName");
  const [sortDirection, setSortDirection] = useState<QuizSortDirection>("asc");

  const sortedQuizzes = useMemo(() => {
    const directionMultiplier = sortDirection === "asc" ? 1 : -1;

    return [...quizzes].sort((left, right) => {
      if (
        sortKey === "greenChecks" ||
        sortKey === "gradeLevel" ||
        sortKey === "quizNumber"
      ) {
        const leftValue = Number(left[sortKey] ?? -1);
        const rightValue = Number(right[sortKey] ?? -1);
        const difference = leftValue - rightValue;
        if (difference !== 0) return difference * directionMultiplier;
      } else {
        const difference = String(left[sortKey] || "").localeCompare(
          String(right[sortKey] || ""),
          undefined,
          { numeric: true, sensitivity: "base" },
        );
        if (difference !== 0) return difference * directionMultiplier;
      }

      return left.quizName.localeCompare(right.quizName, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
  }, [quizzes, sortDirection, sortKey]);

  const handleSort = (key: QuizSortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  return (
    <TableContainer component={Paper} elevation={0}>
      <Table size="small" sx={{ minWidth: quizTableMinWidth, tableLayout: "fixed" }}>
        <TableHead>
          <TableRow>
            {quizTableColumns.map((column) => (
              <TableCell
                key={column.key}
                align={column.align}
                sortDirection={sortKey === column.key ? sortDirection : false}
                sx={{ width: column.width }}
              >
                <TableSortLabel
                  active={sortKey === column.key}
                  direction={sortKey === column.key ? sortDirection : "asc"}
                  onClick={() => handleSort(column.key)}
                >
                  {column.label}
                </TableSortLabel>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedQuizzes.map((quiz) => (
            <TableRow key={quiz.id} hover>
              <TableCell>{formatQuizNumber(quiz.quizNumber)}</TableCell>
              <TableCell>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  {quiz.due && (
                    <Chip
                      size="small"
                      icon={<TodayIcon />}
                      label="Due"
                      color="primary"
                      variant="outlined"
                    />
                  )}
                  <Button
                    variant="text"
                    startIcon={<PlayArrowIcon />}
                    onClick={() => onOpenQuiz(quiz)}
                    sx={{ justifyContent: "flex-start", px: 0 }}
                  >
                    {quiz.quizName}
                  </Button>
                </Stack>
              </TableCell>
              <TableCell>{quiz.teacher}</TableCell>
              <TableCell>{formatGradeLevel(quiz.gradeLevel)}</TableCell>
              <TableCell>{quiz.unit}</TableCell>
              <TableCell>{quiz.section}</TableCell>
              <TableCell align="right">
                <CheckSymbols count={quiz.greenChecks} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const QuizzesView: React.FC<{
  dashboard: DashboardResponse;
  onOpenQuiz: (quiz: QuizSummary) => void;
}> = ({ dashboard, onOpenQuiz }) => {
  const filterStorageKey = `cquiz2.quizFilters.${dashboard.user.anonId}`;
  const storedFilters = useMemo(
    () => readQuizFilters(filterStorageKey),
    [filterStorageKey],
  );
  const teacherOptions = useMemo(
    () => unique(dashboard.quizzes.map((quiz) => quiz.teacher)),
    [dashboard.quizzes],
  );
  const gradeOptions = useMemo(
    () => unique(dashboard.quizzes.map((quiz) => quiz.gradeLevel)),
    [dashboard.quizzes],
  );
  const unitOptions = useMemo(
    () => unique(dashboard.quizzes.map((quiz) => quiz.unit)),
    [dashboard.quizzes],
  );
  const sectionOptions = useMemo(
    () => unique(dashboard.quizzes.map((quiz) => quiz.section)),
    [dashboard.quizzes],
  );
  const quizNumberOptions = useMemo(
    () => unique(dashboard.quizzes.map((quiz) => quiz.quizNumber)),
    [dashboard.quizzes],
  );
  const quizNameOptions = useMemo(
    () => unique(dashboard.quizzes.map((quiz) => quiz.quizName)),
    [dashboard.quizzes],
  );

  const [teacher, setTeacher] = useState<string | null>(() =>
    hasStoredOption(teacherOptions, storedFilters.teacher)
      ? storedFilters.teacher
      : null,
  );
  const [gradeLevel, setGradeLevel] = useState<number | null>(() =>
    hasStoredOption(gradeOptions, storedFilters.gradeLevel)
      ? storedFilters.gradeLevel
      : null,
  );
  const [unit, setUnit] = useState<string | null>(() =>
    hasStoredOption(unitOptions, storedFilters.unit) ? storedFilters.unit : null,
  );
  const [section, setSection] = useState<string | null>(() =>
    hasStoredOption(sectionOptions, storedFilters.section)
      ? storedFilters.section
      : null,
  );
  const [quizNumber, setQuizNumber] = useState<number | null>(() =>
    hasStoredOption(quizNumberOptions, storedFilters.quizNumber)
      ? storedFilters.quizNumber
      : null,
  );
  const [quizName, setQuizName] = useState<string | null>(() =>
    hasStoredOption(quizNameOptions, storedFilters.quizName)
      ? storedFilters.quizName
      : null,
  );

  useEffect(() => {
    writeQuizFilters(filterStorageKey, {
      teacher,
      gradeLevel,
      unit,
      section,
      quizNumber,
      quizName,
    });
  }, [filterStorageKey, gradeLevel, quizName, quizNumber, section, teacher, unit]);

  useEffect(() => {
    if (!hasStoredOption(teacherOptions, teacher)) setTeacher(null);
    if (!hasStoredOption(gradeOptions, gradeLevel)) setGradeLevel(null);
    if (!hasStoredOption(unitOptions, unit)) setUnit(null);
    if (!hasStoredOption(sectionOptions, section)) setSection(null);
    if (!hasStoredOption(quizNumberOptions, quizNumber)) setQuizNumber(null);
    if (!hasStoredOption(quizNameOptions, quizName)) setQuizName(null);
  }, [
    gradeLevel,
    gradeOptions,
    quizName,
    quizNameOptions,
    quizNumber,
    quizNumberOptions,
    section,
    sectionOptions,
    teacher,
    teacherOptions,
    unit,
    unitOptions,
  ]);

  const filtered = useMemo(
    () =>
      dashboard.quizzes.filter(
        (quiz) =>
          (!teacher || quiz.teacher === teacher) &&
          (gradeLevel == null || quiz.gradeLevel === gradeLevel) &&
          (!unit || quiz.unit === unit) &&
          (!section || quiz.section === section) &&
          (quizNumber == null || quiz.quizNumber === quizNumber) &&
          (!quizName || quiz.quizName === quizName),
      ),
    [dashboard.quizzes, gradeLevel, quizName, quizNumber, section, teacher, unit],
  );

  return (
    <Box>
      <SummaryBand dashboard={dashboard} filteredQuizzes={filtered} />

      <Paper elevation={0} sx={{ mb: 2, overflow: "visible" }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 2, pb: 1 }}>
          <FilterAltIcon color="primary" />
          <Typography variant="h6">Filters</Typography>
          <Box sx={{ flex: 1 }} />
          <Button
            variant="outlined"
            startIcon={<RestartAltIcon />}
            onClick={() => {
              setTeacher(null);
              setUnit(null);
              setSection(null);
              setGradeLevel(null);
              setQuizNumber(null);
              setQuizName(null);
            }}
          >
            Clear filters
          </Button>
        </Stack>

        <Box
          sx={{
            overflowX: { xs: "visible", lg: "auto" },
            overflowY: "visible",
            px: { xs: 2, lg: 0 },
            pt: 1.25,
            pb: 2,
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, minmax(0, 1fr))",
                lg: quizTableGridTemplate,
              },
              gap: { xs: 1.5, lg: 0 },
              minWidth: { lg: quizTableMinWidth },
              alignItems: "start",
            }}
          >
            <Box sx={quizTableFilterCellSx}>
              <Autocomplete
                fullWidth
                options={quizNumberOptions}
                value={quizNumber}
                onChange={(_, value) => setQuizNumber(value)}
                getOptionLabel={formatQuizNumber}
                renderInput={(params) => <TextField {...params} label="Quiz #" size="small" />}
              />
            </Box>
            <Box sx={quizTableFilterCellSx}>
              <Autocomplete
                fullWidth
                options={quizNameOptions}
                value={quizName}
                onChange={(_, value) => setQuizName(value)}
                renderInput={(params) => <TextField {...params} label="Quiz name" size="small" />}
              />
            </Box>
            <Box sx={quizTableFilterCellSx}>
              <Autocomplete
                fullWidth
                options={teacherOptions}
                value={teacher}
                onChange={(_, value) => setTeacher(value)}
                renderInput={(params) => <TextField {...params} label="Teacher" size="small" />}
              />
            </Box>
            <Box sx={quizTableFilterCellSx}>
              <Autocomplete
                fullWidth
                options={gradeOptions}
                value={gradeLevel}
                onChange={(_, value) => setGradeLevel(value)}
                getOptionLabel={formatGradeLevel}
                renderInput={(params) => <TextField {...params} label="Grade" size="small" />}
              />
            </Box>
            <Box sx={quizTableFilterCellSx}>
              <Autocomplete
                fullWidth
                options={unitOptions}
                value={unit}
                onChange={(_, value) => setUnit(value)}
                renderInput={(params) => <TextField {...params} label="Unit" size="small" />}
              />
            </Box>
            <Box sx={quizTableFilterCellSx}>
              <Autocomplete
                fullWidth
                options={sectionOptions}
                value={section}
                onChange={(_, value) => setSection(value)}
                renderInput={(params) => <TextField {...params} label="Section" size="small" />}
              />
            </Box>
            <Box sx={{ ...quizTableFilterCellSx, display: { xs: "none", lg: "block" } }} />
          </Box>
        </Box>
      </Paper>

      {filtered.length ? (
        <QuizTable quizzes={filtered} onOpenQuiz={onOpenQuiz} />
      ) : (
        <EmptyState title="No quizzes match" detail="Clear a filter to bring quizzes back." />
      )}
    </Box>
  );
};

const DueTodayView: React.FC<{
  dashboard: DashboardResponse;
  onOpenQuiz: (quiz: QuizSummary) => void;
}> = ({ dashboard, onOpenQuiz }) => {
  const due = dashboard.quizzes.filter((quiz) => quiz.due);
  if (!due.length) {
    return (
      <EmptyState
        title="Nothing due today"
        detail="Quizzes will appear here when their spaced practice date arrives."
      />
    );
  }
  return <QuizTable quizzes={due} onOpenQuiz={onOpenQuiz} />;
};

const ScoresView: React.FC<{ dashboard: DashboardResponse }> = ({ dashboard }) => {
  const [tab, setTab] = useState(0);
  const [range, setRange] = useState<"daily" | "weekly" | "monthly">("daily");
  const [quizId, setQuizId] = useState<string>("");

  useEffect(() => {
    if (!quizId && dashboard.quizzes.length) {
      const firstWithAttempts =
        dashboard.quizzes.find((quiz) => quiz.attempts.length > 0) ||
        dashboard.quizzes[0];
      setQuizId(firstWithAttempts.id);
    }
  }, [dashboard.quizzes, quizId]);

  const overallData = useMemo(
    () => groupGreenChecks(dashboard.quizzes, range),
    [dashboard.quizzes, range],
  );
  const selectedQuiz =
    dashboard.quizzes.find((quiz) => quiz.id === quizId) || dashboard.quizzes[0];

  return (
    <Paper elevation={0} sx={{ p: 2 }}>
      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 2 }}>
        <Tab label="Overall" />
        <Tab label="Specific" />
      </Tabs>

      {tab === 0 && (
        <Box>
          <FormControl size="small" sx={{ minWidth: 160, mb: 2 }}>
            <InputLabel>Range</InputLabel>
            <Select
              label="Range"
              value={range}
              onChange={(event) =>
                setRange(event.target.value as "daily" | "weekly" | "monthly")
              }
            >
              <MenuItem value="daily">Daily</MenuItem>
              <MenuItem value="weekly">Weekly</MenuItem>
              <MenuItem value="monthly">Monthly</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ height: 320 }}>
            {overallData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overallData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis allowDecimals={false} />
                  <RechartsTooltip />
                  <Bar dataKey="checks" name="Green checks" fill="#16803c" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="No green checks yet" detail="Scores of 100 will appear here." />
            )}
          </Box>
        </Box>
      )}

      {tab === 1 && (
        <Box>
          <Autocomplete
            sx={{ maxWidth: 420, mb: 2 }}
            options={dashboard.quizzes}
            value={selectedQuiz || null}
            onChange={(_, value) => setQuizId(value?.id || "")}
            getOptionLabel={(quiz) =>
              `${quiz.quizName} (${quiz.teacher}, ${formatGradeLevel(quiz.gradeLevel)}, ${quiz.unit})`
            }
            renderInput={(params) => <TextField {...params} label="Quiz" size="small" />}
          />

          <AttemptScoreChart attempts={selectedQuiz?.attempts || []} />
        </Box>
      )}
    </Paper>
  );
};

type TeacherStudentSortKey = "anonId" | "totalChecks";
type TeacherStudentQuizSortKey =
  | "quizNumber"
  | "quizName"
  | "gradeLevel"
  | "unit"
  | "section"
  | "dueDate"
  | "greenChecks"
  | "yellowChecks";
type TeacherQuizSortKey =
  | "quizNumber"
  | "quizName"
  | "gradeLevel"
  | "unit"
  | "section"
  | "totalUniqueStudentsAttempted"
  | "totalChecksCurrently"
  | "highestChecksToDate";
type TeacherQuizStudentSortKey = "anonId" | "currentChecks" | "maxChecks";

const TeacherCreateView: React.FC = () => (
  <Paper elevation={0} sx={{ p: 2 }}>
    <Typography variant="h6">Create</Typography>
    <Divider sx={{ my: 2 }} />
    <Typography color="text.secondary">
      Quiz creation tools will appear here after the teacher authoring flow is connected.
    </Typography>
  </Paper>
);

const TeacherStudentTable: React.FC<{
  students: TeacherStudentSummary[];
  onOpenStudent: (anonId: string) => void;
}> = ({ students, onOpenStudent }) => {
  const [sortKey, setSortKey] = useState<TeacherStudentSortKey>("anonId");
  const [sortDirection, setSortDirection] = useState<QuizSortDirection>("asc");

  const sortedStudents = useMemo(() => {
    const directionMultiplier = sortDirection === "asc" ? 1 : -1;
    return [...students].sort((left, right) => {
      const difference =
        sortKey === "totalChecks"
          ? compareNumber(left.totalChecks, right.totalChecks)
          : compareText(left.anonId, right.anonId);
      return difference * directionMultiplier;
    });
  }, [sortDirection, sortKey, students]);

  const handleSort = (key: TeacherStudentSortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  return (
    <TableContainer component={Paper} elevation={0}>
      <Table size="small" sx={{ minWidth: 520 }}>
        <TableHead>
          <TableRow>
            <TableCell sortDirection={sortKey === "anonId" ? sortDirection : false}>
              <TableSortLabel
                active={sortKey === "anonId"}
                direction={sortKey === "anonId" ? sortDirection : "asc"}
                onClick={() => handleSort("anonId")}
              >
                Student alias
              </TableSortLabel>
            </TableCell>
            <TableCell
              align="right"
              sortDirection={sortKey === "totalChecks" ? sortDirection : false}
            >
              <TableSortLabel
                active={sortKey === "totalChecks"}
                direction={sortKey === "totalChecks" ? sortDirection : "asc"}
                onClick={() => handleSort("totalChecks")}
              >
                Total checks
              </TableSortLabel>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedStudents.map((student) => (
            <TableRow key={student.anonId} hover>
              <TableCell>
                <Button
                  variant="text"
                  onClick={() => onOpenStudent(student.anonId)}
                  sx={{ justifyContent: "flex-start", px: 0 }}
                >
                  {student.anonId}
                </Button>
              </TableCell>
              <TableCell align="right">
                <CheckSymbols count={student.totalChecks} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const teacherStudentQuizColumns: Array<{
  key: TeacherStudentQuizSortKey;
  label: string;
  align?: "right";
  width: number;
}> = [
  { key: "quizNumber", label: "Quiz #", width: 92 },
  { key: "quizName", label: "Quiz name", width: 250 },
  { key: "gradeLevel", label: "Grade", width: 120 },
  { key: "unit", label: "Unit", width: 140 },
  { key: "section", label: "Section", width: 140 },
  { key: "dueDate", label: "Due next", width: 150 },
  { key: "greenChecks", label: "Green", align: "right", width: 130 },
  { key: "yellowChecks", label: "Yellow", align: "right", width: 130 },
];
const teacherStudentQuizGridTemplate = teacherStudentQuizColumns
  .map((column) => `${column.width}px`)
  .join(" ");
const teacherStudentQuizMinWidth = teacherStudentQuizColumns.reduce(
  (sum, column) => sum + column.width,
  0,
);

const TeacherStudentProfile: React.FC<{
  student: TeacherStudentSummary;
  onBack: () => void;
}> = ({ student, onBack }) => {
  const [sortKey, setSortKey] = useState<TeacherStudentQuizSortKey>("quizNumber");
  const [sortDirection, setSortDirection] = useState<QuizSortDirection>("asc");
  const [gradeLevel, setGradeLevel] = useState<number | null>(null);
  const [unit, setUnit] = useState<string | null>(null);
  const [section, setSection] = useState<string | null>(null);
  const [quizNumber, setQuizNumber] = useState<number | null>(null);
  const [quizName, setQuizName] = useState<string | null>(null);
  const [chartQuizId, setChartQuizId] = useState("");

  useEffect(() => {
    setChartQuizId("");
  }, [student.anonId]);

  const gradeOptions = useMemo(
    () => unique(student.quizzes.map((quiz) => quiz.gradeLevel)),
    [student.quizzes],
  );
  const unitOptions = useMemo(
    () => unique(student.quizzes.map((quiz) => quiz.unit)),
    [student.quizzes],
  );
  const sectionOptions = useMemo(
    () => unique(student.quizzes.map((quiz) => quiz.section)),
    [student.quizzes],
  );
  const quizNumberOptions = useMemo(
    () => unique(student.quizzes.map((quiz) => quiz.quizNumber)),
    [student.quizzes],
  );
  const quizNameOptions = useMemo(
    () => unique(student.quizzes.map((quiz) => quiz.quizName)),
    [student.quizzes],
  );

  const filteredQuizzes = useMemo(
    () =>
      student.quizzes.filter(
        (quiz) =>
          (gradeLevel == null || quiz.gradeLevel === gradeLevel) &&
          (!unit || quiz.unit === unit) &&
          (!section || quiz.section === section) &&
          (quizNumber == null || quiz.quizNumber === quizNumber) &&
          (!quizName || quiz.quizName === quizName),
      ),
    [gradeLevel, quizName, quizNumber, section, student.quizzes, unit],
  );

  const sortedQuizzes = useMemo(() => {
    const directionMultiplier = sortDirection === "asc" ? 1 : -1;
    return [...filteredQuizzes].sort((left, right) => {
      const difference =
        sortKey === "quizNumber" ||
        sortKey === "gradeLevel" ||
        sortKey === "greenChecks" ||
        sortKey === "yellowChecks"
          ? compareNumber(left[sortKey], right[sortKey])
          : compareText(left[sortKey], right[sortKey]);
      if (difference !== 0) return difference * directionMultiplier;
      return compareText(left.quizName, right.quizName);
    });
  }, [filteredQuizzes, sortDirection, sortKey]);

  const chartQuiz = student.quizzes.find((quiz) => quiz.id === chartQuizId) || null;

  const handleSort = (key: TeacherStudentQuizSortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Button startIcon={<ArrowBackIcon />} onClick={onBack}>
            Back
          </Button>
          <Box sx={{ flex: 1 }} />
          <Typography variant="h6">{student.anonId}</Typography>
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ overflow: "visible" }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 2, pb: 1 }}>
          <FilterAltIcon color="primary" />
          <Typography variant="h6">Filters</Typography>
          <Box sx={{ flex: 1 }} />
          <Button
            variant="outlined"
            startIcon={<RestartAltIcon />}
            onClick={() => {
              setGradeLevel(null);
              setUnit(null);
              setSection(null);
              setQuizNumber(null);
              setQuizName(null);
            }}
          >
            Clear filters
          </Button>
        </Stack>
        <Box sx={{ overflowX: { xs: "visible", lg: "auto" }, px: { xs: 2, lg: 0 }, pt: 1.25, pb: 2 }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, minmax(0, 1fr))",
                lg: teacherStudentQuizGridTemplate,
              },
              gap: { xs: 1.5, lg: 0 },
              minWidth: { lg: teacherStudentQuizMinWidth },
            }}
          >
            <Box sx={quizTableFilterCellSx}>
              <Autocomplete
                fullWidth
                options={quizNumberOptions}
                value={quizNumber}
                onChange={(_, value) => setQuizNumber(value)}
                getOptionLabel={formatQuizNumber}
                renderInput={(params) => <TextField {...params} label="Quiz #" size="small" />}
              />
            </Box>
            <Box sx={quizTableFilterCellSx}>
              <Autocomplete
                fullWidth
                options={quizNameOptions}
                value={quizName}
                onChange={(_, value) => setQuizName(value)}
                renderInput={(params) => <TextField {...params} label="Quiz name" size="small" />}
              />
            </Box>
            <Box sx={quizTableFilterCellSx}>
              <Autocomplete
                fullWidth
                options={gradeOptions}
                value={gradeLevel}
                onChange={(_, value) => setGradeLevel(value)}
                getOptionLabel={formatGradeLevel}
                renderInput={(params) => <TextField {...params} label="Grade" size="small" />}
              />
            </Box>
            <Box sx={quizTableFilterCellSx}>
              <Autocomplete
                fullWidth
                options={unitOptions}
                value={unit}
                onChange={(_, value) => setUnit(value)}
                renderInput={(params) => <TextField {...params} label="Unit" size="small" />}
              />
            </Box>
            <Box sx={quizTableFilterCellSx}>
              <Autocomplete
                fullWidth
                options={sectionOptions}
                value={section}
                onChange={(_, value) => setSection(value)}
                renderInput={(params) => <TextField {...params} label="Section" size="small" />}
              />
            </Box>
            <Box sx={{ ...quizTableFilterCellSx, display: { xs: "none", lg: "block" } }} />
            <Box sx={{ ...quizTableFilterCellSx, display: { xs: "none", lg: "block" } }} />
            <Box sx={{ ...quizTableFilterCellSx, display: { xs: "none", lg: "block" } }} />
          </Box>
        </Box>
      </Paper>

      {sortedQuizzes.length ? (
        <TableContainer component={Paper} elevation={0}>
          <Table
            size="small"
            sx={{ minWidth: teacherStudentQuizMinWidth, tableLayout: "fixed" }}
          >
            <TableHead>
              <TableRow>
                {teacherStudentQuizColumns.map((column) => (
                  <TableCell
                    key={column.key}
                    align={column.align}
                    sortDirection={sortKey === column.key ? sortDirection : false}
                    sx={{ width: column.width }}
                  >
                    <TableSortLabel
                      active={sortKey === column.key}
                      direction={sortKey === column.key ? sortDirection : "asc"}
                      onClick={() => handleSort(column.key)}
                    >
                      {column.label}
                    </TableSortLabel>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedQuizzes.map((quiz) => (
                <TableRow key={quiz.id} hover>
                  <TableCell>{formatQuizNumber(quiz.quizNumber)}</TableCell>
                  <TableCell>
                    <Button
                      variant="text"
                      startIcon={<BarChartIcon />}
                      onClick={() => setChartQuizId(quiz.id)}
                      sx={{ justifyContent: "flex-start", px: 0 }}
                    >
                      {quiz.quizName}
                    </Button>
                  </TableCell>
                  <TableCell>{formatGradeLevel(quiz.gradeLevel)}</TableCell>
                  <TableCell>{quiz.unit}</TableCell>
                  <TableCell>{quiz.section}</TableCell>
                  <TableCell>{formatDueText(quiz.due, quiz.daysUntilDue)}</TableCell>
                  <TableCell align="right">
                    <CheckSymbols count={quiz.greenChecks} label="green checks" />
                  </TableCell>
                  <TableCell align="right">
                    <CheckSymbols
                      count={quiz.yellowChecks}
                      color="warning"
                      label="yellow checks"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <EmptyState title="No quizzes match" detail="Clear a filter to bring quizzes back." />
      )}

      {chartQuiz && (
        <Paper elevation={0} sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {chartQuiz.quizName}
          </Typography>
          <AttemptScoreChart attempts={chartQuiz.attempts} />
        </Paper>
      )}
    </Stack>
  );
};

const TeacherQuizTable: React.FC<{
  quizzes: TeacherQuizSummary[];
  onOpenQuiz: (quizId: string) => void;
}> = ({ quizzes, onOpenQuiz }) => {
  const [sortKey, setSortKey] = useState<TeacherQuizSortKey>("quizNumber");
  const [sortDirection, setSortDirection] = useState<QuizSortDirection>("asc");
  const columns: Array<{
    key: TeacherQuizSortKey;
    label: string;
    align?: "right";
  }> = [
    { key: "quizNumber", label: "Quiz #" },
    { key: "quizName", label: "Quiz name" },
    { key: "gradeLevel", label: "Grade" },
    { key: "unit", label: "Unit" },
    { key: "section", label: "Section" },
    { key: "totalUniqueStudentsAttempted", label: "Students", align: "right" },
    { key: "totalChecksCurrently", label: "Current checks", align: "right" },
    { key: "highestChecksToDate", label: "Highest checks", align: "right" },
  ];

  const sortedQuizzes = useMemo(() => {
    const directionMultiplier = sortDirection === "asc" ? 1 : -1;
    return [...quizzes].sort((left, right) => {
      const difference =
        sortKey === "quizName" || sortKey === "unit" || sortKey === "section"
          ? compareText(left[sortKey], right[sortKey])
          : compareNumber(left[sortKey], right[sortKey]);
      if (difference !== 0) return difference * directionMultiplier;
      return compareText(left.quizName, right.quizName);
    });
  }, [quizzes, sortDirection, sortKey]);

  const handleSort = (key: TeacherQuizSortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  return (
    <TableContainer component={Paper} elevation={0}>
      <Table size="small" sx={{ minWidth: 980 }}>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell
                key={column.key}
                align={column.align}
                sortDirection={sortKey === column.key ? sortDirection : false}
              >
                <TableSortLabel
                  active={sortKey === column.key}
                  direction={sortKey === column.key ? sortDirection : "asc"}
                  onClick={() => handleSort(column.key)}
                >
                  {column.label}
                </TableSortLabel>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedQuizzes.map((quiz) => (
            <TableRow key={quiz.id} hover>
              <TableCell>{formatQuizNumber(quiz.quizNumber)}</TableCell>
              <TableCell>
                <Button
                  variant="text"
                  onClick={() => onOpenQuiz(quiz.id)}
                  sx={{ justifyContent: "flex-start", px: 0 }}
                >
                  {quiz.quizName}
                </Button>
              </TableCell>
              <TableCell>{formatGradeLevel(quiz.gradeLevel)}</TableCell>
              <TableCell>{quiz.unit}</TableCell>
              <TableCell>{quiz.section}</TableCell>
              <TableCell align="right">{quiz.totalUniqueStudentsAttempted}</TableCell>
              <TableCell align="right">{quiz.totalChecksCurrently}</TableCell>
              <TableCell align="right">{quiz.highestChecksToDate}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const TeacherQuizProfile: React.FC<{
  quiz: TeacherQuizSummary;
  onBack: () => void;
  onOpenStudent: (anonId: string) => void;
}> = ({ quiz, onBack, onOpenStudent }) => {
  const [sortKey, setSortKey] = useState<TeacherQuizStudentSortKey>("anonId");
  const [sortDirection, setSortDirection] = useState<QuizSortDirection>("asc");

  const sortedStudents = useMemo(() => {
    const directionMultiplier = sortDirection === "asc" ? 1 : -1;
    return [...quiz.students].sort((left, right) => {
      const difference =
        sortKey === "anonId"
          ? compareText(left.anonId, right.anonId)
          : compareNumber(left[sortKey], right[sortKey]);
      return difference * directionMultiplier;
    });
  }, [quiz.students, sortDirection, sortKey]);

  const handleSort = (key: TeacherQuizStudentSortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Button startIcon={<ArrowBackIcon />} onClick={onBack}>
            Back
          </Button>
          <Box sx={{ flex: 1 }} />
          <Box sx={{ textAlign: "right" }}>
            <Typography variant="h6">{quiz.quizName}</Typography>
            <Typography color="text.secondary">
              Quiz {formatQuizNumber(quiz.quizNumber)} | {formatGradeLevel(quiz.gradeLevel)} | {quiz.unit} | {quiz.section}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {sortedStudents.length ? (
        <TableContainer component={Paper} elevation={0}>
          <Table size="small" sx={{ minWidth: 620 }}>
            <TableHead>
              <TableRow>
                <TableCell sortDirection={sortKey === "anonId" ? sortDirection : false}>
                  <TableSortLabel
                    active={sortKey === "anonId"}
                    direction={sortKey === "anonId" ? sortDirection : "asc"}
                    onClick={() => handleSort("anonId")}
                  >
                    Student alias
                  </TableSortLabel>
                </TableCell>
                <TableCell
                  align="right"
                  sortDirection={sortKey === "currentChecks" ? sortDirection : false}
                >
                  <TableSortLabel
                    active={sortKey === "currentChecks"}
                    direction={sortKey === "currentChecks" ? sortDirection : "asc"}
                    onClick={() => handleSort("currentChecks")}
                  >
                    Current checks
                  </TableSortLabel>
                </TableCell>
                <TableCell
                  align="right"
                  sortDirection={sortKey === "maxChecks" ? sortDirection : false}
                >
                  <TableSortLabel
                    active={sortKey === "maxChecks"}
                    direction={sortKey === "maxChecks" ? sortDirection : "asc"}
                    onClick={() => handleSort("maxChecks")}
                  >
                    Max checks
                  </TableSortLabel>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedStudents.map((student) => (
                <TableRow key={student.anonId} hover>
                  <TableCell>
                    <Button
                      variant="text"
                      onClick={() => onOpenStudent(student.anonId)}
                      sx={{ justifyContent: "flex-start", px: 0 }}
                    >
                      {student.anonId}
                    </Button>
                  </TableCell>
                  <TableCell align="right">{student.currentChecks}</TableCell>
                  <TableCell align="right">{student.maxChecks}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <EmptyState title="No attempts yet" detail="Students will appear after they submit this quiz." />
      )}
    </Stack>
  );
};

const TeacherDataView: React.FC = () => {
  const [teacherDashboard, setTeacherDashboard] =
    useState<TeacherDashboardResponse | null>(null);
  const [tab, setTab] = useState(0);
  const [selectedStudentAlias, setSelectedStudentAlias] = useState("");
  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiGet<TeacherDashboardResponse>("teacher-dashboard")
      .then((response) => {
        if (cancelled) return;
        setTeacherDashboard(response);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load teacher data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedStudent =
    teacherDashboard?.students.find(
      (student) => student.anonId === selectedStudentAlias,
    ) || null;
  const selectedQuiz =
    teacherDashboard?.quizzes.find((quiz) => quiz.id === selectedQuizId) || null;

  const openStudent = (anonId: string) => {
    setSelectedStudentAlias(anonId);
    setSelectedQuizId("");
    setTab(0);
  };

  const openQuiz = (quizId: string) => {
    setSelectedQuizId(quizId);
    setSelectedStudentAlias("");
    setTab(1);
  };

  if (loading) {
    return (
      <Paper elevation={0} sx={{ p: 4, textAlign: "center" }}>
        <CircularProgress />
      </Paper>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!teacherDashboard) {
    return <EmptyState title="No teacher data" detail="The backend did not return teacher data." />;
  }

  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, value) => {
            setTab(value);
            setSelectedStudentAlias("");
            setSelectedQuizId("");
          }}
        >
          <Tab label="Student" />
          <Tab label="Quiz" />
        </Tabs>
      </Paper>

      {tab === 0 &&
        (selectedStudent ? (
          <TeacherStudentProfile
            student={selectedStudent}
            onBack={() => setSelectedStudentAlias("")}
          />
        ) : teacherDashboard.students.length ? (
          <TeacherStudentTable
            students={teacherDashboard.students}
            onOpenStudent={openStudent}
          />
        ) : (
          <EmptyState
            title="No student attempts"
            detail="Students will appear after they submit one of your quizzes."
          />
        ))}

      {tab === 1 &&
        (selectedQuiz ? (
          <TeacherQuizProfile
            quiz={selectedQuiz}
            onBack={() => setSelectedQuizId("")}
            onOpenStudent={openStudent}
          />
        ) : teacherDashboard.quizzes.length ? (
          <TeacherQuizTable quizzes={teacherDashboard.quizzes} onOpenQuiz={openQuiz} />
        ) : (
          <EmptyState
            title="No quizzes"
            detail="Teacher-linked quizzes will appear here."
          />
        ))}
    </Stack>
  );
};

const SortableAnswer: React.FC<{
  item: RoundAnswer;
  checked: boolean;
  onCheckedChange: (id: string, checked: boolean) => void;
}> = ({ item, checked, onCheckedChange }) => {
  const { attributes, isDragging, listeners, setNodeRef, transform } = useSortable({
    id: item.id,
  });

  return (
    <Paper
      ref={setNodeRef}
      elevation={0}
      tabIndex={0}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: undefined,
      }}
      sx={{
        p: 1,
        display: "flex",
        gap: 1,
        alignItems: "center",
        cursor: "grab",
        userSelect: "none",
        bgcolor: checked
          ? alpha(theme.palette.success.main, 0.12)
          : isDragging
            ? alpha(theme.palette.primary.main, 0.12)
            : "background.paper",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onCheckedChange(item.id, event.target.checked)}
        onPointerDown={(event) => event.stopPropagation()}
        aria-label="Mark answer"
      />
      <Typography variant="body2">{item.text}</Typography>
    </Paper>
  );
};

const QuizRunner: React.FC<{
  quiz: QuizSummary;
  onAttemptRecorded: () => Promise<void>;
}> = ({ quiz, onAttemptRecorded }) => {
  const [round, setRound] = useState<RoundResponse | null>(null);
  const [answers, setAnswers] = useState<RoundAnswer[]>([]);
  const [checkedAnswers, setCheckedAnswers] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<SubmitRoundResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 5 },
    }),
  );

  const startRound = useCallback(
    async (attemptSessionId?: string) => {
      setLoading(true);
      setError("");
      try {
        const nextRound = await apiPost<RoundResponse>("start-round", {
          quizId: quiz.id,
          attemptSessionId,
        });
        setRound(nextRound);
        setAnswers(nextRound.answers);
        setCheckedAnswers({});
        setResult(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start quiz.");
      } finally {
        setLoading(false);
      }
    },
    [quiz.id],
  );

  useEffect(() => {
    setRound(null);
    setAnswers([]);
    setResult(null);
    setCheckedAnswers({});
    startRound();
  }, [quiz.id, startRound]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = answers.findIndex((answer) => answer.id === active.id);
    const newIndex = answers.findIndex((answer) => answer.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    setAnswers((prev) => {
      const next = [...prev];
      [next[oldIndex], next[newIndex]] = [next[newIndex], next[oldIndex]];
      return next;
    });
    setCheckedAnswers((prev) => ({
      ...prev,
      [String(active.id)]: true,
      [String(over.id)]: false,
    }));
  };

  const submitRound = async () => {
    if (!round) return;
    setLoading(true);
    setError("");
    try {
      const response = await apiPost<SubmitRoundResponse>("submit-round", {
        attemptSessionId: round.attemptSessionId,
        pairs: round.questions.map((question, index) => ({
          questionId: question.id,
          answerId: answers[index]?.id,
          checked: !!checkedAnswers[answers[index]?.id || ""],
        })),
      });
      setResult(response);
      await onAttemptRecorded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit quiz.");
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !!round && !result && !loading;
  const canKeepGoing = !!result?.canKeepGoing && !!round;

  return (
    <Box>
      <Paper elevation={0} sx={{ p: 2, mb: 2 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1}
          alignItems={{ xs: "flex-start", md: "center" }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6">{quiz.quizName}</Typography>
            <Typography color="text.secondary">
              {quiz.teacher} / {formatGradeLevel(quiz.gradeLevel)} /{" "}
              {quiz.unit} / {quiz.section} / Quiz {quiz.quizNumber}
            </Typography>
          </Box>
          <Chip label={`${quiz.greenChecks} green`} color="success" variant="outlined" />
          <Chip label={`${quiz.attemptsRemainingToday} left today`} variant="outlined" />
        </Stack>
      </Paper>

      {error && (
        <Alert severity={error.includes("limit") ? "warning" : "error"} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && !round && (
        <Paper elevation={0} sx={{ p: 3, textAlign: "center" }}>
          <CircularProgress />
        </Paper>
      )}

      {round && (
        <Box>
          <Paper elevation={0} sx={{ p: 2, mb: 2 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ xs: "stretch", sm: "center" }}
            >
              <Typography sx={{ flex: 1 }} color="text.secondary">
                Round {round.roundNumber} / showing {round.questions.length} of{" "}
                {round.totalQuestions} questions
              </Typography>
              {result && (
                <Chip
                  color={result.score === 100 ? "success" : "warning"}
                  label={`Score ${result.score}%`}
                />
              )}
            </Stack>
            {result && <LinearProgress sx={{ mt: 1 }} variant="determinate" value={result.score} />}
          </Paper>

          <Paper elevation={0} sx={{ p: 2, userSelect: "none" }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                gap: 2,
                mb: 1,
              }}
            >
              <Typography variant="h6">Questions</Typography>
              <Typography variant="h6">Answers</Typography>
            </Box>

            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <SortableContext
                items={answers.map((answer) => answer.id)}
                strategy={verticalListSortingStrategy}
              >
                <Stack spacing={1.25}>
                  {round.questions.map((question: RoundQuestion, index: number) => {
                    const answer = answers[index];
                    return (
                      <Box
                        key={question.id}
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                          gap: 2,
                          alignItems: "center",
                        }}
                      >
                        <Paper
                          elevation={0}
                          sx={{
                            p: 1.25,
                            bgcolor: "background.paper",
                          }}
                        >
                          <Typography variant="body2">{question.text}</Typography>
                        </Paper>
                        {answer && (
                          <SortableAnswer
                            item={answer}
                            checked={!!checkedAnswers[answer.id]}
                            onCheckedChange={(id, checked) =>
                              setCheckedAnswers((prev) => ({ ...prev, [id]: checked }))
                            }
                          />
                        )}
                      </Box>
                    );
                  })}
                </Stack>
              </SortableContext>
            </DndContext>
          </Paper>

          <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 2 }}>
            {canSubmit && (
              <Button
                variant="contained"
                onClick={submitRound}
                disabled={loading}
                startIcon={<CheckCircleIcon />}
              >
                Submit
              </Button>
            )}
            {canKeepGoing && (
              <Button
                variant="contained"
                color="secondary"
                onClick={() => startRound(round.attemptSessionId)}
                disabled={loading}
                startIcon={<PlayArrowIcon />}
              >
                Keep Going
              </Button>
            )}
          </Stack>
        </Box>
      )}
    </Box>
  );
};

const AccountView: React.FC<{ session: SessionResponse }> = ({ session }) => (
  <Paper elevation={0} sx={{ p: 2 }}>
    <Typography variant="h6">Account</Typography>
    <Divider sx={{ my: 2 }} />
    {session.signedIn && session.user ? (
      <Stack spacing={1}>
        <Typography>
          Anonymous id: <b>{session.user.anonId}</b>
        </Typography>
        <Typography color="text.secondary">Role: {session.user.role}</Typography>
        <Typography color="text.secondary">
          Session auto-logout: {Math.round(session.idleTimeoutSeconds / 60)} minutes
        </Typography>
      </Stack>
    ) : (
      <Typography color="text.secondary">Not signed in.</Typography>
    )}
  </Paper>
);

const SettingsView: React.FC = () => (
  <Paper elevation={0} sx={{ p: 2 }}>
    <Typography variant="h6">Settings</Typography>
    <Divider sx={{ my: 2 }} />
    <Stack spacing={1}>
      <Typography color="text.secondary">Question window: 5</Typography>
      <Typography color="text.secondary">Session timeout: 20 minutes</Typography>
      <Typography color="text.secondary">Scores are saved by anonymous account id.</Typography>
    </Stack>
  </Paper>
);

const CQuiz2Page: React.FC = () => {
  const [session, setSession] = useState<SessionResponse>({
    signedIn: false,
    user: null,
    idleTimeoutSeconds: 20 * 60,
  });
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [activeView, setActiveView] = useState<CQuiz2View>("quizzes");
  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [appError, setAppError] = useState("");
  const teacherMode = isTeacherUser(session.user);

  const loadDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    try {
      const nextDashboard = await apiGet<DashboardResponse>("dashboard");
      setDashboard(nextDashboard);
      setAppError("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setDashboard(null);
        setSession({ signedIn: false, user: null, idleTimeoutSeconds: 20 * 60 });
      } else {
        setAppError(err instanceof Error ? err.message : "Could not load quizzes.");
      }
    } finally {
      setLoadingDashboard(false);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    try {
      const nextSession = await apiGet<SessionResponse>("session");
      setSession(nextSession);
      if (nextSession.signedIn) {
        if (isTeacherUser(nextSession.user)) {
          setDashboard(null);
          setSelectedQuizId("");
          setActiveView((current) =>
            current === "account" ||
            current === "settings" ||
            current === "teacher-create"
              ? current
              : "teacher-data",
          );
        } else {
          await loadDashboard();
          setActiveView((current) =>
            current === "teacher-create" || current === "teacher-data"
              ? "quizzes"
              : current,
          );
        }
      } else {
        setDashboard(null);
      }
    } catch (err) {
      setAppError(err instanceof Error ? err.message : "Could not check sign-in.");
    } finally {
      setLoading(false);
    }
  }, [loadDashboard]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (!session.signedIn) return;
    if (
      teacherMode &&
      activeView !== "account" &&
      activeView !== "settings" &&
      activeView !== "teacher-create" &&
      activeView !== "teacher-data"
    ) {
      setActiveView("teacher-data");
    }
    if (
      !teacherMode &&
      (activeView === "teacher-create" || activeView === "teacher-data")
    ) {
      setActiveView("quizzes");
    }
  }, [activeView, session.signedIn, teacherMode]);

  const logout = useCallback(async () => {
    try {
      await apiPost("logout");
    } catch {
      // Clear the client either way.
    } finally {
      setSession({ signedIn: false, user: null, idleTimeoutSeconds: 20 * 60 });
      setDashboard(null);
      setSelectedQuizId("");
      setActiveView("account");
    }
  }, []);

  useEffect(() => {
    if (!session.signedIn) return;
    let timeoutId: number | undefined;
    let lastTouchAt = 0;

    const resetTimer = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        logout();
      }, idleTimeoutMs);
    };

    const handleActivity = () => {
      resetTimer();
      const now = Date.now();
      if (now - lastTouchAt > 60_000) {
        lastTouchAt = now;
        apiPost("touch").catch(() => undefined);
      }
    };

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((eventName) =>
      window.addEventListener(eventName, handleActivity, { passive: true }),
    );
    resetTimer();

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      events.forEach((eventName) =>
        window.removeEventListener(eventName, handleActivity),
      );
    };
  }, [logout, session.signedIn]);

  const selectedQuiz = useMemo(
    () => dashboard?.quizzes.find((quiz) => quiz.id === selectedQuizId) || null,
    [dashboard?.quizzes, selectedQuizId],
  );
  const dueTodayCount = teacherMode ? 0 : (dashboard?.totals.dueToday ?? 0);
  const navItems = session.signedIn && teacherMode ? teacherNavItems : studentNavItems;

  const openQuiz = (quiz: QuizSummary) => {
    setSelectedQuizId(quiz.id);
    setActiveView("quiz");
  };

  const content = () => {
    if (loading) {
      return (
        <Paper elevation={0} sx={{ p: 4, textAlign: "center" }}>
          <CircularProgress />
        </Paper>
      );
    }

    if (!session.signedIn) {
      return <AccountView session={session} />;
    }

    if (teacherMode) {
      if (activeView === "account") return <AccountView session={session} />;
      if (activeView === "settings") return <SettingsView />;
      if (activeView === "teacher-create") return <TeacherCreateView />;
      return <TeacherDataView />;
    }

    if (loadingDashboard && !dashboard) {
      return (
        <Paper elevation={0} sx={{ p: 4, textAlign: "center" }}>
          <CircularProgress />
        </Paper>
      );
    }

    if (!dashboard) {
      return <EmptyState title="No quiz data" detail="The backend did not return quiz data." />;
    }

    if (activeView === "account") return <AccountView session={session} />;
    if (activeView === "due") {
      return <DueTodayView dashboard={dashboard} onOpenQuiz={openQuiz} />;
    }
    if (activeView === "scores") return <ScoresView dashboard={dashboard} />;
    if (activeView === "settings") return <SettingsView />;
    if (activeView === "quiz") {
      return selectedQuiz ? (
        <QuizRunner quiz={selectedQuiz} onAttemptRecorded={loadDashboard} />
      ) : (
        <EmptyState title="Choose a quiz" detail="Open a quiz from Due Today or Quizzes." />
      );
    }
    return <QuizzesView dashboard={dashboard} onOpenQuiz={openQuiz} />;
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
        <Box
          component="header"
          sx={{
            height: 64,
            display: "flex",
            alignItems: "center",
            gap: 2,
            px: 2,
            borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
            bgcolor: "background.paper",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <Typography variant="h5" sx={{ flex: 1 }}>
            C-Quiz-2
          </Typography>
          {session.signedIn && session.user ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip color="primary" label={session.user.anonId} />
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<LogoutIcon />}
                onClick={logout}
              >
                Logout
              </Button>
            </Stack>
          ) : (
            <GoogleSignInButton signedIn={session.signedIn} />
          )}
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "220px minmax(0, 1fr)" },
            minHeight: "calc(100vh - 64px)",
          }}
        >
          <Box
            component="aside"
            sx={{
              borderRight: { md: "1px solid rgba(15, 23, 42, 0.08)" },
              bgcolor: "background.paper",
              p: 1.5,
            }}
          >
            <List dense>
              {navItems.map((item) => {
                const shouldPulseDue =
                  item.id === "due" && session.signedIn && dueTodayCount > 0;

                return (
                  <ListItemButton
                    key={item.id}
                    selected={activeView === item.id}
                    onClick={() => setActiveView(item.id)}
                    disabled={!session.signedIn && item.id !== "account"}
                    sx={{
                      borderRadius: 1,
                      mb: 0.5,
                      ...(shouldPulseDue
                        ? {
                            "@keyframes cquiz2DuePulse": {
                              "0%, 100%": {
                                backgroundColor: alpha(
                                  theme.palette.error.main,
                                  0.06,
                                ),
                                boxShadow: `0 0 0 0 ${alpha(
                                  theme.palette.error.main,
                                  0.28,
                                )}`,
                              },
                              "50%": {
                                backgroundColor: alpha(
                                  theme.palette.error.main,
                                  0.15,
                                ),
                                boxShadow: `0 0 0 4px ${alpha(
                                  theme.palette.error.main,
                                  0,
                                )}`,
                              },
                            },
                            animation: "cquiz2DuePulse 1.8s ease-in-out infinite",
                            color: "error.main",
                            "& .MuiListItemIcon-root": {
                              color: "error.main",
                            },
                          }
                        : {}),
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.label} />
                  </ListItemButton>
                );
              })}
            </List>
          </Box>

          <Box component="main" sx={{ p: { xs: 2, lg: 3 }, minWidth: 0 }}>
            {appError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setAppError("")}>
                {appError}
              </Alert>
            )}
            {content()}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default CQuiz2Page;
