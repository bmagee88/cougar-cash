export type StaffRole =
  | "teacher"
  | "substitute"
  | "admin"
  | "security"
  | "office"
  | "nurse"
  | "library"
  | "counselor";

export type DestinationKey =
  | "bathroom"
  | "water_fountain"
  | "nurse"
  | "counselor"
  | "office"
  | "teacher_room"
  | "library"
  | "eloper";

export type PassStatus =
  | "delayed"
  | "waiting"
  | "offered"
  | "out"
  | "received"
  | "return_waiting"
  | "return_offered"
  | "returning"
  | "returned"
  | "dismissed";

export type AuditAction =
  | "login"
  | "terms_accepted"
  | "substitute_teacher_selected"
  | "schedule_selected"
  | "period_override_changed"
  | "quiet_mode_changed"
  | "room_freeze_changed"
  | "roster_student_added"
  | "roster_student_updated"
  | "roster_student_removed"
  | "roster_imported"
  | "request_created"
  | "request_offered"
  | "request_offer_expired"
  | "request_permitted"
  | "destination_received"
  | "destination_dismissed_to_class"
  | "return_call_offered"
  | "return_call_expired"
  | "return_called"
  | "request_dismissed"
  | "student_returned"
  | "eloper_flagged"
  | "eloper_accounted_for"
  | "settings_updated";

export type StaffUser = {
  id: string;
  role: StaffRole;
  displayName: string;
  email: string;
  active: boolean;
  subbingForTeacherId?: string;
};

export type StudentRecord = {
  id: string;
  username: string;
  studentIdFingerprint: string;
  studentIdSuffix: string;
  medicalPriority: boolean;
  active: boolean;
  createdAt: number;
  updatedAt: number;
};

export type RosterEntry = {
  id: string;
  rosterId: string;
  studentId: string;
  active: boolean;
  deletedAt?: number;
  deletedByUserId?: string;
  createdAt: number;
  updatedAt: number;
};

export type Roster = {
  id: string;
  teacherId: string;
  periodId: string;
  name: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
};

export type SchedulePeriod = {
  id: string;
  label: string;
  start: string;
  end: string;
};

export type ScheduleTemplate = {
  id: string;
  name: string;
  active: boolean;
  periods: SchedulePeriod[];
};

export type TeacherGroup = {
  id: string;
  name: string;
  teacherIds: string[];
  normalCapacity: number;
};

export type RoomState = {
  teacherId: string;
  frozen: boolean;
  frozenAt?: number;
  frozenByUserId?: string;
};

export type AppSettings = {
  permitWindowMs: number;
  eloperAfterMs: number;
  retrySkippedAfterMs: number;
  longReturnMs: number;
  habitDelayMs: number;
  autoFreezeStartPeriodMs: number;
  autoFreezeEndPeriodMs: number;
  quietModeDefault: boolean;
};

export type PassRequest = {
  id: string;
  rosterId: string;
  studentId: string;
  teacherId: string;
  actorUserId: string;
  groupId: string;
  periodId: string;
  scheduleId: string;
  destination: DestinationKey;
  status: PassStatus;
  requestedAt: number;
  queueReason: string;
  isMedicalOverride: boolean;
  delayUntil?: number;
  snoozeUntil?: number;
  offeredAt?: number;
  offerExpiresAt?: number;
  passOverCount: number;
  permittedAt?: number;
  dueAt?: number;
  receivedAt?: number;
  receivedByUserId?: string;
  returnRequestedAt?: number;
  returnDismissedByUserId?: string;
  returnOfferedAt?: number;
  returnOfferExpiresAt?: number;
  returnCalledAt?: number;
  returnCalledByUserId?: string;
  returnedAt?: number;
  dismissedAt?: number;
  dismissedByUserId?: string;
};

export type EloperRecord = {
  id: string;
  requestId: string;
  studentId: string;
  teacherId: string;
  groupId: string;
  destination: DestinationKey;
  requestedAt: number;
  permittedAt: number;
  dueAt: number;
  flaggedAt: number;
  active: boolean;
  accountedForAt?: number;
  accountedForByUserId?: string;
};

export type AuditEntry = {
  id: string;
  action: AuditAction;
  actorUserId: string;
  effectiveTeacherId?: string;
  targetStudentId?: string;
  requestId?: string;
  createdAt: number;
  details: Record<string, unknown>;
};

export type PawPassState = {
  staffUsers: StaffUser[];
  students: StudentRecord[];
  rosters: Roster[];
  rosterEntries: RosterEntry[];
  schedules: ScheduleTemplate[];
  selectedScheduleId: string;
  periodOverrideId: string;
  groups: TeacherGroup[];
  rooms: RoomState[];
  requests: PassRequest[];
  elopers: EloperRecord[];
  audits: AuditEntry[];
  settings: AppSettings;
  quietModeByUserId: Record<string, boolean>;
  termsAcceptedByUserId: Record<string, number>;
};

export type ImportPreviewRow = {
  id: string;
  rowNumber: number;
  firstName: string;
  lastName: string;
  internalStudentId: string;
  username: string;
  studentIdFingerprint: string;
  studentIdSuffix: string;
  medicalPriority: boolean;
  issues: string[];
};

export const LOCAL_STORAGE_KEY = "paw-pass-state-v1";
export const SCHEDULE_STORAGE_KEY = "paw-pass-selected-schedule";
export const PERIOD_OVERRIDE_STORAGE_KEY = "paw-pass-period-override";

export const destinationLabels: Record<DestinationKey, string> = {
  bathroom: "Bathroom",
  water_fountain: "Water Fountain",
  nurse: "Nurse",
  counselor: "Counselor",
  office: "Office",
  teacher_room: "Teacher Room",
  library: "Library",
  eloper: "Eloper",
};

export const roleLabels: Record<StaffRole, string> = {
  teacher: "Teacher",
  substitute: "Substitute",
  admin: "Admin",
  security: "Security",
  office: "Office",
  nurse: "Nurse",
  library: "Library",
  counselor: "Counselor",
};

export const destinationByStaffRole: Partial<Record<StaffRole, DestinationKey>> = {
  office: "office",
  nurse: "nurse",
  library: "library",
  counselor: "counselor",
};

export const destinationForStaffRole = (role: StaffRole) =>
  destinationByStaffRole[role];

export const isDestinationStaff = (user: StaffUser | null) =>
  Boolean(user && destinationForStaffRole(user.role));

export const activePassStatuses: PassStatus[] = [
  "delayed",
  "waiting",
  "offered",
  "out",
  "received",
  "return_waiting",
  "return_offered",
  "returning",
];

export const teacherAwayStatuses: PassStatus[] = [
  "out",
  "received",
  "return_waiting",
  "returning",
];

