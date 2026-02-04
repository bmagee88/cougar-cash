// src/mock/mockBackend.ts
export type Role = "student" | "teacher" | "admin";
export type Gender = "M" | "F";

export type User = {
  uid: string;
  role: Role;
  displayName: string;
  photoURL?: string;
  // Student fields
  lunchNumber?: string;
  classId?: string;      // the teacher/classroom this student belongs to
  groupId?: string;      // bathroom group (e.g., A+B, C+D...)
  gender?: Gender;
};

export type RequestType = "bathroom" | "water" | "nurse" | "office" | "counselor";

export type BathroomRequest = {
  requestId: string;
  uid: string;
  displayName: string;
  lunchNumber: string;
  classId: string;
  groupId: string;
  gender: Gender;
  createdAt: number; // ts
};

export type ActiveOut = {
  uid: string;
  displayName: string;
  lunchNumber: string;
  classId: string;
  groupId: string;
  gender: Gender;
  calledAt: number;         // when teacher/system called them
  dueBy: number;            // calledAt + 3 mins
  returnedAt?: number;      // when they clock back in
  status: "out" | "returned" | "late";
};

export type LogEntry = {
  id: string;
  ts: number;
  kind:
    | "request_created"
    | "request_blocked"
    | "request_called"
    | "student_returned"
    | "late_return_flagged"
    | "period_cleared"
    | "teacher_falsified_return"
    | "freeze_on"
    | "freeze_off";
  details: any;
};

type TimeRange = { start: string; end: string }; // "HH:MM" 24-hr local time

// -------------------------
// MOCK DATABASE (in-memory)
// -------------------------
export const mockDB = {
  // demo class/teacher
  classes: {
    "class-101": { id: "class-101", name: "Room 101", teacherUid: "t-1" },
    "class-102": { id: "class-102", name: "Room 102", teacherUid: "t-2" },
  },

  // groups of rooms (each group has its own queue + capacity of 1M/1F out)
  groups: {
    "group-ab": { id: "group-ab", name: "Group A+B", classIds: ["class-101", "class-102"] },
  },

  // time windows where NO requests allowed
  blockedTimes: [
    { start: "10:15", end: "10:25" }, // e.g. passing period
    { start: "12:00", end: "12:30" }, // lunch block
  ] as TimeRange[],

  // periods (queues clear at each boundary)
  periods: [
    { name: "P1", start: "08:00", end: "08:45" },
    { name: "P2", start: "08:50", end: "09:35" },
    { name: "P3", start: "09:40", end: "10:25" },
    { name: "P4", start: "10:30", end: "11:15" },
    { name: "P5", start: "11:20", end: "12:05" },
    { name: "P6", start: "12:10", end: "12:55" },
    { name: "P7", start: "13:00", end: "13:45" },
  ],

  // freeze state per class (teacher can freeze bathroom selection from their class)
  freezeByClass: {
    "class-101": false,
    "class-102": false,
  } as Record<string, boolean>,

  // if a student was skipped due to freeze, they get priority once unfrozen
  frozenPriorityByClass: {
    "class-101": [] as string[], // queue of requestIds
    "class-102": [] as string[],
  },

  // per-group queues
  bathroomQueueByGroup: {
    "group-ab": [] as BathroomRequest[],
  } as Record<string, BathroomRequest[]>,

  // active “out” per group & gender
  activeOutByGroup: {
    "group-ab": {
      M: null as ActiveOut | null,
      F: null as ActiveOut | null,
    },
  } as Record<string, Record<Gender, ActiveOut | null>>,

  // code26 late return queue (can include multiple students across groups simultaneously)
  code26Queue: [] as ActiveOut[],

  // logs
  logs: [] as LogEntry[],

  // per-class clock-in feed (top = most recent)
  clockInsByClass: {
    "class-101": [] as ActiveOut[],
    "class-102": [] as ActiveOut[],
  } as Record<string, ActiveOut[]>,
};

