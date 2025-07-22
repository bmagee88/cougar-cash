import React, { useState } from "react";
import Papa from "papaparse";
import { Box, Button, Grid, LinearProgress, Paper, Typography } from "@mui/material";
import {
  DndContext,
  useSensor,
  useSensors,
  PointerSensor,
  DragEndEvent,
  TouchSensor,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Checkbox } from "@mui/material";

interface QAData {
  id: string;
  questions: string;
  answers: string;
}

// const SortableAnswer = ({
//   item,
//   index,
//   refMap,
// }: {
//   item: QAData;
//   index: number;
//   refMap: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
// }) => {
//   const { setNodeRef, attributes, listeners, transform, isDragging } = useSortable({
//     id: item.id,
//   });

//   const style = {
//     transform: CSS.Transform.toString(transform),
//     transition: undefined,
//     backgroundColor: isDragging ? "#e3f2fd" : "white",
//     borderRadius: 4,
//     padding: "8px 12px",
//     outline: "none",
//     boxShadow: isDragging ? "0 2px 6px rgba(0,0,0,0.2)" : undefined,
//     cursor: "grab",
//     width: "100%",
//   };

//   const combinedRef = (el: HTMLDivElement | null) => {
//     setNodeRef(el);
//     refMap.current[item.id] = el;
//   };

//   return (
//     <Paper
//       ref={combinedRef}
//       style={style}
//       {...attributes}
//       {...listeners}
//       elevation={2}
//       tabIndex={0} // allows focusing
//     >
//       {item.answers}
//     </Paper>
//   );
// };