export const returnPriorityStatuses: PassStatus[] = [
  "return_waiting",
  "return_offered",
  "returning",
];

export const destinationInboundStatuses: PassStatus[] = [
  "out",
  "received",
  "return_waiting",
  "return_offered",
  "returning",
];

export const settingsDefaults: AppSettings = {
  permitWindowMs: 90_000,
  eloperAfterMs: 5 * 60_000,
  retrySkippedAfterMs: 45_000,
  longReturnMs: 6 * 60_000,
  habitDelayMs: 2 * 60_000,
  autoFreezeStartPeriodMs: 0,
  autoFreezeEndPeriodMs: 0,
  quietModeDefault: false,
};

const seedNow = new Date("2026-08-22T08:00:00-04:00").getTime();

const makeId = (prefix: string) =>
  `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`;

const stableId = (prefix: string, value: string) =>
  `${prefix}-${String(value || "item").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

export const createStudentUsername = (
  firstName: string,
  lastName: string,
  internalStudentId: string,
) => {
  const first = String(firstName || "").trim().toLowerCase().replace(/[^a-z]/g, "");
  const last = String(lastName || "").trim().toLowerCase().replace(/[^a-z]/g, "");
  const idPart = String(internalStudentId || "").trim().replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return `${(first[0] || "").slice(0, 1)}_${`${last}xxx`.slice(0, 3)}_${`${idPart}xxx`.slice(0, 3)}`;
};

export const usernameHelpText =
  "Use first initial, first 3 letters of last name, and first 3 characters of the internal student id. Example: Jane Smith with id 123456 becomes j_smi_123.";

export const isValidStudentUsername = (username: string) =>
  /^[a-z]_[a-z]{3}_[a-z0-9]{3}$/.test(username);

export const clientSideFingerprint = (value: string) => {
  const text = String(value || "").trim().toLowerCase();
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `demo-${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

const studentFromParts = (
  firstName: string,
  lastName: string,
  internalStudentId: string,
  medicalPriority = false,
): StudentRecord => {
  const username = createStudentUsername(firstName, lastName, internalStudentId);
  const cleanedId = String(internalStudentId || "").trim().replace(/[^a-zA-Z0-9]/g, "");
  return {
    id: stableId("stu", `${username}-${cleanedId}`),
    username,
    studentIdFingerprint: clientSideFingerprint(cleanedId),
    studentIdSuffix: `${cleanedId.toLowerCase()}xxx`.slice(0, 3),
    medicalPriority,
    active: true,
    createdAt: seedNow,
    updatedAt: seedNow,
  };
};

const seedStudents = [
  studentFromParts("Alex", "Rivera", "21453"),
  studentFromParts("Maya", "Thompson", "21454"),
  studentFromParts("Jordan", "Lee", "21455"),
  studentFromParts("Sofia", "Patel", "21456", true),
  studentFromParts("Ethan", "Brooks", "31411"),
  studentFromParts("Ava", "Johnson", "31412"),
  studentFromParts("Noah", "Kim", "31413"),
  studentFromParts("Lina", "Garcia", "41820"),
  studentFromParts("Owen", "Price", "41821"),
  studentFromParts("Iris", "Moore", "41822", true),
  studentFromParts("Caleb", "Young", "51910"),
  studentFromParts("Nora", "Fields", "51911"),
  studentFromParts("Mateo", "Diaz", "51912"),
  studentFromParts("Priya", "Singh", "62030"),
  studentFromParts("Miles", "Allen", "62031"),
  studentFromParts("Ruth", "Baker", "62032"),
  studentFromParts("Emery", "Stone", "73140"),
  studentFromParts("Theo", "Walsh", "73141"),
];

export const createInitialState = (): PawPassState => {
  const staffUsers: StaffUser[] = [
    {
      id: "teacher-carter",
      role: "teacher",
      displayName: "Ms. Carter",
      email: "carter@school.example",
      active: true,
    },
    {
      id: "teacher-hernandez",
      role: "teacher",
      displayName: "Mr. Hernandez",
      email: "hernandez@school.example",
      active: true,
    },
    {
      id: "teacher-nguyen",
      role: "teacher",
      displayName: "Ms. Nguyen",
      email: "nguyen@school.example",
      active: true,
    },
    {
      id: "teacher-blake",
      role: "teacher",
      displayName: "Mx. Blake",
      email: "blake@school.example",
      active: true,
    },
    {
      id: "teacher-ortiz",
      role: "teacher",
      displayName: "Mrs. Ortiz",
      email: "ortiz@school.example",
      active: true,
    },
    {
      id: "teacher-shah",
      role: "teacher",
      displayName: "Mr. Shah",
      email: "shah@school.example",
      active: true,
    },
    {
      id: "substitute-day",
      role: "substitute",
      displayName: "Sam Substitute",
      email: "substitute@school.example",
      active: true,
      subbingForTeacherId: "teacher-carter",
    },
    {
      id: "admin-santos",
      role: "admin",
      displayName: "Admin Santos",
      email: "admin@school.example",
      active: true,
    },
    {
      id: "security-reed",
      role: "security",
      displayName: "Security Reed",
      email: "security@school.example",
      active: true,
    },
    {
      id: "office-main",
      role: "office",
      displayName: "Main Office",
      email: "office@school.example",
      active: true,
    },
    {
      id: "nurse-kelly",
      role: "nurse",
      displayName: "Nurse Kelly",
      email: "nurse@school.example",
      active: true,
    },
    {
      id: "library-desk",
      role: "library",
      displayName: "Library Desk",
      email: "library@school.example",
      active: true,
    },
    {
      id: "counselor-suite",
      role: "counselor",
      displayName: "Counselor Suite",
      email: "counselor@school.example",
      active: true,
    },
  ];

  const schedules: ScheduleTemplate[] = [
    {
      id: "full-day",
      name: "Full Day",
      active: true,
      periods: [
        { id: "p1", label: "Period 1", start: "08:00", end: "08:45" },
        { id: "p2", label: "Period 2", start: "08:50", end: "09:35" },
        { id: "p3", label: "Period 3", start: "09:40", end: "10:25" },
        { id: "p4", label: "Period 4", start: "10:30", end: "11:15" },
        { id: "p5", label: "Period 5", start: "11:20", end: "12:05" },
        { id: "p6", label: "Period 6", start: "12:10", end: "12:55" },
        { id: "p7", label: "Period 7", start: "13:00", end: "13:45" },
        { id: "p8", label: "Period 8", start: "13:50", end: "14:35" },
      ],
    },
    {
      id: "half-day",
      name: "Half Day",
      active: true,
      periods: [
        { id: "p1", label: "Period 1", start: "08:00", end: "08:30" },
        { id: "p2", label: "Period 2", start: "08:34", end: "09:04" },
        { id: "p3", label: "Period 3", start: "09:08", end: "09:38" },
        { id: "p4", label: "Period 4", start: "09:42", end: "10:12" },
        { id: "p5", label: "Period 5", start: "10:16", end: "10:46" },
        { id: "p6", label: "Period 6", start: "10:50", end: "11:20" },
        { id: "p7", label: "Period 7", start: "11:24", end: "11:54" },
        { id: "p8", label: "Period 8", start: "11:58", end: "12:28" },
      ],
    },
    {
      id: "assembly-day",
      name: "Assembly Day",
      active: true,
      periods: [
        { id: "p1", label: "Period 1", start: "08:00", end: "08:38" },
        { id: "p2", label: "Period 2", start: "08:42", end: "09:20" },
        { id: "assembly", label: "Assembly", start: "09:25", end: "10:10" },
        { id: "p3", label: "Period 3", start: "10:15", end: "10:53" },
        { id: "p4", label: "Period 4", start: "10:57", end: "11:35" },
        { id: "p5", label: "Period 5", start: "11:39", end: "12:17" },
        { id: "p6", label: "Period 6", start: "12:21", end: "12:59" },
        { id: "p7", label: "Period 7", start: "13:03", end: "13:41" },
        { id: "p8", label: "Period 8", start: "13:45", end: "14:23" },
      ],
    },
  ];

  const rosters: Roster[] = [
    "p1",
    "p2",
    "p8",
  ].map((periodId) => ({
    id: `roster-carter-${periodId}`,
    teacherId: "teacher-carter",
    periodId,
    name: `Ms. Carter ${periodId.toUpperCase()}`,
    active: true,
    createdAt: seedNow,
    updatedAt: seedNow,
  }));

  rosters.push(
    {
      id: "roster-hernandez-p1",
      teacherId: "teacher-hernandez",
      periodId: "p1",
      name: "Mr. Hernandez P1",
      active: true,
      createdAt: seedNow,
      updatedAt: seedNow,
    },
    {
      id: "roster-nguyen-p1",
      teacherId: "teacher-nguyen",
      periodId: "p1",
      name: "Ms. Nguyen P1",
      active: true,
      createdAt: seedNow,
      updatedAt: seedNow,
    },
    {
      id: "roster-blake-p1",
      teacherId: "teacher-blake",
      periodId: "p1",
      name: "Mx. Blake P1",
      active: true,
      createdAt: seedNow,
      updatedAt: seedNow,
    },
    {
      id: "roster-ortiz-p1",
      teacherId: "teacher-ortiz",
      periodId: "p1",
      name: "Mrs. Ortiz P1",
      active: true,
      createdAt: seedNow,
      updatedAt: seedNow,
    },
    {
      id: "roster-shah-p1",
      teacherId: "teacher-shah",
      periodId: "p1",
      name: "Mr. Shah P1",
      active: true,
      createdAt: seedNow,
      updatedAt: seedNow,
    },
  );

  const rosterEntries: RosterEntry[] = [
    ...seedStudents.slice(0, 4).map((student) => ({
      id: `entry-roster-carter-p1-${student.id}`,
      rosterId: "roster-carter-p1",
      studentId: student.id,
      active: true,
      createdAt: seedNow,
      updatedAt: seedNow,
    })),
    ...seedStudents.slice(4, 7).map((student) => ({
      id: `entry-roster-hernandez-p1-${student.id}`,
      rosterId: "roster-hernandez-p1",
      studentId: student.id,
      active: true,
      createdAt: seedNow,
      updatedAt: seedNow,
    })),
    ...seedStudents.slice(7, 10).map((student) => ({
      id: `entry-roster-nguyen-p1-${student.id}`,
      rosterId: "roster-nguyen-p1",
      studentId: student.id,
      active: true,
      createdAt: seedNow,
      updatedAt: seedNow,
    })),
    ...seedStudents.slice(10, 13).map((student) => ({
      id: `entry-roster-blake-p1-${student.id}`,
      rosterId: "roster-blake-p1",
      studentId: student.id,
      active: true,
      createdAt: seedNow,
      updatedAt: seedNow,
    })),
    ...seedStudents.slice(13, 16).map((student) => ({
      id: `entry-roster-ortiz-p1-${student.id}`,
      rosterId: "roster-ortiz-p1",
      studentId: student.id,
      active: true,
      createdAt: seedNow,
      updatedAt: seedNow,
    })),
    ...seedStudents.slice(16, 18).map((student) => ({
      id: `entry-roster-shah-p1-${student.id}`,
      rosterId: "roster-shah-p1",
      studentId: student.id,
      active: true,
      createdAt: seedNow,
      updatedAt: seedNow,
    })),
  ];

  return {
    staffUsers,
    students: seedStudents,
    rosters,
    rosterEntries,
    schedules,
    selectedScheduleId: "full-day",
    periodOverrideId: "",
    groups: [
      {
        id: "north-wing",
        name: "North Wing",
        teacherIds: ["teacher-carter", "teacher-hernandez", "teacher-nguyen"],
        normalCapacity: 1,
      },
      {
        id: "east-wing",
        name: "East Wing",
        teacherIds: ["teacher-blake", "teacher-ortiz"],
        normalCapacity: 1,
      },
      {
        id: "west-wing",
        name: "West Wing",
        teacherIds: ["teacher-shah"],
        normalCapacity: 1,
      },
    ],
    rooms: staffUsers
      .filter((user) => user.role === "teacher")
      .map((teacher) => ({ teacherId: teacher.id, frozen: false })),
    requests: [],
    elopers: [],
    audits: [],
    settings: settingsDefaults,
    quietModeByUserId: {},
    termsAcceptedByUserId: {},
  };
};

export const loadPawPassState = (): PawPassState => {
  if (typeof window === "undefined") return createInitialState();

  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      const initial = createInitialState();
      const cachedSchedule = window.localStorage.getItem(SCHEDULE_STORAGE_KEY);
      const cachedOverride = window.localStorage.getItem(PERIOD_OVERRIDE_STORAGE_KEY);
      if (cachedSchedule) initial.selectedScheduleId = cachedSchedule;
      if (cachedOverride) initial.periodOverrideId = cachedOverride;
      return initial;
    }

    const parsed = JSON.parse(raw) as PawPassState;
    const initial = createInitialState();
    const mergeMissingById = <T extends { id: string }>(
      seeded: T[],
      stored: T[] | undefined,
    ) => {
      const output = [...(stored || [])];
      const existing = new Set(output.map((item) => item.id));
      seeded.forEach((item) => {
        if (!existing.has(item.id)) output.push(item);
      });
      return output;
    };

    return {
      ...initial,
      ...parsed,
      staffUsers: mergeMissingById(initial.staffUsers, parsed.staffUsers),
      students: mergeMissingById(initial.students, parsed.students),
      rosters: mergeMissingById(initial.rosters, parsed.rosters),
      rosterEntries: mergeMissingById(initial.rosterEntries, parsed.rosterEntries),
      schedules: mergeMissingById(initial.schedules, parsed.schedules),
      groups: mergeMissingById(initial.groups, parsed.groups),
      rooms: mergeMissingById(initial.rooms.map((room) => ({ id: room.teacherId, ...room })), parsed.rooms?.map((room) => ({ id: room.teacherId, ...room }))).map(({ id, ...room }) => room),
      settings: { ...settingsDefaults, ...(parsed.settings || {}) },
    };
  } catch {
    return createInitialState();
  }
};