// -------------------------
// Helpers
// -------------------------
function nowTs() {
  return Date.now();
}
function id(prefix: string) {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`;
}
function toHHMM(d = new Date()) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
function hhmmToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function isInRange(hhmm: string, r: TimeRange) {
  const t = hhmmToMinutes(hhmm);
  const a = hhmmToMinutes(r.start);
  const b = hhmmToMinutes(r.end);
  return t >= a && t < b;
}
function getCurrentPeriodName(hhmm: string) {
  const t = hhmmToMinutes(hhmm);
  for (const p of mockDB.periods) {
    const a = hhmmToMinutes(p.start);
    const b = hhmmToMinutes(p.end);
    if (t >= a && t < b) return p.name;
  }
  return "OFF";
}
function addLog(kind: LogEntry["kind"], details: any) {
  mockDB.logs.unshift({ id: id("log"), ts: nowTs(), kind, details });
}

function isBlockedNow() {
  const hhmm = toHHMM();
  return mockDB.blockedTimes.some((r) => isInRange(hhmm, r));
}

function clearQueuesIfPeriodEnded() {
  // Simple approach: if current period name changes, clear all queues.
  // We store lastPeriod in module state.
  const hhmm = toHHMM();
  const current = getCurrentPeriodName(hhmm);
  if ((clearQueuesIfPeriodEnded as any).lastPeriod === undefined) {
    (clearQueuesIfPeriodEnded as any).lastPeriod = current;
    return;
  }
  const last = (clearQueuesIfPeriodEnded as any).lastPeriod;
  if (current !== last) {
    // clear queues & frozen priorities
    Object.keys(mockDB.bathroomQueueByGroup).forEach((g) => (mockDB.bathroomQueueByGroup[g] = []));
    Object.keys(mockDB.frozenPriorityByClass).forEach((c) => (mockDB.frozenPriorityByClass[c] = []));
    addLog("period_cleared", { from: last, to: current, ts: nowTs() });
    (clearQueuesIfPeriodEnded as any).lastPeriod = current;
  }
}

// -------------------------
// “Backend API”
// -------------------------
export const backend = {
  tickHousekeeping() {
    clearQueuesIfPeriodEnded();

    // late return detection (flag students across different groups at same time)
    const ts = nowTs();
    for (const groupId of Object.keys(mockDB.activeOutByGroup)) {
      (["M", "F"] as Gender[]).forEach((gender) => {
        const active = mockDB.activeOutByGroup[groupId][gender];
        if (active && active.status === "out" && ts > active.dueBy) {
          // flag late
          const late: ActiveOut = { ...active, status: "late" };
          mockDB.activeOutByGroup[groupId][gender] = late;
          mockDB.code26Queue.unshift(late);
          addLog("late_return_flagged", { groupId, gender, late });
        }
      });
    }
  },

  getSnapshot() {
    // return a shallow snapshot for UI rendering
    return {
      ...mockDB,
      currentHHMM: toHHMM(),
      currentPeriod: getCurrentPeriodName(toHHMM()),
      blockedNow: isBlockedNow(),
    };
  },

  setFreeze(classId: string, freeze: boolean) {
    mockDB.freezeByClass[classId] = freeze;
    addLog(freeze ? "freeze_on" : "freeze_off", { classId, freeze });
  },

 createBathroomRequest(user: User) {
  this.tickHousekeeping();

  if (!user.lunchNumber || !user.classId || !user.groupId || !user.gender) {
    throw new Error("Missing student fields.");
  }

  // ✅ RULE: Student can only be pending once (queue OR out OR late OR frozen-priority)
  const uid = user.uid;
  const groupId = user.groupId;

  // 1) already in queue (any position)
  const inQueue = (mockDB.bathroomQueueByGroup[groupId] || []).some((r) => r.uid === uid);
  if (inQueue) {
    addLog("request_blocked", { uid, reason: "already_in_queue", groupId });
    return { ok: false as const, reason: "already_in_queue" as const };
  }

  // 2) already out (either slot) OR late in activeOutByGroup
  const outSlots = mockDB.activeOutByGroup[groupId];
  const isOutOrLate =
    (outSlots?.M?.uid === uid && (outSlots.M.status === "out" || outSlots.M.status === "late")) ||
    (outSlots?.F?.uid === uid && (outSlots.F.status === "out" || outSlots.F.status === "late"));

  if (isOutOrLate) {
    addLog("request_blocked", { uid, reason: "already_out_or_late", groupId });
    return { ok: false as const, reason: "already_out_or_late" as const };
  }

  // 3) already in Code26 queue
  const inCode26 = mockDB.code26Queue.some((x) => x.uid === uid && x.status === "late");
  if (inCode26) {
    addLog("request_blocked", { uid, reason: "in_code26", groupId });
    return { ok: false as const, reason: "in_code26" as const };
  }

  // 4) already parked in frozen priority (skipped by freeze, but still pending)
  const frozenList = mockDB.frozenPriorityByClass[user.classId] || [];
  const isInFrozenPriority = frozenList.some((requestId) => {
    const req = (mockDB.bathroomQueueByGroup[groupId] || []).find((q) => q.requestId === requestId);
    return req?.uid === uid;
  });
  if (isInFrozenPriority) {
    addLog("request_blocked", { uid, reason: "already_pending_frozen", groupId });
    return { ok: false as const, reason: "already_pending_frozen" as const };
  }

  // existing blocked-time rule
  if (isBlockedNow()) {
    addLog("request_blocked", { uid, reason: "blocked_time" });
    return { ok: false as const, reason: "blocked_time" as const };
  }

  const req: BathroomRequest = {
    requestId: id("req"),
    uid: user.uid,
    displayName: user.displayName,
    lunchNumber: user.lunchNumber,
    classId: user.classId,
    groupId: user.groupId,
    gender: user.gender,
    createdAt: nowTs(),
  };

  mockDB.bathroomQueueByGroup[user.groupId].push(req);
  addLog("request_created", req);

  return { ok: true as const, request: req };
},


  // Called by teacher/system to dequeue next eligible request for a group + gender,
  // respecting 1M/1F out at a time AND teacher freeze behavior.
callNextForGroup(groupId: string, gender: Gender) {
  this.tickHousekeeping();

  // capacity check (1 boy + 1 girl out per group)
  const alreadyOut = mockDB.activeOutByGroup[groupId][gender];
  if (alreadyOut && (alreadyOut.status === "out" || alreadyOut.status === "late")) {
    return { ok: false as const, reason: "gender_slot_full" as const };
  }

  const queue = mockDB.bathroomQueueByGroup[groupId] || [];
  if (queue.length === 0) return { ok: false as const, reason: "queue_empty" as const };

  // -----------------------
  // 1) Try priority first
  // -----------------------
  // Priority candidates = requestIds that were skipped due to freeze.
  // Only eligible if their class is currently NOT frozen.
  const priorityCandidates: BathroomRequest[] = [];
  for (const classId of mockDB.groups[groupId].classIds) {
    const reqIds = mockDB.frozenPriorityByClass[classId] || [];
    for (const rid of reqIds) {
      const found = queue.find((q) => q.requestId === rid);
      if (found) priorityCandidates.push(found);
    }
  }
  priorityCandidates.sort((a, b) => a.createdAt - b.createdAt);

  for (const cand of priorityCandidates) {
    if (cand.gender !== gender) continue;
    if (mockDB.freezeByClass[cand.classId]) continue;

    // remove from frozen priority list
    mockDB.frozenPriorityByClass[cand.classId] =
      (mockDB.frozenPriorityByClass[cand.classId] || []).filter((rid) => rid !== cand.requestId);

    // remove from queue
    const realIdx = queue.findIndex((q) => q.requestId === cand.requestId);
    if (realIdx !== -1) queue.splice(realIdx, 1);

    return this._activateOut(cand);
  }

  // -----------------------------------------
  // 2) Normal scan (ITERATIVE, no recursion)
  // -----------------------------------------
  // We rotate through the queue at most N times.
  // If everyone matching gender is frozen, we stop cleanly.
  let sawMatchingGender = false;
  let eligibleFound = false;

  const n = queue.length;
  for (let i = 0; i < n; i++) {
    const req = queue[i];
    if (!req) continue;

    if (req.gender !== gender) continue;
    sawMatchingGender = true;

    if (!mockDB.freezeByClass[req.classId]) {
      // eligible!
      eligibleFound = true;

      // remove it from queue
      queue.splice(i, 1);
      return this._activateOut(req);
    }

    // class is frozen: park this request as "priority" (once)
    const list = mockDB.frozenPriorityByClass[req.classId] || [];
    if (!list.includes(req.requestId)) {
      list.push(req.requestId);
      mockDB.frozenPriorityByClass[req.classId] = list;
    }
  }

  if (!sawMatchingGender) {
    return { ok: false as const, reason: "no_matching_request" as const };
  }

  if (!eligibleFound) {
    // There *are* matching gender requests, but all are frozen.
    return { ok: false as const, reason: "all_candidates_frozen" as const };
  }

  // Should be unreachable, but safe fallback
  return { ok: false as const, reason: "unknown" as const };
},


  _activateOut(req: BathroomRequest) {
    const calledAt = nowTs();
    const dueBy = calledAt + 3 * 60 * 1000;

    const out: ActiveOut = {
      uid: req.uid,
      displayName: req.displayName,
      lunchNumber: req.lunchNumber,
      classId: req.classId,
      groupId: req.groupId,
      gender: req.gender,
      calledAt,
      dueBy,
      status: "out",
    };

    mockDB.activeOutByGroup[req.groupId][req.gender] = out;
    addLog("request_called", { request: req, out });

    return { ok: true as const, out };
  },

  studentReturn(uid: string) {
    this.tickHousekeeping();

    // find active record
    for (const groupId of Object.keys(mockDB.activeOutByGroup)) {
      for (const gender of ["M", "F"] as Gender[]) {
        const active = mockDB.activeOutByGroup[groupId][gender];
        if (active?.uid === uid && (active.status === "out" || active.status === "late")) {
          const returnedAt = nowTs();
          const returned: ActiveOut = {
            ...active,
            returnedAt,
            status: returnedAt > active.dueBy ? "late" : "returned",
          };
          mockDB.activeOutByGroup[groupId][gender] = null;

          // add to class clock-ins feed
          mockDB.clockInsByClass[returned.classId].unshift(returned);

          addLog("student_returned", { returned });
          return { ok: true as const, returned };
        }
      }
    }
    return { ok: false as const, reason: "not_found" as const };
  },

  teacherFalsifyReturn(classId: string, uid: string) {
    // This marks the student as returned (e.g. teacher confirms)
    // For MVP: just add an entry in clock-in feed + log.
    const fake: ActiveOut = {
      uid,
      displayName: `Student ${uid}`,
      lunchNumber: "????",
      classId,
      groupId: "unknown",
      gender: "M",
      calledAt: nowTs(),
      dueBy: nowTs(),
      returnedAt: nowTs(),
      status: "returned",
    };
    mockDB.clockInsByClass[classId].unshift(fake);
    addLog("teacher_falsified_return", { classId, uid });
  },
};
