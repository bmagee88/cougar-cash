import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Stack,
  Select,
  MenuItem,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputLabel,
  FormControl,
  Chip,
  Divider,
  Tooltip,
  Paper,
  Alert,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CloseIcon from "@mui/icons-material/Close";

/**
 * Daily Schedule with Pie Timer — Add Day Schedule modal (no library dropdown)
 * - Left: Now + today’s weekday + today’s schedule, Pie timer, Today’s periods
 * - Right: Week mapping panel (week select/rename/add/delete, per-DOW mapping, Add Day Schedule modal, Edit Day Schedules library editor)
 * - Day Schedules are a global library (no weekday field)
 * - LocalStorage mirrored in React state
 */

/* ------------------ Types ------------------ */

type HHMM = `${number}${number}:${number}${number}`;

type Segment = {
  title: string;
  color: string;
  start: HHMM;
  end: HHMM;
};

type Period = {
  name: string;
  start: HHMM;
  end: HHMM;
  segments: Segment[];
};

type DaySchedule = {
  name: string; // unique in library
  periods: Period[];
};

type WeekSchedule = {
  name: string; // unique
  mapping: Partial<Record<number, string>>; // weekday -> day schedule name
};

/* ------------------ LS keys + helpers ------------------ */

const LS_KEYS = {
  DAY_SCHEDULES: "scheduler:libraryDaySchedules",
  WEEK_SCHEDULES: "scheduler:weekSchedules",
  ACTIVE_WEEK_SCHEDULE: "scheduler:activeWeekSchedule",
  // legacy (auto-migrated if present)
  LEGACY_DAY_SCHEDULES: "scheduler:daySchedules",
  LEGACY_ACTIVE_DAY_SELECTIONS: "scheduler:activeDaySelections",
} as const;

type DayScheduleLibrary = Record<string, DaySchedule>;
type WeekSchedulesStore = Record<string, WeekSchedule>;

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function saveJSON<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

/* ------------------ Time utils ------------------ */