export const savePawPassState = (state: PawPassState) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  window.localStorage.setItem(SCHEDULE_STORAGE_KEY, state.selectedScheduleId);
  window.localStorage.setItem(PERIOD_OVERRIDE_STORAGE_KEY, state.periodOverrideId);
};

export const getTeachers = (state: PawPassState) =>
  state.staffUsers.filter((user) => user.role === "teacher" && user.active);

export const getEffectiveTeacherId = (user: StaffUser | null, state: PawPassState) => {
  if (!user) return "";
  if (user.role === "teacher") return user.id;
  if (user.role === "substitute") {
    return user.subbingForTeacherId || getTeachers(state)[0]?.id || "";
  }
  if (user.role === "admin" || user.role === "security") {
    return user.subbingForTeacherId || getTeachers(state)[0]?.id || "";
  }
  return "";
};

export const canViewAll = (user: StaffUser | null) =>
  user?.role === "admin" || user?.role === "security";

export const getVisibleTeacherIds = (user: StaffUser | null, state: PawPassState) => {
  if (!user) return [];
  if (canViewAll(user)) return getTeachers(state).map((teacher) => teacher.id);
  return [getEffectiveTeacherId(user, state)].filter(Boolean);
};

export const getTeacherName = (state: PawPassState, teacherId: string) =>
  state.staffUsers.find((user) => user.id === teacherId)?.displayName || "Unknown teacher";

