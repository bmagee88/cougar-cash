// App.tsx
// React + TypeScript + MUI (v5) — CSV Quiz App with MobileStepper + localStorage persistence + attempt graph
//
// CSV headers (required):
// ["#","Question","Option A","Option B","Option C","Option D","Correct Answer","Rationale"]
//
// Features:
// - Upload CSV -> stored in localStorage (so you don't need to re-upload)
// - Select stored quizzes via Autocomplete
// - Delete one quiz (red X at right of Autocomplete input)
// - Delete all quizzes with confirmation dialog that requires typing "delete"
// - Username field (top) — scores tracked per username + quiz
// - MobileStepper delivers one question at a time
// - Grade shown at end + attempts graph (attempt # on X, score % on Y)
// - Attempts stored in localStorage keyed by username + quizId
//
// Notes:
// - CSV parser is reasonably robust (handles quoted fields, commas, CRLF), but not a full RFC4180 implementation for every edge case.
// - Correct Answer field accepted values: "A"|"B"|"C"|"D" (case-insensitive) OR exact match to the option text.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Paper,
  Stack,
  TextField,
  Button,
  Autocomplete,
  IconButton,
  InputAdornment,
  Divider,
  MobileStepper,
  RadioGroup,
  FormControlLabel,
  Radio,
  Box,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Tooltip,
} from "@mui/material";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import ClearIcon from "@mui/icons-material/Clear";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import ReplayIcon from "@mui/icons-material/Replay";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";

type CsvRow = Record<string, string>;

type Question = {
  num: string; // "#"
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correct: "A" | "B" | "C" | "D";
  rationale: string;
};

type StoredQuiz = {
  id: string;
  name: string;
  csvText: string;
  createdAt: number;
  questions: Question[];
};

type StoredQuizzesMap = Record<string, StoredQuiz>;
type UserScoresMap = Record<string, Record<string, number[]>>; // username -> quizId -> attempts (%)

const REQUIRED_HEADERS = [
  "#",
  "Question",
  "Option A",
  "Option B",
  "Option C",
  "Option D",
  "Correct Answer",
  "Rationale",
] as const;

const LS_QUIZZES_KEY = "csv_quiz_app__quizzes_v1";
const LS_SCORES_KEY = "csv_quiz_app__scores_v1";
const LS_LAST_QUIZ_KEY = "csv_quiz_app__last_quiz_id_v1";
const LS_LAST_USER_KEY = "csv_quiz_app__last_username_v1";

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function loadQuizzes(): StoredQuizzesMap {
  return safeJsonParse<StoredQuizzesMap>(localStorage.getItem(LS_QUIZZES_KEY), {});
}
function saveQuizzes(map: StoredQuizzesMap) {
  localStorage.setItem(LS_QUIZZES_KEY, JSON.stringify(map));
}
function loadScores(): UserScoresMap {
  return safeJsonParse<UserScoresMap>(localStorage.getItem(LS_SCORES_KEY), {});
}
function saveScores(map: UserScoresMap) {
  localStorage.setItem(LS_SCORES_KEY, JSON.stringify(map));
}

function normalizeHeader(h: string) {
  return h.trim();
}

// Simple stable hash for IDs (non-crypto)
function hashString(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // unsigned -> base36
  return (h >>> 0).toString(36);
}

