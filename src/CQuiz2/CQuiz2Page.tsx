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
  IconButton,
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
  Tabs,
  TextField,
  ThemeProvider,
  Tooltip,
  Typography,
  alpha,
  createTheme,
} from "@mui/material";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import BarChartIcon from "@mui/icons-material/BarChart";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import LogoutIcon from "@mui/icons-material/Logout";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import QuizIcon from "@mui/icons-material/Quiz";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SettingsIcon from "@mui/icons-material/Settings";
import TodayIcon from "@mui/icons-material/Today";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
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
  Cell,
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
  QuizSummary,
  RoundAnswer,
  RoundQuestion,
  RoundResponse,
  SessionResponse,
  SubmitRoundResponse,
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

const navItems: Array<{ id: CQuiz2View; label: string; icon: React.ReactNode }> = [
  { id: "account", label: "Account", icon: <AccountCircleIcon /> },
  { id: "due", label: "Due Today", icon: <TodayIcon /> },
  { id: "quizzes", label: "Quizzes", icon: <QuizIcon /> },
  { id: "scores", label: "Scores", icon: <BarChartIcon /> },
  { id: "settings", label: "Settings", icon: <SettingsIcon /> },
];

const unique = <T,>(values: T[]) =>
  Array.from(new Set(values.filter((value) => value !== null && value !== undefined)));

const formatQuizNumber = (value: number | null | undefined) =>
  value == null ? "" : String(value);

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

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