export const getStudent = (state: PawPassState, studentId: string) =>
  state.students.find((student) => student.id === studentId);

export const getStudentUsername = (state: PawPassState, studentId: string) =>
  getStudent(state, studentId)?.username || "unknown_student";

export const getSchedule = (state: PawPassState) =>
  state.schedules.find((schedule) => schedule.id === state.selectedScheduleId) ||
  state.schedules[0];

const timeToMinutes = (hhmm: string) => {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + minutes;
};

const dateToHHMM = (date: Date) => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const dateToMsSinceMidnight = (date: Date) =>
  ((date.getHours() * 60 + date.getMinutes()) * 60 + date.getSeconds()) * 1000 +
  date.getMilliseconds();

export const getCurrentPeriod = (state: PawPassState, at = new Date()): SchedulePeriod => {
  const schedule = getSchedule(state);
  if (state.periodOverrideId) {
    return (
      schedule.periods.find((period) => period.id === state.periodOverrideId) ||
      schedule.periods[0]
    );
  }

  const nowMinutes = timeToMinutes(dateToHHMM(at));
  return (
    schedule.periods.find((period) => {
      const start = timeToMinutes(period.start);
      const end = timeToMinutes(period.end);
      return nowMinutes >= start && nowMinutes < end;
    }) || { id: "off", label: "Off Schedule", start: "--:--", end: "--:--" }
  );
};

export const getAutoFreezeWindow = (state: PawPassState, at = new Date()) => {
  const period = getCurrentPeriod(state, at);
  if (period.id === "off") return null;

  const startWindowMs = Math.max(0, state.settings.autoFreezeStartPeriodMs || 0);
  const endWindowMs = Math.max(0, state.settings.autoFreezeEndPeriodMs || 0);
  if (!startWindowMs && !endWindowMs) return null;

  const nowMs = dateToMsSinceMidnight(at);
  const startMs = timeToMinutes(period.start) * 60_000;
  const endMs = timeToMinutes(period.end) * 60_000;

  if (startWindowMs && nowMs >= startMs && nowMs < startMs + startWindowMs) {
    return { period, phase: "start" as const };
  }

  if (endWindowMs && nowMs >= endMs - endWindowMs && nowMs < endMs) {
    return { period, phase: "end" as const };
  }

  return null;
};

