import React, { useRef, useState } from "react";
import { Alert, Box, Button, Chip, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import MatchingBoard from "../CQuiz2/MatchingBoard";
import QuizSources from "./QuizSources";
import { createDailyRound, createSession, submitRound } from "./quizEngine";
import { DailyLimitError, dailyProgress } from "./quizStats";
import { ConceptState, LocalAttempt, MatchingItem, QuizDefinition, QuizSessionState } from "./types";

const QuizRunner: React.FC<{
  quiz: QuizDefinition;
  initialConceptState: ConceptState;
  initialSession?: QuizSessionState;
  attempts: LocalAttempt[];
  attemptCount: number;
  onRecord: (attempt: LocalAttempt, state: ConceptState, session: QuizSessionState) => void;
  onBack: () => void;
}> = ({ quiz, initialConceptState, initialSession, attempts, attemptCount, onRecord, onBack }) => {
  const daily = dailyProgress(quiz, attempts);
  const dailyDone = daily.dailyAttempts >= daily.dailyAllowed;
  const [session, setSession] = useState(() => initialSession || createSession(quiz, initialConceptState));
  const [round, setRound] = useState(() => createDailyRound(quiz, session, daily));
  const [answers, setAnswers] = useState<MatchingItem[]>(round.answers);
  const [checkedAnswers, setCheckedAnswers] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<ReturnType<typeof submitRound> | null>(null);
  const [error, setError] = useState("");
  const submittedRound = useRef("");

  const handleSubmit = () => {
    if (result || submittedRound.current === round.id || dailyDone) return;
    submittedRound.current = round.id;
    setError("");
    const next = submitRound(quiz, session, round, answers, daily.dailyAttempts + 1);
    next.state.bonusRoundsEarned = Math.max(daily.dailyBonus, next.state.bonusRoundsEarned);
    try {
      onRecord({
        id: round.id, quizId: quiz.id, score: next.score,
        correctCount: next.correctCount, totalCount: next.totalCount,
        createdAt: new Date().toISOString(),
        bonusRoundsEarned: next.state.bonusRoundsEarned,
        completedQuiz: daily.dailyAttempts + 1 >= daily.dailyBase + next.state.bonusRoundsEarned,
      }, next.state.conceptState, next.state);
      setSession(next.state);
      setResult(next);
    } catch (err) {
      submittedRound.current = "";
      setError(err instanceof DailyLimitError ? err.message : "Your result could not be saved to this device. Keep this page open, enable browser storage or free some space, and try Submit again.");
    }
  };

  const nextRound = () => {
    if (dailyDone) return;
    const next = createDailyRound(quiz, session, daily);
    setRound(next);
    setAnswers(next.answers);
    setCheckedAnswers({});
    setResult(null);
    setError("");
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
          <Chip label={`Attempt ${result || dailyDone ? attemptCount : attemptCount + 1}`} variant="outlined" sx={{ alignSelf: "flex-start" }} />
          <Chip label={`Today ${daily.dailyAttempts} / ${daily.dailyAllowed}`} variant="outlined" sx={{ alignSelf: "flex-start" }} />
        </Stack>
      </Paper>

      {dailyDone && !result ? (
        <Alert severity="success">You have completed today's allowed attempts for this quiz. Come back tomorrow to continue.</Alert>
      ) : <>
      <Paper elevation={0} sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography sx={{ flex: 1 }} color="text.secondary">
            Round {daily.dailyAttempts + (result ? 0 : 1)}
          </Typography>
          <Chip size="small" variant="outlined" label={`${round.questions.length} questions`} />
          {round.mode === "bonus" && <Chip size="small" color="secondary" label="Daily bonus round" />}
          {result && <Chip color={result.score === 100 ? "success" : "warning"} label={`Score ${result.score}%`} />}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Drag answers to swap them into the matching rows. Use the checkboxes to mark answers you have placed.
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Keyboard: focus an answer, press Space, use the arrow keys, then press Space to place it.
        </Typography>
        {result && <LinearProgress aria-label="Quiz concept score" sx={{ mt: 2 }} variant="determinate" value={result.score} />}
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <MatchingBoard questions={round.questions} answers={answers} setAnswers={setAnswers}
        checkedAnswers={checkedAnswers} setCheckedAnswers={setCheckedAnswers} disabled={!!result} />

      {result && (
        <Alert severity={result.score === 100 ? "success" : "info"} icon={<CheckCircleOutlineIcon />} sx={{ mt: 2 }}>
          Attempt {attemptCount} saved on this device.
          {dailyDone && " Today's allowance is complete."}
        </Alert>
      )}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} justifyContent="space-between" sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 650 }}>
          Each submission counts as an attempt. Your score covers all {quiz.concepts.length} concepts, using your latest match for each, just like C-Quiz-2.
        </Typography>
        {!result ? (
          <Button variant="contained" size="large" onClick={handleSubmit} startIcon={<CheckCircleOutlineIcon />} sx={{ flexShrink: 0 }}>Submit</Button>
        ) : (
          <Button variant="contained" size="large" onClick={dailyDone ? onBack : nextRound} startIcon={<PlayArrowIcon />} sx={{ flexShrink: 0 }}>
            {dailyDone ? "All quizzes" : daily.dailyAttempts >= daily.dailyBase ? "Take bonus round" : "Keep Going"}
          </Button>
        )}
      </Stack>
      </>}
    </Box>
  );
};

export default QuizRunner;
