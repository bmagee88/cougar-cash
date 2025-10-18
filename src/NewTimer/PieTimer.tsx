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
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CloseIcon from "@mui/icons-material/Close";

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
  name: string; // unique
  periods: Period[];
};

type WeekSchedule = {
  name: string; // unique
  mapping: Partial<Record<number, string>>; // 0..6 => schedule name ("" or undefined means None)
};

type PeriodTemplate = {
  name: string; // unique
  period: Period;
};

/* ------------------ LS keys + helpers ------------------ */

const LS_KEYS = {
  DAY_SCHEDULES: "scheduler:libraryDaySchedules",
  WEEK_SCHEDULES: "scheduler:weekSchedules",
  ACTIVE_WEEK_SCHEDULE: "scheduler:activeWeekSchedule",
  PERIOD_TEMPLATES: "scheduler:periodTemplates",
  // legacy (auto-migrated if present)
  LEGACY_DAY_SCHEDULES: "scheduler:daySchedules",
  LEGACY_ACTIVE_DAY_SELECTIONS: "scheduler:activeDaySelections",
} as const;

type DayScheduleLibrary = Record<string, DaySchedule>;
type WeekSchedulesStore = Record<string, WeekSchedule>;
type PeriodTemplatesStore = Record<string, PeriodTemplate>;

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

function makeDefaultPeriod(name = "Period 1"): Period {
  return {
    name,
    start: "10:00",
    end: "11:00",
    segments: [
      { title: "Seg 1", color: "#90caf9", start: "10:00", end: "10:20" },
      { title: "Seg 2", color: "#ffcc80", start: "10:20", end: "11:00" },
    ],
  };
}
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
  let templates = loadJSON<PeriodTemplatesStore>(LS_KEYS.PERIOD_TEMPLATES, {});
  const activeWeek = localStorage.getItem(LS_KEYS.ACTIVE_WEEK_SCHEDULE);

  // migrate legacy
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

  if (!activeWeek) localStorage.setItem(LS_KEYS.ACTIVE_WEEK_SCHEDULE, "DefaultWeek");

  if (Object.keys(templates).length === 0) {
    templates = {
      "Std 10-11": { name: "Std 10-11", period: makeDefaultPeriod("Std Period") },
    };
    saveJSON(LS_KEYS.PERIOD_TEMPLATES, templates);
  }

  localStorage.removeItem(LS_KEYS.LEGACY_ACTIVE_DAY_SELECTIONS);
}

/* ------------------ Confirm dialog ------------------ */

