import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SaveIcon from "@mui/icons-material/Save";
import EditIcon from "@mui/icons-material/Edit";

/**
 * Daily Schedule with Pie Timer
 * Brian-friendly scaffolding: React + TypeScript + MUI, no external chart libs.
 * - Store multiple DaySchedules per weekday in localStorage
 * - Store multiple WeekSchedules that map weekdays -> a chosen DaySchedule name
 * - Live clock; pie timer shows the active period and its segments + current progress
 *
 * You can drop this into a project created with CRA/Vite/Next (client side) and ensure @mui/* is installed.
 */

// ------------------ Types ------------------

type HHMM = `${number}${number}:${number}${number}`; // 24h time string, e.g. "11:05"

type Segment = {
  title: string;
  color: string; // any valid CSS color
  start: HHMM; // inclusive
  end: HHMM; // exclusive
};

type Period = {
  name: string;
  start: HHMM; // inclusive
  end: HHMM; // exclusive
  segments: Segment[]; // non-overlapping, fully covering [start,end)
};

type DaySchedule = {
  name: string;
  weekday: number; // 0=Sun..6=Sat
  periods: Period[]; // non-overlapping
};

type WeekSchedule = {
  name: string;
  // map weekday -> day schedule name to load
  mapping: Partial<Record<number, string>>; // e.g., {1: "FullDay", 5: "HalfDay"}
};

// ------------------ Local Storage Helpers ------------------

const LS_KEYS = {
  DAY_SCHEDULES: "scheduler:daySchedules", // Record<string weekday, Record<string scheduleName, DaySchedule>>
  WEEK_SCHEDULES: "scheduler:weekSchedules", // Record<string weekScheduleName, WeekSchedule>
  ACTIVE_WEEK_SCHEDULE: "scheduler:activeWeekSchedule", // selected week schedule name
  ACTIVE_DAY_SELECTIONS: "scheduler:activeDaySelections", // Record<string weekday, string dayScheduleName>
} as const;

type DaySchedulesStore = Record<string, Record<string, DaySchedule>>; // {"1": {"FullDay": DaySchedule, ...}, ...}

type WeekSchedulesStore = Record<string, WeekSchedule>;

type ActiveDaySelections = Record<string, string>; // {"1":"FullDay","5":"HalfDay"}

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

// ------------------ Time Utils ------------------

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

// ------------------ Defaults ------------------

function makeDefaultDay(weekday: number, name: string): DaySchedule {
  // Example: Period 3 with three 20-minute segments 11:00-12:00
  const p3Start: HHMM = "11:00";
  const p3End: HHMM = "12:00";
  const segs: Segment[] = [
    { title: "Seg 1", color: "#90caf9", start: "11:00", end: "11:20" },
    { title: "Seg 2", color: "#ffcc80", start: "11:20", end: "11:40" },
    { title: "Seg 3", color: "#a5d6a7", start: "11:40", end: "12:00" },
  ];
  const periods: Period[] = [
    { name: "Period 3", start: p3Start, end: p3End, segments: segs },
  ];
  return { name, weekday, periods };
}

function ensureDefaults() {
  const dayStore = loadJSON<DaySchedulesStore>(LS_KEYS.DAY_SCHEDULES, {});
  const weekStore = loadJSON<WeekSchedulesStore>(LS_KEYS.WEEK_SCHEDULES, {});
  const activeDays = loadJSON<ActiveDaySelections>(LS_KEYS.ACTIVE_DAY_SELECTIONS, {});

  // Seed Monday FullDay if empty
  if (Object.keys(dayStore).length === 0) {
    const monday = 1;
    dayStore[String(monday)] = {
      FullDay: makeDefaultDay(monday, "FullDay"),
      HalfDay: makeDefaultDay(monday, "HalfDay"),
    };

    // Copy templates to other weekdays for convenience
    for (let d = 0; d < 7; d++) {
      if (!dayStore[String(d)]) dayStore[String(d)] = {};
      if (!dayStore[String(d)]["FullDay"]) {
        dayStore[String(d)]["FullDay"] = { ...makeDefaultDay(d, "FullDay") };
      }
      if (!dayStore[String(d)]["HalfDay"]) {
        const base = makeDefaultDay(d, "HalfDay");
        // Shorten half day example: single 30-min segment 11:00-11:30
        base.periods = [
          {
            name: "Period 3 (Half)",
            start: "11:00",
            end: "11:30",
            segments: [
              { title: "Seg 1", color: "#ce93d8", start: "11:00", end: "11:15" },
              { title: "Seg 2", color: "#ffab91", start: "11:15", end: "11:30" },
            ],
          },
        ];
        dayStore[String(d)]["HalfDay"] = base;
      }
    }
    saveJSON(LS_KEYS.DAY_SCHEDULES, dayStore);
  }

  if (Object.keys(weekStore).length === 0) {
    const defaultWeek: WeekSchedule = {
      name: "DefaultWeek",
      mapping: {
        1: "FullDay",
        2: "FullDay",
        3: "FullDay",
        4: "FullDay",
        5: "HalfDay", // Friday half day example
      },
    };
    weekStore[defaultWeek.name] = defaultWeek;
    saveJSON(LS_KEYS.WEEK_SCHEDULES, weekStore);
  }

  if (Object.keys(activeDays).length === 0) {
    const mapping: ActiveDaySelections = {};
    for (let d = 0; d < 7; d++) mapping[String(d)] = "FullDay";
    saveJSON(LS_KEYS.ACTIVE_DAY_SELECTIONS, mapping);
  }
}

