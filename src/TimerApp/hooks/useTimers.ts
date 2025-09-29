import * as React from "react";
import { HHMM, Segment, Timer } from "../types/timer";
import {
  clampTime,
  midpointTime,
  relMinutes,
  relToHHMM,
  toHHMM,
  uid,
} from "../utils/time";

const STORAGE_KEY = "timers";


const defaultTimer = (): Timer => {
  const start: HHMM = "09:00";
  const end: HHMM = "12:00";
  return {
    id: uid("timer"),
    name: "Timer",
    start,
    end,
    segments: [{ id: uid("seg"), title: "Segment 1", color: "#1976d2", end }],
  };
};

export function useTimers() {
const [timers, setTimers] = React.useState<Timer[]>(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as Timer[];
    }
  } catch (e) {
    console.warn("Failed to load timers from localStorage", e);
  }
  return [];
});

React.useEffect(() => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
  } catch (e) {
    console.warn("Failed to save timers to localStorage", e);
  }
}, [timers]);

  const [editingTimerId, setEditingTimerId] = React.useState<string | null>(
    null
  );

  const updateTimer = (timerId: string, updater: (t: Timer) => Timer) => {
    setTimers((prev) =>
      prev.map((t) => (t.id === timerId ? updater({ ...t }) : t))
    );
  };

  const addTimer = () => setTimers((prev) => [...prev, defaultTimer()]);
  const removeTimer = (timerId: string) =>
    setTimers((prev) => prev.filter((t) => t.id !== timerId));

  const setTimerName = (timerId: string, name: string) => {
    updateTimer(timerId, (t) => ({ ...t, name }));
  };

  const addSegment = (timerId: string) => {
    updateTimer(timerId, (t) => {
      const segments = [...t.segments];
      const lastEnd = t.end;
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

function removeSegment(timerId: string, segId: string) {
  setTimers((timers) =>
    timers.map((t) => {
      if (t.id !== timerId) return t;

      const idx = t.segments.findIndex((s) => s.id === segId);
      if (idx === -1) return t;

      const removedWasLast = idx === t.segments.length - 1;
      const segments = t.segments.filter((s) => s.id !== segId);

      // If we deleted the last segment, set the timer's end to the new last segment's end.
      // This keeps the previous segment at 1:00 PM and moves the timer's End to 1:00 PM too.
      if (removedWasLast && segments.length > 0) {
        const newLastEnd = segments[segments.length - 1].end;
        return { ...t, segments, end: newLastEnd };
      }

      // Otherwise leave timer.end as-is.
      return { ...t, segments };
    })
  );
}


  const setStart = (timerId: string, value: HHMM) => {
    const v = clampTime(value);
    updateTimer(timerId, (t) => {
      const segments = [...t.segments];
      const firstEnd = segments[0].end;
      if (relMinutes(t.start, v) >= relMinutes(t.start, firstEnd)) {
        segments[0] = {
          ...segments[0],
          end: relToHHMM(
            t.start,
            Math.min(relMinutes(t.start, v) + 15, relMinutes(t.start, t.end))
          ),
        };
      }
      return { ...t, start: v, segments };
    });
  };

  const setEnd = (timerId: string, value: HHMM) => {
    const v = clampTime(value);
    updateTimer(timerId, (t) => {
      const segments = [...t.segments];
      const lastSegIdx = segments.length - 1;
      const lastSegStart =
        lastSegIdx > 0 ? segments[lastSegIdx - 1].end : t.start;
      const endRel = Math.max(
        relMinutes(t.start, v),
        relMinutes(t.start, lastSegStart) + 1
      );
      const endH = relToHHMM(t.start, endRel);
      segments[lastSegIdx] = { ...segments[lastSegIdx], end: endH };
      return { ...t, end: endH, segments };
    });
  };

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
        let cm = relMinutes(t.start, clampTime(value as HHMM));
        cm = Math.max(cm, relMinutes(t.start, segStart) + 1);
        if (idx < segments.length - 1) {
          const nextEnd = segments[idx + 1].end;
          cm = Math.min(cm, relMinutes(t.start, nextEnd) - 1);
        }
        const hhmm = toHHMM(cm);
        seg.end = hhmm;
        // if (idx === segments.length - 1) t.end = hhmm; // sync timer end for last
        segments[idx] = seg;
        return { ...t, segments };
      }

      if (field === "title") seg.title = value;
      if (field === "color") seg.color = value;
      segments[idx] = seg;
      return { ...t, segments };
    });
  };

  const openEditor = (id: string) => {
    setEditingTimerId(id);
  };
  const closeEditor = () => setEditingTimerId(null);

  const editingTimer = React.useMemo(
    () => timers.find((x) => x.id === editingTimerId) || null,
    [timers, editingTimerId]
  );

  return {
    timers,
    editingTimer,
    editingTimerId,
    addTimer,
    removeTimer,
    updateTimer,
    setTimerName,
    addSegment,
    removeSegment,
    setStart,
    setEnd,
    setSegmentField,
    openEditor,
    closeEditor,
  };
}