function ConfirmDialog({
  open,
  message,
  onCancel,
  onConfirm,
  confirmText = "Delete",
  danger = true,
}: {
  open: boolean;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmText?: string;
  danger?: boolean;
}) {
  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>Confirm</DialogTitle>
      <DialogContent>
        <Typography sx={{ mt: 1 }}>{message}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button onClick={onConfirm} variant="contained" color={danger ? "error" : "primary"}>
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
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

  const singleSeg = period.segments.length === 1 ? period.segments[0] : null;

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
        <circle cx={cx} cy={cy} r={r} fill={singleSeg ? singleSeg.color : "#f5f5f5"} stroke="#ccc" strokeWidth={1} />
        {!singleSeg && segArcs}
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

/* ------------------ Saved Periods Manager ------------------ */

function PeriodTemplatesModal({
  open,
  onClose,
  templates,
  onSaveTemplates,
}: {
  open: boolean;
  onClose: () => void;
  templates: PeriodTemplatesStore;
  onSaveTemplates: (t: PeriodTemplatesStore) => void;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const [working, setWorking] = useState<PeriodTemplatesStore>({});
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    if (open) {
      setWorking(structuredClone(templates));
      setSelected(Object.keys(templates)[0] || "");
    }
  }, [open, templates]);

  const current = selected ? working[selected] : undefined;

  const addTemplate = () => {
    const base = "New Template";
    let name = base;
    let i = 1;
    while (working[name]) name = `${base} ${i++}`;
    const copy = { ...working, [name]: { name, period: makeDefaultPeriod(name) } };
    setWorking(copy);
    setSelected(name);
  };
  const deleteTemplate = (name: string) => {
    const copy = { ...working };
    delete copy[name];
    setWorking(copy);
    const next = Object.keys(copy)[0] || "";
    setSelected(next);
  };
  const renameTemplate = (newName: string) => {
    const old = selected;
    const trimmed = newName.trim();
    if (!old || !trimmed || working[trimmed]) return;
    const copy = { ...working };
    copy[trimmed] = { ...copy[old], name: trimmed };
    delete copy[old];
    setWorking(copy);
    setSelected(trimmed);
  };

  const setPeriodField = (field: keyof Period, value: string) => {
    if (!current) return;
    setWorking((w) => ({
      ...w,
      [current.name]: { ...current, period: { ...current.period, [field]: value } },
    }));
  };
  const setSegmentField = (sIdx: number, field: keyof Segment, value: string) => {
    if (!current) return;
    const p = current.period;
    const segs = p.segments.map((s, i) => (i === sIdx ? { ...s, [field]: value } : s));
    setWorking((w) => ({
      ...w,
      [current.name]: { ...current, period: { ...p, segments: segs } },
    }));
  };
  const addSegment = () => {
    if (!current) return;
    const p = current.period;
    const lastEnd = p.segments[p.segments.length - 1]?.end ?? p.start;
    const proposedEnd = fromMinutes(Math.min(toMinutes(p.end), toMinutes(lastEnd) + 10));
    const seg: Segment = { title: `Seg ${p.segments.length + 1}`, color: "#c5e1a5", start: lastEnd, end: proposedEnd };
    setWorking((w) => ({
      ...w,
      [current.name]: { ...current, period: { ...p, segments: [...p.segments, seg] } },
    }));
  };
  const removeSegment = (sIdx: number) => {
    if (!current) return;
    const p = current.period;
    setWorking((w) => ({
      ...w,
      [current.name]: { ...current, period: { ...p, segments: p.segments.filter((_, i) => i !== sIdx) } },
    }));
  };

  const handleSave = () => {
    onSaveTemplates(working);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" fullScreen={fullScreen}>
      <DialogTitle>Saved Periods</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <FormControl fullWidth>
              <InputLabel id="tpl-select">Template</InputLabel>
              <Select
                labelId="tpl-select"
                label="Template"
                value={selected || ""}
                onChange={(e) => setSelected(String(e.target.value))}
              >
                {Object.keys(working).map((n) => (
                  <MenuItem key={n} value={n}>
                    {n}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Rename"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              onBlur={(e) => renameTemplate(e.target.value)}
            />
            <Tooltip title="New template">
              <IconButton onClick={addTemplate}>
                <AddIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete template">
              <span>
                <IconButton
                  color="error"
                  disabled={!selected}
                  onClick={() => selected && deleteTemplate(selected)}
                >
                  <DeleteOutlineIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>

          {!current ? (
            <Alert severity="info">Create a template to edit.</Alert>
          ) : (
            <>
              <Divider textAlign="left">Period</Divider>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField
                  fullWidth
                  label="Name"
                  value={current.period.name}
                  onChange={(e) => setPeriodField("name", e.target.value)}
                />
                <TextField
                  label="Start (HH:MM)"
                  value={current.period.start}
                  onChange={(e) => setPeriodField("start", e.target.value as HHMM)}
                  sx={{ width: { xs: "100%", sm: 160 } }}
                />
                <TextField
                  label="End (HH:MM)"
                  value={current.period.end}
                  onChange={(e) => setPeriodField("end", e.target.value as HHMM)}
                  sx={{ width: { xs: "100%", sm: 160 } }}
                />
              </Stack>

              <Stack spacing={1} sx={{ mt: 1 }}>
                {current.period.segments.map((s, i) => (
                  <Stack key={i} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                    <TextField
                      label="Title"
                      value={s.title}
                      onChange={(e) => setSegmentField(i, "title", e.target.value)}
                      sx={{ minWidth: 160, flex: 1 }}
                    />
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <input
                        type="color"
                        value={s.color}
                        onChange={(e) => setSegmentField(i, "color", e.target.value)}
                        style={{ width: 40, height: 40, border: "none", background: "transparent" }}
                        aria-label="Segment color"
                      />
                      <TextField
                        label="Color (hex)"
                        value={s.color}
                        onChange={(e) => setSegmentField(i, "color", e.target.value)}
                        sx={{ width: 140 }}
                      />
                    </Box>
                    <TextField
                      label="Start"
                      value={s.start}
                      onChange={(e) => setSegmentField(i, "start", e.target.value as HHMM)}
                      sx={{ width: 120 }}
                    />
                    <TextField
                      label="End"
                      value={s.end}
                      onChange={(e) => setSegmentField(i, "end", e.target.value as HHMM)}
                      sx={{ width: 120 }}
                    />
                    <Tooltip title="Delete segment">
                      <IconButton color="error" size="small" onClick={() => removeSegment(i)}>
                        <DeleteOutlineIcon />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                ))}
              </Stack>

              <Button onClick={addSegment} startIcon={<AddIcon />} sx={{ mt: 1 }}>
                Add Segment
              </Button>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ------------------ Library Editor (existing schedules) ------------------ */
/*  - Controlled fields, Save/Cancel with discard confirm (kept from your last version)
    - Insert Saved Period into current schedule
    - Keeps stable order during rename/add/delete while open
*/
function LibraryEditor({
  open,
  onClose,
  lib,
  selectedName,
  onSaveLib,
  onDeleteSchedule,
  onManageTemplates,
  templates,
}: {
  open: boolean;
  onClose: () => void;
  lib: DayScheduleLibrary;
  selectedName?: string;
  onSaveLib: (updated: DayScheduleLibrary) => void;
  onDeleteSchedule: (name: string) => void;
  onManageTemplates: () => void;
  templates: PeriodTemplatesStore;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const [selected, setSelected] = useState<string>("");
  const [working, setWorking] = useState<DayScheduleLibrary>({});
  const [order, setOrder] = useState<string[]>([]);
  const [isDirty, setDirty] = useState(false);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
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

  useEffect(() => {
    if (!open) return;
    const clone = structuredClone(lib);
    setWorking(clone);
    const keys = Object.keys(lib);
    setOrder(keys);
    const initial =
      (selectedName && lib[selectedName] && selectedName) || keys[0] || "";
    setSelected(initial);
    setDirty(false);
  }, [open]); // only when opened

  useEffect(() => {
    if (!open) return;
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

  const mark = <T,>(updater: (prev: T) => T) =>
    (prev: T) => {
      setDirty(true);
      return updater(prev);
    };

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
    setWorking(mark((w) => {
      const copy = { ...w };
      delete copy[name];
      return copy;
    }));
    setOrder((prev) => prev.filter((n) => n !== name));
    setSelected((prevSel) => {
      if (prevSel !== name) return prevSel;
      const nextOrder = order.filter((n) => n !== name);
      if (nextOrder[0] && working[nextOrder[0]]) return nextOrder[0];
      const keys = Object.keys(working).filter((k) => k !== name);
      return keys[0] || "";
    });
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

    setOrder((prev) => {
      const idx = prev.indexOf(oldName);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = newName;
      return next;
    });

    setWorking(mark((w) => {
      const copy = { ...w };
      copy[newName] = { ...copy[oldName], name: newName };
      delete copy[oldName];
      return copy;
    }));

    setSelected(newName);
  };

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
      const newP = makeDefaultPeriod(`Period ${sched.periods.length + 1}`);
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

  // Insert a Saved Period template into current schedule
  const [tplChoice, setTplChoice] = useState<string>("");
  const insertTemplate = () => {
    if (!current || !tplChoice || !templates[tplChoice]) return;
    const tpl = templates[tplChoice].period;
    const clone: Period = JSON.parse(JSON.stringify(tpl));
    const cname = current.name;
    setWorking(mark((w) => {
      const sched = w[cname];
      return { ...w, [cname]: { ...sched, periods: [...sched.periods, clone] } };
    }));
  };

  const handleSave = () => {
    const beforeKeys = Object.keys(lib);
    const afterSet = new Set(Object.keys(working));
    const deleted = beforeKeys.filter((k) => !afterSet.has(k));
    deleted.forEach((name) => onDeleteSchedule(name));

    onSaveLib(working);
    setDirty(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={requestClose}
      fullWidth
      maxWidth="md"
      fullScreen={fullScreen}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        Edit Day Schedules
        <IconButton onClick={requestClose} size="small" aria-label="Cancel">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          {/* Top controls */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
            <FormControl sx={{ minWidth: 240 }} fullWidth>
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

          {/* Insert Saved Period row */}
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <FormControl sx={{ minWidth: 220 }} fullWidth>
                <InputLabel id="tpl-choose">Saved period</InputLabel>
                <Select
                  labelId="tpl-choose"
                  label="Saved period"
                  value={tplChoice}
                  onChange={(e) => setTplChoice(String(e.target.value))}
                >
                  {Object.keys(templates).length ? (
                    Object.keys(templates).map((n) => (
                      <MenuItem key={n} value={n}>
                        {n}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem value="" disabled>
                      No saved periods
                    </MenuItem>
                  )}
                </Select>
              </FormControl>
              <Button variant="contained" onClick={insertTemplate} disabled={!tplChoice || !current}>
                Insert into schedule
              </Button>
              <Button variant="outlined" onClick={onManageTemplates}>
                Manage Saved Periods
              </Button>
            </Stack>
          </Paper>

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
                        sx={{ minWidth: 180, flex: 1 }}
                      />
                      <TextField
                        label="Start (HH:MM)"
                        value={p.start}
                        onChange={(e) => setPeriodField(pIdx, "start", e.target.value as HHMM)}
                        sx={{ width: { xs: "100%", sm: 140 } }}
                      />
                      <TextField
                        label="End (HH:MM)"
                        value={p.end}
                        onChange={(e) => setPeriodField(pIdx, "end", e.target.value as HHMM)}
                        sx={{ width: { xs: "100%", sm: 140 } }}
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
                            sx={{ minWidth: 160, flex: 1 }}
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
          <Typography sx={{ mt: 1 }}>You have unsaved changes. Discard them?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDiscardOpen(false)}>Keep editing</Button>
          <Button variant="contained" color="error" onClick={confirmDiscard}>
            Discard
          </Button>
        </DialogActions>
      </Dialog>

      <DialogActions sx={{ p: 2 }}>
        <Button fullWidth={fullScreen} variant="contained" onClick={handleSave}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ------------------ Add Day Schedule Modal (focused creator) ------------------ */

function AddScheduleModal({
  open,
  onClose,
  onCreate,
  onManageTemplates,
  templates,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (schedule: DaySchedule) => void;
  onManageTemplates: () => void;
  templates: PeriodTemplatesStore;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const [schedule, setSchedule] = useState<DaySchedule>(() => makeDefaultSchedule("NewSchedule"));
  const [tplChoice, setTplChoice] = useState<string>("");

  useEffect(() => {
    if (open) {
      setSchedule(makeDefaultSchedule("NewSchedule"));
      setTplChoice("");
    }
  }, [open]);

  const setName = (name: string) => setSchedule((s) => ({ ...s, name }));
  const setPeriodField = (idx: number, field: keyof Period, value: string) =>
    setSchedule((s) => ({
      ...s,
      periods: s.periods.map((p, i) => (i === idx ? { ...p, [field]: value } : p)),
    }));
  const addPeriod = () =>
    setSchedule((s) => ({ ...s, periods: [...s.periods, makeDefaultPeriod(`Period ${s.periods.length + 1}`)] }));
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

  const insertTemplate = () => {
    if (!tplChoice || !templates[tplChoice]) return;
    const tpl = templates[tplChoice].period;
    const clone: Period = JSON.parse(JSON.stringify(tpl));
    setSchedule((s) => ({ ...s, periods: [...s.periods, clone] }));
  };

  const handleCreate = () => {
    const trimmed = schedule.name.trim() || "NewSchedule";
    onCreate({ ...schedule, name: trimmed });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" fullScreen={fullScreen}>
      <DialogTitle>Add Day Schedule</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField label="Schedule name" value={schedule.name} onChange={(e) => setName(e.target.value)} fullWidth />

          {/* Insert Saved Period */}
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <FormControl sx={{ minWidth: 220 }} fullWidth>
                <InputLabel id="add-tpl-choose">Saved period</InputLabel>
                <Select
                  labelId="add-tpl-choose"
                  label="Saved period"
                  value={tplChoice}
                  onChange={(e) => setTplChoice(String(e.target.value))}
                >
                  {Object.keys(templates).length ? (
                    Object.keys(templates).map((n) => (
                      <MenuItem key={n} value={n}>
                        {n}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem value="" disabled>
                      No saved periods
                    </MenuItem>
                  )}
                </Select>
              </FormControl>
              <Button variant="contained" onClick={insertTemplate} disabled={!tplChoice}>
                Insert into schedule
              </Button>
              <Button variant="outlined" onClick={onManageTemplates}>
                Manage Saved Periods
              </Button>
            </Stack>
          </Paper>

          <Divider textAlign="left">Periods</Divider>
          <Stack spacing={2}>
            {schedule.periods.map((p, pIdx) => (
              <Paper key={pIdx} variant="outlined" sx={{ p: 2 }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                  <TextField
                    label="Period Name"
                    value={p.name}
                    onChange={(e) => setPeriodField(pIdx, "name", e.target.value)}
                    sx={{ minWidth: 180, flex: 1 }}
                  />
                  <TextField
                    label="Start (HH:MM)"
                    value={p.start}
                    onChange={(e) => setPeriodField(pIdx, "start", e.target.value as HHMM)}
                    sx={{ width: { xs: "100%", sm: 140 } }}
                  />
                  <TextField
                    label="End (HH:MM)"
                    value={p.end}
                    onChange={(e) => setPeriodField(pIdx, "end", e.target.value as HHMM)}
                    sx={{ width: { xs: "100%", sm: 140 } }}
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
                        sx={{ minWidth: 160, flex: 1 }}
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
  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down("sm"));

  const activeWeek = weekStore[activeWeekName];
  const libNames = Object.keys(lib);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(activeWeekName);
  useEffect(() => setRenameValue(activeWeekName), [activeWeekName]);

  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Typography variant="subtitle1" gutterBottom>
        Week Mapping
      </Typography>

      {/* Top row: week select + rename + add week + delete */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} sx={{ mb: 1 }}>
        <FormControl sx={{ minWidth: 220, flex: 1 }} fullWidth={isSm}>
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

        <Stack direction="row" spacing={0.5}>
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
      </Stack>

      {/* Second row: Add Day Schedule (new modal), Edit Library (existing schedules) */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} sx={{ mb: 2 }}>
        <Button fullWidth={isSm} variant="contained" onClick={onOpenAddSchedule} startIcon={<AddIcon />}>
          Add Day Schedule
        </Button>
        <Button fullWidth={isSm} variant="outlined" onClick={onOpenLibrary}>
          Edit Day Schedules
        </Button>
      </Stack>

      {/* Mapping table, with "None" option */}
      <Stack spacing={1.25}>
        {Array.from({ length: 7 }, (_, d) => {
          const dayLabel = weekdayName(d);
          const mapped = activeWeek?.mapping?.[d] ?? "";
          return (
            <Stack key={d} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <Box sx={{ minWidth: 100 }}>
                <Typography>{dayLabel}</Typography>
              </Box>
              <FormControl sx={{ minWidth: 200, flex: 1 }} fullWidth={isSm}>
                <InputLabel id={`day-row-${d}`}>Day schedule</InputLabel>
                <Select
                  labelId={`day-row-${d}`}
                  label="Day schedule"
                  value={mapped || ""}
                  onChange={(e) => onAssign(activeWeekName, d, String(e.target.value))}
                >
                  <MenuItem value="">None</MenuItem>
                  {libNames.map((n) => (
                    <MenuItem key={n} value={n}>
                      {n}
                    </MenuItem>
                  ))}
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
  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down("sm"));

  // Live clock (rerender each second)
  const [, setTimeTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTimeTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Core state + LS
  const [lib, setLib] = useState<DayScheduleLibrary>({});
  const [weeks, setWeeks] = useState<WeekSchedulesStore>({});
  const [activeWeekName, setActiveWeekName] = useState<string>("DefaultWeek");
  const [templates, setTemplates] = useState<PeriodTemplatesStore>({});

  // seed + load
  useEffect(() => {
    seedIfEmpty();
    setLib(loadJSON(LS_KEYS.DAY_SCHEDULES, {}));
    setWeeks(loadJSON(LS_KEYS.WEEK_SCHEDULES, {}));
    setTemplates(loadJSON(LS_KEYS.PERIOD_TEMPLATES, {}));
    setActiveWeekName(localStorage.getItem(LS_KEYS.ACTIVE_WEEK_SCHEDULE) ?? "DefaultWeek");
  }, []);

  // Today
  const now = new Date();
  const todayWeekday = now.getDay();
  const activeWeek = weeks[activeWeekName];
  const todaysScheduleName = activeWeek?.mapping?.[todayWeekday] || "";
  const todaysSchedule = todaysScheduleName ? lib[todaysScheduleName] : undefined;

  // Active period
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
  const saveTemplates = (updated: PeriodTemplatesStore) => {
    setTemplates(updated);
    saveJSON(LS_KEYS.PERIOD_TEMPLATES, updated);
  };

  /* ---------- Week actions ---------- */

  const updateActiveWeekName = (newName: string) => {
    setActiveWeekName(newName);
    localStorage.setItem(LS_KEYS.ACTIVE_WEEK_SCHEDULE, newName);
  };
  const assignWeekScheduleToDay = (weekName: string, wd: number, dayName: string) => {
    const ws = { ...weeks };
    const wk = { ...(ws[weekName] ?? { name: weekName, mapping: {} }) };
    // interpret empty string as None (delete mapping key)
    if (!dayName) {
      const nm = { ...wk.mapping };
      delete nm[wd];
      wk.mapping = nm;
    } else {
      wk.mapping = { ...wk.mapping, [wd]: dayName };
    }
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

  /* ---------- Modals ---------- */

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2 }, maxWidth: 1200, mx: "auto" }}>
      <Typography variant={isSm ? "h6" : "h5"} gutterBottom>
        Daily Schedule & Pie Timer
      </Typography>

      {/* Main content */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mt: 1 }}>
        {/* Left */}
        <Box sx={{ flex: 1 }}>
          <Typography variant="overline">Now</Typography>
          <Typography variant={isSm ? "h4" : "h3"}>{nowFmt}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {weekdayName(now.getDay())} · {activeWeek?.mapping?.[now.getDay()] || "(no schedule set)"}
          </Typography>

          <Box sx={{ mt: 2, display: "flex", justifyContent: { xs: "center", md: "flex-start" } }}>
            <PieTimer period={activePeriod ?? undefined} nowMinutes={minutesNow} />
          </Box>

          <Box sx={{ mt: 2 }}>
            <Typography variant="overline">Today’s Periods</Typography>
            <Stack spacing={1} sx={{ mt: 1 }}>
              {todaysSchedule?.periods?.length ? (
                todaysSchedule.periods.map((p, i) => (
                  <Paper key={i} variant="outlined" sx={{ p: { xs: 1, sm: 1.5 } }}>
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

        {/* Right */}
        <Box sx={{ width: { md: 480 }, flexShrink: 0 }}>
          <WeekPanel
            weekStore={weeks}
            lib={lib}
            activeWeekName={activeWeekName}
            onChangeActiveWeek={updateActiveWeekName}
            onAssign={assignWeekScheduleToDay}
            onOpenAddSchedule={() => setAddOpen(true)}
            onOpenLibrary={() => setLibraryOpen(true)}
            onRenameWeek={renameActiveWeek}
            onDeleteWeek={deleteActiveWeek}
            onAddWeek={createWeekSchedule}
          />

          {/* Quick access to Saved Periods */}
          <Box sx={{ mt: 2, textAlign: "right" }}>
            <Button size="small" variant="outlined" onClick={() => setTplOpen(true)}>
              Manage Saved Periods
            </Button>
          </Box>
        </Box>
      </Stack>

      {/* Modals */}
      <AddScheduleModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreate={(sched) => {
          let name = sched.name.trim() || "NewSchedule";
          let i = 1;
          while (lib[name]) name = `${sched.name}-${i++}`;
          const updated = { ...lib, [name]: { ...sched, name } };
          saveLib(updated);
        }}
        onManageTemplates={() => setTplOpen(true)}
        templates={templates}
      />

      <LibraryEditor
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        lib={lib}
        selectedName={undefined}
        onSaveLib={saveLib}
        onDeleteSchedule={(name) => {
          // scrub week mappings that use this schedule
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
        }}
        onManageTemplates={() => setTplOpen(true)}
        templates={templates}
      />

      <PeriodTemplatesModal
        open={tplOpen}
        onClose={() => setTplOpen(false)}
        templates={templates}
        onSaveTemplates={saveTemplates}
      />
    </Box>
  );
}
