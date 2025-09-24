import * as React from "react";
import { Button, Stack, Typography } from "@mui/material";
import TimerCard from "./components/TimerCard";
import TimerEditorDrawer from "./components/TimerEditorDrawer";
import { useTimers } from "./hooks/useTimers";
import { durationLabel } from "./utils/time"; // optional if you add to TimerCard

export default function TimerApp() {
  const {
    timers,
    editingTimer,
    addTimer,
    removeTimer,
    setTimerName,
    addSegment,
    removeSegment,
    setStart,
    setEnd,
    setSegmentField,
    openEditor,
    closeEditor,
  } = useTimers();

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1}>
        <Button variant="contained" onClick={addTimer}>Add Timer</Button>
      </Stack>

      {timers.map((t) => (
        <TimerCard
          key={t.id}
          timer={t}
          onRename={setTimerName}
          onEdit={openEditor}
          onDelete={removeTimer}
          width={400}
        />
      ))}

      <TimerEditorDrawer
        open={Boolean(editingTimer)}
        timer={editingTimer}
        onClose={closeEditor}
        setStart={setStart}
        setEnd={setEnd}
        setSegmentField={setSegmentField}
        removeSegment={removeSegment}
        addSegment={addSegment}
        setTimerName={setTimerName}
      />
    </Stack>
  );
}
