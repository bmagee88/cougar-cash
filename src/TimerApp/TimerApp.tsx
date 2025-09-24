import * as React from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

type HHMM = `${number}${number}:${number}${number}`;

type Segment = {
  id: string;
  title: string;
  color: string; // hex color
  end: HHMM; // segment ends at this time
};

type Timer = {
  id: string;
  name: string;
  start: HHMM;
  end: HHMM;
  segments: Segment[]; // segments cover: [start -> seg0.end], [seg0.end -> seg1.end], ..., [segN-1.end -> end]
};

function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h % 24) * 60 + (m % 60);
}
function toHHMM(mins: number): HHMM {
  const mm = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(mm / 60);
  const m = mm % 60;
  const hh = h.toString().padStart(2, "0");
  const mmStr = m.toString().padStart(2, "0");
  return `${hh}:${mmStr}` as HHMM;
}

function clampTime(t: HHMM): HHMM {
  // Enforce HH:MM 00:00 - 23:59
  const mins = Math.min(Math.max(toMinutes(t), 0), 23 * 60 + 59);
  return toHHMM(mins);
}

function midpointTime(a: HHMM, b: HHMM): HHMM {
  const am = toMinutes(a);
  const bm = toMinutes(b);
  return toHHMM(Math.floor((am + bm) / 2));
}

const defaultTimer = (): Timer => {
  const start: HHMM = "09:00";
  const end: HHMM = "12:00";
  return {
    id: uid("timer"),
    name: "Timer",
    start,
    end,
    segments: [
      { id: uid("seg"), title: "Segment 1", color: "#1976d2", end }, // covers start→end
    ],
  };
};

