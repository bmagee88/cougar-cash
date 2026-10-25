import React, { useEffect, useRef, useState } from "react";
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, LinearProgress, Paper, Snackbar, Stack, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CelebrationIcon from "@mui/icons-material/Celebration";
import MatchingBoard from "../CQuiz2/MatchingBoard";
import QuizSources from "./QuizSources";
import { createDailyRound, createSession, submitRound } from "./quizEngine";
import { DailyLimitError, dailyProgress, localDayKey } from "./quizStats";
import { readRound, saveRound } from "./storage";
import { ConceptState, LocalAttempt, MatchingItem, QuizDefinition, QuizSessionState } from "./types";

const QuizRunner: React.FC<{
  quiz: QuizDefinition;
  initialConceptState: ConceptState;
  initialSession?: QuizSessionState;
  attempts: LocalAttempt[];
  attemptCount: number;
  started: boolean;
  onBegin: () => void;
  onRecord: (attempt: LocalAttempt, state: ConceptState, session: QuizSessionState) => void;
  onBack: () => void;
}> = ({ quiz, initialConceptState, initialSession, attempts, attemptCount, started, onBegin, onRecord, onBack }) => {
  const today = localDayKey();
  const daily = dailyProgress(quiz, attempts);
  const dailyDone = daily.dailyAttempts >= daily.dailyAllowed;
  const quizAttempts = attempts.filter((attempt) => attempt.quizId === quiz.id);
  const [restored] = useState(() => {
    try { return { saved: readRound(quiz), error: "" }; } catch {
      return { saved: undefined, error: "The previous round could not be restored. Your submitted attempts are still saved." };
    }
  });
  const [session, setSession] = useState(() => initialSession || createSession(quiz, initialConceptState));
  const sessionDate = useRef(today);
  const [round, setRound] = useState(() => {
    const saved = restored.saved;
    if (!saved) return createDailyRound(quiz, session, daily);
    // Carry the question/answer arrangement across midnight, while starting
    // fresh daily coverage and bonus eligibility for an unsubmitted round.
    if (saved.date !== today && !quizAttempts.some((attempt) => attempt.id === saved.round.id)) {
      return { ...saved.round, mode: session.bonusEligible ? "required" as const : "practice" as const };
    }
    return saved.round;
  });
  const [roundDate, setRoundDate] = useState(restored.saved?.date || today);
  const [answers, setAnswers] = useState<MatchingItem[]>(restored.saved?.answers || round.answers);
  const [checkedAnswers, setCheckedAnswers] = useState<Record<string, boolean>>(restored.saved?.checkedAnswers || {});
  const [result, setResult] = useState<LocalAttempt | null>(() => quizAttempts.find((attempt) => attempt.id === round.id) || null);
  const [error, setError] = useState("");
  const [savedNotice, setSavedNotice] = useState("");
  const [scoreGain, setScoreGain] = useState(0);
  const [draftError, setDraftError] = useState(restored.error);
  const submittedRound = useRef("");
  const resultNumber = result ? quizAttempts.findIndex((attempt) => attempt.id === result.id) + 1 : 0;
  const resultFromEarlierDay = !!result && localDayKey(new Date(result.createdAt)) !== today;
  const showQuestions = started && !resultFromEarlierDay;

  useEffect(() => {
    if (!started) return;
    try {
      saveRound(quiz.id, { date: roundDate, round, answers, checkedAnswers });
      setDraftError(restored.error);
    } catch {
      setDraftError("This unfinished round could not be saved. Keep this page open to avoid losing your answer arrangement.");
    }
  }, [quiz.id, roundDate, round, answers, checkedAnswers, restored.error, started]);

  const handleSubmit = () => {
    const currentDay = localDayKey();
    const currentDaily = dailyProgress(quiz, attempts, currentDay);
    if (!showQuestions || result || submittedRound.current === round.id || currentDaily.dailyAttempts >= currentDaily.dailyAllowed) return;
    submittedRound.current = round.id;
    setError("");
    const currentSession = sessionDate.current === currentDay ? session : createSession(quiz, initialConceptState);
    const currentRound = sessionDate.current === currentDay ? round : {
      ...round, mode: currentSession.bonusEligible ? "required" as const : "practice" as const,
    };
    const next = submitRound(quiz, currentSession, currentRound, answers, currentDaily.dailyAttempts + 1);
    const previousScore = Math.round(quiz.concepts.filter((concept) => currentSession.conceptState[concept.conceptKey]).length /
      Math.max(1, quiz.concepts.length) * 100);
    next.state.bonusRoundsEarned = Math.max(currentDaily.dailyBonus, next.state.bonusRoundsEarned);
    try {
      const attempt: LocalAttempt = {
        id: round.id, quizId: quiz.id, score: next.score,
        correctCount: next.correctCount, totalCount: next.totalCount,
        createdAt: new Date().toISOString(),
        bonusRoundsEarned: next.state.bonusRoundsEarned,
        completedQuiz: currentDaily.dailyAttempts + 1 >= currentDaily.dailyBase + next.state.bonusRoundsEarned,
      };
      onRecord(attempt, next.state.conceptState, next.state);
      sessionDate.current = currentDay;
      setSession(next.state);
      setResult(attempt);
      setScoreGain(Math.max(0, next.score - previousScore));
      setSavedNotice(`Attempt ${quizAttempts.length + 1} saved on this device.`);
    } catch (err) {
      submittedRound.current = "";
      setError(err instanceof DailyLimitError ? err.message : "Your result could not be saved to this device. Keep this page open, enable browser storage or free some space, and try Submit again.");
    }
  };

  const nextRound = () => {
    if (dailyDone) return;
    const next = createDailyRound(quiz, session, daily);
    setRound(next);
    setRoundDate(today);
    setAnswers(next.answers);
    setCheckedAnswers({});
    setResult(null);
    setScoreGain(0);
    setError("");
  };

  const beginQuiz = () => {
    if (dailyDone) return;
    if (result) nextRound();
    onBegin();
  };

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto" }}>
      <Button onClick={onBack} startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>All quizzes</Button>
      <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between">
          <Box>
            <Typography variant="overline" color="primary.main">Quiz {quiz.quizNumber}</Typography>
            <Typography component="h1" variant="h5">{quiz.quizName}</Typography>
            <Typography color="text.secondary" variant="body2" sx={{ mt: 0.75 }}>
              {quiz.teacher} / {quiz.gradeLevel === null ? "Unassigned grade" : `Grade ${quiz.gradeLevel}`}
            </Typography>
            <Box sx={{ mt: 1 }}><QuizSources sources={quiz.sources} /></Box>
          </Box>
          <Chip label={`Attempt ${showQuestions && result ? resultNumber : dailyDone ? attemptCount : attemptCount + 1}`} variant="outlined" sx={{ alignSelf: "flex-start" }} />
          <Chip label={`Today ${daily.dailyAttempts} / ${daily.dailyAllowed}`} variant="outlined" sx={{ alignSelf: "flex-start" }} />
        </Stack>
      </Paper>

      {showQuestions && result && <Box sx={{ position: "relative", pt: 3.5, mb: 2 }}>
        <Typography variant="body2" aria-live="polite" sx={{
          position: "absolute", top: 0, left: `clamp(80px, ${result.score}%, 100%)`,
          transform: "translateX(-100%)", color: "primary.main", fontWeight: 800, whiteSpace: "nowrap",
        }}>Score {result.score}%</Typography>
        <LinearProgress aria-label="Quiz concept score" variant="determinate" value={result.score}
          sx={{ height: 12, borderRadius: 6, "& .MuiLinearProgress-bar": { borderRadius: 6 } }} />
      </Box>}
      {showQuestions && result && scoreGain > 0 && <Paper key={result.id} role="status" sx={{
        p: 2, mb: 2, borderColor: "primary.main", background: "linear-gradient(120deg, rgba(99,220,199,0.18), rgba(246,211,74,0.08))",
        animation: "score-celebration 450ms ease-out",
        "@keyframes score-celebration": { from: { opacity: 0, transform: "scale(0.96)" }, to: { opacity: 1, transform: "scale(1)" } },
        "@media (prefers-reduced-motion: reduce)": { animation: "none" },
      }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <CelebrationIcon sx={{ color: "#f6d34a", fontSize: 38 }} />
          <Box>
            <Typography variant="h5" color="primary.main">Score up! +{scoreGain} percentage points</Typography>
            <Typography>{result.score - scoreGain}% → {result.score}% — Great work!</Typography>
          </Box>
        </Stack>
      </Paper>}

      {dailyDone && (
        <Alert severity="success">You have completed today's allowed attempts for this quiz. Come back tomorrow to continue.</Alert>
      )}
      {showQuestions && restored.saved?.round.id === round.id && !result && <Alert severity="info" sx={{ mb: 2 }}>
        Your unsubmitted round has been restored{roundDate !== today ? ` from ${roundDate}` : ""}. Submit saves it as an attempt for today.
      </Alert>}
      {draftError && <Alert severity="warning" sx={{ mb: 2 }}>{draftError}</Alert>}
      <Accordion disableGutters elevation={0} sx={{ mb: 2, "&::before": { display: "none" } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="quiz-directions-content" id="quiz-directions-heading">
          <Typography sx={{ fontWeight: 700 }}>Directions</Typography>
        </AccordionSummary>
        <AccordionDetails id="quiz-directions-content">
        <Box component="ol" sx={{ pl: 3, my: 1, "& li": { mb: 0.5 } }}>
          <Typography component="li" variant="body2">Read each numbered question. Select a question to highlight it and dim the other questions. Click away from the question or reorder answers to show all questions again.</Typography>
          <Typography component="li" variant="body2">Hover over a question or answer to reveal its speaker button, then select the speaker to hear the text. Speaker buttons also appear when using Tab to focus the controls and stay visible on touchscreens. Press the stop button to stop reading.</Typography>
          <Typography component="li" variant="body2">Drag each answer beside its matching question. Dropping an answer swaps the two answers. Checkboxes are reminders and do not affect your score.</Typography>
          <Typography component="li" variant="body2">Choose Submit to save and score this attempt. Then choose Keep Going or Take bonus round until today's allowance is complete.</Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          Keyboard: Tab to a question and press Enter to highlight it. Tab to an answer, press Space, use the arrow keys, then press Space to place it. Tab to a speaker and press Enter to read aloud.
        </Typography>
        </AccordionDetails>
      </Accordion>
      {!showQuestions && <>
        <Paper component="section" aria-labelledby="quiz-description-heading" elevation={0} sx={{ p: 2, mb: 2 }}>
          <Typography id="quiz-description-heading" component="h2" variant="h6" sx={{ mb: 1 }}>About this quiz</Typography>
          <Typography color="text.secondary">{quiz.description || `Practice the main ideas in ${quiz.quizName}. Match each question with its answer, four questions at a time.`}</Typography>
        </Paper>
        <Button variant="contained" size="large" startIcon={<PlayArrowIcon />} disabled={dailyDone} onClick={beginQuiz}>
          Begin today's quiz
        </Button>
      </>}
      {showQuestions && (!dailyDone || result) && <>
      {round.mode === "bonus" && <Chip size="small" color="secondary" label="Daily bonus round" sx={{ mb: 2 }} />}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <MatchingBoard questions={round.questions} answers={answers} setAnswers={setAnswers}
        checkedAnswers={checkedAnswers} setCheckedAnswers={setCheckedAnswers} disabled={!!result} studyTools />

      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
        {!result ? (
          <Button variant="contained" size="large" onClick={handleSubmit} startIcon={<CheckCircleOutlineIcon />} sx={{ flexShrink: 0 }}>Submit</Button>
        ) : (
          <Button variant="contained" size="large" onClick={dailyDone ? onBack : nextRound} startIcon={<PlayArrowIcon />} sx={{ flexShrink: 0 }}>
            {dailyDone ? "All quizzes" : resultFromEarlierDay ? "Start today's quiz" : daily.dailyAttempts >= daily.dailyBase ? "Take bonus round" : "Keep Going"}
          </Button>
        )}
      </Stack>
      </>}
      <Accordion disableGutters elevation={0} sx={{ mt: 3, "&::before": { display: "none" } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} id="saved-attempts-heading" aria-controls="saved-attempts-content">
          <Typography component="span" variant="h6">Saved attempts {daily.dailyAttempts}/{daily.dailyAllowed}</Typography>
        </AccordionSummary>
        <AccordionDetails id="saved-attempts-content">
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Daily counts reset at midnight. Submitted attempts and concept progress stay saved on this browser.
          Proficiency averages the three most recent completed takes, or all completed takes if fewer than three. A take includes all daily rounds and any earned bonus.
        </Typography>
        {quizAttempts.length ? <Box component="ol" sx={{ pl: 3, mb: 0 }}>
          {quizAttempts.slice(-5).reverse().map((attempt, index) => <Typography component="li" variant="body2" key={attempt.id} sx={{ mt: 1 }}>
            Attempt {quizAttempts.length - index} · {new Date(attempt.createdAt).toLocaleString()} · {attempt.score}%
            {attempt.completedQuiz ? " · Quiz complete" : " · Round saved"}
          </Typography>)}
        </Box> : <Typography variant="body2" sx={{ mt: 1 }}>No submitted attempts yet. Choose Submit to record your first attempt.</Typography>}
        {quizAttempts.length > 5 && <Typography variant="caption" color="text.secondary">Showing the five most recent saved attempts.</Typography>}
        </AccordionDetails>
      </Accordion>
      <Snackbar open={!!savedNotice} autoHideDuration={4500} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        onClose={(_, reason) => { if (reason !== "clickaway") setSavedNotice(""); }}>
        <Alert severity="success" variant="filled" onClose={() => setSavedNotice("")} sx={{ width: "100%" }}>{savedNotice}</Alert>
      </Snackbar>
    </Box>
  );
};

export default QuizRunner;