/**
 * CSV parser that handles:
 * - comma separated
 * - quoted fields with escaped quotes ("")
 * - CRLF or LF newlines
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    // avoid pushing completely empty trailing row
    const isAllEmpty = row.length === 1 && row[0].trim() === "";
    if (!isAllEmpty) rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i += 1;
          continue;
        }
      } else {
        field += c;
        i += 1;
        continue;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
        i += 1;
        continue;
      }
      if (c === ",") {
        pushField();
        i += 1;
        continue;
      }
      if (c === "\n") {
        pushField();
        pushRow();
        i += 1;
        continue;
      }
      if (c === "\r") {
        // handle CRLF
        const next = text[i + 1];
        if (next === "\n") {
          pushField();
          pushRow();
          i += 2;
          continue;
        } else {
          pushField();
          pushRow();
          i += 1;
          continue;
        }
      }
      field += c;
      i += 1;
    }
  }

  // flush last field/row
  pushField();
  if (row.length > 0) pushRow();

  return rows;
}

function toRowsWithHeaders(csvText: string): { headers: string[]; rows: CsvRow[] } {
  const grid = parseCSV(csvText);
  if (grid.length === 0) return { headers: [], rows: [] };

  const headers = grid[0].map((h) => normalizeHeader(h));
  const rows: CsvRow[] = [];

  for (let r = 1; r < grid.length; r++) {
    const line = grid[r];
    // allow shorter lines; missing fields become ""
    const obj: CsvRow = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = (line[c] ?? "").trim();
    }
    // skip if completely blank row
    const anyValue = Object.values(obj).some((v) => v.trim() !== "");
    if (anyValue) rows.push(obj);
  }

  return { headers, rows };
}

function validateHeaders(headers: string[]): { ok: boolean; missing: string[] } {
  const set = new Set(headers.map(normalizeHeader));
  const missing = REQUIRED_HEADERS.filter((h) => !set.has(h));
  return { ok: missing.length === 0, missing: [...missing] };
}

function normalizeCorrectAnswer(
  row: CsvRow,
  options: { A: string; B: string; C: string; D: string }
): "A" | "B" | "C" | "D" {
  const raw = (row["Correct Answer"] ?? "").trim();
  const upper = raw.toUpperCase();

  if (upper === "A" || upper === "B" || upper === "C" || upper === "D") return upper;

  // If not letter, try matching option text (exact or case-insensitive)
  const entries: Array<["A" | "B" | "C" | "D", string]> = [
    ["A", options.A],
    ["B", options.B],
    ["C", options.C],
    ["D", options.D],
  ];

  const exact = entries.find(([, txt]) => txt.trim() === raw);
  if (exact) return exact[0];

  const ci = entries.find(([, txt]) => txt.trim().toLowerCase() === raw.toLowerCase());
  if (ci) return ci[0];

  // fallback
  return "A";
}

function buildQuestions(csvText: string): { questions: Question[]; error?: string } {
  const { headers, rows } = toRowsWithHeaders(csvText);
  const v = validateHeaders(headers);
  if (!v.ok) {
    return { questions: [], error: `Missing required headers: ${v.missing.join(", ")}` };
  }

  const questions: Question[] = rows.map((row) => {
    const options = {
      A: row["Option A"] ?? "",
      B: row["Option B"] ?? "",
      C: row["Option C"] ?? "",
      D: row["Option D"] ?? "",
    };

    const correct = normalizeCorrectAnswer(row, options);

    return {
      num: row["#"] ?? "",
      question: row["Question"] ?? "",
      options,
      correct,
      rationale: row["Rationale"] ?? "",
    };
  });

  const usable = questions.filter((q) => q.question.trim() !== "" && q.options.A.trim() !== "");
  if (usable.length === 0) {
    return { questions: [], error: "No valid questions found in CSV (check for blank rows/columns)." };
  }

  return { questions: usable };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function ScoreChart({
  attempts,
}: {
  attempts: number[]; // percentages
}) {
  const w = 640;
  const h = 220;
  const pad = 34;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;

  const points = useMemo(() => {
    if (!attempts.length) return [];
    const maxX = Math.max(1, attempts.length - 1);
    return attempts.map((pct, idx) => {
      const x = pad + (maxX === 0 ? 0 : (idx / maxX) * innerW);
      const y = pad + (1 - clamp(pct, 0, 100) / 100) * innerH;
      return { x, y, pct, idx };
    });
  }, [attempts, innerW, innerH]);

  const pathD = useMemo(() => {
    if (points.length === 0) return "";
    return points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");
  }, [points]);

  return (
    <Box sx={{ width: "100%", overflowX: "auto" }}>
      <Box sx={{ minWidth: w }}>
        <svg width={w} height={h} role="img" aria-label="Attempts vs score chart">
          {/* axes */}
          <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="currentColor" strokeWidth="1" />
          <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="currentColor" strokeWidth="1" />

          {/* y ticks (0,25,50,75,100) */}
          {[0, 25, 50, 75, 100].map((t) => {
            const y = pad + (1 - t / 100) * innerH;
            return (
              <g key={t}>
                <line x1={pad - 4} y1={y} x2={pad} y2={y} stroke="currentColor" strokeWidth="1" />
                <text x={pad - 8} y={y + 4} fontSize="11" textAnchor="end" fill="currentColor">
                  {t}
                </text>
              </g>
            );
          })}

          {/* x ticks (attempt #) */}
          {attempts.map((_, i) => {
            if (attempts.length > 12 && i % 2 === 1) return null;
            const maxX = Math.max(1, attempts.length - 1);
            const x = pad + (maxX === 0 ? 0 : (i / maxX) * innerW);
            return (
              <g key={i}>
                <line x1={x} y1={h - pad} x2={x} y2={h - pad + 4} stroke="currentColor" strokeWidth="1" />
                <text x={x} y={h - pad + 18} fontSize="11" textAnchor="middle" fill="currentColor">
                  {i + 1}
                </text>
              </g>
            );
          })}

          {/* labels */}
          <text x={w / 2} y={h - 6} fontSize="12" textAnchor="middle" fill="currentColor">
            Attempts
          </text>
          <text
            x={12}
            y={h / 2}
            fontSize="12"
            textAnchor="middle"
            fill="currentColor"
            transform={`rotate(-90 12 ${h / 2})`}
          >
            Score (%)
          </text>

          {/* line */}
          {pathD && <path d={pathD} fill="none" stroke="currentColor" strokeWidth="2" />}

          {/* points */}
          {points.map((p) => (
            <g key={p.idx}>
              <circle cx={p.x} cy={p.y} r={3.5} fill="currentColor" />
              <title>{`Attempt ${p.idx + 1}: ${Math.round(p.pct)}%`}</title>
            </g>
          ))}
        </svg>
      </Box>
    </Box>
  );
}

