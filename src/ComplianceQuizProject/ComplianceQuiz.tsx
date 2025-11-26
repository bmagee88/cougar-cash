import React, { useEffect, useState } from "react";
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
} from "@mui/material";
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

interface QAData {
  id: string;
  questions: string;
  answers: string;
  isCorrect?: boolean;
}

interface Attempt {
  timestamp: number;
  score: number;
  date: string; // YYYY-MM-DD
}

const STORAGE_PREFIX = "csvMatchGameAttempts";

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

// interface ScoreChartProps {
//   attempts: Attempt[];
// }

const ScoreChart: React.FC<{ attempts: Attempt[] }> = ({ attempts }) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
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

  // ✅ Desired width: 50px per attempt, but at least 100px
  const desiredWidth = attempts.length * 50;
  const minWidth = 100;
  const targetWidth = Math.max(desiredWidth, minWidth);

  // ✅ Cap at container width (when known)
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
    useSortable({
      id: item.id,
    });

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

const CSVMatchGame: React.FC = () => {
  const debug = MASTER_DEBUG;

  const [checkedAnswers, setCheckedAnswers] = useState<
    Record<string, boolean>
  >({});
  const [masterQuestions, setMasterQuestions] = useState<QAData[]>([]);
  const [currentQuestions, setCurrentQuestions] = useState<QAData[]>([]);
  const [shuffledAnswers, setShuffledAnswers] = useState<QAData[]>([]);
  const [scorePercent, setScorePercent] = useState<number | null>(null);
  const [showSubmit, setShowSubmit] = useState(true);

  const [playerName, setPlayerName] = useState("");
  const [fileName, setFileName] = useState("");
  const [attempts, setAttempts] = useState<Attempt[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  const answerRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  const getStorageKey = (file: string, player: string) =>
    `${STORAGE_PREFIX}::${file}::${player}`;

  // Load attempts when file or player changes
  useEffect(() => {
    if (!fileName || !playerName) {
      setAttempts([]);
      return;
    }
    try {
      const raw = localStorage.getItem(getStorageKey(fileName, playerName));
      if (raw) {
        const parsed = JSON.parse(raw) as any[];
        const normalized: Attempt[] = parsed.map((a) => {
          const timestamp =
            typeof a.timestamp === "number" ? a.timestamp : Date.now();
          const score = typeof a.score === "number" ? a.score : 0;
          const date = a.date ?? toDateKey(timestamp);
          return { timestamp, score, date };
        });
        setAttempts(normalized);
      } else {
        setAttempts([]);
      }
    } catch (err) {
      console.error("Failed to load attempts", err);
      setAttempts([]);
    }
  }, [fileName, playerName]);

  const recordAttempt = (score: number) => {
    if (!fileName || !playerName) return;

    const now = Date.now();
    const dateKey = toDateKey(now);

    setAttempts((prev) => {
      const next: Attempt[] = [...prev, { timestamp: now, score, date: dateKey }];
      try {
        localStorage.setItem(
          getStorageKey(fileName, playerName),
          JSON.stringify(next)
        );
      } catch (err) {
        console.error("Failed to save attempts", err);
      }
      return next;
    });
  };

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

    // Base pool is all incorrect; if none are incorrect yet, use full list
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: Papa.ParseResult<any>) => {
        const parsed = results.data as any[];
        const parsedWithFlags: QAData[] = parsed
          .filter((row) => row.questions || row.answers || row.Questions || row.Answers)
          .map((row, index) => ({
            id: row.id ?? String(index),
            questions: row.questions ?? row.Questions ?? "",
            answers: row.answers ?? row.Answers ?? "",
            isCorrect: false,
          }));

        setMasterQuestions(parsedWithFlags);
        generateCurrentQuestionSet(parsedWithFlags);
      },
    });
  };

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

    // ✅ Moved item gets checked, displaced gets unchecked, others unchanged
    setCheckedAnswers((prev) => {
      const next = { ...prev };
      const movedId = String(active.id);
      const displacedId = String(over.id);
      next[movedId] = true;
      if (displacedId !== movedId) {
        next[displacedId] = false;
      }
      return next;
    });

    setTimeout(() => {
      const focusedItem = newAnswers[newIndex];
      const node = answerRefs.current[focusedItem.id];
      node?.focus();
    }, 0);
  };

  const handleSubmit = () => {
    // 🔒 Daily limit check
    if (fileName && playerName) {
      const todayKey = toDateKey(Date.now());
      const attemptsToday = attempts.filter((a) => a.date === todayKey).length;

      if (attemptsToday >= MAX_TRIES_PER_DAY) {
        alert(
          `Daily limit reached: ${MAX_TRIES_PER_DAY} attempts per day for this player & file.`
        );
        return;
      }
    }

    const updated = masterQuestions.map((q) => {
      const i = currentQuestions.findIndex((cq) => cq.id === q.id);
      if (i === -1) return q;
      const answerItem = shuffledAnswers[i];
      const isCorrect =
        q.answers.trim() === (answerItem?.answers ?? "").trim();
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

  const todayKey = toDateKey(Date.now());
  const attemptsToday = attempts.filter((a) => a.date === todayKey).length;
  const remainingToday = Math.max(0, MAX_TRIES_PER_DAY - attemptsToday);

  return (
    <Box p={3}>
      {/* Player + graph */}
      <Paper elevation={3} sx={{ p: 2, mb: 3 }}>
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
            File: {fileName || "—"}
          </Typography>
          {fileName && playerName && (
            <Typography variant="body2" color="text.secondary">
              Attempts today: {attemptsToday} / {MAX_TRIES_PER_DAY} (remaining:{" "}
              {remainingToday})
            </Typography>
          )}
        </Box>

        <Typography variant="h6" gutterBottom>
          Score over time
        </Typography>

        {attempts.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No saved attempts yet. Complete a round with a player name and file
            to see your trend.
          </Typography>
        ) : (
          <ScoreChart attempts={attempts} />
        )}
      </Paper>

      {/* File upload */}
      <Button variant="contained" component="label" sx={{ mb: 3 }}>
        Upload CSV
        <input
          type="file"
          accept=".csv"
          hidden
          onChange={handleFileUpload}
        />
      </Button>

      {/* Debug info */}
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

          <Paper elevation={3} sx={{ p: 2 }}>
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