export const getOrCreateRoster = (
  state: PawPassState,
  teacherId: string,
  periodId: string,
): Roster => {
  const existing = state.rosters.find(
    (roster) =>
      roster.teacherId === teacherId &&
      roster.periodId === periodId &&
      roster.active,
  );
  if (existing) return existing;

  const now = Date.now();
  const roster: Roster = {
    id: makeId("roster"),
    teacherId,
    periodId,
    name: `${getTeacherName(state, teacherId)} ${periodId.toUpperCase()}`,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  state.rosters.push(roster);
  return roster;
};

export const getRosterStudents = (
  state: PawPassState,
  teacherId: string,
  periodId: string,
) => {
  const roster = state.rosters.find(
    (item) => item.teacherId === teacherId && item.periodId === periodId && item.active,
  );
  if (!roster) return [];

  return state.rosterEntries
    .filter((entry) => entry.rosterId === roster.id && entry.active)
    .map((entry) => getStudent(state, entry.studentId))
    .filter(Boolean) as StudentRecord[];
};

export const getTeacherGroup = (state: PawPassState, teacherId: string) =>
  state.groups.find((group) => group.teacherIds.includes(teacherId)) || state.groups[0];

export const getRoomState = (state: PawPassState, teacherId: string) => {
  let room = state.rooms.find((item) => item.teacherId === teacherId);
  if (!room) {
    room = { teacherId, frozen: false };
    state.rooms.push(room);
  }
  return room;
};

export const addAudit = (
  state: PawPassState,
  actorUserId: string,
  action: AuditAction,
  details: Record<string, unknown> = {},
  options: {
    effectiveTeacherId?: string;
    targetStudentId?: string;
    requestId?: string;
  } = {},
) => {
  state.audits.unshift({
    id: makeId("audit"),
    action,
    actorUserId,
    effectiveTeacherId: options.effectiveTeacherId,
    targetStudentId: options.targetStudentId,
    requestId: options.requestId,
    createdAt: Date.now(),
    details,
  });
  state.audits = state.audits.slice(0, 500);
};

const activeNormalOutCount = (state: PawPassState, groupId: string) =>
  state.requests.filter(
    (request) =>
      request.groupId === groupId &&
      request.status === "out" &&
      !request.isMedicalOverride,
  ).length;

const hasOfferedNormal = (state: PawPassState, groupId: string) =>
  state.requests.some(
    (request) =>
      request.groupId === groupId &&
      request.status === "offered" &&
      !request.isMedicalOverride,
  );

const hasOfferedMedical = (state: PawPassState, groupId: string) =>
  state.requests.some(
    (request) =>
      request.groupId === groupId &&
      request.status === "offered" &&
      request.isMedicalOverride,
  );

const requestIsReady = (request: PassRequest, now: number) => {
  if (request.status !== "waiting" && request.status !== "delayed") return false;
  if (request.delayUntil && request.delayUntil > now) return false;
  if (request.snoozeUntil && request.snoozeUntil > now) return false;
  return true;
};

const averageReturnedDuration = (
  state: PawPassState,
  studentId: string,
  sampleSize = 5,
) => {
  const durations = state.requests
    .filter(
      (request) =>
        request.studentId === studentId &&
        request.permittedAt &&
        request.returnedAt &&
        request.returnedAt > request.permittedAt,
    )
    .slice(-sampleSize)
    .map((request) => Number(request.returnedAt) - Number(request.permittedAt));
  if (!durations.length) return 0;
  return durations.reduce((total, item) => total + item, 0) / durations.length;
};

export const createPassRequest = (
  state: PawPassState,
  actor: StaffUser,
  effectiveTeacherId: string,
  periodId: string,
  destination: DestinationKey,
  studentId: string,
) => {
  if (destination === "eloper") {
    throw new Error("Use the eloper action instead of a destination pass.");
  }
  const roster = getOrCreateRoster(state, effectiveTeacherId, periodId);
  const student = getStudent(state, studentId);
  if (!student) throw new Error("Student not found.");

  const room = getRoomState(state, effectiveTeacherId);
  if (room.frozen) {
    throw new Error("This room is frozen. Students already in line keep their place.");
  }

  const duplicate = state.requests.find(
    (request) =>
      request.studentId === studentId &&
      activePassStatuses.includes(request.status),
  );
  if (duplicate) {
    throw new Error("That student already has an active request.");
  }

  const now = Date.now();
  const group = getTeacherGroup(state, effectiveTeacherId);
  const averageDuration = averageReturnedDuration(state, studentId);
  const delayed = averageDuration > state.settings.longReturnMs && !student.medicalPriority;
  const request: PassRequest = {
    id: makeId("req"),
    rosterId: roster.id,
    studentId,
    teacherId: effectiveTeacherId,
    actorUserId: actor.id,
    groupId: group.id,
    periodId,
    scheduleId: state.selectedScheduleId,
    destination,
    status: delayed ? "delayed" : "waiting",
    requestedAt: now,
    queueReason: delayed
      ? "Delay queue: recent returns were longer than the room threshold."
      : student.medicalPriority
        ? "Medical priority: may be permitted in addition to the normal active pass."
        : "Waiting for the group pass to open.",
    isMedicalOverride: student.medicalPriority,
    delayUntil: delayed ? now + state.settings.habitDelayMs : undefined,
    passOverCount: 0,
  };

  state.requests.push(request);
  addAudit(
    state,
    actor.id,
    "request_created",
    {
      destination,
      groupId: group.id,
      medicalPriority: student.medicalPriority,
      delayed,
    },
    {
      effectiveTeacherId,
      targetStudentId: studentId,
      requestId: request.id,
    },
  );
};

export const createEloperRequest = (
  state: PawPassState,
  actor: StaffUser,
  effectiveTeacherId: string,
  periodId: string,
  studentId: string,
) => {
  const roster = getOrCreateRoster(state, effectiveTeacherId, periodId);
  const student = getStudent(state, studentId);
  if (!student) throw new Error("Student not found.");

  const duplicate = state.requests.find(
    (request) =>
      request.studentId === studentId &&
      activePassStatuses.includes(request.status),
  );
  if (duplicate) {
    throw new Error("That student already has an active request.");
  }

  const now = Date.now();
  const group = getTeacherGroup(state, effectiveTeacherId);
  const request: PassRequest = {
    id: makeId("req"),
    rosterId: roster.id,
    studentId,
    teacherId: effectiveTeacherId,
    actorUserId: actor.id,
    groupId: group.id,
    periodId,
    scheduleId: state.selectedScheduleId,
    destination: "eloper",
    status: "out",
    requestedAt: now,
    queueReason: "Marked as an eloper from the classroom request screen.",
    isMedicalOverride: true,
    passOverCount: 0,
    permittedAt: now,
    dueAt: now,
  };

  state.requests.push(request);
  addAudit(
    state,
    actor.id,
    "request_created",
    {
      destination: "eloper",
      groupId: group.id,
      manualEloper: true,
    },
    {
      effectiveTeacherId,
      targetStudentId: studentId,
      requestId: request.id,
    },
  );
  createOrActivateEloper(state, actor, request, now, { source: "request_modal" });
};

const offerRequest = (state: PawPassState, request: PassRequest, now: number) => {
  request.status = "offered";
  request.offeredAt = now;
  request.offerExpiresAt = now + state.settings.permitWindowMs;
  request.queueReason = request.isMedicalOverride
    ? "Ready now because this student has a medical priority note."
    : "Ready now: the group pass is open.";
  addAudit(
    state,
    request.actorUserId,
    "request_offered",
    { groupId: request.groupId, passOverCount: request.passOverCount },
    {
      effectiveTeacherId: request.teacherId,
      targetStudentId: request.studentId,
      requestId: request.id,
    },
  );
};

const findNextEligibleRequest = (
  state: PawPassState,
  group: TeacherGroup,
  now: number,
  medical: boolean,
) =>
  [...state.requests]
    .filter(
      (request) =>
        request.groupId === group.id &&
        request.isMedicalOverride === medical &&
        requestIsReady(request, now),
    )
    .sort((left, right) => left.requestedAt - right.requestedAt)
    .find((request) => !getRoomState(state, request.teacherId).frozen);

const specialDestinationKeys: DestinationKey[] = ["office", "nurse", "library", "counselor"];

export const isSpecialDestination = (destination: DestinationKey) =>
  specialDestinationKeys.includes(destination);

const canManageDestination = (actor: StaffUser, destination: DestinationKey) =>
  actor.role === "admin" ||
  actor.role === "security" ||
  destinationForStaffRole(actor.role) === destination;

const createOrActivateEloper = (
  state: PawPassState,
  actor: StaffUser,
  request: PassRequest,
  now: number,
  details: Record<string, unknown> = {},
) => {
  const existing = state.elopers.find((eloper) => eloper.requestId === request.id && eloper.active);
  if (existing) return existing;

  const permittedAt = request.permittedAt || now;
  const eloper: EloperRecord = {
    id: makeId("eloper"),
    requestId: request.id,
    studentId: request.studentId,
    teacherId: request.teacherId,
    groupId: request.groupId,
    destination: request.destination,
    requestedAt: request.requestedAt,
    permittedAt,
    dueAt: request.dueAt || now,
    flaggedAt: now,
    active: true,
  };
  state.elopers.unshift(eloper);
  request.queueReason = "Marked as eloper by staff.";
  addAudit(
    state,
    actor.id,
    "eloper_flagged",
    {
      destination: request.destination,
      groupId: request.groupId,
      manual: true,
      ...details,
    },
    {
      effectiveTeacherId: request.teacherId,
      targetStudentId: request.studentId,
      requestId: request.id,
    },
  );
  return eloper;
};

const offerReturnRequest = (state: PawPassState, request: PassRequest, now: number) => {
  request.status = "return_offered";
  request.returnOfferedAt = now;
  request.returnOfferExpiresAt = now + state.settings.permitWindowMs;
  request.queueReason = "Return to learning: call this student back before new hallway departures.";
  addAudit(
    state,
    request.actorUserId,
    "return_call_offered",
    { destination: request.destination, passOverCount: request.passOverCount },
    {
      effectiveTeacherId: request.teacherId,
      targetStudentId: request.studentId,
      requestId: request.id,
    },
  );
};

export const advanceQueues = (state: PawPassState, now = Date.now()) => {
  state.requests.forEach((request) => {
    if (
      request.status === "return_offered" &&
      request.returnOfferExpiresAt &&
      request.returnOfferExpiresAt <= now
    ) {
      request.status = "return_waiting";
      request.passOverCount += 1;
      request.snoozeUntil = now + state.settings.retrySkippedAfterMs;
      request.queueReason =
        "Teacher did not respond to the return call. Keeping this return ahead of hallway departures.";
      addAudit(
        state,
        request.actorUserId,
        "return_call_expired",
        { retryAt: request.snoozeUntil, passOverCount: request.passOverCount },
        {
          effectiveTeacherId: request.teacherId,
          targetStudentId: request.studentId,
          requestId: request.id,
        },
      );
    }

    if (request.status === "offered" && request.offerExpiresAt && request.offerExpiresAt <= now) {
      request.status = "waiting";
      request.passOverCount += 1;
      request.snoozeUntil = now + state.settings.retrySkippedAfterMs;
      request.queueReason =
        "Teacher did not respond in time. Keeping this student in place and trying again soon.";
      addAudit(
        state,
        request.actorUserId,
        "request_offer_expired",
        { retryAt: request.snoozeUntil, passOverCount: request.passOverCount },
        {
          effectiveTeacherId: request.teacherId,
          targetStudentId: request.studentId,
          requestId: request.id,
        },
      );
    }

    if (request.status === "delayed" && request.delayUntil && request.delayUntil <= now) {
      request.status = "waiting";
      request.queueReason = "Delay complete. Waiting for the group pass to open.";
    }
  });

  state.requests.forEach((request) => {
    if (
      (request.status === "out" || request.status === "returning") &&
      request.dueAt &&
      request.permittedAt &&
      request.dueAt <= now &&
      !state.elopers.some((eloper) => eloper.requestId === request.id && eloper.active)
    ) {
      const actor = state.staffUsers.find((user) => user.id === request.actorUserId);
      if (actor) {
        createOrActivateEloper(state, actor, request, now, {
          destination: request.destination,
          groupId: request.groupId,
          manual: false,
        });
      }
    }
  });

  const activeReturnPriority = state.requests.some((request) =>
    returnPriorityStatuses.includes(request.status),
  );
  const returnAlreadyOfferedOrMoving = state.requests.some((request) =>
    request.status === "return_offered" || request.status === "returning",
  );

  let returnWasOffered = false;
  if (!returnAlreadyOfferedOrMoving) {
    const nextReturn = [...state.requests]
      .filter(
        (request) =>
          request.status === "return_waiting" &&
          (!request.snoozeUntil || request.snoozeUntil <= now),
      )
      .sort(
        (left, right) =>
          Number(left.returnRequestedAt || left.requestedAt) -
          Number(right.returnRequestedAt || right.requestedAt),
      )
      .find(Boolean);
    if (nextReturn) {
      offerReturnRequest(state, nextReturn, now);
      returnWasOffered = true;
    }
  }

  if (activeReturnPriority || returnWasOffered) return;

  if (getAutoFreezeWindow(state, new Date(now))) return;

  state.groups.forEach((group) => {
    if (
      activeNormalOutCount(state, group.id) < group.normalCapacity &&
      !hasOfferedNormal(state, group.id)
    ) {
      const next = findNextEligibleRequest(state, group, now, false);
      if (next) offerRequest(state, next, now);
    }

    if (!hasOfferedMedical(state, group.id)) {
      const nextMedical = findNextEligibleRequest(state, group, now, true);
      if (nextMedical) offerRequest(state, nextMedical, now);
    }
  });
};

export const permitRequest = (
  state: PawPassState,
  actor: StaffUser,
  requestId: string,
) => {
  const request = state.requests.find((item) => item.id === requestId);
  if (!request || request.status !== "offered") return;
  const now = Date.now();
  request.status = "out";
  request.permittedAt = now;
  request.dueAt = now + state.settings.eloperAfterMs;
  request.queueReason = request.isMedicalOverride
    ? "Out on a medical priority pass."
    : "Out on the group pass.";
  addAudit(
    state,
    actor.id,
    "request_permitted",
    { destination: request.destination },
    {
      effectiveTeacherId: request.teacherId,
      targetStudentId: request.studentId,
      requestId: request.id,
    },
  );
};

export const dismissRequest = (
  state: PawPassState,
  actor: StaffUser,
  requestId: string,
) => {
  const request = state.requests.find((item) => item.id === requestId);
  if (!request || !["offered", "waiting", "delayed"].includes(request.status)) return;
  request.status = "dismissed";
  request.dismissedAt = Date.now();
  request.dismissedByUserId = actor.id;
  request.queueReason = "Dismissed by staff.";
  addAudit(
    state,
    actor.id,
    "request_dismissed",
    { destination: request.destination },
    {
      effectiveTeacherId: request.teacherId,
      targetStudentId: request.studentId,
      requestId: request.id,
    },
  );
};

export const receiveDestinationStudent = (
  state: PawPassState,
  actor: StaffUser,
  requestId: string,
) => {
  const request = state.requests.find((item) => item.id === requestId);
  if (!request || request.status !== "out" || !isSpecialDestination(request.destination)) return;
  if (!canManageDestination(actor, request.destination)) {
    throw new Error(`Only ${destinationLabels[request.destination]} staff can receive this student.`);
  }

  const now = Date.now();
  request.status = "received";
  request.receivedAt = now;
  request.receivedByUserId = actor.id;
  request.dueAt = undefined;
  request.queueReason = `Received at ${destinationLabels[request.destination]}. The group pass is open for the next student.`;

  const activeEloper = state.elopers.find(
    (eloper) => eloper.requestId === requestId && eloper.active,
  );
  if (activeEloper) {
    activeEloper.active = false;
    activeEloper.accountedForAt = now;
    activeEloper.accountedForByUserId = actor.id;
  }

  addAudit(
    state,
    actor.id,
    "destination_received",
    { destination: request.destination, resolvedEloper: Boolean(activeEloper) },
    {
      effectiveTeacherId: request.teacherId,
      targetStudentId: request.studentId,
      requestId: request.id,
    },
  );
};

export const dismissFromDestinationToClass = (
  state: PawPassState,
  actor: StaffUser,
  requestId: string,
) => {
  const request = state.requests.find((item) => item.id === requestId);
  if (!request || request.status !== "received" || !isSpecialDestination(request.destination)) return;
  if (!canManageDestination(actor, request.destination)) {
    throw new Error(`Only ${destinationLabels[request.destination]} staff can dismiss this student.`);
  }

  const now = Date.now();
  request.status = "return_waiting";
  request.returnRequestedAt = now;
  request.returnDismissedByUserId = actor.id;
  request.snoozeUntil = undefined;
  request.queueReason =
    "Dismissed back to class. Waiting for the teacher call; this return is ahead of new hallway departures.";

  addAudit(
    state,
    actor.id,
    "destination_dismissed_to_class",
    { destination: request.destination },
    {
      effectiveTeacherId: request.teacherId,
      targetStudentId: request.studentId,
      requestId: request.id,
    },
  );
};

export const callStudentBackToClass = (
  state: PawPassState,
  actor: StaffUser,
  requestId: string,
) => {
  const request = state.requests.find((item) => item.id === requestId);
  if (!request || request.status !== "return_offered") return;
  const actorTeacherId = getEffectiveTeacherId(actor, state);
  if (actorTeacherId !== request.teacherId && !canViewAll(actor)) return;

  const now = Date.now();
  request.status = "returning";
  request.returnCalledAt = now;
  request.returnCalledByUserId = actor.id;
  request.returnOfferExpiresAt = undefined;
  request.snoozeUntil = undefined;
  request.dueAt = now + state.settings.eloperAfterMs;
  request.queueReason = "Teacher called this student back to class. Waiting for the student to arrive.";

  addAudit(
    state,
    actor.id,
    "return_called",
    { destination: request.destination },
    {
      effectiveTeacherId: request.teacherId,
      targetStudentId: request.studentId,
      requestId: request.id,
    },
  );
};

export const markRequestEloper = (
  state: PawPassState,
  actor: StaffUser,
  requestId: string,
) => {
  const request = state.requests.find((item) => item.id === requestId);
  if (!request || !activePassStatuses.includes(request.status)) return;
  if (!canManageDestination(actor, request.destination) && !canViewAll(actor)) {
    throw new Error("Only destination staff, admin, or security can mark this student as an eloper.");
  }
  createOrActivateEloper(state, actor, request, Date.now(), {
    source: "destination_staff",
    status: request.status,
  });
};

export const returnStudent = (
  state: PawPassState,
  actor: StaffUser,
  requestId: string,
) => {
  const request = state.requests.find((item) => item.id === requestId);
  if (!request || !["out", "returning"].includes(request.status)) return;
  const now = Date.now();
  request.status = "returned";
  request.returnedAt = now;
  request.queueReason = "Returned to class.";

  const activeEloper = state.elopers.find(
    (eloper) => eloper.requestId === requestId && eloper.active,
  );
  if (activeEloper) {
    activeEloper.active = false;
    activeEloper.accountedForAt = now;
    activeEloper.accountedForByUserId = actor.id;
  }

  addAudit(
    state,
    actor.id,
    "student_returned",
    {
      destination: request.destination,
      elapsedMs: request.permittedAt ? now - request.permittedAt : 0,
      resolvedEloper: Boolean(activeEloper),
    },
    {
      effectiveTeacherId: request.teacherId,
      targetStudentId: request.studentId,
      requestId: request.id,
    },
  );
};

export const accountForEloper = (
  state: PawPassState,
  actor: StaffUser,
  eloperId: string,
) => {
  const eloper = state.elopers.find((item) => item.id === eloperId);
  if (!eloper || !eloper.active) return;
  const now = Date.now();
  eloper.active = false;
  eloper.accountedForAt = now;
  eloper.accountedForByUserId = actor.id;

  const request = state.requests.find((item) => item.id === eloper.requestId);
  if (request && activePassStatuses.includes(request.status)) {
    request.status = "returned";
    request.returnedAt = now;
    request.queueReason = "Accounted for by staff.";
  }

  addAudit(
    state,
    actor.id,
    "eloper_accounted_for",
    { groupId: eloper.groupId },
    {
      effectiveTeacherId: eloper.teacherId,
      targetStudentId: eloper.studentId,
      requestId: eloper.requestId,
    },
  );
};

export const setRoomFrozen = (
  state: PawPassState,
  actor: StaffUser,
  teacherId: string,
  frozen: boolean,
) => {
  const room = getRoomState(state, teacherId);
  room.frozen = frozen;
  room.frozenAt = frozen ? Date.now() : undefined;
  room.frozenByUserId = frozen ? actor.id : undefined;

  state.requests.forEach((request) => {
    if (
      request.teacherId === teacherId &&
      ["waiting", "delayed", "offered"].includes(request.status)
    ) {
      if (request.status === "offered") {
        request.status = "waiting";
        request.snoozeUntil = undefined;
      }
      request.queueReason = frozen
        ? "Room frozen. This student keeps the original queue position."
        : "Room thawed. Earlier frozen requests get priority again.";
    }
  });

  addAudit(
    state,
    actor.id,
    "room_freeze_changed",
    { frozen },
    { effectiveTeacherId: teacherId },
  );
};

export const addOrUpdateStudentForRoster = (
  state: PawPassState,
  actor: StaffUser,
  teacherId: string,
  periodId: string,
  studentInput: {
    firstName: string;
    lastName: string;
    internalStudentId: string;
    medicalPriority: boolean;
  },
) => {
  addStudentForRosterPeriods(state, actor, teacherId, [periodId], studentInput);
};

export const addStudentForRosterPeriods = (
  state: PawPassState,
  actor: StaffUser,
  teacherId: string,
  periodIds: string[],
  studentInput: {
    firstName: string;
    lastName: string;
    internalStudentId: string;
    medicalPriority: boolean;
  },
) => {
  const uniquePeriodIds = periodIds.filter(
    (periodId, index) => Boolean(periodId) && periodIds.indexOf(periodId) === index,
  );
  if (!uniquePeriodIds.length) {
    throw new Error("Choose at least one period for this student.");
  }

  const username = createStudentUsername(
    studentInput.firstName,
    studentInput.lastName,
    studentInput.internalStudentId,
  );
  if (!isValidStudentUsername(username)) {
    throw new Error("Student username does not match the Paw Pass format.");
  }

  if (state.students.some((student) => student.username === username && student.active)) {
    throw new Error("That generated username already exists.");
  }

  const now = Date.now();
  const cleanedId = String(studentInput.internalStudentId || "")
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "");
  const student: StudentRecord = {
    id: makeId("stu"),
    username,
    studentIdFingerprint: clientSideFingerprint(cleanedId),
    studentIdSuffix: `${cleanedId.toLowerCase()}xxx`.slice(0, 3),
    medicalPriority: studentInput.medicalPriority,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  state.students.push(student);

  uniquePeriodIds.forEach((periodId) => {
    const roster = getOrCreateRoster(state, teacherId, periodId);
    state.rosterEntries.push({
      id: makeId("entry"),
      rosterId: roster.id,
      studentId: student.id,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  });

  addAudit(
    state,
    actor.id,
    "roster_student_added",
    { periodIds: uniquePeriodIds, username },
    { effectiveTeacherId: teacherId, targetStudentId: student.id },
  );
};

export const updateStudent = (
  state: PawPassState,
  actor: StaffUser,
  teacherId: string,
  studentId: string,
  patch: Pick<StudentRecord, "username" | "medicalPriority">,
) => {
  const student = getStudent(state, studentId);
  if (!student) return;
  const username = patch.username.trim().toLowerCase();
  if (!isValidStudentUsername(username)) {
    throw new Error("Username must look like j_smi_123.");
  }
  if (
    state.students.some(
      (item) => item.id !== studentId && item.username === username && item.active,
    )
  ) {
    throw new Error("That username already belongs to another student.");
  }
  student.username = username;
  student.medicalPriority = patch.medicalPriority;
  student.updatedAt = Date.now();
  addAudit(
    state,
    actor.id,
    "roster_student_updated",
    { username, medicalPriority: patch.medicalPriority },
    { effectiveTeacherId: teacherId, targetStudentId: studentId },
  );
};

export const softDeleteRosterStudent = (
  state: PawPassState,
  actor: StaffUser,
  teacherId: string,
  periodId: string,
  studentId: string,
) => {
  const roster = state.rosters.find(
    (item) => item.teacherId === teacherId && item.periodId === periodId && item.active,
  );
  if (!roster) return;
  const entry = state.rosterEntries.find(
    (item) => item.rosterId === roster.id && item.studentId === studentId && item.active,
  );
  if (!entry) return;
  entry.active = false;
  entry.deletedAt = Date.now();
  entry.deletedByUserId = actor.id;
  entry.updatedAt = entry.deletedAt;
  addAudit(
    state,
    actor.id,
    "roster_student_removed",
    { periodId },
    { effectiveTeacherId: teacherId, targetStudentId: studentId },
  );
};

export const buildImportPreview = (
  state: PawPassState,
  rows: Record<string, unknown>[],
) => {
  const existingUsernames = new Set(
    state.students.filter((student) => student.active).map((student) => student.username),
  );
  const seen = new Set<string>();

  return rows.map((row, index) => {
    const firstName =
      String(row.firstName || row.first_name || row.first || row.given_name || "").trim();
    const lastName =
      String(row.lastName || row.last_name || row.last || row.family_name || "").trim();
    const internalStudentId = String(
      row.internalStudentId ||
        row.internal_student_id ||
        row.studentId ||
        row.student_id ||
        row.id ||
        "",
    ).trim();
    const medicalText = String(
      row.medicalPriority || row.medical_priority || row.doctorNote || row.doctor_note || "",
    )
      .trim()
      .toLowerCase();
    const medicalPriority = ["yes", "true", "1", "y", "medical", "doctor"].includes(
      medicalText,
    );
    const username = createStudentUsername(firstName, lastName, internalStudentId);
    const cleanedId = internalStudentId.replace(/[^a-zA-Z0-9]/g, "");
    const issues: string[] = [];

    if (!firstName) issues.push("Missing first name");
    if (!lastName) issues.push("Missing last name");
    if (!cleanedId) issues.push("Missing internal student id");
    if (!isValidStudentUsername(username)) issues.push("Username format failed");
    if (existingUsernames.has(username)) issues.push("Username already exists");
    if (seen.has(username)) issues.push("Duplicate username in this file");
    seen.add(username);

    return {
      id: makeId("preview"),
      rowNumber: index + 2,
      firstName,
      lastName,
      internalStudentId,
      username,
      studentIdFingerprint: clientSideFingerprint(cleanedId),
      studentIdSuffix: `${cleanedId.toLowerCase()}xxx`.slice(0, 3),
      medicalPriority,
      issues,
    };
  });
};

export const commitImportPreview = (
  state: PawPassState,
  actor: StaffUser,
  teacherId: string,
  periodId: string,
  previewRows: ImportPreviewRow[],
) => {
  const invalid = previewRows.filter((row) => row.issues.length);
  if (invalid.length) {
    throw new Error("Fix import issues before saving the roster.");
  }

  const now = Date.now();
  const roster = getOrCreateRoster(state, teacherId, periodId);
  previewRows.forEach((row) => {
    const student: StudentRecord = {
      id: makeId("stu"),
      username: row.username,
      studentIdFingerprint: row.studentIdFingerprint,
      studentIdSuffix: row.studentIdSuffix,
      medicalPriority: row.medicalPriority,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    state.students.push(student);
    state.rosterEntries.push({
      id: makeId("entry"),
      rosterId: roster.id,
      studentId: student.id,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  });

  addAudit(
    state,
    actor.id,
    "roster_imported",
    { periodId, rowCount: previewRows.length },
    { effectiveTeacherId: teacherId },
  );
};

export const formatDuration = (ms: number) => {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export const statusOrder = (status: PassStatus) => {
  switch (status) {
    case "return_offered":
      return 0;
    case "offered":
      return 1;
    case "returning":
      return 2;
    case "out":
      return 3;
    case "return_waiting":
      return 4;
    case "received":
      return 5;
    case "delayed":
      return 6;
    case "waiting":
      return 7;
    case "returned":
      return 8;
    case "dismissed":
      return 9;
    default:
      return 99;
  }
};