export default function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [username, setUsername] = useState<string>(() => localStorage.getItem(LS_LAST_USER_KEY) ?? "");
  const [quizzes, setQuizzes] = useState<StoredQuizzesMap>(() => loadQuizzes());
  const quizList = useMemo(() => Object.values(quizzes).sort((a, b) => b.createdAt - a.createdAt), [quizzes]);

  const [selectedQuizId, setSelectedQuizId] = useState<string>(() => localStorage.getItem(LS_LAST_QUIZ_KEY) ?? "");
  const selectedQuiz = useMemo(() => (selectedQuizId ? quizzes[selectedQuizId] : undefined), [quizzes, selectedQuizId]);

  const [error, setError] = useState<string>("");
  const [info, setInfo] = useState<string>("");

  // quiz run state
  const [activeStep, setActiveStep] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<number, "A" | "B" | "C" | "D" | "">>({});
  const [showResults, setShowResults] = useState<boolean>(false);

  // delete-all confirmation
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState("");

  const attemptsForUserAndQuiz = useMemo(() => {
    if (!username.trim() || !selectedQuizId) return [];
    const scores = loadScores();
    return scores[username.trim()]?.[selectedQuizId] ?? [];
  }, [username, selectedQuizId, showResults, quizzes]); // recompute after results

  useEffect(() => {
    localStorage.setItem(LS_LAST_USER_KEY, username);
  }, [username]);

  useEffect(() => {
    if (selectedQuizId) localStorage.setItem(LS_LAST_QUIZ_KEY, selectedQuizId);
  }, [selectedQuizId]);

  useEffect(() => {
    // if last selected quiz was deleted, pick newest
    if (selectedQuizId && !quizzes[selectedQuizId]) {
      const newest = Object.values(quizzes).sort((a, b) => b.createdAt - a.createdAt)[0];
      setSelectedQuizId(newest?.id ?? "");
    }
  }, [quizzes, selectedQuizId]);

  const total = selectedQuiz?.questions.length ?? 0;

  const currentQuestion = useMemo(() => {
    if (!selectedQuiz) return undefined;
    return selectedQuiz.questions[activeStep];
  }, [selectedQuiz, activeStep]);

  const currentAnswer = answers[activeStep] ?? "";

  const canGoBack = activeStep > 0;
  const canGoNext = selectedQuiz ? activeStep < selectedQuiz.questions.length - 1 : false;

  const resetRun = () => {
    setActiveStep(0);
    setAnswers({});
    setShowResults(false);
    setInfo("");
    setError("");
  };

  useEffect(() => {
    // when quiz changes, reset run
    resetRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuizId]);

  const handleUploadClick = () => {
    setError("");
    setInfo("");
    fileInputRef.current?.click();
  };

  const handleFilePicked = async (file: File | null) => {
    if (!file) return;
    setError("");
    setInfo("");

    const text = await file.text();

    const built = buildQuestions(text);
    if (built.error) {
      setError(built.error);
      return;
    }

    const id = `${file.name}__${hashString(text)}`;
    const quiz: StoredQuiz = {
      id,
      name: file.name,
      csvText: text,
      createdAt: Date.now(),
      questions: built.questions,
    };

    const next = { ...quizzes, [id]: quiz };
    setQuizzes(next);
    saveQuizzes(next);

    setSelectedQuizId(id);
    setInfo(`Loaded "${file.name}" (${built.questions.length} questions) and saved it to this browser.`);
  };

  const handleAnswerChange = (val: "A" | "B" | "C" | "D") => {
    setAnswers((prev) => ({ ...prev, [activeStep]: val }));
  };

  const grade = useMemo(() => {
    if (!selectedQuiz) return { correct: 0, total: 0, pct: 0 };
    const qs = selectedQuiz.questions;
    let correct = 0;
    for (let i = 0; i < qs.length; i++) {
      const a = answers[i];
      if (a && a === qs[i].correct) correct++;
    }
    const pct = qs.length ? (correct / qs.length) * 100 : 0;
    return { correct, total: qs.length, pct };
  }, [answers, selectedQuiz]);

  const finalizeAttempt = () => {
    const u = username.trim();
    if (!u) {
      setError("Enter a username before finishing so attempts can be saved.");
      return;
    }
    if (!selectedQuizId) return;

    const scores = loadScores();
    if (!scores[u]) scores[u] = {};
    if (!scores[u][selectedQuizId]) scores[u][selectedQuizId] = [];
    scores[u][selectedQuizId].push(Math.round(grade.pct * 10) / 10);
    saveScores(scores);
  };

  const handleFinish = () => {
    setError("");
    if (!selectedQuiz) return;

    // basic completeness check: must answer all
    const missing: number[] = [];
    for (let i = 0; i < selectedQuiz.questions.length; i++) {
      if (!answers[i]) missing.push(i);
    }
    if (missing.length) {
      setError(`Please answer all questions before finishing. Missing: ${missing.map((n) => n + 1).join(", ")}`);
      return;
    }

    finalizeAttempt();
    setShowResults(true);
    setInfo("Attempt saved.");
  };

  const deleteOneQuiz = (quizId: string) => {
    const next = { ...quizzes };
    delete next[quizId];
    setQuizzes(next);
    saveQuizzes(next);

    // also remove selected if needed
    if (selectedQuizId === quizId) {
      const newest = Object.values(next).sort((a, b) => b.createdAt - a.createdAt)[0];
      setSelectedQuizId(newest?.id ?? "");
    }

    setInfo("Quiz deleted from this browser.");
  };

  const openDeleteAll = () => {
    setDeleteAllConfirmText("");
    setDeleteAllOpen(true);
  };

  const confirmDeleteAll = () => {
    if (deleteAllConfirmText.trim().toLowerCase() !== "delete") return;

    // delete quizzes
    localStorage.removeItem(LS_QUIZZES_KEY);
    setQuizzes({});
    setSelectedQuizId("");
    resetRun();

    setDeleteAllOpen(false);
    setInfo("All CSV quizzes deleted from this browser.");
  };

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flex: 1 }}>
            CSV Quiz (Mobile Stepper)
          </Typography>

          <Tooltip title="Delete ALL stored quizzes (requires typing delete)">
            <span>
              <IconButton color="inherit" onClick={openDeleteAll} disabled={quizList.length === 0}>
                <DeleteForeverIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 3 }}>
        <Paper sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="stretch">
              <TextField
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                fullWidth
                helperText="Attempts are saved per username in this browser."
              />

              <Button
                variant="contained"
                startIcon={<UploadFileIcon />}
                onClick={handleUploadClick}
                sx={{ whiteSpace: "nowrap" }}
              >
                Upload CSV
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: "none" }}
                onChange={(e) => handleFilePicked(e.target.files?.[0] ?? null)}
              />
            </Stack>

            <Autocomplete
              options={quizList}
              value={selectedQuiz ?? null}
              getOptionLabel={(o) => o.name}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              onChange={(_, val) => setSelectedQuizId(val?.id ?? "")}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Stored CSV Quizzes"
                  placeholder="Upload a CSV or pick one saved in this browser"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {selectedQuizId ? (
                          <InputAdornment position="end">
                            <Tooltip title="Delete this quiz from local storage">
                              <IconButton
                                edge="end"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  deleteOneQuiz(selectedQuizId);
                                }}
                                sx={{
                                  color: "error.main",
                                }}
                              >
                                <ClearIcon />
                              </IconButton>
                            </Tooltip>
                          </InputAdornment>
                        ) : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />

            {error ? <Alert severity="error">{error}</Alert> : null}
            {info ? <Alert severity="info">{info}</Alert> : null}

            <Divider />

            {!selectedQuiz ? (
              <Alert severity="warning">
                Upload a CSV to begin. Your CSV will be saved to this browser automatically.
              </Alert>
            ) : showResults ? (
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="h5">Results</Typography>
                  <Chip label={`${grade.correct}/${grade.total}`} />
                  <Chip label={`${Math.round(grade.pct)}%`} />
                  <Chip label={`Quiz: ${selectedQuiz.name}`} />
                  {username.trim() ? <Chip label={`User: ${username.trim()}`} /> : null}
                </Stack>

                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle1" sx={{ mb: 1 }}>
                    Attempts vs Score
                  </Typography>
                  {attemptsForUserAndQuiz.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No attempts saved yet for this user + quiz.
                    </Typography>
                  ) : (
                    <ScoreChart attempts={attemptsForUserAndQuiz} />
                  )}
                </Paper>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <Button variant="contained" startIcon={<ReplayIcon />} onClick={resetRun}>
                    Try Again
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      // review mode: jump to first question, keep answers, but show results off
                      setActiveStep(0);
                      setShowResults(false);
                      setInfo("Review mode: your previous answers are still selected.");
                    }}
                  >
                    Review Answers
                  </Button>
                </Stack>

                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle1" sx={{ mb: 1 }}>
                    Answer Key & Rationales
                  </Typography>
                  <Stack spacing={1}>
                    {selectedQuiz.questions.map((q, idx) => {
                      const a = answers[idx] ?? "";
                      const correct = q.correct;
                      const ok = a === correct;
                      return (
                        <Paper key={idx} variant="outlined" sx={{ p: 1.5 }}>
                          <Stack spacing={0.5}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {idx + 1}. {q.question}
                            </Typography>
                            <Typography variant="body2" color={ok ? "success.main" : "error.main"}>
                              Your answer: {a || "—"} • Correct: {correct}
                            </Typography>
                            {q.rationale.trim() ? (
                              <Typography variant="body2" color="text.secondary">
                                Rationale: {q.rationale}
                              </Typography>
                            ) : null}
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>
                </Paper>
              </Stack>
            ) : (
              <Stack spacing={2}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
                  <Typography variant="h6" sx={{ flex: 1 }}>
                    {selectedQuiz.name}
                  </Typography>
                  <Chip label={`${total} questions`} />
                </Stack>

                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={1.5}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      Question {activeStep + 1} of {total}
                    </Typography>
                    <Typography variant="body1">{currentQuestion?.question}</Typography>

                    <RadioGroup
                      value={currentAnswer}
                      onChange={(e) => handleAnswerChange(e.target.value as any)}
                    >
                      {currentQuestion
                        ? (["A", "B", "C", "D"] as const).map((key) => (
                            <FormControlLabel
                              key={key}
                              value={key}
                              control={<Radio />}
                              label={`${key}. ${currentQuestion.options[key]}`}
                            />
                          ))
                        : null}
                    </RadioGroup>

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="stretch">
                      <Button
                        variant="contained"
                        onClick={() => {
                          setError("");
                          if (!currentAnswer) {
                            setError("Select an answer to continue.");
                            return;
                          }
                          if (canGoNext) setActiveStep((s) => s + 1);
                          else handleFinish();
                        }}
                        endIcon={canGoNext ? <NavigateNextIcon /> : undefined}
                      >
                        {canGoNext ? "Next" : "Finish & Grade"}
                      </Button>

                      <Button
                        variant="outlined"
                        disabled={!canGoBack}
                        startIcon={<NavigateBeforeIcon />}
                        onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
                      >
                        Back
                      </Button>

                      <Button
                        variant="text"
                        onClick={() => {
                          setAnswers((prev) => ({ ...prev, [activeStep]: "" }));
                        }}
                        disabled={!currentAnswer}
                      >
                        Clear answer
                      </Button>
                    </Stack>
                  </Stack>

                  <MobileStepper
                    variant="progress"
                    steps={total}
                    position="static"
                    activeStep={activeStep}
                    nextButton={
                      <Button
                        size="small"
                        onClick={() => {
                          setError("");
                          if (!currentAnswer) {
                            setError("Select an answer to continue.");
                            return;
                          }
                          if (canGoNext) setActiveStep((s) => s + 1);
                          else handleFinish();
                        }}
                        disabled={!selectedQuiz}
                      >
                        {canGoNext ? "Next" : "Finish"}
                        <NavigateNextIcon fontSize="small" />
                      </Button>
                    }
                    backButton={
                      <Button size="small" onClick={() => setActiveStep((s) => s - 1)} disabled={!canGoBack}>
                        <NavigateBeforeIcon fontSize="small" />
                        Back
                      </Button>
                    }
                    sx={{ mt: 2 }}
                  />
                </Paper>

                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Attempts (this user + this quiz)
                  </Typography>
                  {!username.trim() ? (
                    <Typography variant="body2" color="text.secondary">
                      Enter a username to see your saved attempt history.
                    </Typography>
                  ) : attemptsForUserAndQuiz.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No attempts saved yet.
                    </Typography>
                  ) : (
                    <>
                      <ScoreChart attempts={attemptsForUserAndQuiz} />
                      <Typography variant="caption" color="text.secondary">
                        Latest: {attemptsForUserAndQuiz[attemptsForUserAndQuiz.length - 1]}%
                      </Typography>
                    </>
                  )}
                </Paper>
              </Stack>
            )}
          </Stack>
        </Paper>
      </Container>

      {/* Delete all confirmation */}
      <Dialog open={deleteAllOpen} onClose={() => setDeleteAllOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Delete all stored CSV quizzes?</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <Alert severity="warning">
              This removes all uploaded CSV quizzes from <b>this browser</b>. (Your attempt history is not deleted.)
            </Alert>
            <Typography variant="body2" color="text.secondary">
              To confirm, type <b>delete</b> below:
            </Typography>
            <TextField
              autoFocus
              label='Type "delete" to confirm'
              value={deleteAllConfirmText}
              onChange={(e) => setDeleteAllConfirmText(e.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteAllOpen(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={confirmDeleteAll}
            disabled={deleteAllConfirmText.trim().toLowerCase() !== "delete"}
            startIcon={<DeleteForeverIcon />}
          >
            Delete All Quizzes
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}