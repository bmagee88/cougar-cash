import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
  Drawer,
  TextField,
  InputLabel,
  FormControl,
  FormControlLabel,
  Chip,
  Divider,
  Tooltip,
  Paper,
  Alert,
  Switch,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CloseIcon from "@mui/icons-material/Close";
import MenuIcon from "@mui/icons-material/Menu";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";

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

type ClockSource = "network" | "server" | "system";

type ClockStatus = {
  source: ClockSource;
  label: string;
  offsetMs: number;
  syncing: boolean;
  provider?: string;
  syncedAtMs?: number;
  error?: string;
};

/* ------------------ LS keys + helpers ------------------ */

const LS_KEYS = {
  DAY_SCHEDULES: "scheduler:libraryDaySchedules",
  WEEK_SCHEDULES: "scheduler:weekSchedules",
  ACTIVE_WEEK_SCHEDULE: "scheduler:activeWeekSchedule",
  DAILY_PERIOD_NAME_OVERRIDES: "scheduler:dailyPeriodNameOverrides",
  DARK_MODE: "scheduler:darkMode",
  // legacy (auto-migrated if present)
  LEGACY_DAY_SCHEDULES: "scheduler:daySchedules",
  LEGACY_ACTIVE_DAY_SELECTIONS: "scheduler:activeDaySelections",
} as const;

type DayScheduleLibrary = Record<string, DaySchedule>;
type WeekSchedulesStore = Record<string, WeekSchedule>;
type DailyPeriodNameOverrides = Record<string, Record<string, string[]>>;

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