function toMinutes(t: HHMM): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function fromMinutes(mins: number): HHMM {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(h)}:${pad(m)}` as HHMM;
}
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function within(now: number, start: number, end: number) {
  return now >= start && now < end;
}
function weekdayName(i: number) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][i];
}

/* ------------------ Defaults + Migration ------------------ */

function makeDefaultSchedule(name: string): DaySchedule {
  return {
    name,
    periods: [
      {
        name: "Period 3",
        start: "11:00",
        end: "12:00",
        segments: [
          { title: "Seg 1", color: "#90caf9", start: "11:00", end: "11:20" },
          { title: "Seg 2", color: "#ffcc80", start: "11:20", end: "11:40" },
          { title: "Seg 3", color: "#a5d6a7", start: "11:40", end: "12:00" },
        ],
      },
    ],
  };
}

function seedIfEmpty() {
  let lib = loadJSON<DayScheduleLibrary>(LS_KEYS.DAY_SCHEDULES, {});
  let weeks = loadJSON<WeekSchedulesStore>(LS_KEYS.WEEK_SCHEDULES, {});
  const activeWeek = localStorage.getItem(LS_KEYS.ACTIVE_WEEK_SCHEDULE);

  // migrate legacy per-weekday store into library if present
  const legacy = loadJSON<Record<string, Record<string, any>>>(LS_KEYS.LEGACY_DAY_SCHEDULES, {});
  if (Object.keys(lib).length === 0 && Object.keys(legacy).some((k) => /^\d$/.test(k))) {
    const collected: DayScheduleLibrary = {};
    Object.values(legacy).forEach((byName) => {
      Object.values(byName).forEach((sched: any) => {
        const name = sched?.name ?? "Imported";
        if (!collected[name]) {
          collected[name] = {
            name,
            periods: (sched.periods ?? []).map((p: any) => ({
              name: p.name,
              start: p.start,
              end: p.end,
              segments: (p.segments ?? []).map((s: any) => ({
                title: s.title,
                color: s.color,
                start: s.start,
                end: s.end,
              })),
            })),
          };
        }
      });
    });
    lib = collected;
    saveJSON(LS_KEYS.DAY_SCHEDULES, lib);
  }

  if (Object.keys(lib).length === 0) {
    lib = {
      FullDay: makeDefaultSchedule("FullDay"),
      HalfDay: {
        name: "HalfDay",
        periods: [
          {
            name: "Period 3 (Half)",
            start: "11:00",
            end: "11:30",
            segments: [
              { title: "Seg 1", color: "#ce93d8", start: "11:00", end: "11:15" },
              { title: "Seg 2", color: "#ffab91", start: "11:15", end: "11:30" },
            ],
          },
        ],
      },
    };
    saveJSON(LS_KEYS.DAY_SCHEDULES, lib);
  }

  if (Object.keys(weeks).length === 0) {
    weeks = {
      DefaultWeek: {
        name: "DefaultWeek",
        mapping: { 1: "FullDay", 2: "FullDay", 3: "FullDay", 4: "FullDay", 5: "HalfDay" },
      },
    };
    saveJSON(LS_KEYS.WEEK_SCHEDULES, weeks);
  }

  if (!activeWeek) {
    localStorage.setItem(LS_KEYS.ACTIVE_WEEK_SCHEDULE, "DefaultWeek");
  }

  // clean up legacy selections
  localStorage.removeItem(LS_KEYS.LEGACY_ACTIVE_DAY_SELECTIONS);
}

/* ------------------ Pie Timer (SVG) ------------------ */

function PieTimer({ period, nowMinutes }: { period?: Period | null; nowMinutes: number }) {
  const size = 260;
  const r = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;

  if (!period) {
    return (
      <Paper elevation={2} sx={{ p: 2, width: size }}>
        <Typography variant="subtitle1" align="center">
          No active period right now
        </Typography>
      </Paper>
    );
  }

  const pStart = toMinutes(period.start);
  const pEnd = toMinutes(period.end);
  const pDur = Math.max(1, pEnd - pStart);
  const toAngle = (m: number) => (m / pDur) * 360;

  const polar = (angleDeg: number) => {
    const rad = (Math.PI * (angleDeg - 90)) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const arcPath = (startDeg: number, endDeg: number) => {
    const a0 = startDeg % 360;
    const a1 = endDeg % 360;
    const sweep = (a1 - a0 + 360) % 360;
    const largeArc = sweep > 180 ? 1 : 0;
    const p0 = polar(a0);
    const p1 = polar(a1);
    return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${largeArc} 1 ${p1.x} ${p1.y}`;
  };

  const segArcs = period.segments.map((seg, i) => {
    const s = clamp(toMinutes(seg.start), pStart, pEnd) - pStart;
    const e = clamp(toMinutes(seg.end), pStart, pEnd) - pStart;
    const a0 = toAngle(s);
    const a1 = toAngle(e);
    return <path key={i} d={arcPath(a0, a1)} stroke={seg.color} strokeWidth={18} fill="none" />;
  });

  const progressAngle = toAngle(clamp(nowMinutes, pStart, pEnd) - pStart);
  const pEndPt = polar(progressAngle);
  const currentSeg = period.segments.find((s) => within(nowMinutes, toMinutes(s.start), toMinutes(s.end)));

  return (
    <Box>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="#f5f5f5" stroke="#ccc" strokeWidth={1} />
        {segArcs}
        <line x1={cx} y1={cy} x2={pEndPt.x} y2={pEndPt.y} stroke="#000" strokeWidth={2} />
        <circle cx={cx} cy={cy} r={3} fill="#000" />
      </svg>

      <Stack spacing={1} sx={{ mt: 1 }}>
        <Typography variant="subtitle2" align="center">
          {period.name}: {period.start} – {period.end}
        </Typography>
        <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap">
          {period.segments.map((s, i) => (
            <Chip
              key={i}
              label={`${s.title} (${s.start}–${s.end})`}
              size="small"
              sx={{
                borderColor: currentSeg === s ? "#000" : undefined,
                borderWidth: currentSeg === s ? 2 : 1,
                borderStyle: "solid",
                background: s.color,
              }}
            />
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}

/* ------------------ Library Editor (existing schedules) ------------------ */

function LibraryEditor({
  open,
  onClose,
  lib,
  selectedName,
  onSaveLib,
  onDeleteSchedule,
}: {
  open: boolean;
  onClose: () => void;
  lib: DayScheduleLibrary;
  selectedName?: string;
  onSaveLib: (updated: DayScheduleLibrary) => void;
  onDeleteSchedule: (name: string) => void;
}) {
  const [selected, setSelected] = useState<string>("");
  const [working, setWorking] = useState<DayScheduleLibrary>({});
  const [order, setOrder] = useState<string[]>([]);
  const [isDirty, setDirty] = useState(false);

  // Rename dialog state
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  // Discard confirmation
  const [discardOpen, setDiscardOpen] = useState(false);
  const requestClose = () => {
    if (isDirty) setDiscardOpen(true);
    else onClose();
  };
  const confirmDiscard = () => {
    setDiscardOpen(false);
    setDirty(false);
    onClose();
  };

  // Initialize on open (take a snapshot of lib)
  useEffect(() => {
    if (!open) return;
    const clone = structuredClone(lib);
    setWorking(clone);
    const keys = Object.keys(lib);
    setOrder(keys);
    const initial =
      (selectedName && lib[selectedName] && selectedName) ||
      keys[0] ||
      "";
    setSelected(initial);
    setDirty(false);
  }, [open, lib, selectedName]); // only when opened

  // If parent changes lib while editor is open, merge in a non-destructive way
  useEffect(() => {
    if (!open) return;
    // Only merge additions/removals if user hasn't edited (avoid stomping work-in-progress)
    if (!isDirty) {
      const clone = structuredClone(lib);
      setWorking(clone);
      const keys = Object.keys(lib);
      setOrder((prev) => {
        const kept = prev.filter((k) => keys.includes(k));
        const additions = keys.filter((k) => !kept.includes(k));
        return [...kept, ...additions];
      });
      setSelected((prevSel) => (clone[prevSel] ? prevSel : keys[0] || ""));
    }
  }, [lib, open, isDirty]);

  const current = selected ? working[selected] : undefined;

  /* ---------- Helpers to mark dirty and update ---------- */
  const mark = <T,>(updater: (prev: T) => T) =>
    (prev: T) => {
      setDirty(true);
      return updater(prev);
    };

  /* ---------- Schedule-level actions ---------- */
  const addSchedule = () => {
    const base = "NewSchedule";
    let name = base;
    let i = 1;
    while (working[name]) name = `${base}-${i++}`;
    const nextSched = makeDefaultSchedule(name);
    setWorking(mark((w) => ({ ...w, [name]: nextSched })));
    setOrder((prev) => [...prev, name]);
    setSelected(name);
  };

  const handleScheduleDelete = (name: string) => {
    // mark dirty and remove locally; parent will get final copy on Save
    setWorking(mark((w) => {
      const copy = { ...w };
      delete copy[name];
      return copy;
    }));
    setOrder((prev) => prev.filter((n) => n !== name));
    setSelected((prevSel) => {
      if (prevSel !== name) return prevSel;
      const next = order.filter((n) => n !== name)[0];
      if (next && working[next]) return next;
      const keys = Object.keys(working).filter((k) => k !== name);
      return keys[0] || "";
    });
    // Note: we DO NOT call onDeleteSchedule now; deletion is finalized on Save
  };

  const openRename = () => {
    if (!selected) return;
    setRenameValue(selected);
    setRenameOpen(true);
  };
  const applyRename = () => {
    const oldName = selected;
    const newName = renameValue.trim();
    setRenameOpen(false);
    if (!oldName || !newName || oldName === newName || working[newName]) return;

    // Update order in place
    setOrder((prev) => {
      const idx = prev.indexOf(oldName);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = newName;
      return next;
    });

    // Move map entry
    setWorking(mark((w) => {
      const copy = { ...w };
      copy[newName] = { ...copy[oldName], name: newName };
      delete copy[oldName];
      return copy;
    }));

    setSelected(newName);
  };

  /* ---------- Period/Segment editing (controlled) ---------- */
  const setPeriodField = (pIdx: number, field: keyof Period, value: string) => {
    if (!current) return;
    const cname = current.name;
    setWorking(mark((w) => {
      const sched = w[cname];
      const periods = sched.periods.map((p, i) => (i === pIdx ? { ...p, [field]: value } : p));
      return { ...w, [cname]: { ...sched, periods } };
    }));
  };
  const addPeriod = () => {
    if (!current) return;
    const cname = current.name;
    setWorking(mark((w) => {
      const sched = w[cname];
      const newP: Period = {
        name: `Period ${sched.periods.length + 1}`,
        start: "10:00",
        end: "11:00",
        segments: [
          { title: "Seg 1", color: "#90caf9", start: "10:00", end: "10:20" },
          { title: "Seg 2", color: "#ffcc80", start: "10:20", end: "11:00" },
        ],
      };
      return { ...w, [cname]: { ...sched, periods: [...sched.periods, newP] } };
    }));
  };
  const removePeriod = (pIdx: number) => {
    if (!current) return;
    const cname = current.name;
    setWorking(mark((w) => {
      const sched = w[cname];
      const periods = sched.periods.filter((_, i) => i !== pIdx);
      return { ...w, [cname]: { ...sched, periods } };
    }));
  };

  const setSegmentField = (pIdx: number, sIdx: number, field: keyof Segment, value: string) => {
    if (!current) return;
    const cname = current.name;
    setWorking(mark((w) => {
      const sched = w[cname];
      const periods = sched.periods.map((p, i) =>
        i === pIdx
          ? { ...p, segments: p.segments.map((s, j) => (j === sIdx ? { ...s, [field]: value } : s)) }
          : p
      );
      return { ...w, [cname]: { ...sched, periods } };
    }));
  };
  const addSegment = (pIdx: number) => {
    if (!current) return;
    const cname = current.name;
    setWorking(mark((w) => {
      const sched = w[cname];
      const p = sched.periods[pIdx];
      const lastEnd = p.segments[p.segments.length - 1]?.end ?? p.start;
      const proposedEnd = fromMinutes(Math.min(toMinutes(p.end), toMinutes(lastEnd) + 10));
      const newSeg: Segment = { title: `Seg ${p.segments.length + 1}`, color: "#c5e1a5", start: lastEnd, end: proposedEnd };
      const periods = sched.periods.map((pp, i) =>
        i === pIdx ? { ...pp, segments: [...pp.segments, newSeg] } : pp
      );
      return { ...w, [cname]: { ...sched, periods } };
    }));
  };
  const removeSegment = (pIdx: number, sIdx: number) => {
    if (!current) return;
    const cname = current.name;
    setWorking(mark((w) => {
      const sched = w[cname];
      const periods = sched.periods.map((pp, i) =>
        i === pIdx ? { ...pp, segments: pp.segments.filter((_, j) => j !== sIdx) } : pp
      );
      return { ...w, [cname]: { ...sched, periods } };
    }));
  };

  /* ---------- Save ---------- */
const handleSave = () => {
  // Compute which schedules were deleted during this edit session
  const beforeKeys = Object.keys(lib);                     // string[]
  const afterSet = new Set(Object.keys(working));          // Set<string>
  const deleted = beforeKeys.filter((k) => !afterSet.has(k));

  // Scrub week mappings for deleted schedules
  deleted.forEach((name) => onDeleteSchedule(name));

  onSaveLib(working);
  setDirty(false);
  onClose();
};


  /* ---------- Render ---------- */
  return (
    <Dialog
      open={open}
      onClose={requestClose} // intercept backdrop/Escape
      fullWidth
      maxWidth="md"
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        Edit Day Schedules
        {/* X acts as Cancel with discard prompt */}
        <IconButton onClick={requestClose} size="small" aria-label="Cancel">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          {/* Top controls: schedule select + rename (icon) + add + delete */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
            <FormControl sx={{ minWidth: 240 }}>
              <InputLabel id="lib-select-label">Schedule</InputLabel>
              <Select
                labelId="lib-select-label"
                label="Schedule"
                value={selected || ""}
                onChange={(e) => setSelected(String(e.target.value))}
              >
                {order.map((n) => (
                  <MenuItem key={n} value={n}>
                    {n}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Rename via dialog (pencil) */}
            <Tooltip title="Rename schedule">
              <span>
                <IconButton onClick={openRename} disabled={!selected}>
                  <EditIcon />
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip title="New schedule">
              <IconButton onClick={addSchedule}>
                <AddIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Delete selected schedule">
              <span>
                <IconButton
                  color="error"
                  disabled={!selected}
                  onClick={() => selected && handleScheduleDelete(selected)}
                >
                  <DeleteOutlineIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>

          {!current ? (
            <Alert severity="info">Select or create a schedule to edit.</Alert>
          ) : (
            <>
              <Divider textAlign="left">Periods</Divider>
              <Stack spacing={2}>
                {current.periods.map((p, pIdx) => (
                  <Paper key={pIdx} variant="outlined" sx={{ p: 2 }}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                      <TextField
                        label="Period Name"
                        value={p.name}
                        onChange={(e) => setPeriodField(pIdx, "name", e.target.value)}
                        sx={{ minWidth: 180 }}
                      />
                      <TextField
                        label="Start (HH:MM)"
                        value={p.start}
                        onChange={(e) => setPeriodField(pIdx, "start", e.target.value as HHMM)}
                        sx={{ width: 130 }}
                      />
                      <TextField
                        label="End (HH:MM)"
                        value={p.end}
                        onChange={(e) => setPeriodField(pIdx, "end", e.target.value as HHMM)}
                        sx={{ width: 130 }}
                      />
                      <Tooltip title="Delete period">
                        <IconButton color="error" onClick={() => removePeriod(pIdx)}>
                          <DeleteOutlineIcon />
                        </IconButton>
                      </Tooltip>
                      <Button onClick={() => addSegment(pIdx)}>+ Segment</Button>
                    </Stack>

                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {p.segments.map((s, sIdx) => (
                        <Stack key={sIdx} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                          <TextField
                            label="Title"
                            value={s.title}
                            onChange={(e) => setSegmentField(pIdx, sIdx, "title", e.target.value)}
                            sx={{ minWidth: 160 }}
                          />
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <input
                              type="color"
                              value={s.color}
                              onChange={(e) => setSegmentField(pIdx, sIdx, "color", e.target.value)}
                              style={{ width: 40, height: 40, border: "none", background: "transparent" }}
                              aria-label="Segment color"
                            />
                            <TextField
                              label="Color (hex)"
                              value={s.color}
                              onChange={(e) => setSegmentField(pIdx, sIdx, "color", e.target.value)}
                              sx={{ width: 140 }}
                            />
                          </Box>
                          <TextField
                            label="Start"
                            value={s.start}
                            onChange={(e) => setSegmentField(pIdx, sIdx, "start", e.target.value as HHMM)}
                            sx={{ width: 120 }}
                          />
                          <TextField
                            label="End"
                            value={s.end}
                            onChange={(e) => setSegmentField(pIdx, sIdx, "end", e.target.value as HHMM)}
                            sx={{ width: 120 }}
                          />
                          <Tooltip title="Delete segment">
                            <IconButton color="error" size="small" onClick={() => removeSegment(pIdx, sIdx)}>
                              <DeleteOutlineIcon />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      ))}
                    </Stack>
                  </Paper>
                ))}
              </Stack>

              <Button onClick={addPeriod} startIcon={<AddIcon />} sx={{ mt: 1 }}>
                Add Period
              </Button>
            </>
          )}
        </Stack>
      </DialogContent>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)}>
        <DialogTitle>Rename Schedule</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Schedule name"
            fullWidth
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={applyRename}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Discard changes confirm */}
      <Dialog open={discardOpen} onClose={() => setDiscardOpen(false)}>
        <DialogTitle>Discard changes?</DialogTitle>
        <DialogContent>
          <Typography sx={{ mt: 1 }}>
            You have unsaved changes. Do you want to discard them?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDiscardOpen(false)}>Keep editing</Button>
          <Button variant="contained" color="error" onClick={confirmDiscard}>
            Discard
          </Button>
        </DialogActions>
      </Dialog>

      {/* Footer: Save only (Close is now Save) */}
      <DialogActions>
        <Button variant="contained" onClick={handleSave}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}






/* ------------------ Add Day Schedule Modal (NEW, no library dropdown) ------------------ */

function AddScheduleModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (schedule: DaySchedule) => void;
}) {
  const [schedule, setSchedule] = useState<DaySchedule>(() => makeDefaultSchedule("NewSchedule"));

  useEffect(() => {
    if (open) setSchedule(makeDefaultSchedule("NewSchedule"));
  }, [open]);

  const setName = (name: string) => setSchedule((s) => ({ ...s, name }));
  const setPeriodField = (idx: number, field: keyof Period, value: string) =>
    setSchedule((s) => ({
      ...s,
      periods: s.periods.map((p, i) => (i === idx ? { ...p, [field]: value } : p)),
    }));
  const addPeriod = () =>
    setSchedule((s) => ({
      ...s,
      periods: [
        ...s.periods,
        {
          name: `Period ${s.periods.length + 1}`,
          start: "10:00",
          end: "11:00",
          segments: [
            { title: "Seg 1", color: "#90caf9", start: "10:00", end: "10:20" },
            { title: "Seg 2", color: "#ffcc80", start: "10:20", end: "11:00" },
          ],
        },
      ],
    }));
  const removePeriod = (idx: number) =>
    setSchedule((s) => ({ ...s, periods: s.periods.filter((_, i) => i !== idx) }));

  const addSegment = (pIdx: number) =>
    setSchedule((s) => {
      const p = s.periods[pIdx];
      const lastEnd = p.segments[p.segments.length - 1]?.end ?? p.start;
      const proposedEnd = fromMinutes(Math.min(toMinutes(p.end), toMinutes(lastEnd) + 10));
      const newSeg: Segment = { title: `Seg ${p.segments.length + 1}`, color: "#c5e1a5", start: lastEnd, end: proposedEnd };
      return {
        ...s,
        periods: s.periods.map((pp, i) => (i === pIdx ? { ...pp, segments: [...pp.segments, newSeg] } : pp)),
      };
    });

  const setSegmentField = (pIdx: number, sIdx: number, field: keyof Segment, value: string) =>
    setSchedule((s) => ({
      ...s,
      periods: s.periods.map((p, i) =>
        i === pIdx ? { ...p, segments: p.segments.map((seg, j) => (j === sIdx ? { ...seg, [field]: value } : seg)) } : p
      ),
    }));
  const removeSegment = (pIdx: number, sIdx: number) =>
    setSchedule((s) => ({
      ...s,
      periods: s.periods.map((p, i) =>
        i === pIdx ? { ...p, segments: p.segments.filter((_, j) => j !== sIdx) } : p
      ),
    }));

  const handleCreate = () => {
    const trimmed = schedule.name.trim() || "NewSchedule";
    onCreate({ ...schedule, name: trimmed });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        Add Day Schedule
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            label="Schedule name"
            value={schedule.name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
          />

          <Divider textAlign="left">Periods</Divider>
          <Stack spacing={2}>
            {schedule.periods.map((p, pIdx) => (
              <Paper key={pIdx} variant="outlined" sx={{ p: 2 }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                  <TextField
                    label="Period Name"
                    value={p.name}
                    onChange={(e) => setPeriodField(pIdx, "name", e.target.value)}
                    sx={{ minWidth: 180 }}
                  />
                  <TextField
                    label="Start (HH:MM)"
                    value={p.start}
                    onChange={(e) => setPeriodField(pIdx, "start", e.target.value as HHMM)}
                    sx={{ width: 130 }}
                  />
                  <TextField
                    label="End (HH:MM)"
                    value={p.end}
                    onChange={(e) => setPeriodField(pIdx, "end", e.target.value as HHMM)}
                    sx={{ width: 130 }}
                  />
                  <Tooltip title="Delete period">
                    <IconButton color="error" onClick={() => removePeriod(pIdx)}>
                      <DeleteOutlineIcon />
                    </IconButton>
                  </Tooltip>
                  <Button onClick={() => addSegment(pIdx)}>+ Segment</Button>
                </Stack>

                <Stack spacing={1} sx={{ mt: 1 }}>
                  {p.segments.map((s, sIdx) => (
                    <Stack key={sIdx} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                      <TextField
                        label="Title"
                        value={s.title}
                        onChange={(e) => setSegmentField(pIdx, sIdx, "title", e.target.value)}
                        sx={{ minWidth: 160 }}
                      />
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <input
                          type="color"
                          value={s.color}
                          onChange={(e) => setSegmentField(pIdx, sIdx, "color", e.target.value)}
                          style={{ width: 40, height: 40, border: "none", background: "transparent" }}
                          aria-label="Segment color"
                        />
                        <TextField
                          label="Color (hex)"
                          value={s.color}
                          onChange={(e) => setSegmentField(pIdx, sIdx, "color", e.target.value)}
                          sx={{ width: 140 }}
                        />
                      </Box>
                      <TextField
                        label="Start"
                        value={s.start}
                        onChange={(e) => setSegmentField(pIdx, sIdx, "start", e.target.value as HHMM)}
                        sx={{ width: 120 }}
                      />
                      <TextField
                        label="End"
                        value={s.end}
                        onChange={(e) => setSegmentField(pIdx, sIdx, "end", e.target.value as HHMM)}
                        sx={{ width: 120 }}
                      />
                      <Tooltip title="Delete segment">
                        <IconButton color="error" size="small" onClick={() => removeSegment(pIdx, sIdx)}>
                          <DeleteOutlineIcon />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            ))}
          </Stack>

          <Button onClick={addPeriod} startIcon={<AddIcon />} sx={{ mt: 1 }}>
            Add Period
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleCreate}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ------------------ Week Panel (right) ------------------ */

function WeekPanel({
  weekStore,
  lib,
  activeWeekName,
  onChangeActiveWeek,
  onAssign,
  onOpenAddSchedule,  // opens AddScheduleModal
  onOpenLibrary,      // opens LibraryEditor
  onRenameWeek,
  onDeleteWeek,
  onAddWeek,
}: {
  weekStore: Record<string, WeekSchedule>;
  lib: DayScheduleLibrary;
  activeWeekName: string;
  onChangeActiveWeek: (name: string) => void;
  onAssign: (weekName: string, weekday: number, dayName: string) => void;
  onOpenAddSchedule: () => void;
  onOpenLibrary: () => void;
  onRenameWeek: (newName: string) => void;
  onDeleteWeek: () => void;
  onAddWeek: () => void;
}) {
  const activeWeek = weekStore[activeWeekName];
  const libNames = Object.keys(lib);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(activeWeekName);
  useEffect(() => setRenameValue(activeWeekName), [activeWeekName]);

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" gutterBottom>
        Week Mapping
      </Typography>

      {/* Top row: week select + rename + add week + delete */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <FormControl sx={{ minWidth: 220, flex: 1 }}>
          <InputLabel id="week-panel-select">Week</InputLabel>
          <Select
            labelId="week-panel-select"
            label="Week"
            value={activeWeekName}
            onChange={(e) => onChangeActiveWeek(String(e.target.value))}
          >
            {Object.keys(weekStore).map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Tooltip title="Rename week">
          <IconButton onClick={() => setRenameOpen(true)}>
            <EditIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title="New week">
          <IconButton onClick={onAddWeek}>
            <AddIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title="Delete week">
          <IconButton color="error" onClick={onDeleteWeek}>
            <DeleteOutlineIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Second row: Add Day Schedule (new modal), Edit Library (existing schedules) */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <Button variant="contained" onClick={onOpenAddSchedule} startIcon={<AddIcon />}>
          Add Day Schedule
        </Button>
        <Button variant="outlined" onClick={onOpenLibrary}>
          Edit Day Schedules
        </Button>
      </Stack>

      {/* Mapping table */}
      <Stack spacing={1.25}>
        {Array.from({ length: 7 }, (_, d) => {
          const dayLabel = weekdayName(d);
          const mapped = activeWeek?.mapping?.[d] ?? "";
          return (
            <Stack key={d} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <Box sx={{ minWidth: 100 }}>
                <Typography>{dayLabel}</Typography>
              </Box>
              <FormControl sx={{ minWidth: 200, flex: 1 }}>
                <InputLabel id={`day-row-${d}`}>Day schedule</InputLabel>
                <Select
                  labelId={`day-row-${d}`}
                  label="Day schedule"
                  value={mapped || ""}
                  onChange={(e) => onAssign(activeWeekName, d, String(e.target.value))}
                >
                  {libNames.length ? (
                    libNames.map((n) => (
                      <MenuItem key={n} value={n}>
                        {n}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem value="" disabled>
                      No schedules saved
                    </MenuItem>
                  )}
                </Select>
              </FormControl>
            </Stack>
          );
        })}
      </Stack>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)}>
        <DialogTitle>Rename Week</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Week name"
            fullWidth
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              const trimmed = renameValue.trim();
              if (trimmed && trimmed !== activeWeekName) onRenameWeek(trimmed);
              setRenameOpen(false);
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

/* ------------------ Main App ------------------ */

export default function DailyScheduleApp() {
  // Live clock (rerender every second)
  const [, setTimeTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTimeTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Core state mirrored with localStorage
  const [lib, setLib] = useState<DayScheduleLibrary>({});
  const [weeks, setWeeks] = useState<WeekSchedulesStore>({});
  const [activeWeekName, setActiveWeekName] = useState<string>("DefaultWeek");

  // seed + load
  useEffect(() => {
    seedIfEmpty();
    setLib(loadJSON(LS_KEYS.DAY_SCHEDULES, {}));
    setWeeks(loadJSON(LS_KEYS.WEEK_SCHEDULES, {}));
    setActiveWeekName(localStorage.getItem(LS_KEYS.ACTIVE_WEEK_SCHEDULE) ?? "DefaultWeek");
  }, []);

  // Derived: today
  const now = new Date();
  const todayWeekday = now.getDay();
  const activeWeek = weeks[activeWeekName];
  const todaysScheduleName = activeWeek?.mapping?.[todayWeekday] ?? "";
  const todaysSchedule = todaysScheduleName ? lib[todaysScheduleName] : undefined;

  // Active period for pie timer (today's schedule only)
  const minutesNow = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const activePeriod = useMemo(() => {
    const p = todaysSchedule?.periods ?? [];
    const nowMin = Math.floor(minutesNow);
    return p.find((pp) => within(nowMin, toMinutes(pp.start), toMinutes(pp.end))) ?? null;
  }, [todaysSchedule, minutesNow]);
  const nowFmt = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  /* ---------- Persistence helpers ---------- */

  const saveLib = (updated: DayScheduleLibrary) => {
    setLib(updated);
    saveJSON(LS_KEYS.DAY_SCHEDULES, updated);
  };
  const saveWeeks = (updated: WeekSchedulesStore, nextActive?: string) => {
    setWeeks(updated);
    saveJSON(LS_KEYS.WEEK_SCHEDULES, updated);
    if (nextActive !== undefined) {
      setActiveWeekName(nextActive);
      localStorage.setItem(LS_KEYS.ACTIVE_WEEK_SCHEDULE, nextActive);
    }
  };

  /* ---------- Week actions ---------- */

  const updateActiveWeekName = (newName: string) => {
    setActiveWeekName(newName);
    localStorage.setItem(LS_KEYS.ACTIVE_WEEK_SCHEDULE, newName);
  };
  const assignWeekScheduleToDay = (weekName: string, wd: number, dayName: string) => {
    const ws = { ...weeks };
    const wk = { ...(ws[weekName] ?? { name: weekName, mapping: {} }) };
    wk.mapping = { ...wk.mapping, [wd]: dayName };
    ws[weekName] = wk;
    saveWeeks(ws);
  };
  const createWeekSchedule = () => {
    const base = "Week";
    let name = `${base}-${Object.keys(weeks).length + 1}`;
    while (weeks[name]) name = `${base}-${Math.floor(Math.random() * 1000)}`;
    const ws = { ...weeks, [name]: { name, mapping: {} } };
    saveWeeks(ws, name);
  };
  const deleteActiveWeek = () => {
    const name = activeWeekName;
    if (!name) return;
    const ws = { ...weeks };
    delete ws[name];
    const fallback = Object.keys(ws)[0] || "";
    saveWeeks(ws, fallback);
  };
  const renameActiveWeek = (newName: string) => {
    if (!newName || weeks[newName]) return;
    const old = activeWeekName;
    const wk = weeks[old];
    if (!wk) return;
    const ws: WeekSchedulesStore = { ...weeks };
    delete ws[old];
    ws[newName] = { ...wk, name: newName };
    saveWeeks(ws, newName);
  };

  /* ---------- Library actions & modals ---------- */

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [librarySelectedOnOpen, setLibrarySelectedOnOpen] = useState<string | undefined>(undefined);

  // Add Schedule modal
  const [addOpen, setAddOpen] = useState(false);

  const openAddSchedule = () => setAddOpen(true);
  const createSchedule = (sched: DaySchedule) => {
    // ensure unique name
    let name = sched.name.trim() || "NewSchedule";
    let i = 1;
    while (lib[name]) {
      name = `${sched.name}-${i++}`;
    }
    const updated = { ...lib, [name]: { ...sched, name } };
    saveLib(updated);
  };

  const openLibrary = () => {
    setLibrarySelectedOnOpen(undefined);
    setLibraryOpen(true);
  };

  const deleteScheduleFromLibrary = (name: string) => {
    // scrub week mappings
    const ws = { ...weeks };
    Object.values(ws).forEach((w) => {
      Object.entries(w.mapping).forEach(([wd, sched]) => {
        if (sched === name) {
          const nm = { ...w.mapping };
          delete nm[Number(wd)];
          w.mapping = nm;
        }
      });
    });
    saveWeeks(ws);

    const copy = { ...lib };
    delete copy[name];
    saveLib(copy);
  };

  return (
    <Box sx={{ p: 2, maxWidth: 1200, mx: "auto" }}>
      <Typography variant="h5" gutterBottom>
        Daily Schedule & Pie Timer
      </Typography>

      {/* Main content */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ mt: 2 }}>
        {/* Left: Now + today's schedule, pie, periods */}
        <Box sx={{ flex: 1 }}>
          <Typography variant="overline">Now</Typography>
          <Typography variant="h3">{nowFmt}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {weekdayName(now.getDay())} · {activeWeek?.mapping?.[now.getDay()] || "(no schedule set)"}
          </Typography>

          <Box sx={{ mt: 2 }}>
            <PieTimer period={activePeriod ?? undefined} nowMinutes={minutesNow} />
          </Box>

          <Box sx={{ mt: 3 }}>
            <Typography variant="overline">Today’s Periods</Typography>
            <Stack spacing={1} sx={{ mt: 1 }}>
              {todaysSchedule?.periods?.length ? (
                todaysSchedule.periods.map((p, i) => (
                  <Paper key={i} variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="subtitle1">
                      {p.name} — {p.start} to {p.end}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 0.5 }}>
                      {p.segments.map((s, j) => (
                        <Chip key={j} size="small" label={`${s.title}: ${s.start}–${s.end}`} sx={{ background: s.color }} />
                      ))}
                    </Stack>
                  </Paper>
                ))
              ) : (
                <Typography color="text.secondary">No periods defined for today’s schedule.</Typography>
              )}
            </Stack>
          </Box>
        </Box>

        {/* Right: Week panel */}
        <Box sx={{ width: { md: 480 }, flexShrink: 0 }}>
          <WeekPanel
            weekStore={weeks}
            lib={lib}
            activeWeekName={activeWeekName}
            onChangeActiveWeek={updateActiveWeekName}
            onAssign={assignWeekScheduleToDay}
            onOpenAddSchedule={openAddSchedule}
            onOpenLibrary={openLibrary}
            onRenameWeek={renameActiveWeek}
            onDeleteWeek={deleteActiveWeek}
            onAddWeek={createWeekSchedule}
          />
        </Box>
      </Stack>

      {/* Modals */}
      <AddScheduleModal open={addOpen} onClose={() => setAddOpen(false)} onCreate={createSchedule} />

      <LibraryEditor
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        lib={lib}
        selectedName={librarySelectedOnOpen}
        onSaveLib={saveLib}
        onDeleteSchedule={deleteScheduleFromLibrary}
      />
    </Box>
  );
}
