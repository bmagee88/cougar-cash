import React, { useEffect, useMemo, useState } from "react";
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Autocomplete, Box, Button, CssBaseline, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, Paper, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TableSortLabel, TextField,
  ThemeProvider, Tooltip, Typography, createTheme,
} from "@mui/material";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import FilterListIcon from "@mui/icons-material/FilterList";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import HistoryIcon from "@mui/icons-material/History";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import QuizOutlinedIcon from "@mui/icons-material/QuizOutlined";
import { catalogErrors, filterQuizzes, filterValue, filterValues, quizzes, UNSPECIFIED_SOURCE_VALUE } from "./catalog";
import { attemptStats, formatPercent } from "./quizEngine";
import { completedQuizStats, DailyLimitError, dailyProgress, localDayKey, proficiencyColor } from "./quizStats";
import { quizPrompt } from "./quizPrompt";
import { emptyFilters, emptyProgress, PROGRESS_KEY, readFilters, readProgress, saveAttempt, saveFilters } from "./storage";
import { ConceptState, LocalAttempt, LocalProgress, QuizDefinition, QuizFilters, QuizSessionState } from "./types";
import QuizRunner from "./QuizRunner";
import QuizSources from "./QuizSources";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#63dcc7", contrastText: "#102923" },
    secondary: { main: "#c2b2ff" },
    success: { main: "#80d6a6" },
    warning: { main: "#edbc79" },
    background: { default: "#0c121b", paper: "#131d29" },
    text: { primary: "#edf3fa", secondary: "#a3b2c4" },
    divider: "#273546",
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h4: { fontWeight: 750, letterSpacing: "-0.04em" },
    h5: { fontWeight: 750, letterSpacing: "-0.025em" },
    h6: { fontWeight: 650, fontSize: "1.05rem" },
    button: { textTransform: "none", fontWeight: 650 },
  },
  components: {
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none", border: "1px solid #273546" } } },
    MuiTableCell: { styleOverrides: { root: { borderColor: "#273546" }, head: { color: "#a3b2c4", fontWeight: 600, whiteSpace: "nowrap" } } },
    MuiButton: { styleOverrides: { root: { borderRadius: 8 } } },
  },
});

const fields: { key: keyof QuizFilters; label: string }[] = [
  { key: "quizNumber", label: "Quiz #" },
  { key: "quizName", label: "Quiz name" },
  { key: "teacher", label: "Teacher" },
  { key: "gradeLevel", label: "Grade" },
  { key: "textbook", label: "Textbook" },
  { key: "chapters", label: "Chapters" },
  { key: "sections", label: "Sections" },
];

type QuizRow = QuizDefinition & {
  total: number; perfect: number; below: number;
  completedTotal: number; completedPerfect: number;
  perfectPercent: number | null; belowPercent: number | null;
  dailyAttempts: number; dailyAllowed: number; dailyBonus: number;
  lastTaken: string;
};
type SortKey = keyof QuizFilters | "completedTotal" | "perfectPercent" | "dailyAttempts" | "lastTaken";
const columns: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "quizName", label: "Quiz name" },
  { key: "perfectPercent", label: "Proficiency", align: "right" },
  { key: "dailyAttempts", label: "Daily progress", align: "right" },
  { key: "completedTotal", label: "Total complete", align: "right" },
  { key: "lastTaken", label: "Last taken" },
  { key: "quizNumber", label: "Quiz #" },
  ...fields.filter((field) => field.key !== "quizName" && field.key !== "quizNumber"),
];
const formatDate = (value: string) => value ? new Date(value).toLocaleString([], {
  month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
}) : "—";
const optionLabel = (key: keyof QuizFilters, value: string) => key === "gradeLevel"
  ? value === "unassigned" ? "Unassigned" : `Grade ${value}` : value === UNSPECIFIED_SOURCE_VALUE ? "Unspecified" : value;