const CheckPills: React.FC<{ quiz: QuizSummary }> = ({ quiz }) => (
  <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
    <Chip
      size="small"
      icon={<CheckCircleIcon />}
      label={quiz.greenChecks}
      color="success"
      variant={quiz.greenChecks ? "filled" : "outlined"}
    />
    {!!quiz.yellowCheck && (
      <Chip
        size="small"
        icon={<WarningAmberIcon />}
        label="yellow"
        color="warning"
      />
    )}
    {!!quiz.greyCheck && (
      <Chip
        size="small"
        icon={<RadioButtonUncheckedIcon />}
        label="due"
        variant="outlined"
      />
    )}
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

const SummaryBand: React.FC<{ dashboard: DashboardResponse }> = ({ dashboard }) => {
  const chartData = [
    { label: "Green", value: dashboard.totals.greenChecks, fill: "#16803c" },
    { label: "Yellow", value: dashboard.totals.yellowChecks, fill: "#b77905" },
  ];

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 180px" },
        gap: 2,
        mb: 2,
      }}
    >
      <Paper elevation={0} sx={{ p: 2, minHeight: 180 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Checks</Typography>
          <Chip size="small" icon={<TodayIcon />} label={`${dashboard.totals.dueToday} due`} />
        </Stack>
        <Box sx={{ height: 130, mt: 1 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 18 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="label" width={70} />
              <RechartsTooltip />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {chartData.map((entry) => (
                  <Cell key={entry.label} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Paper>

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
          <Typography color="text.secondary">green checks</Typography>
        </Box>
      </Paper>
    </Box>
  );
};

const QuizTable: React.FC<{
  quizzes: QuizSummary[];
  onOpenQuiz: (quiz: QuizSummary) => void;
}> = ({ quizzes, onOpenQuiz }) => (
  <TableContainer component={Paper} elevation={0}>
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Quiz name</TableCell>
          <TableCell>Teacher</TableCell>
          <TableCell>Unit</TableCell>
          <TableCell>Section</TableCell>
          <TableCell align="right">Number of checks</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {quizzes.map((quiz) => (
          <TableRow key={quiz.id} hover>
            <TableCell>
              <Button
                variant="text"
                startIcon={<PlayArrowIcon />}
                onClick={() => onOpenQuiz(quiz)}
                sx={{ justifyContent: "flex-start", px: 0 }}
              >
                {quiz.quizName}
              </Button>
            </TableCell>
            <TableCell>{quiz.teacher}</TableCell>
            <TableCell>{quiz.unit}</TableCell>
            <TableCell>{quiz.section}</TableCell>
            <TableCell align="right">
              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <CheckPills quiz={quiz} />
              </Box>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

const QuizzesView: React.FC<{
  dashboard: DashboardResponse;
  onOpenQuiz: (quiz: QuizSummary) => void;
}> = ({ dashboard, onOpenQuiz }) => {
  const [teacher, setTeacher] = useState<string | null>(null);
  const [unit, setUnit] = useState<string | null>(null);
  const [section, setSection] = useState<string | null>(null);
  const [quizNumber, setQuizNumber] = useState<number | null>(null);
  const [quizName, setQuizName] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      dashboard.quizzes.filter(
        (quiz) =>
          (!teacher || quiz.teacher === teacher) &&
          (!unit || quiz.unit === unit) &&
          (!section || quiz.section === section) &&
          (!quizNumber || quiz.quizNumber === quizNumber) &&
          (!quizName || quiz.quizName === quizName),
      ),
    [dashboard.quizzes, quizName, quizNumber, section, teacher, unit],
  );

  return (
    <Box>
      <SummaryBand dashboard={dashboard} />

      <Paper elevation={0} sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <FilterAltIcon color="primary" />
          <Typography variant="h6">Filters</Typography>
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Clear filters">
            <IconButton
              onClick={() => {
                setTeacher(null);
                setUnit(null);
                setSection(null);
                setQuizNumber(null);
                setQuizName(null);
              }}
            >
              <RestartAltIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              lg: "repeat(5, minmax(0, 1fr))",
            },
            gap: 1.5,
          }}
        >
          <Autocomplete
            options={unique(dashboard.quizzes.map((quiz) => quiz.teacher))}
            value={teacher}
            onChange={(_, value) => setTeacher(value)}
            renderInput={(params) => <TextField {...params} label="Teacher" size="small" />}
          />
          <Autocomplete
            options={unique(dashboard.quizzes.map((quiz) => quiz.unit))}
            value={unit}
            onChange={(_, value) => setUnit(value)}
            renderInput={(params) => <TextField {...params} label="Unit" size="small" />}
          />
          <Autocomplete
            options={unique(dashboard.quizzes.map((quiz) => quiz.section))}
            value={section}
            onChange={(_, value) => setSection(value)}
            renderInput={(params) => <TextField {...params} label="Section" size="small" />}
          />
          <Autocomplete
            options={unique(dashboard.quizzes.map((quiz) => quiz.quizNumber))}
            value={quizNumber}
            onChange={(_, value) => setQuizNumber(value)}
            getOptionLabel={formatQuizNumber}
            renderInput={(params) => <TextField {...params} label="Quiz number" size="small" />}
          />
          <Autocomplete
            options={unique(dashboard.quizzes.map((quiz) => quiz.quizName))}
            value={quizName}
            onChange={(_, value) => setQuizName(value)}
            renderInput={(params) => <TextField {...params} label="Quiz name" size="small" />}
          />
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
  const specificData = (selectedQuiz?.attempts || []).map((attempt, index) => ({
    attempt: index + 1,
    score: attempt.score,
    date: attempt.attemptDate,
    label: formatDateTime(attempt.createdAt),
  }));

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
              `${quiz.quizName} (${quiz.teacher}, ${quiz.unit})`
            }
            renderInput={(params) => <TextField {...params} label="Quiz" size="small" />}
          />

          <Box sx={{ height: 320 }}>
            {specificData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={specificData} margin={{ top: 16, right: 24, left: 6 }}>
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
        </Box>
      )}
    </Paper>
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
              {quiz.teacher} / {quiz.unit} / {quiz.section} / Quiz {quiz.quizNumber}
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
                    const questionResult = result?.results.find(
                      (item) => item.questionId === question.id,
                    );
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
                            bgcolor:
                              questionResult == null
                                ? "background.paper"
                                : questionResult.correct
                                  ? alpha(theme.palette.success.main, 0.12)
                                  : alpha(theme.palette.error.main, 0.08),
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
        await loadDashboard();
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
              {navItems.map((item) => (
                <ListItemButton
                  key={item.id}
                  selected={activeView === item.id}
                  onClick={() => setActiveView(item.id)}
                  disabled={!session.signedIn && item.id !== "account"}
                  sx={{ borderRadius: 1, mb: 0.5 }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              ))}
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
