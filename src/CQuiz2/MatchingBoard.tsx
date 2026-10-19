import React from "react";
import { Box, Paper, Stack, Typography, alpha, useTheme } from "@mui/material";
import {
  DndContext, DragEndEvent, KeyboardSensor, PointerSensor, TouchSensor,
  useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { RoundAnswer, RoundQuestion } from "./types";

const SortableAnswer: React.FC<{
  item: RoundAnswer;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (id: string, checked: boolean) => void;
}> = ({ item, checked, disabled, onCheckedChange }) => {
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
      <Typography variant="body2">{item.text}</Typography>
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
}> = ({ questions, answers, setAnswers, checkedAnswers, setCheckedAnswers, disabled = false }) => {
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
                <Paper elevation={0} sx={{ p: 1.25, bgcolor: "background.paper" }}>
                  <Typography variant="body2">{question.text}</Typography>
                </Paper>
                {answers[index] && (
                  <SortableAnswer item={answers[index]} checked={!!checkedAnswers[answers[index].id]}
                    disabled={disabled}
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
