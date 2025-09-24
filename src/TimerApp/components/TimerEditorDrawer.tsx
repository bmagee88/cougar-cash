import * as React from "react";
import {
  Box, Button, Drawer, IconButton, Stack, TextField, Typography
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { HHMM, Segment, Timer } from "../types/timer";
import { durationLabel } from "../utils/time";

type Props = {
  open: boolean;
  timer: Timer | null;
  onClose: () => void;
  setStart: (timerId: string, v: HHMM) => void;
  setEnd: (timerId: string, v: HHMM) => void;
  setSegmentField: (timerId: string, segId: string, field: keyof Segment, v: string) => void;
  removeSegment: (timerId: string, segId: string) => void;
  addSegment: (timerId: string) => void;
  setTimerName: (timerId: string, name: string) => void;
};

export default function TimerEditorDrawer({
  open, timer, onClose,
  setStart, setEnd, setSegmentField, removeSegment, addSegment, setTimerName
}: Props) {
  if (!timer) {
    return (
      <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: "100%", sm: 420, md: 720 }, p: 2 } }}>
        <Typography variant="body2" color="text.secondary">No timer selected.</Typography>
      </Drawer>
    );
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: 420, md: 720 }, p: 2 } }}
    >
      <Stack key={timer.id} spacing={2} sx={{ minWidth: 280, flex: 1 }}>
        <TextField
          label="Timer Name"
          value={timer.name}
          onChange={(e) => setTimerName(timer.id, e.target.value)}
          size="small"
        />

        <TextField
          label="Start"
          type="time"
          value={timer.start}
          onChange={(e) => setStart(timer.id, e.target.value as HHMM)}
          inputProps={{ step: 60 }}
          size="small"
        />

        <Stack spacing={1}>
          {timer.segments.map((seg, sIdx) => {
            const segStart = sIdx === 0 ? timer.start : timer.segments[sIdx - 1].end;
            const segEnd = seg.end;

            return (
              <Stack key={seg.id} direction="column" spacing={1}>
                <Box>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
                    <TextField
                      label="Ends At"
                      type="time"
                      value={seg.end}
                      onChange={(e) => setSegmentField(timer.id, seg.id, "end", e.target.value)}
                      inputProps={{ step: 60 }}
                      size="small"
                      sx={{ width: 130 }}
                    />
                    <input
                      aria-label="segment color"
                      type="color"
                      value={seg.color}
                      onChange={(e) => setSegmentField(timer.id, seg.id, "color", e.target.value)}
                      style={{
                        width: 40, height: 32, border: "1px solid rgba(0,0,0,0.23)",
                        borderRadius: 4, padding: 0, background: "transparent", cursor: "pointer",
                      }}
                    />
                    <TextField
                      label="Title"
                      value={seg.title}
                      onChange={(e) => setSegmentField(timer.id, seg.id, "title", e.target.value)}
                      size="small"
                      sx={{ minWidth: 180, flex: 1 }}
                    />
                    <Typography variant="caption" sx={{ minWidth: 70, textAlign: "right" }}>
                      {durationLabel(segStart as HHMM, segEnd as HHMM)}
                    </Typography>
                    <IconButton
                      size="small"
                      aria-label="remove segment"
                      onClick={() => removeSegment(timer.id, seg.id)}
                      disabled={timer.segments.length === 1}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Box>
              </Stack>
            );
          })}

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Button size="small" onClick={() => addSegment(timer.id)}>Add Segment</Button>
          </Stack>
        </Stack>
      </Stack>
    </Drawer>
  );
}