// ------------------ Pie Timer (SVG) ------------------

type PieTimerProps = {
  period?: Period | null;
  nowMinutes: number; // minutes since midnight
};

function PieTimer({ period, nowMinutes }: PieTimerProps) {
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

  // Convert a minute offset within period to angle in degrees [0, 360)
  const toAngle = (m: number) => (m / pDur) * 360;

  // Arc helper
  const polar = (angleDeg: number) => {
    const rad = (Math.PI * (angleDeg - 90)) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const arcPath = (startDeg: number, endDeg: number) => {
    // normalize
    const a0 = startDeg % 360;
    const a1 = endDeg % 360;
    const largeArc = (a1 - a0 + 360) % 360 > 180 ? 1 : 0;
    const p0 = polar(a0);
    const p1 = polar(a1);
    return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${largeArc} 1 ${p1.x} ${p1.y}`;
  };

  // Build segment arcs
  const segArcs = period.segments.map((seg, i) => {
    const s = clamp(toMinutes(seg.start), pStart, pEnd) - pStart;
    const e = clamp(toMinutes(seg.end), pStart, pEnd) - pStart;
    const a0 = toAngle(s);
    const a1 = toAngle(e);
    return (
      <g key={i}>
        <path d={arcPath(a0, a1)} stroke={seg.color} strokeWidth={18} fill="none" />
      </g>
    );
  });

  // Current progress needle within the period
  const progressAngle = toAngle(clamp(nowMinutes, pStart, pEnd) - pStart);
  const pEndPt = polar(progressAngle);

  // Find current segment
  const currentSeg = period.segments.find((s) => within(nowMinutes, toMinutes(s.start), toMinutes(s.end)));

  return (
    <Box>
      <svg width={size} height={size}>
        {/* Base circle */}
        <circle cx={cx} cy={cy} r={r} fill="#f5f5f5" stroke="#ccc" strokeWidth={1} />

        {/* Segments */}
        {segArcs}

        {/* Progress needle */}
        <line x1={cx} y1={cy} x2={pEndPt.x} y2={pEndPt.y} stroke="#000" strokeWidth={2} />

        {/* Center dot */}
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

// ------------------ Editors ------------------

type DayScheduleEditorProps = {
  open: boolean;
  onClose: () => void;
  initial?: DaySchedule;
  onSave: (schedule: DaySchedule) => void;
};

function DayScheduleEditor({ open, onClose, initial, onSave }: DayScheduleEditorProps) {
  const [name, setName] = useState(initial?.name ?? "NewDay");
  const [weekday, setWeekday] = useState<number>(initial?.weekday ?? new Date().getDay());
  const [periods, setPeriods] = useState<Period[]>(initial?.periods ?? []);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "NewDay");
      setWeekday(initial?.weekday ?? new Date().getDay());
      setPeriods(initial?.periods ?? []);
    }
  }, [open, initial]);

  const addPeriod = () => {
    const p: Period = {
      name: `Period ${periods.length + 1}`,
      start: "10:00",
      end: "11:00",
      segments: [
        { title: "Seg 1", color: "#90caf9", start: "10:00", end: "10:20" },
        { title: "Seg 2", color: "#ffcc80", start: "10:20", end: "11:00" },
      ],
    };
    setPeriods((ps) => [...ps, p]);
  };

  const updatePeriod = (idx: number, patch: Partial<Period>) => {
    setPeriods((ps) => ps.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const updateSegment = (pIdx: number, sIdx: number, patch: Partial<Segment>) => {
    setPeriods((ps) =>
      ps.map((p, i) => {
        if (i !== pIdx) return p;
        const segs = p.segments.map((s, j) => (j === sIdx ? { ...s, ...patch } : s));
        return { ...p, segments: segs };
      })
    );
  };

  const addSegment = (pIdx: number) => {
    setPeriods((ps) =>
      ps.map((p, i) => {
        if (i !== pIdx) return p;
        const lastEnd = p.segments[p.segments.length - 1]?.end ?? p.start;
        const proposedEnd = fromMinutes(Math.min(toMinutes(p.end), toMinutes(lastEnd) + 10));
        const newSeg: Segment = { title: `Seg ${p.segments.length + 1}`, color: "#c5e1a5", start: lastEnd, end: proposedEnd };
        return { ...p, segments: [...p.segments, newSeg] };
      })
    );
  };

  const validate = (): string | null => {
    if (!name.trim()) return "Name is required";
    for (const p of periods) {
      if (toMinutes(p.end) <= toMinutes(p.start)) return `Period ${p.name} has end <= start`;
      // Validate segments cover the period and are non-overlapping & ordered
      const segs = [...p.segments].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
      let cur = toMinutes(p.start);
      for (const s of segs) {
        if (toMinutes(s.start) !== cur) return `${p.name}: segment ${s.title} must start at ${fromMinutes(cur)}`;
        if (toMinutes(s.end) <= toMinutes(s.start)) return `${p.name}: segment ${s.title} end <= start`;
        cur = toMinutes(s.end);
      }
      if (cur !== toMinutes(p.end)) return `${p.name}: segments must end at ${p.end}`;
    }
    // Period overlaps
    const sorted = [...periods].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    for (let i = 1; i < sorted.length; i++) {
      if (toMinutes(sorted[i].start) < toMinutes(sorted[i - 1].end)) {
        return `Periods ${sorted[i - 1].name} and ${sorted[i].name} overlap`;
      }
    }
    return null;
  };

  const handleSave = () => {
    const err = validate();
    if (err) {
      alert(err);
      return;
    }
    onSave({ name: name.trim(), weekday, periods });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{initial ? "Edit Day Schedule" : "New Day Schedule"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={2}>
            <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
            <FormControl sx={{ minWidth: 160 }}>
              <InputLabel id="weekday-label">Weekday</InputLabel>
              <Select labelId="weekday-label" value={weekday} label="Weekday" onChange={(e) => setWeekday(Number(e.target.value))}>
                {Array.from({ length: 7 }, (_, d) => (
                  <MenuItem key={d} value={d}>
                    {weekdayName(d)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Divider textAlign="left">Periods</Divider>
          <Stack spacing={2}>
            {periods.map((p, idx) => (
              <Paper key={idx} sx={{ p: 2 }} variant="outlined">
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
                  <TextField label="Period Name" value={p.name} onChange={(e) => updatePeriod(idx, { name: e.target.value })} sx={{ minWidth: 200 }} />
                  <TextField label="Start (HH:MM)" value={p.start} onChange={(e) => updatePeriod(idx, { start: e.target.value as HHMM })} sx={{ width: 140 }} />
                  <TextField label="End (HH:MM)" value={p.end} onChange={(e) => updatePeriod(idx, { end: e.target.value as HHMM })} sx={{ width: 140 }} />
                  <Tooltip title="Add segment">
                    <Button onClick={() => addSegment(idx)}>+ Segment</Button>
                  </Tooltip>
                </Stack>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  {p.segments.map((s, sIdx) => (
                    <Stack key={sIdx} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
                      <TextField label="Title" value={s.title} onChange={(e) => updateSegment(idx, sIdx, { title: e.target.value })} sx={{ minWidth: 160 }} />
                      <TextField label="Color" value={s.color} onChange={(e) => updateSegment(idx, sIdx, { color: e.target.value })} sx={{ width: 140 }} />
                      <TextField label="Start" value={s.start} onChange={(e) => updateSegment(idx, sIdx, { start: e.target.value as HHMM })} sx={{ width: 120 }} />
                      <TextField label="End" value={s.end} onChange={(e) => updateSegment(idx, sIdx, { end: e.target.value as HHMM })} sx={{ width: 120 }} />
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            ))}
          </Stack>

          <Button onClick={addPeriod} startIcon={<AddIcon />}>Add Period</Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" startIcon={<SaveIcon />}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

// ------------------ Main App ------------------

export default function DailyScheduleApp() {
  const now = new Date();
  const [tick, setTick] = useState(0);
  const [weekday, setWeekday] = useState(now.getDay());

  // Ensure seed data once
  useEffect(() => {
    ensureDefaults();
  }, []);

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const dayStore = useMemo<DaySchedulesStore>(() => loadJSON(LS_KEYS.DAY_SCHEDULES, {}), [tick]);
  const weekStore = useMemo<WeekSchedulesStore>(() => loadJSON(LS_KEYS.WEEK_SCHEDULES, {}), [tick]);
  const activeDaySelections = useMemo<ActiveDaySelections>(() => loadJSON(LS_KEYS.ACTIVE_DAY_SELECTIONS, {}), [tick]);
  const activeWeekName = useMemo(() => localStorage.getItem(LS_KEYS.ACTIVE_WEEK_SCHEDULE) ?? "DefaultWeek", [tick]);

  const setActiveWeekName = (name: string) => localStorage.setItem(LS_KEYS.ACTIVE_WEEK_SCHEDULE, name);

  const daySchedulesForWeekday = dayStore[String(weekday)] ?? {};
  const availableDayNames = Object.keys(daySchedulesForWeekday);
  const activeDayName = (activeDaySelections[String(weekday)] ?? availableDayNames[0] ?? "");

  const activeWeek = weekStore[activeWeekName];

  // If a week schedule is selected and provides a mapping for today, prefer it
  const mappedDayName = activeWeek?.mapping?.[weekday];
  const effectiveDayName = mappedDayName ?? activeDayName;
  const activeDay = daySchedulesForWeekday[effectiveDayName];

  // Current time in minutes since midnight
  const minutesNow = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60; // seconds for smoother needle

  // Find active period
  const activePeriod = useMemo(() => {
    if (!activeDay) return null;
    const nowMinInt = Math.floor(minutesNow);
    return activeDay.periods.find((p) => within(nowMinInt, toMinutes(p.start), toMinutes(p.end))) ?? null;
  }, [activeDay, minutesNow]);

  // Save handlers
  const saveDaySchedule = (sched: DaySchedule) => {
    const store = loadJSON<DaySchedulesStore>(LS_KEYS.DAY_SCHEDULES, {});
    const key = String(sched.weekday);
    if (!store[key]) store[key] = {};
    store[key][sched.name] = sched;
    saveJSON(LS_KEYS.DAY_SCHEDULES, store);

    // If saving the currently viewed weekday, set it active
    const act = loadJSON<ActiveDaySelections>(LS_KEYS.ACTIVE_DAY_SELECTIONS, {});
    act[key] = sched.name;
    saveJSON(LS_KEYS.ACTIVE_DAY_SELECTIONS, act);
    setTick((t) => t + 1);
  };

  const setActiveDayForWeekday = (wd: number, name: string) => {
    const act = loadJSON<ActiveDaySelections>(LS_KEYS.ACTIVE_DAY_SELECTIONS, {});
    act[String(wd)] = name;
    saveJSON(LS_KEYS.ACTIVE_DAY_SELECTIONS, act);
    setTick((t) => t + 1);
  };

  const [dayEditorOpen, setDayEditorOpen] = useState(false);
  const [editInitial, setEditInitial] = useState<DaySchedule | undefined>(undefined);

  const openCreateDay = () => {
    setEditInitial(undefined);
    setDayEditorOpen(true);
  };
  const openEditDay = () => {
    if (activeDay) {
      setEditInitial(activeDay);
      setDayEditorOpen(true);
    }
  };

  // Week schedule creation (simple mapper)
  const createWeekSchedule = () => {
    const name = prompt("New week schedule name?", `Week-${Object.keys(weekStore).length + 1}`)?.trim();
    if (!name) return;
    const mapping: Partial<Record<number, string>> = {};
    for (let d = 0; d < 7; d++) {
      const sel = activeDaySelections[String(d)] ?? "FullDay";
      mapping[d] = sel;
    }
    const store = loadJSON<WeekSchedulesStore>(LS_KEYS.WEEK_SCHEDULES, {});
    store[name] = { name, mapping };
    saveJSON(LS_KEYS.WEEK_SCHEDULES, store);
    setActiveWeekName(name);
    setTick((t) => t + 1);
  };

  const assignWeekScheduleToDay = (weekName: string, wd: number, dayName: string) => {
    const store = loadJSON<WeekSchedulesStore>(LS_KEYS.WEEK_SCHEDULES, {});
    const wk = store[weekName];
    if (!wk) return;
    wk.mapping[wd] = dayName;
    saveJSON(LS_KEYS.WEEK_SCHEDULES, store);
    setTick((t) => t + 1);
  };

  const nowFmt = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <Box sx={{ p: 2, maxWidth: 1100, mx: "auto" }}>
      <Typography variant="h5" gutterBottom>
        Daily Schedule & Pie Timer
      </Typography>

      <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems={{ md: "center" }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <FormControl sx={{ minWidth: 160 }}>
            <InputLabel id="weekday-select">Weekday</InputLabel>
            <Select
              labelId="weekday-select"
              label="Weekday"
              value={weekday}
              onChange={(e) => setWeekday(Number(e.target.value))}
            >
              {Array.from({ length: 7 }, (_, d) => (
                <MenuItem key={d} value={d}>
                  {weekdayName(d)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel id="day-sched-select">Day Schedule</InputLabel>
            <Select
              labelId="day-sched-select"
              label="Day Schedule"
              value={effectiveDayName || ""}
              onChange={(e) => setActiveDayForWeekday(weekday, String(e.target.value))}
            >
              {availableDayNames.map((n) => (
                <MenuItem key={n} value={n}>
                  {n}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Tooltip title="Create a new day schedule for this weekday">
            <IconButton color="primary" onClick={openCreateDay}>
              <AddIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Edit current day schedule">
            <span>
              <IconButton onClick={openEditDay} disabled={!activeDay}>
                <EditIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        <Divider flexItem orientation="vertical" sx={{ display: { xs: "none", md: "block" } }} />

        <Stack direction="row" spacing={2} alignItems="center">
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel id="week-sched-select">Week Schedule</InputLabel>
            <Select
              labelId="week-sched-select"
              label="Week Schedule"
              value={activeWeekName}
              onChange={(e) => {
                const val = String(e.target.value);
                setActiveWeekName(val);
                setTick((t) => t + 1);
              }}
            >
              {Object.keys(weekStore).map((n) => (
                <MenuItem key={n} value={n}>
                  {n}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Tooltip title="Create a new week schedule from current day selections">
            <IconButton onClick={createWeekSchedule} color="primary">
              <AddIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ mt: 3 }}>
        <Box>
          <Typography variant="overline">Now</Typography>
          <Typography variant="h3">{nowFmt}</Typography>
          <Typography variant="body2" color="text.secondary">
            {weekdayName(weekday)} · {effectiveDayName || "(none)"}
          </Typography>

          <Box sx={{ mt: 2 }}>
            <PieTimer period={activePeriod ?? undefined} nowMinutes={minutesNow} />
          </Box>
        </Box>

        <Box sx={{ flex: 1 }}>
          <Typography variant="overline">Today's Periods</Typography>
          <Stack spacing={1} sx={{ mt: 1 }}>
            {activeDay?.periods?.length ? (
              activeDay.periods.map((p, i) => (
                <Paper key={i} variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="subtitle1">
                    {p.name} — {p.start} to {p.end}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 0.5 }}>
                    {p.segments.map((s, j) => (
                      <Chip key={j} size="small" label={`${s.title}: ${s.start}–${s.end}`} sx={{ background: s.color }} />
                    ))}
                  </Stack>
                  <Box sx={{ mt: 1 }}>
                    <Button size="small" onClick={() => activeWeekName && assignWeekScheduleToDay(activeWeekName, weekday, activeDay.name)}>
                      Use this day in week “{activeWeekName}”
                    </Button>
                  </Box>
                </Paper>
              ))
            ) : (
              <Typography color="text.secondary">No periods defined for this day schedule.</Typography>
            )}
          </Stack>
        </Box>
      </Stack>

      <DayScheduleEditor
        open={dayEditorOpen}
        onClose={() => setDayEditorOpen(false)}
        initial={editInitial}
        onSave={saveDaySchedule}
      />
    </Box>
  );
}
