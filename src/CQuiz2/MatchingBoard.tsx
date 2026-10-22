import React, { useEffect, useState } from "react";
import { Alert, Box, Button, IconButton, Paper, Stack, Tooltip, Typography, alpha, useTheme } from "@mui/material";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import StopIcon from "@mui/icons-material/Stop";
import {
  DndContext, DragEndEvent, KeyboardSensor, PointerSensor, TouchSensor,
  useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { RoundAnswer, RoundQuestion } from "./types";
import { useReadAloud } from "./useReadAloud";

const ReadButton: React.FC<{
  label: string;
  reading: boolean;
  supported: boolean;
  onRead: () => void;
}> = ({ label, reading, supported, onRead }) => (
  <Tooltip title={supported ? reading ? `Stop reading ${label}` : `Read ${label} aloud` : "Read aloud is unavailable in this browser"}>
    <Box component="span" sx={{
      opacity: reading ? 1 : 0,
      transition: "opacity 120ms ease",
      ".MuiPaper-root:hover > &, .MuiPaper-root:focus-within > &, &:focus-within": { opacity: 1 },
      "@media (hover: none)": { opacity: 1 },
    }} onPointerDown={(event) => event.stopPropagation()} onTouchStart={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
      <IconButton size="small" color={reading ? "primary" : "default"} disabled={!supported}
        aria-label={reading ? `Stop reading ${label}` : `Read ${label} aloud`} onClick={onRead}>
        {reading ? <StopIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
      </IconButton>
    </Box>
  </Tooltip>
);

const SortableAnswer: React.FC<{
  item: RoundAnswer;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (id: string, checked: boolean) => void;
  readButton?: React.ReactNode;
}> = ({ item, checked, disabled, onCheckedChange, readButton }) => {
  const theme = useTheme();
  const { attributes, isDragging, listeners, setNodeRef, transform } = useSortable({
    id: item.id, disabled,
  });
  return (
    <Paper
      ref={setNodeRef}
      elevation={0}
      tabIndex={disabled ? -1 : 0}
      {...attributes}
      {...listeners}
      aria-label={`Move answer: ${item.text}`}
      style={{ transform: CSS.Transform.toString(transform), transition: undefined }}
      sx={{
        p: 1, display: "flex", gap: 1, alignItems: "center",
        cursor: disabled ? "default" : "grab", userSelect: "none", touchAction: "none",
        position: "relative", zIndex: isDragging ? 1 : "auto",
        bgcolor: checked ? alpha(theme.palette.success.main, 0.12)
          : isDragging ? alpha(theme.palette.primary.main, 0.12) : "background.paper",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange(item.id, event.target.checked)}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        aria-label="Mark answer"
        style={{ accentColor: theme.palette.primary.main, flexShrink: 0, width: 16, height: 16 }}
      />
      <Typography variant="body2" sx={{ flex: 1, overflowWrap: "anywhere" }}>{item.text}</Typography>
      {readButton}
    </Paper>
  );
};

// Shared by C-Quiz-2 and Quiz App 3: drag swaps the two answers and marks
// the moved answer, exactly as in the original C-Quiz-2 runner.
const MatchingBoard: React.FC<{
  questions: RoundQuestion[];
  answers: RoundAnswer[];
  setAnswers: React.Dispatch<React.SetStateAction<RoundAnswer[]>>;
  checkedAnswers: Record<string, boolean>;
  setCheckedAnswers: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  disabled?: boolean;
  studyTools?: boolean;
}> = ({ questions, answers, setAnswers, checkedAnswers, setCheckedAnswers, disabled = false, studyTools = false }) => {
  const theme = useTheme();
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const roundId = questions[0]?.id || "";
  const { supported, readingId, speechError, read } = useReadAloud(roundId, studyTools);
  useEffect(() => { setSelectedQuestion(null); }, [roundId]);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const handleDragEnd = (event: DragEndEvent) => {
    if (disabled) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = answers.findIndex((answer) => answer.id === active.id);
    const newIndex = answers.findIndex((answer) => answer.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    setAnswers((previous) => {
      const next = [...previous];
      [next[oldIndex], next[newIndex]] = [next[newIndex], next[oldIndex]];
      return next;
    });
    setCheckedAnswers((previous) => ({
      ...previous, [String(active.id)]: true, [String(over.id)]: false,
    }));
  };
  return (
    <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2 }, userSelect: "none" }}>
      {studyTools && (!supported || speechError) && <Alert severity="info" sx={{ mb: 2 }}>
        {supported ? speechError : "Read aloud is unavailable in this browser. Try a browser with text-to-speech support."}
      </Alert>}
      {studyTools && selectedQuestion && <Button size="small" onClick={() => setSelectedQuestion(null)} sx={{ mb: 1 }}>Show all questions</Button>}
      <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 2, mb: 1 }}>
        <Typography variant="h6">Questions</Typography>
        <Typography variant="h6">Answers</Typography>
      </Box>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={answers.map((answer) => answer.id)} strategy={verticalListSortingStrategy}>
          <Stack spacing={1.25}>
            {questions.map((question, index) => (
              <Box key={question.id} data-testid="matching-row" sx={{
                display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 2, alignItems: "center",
              }}>
                <Paper elevation={0} data-testid="matching-question" sx={{
                  p: studyTools ? 0.5 : 1.25, display: "flex", alignItems: "center", minWidth: 0,
                  bgcolor: selectedQuestion === question.id ? alpha(theme.palette.primary.main, 0.15) : "background.paper",
                  borderColor: selectedQuestion === question.id ? "primary.main" : "divider",
                  opacity: selectedQuestion && selectedQuestion !== question.id ? 0.4 : 1,
                }}>
                  {studyTools ? <>
                    <Box component="button" type="button" aria-label={`Focus question ${index + 1}`}
                      aria-pressed={selectedQuestion === question.id}
                      onClick={() => setSelectedQuestion((previous) => previous === question.id ? null : question.id)}
                      onKeyDown={(event) => { if (event.key === "Escape") setSelectedQuestion(null); }}
                      sx={{ flex: 1, minWidth: 0, p: 0.75, border: 0, borderRadius: 1, bgcolor: "transparent", color: "inherit",
                        textAlign: "left", cursor: "pointer", display: "flex", gap: 1,
                        "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 } }}>
                      <Typography component="span" variant="body2" sx={{ fontWeight: 800 }}>{index + 1}.</Typography>
                      <Typography component="span" variant="body2" sx={{ overflowWrap: "anywhere" }}>{question.text}</Typography>
                    </Box>
                    <ReadButton label={`question ${index + 1}`} reading={readingId === question.id} supported={supported}
                      onRead={() => read(question.id, `Question ${index + 1}. ${question.text}`)} />
                  </> : <Typography variant="body2">{question.text}</Typography>}
                </Paper>
                {answers[index] && (
                  <SortableAnswer item={answers[index]} checked={!!checkedAnswers[answers[index].id]}
                    disabled={disabled}
                    readButton={studyTools ? <ReadButton label={`answer in row ${index + 1}`} reading={readingId === answers[index].id}
                      supported={supported} onRead={() => read(answers[index].id, answers[index].text)} /> : undefined}
                    onCheckedChange={(id, checked) => setCheckedAnswers((previous) => ({ ...previous, [id]: checked }))} />
                )}
              </Box>
            ))}
          </Stack>
        </SortableContext>
      </DndContext>
    </Paper>
  );
};

export default MatchingBoard;