const SortableAnswer = ({
  item,
  refMap,
  checkedAnswers,
  setCheckedAnswers,
}: {
  item: QAData;
  index: number;
  refMap: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  checkedAnswers: Record<string, boolean>;
  setCheckedAnswers: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) => {
  const { setNodeRef, attributes, listeners, transform, isDragging } = useSortable({
    id: item.id,
  });

  const isChecked = checkedAnswers[item.id] || false;

  const style = {
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
      tabIndex={0}>
      <Checkbox
        checked={isChecked}
        color='success'
        onChange={(e) =>
          setCheckedAnswers((prev) => ({
            ...prev,
            [item.id]: e.target.checked,
          }))
        }
        onPointerDown={(e) => e.stopPropagation()} // ✅ allow click through drag
      />

      {item.answers}
    </Paper>
  );
};

const CSVMatchGame: React.FC = () => {
  const debug = true; // Toggle this to false in production

  const [checkedAnswers, setCheckedAnswers] = useState<Record<string, boolean>>({});

  const [masterQuestions, setMasterQuestions] = useState<(QAData & { isCorrect?: boolean })[]>([]);
  const [currentQuestions, setCurrentQuestions] = useState<typeof masterQuestions>([]);
  const [shuffledAnswers, setShuffledAnswers] = useState<typeof masterQuestions>([]);
  const [scorePercent, setScorePercent] = useState<number | null>(null);
  const [showSubmit, setShowSubmit] = useState(true);

  //   const [questions, setQuestions] = useState<QAData[]>([]);

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

  const handleSubmit = () => {
    // let correctCount = 0;

    // Create a lookup to update isCorrect on the correct question
    const updated = masterQuestions.map((q) => {
      // Find the index in currentQuestions
      const i = currentQuestions.findIndex((cq) => cq.id === q.id);
      if (i === -1) return q;

      const isCorrect = q.answers.trim() === shuffledAnswers[i]?.answers.trim();
      //   if (isCorrect) correctCount++;

      return { ...q, isCorrect };
    });

    setMasterQuestions(updated);
    setScorePercent(Math.round((updated.filter((q) => q.isCorrect).length / updated.length) * 100));
    setShowSubmit(false);
  };

  const handleKeepGoing = () => {
    generateCurrentQuestionSet(masterQuestions);
    setCheckedAnswers({}); // ✅ clear all checkboxes
    setShowSubmit(true);
  };

  const generateCurrentQuestionSet = (allQs: typeof masterQuestions) => {
    const incorrect = allQs.filter((q) => !q.isCorrect);
    // console.log("incorrect", incorrect);
    const correct = allQs.filter((q) => q.isCorrect);
    // console.log("correct", correct);

    const fillCount = Math.max(0, 10 - incorrect.length);
    // console.log("fillCount", fillCount);
    const sampledCorrect = shuffleArray(correct).slice(0, fillCount);
    // console.log("sampledCorrect", sampledCorrect);

    const mixed = [...incorrect, ...sampledCorrect];
    // console.log("mixed", mixed);
    const finalQuestions = shuffleArray(mixed).slice(0, 10); // shuffle Qs
    // console.log("finalQuestions", finalQuestions);
    const finalAnswers = shuffleArray([...finalQuestions]); // shuffle just the answers separately
    // console.log("finalAnswers", finalAnswers);

    setCurrentQuestions(finalQuestions);
    setShuffledAnswers(finalAnswers);
    setScorePercent(null);
    setShowSubmit(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<QAData>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = results.data;
        // setQuestions(parsed);
        const parsedWithCorrectFlag = parsed.map((q) => ({ ...q, isCorrect: false }));
        setMasterQuestions(parsedWithCorrectFlag);
        generateCurrentQuestionSet(parsedWithCorrectFlag);

        // setShuffledAnswers(shuffleArray(parsed));
      },
    });
  };

  //   const shuffleArray = (arr: QAData[]) => {
  //     return [...arr].sort(() => Math.random() - 0.5);
  //   };

  function shuffleArray<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = shuffledAnswers.findIndex((item) => item.id === active.id);
    const newIndex = shuffledAnswers.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newAnswers = [...shuffledAnswers];
    // 🔁 Swap the answers
    [newAnswers[oldIndex], newAnswers[newIndex]] = [newAnswers[newIndex], newAnswers[oldIndex]];

    setShuffledAnswers(newAnswers);

    // Optional: Focus the newly dropped item
    setTimeout(() => {
      const focusedItem = newAnswers[newIndex];
      const node = answerRefs.current[focusedItem.id];
      node?.focus();
    }, 0);
  };

  return (
    <Box p={3}>
      <Button
        variant='contained'
        component='label'>
        Upload CSV
        <input
          type='file'
          accept='.csv'
          hidden
          onChange={handleFileUpload}
        />
      </Button>

      {debug && (
        <Box mt={4}>
          <Typography
            variant='subtitle1'
            gutterBottom>
            🔍 Master Question Debug View
          </Typography>
          <Paper
            elevation={1}
            sx={{ p: 1, display: "flex", flexWrap: "wrap", gap: 1 }}>
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
                }}>
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
                <Typography
                  variant='body1'
                  gutterBottom>
                  Score: {scorePercent}%
                </Typography>
                <LinearProgress
                  variant='determinate'
                  value={scorePercent}
                  sx={{ height: 10, borderRadius: 5, mb: 2 }}
                />
              </>
            )}
          </Box>

          {showSubmit ? (
            <Button
              variant='contained'
              color='primary'
              onClick={handleSubmit}
              sx={{ mb: 2 }}>
              Submit
            </Button>
          ) : (
            <Button
              variant='contained'
              color='secondary'
              onClick={handleKeepGoing}
              sx={{ mb: 2 }}>
              Keep Going!
            </Button>
          )}
          <Paper
            elevation={3}
            sx={{ p: 2 }}>
            <Grid container>
              <Grid
                item
                xs={6}>
                <Typography variant='h6'>Questions</Typography>
              </Grid>
              <Grid
                item
                xs={6}>
                <Typography variant='h6'>Answers (Drag to Match)</Typography>
              </Grid>
            </Grid>
            <DndContext
              sensors={sensors}
              onDragEnd={handleDragEnd}>
              <SortableContext
                items={shuffledAnswers.map((a) => a.id)}
                strategy={verticalListSortingStrategy}>
                {currentQuestions.map((q, i) => {
                  const answerItem = shuffledAnswers[i];
                  return (
                    <Grid
                      container
                      key={q.id}
                      spacing={2}
                      alignItems='center'
                      sx={{ mt: 1 }}>
                      <Grid
                        item
                        xs={6}>
                        <Typography>{q.questions}</Typography>
                      </Grid>
                      <Grid
                        item
                        xs={6}>
                        <SortableAnswer
                          key={answerItem.id}
                          item={answerItem}
                          index={i}
                          refMap={answerRefs}
                          checkedAnswers={checkedAnswers}
                          setCheckedAnswers={setCheckedAnswers}
                        />
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