export default function TimerApp() {
  // at the top of the component
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [editingTimerId, setEditingTimerId] = React.useState<string | null>(
    null
  );

  const openEditor = (id: string) => {
    setEditingTimerId(id);
    setDrawerOpen(true);
  };
  const closeEditor = () => setDrawerOpen(false);

  const [timers, setTimers] = React.useState<Timer[]>([defaultTimer()]);
  const editingTimer = timers.find((x) => x.id === editingTimerId) || null;

  const setTimerName = (timerId: string, name: string) => {
    updateTimer(timerId, (t) => ({ ...t, name }));
  };

  const updateTimer = (timerId: string, updater: (t: Timer) => Timer) => {
    setTimers((prev) =>
      prev.map((t) => (t.id === timerId ? updater({ ...t }) : t))
    );
  };

  const addTimer = () => setTimers((prev) => [...prev, defaultTimer()]);
  const removeTimer = (timerId: string) =>
    setTimers((prev) => prev.filter((t) => t.id !== timerId));

  const addSegment = (timerId: string) => {
    updateTimer(timerId, (t) => {
      if (t.segments.length === 0) {
        const first: Segment = {
          id: uid("seg"),
          title: "Segment 1",
          color: "#1976d2",
          end: t.end,
        };
        return { ...t, segments: [first] };
      }
      // existing split-last behavior
      const lastEnd = t.end;
      const segments = [...t.segments];
      const prevLast = segments[segments.length - 1];
      const prevStart =
        segments.length === 1 ? t.start : segments[segments.length - 2].end;
      const newPrevEnd = midpointTime(prevStart, lastEnd);
      segments[segments.length - 1] = { ...prevLast, end: newPrevEnd };
      segments.push({
        id: uid("seg"),
        title: `Segment ${segments.length + 1}`,
        color: "#9c27b0",
        end: lastEnd,
      });
      return { ...t, segments };
    });
  };

  // Delete a segment (supports going to zero)
  const removeSegment = (timerId: string, segId: string) => {
    updateTimer(timerId, (t) => {
      if (t.segments.length <= 1) return t; // 🚫 keep at least one
      const segments = t.segments.filter((s) => s.id !== segId);
      // keep new last segment synced to timer end
      segments[segments.length - 1] = {
        ...segments[segments.length - 1],
        end: t.end,
      };
      return { ...t, segments };
    });
  };

  const setStart = (timerId: string, value: HHMM) => {
    const v = clampTime(value);
    updateTimer(timerId, (t) => {
      if (t.segments.length === 0) {
        // make sure start < end; if not, nudge end to +15m
        if (toMinutes(v) >= toMinutes(t.end)) {
          const nudged = toHHMM(Math.min(toMinutes(v) + 15, 23 * 60 + 59));
          return { ...t, start: v, end: nudged };
        }
        return { ...t, start: v };
      }
      // existing behavior when there are segments
      const firstEnd = t.segments[0].end;
      if (toMinutes(v) >= toMinutes(firstEnd)) {
        const newFirstEnd = toHHMM(
          Math.min(toMinutes(v) + 15, toMinutes(t.end))
        );
        t.segments[0] = { ...t.segments[0], end: newFirstEnd };
      }
      return { ...t, start: v };
    });
  };

  const setEnd = (timerId: string, value: HHMM) => {
    const v = clampTime(value);
    updateTimer(timerId, (t) => {
      if (t.segments.length === 0) {
        // keep end > start
        const endM = Math.max(toMinutes(v), toMinutes(t.start) + 1);
        return { ...t, end: toHHMM(endM) };
      }
      // existing sync with last segment
      const lastSegIdx = t.segments.length - 1;
      const lastSegStart =
        lastSegIdx > 0 ? t.segments[lastSegIdx - 1].end : t.start;
      const endM = Math.max(toMinutes(v), toMinutes(lastSegStart) + 1);
      const endH = toHHMM(endM);
      const segments = [...t.segments];
      segments[lastSegIdx] = { ...segments[lastSegIdx], end: endH };
      return { ...t, end: endH, segments };
    });
  };

  // Update a segment field: title | color | end (with ordering guards)
  const setSegmentField = (
    timerId: string,
    segId: string,
    field: keyof Segment,
    value: string
  ) => {
    updateTimer(timerId, (t) => {
      const idx = t.segments.findIndex((s) => s.id === segId);
      if (idx === -1) return t;

      const segments = [...t.segments];
      const seg = { ...segments[idx] };

      if (field === "end") {
        const segStart = idx === 0 ? t.start : segments[idx - 1].end;
        let candidate = clampTime(value as HHMM);
        let cm = toMinutes(candidate);

        // must be > start boundary
        cm = Math.max(cm, toMinutes(segStart) + 1);

        if (idx < segments.length - 1) {
          // middle segment: must be strictly before the next boundary
          const nextEnd = segments[idx + 1].end;
          cm = Math.min(cm, toMinutes(nextEnd) - 1);
        } else {
          // last segment: allow equality with timer end (no '-1')
          // (we do not clamp to t.end here; we simply set timer end below)
        }

        const hhmm = toHHMM(cm);
        seg.end = hhmm;

        // keep timer end in sync if this is the last segment
        if (idx === segments.length - 1) {
          t.end = hhmm;
        }

        segments[idx] = seg;
        return { ...t, segments };
      }

      if (field === "color") seg.color = value;
      if (field === "title") seg.title = value;
      segments[idx] = seg;
      return { ...t, segments };
    });
  };

  type PreviewItem =
    | { kind: "time"; time: HHMM }
    | { kind: "label"; title: string; color?: string };

  const timerPreview = (t: Timer) => {
    return (
      <Stack direction="column" spacing={1}>
        {/* Always show start */}
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {t.start} - Start
        </Typography>

        {/* Show segments if any */}
        {t.segments.length > 0
          ? t.segments.map((seg, i) => (
              <Stack key={seg.id} direction="column" spacing={1}>
                <Chip
                  label={seg.title || `Segment ${i + 1}`}
                  sx={{
                    bgcolor: seg.color || "#9e9e9e",
                    color: "#fff",
                    fontWeight: 600,
                  }}
                />
                {/* segment boundary first */}
                {i < t.segments.length - 1 && (
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, minWidth: 50 }}
                  >
                    {seg.end}
                  </Typography>
                )}
              </Stack>
            ))
          : null}
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {t.end} - End
        </Typography>
      </Stack>
    );
  };

  const durationLabel = (a: HHMM, b: HHMM) => {
    const m = Math.max(0, toMinutes(b) - toMinutes(a));
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1}>
        <Button variant="contained" onClick={addTimer}>
          Add Timer
        </Button>
      </Stack>

      {timers.map((t, idx) => (
        <Card
          key={t.id}
          variant="outlined"
          sx={{
            width: 400, // fixed width
            maxWidth: "100%", // prevent overflow on small screens
            mx: "auto", // center horizontally if parent is wider
          }}
        >
          <CardHeader
            title={
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  value={t.name}
                  onChange={(e) => setTimerName(t.id, e.target.value)}
                  size="small"
                  variant="standard"
                  InputProps={{ disableUnderline: true }}
                  sx={{
                    fontSize: (theme) => theme.typography.h6.fontSize,
                    fontWeight: 600,
                    width: { xs: 160, sm: 220 },
                    "& input": { fontWeight: 600 },
                  }}
                  placeholder="Timer name"
                />
                <Typography variant="body2" color="text.secondary">
                  ({durationLabel(t.start, t.end)})
                </Typography>
              </Stack>
            }
            action={
              <Stack direction="row" spacing={0.5}>
                <IconButton
                  aria-label="edit timer"
                  onClick={() => openEditor(t.id)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83l3.75 3.75l1.84-1.82Z"
                    />
                  </svg>
                </IconButton>
                <IconButton
                  aria-label="delete timer"
                  onClick={() => removeTimer(t.id)}
                >
                  <DeleteIcon />
                </IconButton>
              </Stack>
            }
          />

          <CardContent>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={3}
              alignItems="flex-start"
            >
              {/* Column Preview
              <Divider flexItem orientation="vertical" /> */}

              <Stack spacing={1} sx={{ minWidth: 220 }}>
                {/* <Stack direction="row" justifyContent={"space-between"}> */}
                {/* <Typography display="inline-block" variant="subtitle2">
                    {t.name || "Timer"}
                  </Typography>{" "} */}
                {/* <Button
                    variant="contained"
                    onClick={() => openEditor(timers[0]?.id)}
                    disabled={timers.length === 0}
                  >
                    Edit
                  </Button> */}
                {/* </Stack> */}
                {timerPreview(t)}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ))}

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={closeEditor}
        PaperProps={{ sx: { width: { xs: "100%", sm: 420, md: 720 }, p: 2 } }}
      >
        {editingTimer ? (
          // Editor
          <Stack
            key={editingTimer.id}
            spacing={2}
            sx={{ minWidth: 280, flex: 1 }}
          >
            <Stack direction="row" spacing={2}>
              <TextField
                label="Start"
                type="time"
                value={editingTimer.start}
                onChange={(e) =>
                  setStart(editingTimer.id, e.target.value as HHMM)
                }
                inputProps={{ step: 60 }}
                size="small"
              />
            </Stack>

            <Stack spacing={1}>
              
                {editingTimer.segments.map((seg, sIdx) => {
                  const segStart =
                    sIdx === 0
                      ? editingTimer.start
                      : editingTimer.segments[sIdx - 1].end;
                  const segEnd = seg.end;
                  return (
                    <Stack key={seg.id} direction="column" spacing={1}>
                      {/* Title + color + duration + delete */}
                      <Box>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1}
                          alignItems="center"
                        >
                          <TextField
                            label="Ends At"
                            type="time"
                            value={seg.end}
                            onChange={(e) =>
                              setSegmentField(
                                editingTimer.id,
                                seg.id,
                                "end",
                                e.target.value
                              )
                            }
                            inputProps={{ step: 60 }}
                            size="small"
                            sx={{ width: 130 }}
                          />
                          <input
                            aria-label="segment color"
                            type="color"
                            value={seg.color}
                            onChange={(e) =>
                              setSegmentField(
                                editingTimer.id,
                                seg.id,
                                "color",
                                e.target.value
                              )
                            }
                            style={{
                              width: 40,
                              height: 32,
                              border: "1px solid rgba(0,0,0,0.23)",
                              borderRadius: 4,
                              padding: 0,
                              background: "transparent",
                              cursor: "pointer",
                            }}
                          />
                          <TextField
                            label="Title"
                            value={seg.title}
                            onChange={(e) =>
                              setSegmentField(
                                editingTimer.id,
                                seg.id,
                                "title",
                                e.target.value
                              )
                            }
                            size="small"
                            sx={{ minWidth: 180, flex: 1 }}
                          />
                          <Typography
                            variant="caption"
                            sx={{ minWidth: 70, textAlign: "right" }}
                          >
                            {durationLabel(segStart as HHMM, segEnd as HHMM)}
                          </Typography>
                          <IconButton
                            size="small"
                            aria-label="remove segment"
                            onClick={() =>
                              removeSegment(editingTimer.id, seg.id)
                            }
                            disabled={editingTimer.segments.length === 1} // 🚫
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Box>

                      {/* Time FIRST */}
                      {/* <Box>
                        <TextField
                          label="Ends At"
                          type="time"
                          value={seg.end}
                          onChange={(e) =>
                            setSegmentField(
                              editingTimer.id,
                              seg.id,
                              "end",
                              e.target.value
                            )
                          }
                          inputProps={{ step: 60 }}
                          size="small"
                          sx={{ width: 130 }}
                        />
                      </Box> */}
                    </Stack>
                  );
                }
              )}

              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Button
                  size="small"
                  onClick={() => addSegment(editingTimer.id)}
                >
                  Add Segment
                </Button>
              </Stack>

              {/* <Divider sx={{ my: 1 }} />
              <Stack direction="row" spacing={2} alignItems="center">
                <TextField
                  label="End"
                  type="time"
                  value={editingTimer.end}
                  onChange={(e) =>
                    setEnd(editingTimer.id, e.target.value as HHMM)
                  }
                  inputProps={{ step: 60 }}
                  size="small"
                  sx={{ width: 130 }}
                /> */}
                {/* <Typography variant="caption" color="text.secondary">
                  {editingTimer.segments.length === 0
                    ? "No segments — end is independent."
                    : "Syncs with last segment."}
                </Typography> */}
              {/* </Stack> */}
            </Stack>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No timer selected.
          </Typography>
        )}
      </Drawer>
    </Stack>
  );
}