const Proficiency: React.FC<{ percent: number | null; perfect: number; total: number }> = ({ percent, perfect, total }) => (
  <Typography component="span"
    aria-label={`Proficiency ${formatPercent(percent)}: ${perfect} perfect out of ${total} completed quizzes`}
    sx={{ color: proficiencyColor(percent), fontSize: 28, lineHeight: 1.15, fontWeight: 800,
      whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
    {formatPercent(percent)}
  </Typography>
);

const QuizApp3Page: React.FC = () => {
  const [initial] = useState(() => {
    try { return { progress: readProgress(), error: "" }; } catch {
      return { progress: emptyProgress(), error: "Local quiz progress is unavailable. Enable browser storage to save attempts on this device." };
    }
  });
  const [progress, setProgress] = useState<LocalProgress>(initial.progress);
  const [storageError, setStorageError] = useState(initial.error);
  const [today, setToday] = useState(() => localDayKey());
  const [filters, setFilters] = useState<QuizFilters>(() => {
    const saved = readFilters();
    fields.forEach(({ key }) => {
      if (!quizzes.some((quiz) => filterValues(quiz, key).includes(saved[key]))) saved[key] = "";
    });
    return saved;
  });
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("quizNumber");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [activeQuiz, setActiveQuiz] = useState<QuizDefinition | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Quiz App 3";
    return () => { document.title = previousTitle; };
  }, []);
  useEffect(() => { saveFilters(filters); }, [filters]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refreshDay = () => {
      clearTimeout(timer);
      setToday(localDayKey());
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      timer = setTimeout(refreshDay, midnight.getTime() - Date.now() + 50);
    };
    refreshDay();
    window.addEventListener("focus", refreshDay);
    document.addEventListener("visibilitychange", refreshDay);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refreshDay);
      document.removeEventListener("visibilitychange", refreshDay);
    };
  }, []);
  useEffect(() => {
    const refresh = (event: StorageEvent) => {
      if (event.key !== PROGRESS_KEY && event.key !== null) return;
      try { setProgress(readProgress()); setStorageError(""); } catch {
        setStorageError("Local quiz progress could not be read. Your saved data has not been overwritten.");
      }
    };
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  const rows = useMemo<QuizRow[]>(() => quizzes.map((quiz) => {
    const attempts = progress.attempts.filter((attempt) => attempt.quizId === quiz.id);
    return { ...quiz, ...attemptStats(attempts), ...completedQuizStats(attempts), ...dailyProgress(quiz, attempts, today), lastTaken: attempts[attempts.length - 1]?.createdAt || "" };
  }), [progress, today]);
  const recent = useMemo(() => [...rows].filter((row) => row.total > 0)
    .sort((a, b) => b.lastTaken.localeCompare(a.lastTaken)).slice(0, 3), [rows]);
  const visibleRows = useMemo(() => {
    const matchingIds = new Set(filterQuizzes(quizzes, filters).map((quiz) => quiz.id));
    const query = search.trim().toLocaleLowerCase();
    const filtered = rows.filter((row) => matchingIds.has(row.id) && (!query ||
      [row.quizName, row.teacher, ...row.sources.flatMap((source) => [source.textbook, source.chapters, source.sections]), row.quizNumber, row.gradeLevel, row.sourceName]
        .join(" ").toLocaleLowerCase().includes(query)));
    return filtered.sort((a, b) => {
      const left = sortKey === "textbook" || sortKey === "chapters" || sortKey === "sections" ? filterValue(a, sortKey) : a[sortKey];
      const right = sortKey === "textbook" || sortKey === "chapters" || sortKey === "sections" ? filterValue(b, sortKey) : b[sortKey];
      const comparison = typeof left === "number" || typeof right === "number"
        ? Number(left ?? -1) - Number(right ?? -1)
        : String(left || "").localeCompare(String(right || ""), undefined, { numeric: true, sensitivity: "base" });
      return comparison * (direction === "asc" ? 1 : -1) || a.quizName.localeCompare(b.quizName);
    });
  }, [rows, filters, search, sortKey, direction]);

  const record = (attempt: LocalAttempt, state: ConceptState, sessionState: QuizSessionState) => {
    const quiz = quizzes.find((item) => item.id === attempt.quizId)!;
    const latest = readProgress();
    const daily = dailyProgress(quiz, latest.attempts);
    if (daily.dailyAttempts >= daily.dailyAllowed) { setProgress(latest); throw new DailyLimitError(); }
    const next = saveAttempt(attempt, state, sessionState);
    setProgress(next);
    setStorageError("");
  };
  const openQuiz = (quiz: QuizDefinition) => {
    setActiveQuiz(quiz);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  };
  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(quizPrompt);
      setCopyMessage("Prompt copied. Paste it into AI and fill in the variables at the top.");
    } catch { setCopyMessage("Select the prompt text and copy it with Ctrl+C (or Command+C)."); }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", color: "text.primary" }}>
        <Box component="header" sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "#101923" }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ maxWidth: 1560, mx: "auto", px: { xs: 2, md: 4 }, py: 2 }}>
            <QuizOutlinedIcon color="primary" />
            <Typography variant="h6" sx={{ flex: 1 }}>Quiz App 3</Typography>
            <Button size="small" variant="outlined" startIcon={<AutoAwesomeOutlinedIcon fontSize="small" />}
              onClick={() => { setPromptOpen(true); setCopyMessage(""); }}>
              Quiz prompt
            </Button>
          </Stack>
        </Box>

        <Box component="main" sx={{ maxWidth: 1560, mx: "auto", px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 } }}>
          {storageError && <Alert severity="warning" sx={{ mb: 2 }}>{storageError}</Alert>}
          {catalogErrors.length > 0 && <Alert severity="error" sx={{ mb: 2 }}>Some quiz files could not be loaded: {catalogErrors.join(" ")}</Alert>}
          {activeQuiz ? (
            <QuizRunner key={`${activeQuiz.id}:${today}`} quiz={activeQuiz}
              initialConceptState={progress.conceptStates[activeQuiz.id] || {}}
              initialSession={progress.quizSessions?.[activeQuiz.id]?.date === today ? progress.quizSessions[activeQuiz.id].state : undefined}
              attempts={progress.attempts}
              attemptCount={progress.attempts.filter((attempt) => attempt.quizId === activeQuiz.id).length}
              onRecord={record} onBack={() => setActiveQuiz(null)} />
          ) : (
            <>
              <Box sx={{ mb: 3.5 }}>
                <Typography component="h1" variant="h4" sx={{ mb: 1 }}>A little practice. Lasting progress.</Typography>
                <Typography color="text.secondary">Four questions at a time. Your progress stays on this device.</Typography>
              </Box>

              <Box component="section" aria-labelledby="recent-heading" sx={{ mb: 4 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <HistoryIcon fontSize="small" sx={{ color: "text.secondary" }} />
                  <Typography id="recent-heading" component="h2" variant="h6">3 most recent quizzes</Typography>
                </Stack>
                {recent.length ? (
                  <Box sx={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: { xs: "minmax(220px, 1fr)", md: "auto" },
                    gridTemplateColumns: { xs: "none", md: "repeat(3, minmax(0, 1fr))" }, overflowX: "auto", gap: 2, pb: 0.5 }}>
                    {recent.map((quiz) => (
                        <Paper key={quiz.id} elevation={0} sx={{ p: { xs: 1.5, md: 2.5 }, display: "flex", flexDirection: "column", minWidth: 0,
                          "& [aria-label^='Proficiency']": { fontSize: { xs: 20, md: 28 } } }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                            <Typography variant="h6" component="h3" sx={{ flex: 1, minWidth: 0, fontSize: { xs: 14, md: "1.05rem" },
                              whiteSpace: "normal", overflowWrap: "anywhere" }} title={quiz.quizName}>{quiz.quizName}</Typography>
                            <Proficiency percent={quiz.perfectPercent} perfect={quiz.completedPerfect} total={quiz.completedTotal} />
                          </Stack>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{formatDate(quiz.lastTaken)}</Typography>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mt: "auto", pt: 2 }}>
                            <Button aria-label="Take quiz" startIcon={<PlayArrowIcon />} onClick={() => openQuiz(quiz)} sx={{ px: 0, minWidth: { xs: 28, md: 64 },
                              "& .MuiButton-startIcon": { mr: { xs: 0, md: 1 }, ml: 0 } }}><Box component="span" sx={{ display: { xs: "none", md: "inline" } }}>Take quiz</Box></Button>
                            <Box aria-label={`Daily attempts for ${quiz.quizName}`} sx={{
                              border: 1, borderColor: "divider", bgcolor: "#101923", borderRadius: 1,
                              px: { xs: 0.75, md: 1.25 }, py: { xs: 0.5, md: 0.75 }, textAlign: "right", flexShrink: 0,
                            }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", md: "block" } }}>Daily attempts</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", fontSize: { xs: 12, md: 14 }, whiteSpace: "nowrap" }}>
                                Attempt {quiz.dailyAttempts} / {quiz.dailyAllowed}
                              </Typography>
                            </Box>
                          </Stack>
                        </Paper>
                    ))}
                  </Box>
                ) : (
                  <Paper elevation={0} sx={{ p: 3, borderStyle: "dashed" }}>
                    <Typography color="text.secondary">Your three most recently taken quizzes will appear here after you submit an attempt.</Typography>
                  </Paper>
                )}
              </Box>

              <Paper component="section" aria-labelledby="library-heading" elevation={0} sx={{ overflow: "hidden" }}>
                <Box sx={{ p: { xs: 2, md: 3 } }}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems={{ sm: "center" }}>
                    <Box>
                      <Typography id="library-heading" component="h2" variant="h5">Quiz search</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{visibleRows.length} of {quizzes.length} quizzes</Typography>
                    </Box>
                    <TextField label="Search quizzes" size="small" value={search} onChange={(event) => setSearch(event.target.value)} sx={{ width: { xs: "100%", sm: 320 } }} />
                  </Stack>
                  <Accordion disableGutters elevation={0} sx={{ mt: 2, border: 0, bgcolor: "transparent", "&::before": { display: "none" } }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="quiz-filter-fields" id="quiz-filter-heading" sx={{ px: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <FilterListIcon fontSize="small" sx={{ color: "text.secondary" }} />
                    <Typography variant="body2" color="text.secondary">Filter by{Object.values(filters).filter(Boolean).length > 0 ? ` (${Object.values(filters).filter(Boolean).length})` : ""}</Typography>
                  </Stack>
                  </AccordionSummary>
                  <AccordionDetails id="quiz-filter-fields" sx={{ px: 0, pb: 0 }}>
                  <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1.5 }}>
                    <Button size="small" onClick={() => { setFilters(emptyFilters()); setSearch(""); }}
                      disabled={!search && !Object.values(filters).some(Boolean)}>Clear filters</Button>
                  </Box>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "0.65fr 1.5fr 1fr 0.85fr 1.3fr 1fr 1fr" }, gap: 1.5 }}>
                    {fields.map(({ key, label }) => (
                      <Autocomplete key={key} size="small" fullWidth
                        options={Array.from(new Set(quizzes.flatMap((quiz) => filterValues(quiz, key))))
                          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))}
                        value={filters[key] || null} getOptionLabel={(value) => optionLabel(key, value)}
                        onChange={(_, value) => setFilters((previous) => ({ ...previous, [key]: value || "" }))}
                        renderInput={(params) => <TextField {...params} label={label} />} />
                    ))}
                  </Box>
                  </AccordionDetails>
                  </Accordion>
                </Box>
                <TableContainer>
                  <Table size="small" aria-label="Quiz search results" sx={{
                    width: "100%", minWidth: 1400, tableLayout: "fixed",
                    "& th, & td": { px: 1, overflowWrap: "anywhere", fontSize: 13 },
                    "& th": { whiteSpace: "nowrap", overflowWrap: "normal", wordBreak: "normal", fontSize: 12 },
                    "& td .MuiTypography-root[aria-label^='Proficiency']": { fontSize: "clamp(14px, 2.4vw, 28px)" },
                  }}>
                    <colgroup>
                      {[17, 10, 10, 7, 11, 4, 6, 6, 13, 8, 8].map((width, index) => (
                        <col key={index} style={{ width: `${width}%` }} />
                      ))}
                    </colgroup>
                    <TableHead sx={{ bgcolor: "#192533" }}>
                      <TableRow>
                        {columns.map((column) => (
                          <TableCell key={column.key} align={column.align} sortDirection={sortKey === column.key ? direction : false} sx={{ py: 1.75,
                            ...(column.key === "quizNumber" ? { borderLeft: "2px solid", borderLeftColor: "divider" } : {}),
                          }}>
                            <TableSortLabel hideSortIcon active={sortKey === column.key} direction={sortKey === column.key ? direction : "asc"}
                              sx={{ maxWidth: "100%", whiteSpace: "nowrap", lineHeight: 1.35,
                                "& .MuiTableSortLabel-icon": { position: "absolute", right: -13, fontSize: 13, m: 0 } }}
                              onClick={() => { setDirection(sortKey === column.key && direction === "asc" ? "desc" : "asc"); setSortKey(column.key); }}>
                              {column.label}
                            </TableSortLabel>
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {visibleRows.map((quiz) => (
                        <TableRow key={quiz.id} hover>
                          <TableCell>
                            <Button startIcon={<PlayArrowIcon />} onClick={() => openQuiz(quiz)} sx={{ textAlign: "left", justifyContent: "flex-start", px: 0,
                              minWidth: 0, maxWidth: "100%", fontSize: 13, lineHeight: 1.4, overflowWrap: "anywhere",
                              "& .MuiButton-startIcon": { mr: 0.5, ml: 0 }, "& svg": { fontSize: 16 } }}>{quiz.quizName}</Button>
                            <Box sx={{ mb: 1 }}>
                              {quiz.sources.map((source, index) => (
                                <Typography key={index} variant="caption" display="block" color="text.secondary">
                                  {[source.textbook, source.chapters, source.sections].filter(Boolean).join(" · ")}
                                </Typography>
                              ))}
                            </Box>
                          </TableCell>
                          <TableCell align="right"><Proficiency percent={quiz.perfectPercent} perfect={quiz.completedPerfect} total={quiz.completedTotal} /></TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums", "&&": { fontSize: 22, fontWeight: 700 } }}>
                            {quiz.dailyAttempts} / {quiz.dailyAllowed}
                            {quiz.dailyBonus > 0 && (
                              <Tooltip title="One earned bonus round is included in today's allowance">
                                <Box component="span" aria-label="One bonus round earned today" sx={{
                                  display: "inline-block", ml: 1, px: 0.75, py: 0.25, borderRadius: 1,
                                  color: "primary.main", bgcolor: "rgba(99, 220, 199, 0.12)", fontSize: 13, fontWeight: 800,
                                }}>+1</Box>
                              </Tooltip>
                            )}
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{quiz.completedTotal}</TableCell>
                          <TableCell sx={{ color: "text.secondary", fontSize: 12 }}>{formatDate(quiz.lastTaken)}</TableCell>
                          <TableCell sx={{ color: "text.secondary", borderLeft: "2px solid", borderLeftColor: "divider" }}>{quiz.quizNumber}</TableCell>
                          <TableCell>{quiz.teacher}</TableCell>
                          <TableCell>{quiz.gradeLevel === null ? "Unassigned" : `Grade ${quiz.gradeLevel}`}</TableCell>
                          <TableCell colSpan={3} style={{ paddingLeft: 0, paddingRight: 0 }}><QuizSources sources={quiz.sources} /></TableCell>
                        </TableRow>
                      ))}
                      {!visibleRows.length && <TableRow><TableCell colSpan={columns.length} sx={{ py: 5, textAlign: "center" }}>
                        <Typography>No quizzes match your search.</Typography>
                        <Button onClick={() => { setFilters(emptyFilters()); setSearch(""); }}>Clear filters</Button>
                      </TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Typography variant="caption" component="p" color="text.secondary" sx={{ px: 3, py: 2, borderTop: 1, borderColor: "divider" }}>
                  Proficiency = quizzes completed with 100% ÷ total completed quizzes. A quiz is completed after its regular rounds and any earned bonus round. — means no completed quizzes yet. Daily progress counts today’s submissions; +1 marks the single earned bonus round included in the allowance.
                </Typography>
              </Paper>
            </>
          )}
        </Box>
      </Box>

      <Dialog open={promptOpen} onClose={() => setPromptOpen(false)} maxWidth="md" fullWidth aria-labelledby="prompt-heading">
        <DialogTitle id="prompt-heading" sx={{ pr: 6 }}>Create a quiz with AI
          <IconButton aria-label="Close prompt" onClick={() => setPromptOpen(false)} sx={{ position: "absolute", right: 12, top: 12 }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Enter one or more textbooks and their chapter/section ranges in the variables at the top. Each book appears on its own line within the same quiz entry. The prompt asks AI for distinct study concepts covering those sources to prepare students for a later 10-question test. Save the returned JSON in <Box component="code">src/QuizApp3/quizzes/</Box> and push it to the repo.</Typography>
          <TextField fullWidth multiline minRows={12} maxRows={22} label="AI quiz creation prompt" value={quizPrompt}
            slotProps={{ input: { readOnly: true, sx: { fontFamily: "monospace", fontSize: 13, lineHeight: 1.7 } } }} />
          {copyMessage && <Alert severity="info" sx={{ mt: 2 }} role="status">{copyMessage}</Alert>}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setPromptOpen(false)}>Close</Button>
          <Button variant="contained" startIcon={<ContentCopyIcon />} onClick={copyPrompt}>Copy prompt</Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
};

export default QuizApp3Page;
