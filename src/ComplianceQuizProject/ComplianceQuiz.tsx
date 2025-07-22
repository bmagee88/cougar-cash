import React, { useState } from "react";
import Papa from "papaparse";
import { Box, Button, Grid, Paper, Typography } from "@mui/material";
import { DndContext, useSensor, useSensors, PointerSensor, DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface QAData {
  id: string;
  questions: string;
  answers: string;
}

const SortableAnswer = ({
  item,
  index,
  refMap,
}: {
  item: QAData;
  index: number;
  refMap: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
}) => {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: undefined,
    backgroundColor: isDragging ? "#e3f2fd" : "white",
    borderRadius: 4,
    padding: "8px 12px",
    boxShadow: isDragging ? "0 2px 6px rgba(0,0,0,0.2)" : undefined,
    cursor: "grab",
    width: "100%",
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
      tabIndex={0} // allows focusing
    >
      {item.answers}
    </Paper>
  );
};

const CSVMatchGame: React.FC = () => {
  const [questions, setQuestions] = useState<QAData[]>([]);
  const [shuffledAnswers, setShuffledAnswers] = useState<QAData[]>([]);

  const sensors = useSensors(useSensor(PointerSensor));
  const answerRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<QAData>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = results.data;
        setQuestions(parsed);
        setShuffledAnswers(shuffleArray(parsed));
      },
    });
  };

  const shuffleArray = (arr: QAData[]) => {
    return [...arr].sort(() => Math.random() - 0.5);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = shuffledAnswers.findIndex((a) => a.id === active.id);
    const newIndex = shuffledAnswers.findIndex((a) => a.id === over.id);

    const newOrder = arrayMove(shuffledAnswers, oldIndex, newIndex);
    setShuffledAnswers(newOrder);

    // Focus the moved element after reorder
    setTimeout(() => {
      const newActive = newOrder[newIndex];
      const node = answerRefs.current[newActive.id];
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

      {questions.length > 0 && (
        <Box mt={3}>
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
                {questions.map((q, i) => (
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
                        item={shuffledAnswers[i]}
                        index={i}
                        refMap={answerRefs}
                      />
                    </Grid>
                  </Grid>
                ))}
              </SortableContext>
            </DndContext>
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default CSVMatchGame;