function dateKey(d: Date) {
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type TimeLeftParts = {
  minutes: number;
  seconds: number;
  totalSeconds: number;
};

function getTimeLeftParts(minutes: number): TimeLeftParts {
  const totalSeconds = Math.max(0, Math.ceil(minutes * 60));
  return {
    minutes: Math.floor(totalSeconds / 60),
    seconds: totalSeconds % 60,
    totalSeconds,
  };
}

function hexTextColor(hex: string | undefined) {
  const raw = hex?.replace("#", "");
  if (!raw || raw.length !== 6) return "#111827";

  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#111827" : "#ffffff";
}

function applyPeriodNameOverrides(schedule: DaySchedule | undefined, names: string[]) {
  if (!schedule) return undefined;

  return {
    ...schedule,
    periods: schedule.periods.map((period, index) => {
      const override = names[index]?.trim();
      return override ? { ...period, name: override } : period;
    }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const CLOCK_SYNC_INTERVAL_MS = 10 * 60 * 1000;
const CLOCK_SYNC_TIMEOUT_MS = 3000;
const EMPTY_PERIOD_NAMES: string[] = [];

function clockLabel(source: ClockSource, provider?: string) {
  if (source === "network") return provider ? `Network time (${provider})` : "Network time";
  if (source === "server") return "Backend clock";
  return "System clock";
}

function useSyncedClock() {
  const offsetRef = useRef(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [clockStatus, setClockStatus] = useState<ClockStatus>(() => ({
    source: "system",
    label: clockLabel("system"),
    offsetMs: 0,
    syncing: false,
  }));

  const syncClock = useCallback(async () => {
    const startedAtMs = Date.now();
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), CLOCK_SYNC_TIMEOUT_MS);

    setClockStatus((current) => ({ ...current, syncing: true, error: undefined }));

    try {
      const response = await fetch("/api/time", {
        cache: "no-store",
        signal: controller.signal,
      });
      const finishedAtMs = Date.now();

      if (!response.ok) {
        throw new Error(`Clock sync failed (${response.status})`);
      }

      const payload = (await response.json()) as {
        nowMs?: number;
        source?: ClockSource;
        provider?: string;
        error?: string;
      };
      const syncedNowMs = Number(payload.nowMs);

      if (!Number.isFinite(syncedNowMs)) {
        throw new Error("Clock sync returned an invalid time");
      }

      const midpointMs = startedAtMs + (finishedAtMs - startedAtMs) / 2;
      const nextOffsetMs = syncedNowMs - midpointMs;
      const nextSource: ClockSource =
        payload.source === "network" || payload.source === "server" ? payload.source : "server";

      offsetRef.current = nextOffsetMs;
      setNowMs(Date.now() + nextOffsetMs);
      setClockStatus({
        source: nextSource,
        label: clockLabel(nextSource, payload.provider),
        offsetMs: nextOffsetMs,
        syncing: false,
        provider: payload.provider,
        syncedAtMs: finishedAtMs,
        error: payload.error,
      });
    } catch {
      offsetRef.current = 0;
      setNowMs(Date.now());
      setClockStatus({
        source: "system",
        label: clockLabel("system"),
        offsetMs: 0,
        syncing: false,
        error: "Network sync unavailable",
      });
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, []);

  useEffect(() => {
    let timeoutId: number | undefined;

    const tick = () => {
      const nextNowMs = Date.now() + offsetRef.current;
      setNowMs(nextNowMs);
      timeoutId = window.setTimeout(tick, 1000 - (nextNowMs % 1000) + 5);
    };

    tick();
    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    syncClock();
    const intervalId = window.setInterval(syncClock, CLOCK_SYNC_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [syncClock]);

  useEffect(() => {
    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") syncClock();
    };

    window.addEventListener("focus", syncClock);
    document.addEventListener("visibilitychange", syncWhenVisible);
    return () => {
      window.removeEventListener("focus", syncClock);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, [syncClock]);

  return {
    now: new Date(nowMs),
    clockStatus,
    syncClock,
  };
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

function PieTimer({ period, nowMinutes, size = 420 }: { period?: Period | null; nowMinutes: number; size?: number }) {
  const r = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;

  if (!period) {
    return (
      <Box sx={{ width: "min(72vw, 420px)", aspectRatio: "1 / 1", display: "grid", placeItems: "center" }}>
        <Typography variant="subtitle1" align="center">
          No active period right now
        </Typography>
      </Box>
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
  const wedgePath = (startDeg: number, endDeg: number) => {
    const a0 = startDeg % 360;
    const a1 = endDeg % 360;
    const sweep = (a1 - a0 + 360) % 360;
    const largeArc = sweep > 180 ? 1 : 0;
    const p0 = polar(a0);
    const p1 = polar(a1);
    return `M ${cx} ${cy} L ${p0.x} ${p0.y} A ${r} ${r} 0 ${largeArc} 1 ${p1.x} ${p1.y} Z`;
  };

  const segArcs = period.segments.map((seg, i) => {
    const s = clamp(toMinutes(seg.start), pStart, pEnd) - pStart;
    const e = clamp(toMinutes(seg.end), pStart, pEnd) - pStart;
    const a0 = toAngle(s);
    const a1 = toAngle(e);
    const coversWholePeriod = e - s >= pDur;

    if (coversWholePeriod) {
      return <circle key={i} cx={cx} cy={cy} r={r} fill={seg.color} stroke="#fff" strokeWidth={2} />;
    }

    return <path key={i} d={wedgePath(a0, a1)} fill={seg.color} stroke="#fff" strokeWidth={2} />;
  });

  const progressAngle = toAngle(clamp(nowMinutes, pStart, pEnd) - pStart);
  const pEndPt = polar(progressAngle);
  return (
    <Box sx={{ width: "min(72vw, 420px)", maxWidth: "100%" }}>
      <svg width="100%" height="auto" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="#f5f5f5" stroke="#ccc" strokeWidth={1} />
        {segArcs}
        <line x1={cx} y1={cy} x2={pEndPt.x} y2={pEndPt.y} stroke="#000" strokeWidth={2} />
        <circle cx={cx} cy={cy} r={3} fill="#000" />
      </svg>
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

function DailyPeriodNameOverridesPanel({
  scheduleName,
  periods,
  values,
  onSetName,
  onSetAll,
  onClear,
}: {
  scheduleName: string;
  periods: Period[];
  values: string[];
  onSetName: (index: number, value: string) => void;
  onSetAll: (values: string[]) => void;
  onClear: () => void;
}) {
  const [bulkValue, setBulkValue] = useState("");

  useEffect(() => {
    setBulkValue(values.join("\n"));
  }, [scheduleName, values]);

  if (!scheduleName || periods.length === 0) {
    return <Alert severity="info">No schedule set for today.</Alert>;
  }

  return (
    <Stack spacing={1.25}>
      <Typography variant="subtitle1">Today's Period Names</Typography>
      <Typography variant="caption" color="text.secondary">
        {scheduleName}
      </Typography>
      {periods.map((period, index) => (
        <TextField
          key={`${period.start}-${period.end}-${index}`}
          label={`Period ${index + 1}`}
          placeholder={period.name}
          value={values[index] ?? ""}
          onChange={(event) => onSetName(index, event.target.value)}
          size="small"
          fullWidth
        />
      ))}
      <TextField
        label="Bulk Labels"
        value={bulkValue}
        onChange={(event) => setBulkValue(event.target.value)}
        multiline
        minRows={3}
        size="small"
        fullWidth
      />
      <Stack direction="row" spacing={1}>
        <Button
          variant="outlined"
          onClick={() => onSetAll(bulkValue.split(/\r?\n/).map((line) => line.trim()))}
        >
          Apply
        </Button>
        <Button onClick={onClear}>Clear</Button>
      </Stack>
    </Stack>
  );
}

/* ------------------ Main App ------------------ */

function TimeLeftDisplay({
  value,
  align = "inherit",
  mainSize = { xs: 48, md: 64 },
  secondsSize = { xs: 24, md: 30 },
}: {
  value: TimeLeftParts | null;
  align?: "left" | "center" | "right" | "inherit";
  mainSize?: { xs: number; md: number };
  secondsSize?: { xs: number; md: number };
}) {
  if (!value) {
    return (
      <Typography component="div" sx={{ fontSize: mainSize, fontWeight: 800, lineHeight: 1, textAlign: align }}>
        --
      </Typography>
    );
  }

  const onlySeconds = value.totalSeconds < 60;

  if (onlySeconds) {
    return (
      <Box sx={{ textAlign: align, lineHeight: 1 }}>
        <Typography component="span" sx={{ fontSize: mainSize, fontWeight: 800, lineHeight: 1 }}>
          {value.seconds}
        </Typography>
        <Typography component="span" sx={{ ml: 0.75, fontSize: secondsSize, fontWeight: 700, lineHeight: 1 }}>
          seconds
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ textAlign: align, lineHeight: 1 }}>
      <Typography component="span" sx={{ fontSize: mainSize, fontWeight: 800, lineHeight: 1 }}>
        {value.minutes}
      </Typography>
      <Typography component="span" sx={{ ml: 0.75, fontSize: secondsSize, fontWeight: 700, lineHeight: 1 }}>
        {value.minutes === 1 ? "min" : "mins"}
      </Typography>
    </Box>
  );
}

export default function DailyScheduleApp() {
  const { now } = useSyncedClock();

  // Core state mirrored with localStorage
  const [lib, setLib] = useState<DayScheduleLibrary>({});
  const [weeks, setWeeks] = useState<WeekSchedulesStore>({});
  const [activeWeekName, setActiveWeekName] = useState<string>("DefaultWeek");
  const [dailyOverrides, setDailyOverrides] = useState<DailyPeriodNameOverrides>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [darkMode, setDarkMode] = useState(() => loadJSON(LS_KEYS.DARK_MODE, true));

  useEffect(() => {
    saveJSON(LS_KEYS.DARK_MODE, darkMode);
  }, [darkMode]);

  // seed + load
  useEffect(() => {
    seedIfEmpty();
    setLib(loadJSON(LS_KEYS.DAY_SCHEDULES, {}));
    setWeeks(loadJSON(LS_KEYS.WEEK_SCHEDULES, {}));
    setActiveWeekName(localStorage.getItem(LS_KEYS.ACTIVE_WEEK_SCHEDULE) ?? "DefaultWeek");
    setDailyOverrides(loadJSON(LS_KEYS.DAILY_PERIOD_NAME_OVERRIDES, {}));
  }, []);

  // Derived: today
  const todayKey = dateKey(now);
  const todayWeekday = now.getDay();
  const activeWeek = weeks[activeWeekName];
  const todaysScheduleName = activeWeek?.mapping?.[todayWeekday] ?? "";
  const todaysSchedule = todaysScheduleName ? lib[todaysScheduleName] : undefined;
  const todaysPeriodNameOverrides = dailyOverrides[todayKey]?.[todaysScheduleName] ?? EMPTY_PERIOD_NAMES;
  const todaysDisplaySchedule = useMemo(
    () => applyPeriodNameOverrides(todaysSchedule, todaysPeriodNameOverrides),
    [todaysSchedule, todaysPeriodNameOverrides]
  );

  // Active period for pie timer (today's schedule only)
  const minutesNow = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const activePeriod = useMemo(() => {
    const p = todaysDisplaySchedule?.periods ?? [];
    return p.find((pp) => within(minutesNow, toMinutes(pp.start), toMinutes(pp.end))) ?? null;
  }, [todaysDisplaySchedule, minutesNow]);
  const currentSegment = useMemo(
    () =>
      activePeriod?.segments.find((segment) =>
        within(minutesNow, toMinutes(segment.start), toMinutes(segment.end))
      ) ?? null,
    [activePeriod, minutesNow]
  );
  const periodTimeLeft = activePeriod ? getTimeLeftParts(toMinutes(activePeriod.end) - minutesNow) : null;
  const segmentTimeLeft = currentSegment ? getTimeLeftParts(toMinutes(currentSegment.end) - minutesNow) : null;
  const nowFmt = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateFmt = now.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
  const segmentCardColor = currentSegment?.color ?? "#e5e7eb";
  const segmentCardTextColor = hexTextColor(currentSegment?.color);
  const pageBg = darkMode ? "#020617" : "#f8fafc";
  const pageText = darkMode ? "#f8fafc" : "text.primary";
  const secondaryText = darkMode ? "#cbd5e1" : "text.secondary";
  const surfaceBg = darkMode ? "#111827" : "#ffffff";
  const surfaceBorder = darkMode ? "rgba(148, 163, 184, 0.28)" : "divider";

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
  const saveDailyOverrides = (updated: DailyPeriodNameOverrides) => {
    setDailyOverrides(updated);
    saveJSON(LS_KEYS.DAILY_PERIOD_NAME_OVERRIDES, updated);
  };

  const setTodayPeriodNames = (names: string[]) => {
    if (!todaysScheduleName) return;

    const trimmed = names.map((name) => name.trim());
    const next: DailyPeriodNameOverrides = {
      ...dailyOverrides,
      [todayKey]: {
        ...(dailyOverrides[todayKey] ?? {}),
        [todaysScheduleName]: trimmed,
      },
    };

    saveDailyOverrides(next);
  };

  const setTodayPeriodName = (index: number, value: string) => {
    const next = [...todaysPeriodNameOverrides];
    next[index] = value;
    setTodayPeriodNames(next);
  };

  const clearTodayPeriodNames = () => {
    if (!todaysScheduleName) return;

    const dayOverrides = { ...(dailyOverrides[todayKey] ?? {}) };
    delete dayOverrides[todaysScheduleName];
    const next = { ...dailyOverrides };

    if (Object.keys(dayOverrides).length > 0) {
      next[todayKey] = dayOverrides;
    } else {
      delete next[todayKey];
    }

    saveDailyOverrides(next);
  };

  const exportSchedules = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      activeWeekName,
      daySchedules: lib,
      weekSchedules: weeks,
      dailyPeriodNameOverrides: dailyOverrides,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `pie-timer-schedules-${todayKey}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const loadSchedulesFile = async (file: File | null) => {
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!isRecord(parsed)) throw new Error("Invalid schedule file.");

      const importedLib = parsed.daySchedules ?? parsed.lib;
      const importedWeeks = parsed.weekSchedules ?? parsed.weeks;

      if (!isRecord(importedLib) || !isRecord(importedWeeks)) {
        throw new Error("Invalid schedule file.");
      }

      const nextLib = importedLib as DayScheduleLibrary;
      const nextWeeks = importedWeeks as WeekSchedulesStore;
      const activeFromFile = typeof parsed.activeWeekName === "string" ? parsed.activeWeekName : "";
      const nextActive = nextWeeks[activeFromFile] ? activeFromFile : Object.keys(nextWeeks)[0] ?? "";

      saveLib(nextLib);
      saveWeeks(nextWeeks, nextActive);

      if (isRecord(parsed.dailyPeriodNameOverrides)) {
        saveDailyOverrides(parsed.dailyPeriodNameOverrides as DailyPeriodNameOverrides);
      }

      setImportMessage("Schedules loaded.");
    } catch {
      setImportMessage("Could not load that schedule file.");
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
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: pageBg,
        color: pageText,
        px: { xs: 2, md: 3 },
        transition: "background-color 180ms ease, color 180ms ease",
      }}
    >
      <Box sx={{ position: "fixed", top: 16, right: 16, zIndex: 1200 }}>
        <Tooltip title="Schedule menu">
          <IconButton
            aria-label="open schedule menu"
            onClick={() => setMenuOpen(true)}
            sx={{
              bgcolor: surfaceBg,
              color: pageText,
              boxShadow: 2,
              border: "1px solid",
              borderColor: surfaceBorder,
              "&:hover": { bgcolor: surfaceBg },
            }}
          >
            <MenuIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Box
        component="main"
        sx={{
          minHeight: "100vh",
          maxWidth: 1360,
          mx: "auto",
          py: { xs: 8, md: 4 },
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 3,
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(170px, 0.65fr) minmax(320px, 1.3fr) minmax(220px, 0.8fr)" },
            alignItems: "center",
            gap: { xs: 4, md: 5 },
            width: "100%",
          }}
        >
          <Stack spacing={1} alignItems={{ xs: "center", md: "flex-end" }} textAlign={{ xs: "center", md: "right" }}>
            <Typography component="div" sx={{ fontSize: { xs: 30, md: 40 }, fontWeight: 700, lineHeight: 1.05 }}>
              {activePeriod?.name ?? "No active period"}
            </Typography>
            <TimeLeftDisplay value={periodTimeLeft} />
            <Typography variant="overline" sx={{ color: secondaryText }}>
              left
            </Typography>
          </Stack>

          <Stack spacing={2} alignItems="center" textAlign="center">
            <Box>
              <Typography component="div" sx={{ color: secondaryText, fontSize: { xs: 22, md: 30 }, fontWeight: 800, lineHeight: 1.05 }}>
                {weekdayName(now.getDay())}
              </Typography>
              <Typography component="div" sx={{ mt: 0.75, color: secondaryText, fontSize: { xs: 15, md: 18 }, fontWeight: 600 }}>
                {dateFmt}
              </Typography>
              <Typography component="div" sx={{ fontSize: { xs: 48, sm: 64, md: 80 }, fontWeight: 800, lineHeight: 1 }}>
                {nowFmt}
              </Typography>
            </Box>

            <PieTimer period={activePeriod ?? undefined} nowMinutes={minutesNow} />
          </Stack>

          <Stack spacing={1.25} alignItems={{ xs: "center", md: "flex-start" }} textAlign={{ xs: "center", md: "left" }}>
            <Typography component="div" sx={{ fontSize: { xs: 26, md: 34 }, fontWeight: 700, lineHeight: 1.1 }}>
              {currentSegment?.title ?? "No active segment"}
            </Typography>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, md: 2.5 },
                minWidth: { xs: 220, md: 260 },
                borderRadius: 2,
                bgcolor: segmentCardColor,
                color: segmentCardTextColor,
                border: currentSegment ? "none" : "1px solid",
                borderColor: "divider",
              }}
            >
              <TimeLeftDisplay
                value={segmentTimeLeft}
                align="center"
                mainSize={{ xs: 42, md: 54 }}
                secondsSize={{ xs: 22, md: 28 }}
              />
            </Paper>
          </Stack>
        </Box>
      </Box>

      <Box sx={{ maxWidth: 960, mx: "auto", pb: 4 }}>
        <Accordion
          disableGutters
          sx={{
            bgcolor: surfaceBg,
            color: pageText,
            border: "1px solid",
            borderColor: surfaceBorder,
            "&:before": { display: "none" },
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: pageText }} />}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0, sm: 1 }} alignItems={{ sm: "center" }}>
              <Typography variant="subtitle1">Today's Schedule</Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={1.5}>
              {todaysDisplaySchedule?.periods?.length ? (
                todaysDisplaySchedule.periods.map((period, index) => (
                  <Box key={`${period.start}-${period.end}-${index}`} sx={{ pb: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
                    <Typography variant="subtitle1">
                      {period.name} · {period.start} to {period.end}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 0.75 }}>
                      {period.segments.map((segment, segmentIndex) => (
                        <Chip
                          key={`${segment.start}-${segment.end}-${segmentIndex}`}
                          size="small"
                          label={`${segment.title}: ${segment.start}-${segment.end}`}
                          sx={{ background: segment.color }}
                        />
                      ))}
                    </Stack>
                  </Box>
                ))
              ) : (
                <Typography color="text.secondary">No periods defined for today's schedule.</Typography>
              )}
            </Stack>
          </AccordionDetails>
        </Accordion>
      </Box>

      <Drawer anchor="right" open={menuOpen} onClose={() => setMenuOpen(false)}>
        <Box sx={{ width: { xs: "100vw", sm: 460, md: 540 }, p: 2, minHeight: "100%", bgcolor: surfaceBg, color: pageText }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6">Schedule Menu</Typography>
            <IconButton aria-label="close schedule menu" onClick={() => setMenuOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>

          <Stack spacing={2.5}>
            <FormControlLabel
              control={<Switch checked={darkMode} onChange={(event) => setDarkMode(event.target.checked)} />}
              label="Dark mode"
            />

            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportSchedules}>
                Export
              </Button>
              <Button variant="outlined" component="label" startIcon={<UploadFileIcon />}>
                Load
                <input
                  hidden
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) => {
                    loadSchedulesFile(event.target.files?.[0] ?? null);
                    event.target.value = "";
                  }}
                />
              </Button>
            </Stack>
            {importMessage && <Alert severity={importMessage.startsWith("Could") ? "error" : "success"}>{importMessage}</Alert>}

            <Divider />

            <DailyPeriodNameOverridesPanel
              scheduleName={todaysScheduleName}
              periods={todaysSchedule?.periods ?? []}
              values={todaysPeriodNameOverrides}
              onSetName={setTodayPeriodName}
              onSetAll={setTodayPeriodNames}
              onClear={clearTodayPeriodNames}
            />

            <Divider />

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
          </Stack>
        </Box>
      </Drawer>

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
