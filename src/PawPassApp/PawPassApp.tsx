import React, { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  AppBar,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  Tabs,
  TextField,
  ThemeProvider,
  Toolbar,
  Tooltip,
  Typography,
  createTheme,
} from "@mui/material";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import AddIcon from "@mui/icons-material/Add";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import DashboardIcon from "@mui/icons-material/Dashboard";
import DeleteIcon from "@mui/icons-material/Delete";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import EditIcon from "@mui/icons-material/Edit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import FilterListIcon from "@mui/icons-material/FilterList";
import GoogleIcon from "@mui/icons-material/Google";
import GroupsIcon from "@mui/icons-material/Groups";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import MapIcon from "@mui/icons-material/Map";
import PrivacyTipIcon from "@mui/icons-material/PrivacyTip";
import RefreshIcon from "@mui/icons-material/Refresh";
import ReportIcon from "@mui/icons-material/Report";
import SettingsIcon from "@mui/icons-material/Settings";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  DestinationKey,
  ImportPreviewRow,
  PassRequest,
  PawPassState,
  SchedulePeriod,
  ScheduleTemplate,
  StaffUser,
  accountForEloper,
  activeDestinationRequestCount,
  activePassStatuses,
  addAudit,
  addStudentForRosterPeriods,
  advanceQueues,
  buildImportPreview,
  callStudentBackToClass,
  canViewAll,
  commitImportPreview,
  createInitialState,
  createEloperRequest,
  createPassRequest,
  destinationForStaffRole,
  destinationInboundStatuses,
  destinationLabels,
  dismissFromDestinationToClass,
  dismissRequest,
  formatDuration,
  getCurrentPeriod,
  getAutoFreezeWindow,
  getDestinationState,
  getEffectiveTeacherId,
  getGlobalSelectedScheduleId,
  getPersonalScheduleForSharedSchedule,
  getRosterStudents,
  getRoomState,
  getSchedule,
  getScheduleSelectionKey,
  getStudent,
  getStudentQueuePenaltyMs,
  getStudentUsername,
  getTeacherGroup,
  getTeacherName,
  getTeachers,
  getVisibleSchedules,
  getVisibleTeacherIds,
  isDestinationStaff,
  isDestinationBlocked,
  isValidStudentUsername,
  markRequestEloper,
  loadPawPassState,
  moveTeacherToGroup,
  permitRequest,
  receiveDestinationStudent,
  returnStudent,
  roleLabels,
  savePawPassState,
  setDestinationAutoBlockLimit,
  setDestinationBlocked,
  setRoomFrozen,
  settingsDefaults,
  softDeleteRosterStudent,
  specialDestinationKeys,
  statusOrder,
  teacherAwayStatuses,
  updateStudent,
  usernameHelpText,
} from "./pawPassStore";

const theme = createTheme({
  palette: {
    primary: { main: "#0f766e" },
    secondary: { main: "#4f46e5" },
    success: { main: "#15803d" },
    warning: { main: "#b45309" },
    error: { main: "#b91c1c" },
    background: {
      default: "#f5f7f6",
      paper: "#ffffff",
    },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily:
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    button: { textTransform: "none", fontWeight: 800 },
    h4: { fontWeight: 900 },
    h5: { fontWeight: 900 },
    h6: { fontWeight: 900 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
  },
});

type ViewKey = "home" | "inbound" | "rosters" | "elopers" | "map" | "reports" | "settings" | "terms";

const viewLabels: Record<ViewKey, string> = {
  home: "Home",
  inbound: "Inbound",
  rosters: "Edit Rosters",
  elopers: "Elopers",
  map: "Live Map",
  reports: "Reports",
  settings: "Settings",
  terms: "Terms",
};

const destinationKeys: DestinationKey[] = [
  "bathroom",
  "water_fountain",
  "nurse",
  "counselor",
  "office",
  "teacher_room",
  "library",
];

const destinationEmojis: Record<DestinationKey, string> = {
  bathroom: "🚻",
  water_fountain: "🚰",
  nurse: "⚕️",
  counselor: "💬",
  office: "🏢",
  teacher_room: "🚪",
  library: "📚",
  eloper: "🚨",
};

const requestActionKeys: DestinationKey[] = [...destinationKeys, "eloper"];

type ReportSortKey =
  | "requests_desc"
  | "requests_asc"
  | "username_asc"
  | "username_desc"
  | "avg_wait_desc"
  | "avg_wait_asc"
  | "avg_out_desc"
  | "avg_out_asc"
  | "elopers_desc"
  | "elopers_asc"
  | "penalty_desc"
  | "penalty_asc";

type ReportColumnKey = "student" | "teacher" | "requests" | "avgWait" | "avgOut" | "elopers" | "penalty";

const reportColumnOrder: ReportColumnKey[] = [
  "student",
  "teacher",
  "requests",
  "avgWait",
  "avgOut",
  "elopers",
  "penalty",
];

const reportColumnLabels: Record<ReportColumnKey, string> = {
  student: "Student",
  teacher: "Teacher",
  requests: "Requests",
  avgWait: "Avg Wait",
  avgOut: "Avg Out Non-Elopers",
  elopers: "Elopers",
  penalty: "Penalty",
};

const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const getRoomSnapshot = (state: PawPassState, teacherId: string) =>
  state.rooms.find((room) => room.teacherId === teacherId) || { teacherId, frozen: false };

const currentUserStorageKey = "paw-pass-current-user";
const localNicknamesStorageKey = "paw-pass-local-nicknames";

type LocalNicknameMap = Record<string, string>;
type LocalImportPreviewRow = ImportPreviewRow & { localNickname?: string };

const localNicknameKey = (teacherId: string, periodId: string, username: string) =>
  `${teacherId}::${periodId}::${username.toLowerCase()}`;

function normalizeNickname(value: unknown) {
  return String(value ?? "").trim().slice(0, 40);
}

function readCsvLocalNickname(row: Record<string, unknown>) {
  return normalizeNickname(
    String(row.nickname || row.nick_name || row.preferredName || row.preferred_name || ""),
  );
}

function loadLocalNicknames(): LocalNicknameMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(localNicknamesStorageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>)
            .filter(([, value]) => typeof value === "string")
            .map(([key, value]) => [key, normalizeNickname(value as string)])
            .filter(([, value]) => value),
        )
      : {};
  } catch {
    return {};
  }
}

function saveLocalNicknames(nicknames: LocalNicknameMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(localNicknamesStorageKey, JSON.stringify(nicknames));
}

function getLocalStudentDisplayName(
  state: PawPassState,
  nicknames: LocalNicknameMap,
  studentId: string,
  teacherId?: string,
  periodId?: string,
) {
  const username = getStudentUsername(state, studentId);
  if (teacherId && periodId) {
    return nicknames[localNicknameKey(teacherId, periodId, username)] || username;
  }
  if (teacherId) {
    const rosterIds = state.rosters
      .filter((roster) => roster.active && roster.teacherId === teacherId)
      .map((roster) => roster.id);
    const entry = state.rosterEntries.find(
      (item) => item.active && item.studentId === studentId && rosterIds.includes(item.rosterId),
    );
    const roster = entry ? state.rosters.find((item) => item.id === entry.rosterId) : undefined;
    if (roster) return nicknames[localNicknameKey(teacherId, roster.periodId, username)] || username;
  }
  return username;
}

function playDing() {
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const audio = new AudioContextClass();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audio.currentTime);
    oscillator.frequency.setValueAtTime(1175, audio.currentTime + 0.12);
    gain.gain.setValueAtTime(0.001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, audio.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.34);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.36);
  } catch {
    // Notification audio is best-effort only.
  }
}

function roleColor(role: StaffUser["role"]) {
  if (role === "teacher") return "primary";
  if (role === "substitute") return "warning";
  if (role === "admin") return "secondary";
  if (destinationForStaffRole(role)) return "success";
  return "default";
}

function formatTime(value?: number) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatPeriodClock(value?: number) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function displayStatus(status: PassRequest["status"]) {
  const labels: Record<PassRequest["status"], string> = {
    delayed: "pending",
    waiting: "pending",
    offered: "requesting",
    out: "out",
    received: "received",
    return_waiting: "pending return",
    return_offered: "return requesting",
    returning: "returning",
    returned: "returned",
    dismissed: "dismissed",
  };
  return labels[status];
}

function dateInputToStartMs(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function dateInputToEndMs(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function msToDateInput(value: number) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function msUntil(value: number | undefined, now: number) {
  if (!value) return 0;
  return Math.max(0, value - now);
}

function hhmmToMinutes(value: string) {
  const input = String(value || "").trim();
  const match = input.match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] || "0");
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes < 0 || minutes > 59) {
    return null;
  }
  const meridiem = match[3]?.toLowerCase().replace(/\./g, "");
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (meridiem === "pm" ? 12 : 0);
  } else if (hours < 0 || hours > 23) {
    return null;
  }
  return hours * 60 + minutes;
}

function minutesToHHMM(value: number) {
  const normalized = ((Math.round(value) % 1440) + 1440) % 1440;
  const hours = String(Math.floor(normalized / 60)).padStart(2, "0");
  const minutes = String(normalized % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function addMinutesToHHMM(start: string, durationMinutes: number) {
  const startMinutes = hhmmToMinutes(start);
  if (startMinutes === null) return "--:--";
  return minutesToHHMM(startMinutes + Math.max(1, Math.round(durationMinutes || 1)));
}

function periodDurationMinutes(period: SchedulePeriod) {
  const start = hhmmToMinutes(period.start);
  const end = hhmmToMinutes(period.end);
  if (start === null || end === null) return 45;
  return Math.max(1, end >= start ? end - start : end + 1440 - start);
}

function makePeriodId(label: string, index: number, usedIds: Set<string>) {
  const periodMatch = String(label || "").match(/period\s*(\d+)/i);
  const base = periodMatch
    ? `p${periodMatch[1]}`
    : String(label || `period-${index + 1}`)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || `period-${index + 1}`;
  let id = base;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(id);
  return id;
}

function DestinationArt({
  destination,
  size = 112,
}: {
  destination: DestinationKey;
  size?: number;
}) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        width: "100%",
        maxWidth: size,
        height: size,
        display: "grid",
        placeItems: "center",
        fontSize: Math.max(24, Math.round(size * 0.6)),
        lineHeight: 1,
      }}
    >
      {destinationEmojis[destination]}
    </Box>
  );
}

function SectionPaper({ children, sx = {} }: { children: React.ReactNode; sx?: object }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        borderColor: "rgba(15, 23, 42, 0.12)",
        borderRadius: 1,
        p: 2,
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}

function GoogleStaffSignIn() {
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";

  useEffect(() => {
    if (!clientId || !buttonRef.current) return;
    let cancelled = false;

    const render = () => {
      if (cancelled || !window.google || !buttonRef.current) return;
      buttonRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: clientId,
        login_uri: `${window.location.origin}/api/paw-pass/auth/google`,
        ux_mode: "redirect",
        auto_select: false,
        use_fedcm_for_prompt: true,
        use_fedcm_for_button: true,
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        shape: "rectangular",
        text: "signin_with",
      });
    };

    const existing = document.getElementById("google-identity-services");
    if (existing) {
      render();
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement("script");
    script.id = "google-identity-services";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = render;
    document.head.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (!clientId) {
    return (
      <Tooltip title="Set REACT_APP_GOOGLE_CLIENT_ID and the Paw Pass auth endpoint to enable real Google sign-in.">
        <span>
          <Button disabled variant="outlined" startIcon={<GoogleIcon />}>
            Google sign-in
          </Button>
        </span>
      </Tooltip>
    );
  }

  return <Box ref={buttonRef} sx={{ minWidth: 220, minHeight: 44 }} />;
}

function LoginScreen({
  state,
  onSignIn,
}: {
  state: PawPassState;
  onSignIn: (user: StaffUser) => void;
}) {
  const [accepted, setAccepted] = useState(false);
  const demoUsers = state.staffUsers.filter((user) => user.active);

  return (
    <ThemeProvider theme={theme}>
      <Box
        minHeight="100vh"
        sx={{
          bgcolor: "background.default",
          display: "grid",
          placeItems: "center",
          p: 2,
        }}
      >
        <Box sx={{ width: "min(1040px, 100%)" }}>
          <Stack spacing={2.5}>
            <Stack spacing={0.5}>
              <Typography variant="h4">Paw Pass</Typography>
              <Typography color="text.secondary">
                Staff-operated hallway pass management for teachers, substitutes, admin, and security.
              </Typography>
            </Stack>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "0.85fr 1.15fr" },
                gap: 2,
              }}
            >
              <SectionPaper>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PrivacyTipIcon color="primary" />
                    <Typography variant="h6">Staff Disclosure</Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Paw Pass is for authorized school staff only. Students should not log in, operate
                    the app, upload files, or view records. Staff are responsible for using it only
                    for legitimate student safety and supervision needs.
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    The app is designed to minimize student data: classroom screens use usernames,
                    not full names, and internal student ids should be fingerprinted on the server
                    rather than displayed.
                  </Typography>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={accepted}
                        onChange={(event) => setAccepted(event.target.checked)}
                      />
                    }
                    label="I am authorized school staff and accept the staff-only terms."
                  />
                  <GoogleStaffSignIn />
                </Stack>
              </SectionPaper>

              <SectionPaper>
                <Stack spacing={1.5}>
                  <Typography variant="h6">Local Pitch Sign-In</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Use these demo staff accounts until Google OAuth and Postgres are configured
                    for your school domain.
                  </Typography>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                      gap: 1,
                    }}
                  >
                    {demoUsers.map((user) => (
                      <Button
                        key={user.id}
                        variant="outlined"
                        disabled={!accepted}
                        onClick={() => onSignIn(user)}
                        sx={{
                          justifyContent: "flex-start",
                          minHeight: 78,
                          p: 1.25,
                        }}
                      >
                        <Stack direction="row" spacing={1.25} alignItems="center" width="100%">
                          <Avatar sx={{ bgcolor: "#0f766e" }}>
                            {user.displayName.slice(0, 1)}
                          </Avatar>
                          <Box textAlign="left" minWidth={0}>
                            <Typography fontWeight={900} noWrap>
                              {user.displayName}
                            </Typography>
                            <Chip
                              size="small"
                              color={roleColor(user.role)}
                              label={roleLabels[user.role]}
                            />
                          </Box>
                        </Stack>
                      </Button>
                    ))}
                  </Box>
                </Stack>
              </SectionPaper>
            </Box>
          </Stack>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

function Sidebar({
  view,
  setView,
  user,
  activeEloperCount,
  scheduleWarningCount,
  onNavigate,
}: {
  view: ViewKey;
  setView: (view: ViewKey) => void;
  user: StaffUser;
  activeEloperCount: number;
  scheduleWarningCount: number;
  onNavigate?: () => void;
}) {
  const destinationStaff = isDestinationStaff(user);
  const items: Array<{
    key: ViewKey;
    label: string;
    icon: React.ReactNode;
    adminOnly?: boolean;
  }> = destinationStaff
    ? [
        { key: "inbound", label: "Inbound", icon: <AssignmentIndIcon /> },
        { key: "settings", label: "Settings", icon: <SettingsIcon /> },
        { key: "terms", label: "Terms", icon: <PrivacyTipIcon /> },
      ]
    : [
        { key: "home", label: "Home", icon: <DashboardIcon /> },
        { key: "rosters", label: "Edit Rosters", icon: <AssignmentIndIcon /> },
        { key: "elopers", label: "Elopers", icon: <ReportIcon /> },
        { key: "map", label: "Live Map", icon: <MapIcon /> },
        { key: "reports", label: "Reports", icon: <FactCheckIcon /> },
        { key: "settings", label: "Settings", icon: <SettingsIcon /> },
        { key: "terms", label: "Terms", icon: <PrivacyTipIcon /> },
      ];

  return (
    <Box
      component="nav"
      sx={{
        borderRight: "1px solid rgba(15, 23, 42, 0.12)",
        bgcolor: "#ffffff",
        minHeight: { md: "100vh" },
        position: { md: "sticky" },
        top: 0,
      }}
    >
      <Box sx={{ p: 2 }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: 1,
              display: "grid",
              placeItems: "center",
              bgcolor: "#0f766e",
              color: "white",
              fontWeight: 900,
            }}
          >
            PP
          </Box>
          <Box>
            <Typography variant="h6" lineHeight={1}>
              Paw Pass
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Staff console
            </Typography>
          </Box>
        </Stack>
      </Box>
      <Divider />
      <List sx={{ p: 1 }}>
        {items
          .filter((item) => !item.adminOnly || user.role === "admin")
          .map((item) => (
            <ListItemButton
              key={item.key}
              selected={view === item.key}
              onClick={() => {
                setView(item.key);
                onNavigate?.();
              }}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                "&.Mui-selected": {
                  bgcolor: "#0f766e",
                  color: "white",
                  "& .MuiListItemIcon-root": { color: "white" },
                  "&:hover": { bgcolor: "#115e59" },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 38 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
              {item.key === "elopers" && activeEloperCount > 0 ? (
                <Chip size="small" color="error" label={activeEloperCount} />
              ) : null}
              {item.key === "settings" && scheduleWarningCount > 0 ? (
                <Tooltip title={`${scheduleWarningCount} schedule update warning${scheduleWarningCount === 1 ? "" : "s"}`}>
                  <Chip
                    size="small"
                    color="warning"
                    icon={<WarningAmberIcon sx={{ fontSize: 16 }} />}
                    label={scheduleWarningCount}
                    sx={{ fontWeight: 900 }}
                  />
                </Tooltip>
              ) : null}
            </ListItemButton>
          ))}
      </List>
    </Box>
  );
}

function PeriodCarousel({
  state,
  user,
  now,
  onSelectPeriod,
}: {
  state: PawPassState;
  user: StaffUser;
  now: number;
  onSelectPeriod: (periodId: string) => void;
}) {
  const schedule = getSchedule(state, user);
  const currentPeriod = getCurrentPeriod(state, new Date(now), user);
  const selectedPeriodRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const [periodDetails, setPeriodDetails] = useState<SchedulePeriod | null>(null);

  useEffect(() => {
    selectedPeriodRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [currentPeriod.id, schedule.id]);

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  useEffect(
    () => () => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    },
    [],
  );

  const startLongPress = (event: React.PointerEvent, period: SchedulePeriod) => {
    if (event.pointerType === "mouse") return;
    longPressTriggeredRef.current = false;
    clearLongPress();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setPeriodDetails(period);
    }, 550);
  };

  return (
    <Box sx={{ px: { xs: 1, sm: 2 }, pb: 1.25 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            gap: 0.75,
            overflowX: "auto",
            overflowY: "hidden",
            scrollSnapType: "x proximity",
            scrollbarWidth: "none",
            WebkitOverflowScrolling: "touch",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          <Box sx={{ flex: "0 0 calc(50% - 48px)" }} />
          {schedule.periods.map((period) => {
            const selected = currentPeriod.id === period.id;
            return (
              <Box
                key={period.id}
                ref={selected ? selectedPeriodRef : undefined}
                sx={{ flex: "0 0 auto", scrollSnapAlign: "center" }}
              >
                <Tooltip title={`${period.label}: ${period.start}-${period.end}`}>
                  <Chip
                    label={period.label}
                    color={selected ? "primary" : "default"}
                    variant={selected ? "filled" : "outlined"}
                    onPointerDown={(event) => startLongPress(event, period)}
                    onPointerUp={clearLongPress}
                    onPointerCancel={clearLongPress}
                    onPointerLeave={clearLongPress}
                    onClick={() => {
                      if (longPressTriggeredRef.current) {
                        longPressTriggeredRef.current = false;
                        return;
                      }
                      onSelectPeriod(period.id);
                    }}
                    sx={{
                      minWidth: 76,
                      fontWeight: selected ? 900 : 700,
                    }}
                  />
                </Tooltip>
              </Box>
            );
          })}
          <Box sx={{ flex: "0 0 calc(50% - 48px)" }} />
        </Box>
        <Typography
          variant="body2"
          sx={{
            flex: "0 0 auto",
            minWidth: 74,
            textAlign: "right",
            fontWeight: 900,
            color: "#0f766e",
            bgcolor: "rgba(15, 118, 110, 0.1)",
            border: "1px solid rgba(15, 118, 110, 0.22)",
            borderRadius: 1,
            px: 0.75,
            py: 0.25,
            lineHeight: 1.2,
          }}
        >
          {formatPeriodClock(now)}
        </Typography>
      </Stack>
      <Dialog open={Boolean(periodDetails)} onClose={() => setPeriodDetails(null)} fullWidth maxWidth="xs">
        <DialogTitle>{periodDetails?.label}</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Start
            </Typography>
            <Typography variant="h6">{periodDetails?.start}</Typography>
            <Typography variant="body2" color="text.secondary">
              End
            </Typography>
            <Typography variant="h6">{periodDetails?.end}</Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button variant="contained" onClick={() => setPeriodDetails(null)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
function TopBar({
  state,
  user,
  activeView,
  effectiveTeacherId,
  now,
  onMutate,
  onLogout,
  onOpenMenu,
}: {
  state: PawPassState;
  user: StaffUser;
  activeView: ViewKey;
  effectiveTeacherId: string;
  now: number;
  onMutate: (mutator: (draft: PawPassState) => void) => void;
  onLogout: () => void;
  onOpenMenu: () => void;
}) {
  const teachers = getTeachers(state);
  const actingOptions =
    user.role === "admin"
      ? [{ id: user.id, displayName: `${user.displayName} (Admin)` }, ...teachers]
      : teachers;
  const quiet = state.quietModeByUserId[user.id] ?? state.settings.quietModeDefault;
  const staffDestination = destinationForStaffRole(user.role);
  const scheduleProfileUser =
    teachers.find((teacher) => teacher.id === effectiveTeacherId) || user;

  if (staffDestination) {
    return (
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: "1px solid rgba(15, 23, 42, 0.12)" }}
      >
        <Toolbar sx={{ gap: { xs: 0.75, sm: 1.5 }, flexWrap: "nowrap", py: 1 }}>
          <Stack direction="row" spacing={{ xs: 0.5, sm: 1 }} alignItems="center" sx={{ width: "100%", minWidth: 0 }}>
            <Tooltip title="Open menu">
              <IconButton
                onClick={onOpenMenu}
                sx={{ display: { xs: "inline-flex", md: "none" }, flex: "0 0 auto" }}
              >
                <MenuIcon />
              </IconButton>
            </Tooltip>
            <Typography
              fontWeight={900}
              sx={{
                display: { xs: "block", md: "none" },
                flex: "0 0 auto",
                whiteSpace: "nowrap",
              }}
            >
              {viewLabels[activeView]}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ width: { xs: 42, sm: 54 }, flex: "0 0 auto" }}>
                <DestinationArt destination={staffDestination} size={48} />
              </Box>
              <Box minWidth={0}>
                <Typography variant="h6" lineHeight={1.1} noWrap>
                  {destinationLabels[staffDestination]} Desk
                </Typography>
                <Chip size="small" color="success" label="Inbound students" sx={{ display: { xs: "none", sm: "inline-flex" } }} />
              </Box>
            </Stack>

            <Tooltip title={quiet ? "Quiet mode on" : "Quiet mode off"}>
              <IconButton
                onClick={() => {
                  onMutate((draft) => {
                    const next = !(draft.quietModeByUserId[user.id] ?? draft.settings.quietModeDefault);
                    draft.quietModeByUserId[user.id] = next;
                    addAudit(draft, user.id, "quiet_mode_changed", { quiet: next });
                  });
                }}
                sx={{ flex: "0 0 auto" }}
              >
                {quiet ? <VolumeOffIcon /> : <VolumeUpIcon />}
              </IconButton>
            </Tooltip>

            <Stack direction="row" spacing={{ xs: 0.25, sm: 1 }} alignItems="center" sx={{ flex: "0 0 auto" }}>
              <Tooltip title={`${user.displayName} - ${roleLabels[user.role]}`}>
                <Avatar sx={{ width: 34, height: 34, bgcolor: "#0f766e" }}>
                  {user.displayName.slice(0, 1)}
                </Avatar>
              </Tooltip>
              <Tooltip title="Sign out">
                <IconButton onClick={onLogout}>
                  <LogoutIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Toolbar>
      </AppBar>
    );
  }

  const selectTeacher = (teacherId: string) => {
    onMutate((draft) => {
      const actor = draft.staffUsers.find((item) => item.id === user.id);
      if (!actor) return;
      actor.subbingForTeacherId = teacherId;
      addAudit(
        draft,
        actor.id,
        "substitute_teacher_selected",
        { selectedTeacherId: teacherId },
        { effectiveTeacherId: teacherId },
      );
    });
  };

  const selectPeriod = (periodId: string) => {
    onMutate((draft) => {
      draft.periodOverrideId = periodId;
      addAudit(
        draft,
        user.id,
        "period_override_changed",
        { periodOverrideId: periodId },
        { effectiveTeacherId },
      );
    });
  };

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{ borderBottom: "1px solid rgba(15, 23, 42, 0.12)" }}
    >
      <Toolbar sx={{ gap: { xs: 0.75, sm: 1.5 }, flexWrap: "wrap", py: 1 }}>
        <Stack
          direction="row"
          spacing={{ xs: 0.5, sm: 1 }}
          alignItems="center"
          sx={{ width: { xs: "100%", sm: "auto" }, flex: { xs: "0 0 100%", sm: 1 }, minWidth: 0 }}
        >
          <Tooltip title="Open menu">
            <IconButton
              onClick={onOpenMenu}
              sx={{ display: { xs: "inline-flex", md: "none" }, flex: "0 0 auto" }}
            >
              <MenuIcon />
            </IconButton>
          </Tooltip>
          <Typography
            fontWeight={900}
            sx={{
              display: { xs: "block", md: "none" },
              flex: "0 0 auto",
              whiteSpace: "nowrap",
            }}
          >
            {viewLabels[activeView]}
          </Typography>
          <Box sx={{ flex: 1, minWidth: 0 }}>
          {user.role === "substitute" ? (
            <Chip
              size="small"
              color="warning"
              label={`Audit actor: ${user.displayName}`}
              sx={{ maxWidth: "100%" }}
            />
          ) : null}
          </Box>

          <Tooltip title={quiet ? "Quiet mode on" : "Quiet mode off"}>
            <IconButton
              onClick={() => {
                onMutate((draft) => {
                  const next = !(draft.quietModeByUserId[user.id] ?? draft.settings.quietModeDefault);
                  draft.quietModeByUserId[user.id] = next;
                  addAudit(draft, user.id, "quiet_mode_changed", { quiet: next }, { effectiveTeacherId });
                });
              }}
              sx={{ flex: "0 0 auto" }}
            >
              {quiet ? <VolumeOffIcon /> : <VolumeUpIcon />}
            </IconButton>
          </Tooltip>

          <Stack direction="row" spacing={{ xs: 0.25, sm: 1 }} alignItems="center" sx={{ flex: "0 0 auto" }}>
            <Tooltip title={`${user.displayName} - ${roleLabels[user.role]}`}>
              <Avatar sx={{ width: 34, height: 34, bgcolor: "#0f766e" }}>
                {user.displayName.slice(0, 1)}
              </Avatar>
            </Tooltip>
            <Tooltip title="Sign out">
              <IconButton onClick={onLogout}>
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {(user.role === "substitute" || canViewAll(user)) && (
          <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 210 }, width: { xs: "100%", sm: "auto" } }}>
            <InputLabel id="acting-teacher-label">Acting for</InputLabel>
            <Select
              labelId="acting-teacher-label"
              label="Acting for"
              value={effectiveTeacherId}
              onChange={(event) => selectTeacher(String(event.target.value))}
            >
              {actingOptions.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  {option.displayName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Toolbar>
      <PeriodCarousel
        state={state}
        user={scheduleProfileUser}
        now={now}
        onSelectPeriod={selectPeriod}
      />
    </AppBar>
  );
}

function RequestDestinationDialog({
  open,
  state,
  studentUsername,
  onClose,
  onSelect,
}: {
  open: boolean;
  state: PawPassState;
  studentUsername: string;
  onClose: () => void;
  onSelect: (destination: DestinationKey) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Request for {studentUsername}</DialogTitle>
      <DialogContent>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 1.25,
            pt: 1,
          }}
        >
          {requestActionKeys.map((destination) => {
            const blocked = destination !== "eloper" && isDestinationBlocked(state, destination);
            return (
                <Tooltip
                  key={destination}
                  title={
                    blocked
                    ? `${destinationLabels[destination]} is paused`
                    : destinationLabels[destination]
                  }
                >
                <span>
                  <Button
                    aria-label={destinationLabels[destination]}
                    variant="outlined"
                    disabled={blocked}
                    onClick={() => onSelect(destination)}
                    sx={{
                      aspectRatio: "1 / 1",
                      minWidth: 0,
                      p: 1,
                      bgcolor: destination === "eloper" ? "#fef2f2" : "#f8fafc",
                      borderColor: destination === "eloper" ? "#fca5a5" : undefined,
                      "&:hover": { bgcolor: destination === "eloper" ? "#fee2e2" : "#e8f4f1" },
                    }}
                  >
                    <DestinationArt destination={destination} />
                  </Button>
                </span>
              </Tooltip>
            );
          })}
        </Box>
      </DialogContent>
    </Dialog>
  );
}

function HomeView({
  state,
  user,
  effectiveTeacherId,
  localNicknames,
  now,
  onMutate,
}: {
  state: PawPassState;
  user: StaffUser;
  effectiveTeacherId: string;
  localNicknames: LocalNicknameMap;
  now: number;
  onMutate: (mutator: (draft: PawPassState) => void) => void;
}) {
  const [tab, setTab] = useState(0);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [requestNotice, setRequestNotice] = useState<{
    id: number;
    message: string;
    severity: "success" | "info" | "warning";
  } | null>(null);
  const lastDingRef = useRef("");
  const currentPeriod = getCurrentPeriod(state, new Date(now), user);
  const autoFreezeWindow = getAutoFreezeWindow(state, new Date(now), user);
  const room = getRoomSnapshot(state, effectiveTeacherId);
  const group = getTeacherGroup(state, effectiveTeacherId);
  const rosterStudents = getRosterStudents(state, effectiveTeacherId, currentPeriod.id);
  const quiet = state.quietModeByUserId[user.id] ?? state.settings.quietModeDefault;
  const activeEloperRequestIds = new Set(
    state.elopers.filter((eloper) => eloper.active).map((eloper) => eloper.requestId),
  );

  const offered = state.requests
    .filter(
      (request) =>
        request.teacherId === effectiveTeacherId &&
        request.status === "offered" &&
        !activeEloperRequestIds.has(request.id),
    )
    .sort((left, right) => left.requestedAt - right.requestedAt);
  const returnOffered = state.requests
    .filter(
      (request) =>
        request.teacherId === effectiveTeacherId &&
        request.status === "return_offered" &&
        !activeEloperRequestIds.has(request.id),
    )
    .sort((left, right) => Number(left.returnRequestedAt || left.requestedAt) - Number(right.returnRequestedAt || right.requestedAt));
  const activeAway = state.requests
    .filter(
      (request) =>
        request.teacherId === effectiveTeacherId &&
        teacherAwayStatuses.includes(request.status) &&
        !activeEloperRequestIds.has(request.id),
    )
    .sort((left, right) => Number(left.permittedAt || 0) - Number(right.permittedAt || 0));
  const groupNormalOut = state.requests.find(
    (request) =>
      request.groupId === group.id &&
      request.status === "out" &&
      !request.isMedicalOverride &&
      !activeEloperRequestIds.has(request.id) &&
      !specialDestinationKeys.includes(request.destination),
  );
  useEffect(() => {
    const ids = [...returnOffered, ...offered].map((request) => request.id).join("|");
    if (ids && ids !== lastDingRef.current && !quiet) {
      playDing();
    }
    lastDingRef.current = ids;
  }, [offered, quiet, returnOffered]);

  const queuePositionForRequest = (draft: PawPassState, requestId: string) => {
    const request = draft.requests.find((item) => item.id === requestId);
    if (!request) return null;
    const isActiveEloper = (item: PassRequest) =>
      draft.elopers.some((eloper) => eloper.requestId === item.id && eloper.active);
    const visibleQueue = draft.requests.filter(
      (item) =>
        (item.groupId === request.groupId || specialDestinationKeys.includes(item.destination)) &&
        activePassStatuses.includes(item.status) &&
        item.status !== "delayed" &&
        !isActiveEloper(item),
    );
    const index = visibleQueue.findIndex((item) => item.id === requestId);
    return index >= 0 ? index + 1 : null;
  };

  const requestForStudent = (destination: DestinationKey) => {
    if (!selectedStudentId) return;
    let nextNotice: typeof requestNotice = null;
    onMutate((draft) => {
      const actor = draft.staffUsers.find((item) => item.id === user.id);
      if (!actor) return;
      const studentName = getLocalStudentDisplayName(
        draft,
        localNicknames,
        selectedStudentId,
        effectiveTeacherId,
        currentPeriod.id,
      );
      if (destination === "eloper") {
        createEloperRequest(
          draft,
          actor,
          effectiveTeacherId,
          currentPeriod.id,
          selectedStudentId,
        );
        advanceQueues(draft);
        nextNotice = {
          id: Date.now(),
          message: `${studentName} was marked as an eloper.`,
          severity: "warning",
        };
      } else {
        const request = createPassRequest(
          draft,
          actor,
          effectiveTeacherId,
          currentPeriod.id,
          destination,
          selectedStudentId,
        );
        advanceQueues(draft);
        if (request.status === "delayed" && request.delayUntil) {
          const remainingMinutes = Math.max(1, Math.ceil((request.delayUntil - Date.now()) / 60_000));
          nextNotice = {
            id: Date.now(),
            message: `${studentName} will be added to queue in ${remainingMinutes} ${remainingMinutes === 1 ? "min" : "mins"}.`,
            severity: "info",
          };
        } else {
          const position = queuePositionForRequest(draft, request.id);
          nextNotice = {
            id: Date.now(),
            message: `${studentName} was added to queue${position ? ` at #${position}` : ""}.`,
            severity: "success",
          };
        }
      }
    });
    if (nextNotice) setRequestNotice(nextNotice);
    setSelectedStudentId("");
    setTab(0);
  };

  const toggleFreeze = () => {
    onMutate((draft) => {
      const actor = draft.staffUsers.find((item) => item.id === user.id);
      if (!actor) return;
      setRoomFrozen(draft, actor, effectiveTeacherId, !getRoomState(draft, effectiveTeacherId).frozen);
      advanceQueues(draft);
    });
  };

  return (
    <Stack spacing={2}>
      {autoFreezeWindow ? (
        <Alert severity="info">
          Auto-freeze is active at the {autoFreezeWindow.phase} of {autoFreezeWindow.period.label}. Requests can line up, but new hall departures wait.
        </Alert>
      ) : null}

      <SectionPaper sx={{ p: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Tabs
            value={tab}
            onChange={(_, value) => setTab(value)}
            aria-label="Paw Pass home tabs"
            sx={{ flex: 1, minWidth: 0 }}
          >
            <Tab label="Active" />
            <Tab label="Request" />
          </Tabs>
          <Tooltip title={room.frozen ? "Thaw requests" : "Freeze requests"}>
            <IconButton
              aria-label={room.frozen ? "Thaw requests" : "Freeze requests"}
              onClick={toggleFreeze}
              sx={{
                mr: 1,
                color: room.frozen ? "#075985" : "#0f766e",
                bgcolor: room.frozen ? "#e0f2fe" : "transparent",
                border: room.frozen ? "1px solid #7dd3fc" : "1px solid transparent",
                "&:hover": {
                  bgcolor: room.frozen ? "#bae6fd" : "rgba(15, 118, 110, 0.08)",
                },
              }}
            >
              <AcUnitIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </SectionPaper>

      {tab === 0 ? (
        <Stack spacing={2}>
          {returnOffered.map((request) => (
            <ReturnCallPanel
              key={request.id}
              state={state}
              request={request}
              localNicknames={localNicknames}
              now={now}
              onCallBack={() =>
                onMutate((draft) => {
                  const actor = draft.staffUsers.find((item) => item.id === user.id);
                  if (!actor) return;
                  callStudentBackToClass(draft, actor, request.id);
                  advanceQueues(draft);
                })
              }
            />
          ))}

          {offered.map((request) => (
            <OfferPanel
              key={request.id}
              state={state}
              request={request}
              localNicknames={localNicknames}
              now={now}
              onPermit={() =>
                onMutate((draft) => {
                  const actor = draft.staffUsers.find((item) => item.id === user.id);
                  if (!actor) return;
                  permitRequest(draft, actor, request.id);
                  advanceQueues(draft);
                })
              }
              onDismiss={() =>
                onMutate((draft) => {
                  const actor = draft.staffUsers.find((item) => item.id === user.id);
                  if (!actor) return;
                  dismissRequest(draft, actor, request.id);
                  advanceQueues(draft);
                })
              }
            />
          ))}

          {activeAway.map((request) => (
            <ActiveAwayPanel
              key={request.id}
              state={state}
              request={request}
              localNicknames={localNicknames}
              now={now}
              onReturn={() =>
                onMutate((draft) => {
                  const actor = draft.staffUsers.find((item) => item.id === user.id);
                  if (!actor) return;
                  returnStudent(draft, actor, request.id);
                  advanceQueues(draft);
                })
              }
            />
          ))}

          {!returnOffered.length && !offered.length && !activeAway.length ? (
            <Paper
              variant="outlined"
              sx={{
                minHeight: 230,
                borderRadius: 1,
                bgcolor: groupNormalOut ? "#b91c1c" : "#f8fafc",
                color: groupNormalOut ? "white" : "text.primary",
                display: "grid",
                placeItems: "center",
                textAlign: "center",
                p: 3,
              }}
            >
              <Stack spacing={1} alignItems="center">
                <Typography variant="h4">
                  {groupNormalOut ? "Occupied" : "No Active Pass"}
                </Typography>
                <Typography sx={{ maxWidth: 560, opacity: groupNormalOut ? 0.92 : 0.72 }}>
                  {groupNormalOut
                    ? `${getLocalStudentDisplayName(
                        state,
                        localNicknames,
                        groupNormalOut.studentId,
                        groupNormalOut.teacherId,
                        groupNormalOut.periodId,
                      )} from ${getTeacherName(
                        state,
                        groupNormalOut.teacherId,
                      )} is out. Your queued students keep their position.`
                    : "No student from this room is out or requesting right now."}
                </Typography>
              </Stack>
            </Paper>
          ) : null}

        </Stack>
      ) : (
        <SectionPaper sx={{ position: "relative", overflow: "hidden" }}>
          <Stack spacing={2}>
            {rosterStudents.length ? (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "repeat(2, minmax(0, 1fr))",
                    sm: "repeat(3, minmax(0, 1fr))",
                    lg: "repeat(5, minmax(0, 1fr))",
                  },
                  gap: 1,
                }}
              >
                {rosterStudents.map((student) => {
                  const activeEloper = state.elopers.find(
                    (eloper) =>
                      eloper.active &&
                      eloper.studentId === student.id &&
                      eloper.teacherId === effectiveTeacherId,
                  );
                  const cancellableRequest = state.requests.find(
                    (request) =>
                      request.studentId === student.id &&
                      request.teacherId === effectiveTeacherId &&
                      ["waiting", "delayed", "offered"].includes(request.status),
                  );
                  const alreadyAway = state.requests.some(
                    (request) =>
                      request.studentId === student.id &&
                      request.teacherId === effectiveTeacherId &&
                      ["out", "received", "return_waiting", "return_offered", "returning"].includes(request.status),
                  );
                  const displayName = getLocalStudentDisplayName(
                    state,
                    localNicknames,
                    student.id,
                    effectiveTeacherId,
                    currentPeriod.id,
                  );
                  return (
                    <Button
                      key={student.id}
                      variant="contained"
                      disabled={
                        (room.frozen && !cancellableRequest && !activeEloper) ||
                        (alreadyAway && !activeEloper)
                      }
                      onClick={() => {
                        if (activeEloper) {
                          onMutate((draft) => {
                            const actor = draft.staffUsers.find((item) => item.id === user.id);
                            if (!actor) return;
                            accountForEloper(draft, actor, activeEloper.id);
                            advanceQueues(draft);
                          });
                          return;
                        }
                        if (cancellableRequest) {
                          onMutate((draft) => {
                            const actor = draft.staffUsers.find((item) => item.id === user.id);
                            if (!actor) return;
                            dismissRequest(draft, actor, cancellableRequest.id);
                            advanceQueues(draft);
                          });
                          return;
                        }
                        setSelectedStudentId(student.id);
                      }}
                      sx={{
                        minHeight: 86,
                        fontSize: { xs: 15, sm: 17 },
                        overflowWrap: "anywhere",
                        bgcolor: activeEloper
                          ? "#b91c1c"
                          : cancellableRequest
                          ? "#64748b"
                          : student.medicalPriority
                            ? "#0f766e"
                            : "#1f2937",
                        "&:hover": {
                          bgcolor: activeEloper
                            ? "#991b1b"
                            : cancellableRequest
                            ? "#475569"
                            : student.medicalPriority
                              ? "#115e59"
                              : "#111827",
                        },
                      }}
                    >
                      <Stack spacing={0.5} alignItems="center">
                        <span>{displayName}</span>
                        {displayName !== student.username ? (
                          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.78)" }}>
                            {student.username}
                          </Typography>
                        ) : null}
                        {activeEloper ? (
                          <Chip
                            size="small"
                            label="Eloper"
                            sx={{
                              bgcolor: "rgba(255,255,255,0.92)",
                              color: "#991b1b",
                              fontWeight: 900,
                            }}
                          />
                        ) : null}
                        {!activeEloper && cancellableRequest ? <Chip size="small" label="Requested" /> : null}
                        {student.medicalPriority ? <Chip size="small" color="success" label="Medical" /> : null}
                      </Stack>
                    </Button>
                  );
                })}
              </Box>
            ) : (
              <Alert severity="info">
                No roster is loaded for {currentPeriod.label}. Use Edit Rosters to add students or import a CSV.
              </Alert>
            )}
          </Stack>
          {room.frozen ? (
            <Box
              aria-hidden="true"
              sx={{
                position: "absolute",
                inset: 0,
                zIndex: 1,
                pointerEvents: "none",
                background:
                  "radial-gradient(circle at center, rgba(224, 242, 254, 0.18) 0%, rgba(186, 230, 253, 0.38) 58%, rgba(14, 165, 233, 0.3) 100%)",
                boxShadow: "inset 0 0 92px rgba(14, 165, 233, 0.55)",
              }}
            />
          ) : null}
        </SectionPaper>
      )}

      <RequestDestinationDialog
        open={Boolean(selectedStudentId)}
        state={state}
        studentUsername={
          selectedStudentId
            ? getLocalStudentDisplayName(
                state,
                localNicknames,
                selectedStudentId,
                effectiveTeacherId,
                currentPeriod.id,
              )
            : ""
        }
        onClose={() => setSelectedStudentId("")}
        onSelect={requestForStudent}
      />
      <Snackbar
        key={requestNotice?.id}
        open={Boolean(requestNotice)}
        autoHideDuration={4000}
        onClose={(_, reason) => {
          if (reason !== "clickaway") setRequestNotice(null);
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={requestNotice?.severity || "success"}
          variant="filled"
          onClose={() => setRequestNotice(null)}
          sx={{ width: "100%" }}
        >
          {requestNotice?.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
}

function OfferPanel({
  state,
  request,
  localNicknames,
  now,
  onPermit,
  onDismiss,
}: {
  state: PawPassState;
  request: PassRequest;
  localNicknames: LocalNicknameMap;
  now: number;
  onPermit: () => void;
  onDismiss: () => void;
}) {
  const remaining = msUntil(request.offerExpiresAt, now);
  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 1,
        bgcolor: "#15803d",
        color: "white",
        minHeight: 260,
        p: 3,
      }}
    >
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
          <Box flex={1}>
            <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.78)" }}>
              Requesting
            </Typography>
            <Typography variant="h4" sx={{ overflowWrap: "anywhere" }}>
              {getLocalStudentDisplayName(
                state,
                localNicknames,
                request.studentId,
                request.teacherId,
                request.periodId,
              )}
            </Typography>
            <Typography sx={{ opacity: 0.9 }}>
              {destinationLabels[request.destination]} - respond in {formatDuration(remaining)}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.82 }}>
              {request.queueReason}
            </Typography>
          </Box>
          <Box sx={{ width: 130, color: "white" }}>
            <DestinationArt destination={request.destination} />
          </Box>
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button
            variant="contained"
            onClick={onPermit}
            sx={{
              bgcolor: "white",
              color: "#14532d",
              minHeight: 58,
              px: 3,
              fontSize: 20,
              "&:hover": { bgcolor: "#ecfdf5" },
            }}
          >
            Permit
          </Button>
          <Button color="inherit" variant="outlined" onClick={onDismiss} sx={{ color: "white", borderColor: "white" }}>
            Dismiss
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

function ReturnCallPanel({
  state,
  request,
  localNicknames,
  now,
  onCallBack,
}: {
  state: PawPassState;
  request: PassRequest;
  localNicknames: LocalNicknameMap;
  now: number;
  onCallBack: () => void;
}) {
  const remaining = msUntil(request.returnOfferExpiresAt, now);
  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 1,
        bgcolor: "#0f766e",
        color: "white",
        minHeight: 240,
        p: 3,
      }}
    >
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
          <Box flex={1}>
            <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.78)" }}>
              Return To Learning
            </Typography>
            <Typography variant="h4" sx={{ overflowWrap: "anywhere" }}>
              {getLocalStudentDisplayName(
                state,
                localNicknames,
                request.studentId,
                request.teacherId,
                request.periodId,
              )}
            </Typography>
            <Typography sx={{ opacity: 0.92 }}>
              {destinationLabels[request.destination]} dismissed this student. Call them back in{" "}
              {formatDuration(remaining)}.
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.82 }}>
              Return calls are prioritized before new hallway departures.
            </Typography>
          </Box>
          <Box sx={{ width: 130, color: "white" }}>
            <DestinationArt destination={request.destination} />
          </Box>
        </Stack>
        <Button
          variant="contained"
          onClick={onCallBack}
          sx={{
            bgcolor: "white",
            color: "#115e59",
            minHeight: 62,
            px: 3,
            fontSize: 20,
            "&:hover": { bgcolor: "#ecfdf5" },
          }}
        >
          Call Back
        </Button>
      </Stack>
    </Paper>
  );
}

function ActiveAwayPanel({
  state,
  request,
  localNicknames,
  now,
  onReturn,
}: {
  state: PawPassState;
  request: PassRequest;
  localNicknames: LocalNicknameMap;
  now: number;
  onReturn: () => void;
}) {
  const elapsed = request.permittedAt ? now - request.permittedAt : 0;
  const remaining = msUntil(request.dueAt, now);
  const receivedBy = request.receivedByUserId
    ? state.staffUsers.find((staff) => staff.id === request.receivedByUserId)?.displayName
    : "";
  const statusCopy: Record<string, { overline: string; detail: string; color: string; button: boolean }> = {
    out: {
      overline: "Occupied",
      detail: `${destinationLabels[request.destination]} - out for ${formatDuration(elapsed)}`,
      color: "#b91c1c",
      button: true,
    },
    received: {
      overline: "Received",
      detail: `${receivedBy || destinationLabels[request.destination]} received this student${
        request.receivedAt ? ` at ${formatTime(request.receivedAt)}` : ""
      }.`,
      color: "#166534",
      button: false,
    },
    return_waiting: {
      overline: "Waiting To Return",
      detail: `${destinationLabels[request.destination]} dismissed this student back to class. They are waiting for a teacher call.`,
      color: "#92400e",
      button: false,
    },
    returning: {
      overline: "Returning",
      detail: `Called back from ${destinationLabels[request.destination]}${
        request.returnCalledAt ? ` at ${formatTime(request.returnCalledAt)}` : ""
      }. Mark returned when they arrive.`,
      color: "#7f1d1d",
      button: true,
    },
  };
  const content = statusCopy[request.status] || statusCopy.out;
  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 1,
        bgcolor: content.color,
        color: "white",
        minHeight: 260,
        p: 3,
      }}
    >
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
          <Box flex={1}>
            <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.78)" }}>
              {content.overline}
            </Typography>
            <Typography variant="h4" sx={{ overflowWrap: "anywhere" }}>
              {getLocalStudentDisplayName(
                state,
                localNicknames,
                request.studentId,
                request.teacherId,
                request.periodId,
              )}
            </Typography>
            <Typography sx={{ opacity: 0.92 }}>
              {content.detail}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.82 }}>
              {request.status === "out" || request.status === "returning"
                ? remaining > 0
                  ? `Eloper threshold in ${formatDuration(remaining)}`
                  : "Eloper threshold reached"
                : request.queueReason}
            </Typography>
          </Box>
          <Box sx={{ width: 130, color: "white" }}>
            <DestinationArt destination={request.destination} />
          </Box>
        </Stack>
        {content.button ? (
          <Button
            variant="contained"
            onClick={onReturn}
            sx={{
              bgcolor: "white",
              color: "#7f1d1d",
              minHeight: 62,
              px: 3,
              fontSize: 20,
              "&:hover": { bgcolor: "#fff1f2" },
            }}
          >
            Returned
          </Button>
        ) : null}
      </Stack>
    </Paper>
  );
}

function GroupQueueList({
  state,
  groupId,
  localNicknames,
}: {
  state: PawPassState;
  groupId: string;
  localNicknames: LocalNicknameMap;
}) {
  const group = state.groups.find((item) => item.id === groupId);
  const isActiveEloper = (request: PassRequest) =>
    state.elopers.some((eloper) => eloper.requestId === request.id && eloper.active);
  const frozenTeacherIds = new Set(
    state.rooms.filter((room) => room.frozen).map((room) => room.teacherId),
  );
  const queueStatus = (request: PassRequest) => {
    if (frozenTeacherIds.has(request.teacherId)) return "Frozen";
    if (isActiveEloper(request)) return "eloping";
    if (["out", "received", "returning"].includes(request.status)) return "out";
    if (request.status === "offered") return "requesting";
    return "pending";
  };
  if (!group) return null;

  const visibleQueue = state.requests.filter(
    (request) =>
      (request.groupId === group.id || specialDestinationKeys.includes(request.destination)) &&
      activePassStatuses.includes(request.status) &&
      request.status !== "delayed" &&
      !isActiveEloper(request),
  );

  return (
    <Stack spacing={1.25}>
      <Typography variant="subtitle2" fontWeight={900}>
        Queue
      </Typography>

      {visibleQueue.length ? (
        <Stack spacing={0.75}>
          {visibleQueue.map((request, index) => {
            const status = queueStatus(request);
            const onDeck = Boolean(request.skippedThisCycle);
            return (
              <Box
                key={request.id}
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "36px minmax(0, 1fr) 42px 96px",
                    sm: "38px minmax(0, 1.1fr) minmax(0, 0.9fr) 46px 100px",
                  },
                  gap: 0.75,
                  alignItems: "center",
                  border: "1px solid rgba(15, 23, 42, 0.1)",
                  borderRadius: 1,
                  p: 0.75,
                  bgcolor: onDeck
                    ? "#f1f5f9"
                    : status === "eloping"
                      ? "#fef2f2"
                      : "#ffffff",
                  opacity: onDeck ? 0.68 : 1,
                }}
              >
                <Chip
                  size="small"
                  variant="outlined"
                  label={index + 1}
                  sx={{
                    justifySelf: "center",
                    minWidth: 30,
                    fontWeight: 900,
                    bgcolor: onDeck ? "#e2e8f0" : undefined,
                    borderColor: onDeck ? "#94a3b8" : undefined,
                    color: onDeck ? "#475569" : undefined,
                  }}
                />
                <Typography fontWeight={900} sx={{ overflowWrap: "anywhere" }}>
                  {getLocalStudentDisplayName(
                    state,
                    localNicknames,
                    request.studentId,
                    request.teacherId,
                    request.periodId,
                  )}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    display: { xs: "none", sm: "block" },
                    overflowWrap: "anywhere",
                  }}
                >
                  {getTeacherName(state, request.teacherId)}
                </Typography>
                <Tooltip title={destinationLabels[request.destination]}>
                  <Box sx={{ width: 38, justifySelf: "center" }}>
                    <DestinationArt destination={request.destination} size={34} />
                  </Box>
                </Tooltip>
                <Chip
                  size="small"
                  color={
                    status === "Frozen"
                      ? "default"
                      : status === "eloping"
                        ? "error"
                        : status === "out"
                          ? "warning"
                          : status === "requesting"
                            ? "success"
                            : "primary"
                  }
                  variant={status === "pending" ? "outlined" : "filled"}
                  label={status === "pending" ? "Pending" : status}
                  sx={
                    status === "Frozen"
                      ? {
                          bgcolor: "#e0f2fe",
                          border: "1px solid #7dd3fc",
                          color: "#075985",
                          fontWeight: 900,
                        }
                      : undefined
                  }
                />
              </Box>
            );
          })}
        </Stack>
      ) : (
        <Typography color="text.secondary">No students in this queue.</Typography>
      )}
    </Stack>
  );
}

function RosterView({
  state,
  user,
  effectiveTeacherId,
  localNicknames,
  onLocalNicknameChange,
  onMutate,
}: {
  state: PawPassState;
  user: StaffUser;
  effectiveTeacherId: string;
  localNicknames: LocalNicknameMap;
  onLocalNicknameChange: (
    teacherId: string,
    periodId: string,
    username: string,
    nickname: string,
    previousUsername?: string,
  ) => void;
  onMutate: (mutator: (draft: PawPassState) => void) => void;
}) {
  const currentPeriod = getCurrentPeriod(state, new Date(), user);
  const schedule = getSchedule(state, user);
  const [periodId, setPeriodId] = useState(currentPeriod.id === "off" ? schedule.periods[0]?.id || "p1" : currentPeriod.id);
  const [addPeriodIds, setAddPeriodIds] = useState<string[]>([currentPeriod.id === "off" ? schedule.periods[0]?.id || "p1" : currentPeriod.id]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [internalStudentId, setInternalStudentId] = useState("");
  const [medicalPriority, setMedicalPriority] = useState(false);
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<LocalImportPreviewRow[]>([]);
  const students = getRosterStudents(state, effectiveTeacherId, periodId);

  const toggleAddPeriod = (targetPeriodId: string) => {
    setAddPeriodIds((current) =>
      current.includes(targetPeriodId)
        ? current.filter((item) => item !== targetPeriodId)
        : [...current, targetPeriodId],
    );
  };

  const addStudent = () => {
    try {
      onMutate((draft) => {
        const actor = draft.staffUsers.find((item) => item.id === user.id);
        if (!actor) return;
        addStudentForRosterPeriods(draft, actor, effectiveTeacherId, addPeriodIds, {
          firstName,
          lastName,
          internalStudentId,
          medicalPriority,
        });
      });
      setFirstName("");
      setLastName("");
      setInternalStudentId("");
      setMedicalPriority(false);
      setMessage(`Student added to ${addPeriodIds.length} period${addPeriodIds.length === 1 ? "" : "s"}.`);
      setAddStudentOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add student.");
    }
  };

  const parseCsv = (file: File) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data || [];
        setPreview(
          buildImportPreview(state, rows).map((row, index) => ({
            ...row,
            localNickname: readCsvLocalNickname(rows[index] || {}),
          })),
        );
      },
      error: (error) => setMessage(error.message),
    });
  };

  const commitImport = () => {
    try {
      onMutate((draft) => {
        const actor = draft.staffUsers.find((item) => item.id === user.id);
        if (!actor) return;
        commitImportPreview(draft, actor, effectiveTeacherId, periodId, preview);
      });
      preview
        .filter((row) => row.localNickname?.trim())
        .forEach((row) =>
          onLocalNicknameChange(effectiveTeacherId, periodId, row.username, row.localNickname || ""),
        );
      setMessage(`Imported ${preview.length} students.`);
      setPreview([]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
    }
  };

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5">Edit Rosters</Typography>
        <Typography variant="body2" color="text.secondary">
          Roster edits are scoped to {getTeacherName(state, effectiveTeacherId)}. Removed students are soft deleted from the roster.
        </Typography>
      </Box>

      {message ? <Alert onClose={() => setMessage("")}>{message}</Alert> : null}

      <Dialog open={addStudentOpen} onClose={() => setAddStudentOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Add New Student</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="h6">New Student</Typography>
            <Alert severity="info">
              {usernameHelpText} Paw Pass stores the username and a server-side fingerprint of the
              internal id, not the full internal id.
            </Alert>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr auto" },
              gap: 1,
              alignItems: "center",
            }}
          >
            <TextField size="small" label="First name" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            <TextField size="small" label="Last name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
            <TextField
              size="small"
              label="Internal student id"
              value={internalStudentId}
              onChange={(event) => setInternalStudentId(event.target.value)}
            />
            <FormControlLabel
              control={<Switch checked={medicalPriority} onChange={(event) => setMedicalPriority(event.target.checked)} />}
              label="Medical"
            />
          </Box>
          <Box>
            <Typography variant="subtitle2" fontWeight={900} sx={{ mb: 0.5 }}>
              Add new student to
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {schedule.periods.map((period) => (
                <FormControlLabel
                  key={period.id}
                  control={
                    <Checkbox
                      checked={addPeriodIds.includes(period.id)}
                      onChange={() => toggleAddPeriod(period.id)}
                    />
                  }
                  label={period.label}
                  sx={{ mr: 1 }}
                />
              ))}
            </Stack>
          </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setAddStudentOpen(false)}>Cancel</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={addStudent}>
            Add Student
          </Button>
        </DialogActions>
      </Dialog>

      <SectionPaper>
        <Stack spacing={1.5}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
            <Box flex={1}>
              <Typography variant="h6">Add Students</Typography>
              <Typography variant="body2" color="text.secondary">
                Accepted headers: firstName, lastName, nickname, internalStudentId, medicalPriority.
              </Typography>
            </Box>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddStudentOpen(true)}>
              Add New Student
            </Button>
            <Button variant="outlined" component="label" startIcon={<FileUploadIcon />}>
              Choose CSV
              <input
                hidden
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) parseCsv(file);
                  event.target.value = "";
                }}
              />
            </Button>
            <Button
              variant="contained"
              disabled={!preview.length || preview.some((row) => row.issues.length)}
              onClick={commitImport}
            >
              Save Import
            </Button>
          </Stack>

          {preview.length ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Row</TableCell>
                  <TableCell>Generated Username</TableCell>
                  <TableCell>Nickname</TableCell>
                  <TableCell>Medical</TableCell>
                  <TableCell>Issues</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {preview.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.rowNumber}</TableCell>
                    <TableCell>{row.username}</TableCell>
                    <TableCell>{row.localNickname || "None"}</TableCell>
                    <TableCell>{row.medicalPriority ? "Yes" : "No"}</TableCell>
                    <TableCell>
                      {row.issues.length ? (
                        <Chip color="error" size="small" label={row.issues.join(", ")} />
                      ) : (
                        <Chip color="success" size="small" label="Ready" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </Stack>
      </SectionPaper>

      <SectionPaper>
        <Stack spacing={1.5}>
          <Typography variant="h6">
            Current Roster
          </Typography>
          <FormControl size="small" sx={{ maxWidth: 260 }}>
            <InputLabel id="roster-period-label">Period</InputLabel>
            <Select
              labelId="roster-period-label"
              label="Period"
              value={periodId}
              onChange={(event) => {
                const nextPeriodId = String(event.target.value);
                setPeriodId(nextPeriodId);
                setAddPeriodIds((current) =>
                  current.includes(nextPeriodId) ? current : [...current, nextPeriodId],
                );
              }}
            >
              {schedule.periods.map((period) => (
                <MenuItem key={period.id} value={period.id}>
                  {period.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {students.length ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Username</TableCell>
                  <TableCell>Nickname</TableCell>
                  <TableCell>Medical Priority</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {students.map((student) => (
                  <RosterStudentRow
                    key={student.id}
                    state={state}
                    user={user}
                    teacherId={effectiveTeacherId}
                    periodId={periodId}
                    studentId={student.id}
                    localNicknames={localNicknames}
                    onLocalNicknameChange={onLocalNicknameChange}
                    onMutate={onMutate}
                  />
                ))}
              </TableBody>
            </Table>
          ) : (
            <Typography color="text.secondary">No students in this period yet.</Typography>
          )}
        </Stack>
      </SectionPaper>
    </Stack>
  );
}

function RosterStudentRow({
  state,
  user,
  teacherId,
  periodId,
  studentId,
  localNicknames,
  onLocalNicknameChange,
  onMutate,
}: {
  state: PawPassState;
  user: StaffUser;
  teacherId: string;
  periodId: string;
  studentId: string;
  localNicknames: LocalNicknameMap;
  onLocalNicknameChange: (
    teacherId: string,
    periodId: string,
    username: string,
    nickname: string,
    previousUsername?: string,
  ) => void;
  onMutate: (mutator: (draft: PawPassState) => void) => void;
}) {
  const student = getStudent(state, studentId);
  const savedNickname = student
    ? localNicknames[localNicknameKey(teacherId, periodId, student.username)] || ""
    : "";
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(student?.username || "");
  const [nickname, setNickname] = useState(savedNickname);
  const [medical, setMedical] = useState(Boolean(student?.medicalPriority));
  const [error, setError] = useState("");

  useEffect(() => {
    setUsername(student?.username || "");
    setNickname(savedNickname);
    setMedical(Boolean(student?.medicalPriority));
  }, [savedNickname, student?.medicalPriority, student?.username]);

  if (!student) return null;

  const cancel = () => {
    setUsername(student.username);
    setNickname(savedNickname);
    setMedical(student.medicalPriority);
    setError("");
    setEditing(false);
  };

  const save = () => {
    try {
      const cleanedUsername = username.trim().toLowerCase();
      const cleanedNickname = normalizeNickname(nickname);
      if (!isValidStudentUsername(cleanedUsername)) {
        setError("Username must look like j_smi_123.");
        return;
      }
      if (
        state.students.some(
          (item) => item.id !== studentId && item.username === cleanedUsername && item.active,
        )
      ) {
        setError("That username already belongs to another student.");
        return;
      }
      const previousUsername = student.username;
      onMutate((draft) => {
        const actor = draft.staffUsers.find((item) => item.id === user.id);
        if (!actor) return;
        updateStudent(draft, actor, teacherId, studentId, {
          username: cleanedUsername,
          medicalPriority: medical,
        });
      });
      onLocalNicknameChange(teacherId, periodId, cleanedUsername, cleanedNickname, previousUsername);
      setError("");
      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save student.");
    }
  };

  const handleEditKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      save();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  };

  return (
    <TableRow>
      <TableCell>
        {editing ? (
          <Stack spacing={0.75}>
            <TextField
              size="small"
              value={username}
              error={!isValidStudentUsername(username)}
              onChange={(event) => setUsername(event.target.value)}
              onKeyDown={handleEditKeyDown}
            />
            {error ? <Typography variant="caption" color="error">{error}</Typography> : null}
          </Stack>
        ) : (
          <Typography fontWeight={900}>{student.username}</Typography>
        )}
      </TableCell>
      <TableCell>
        {editing ? (
          <TextField
            size="small"
            label="Nickname"
            value={nickname}
            helperText="Optional classroom display name"
            onChange={(event) => setNickname(event.target.value)}
            onKeyDown={handleEditKeyDown}
            inputProps={{ maxLength: 40 }}
          />
        ) : savedNickname ? (
          <Typography fontWeight={900}>{savedNickname}</Typography>
        ) : (
          <Typography color="text.secondary">None</Typography>
        )}
      </TableCell>
      <TableCell>
        <Switch
          checked={editing ? medical : student.medicalPriority}
          disabled={!editing}
          onChange={(event) => setMedical(event.target.checked)}
        />
      </TableCell>
      <TableCell align="right">
        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
          {editing ? (
            <>
              <Button size="small" variant="contained" onClick={save}>
                Save
              </Button>
              <Button
                size="small"
                variant="text"
                onClick={cancel}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Tooltip title="Edit">
              <IconButton size="small" onClick={() => setEditing(true)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Soft delete from roster">
            <IconButton
              size="small"
              color="error"
              onClick={() =>
                onMutate((draft) => {
                  const actor = draft.staffUsers.find((item) => item.id === user.id);
                  if (!actor) return;
                  softDeleteRosterStudent(draft, actor, teacherId, periodId, studentId);
                })
              }
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </TableCell>
    </TableRow>
  );
}

function ElopersView({
  state,
  user,
  localNicknames,
  now,
  onMutate,
}: {
  state: PawPassState;
  user: StaffUser;
  localNicknames: LocalNicknameMap;
  now: number;
  onMutate: (mutator: (draft: PawPassState) => void) => void;
}) {
  const visibleTeachers = new Set(getVisibleTeacherIds(user, state));
  const visibleGroups = state.groups.filter((group) =>
    group.teacherIds.some((teacherId) => visibleTeachers.has(teacherId)),
  );
  const activeElopers = state.elopers.filter(
    (eloper) => eloper.active && visibleTeachers.has(eloper.teacherId),
  );

  return (
    <Stack spacing={2}>
      {activeElopers.length ? (
        visibleGroups.map((group) => {
          const groupElopers = activeElopers.filter((eloper) => eloper.groupId === group.id);
          if (!groupElopers.length) return null;

          return (
            <SectionPaper key={group.id}>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="h6">{group.name}</Typography>
                  <Chip color="error" label={`${groupElopers.length} active`} />
                </Stack>

                {group.teacherIds
                  .filter((teacherId) => visibleTeachers.has(teacherId))
                  .map((teacherId) => {
                    const teacherElopers = groupElopers.filter(
                      (eloper) => eloper.teacherId === teacherId,
                    );
                    if (!teacherElopers.length) return null;

                    return (
                      <Box key={teacherId}>
                        <Typography fontWeight={900} sx={{ mb: 1 }}>
                          {getTeacherName(state, teacherId)}
                        </Typography>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Student</TableCell>
                              <TableCell>Wing</TableCell>
                              <TableCell>Destination</TableCell>
                              <TableCell>Timeline</TableCell>
                              <TableCell>Out Live</TableCell>
                              <TableCell>Medical</TableCell>
                              <TableCell align="right">Action</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {teacherElopers.map((eloper) => {
                              const student = getStudent(state, eloper.studentId);
                              const request = state.requests.find((item) => item.id === eloper.requestId);
                              return (
                                <TableRow key={eloper.id}>
                                  <TableCell>
                                    <Typography fontWeight={900}>
                                      {getLocalStudentDisplayName(
                                        state,
                                        localNicknames,
                                        eloper.studentId,
                                        eloper.teacherId,
                                        request?.periodId,
                                      )}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>{group.name}</TableCell>
                                  <TableCell>
                                    {destinationEmojis[eloper.destination]}{" "}
                                    {destinationLabels[eloper.destination]}
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2">
                                      Requested {formatTime(eloper.requestedAt)}
                                    </Typography>
                                    <Typography variant="body2">
                                      Out {formatTime(eloper.permittedAt)}
                                    </Typography>
                                    <Typography variant="body2" color="error">
                                      Flagged {formatTime(eloper.flaggedAt)}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Chip
                                      color="error"
                                      label={formatDuration(now - eloper.permittedAt)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    {student?.medicalPriority ? (
                                      <Chip size="small" color="success" label="Medical pass" />
                                    ) : (
                                      <Chip size="small" variant="outlined" label="No" />
                                    )}
                                  </TableCell>
                                  <TableCell align="right">
                                    <Button
                                      variant="contained"
                                      color="success"
                                      onClick={() =>
                                        onMutate((draft) => {
                                          const actor = draft.staffUsers.find(
                                            (item) => item.id === user.id,
                                          );
                                          if (!actor) return;
                                          accountForEloper(draft, actor, eloper.id);
                                          advanceQueues(draft);
                                        })
                                      }
                                    >
                                      Returned
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </Box>
                    );
                  })}
              </Stack>
            </SectionPaper>
          );
        })
      ) : (
        <SectionPaper>
          <Alert severity="success">No active elopers in your current scope.</Alert>
        </SectionPaper>
      )}
    </Stack>
  );
}

function DestinationInboundView({
  state,
  user,
  localNicknames,
  now,
  onMutate,
}: {
  state: PawPassState;
  user: StaffUser;
  localNicknames: LocalNicknameMap;
  now: number;
  onMutate: (mutator: (draft: PawPassState) => void) => void;
}) {
  const destination = destinationForStaffRole(user.role);
  if (!destination) {
    return <Alert severity="warning">This account is not assigned to an inbound destination.</Alert>;
  }

  const inbound = state.requests
    .filter(
      (request) =>
        request.destination === destination &&
        destinationInboundStatuses.includes(request.status),
    )
    .sort(
      (left, right) =>
        statusOrder(left.status) - statusOrder(right.status) ||
        Number(left.returnRequestedAt || left.permittedAt || left.requestedAt) -
          Number(right.returnRequestedAt || right.permittedAt || right.requestedAt),
    );
  const enRoute = inbound.filter((request) => request.status === "out");
  const received = inbound.filter((request) => request.status === "received");
  const returnQueue = inbound.filter((request) =>
    ["return_waiting", "return_offered", "returning"].includes(request.status),
  );

  const mutateWithActor = (handler: (draft: PawPassState, actor: StaffUser) => void) => {
    onMutate((draft) => {
      const actor = draft.staffUsers.find((item) => item.id === user.id);
      if (!actor) return;
      handler(draft, actor);
      advanceQueues(draft);
    });
  };

  return (
    <Stack spacing={2}>
      <DestinationBlockControls
        state={state}
        user={user}
        destinations={[destination]}
        onMutate={onMutate}
      />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 1.5 }}>
        <Metric label="Inbound" value={enRoute.length} />
        <Metric label="Received" value={received.length} />
        <Metric label="Return Queue" value={returnQueue.length} danger={returnQueue.length > 0} />
      </Box>

      <SectionPaper>
        {inbound.length ? (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Student</TableCell>
                <TableCell>Teacher</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Timeline</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {inbound.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <Typography fontWeight={900}>
                      {getLocalStudentDisplayName(
                        state,
                        localNicknames,
                        request.studentId,
                        request.teacherId,
                        request.periodId,
                      )}
                    </Typography>
                  </TableCell>
                  <TableCell>{getTeacherName(state, request.teacherId)}</TableCell>
                  <TableCell>
                    <Chip
                      color={
                        request.status === "out"
                          ? "warning"
                          : request.status === "received"
                            ? "success"
                            : "primary"
                      }
                      label={displayStatus(request.status)}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">Permitted {formatTime(request.permittedAt)}</Typography>
                    {request.receivedAt ? (
                      <Typography variant="body2">Received {formatTime(request.receivedAt)}</Typography>
                    ) : null}
                    {request.returnRequestedAt ? (
                      <Typography variant="body2">Dismissed {formatTime(request.returnRequestedAt)}</Typography>
                    ) : null}
                    {request.returnCalledAt ? (
                      <Typography variant="body2">Called {formatTime(request.returnCalledAt)}</Typography>
                    ) : null}
                    <Typography variant="caption" color="text.secondary">
                      Out {formatDuration(now - Number(request.permittedAt || request.requestedAt))}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.75} justifyContent="flex-end" flexWrap="wrap">
                      {request.status === "out" ? (
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          onClick={() =>
                            mutateWithActor((draft, actor) =>
                              receiveDestinationStudent(draft, actor, request.id),
                            )
                          }
                        >
                          Receive
                        </Button>
                      ) : null}
                      {request.status === "received" ? (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() =>
                            mutateWithActor((draft, actor) =>
                              dismissFromDestinationToClass(draft, actor, request.id),
                            )
                          }
                        >
                          Dismiss Back To Class
                        </Button>
                      ) : null}
                      {request.status === "returning" ? (
                        <Chip size="small" color="success" label="Send now" />
                      ) : null}
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        disabled={state.elopers.some((eloper) => eloper.requestId === request.id && eloper.active)}
                        onClick={() =>
                          mutateWithActor((draft, actor) =>
                            markRequestEloper(draft, actor, request.id),
                          )
                        }
                      >
                        Mark Eloper
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Alert severity="success">No students are currently inbound to {destinationLabels[destination]}.</Alert>
        )}
      </SectionPaper>
    </Stack>
  );
}

function DestinationBlockControls({
  state,
  user,
  destinations,
  onMutate,
}: {
  state: PawPassState;
  user: StaffUser;
  destinations: DestinationKey[];
  onMutate: (mutator: (draft: PawPassState) => void) => void;
}) {
  const updateBlocked = (destination: DestinationKey, blocked: boolean) => {
    onMutate((draft) => {
      const actor = draft.staffUsers.find((item) => item.id === user.id);
      if (!actor) return;
      setDestinationBlocked(draft, actor, destination, blocked);
      advanceQueues(draft);
    });
  };

  const updateLimit = (destination: DestinationKey, value: number) => {
    onMutate((draft) => {
      const actor = draft.staffUsers.find((item) => item.id === user.id);
      if (!actor) return;
      setDestinationAutoBlockLimit(draft, actor, destination, value);
      advanceQueues(draft);
    });
  };

  return (
    <SectionPaper>
      <Stack spacing={1.5}>
        <Box>
          <Typography variant="h6">Destinations</Typography>
          <Typography variant="body2" color="text.secondary">
            Office, Nurse, Counselor, and Library can pause requests or auto-pause after the active list reaches a limit.
          </Typography>
        </Box>
        {destinations.map((destination) => {
          const destinationState = getDestinationState(state, destination);
          const activeCount = activeDestinationRequestCount(state, destination);
          const autoBlocked =
            destinationState.autoBlockAfterCount > 0 &&
            activeCount >= destinationState.autoBlockAfterCount;
          const blocked = isDestinationBlocked(state, destination);

          return (
            <Accordion
              key={destination}
              defaultExpanded={destinations.length === 1}
              disableGutters
              variant="outlined"
              sx={{
                borderColor: "rgba(15, 23, 42, 0.12)",
                borderRadius: 1,
                "&:before": { display: "none" },
                "&.Mui-expanded": { m: 0 },
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" width="100%">
                  <Box sx={{ width: 38, flex: "0 0 auto" }}>
                    <DestinationArt destination={destination} size={34} />
                  </Box>
                  <Typography fontWeight={900}>{destinationLabels[destination]}</Typography>
                  <Chip size="small" label={`${activeCount} active`} />
                  {blocked ? (
                    <Chip
                      size="small"
                      color="warning"
                      label={autoBlocked ? "Auto-paused" : "Paused"}
                    />
                  ) : (
                    <Chip size="small" variant="outlined" label="Taking requests" />
                  )}
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr minmax(220px, 280px)" },
                    gap: 1.25,
                    alignItems: "center",
                  }}
                >
                  <FormControlLabel
                    control={
                      <Switch
                        checked={destinationState.blocked}
                        onChange={(event) => updateBlocked(destination, event.target.checked)}
                      />
                    }
                    label="Pause requests"
                  />
                  <TextField
                    size="small"
                    type="number"
                    label="Auto-pause after active requests"
                    value={destinationState.autoBlockAfterCount}
                    onChange={(event) => updateLimit(destination, Number(event.target.value))}
                  />
                </Box>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Stack>
    </SectionPaper>
  );
}

function EditableGroupName({
  user,
  groupId,
  name,
  onMutate,
}: {
  user: StaffUser;
  groupId: string;
  name: string;
  onMutate: (mutator: (draft: PawPassState) => void) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const adminCanEdit = user.role === "admin";

  useEffect(() => {
    if (!editing) setDraftName(name);
  }, [editing, name]);

  const beginEditing = () => {
    if (!adminCanEdit) return;
    setDraftName(name);
    setEditing(true);
  };

  const cancelEditing = () => {
    setDraftName(name);
    setEditing(false);
  };

  const commitName = () => {
    const nextName = draftName.trim().replace(/\s+/g, " ");
    if (!nextName) {
      cancelEditing();
      return;
    }
    if (nextName !== name) {
      onMutate((draft) => {
        const group = draft.groups.find((item) => item.id === groupId);
        if (!group) return;
        const previousName = group.name;
        group.name = nextName;
        addAudit(draft, user.id, "settings_updated", {
          key: "group_name",
          groupId,
          previousName,
          nextName,
        });
      });
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <TextField
        autoFocus
        size="small"
        variant="standard"
        value={draftName}
        onChange={(event) => setDraftName(event.target.value)}
        onBlur={commitName}
        onFocus={(event) => event.target.select()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitName();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            cancelEditing();
          }
        }}
        inputProps={{ maxLength: 48 }}
        sx={{
          maxWidth: 280,
          "& .MuiInputBase-input": {
            fontSize: "1.25rem",
            fontWeight: 900,
            py: 0.1,
          },
        }}
      />
    );
  }

  return (
    <Tooltip describeChild title={adminCanEdit ? "Click to rename" : ""}>
      <Typography
        variant="h6"
        role={adminCanEdit ? "button" : undefined}
        tabIndex={adminCanEdit ? 0 : undefined}
        onClick={beginEditing}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            beginEditing();
          }
        }}
        sx={{
          cursor: adminCanEdit ? "text" : "default",
          display: "inline-block",
          borderRadius: 0.5,
          outlineOffset: 3,
          "&:hover": adminCanEdit
            ? {
                textDecoration: "underline",
                textDecorationThickness: 2,
              }
            : undefined,
        }}
      >
        {name}
      </Typography>
    </Tooltip>
  );
}

function LiveMapView({
  state,
  user,
  localNicknames,
  now,
  onMutate,
}: {
  state: PawPassState;
  user: StaffUser;
  localNicknames: LocalNicknameMap;
  now: number;
  onMutate: (mutator: (draft: PawPassState) => void) => void;
}) {
  const visibleTeachers = new Set(getVisibleTeacherIds(user, state));
  const canMoveTeachers = user.role === "admin";
  const canFilterGroups = user.role === "admin";
  const visibleGroups = canViewAll(user)
    ? state.groups
    : state.groups.filter((group) =>
        group.teacherIds.some((teacherId) => visibleTeachers.has(teacherId)),
      );
  const [selectedGroupId, setSelectedGroupId] = useState("all");
  const [draggedTeacherId, setDraggedTeacherId] = useState("");
  const selectedGroupIsVisible = visibleGroups.some((group) => group.id === selectedGroupId);
  const effectiveSelectedGroupId =
    canFilterGroups && selectedGroupIsVisible ? selectedGroupId : "all";
  const filteredGroups =
    effectiveSelectedGroupId === "all"
      ? visibleGroups
      : visibleGroups.filter((group) => group.id === effectiveSelectedGroupId);
  const activeEloperRequestIds = new Set(
    state.elopers.filter((eloper) => eloper.active).map((eloper) => eloper.requestId),
  );

  const handleGroupDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!canMoveTeachers) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleGroupDrop = (groupId: string) => (event: React.DragEvent<HTMLDivElement>) => {
    if (!canMoveTeachers) return;
    event.preventDefault();
    const teacherId = event.dataTransfer.getData("text/plain") || draggedTeacherId;
    if (!teacherId) return;
    onMutate((draft) => {
      const actor = draft.staffUsers.find((item) => item.id === user.id);
      if (!actor) return;
      moveTeacherToGroup(draft, actor, teacherId, groupId);
      advanceQueues(draft);
    });
    setDraggedTeacherId("");
  };

  return (
    <Stack spacing={2}>
      {canFilterGroups ? (
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="live-map-group-filter-label">Group</InputLabel>
            <Select
              labelId="live-map-group-filter-label"
              label="Group"
              value={effectiveSelectedGroupId}
              onChange={(event) => setSelectedGroupId(String(event.target.value))}
            >
              <MenuItem value="all">All groups</MenuItem>
              {visibleGroups.map((group) => (
                <MenuItem key={group.id} value={group.id}>
                  {group.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: canViewAll(user) ? "repeat(2, minmax(0, 1fr))" : "1fr",
          },
          gap: 2,
        }}
      >
        {filteredGroups.map((group) => {
          const groupRequests = state.requests.filter(
            (request) =>
              request.groupId === group.id &&
              activePassStatuses.includes(request.status) &&
              request.status !== "delayed" &&
              !activeEloperRequestIds.has(request.id),
          );
          const activeElopers = state.elopers.filter((eloper) => eloper.groupId === group.id && eloper.active);

          return (
            <Box
              key={group.id}
              onDragOver={handleGroupDragOver}
              onDrop={handleGroupDrop(group.id)}
            >
              <SectionPaper
                sx={{
                  height: "100%",
                  borderColor:
                    canMoveTeachers && draggedTeacherId && !group.teacherIds.includes(draggedTeacherId)
                      ? "#38bdf8"
                      : "rgba(15, 23, 42, 0.12)",
                  bgcolor:
                    canMoveTeachers && draggedTeacherId && !group.teacherIds.includes(draggedTeacherId)
                      ? "#f0f9ff"
                      : "#ffffff",
                }}
              >
                <Stack spacing={1.5}>
                  <Stack spacing={0.75}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <GroupsIcon color="primary" />
                      <Box flex={1}>
                        <EditableGroupName
                          user={user}
                          groupId={group.id}
                          name={group.name}
                          onMutate={onMutate}
                        />
                      </Box>
                      {activeElopers.length ? <Chip color="error" label={`${activeElopers.length} eloper`} /> : null}
                    </Stack>
                  </Stack>

                  <Divider />

                  <GroupQueueList
                    state={state}
                    groupId={group.id}
                    localNicknames={localNicknames}
                  />

                  <Divider />

                  {group.teacherIds.map((teacherId) => {
                    const room = getRoomSnapshot(state, teacherId);
                    const teacherRequests = groupRequests.filter((request) => request.teacherId === teacherId);
                    return (
                      <Box
                        key={teacherId}
                        draggable={canMoveTeachers}
                        onDragStart={(event) => {
                          if (!canMoveTeachers) return;
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", teacherId);
                          setDraggedTeacherId(teacherId);
                        }}
                        onDragEnd={() => setDraggedTeacherId("")}
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", sm: "1fr auto" },
                          gap: 1,
                          py: 0.75,
                          borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
                          cursor: canMoveTeachers ? "grab" : "default",
                          opacity: draggedTeacherId === teacherId ? 0.55 : 1,
                          borderRadius: 0.75,
                          px: canMoveTeachers ? 0.75 : 0,
                          "&:hover": canMoveTeachers
                            ? {
                                bgcolor: "rgba(14, 165, 233, 0.08)",
                              }
                            : undefined,
                        }}
                      >
                        <Box>
                          <Typography fontWeight={900}>{getTeacherName(state, teacherId)}</Typography>
                          {teacherRequests.length ? (
                            <Stack spacing={0.25} sx={{ mt: 0.25 }}>
                              {teacherRequests.map((request) => (
                                <Typography
                                  key={request.id}
                                  variant="body2"
                                  color="text.secondary"
                                  sx={{ overflowWrap: "anywhere" }}
                                >
                                  {getLocalStudentDisplayName(
                                    state,
                                    localNicknames,
                                    request.studentId,
                                    request.teacherId,
                                    request.periodId,
                                  )}
                                  : {room.frozen ? "Frozen" : displayStatus(request.status)} -{" "}
                                  {destinationEmojis[request.destination]} {destinationLabels[request.destination]}
                                </Typography>
                              ))}
                            </Stack>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              No active queue items
                            </Typography>
                          )}
                        </Box>
                        <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
                          {room.frozen ? <Chip size="small" color="warning" label="Frozen" /> : null}
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              </SectionPaper>
            </Box>
          );
        })}
      </Box>
    </Stack>
  );
}

function ReportsView({
  state,
  user,
  localNicknames,
  now,
}: {
  state: PawPassState;
  user: StaffUser;
  localNicknames: LocalNicknameMap;
  now: number;
}) {
  const todayInput = msToDateInput(now);
  const [teacherFilterIds, setTeacherFilterIds] = useState<string[]>([]);
  const [teacherSearch, setTeacherSearch] = useState("");
  const [startDate, setStartDate] = useState(() => todayInput);
  const [endDate, setEndDate] = useState(() => todayInput);
  const [requestTypeFilter, setRequestTypeFilter] = useState<"all" | DestinationKey>("all");
  const [sortKey, setSortKey] = useState<ReportSortKey>("requests_desc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleReportColumns, setVisibleReportColumns] = useState<ReportColumnKey[]>(() => reportColumnOrder);
  const fullAccess = canViewAll(user);
  const availableReportColumns = reportColumnOrder.filter((column) => column !== "teacher" || fullAccess);
  const isReportColumnVisible = (column: ReportColumnKey) =>
    column === "student" || ((column !== "teacher" || fullAccess) && visibleReportColumns.includes(column));
  const visibleReportColumnCount = availableReportColumns.filter(isReportColumnVisible).length;
  const studentHabitTableMinWidth = Math.max(360, visibleReportColumnCount * 128);
  const teachers = useMemo(
    () => state.staffUsers.filter((staff) => staff.role === "teacher" && staff.active),
    [state.staffUsers],
  );
  const teacherIdSet = useMemo(() => new Set(teachers.map((teacher) => teacher.id)), [teachers]);
  const validTeacherFilterIds = useMemo(
    () => (fullAccess ? teacherFilterIds.filter((teacherId) => teacherIdSet.has(teacherId)) : []),
    [fullAccess, teacherFilterIds, teacherIdSet],
  );
  const allTeachersSelected = !validTeacherFilterIds.length;
  const selectedTeachers = useMemo(
    () => teachers.filter((teacher) => validTeacherFilterIds.includes(teacher.id)),
    [teachers, validTeacherFilterIds],
  );
  const reportTeacherIds = useMemo(
    () =>
      fullAccess
        ? allTeachersSelected
          ? teachers.map((teacher) => teacher.id)
          : validTeacherFilterIds
        : [getEffectiveTeacherId(user, state)].filter(Boolean),
    [allTeachersSelected, fullAccess, state, teachers, user, validTeacherFilterIds],
  );
  const reportTeacherSet = useMemo(() => new Set(reportTeacherIds), [reportTeacherIds]);
  const { rosterStudentIds, rosterTeacherIdsByStudent } = useMemo(() => {
    const studentIds = new Set<string>();
    const teacherIdsByStudent = new Map<string, Set<string>>();
    const rosterIdsByTeacher = state.rosters.filter(
      (roster) => roster.active && reportTeacherSet.has(roster.teacherId),
    );

    rosterIdsByTeacher.forEach((roster) => {
      state.rosterEntries
        .filter((entry) => entry.active && entry.rosterId === roster.id)
        .forEach((entry) => {
          studentIds.add(entry.studentId);
          const teacherIds = teacherIdsByStudent.get(entry.studentId) || new Set<string>();
          teacherIds.add(roster.teacherId);
          teacherIdsByStudent.set(entry.studentId, teacherIds);
        });
    });

    return { rosterStudentIds: studentIds, rosterTeacherIdsByStudent: teacherIdsByStudent };
  }, [reportTeacherSet, state.rosterEntries, state.rosters]);

  const eligibleStudents = useMemo(
    () =>
      fullAccess && allTeachersSelected
        ? state.students.filter((student) => student.active)
        : state.students.filter((student) => student.active && rosterStudentIds.has(student.id)),
    [allTeachersSelected, fullAccess, rosterStudentIds, state.students],
  );

  const eligibleStudentIds = useMemo(
    () => new Set(eligibleStudents.map((student) => student.id)),
    [eligibleStudents],
  );
  const startMs = useMemo(() => dateInputToStartMs(startDate), [startDate]);
  const endMs = useMemo(() => dateInputToEndMs(endDate), [endDate]);
  const scopedRequests = useMemo(
    () =>
      state.requests.filter(
        (request) =>
          reportTeacherSet.has(request.teacherId) &&
          (fullAccess && allTeachersSelected
            ? true
            : eligibleStudentIds.has(request.studentId)) &&
          (startMs === null || request.requestedAt >= startMs) &&
          (endMs === null || request.requestedAt <= endMs) &&
          (requestTypeFilter === "all" || request.destination === requestTypeFilter),
      ),
    [
      allTeachersSelected,
      eligibleStudentIds,
      endMs,
      fullAccess,
      reportTeacherSet,
      requestTypeFilter,
      startMs,
      state.requests,
    ],
  );
  const scopedRequestIds = useMemo(
    () => new Set(scopedRequests.map((request) => request.id)),
    [scopedRequests],
  );
  const scopedRequestById = useMemo(
    () => new Map(scopedRequests.map((request) => [request.id, request])),
    [scopedRequests],
  );
  const requestsByStudentId = useMemo(() => {
    const requestsByStudent = new Map<string, PassRequest[]>();
    scopedRequests.forEach((request) => {
      const requests = requestsByStudent.get(request.studentId) || [];
      requests.push(request);
      requestsByStudent.set(request.studentId, requests);
    });
    return requestsByStudent;
  }, [scopedRequests]);
  const returned = useMemo(
    () =>
      scopedRequests.filter(
        (request) => request.status === "returned" && request.permittedAt && request.returnedAt,
      ),
    [scopedRequests],
  );
  const calledRequests = useMemo(
    () => scopedRequests.filter((request) => request.offeredAt),
    [scopedRequests],
  );
  const averageWaitMs = calledRequests.length
    ? calledRequests.reduce(
        (total, request) => total + Number(request.offeredAt! - request.requestedAt),
        0,
      ) / calledRequests.length
    : 0;
  const totalElopers = useMemo(
    () =>
      state.elopers.filter(
        (eloper) =>
          reportTeacherSet.has(eloper.teacherId) &&
          (fullAccess && allTeachersSelected
            ? true
            : eligibleStudentIds.has(eloper.studentId)) &&
          scopedRequestIds.has(eloper.requestId),
      ),
    [
      allTeachersSelected,
      eligibleStudentIds,
      fullAccess,
      reportTeacherSet,
      scopedRequestIds,
      state.elopers,
    ],
  );
  const eloperRequestIds = useMemo(
    () => new Set(totalElopers.map((eloper) => eloper.requestId)),
    [totalElopers],
  );
  const nonEloperReturned = useMemo(
    () => returned.filter((request) => !eloperRequestIds.has(request.id)),
    [eloperRequestIds, returned],
  );
  const averageNonEloperMs = nonEloperReturned.length
    ? nonEloperReturned.reduce((total, request) => total + Number(request.returnedAt! - request.permittedAt!), 0) /
      nonEloperReturned.length
    : 0;
  const eloperDurations = totalElopers
    .map((eloper) => {
      const request = scopedRequestById.get(eloper.requestId);
      const start = request?.permittedAt || eloper.permittedAt;
      const end = request?.returnedAt || eloper.accountedForAt || (eloper.active ? now : eloper.flaggedAt);
      return Math.max(0, Number(end) - Number(start));
    })
    .filter((duration) => duration > 0);
  const averageEloperMs = eloperDurations.length
    ? eloperDurations.reduce((total, duration) => total + duration, 0) / eloperDurations.length
    : 0;

  const requestCounts = useMemo(
    () =>
      requestActionKeys.map((destination) => ({
        destination,
        count: scopedRequests.filter((request) => request.destination === destination).length,
      })),
    [scopedRequests],
  );
  const eloperCountByStudentId = useMemo(() => {
    const counts = new Map<string, number>();
    totalElopers.forEach((eloper) => {
      counts.set(eloper.studentId, (counts.get(eloper.studentId) || 0) + 1);
    });
    return counts;
  }, [totalElopers]);
  const penaltyByStudentId = useMemo(() => {
    const penalties = new Map<string, number>();
    eligibleStudents.forEach((student) => {
      penalties.set(student.id, getStudentQueuePenaltyMs(state, student.id));
    });
    return penalties;
  }, [eligibleStudents, state]);

  const studentStats = useMemo(
    () =>
      eligibleStudents.map((student) => {
      const requests = requestsByStudentId.get(student.id) || [];
      const completed = requests.filter((request) => request.permittedAt && request.returnedAt && !eloperRequestIds.has(request.id));
      const avg = completed.length
        ? completed.reduce((total, request) => total + Number(request.returnedAt! - request.permittedAt!), 0) / completed.length
        : 0;
      const called = requests.filter((request) => request.offeredAt);
      const avgWait = called.length
        ? called.reduce(
            (total, request) => total + Number(request.offeredAt! - request.requestedAt),
            0,
          ) / called.length
        : 0;
      const eloperCount = eloperCountByStudentId.get(student.id) || 0;
      const penaltyMs = penaltyByStudentId.get(student.id) || 0;
      const teacherNames = Array.from(rosterTeacherIdsByStudent.get(student.id) || [])
        .map((teacherId) => getTeacherName(state, teacherId))
        .join(", ");
      const firstTeacherId = Array.from(rosterTeacherIdsByStudent.get(student.id) || [])[0];
      const displayName = getLocalStudentDisplayName(state, localNicknames, student.id, firstTeacherId);
      return {
        student,
        displayName,
        teacherNames: teacherNames || "No active roster",
        requests: requests.length,
        averageMs: avg,
        averageWaitMs: avgWait,
        eloperCount,
        penaltyMs,
      };
    })
    .sort((left, right) => {
      if (sortKey === "requests_asc") return left.requests - right.requests || left.displayName.localeCompare(right.displayName);
      if (sortKey === "username_asc") return left.displayName.localeCompare(right.displayName);
      if (sortKey === "username_desc") return right.displayName.localeCompare(left.displayName);
      if (sortKey === "avg_wait_desc") return right.averageWaitMs - left.averageWaitMs || left.displayName.localeCompare(right.displayName);
      if (sortKey === "avg_wait_asc") return left.averageWaitMs - right.averageWaitMs || left.displayName.localeCompare(right.displayName);
      if (sortKey === "avg_out_desc") return right.averageMs - left.averageMs || left.displayName.localeCompare(right.displayName);
      if (sortKey === "avg_out_asc") return left.averageMs - right.averageMs || left.displayName.localeCompare(right.displayName);
      if (sortKey === "elopers_desc") return right.eloperCount - left.eloperCount || left.displayName.localeCompare(right.displayName);
      if (sortKey === "elopers_asc") return left.eloperCount - right.eloperCount || left.displayName.localeCompare(right.displayName);
      if (sortKey === "penalty_desc") return right.penaltyMs - left.penaltyMs || left.displayName.localeCompare(right.displayName);
      if (sortKey === "penalty_asc") return left.penaltyMs - right.penaltyMs || left.displayName.localeCompare(right.displayName);
      return right.requests - left.requests || left.displayName.localeCompare(right.displayName);
    }),
    [
      eligibleStudents,
      eloperCountByStudentId,
      eloperRequestIds,
      localNicknames,
      penaltyByStudentId,
      requestsByStudentId,
      rosterTeacherIdsByStudent,
      sortKey,
      state,
    ],
  );

  const sortableHeader = (
    label: string,
    ascendingKey: ReportSortKey,
    descendingKey: ReportSortKey,
  ) => {
    const active = sortKey === ascendingKey || sortKey === descendingKey;
    const direction: "asc" | "desc" = sortKey.endsWith("_asc") ? "asc" : "desc";
    const nextKey = active && sortKey === descendingKey ? ascendingKey : descendingKey;
    return (
      <TableSortLabel
        active={active}
        direction={active ? direction : "desc"}
        onClick={() => setSortKey(nextKey)}
      >
        {label}
      </TableSortLabel>
    );
  };

  const resetReportFilters = () => {
    setTeacherFilterIds([]);
    setTeacherSearch("");
    setStartDate(todayInput);
    setEndDate(todayInput);
    setRequestTypeFilter("all");
    setSortKey("requests_desc");
  };

  const toggleReportColumn = (column: ReportColumnKey) => {
    if (column === "student") return;
    setVisibleReportColumns((current) =>
      current.includes(column)
        ? current.filter((item) => item !== column)
        : [...current, column],
    );
  };

  const renderFilterFields = (mode: "inline" | "dialog") => {
    const isDialog = mode === "dialog";
    const requestLabelId = `${mode}-report-request-type-label`;
    return (
      <>
        {fullAccess ? (
          <Autocomplete
            multiple
            size="small"
            limitTags={1}
            options={teachers}
            value={selectedTeachers}
            inputValue={teacherSearch}
            filterSelectedOptions
            getOptionLabel={(teacher) => teacher.displayName}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            onInputChange={(_, value, reason) => {
              if (reason !== "reset") setTeacherSearch(value);
            }}
            onChange={(_, selected) => {
              setTeacherFilterIds(selected.map((teacher) => teacher.id));
              setTeacherSearch("");
            }}
            renderTags={(selected, getTagProps) =>
              selected.map((teacher, index) => {
                const { key, ...tagProps } = getTagProps({ index });
                return <Chip key={key} size="small" label={teacher.displayName} {...tagProps} />;
              })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Teachers"
                placeholder={selectedTeachers.length ? "" : "All teachers"}
              />
            )}
            sx={
              isDialog
                ? { width: "100%" }
                : {
                    flex: "0 0 auto",
                    width: { sm: 300, lg: 340 },
                    "& .MuiInputBase-root": { flexWrap: "nowrap" },
                  }
            }
          />
        ) : null}

        <TextField
          size="small"
          type="date"
          label="Start date"
          value={startDate}
          InputLabelProps={{ shrink: true }}
          onChange={(event) => setStartDate(event.target.value)}
          sx={isDialog ? { width: "100%" } : { flex: "0 0 auto", width: { sm: 170 } }}
        />
        <TextField
          size="small"
          type="date"
          label="End date"
          value={endDate}
          InputLabelProps={{ shrink: true }}
          onChange={(event) => setEndDate(event.target.value)}
          sx={isDialog ? { width: "100%" } : { flex: "0 0 auto", width: { sm: 170 } }}
        />
        <FormControl
          size="small"
          sx={isDialog ? { width: "100%" } : { flex: "0 0 auto", width: { sm: 220 } }}
        >
          <InputLabel id={requestLabelId}>Request</InputLabel>
          <Select
            labelId={requestLabelId}
            label="Request"
            value={requestTypeFilter}
            onChange={(event) => setRequestTypeFilter(event.target.value as "all" | DestinationKey)}
          >
            <MenuItem value="all">All requests</MenuItem>
            {requestActionKeys.map((destination) => (
              <MenuItem key={destination} value={destination}>
                {destinationEmojis[destination]} {destinationLabels[destination]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {!isDialog ? (
          <Tooltip title="Reset report filters">
            <IconButton onClick={resetReportFilters} sx={{ flex: "0 0 auto" }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        ) : null}
      </>
    );
  };

  return (
    <Stack spacing={2}>
      <Box sx={{ display: { xs: "block", sm: "none" } }}>
        <Button
          fullWidth
          variant="contained"
          startIcon={<FilterListIcon />}
          onClick={() => setFiltersOpen(true)}
        >
          Filter
        </Button>
      </Box>

      <Dialog open={filtersOpen} onClose={() => setFiltersOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Filter Reports</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {renderFilterFields("dialog")}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={resetReportFilters}>Reset</Button>
          <Button variant="contained" onClick={() => setFiltersOpen(false)}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <SectionPaper sx={{ display: { xs: "none", sm: "block" } }}>
        <Box
          sx={{
            display: "flex",
            flexWrap: "nowrap",
            overflowX: "auto",
            overflowY: "hidden",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
            gap: 1,
            alignItems: "center",
          }}
        >
          {renderFilterFields("inline")}
        </Box>
      </SectionPaper>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(3, minmax(0, 1fr))", md: "repeat(6, minmax(0, 1fr))" },
          gap: { xs: 0.75, sm: 1.5 },
        }}
      >
        <Metric label="Requests" value={scopedRequests.length} />
        <Metric label="Returned" value={returned.length} />
        <Metric label="Total Elopers" value={totalElopers.length} danger={totalElopers.length > 0} />
        <Metric label="Avg Out Non-Elopers" value={averageNonEloperMs ? formatDuration(averageNonEloperMs) : "0:00"} />
        <Metric label="Avg Out Elopers" value={averageEloperMs ? formatDuration(averageEloperMs) : "0:00"} danger={averageEloperMs > 0} />
        <Metric label="Avg Wait To Call" value={averageWaitMs ? formatDuration(averageWaitMs) : "0:00"} />
      </Box>

      <Stack spacing={2}>
        <Accordion
          disableGutters
          variant="outlined"
          sx={{
            borderRadius: 1,
            overflow: "hidden",
            bgcolor: "#ffffff",
            "&:before": { display: "none" },
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ width: "100%" }}>
              <Typography variant="h6" flex={1}>
                Request
              </Typography>
              <Chip label={scopedRequests.length} />
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Stack spacing={1}>
              {requestCounts.map((item) => (
                <Stack key={item.destination} direction="row" spacing={1} alignItems="center">
                  <Box sx={{ width: 42 }}>
                    <DestinationArt destination={item.destination} size={40} />
                  </Box>
                  <Typography flex={1}>{destinationLabels[item.destination]}</Typography>
                  <Chip label={item.count} />
                </Stack>
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>

        <SectionPaper>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h6" flex={1}>
              Student Habits
            </Typography>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ViewColumnIcon />}
              onClick={() => setColumnsOpen(true)}
            >
              Columns
            </Button>
          </Stack>
          <Dialog open={columnsOpen} onClose={() => setColumnsOpen(false)} fullWidth maxWidth="xs">
            <DialogTitle>Student Habit Columns</DialogTitle>
            <DialogContent>
              <Stack spacing={0.5} sx={{ pt: 1 }}>
                {availableReportColumns.map((column) => (
                  <FormControlLabel
                    key={column}
                    control={
                      <Checkbox
                        checked={isReportColumnVisible(column)}
                        disabled={column === "student"}
                        onChange={() => toggleReportColumn(column)}
                      />
                    }
                    label={reportColumnLabels[column]}
                  />
                ))}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 2, pt: 0 }}>
              <Button variant="contained" onClick={() => setColumnsOpen(false)}>
                Save
              </Button>
            </DialogActions>
          </Dialog>
          {studentStats.length ? (
            <Box sx={{ width: "100%", overflowX: "auto" }}>
              <Table
                size="small"
                sx={{
                  minWidth: studentHabitTableMinWidth,
                  "& th, & td": { textAlign: "center", verticalAlign: "middle" },
                  "& .MuiTableSortLabel-root": { justifyContent: "center" },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell>
                      {sortableHeader("Student", "username_asc", "username_desc")}
                    </TableCell>
                    {isReportColumnVisible("teacher") ? <TableCell>Teacher</TableCell> : null}
                    {isReportColumnVisible("requests") ? (
                      <TableCell>
                        {sortableHeader("Requests", "requests_asc", "requests_desc")}
                      </TableCell>
                    ) : null}
                    {isReportColumnVisible("avgWait") ? (
                      <TableCell>
                        {sortableHeader("Avg Wait", "avg_wait_asc", "avg_wait_desc")}
                      </TableCell>
                    ) : null}
                    {isReportColumnVisible("avgOut") ? (
                      <TableCell>
                        {sortableHeader("Avg Out Non-Elopers", "avg_out_asc", "avg_out_desc")}
                      </TableCell>
                    ) : null}
                    {isReportColumnVisible("elopers") ? (
                      <TableCell>
                        {sortableHeader("Elopers", "elopers_asc", "elopers_desc")}
                      </TableCell>
                    ) : null}
                    {isReportColumnVisible("penalty") ? (
                      <TableCell>
                        {sortableHeader("Penalty", "penalty_asc", "penalty_desc")}
                      </TableCell>
                    ) : null}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {studentStats.map((row) => (
                    <TableRow key={row.student.id}>
                      <TableCell>
                        <Typography fontWeight={900} textAlign="center">{row.displayName}</Typography>
                        {row.displayName !== row.student.username ? (
                          <Typography variant="caption" color="text.secondary" textAlign="center" display="block">
                            {row.student.username}
                          </Typography>
                        ) : null}
                      </TableCell>
                      {isReportColumnVisible("teacher") ? <TableCell>{row.teacherNames}</TableCell> : null}
                      {isReportColumnVisible("requests") ? <TableCell>{row.requests}</TableCell> : null}
                      {isReportColumnVisible("avgWait") ? (
                        <TableCell>{row.averageWaitMs ? formatDuration(row.averageWaitMs) : "0:00"}</TableCell>
                      ) : null}
                      {isReportColumnVisible("avgOut") ? (
                        <TableCell>{row.averageMs ? formatDuration(row.averageMs) : "0:00"}</TableCell>
                      ) : null}
                      {isReportColumnVisible("elopers") ? <TableCell>{row.eloperCount}</TableCell> : null}
                      {isReportColumnVisible("penalty") ? (
                        <TableCell>{row.penaltyMs ? formatDuration(row.penaltyMs) : "0:00"}</TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          ) : (
            <Typography color="text.secondary">No pass history yet.</Typography>
          )}
        </SectionPaper>
      </Stack>
    </Stack>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: React.ReactNode; danger?: boolean }) {
  return (
    <SectionPaper sx={{ bgcolor: danger ? "#fef2f2" : "#ffffff", p: { xs: 1, sm: 2 }, minWidth: 0 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          display: "block",
          minHeight: { xs: 30, sm: "auto" },
          fontSize: { xs: "0.66rem", sm: "0.75rem" },
          lineHeight: 1.12,
          overflowWrap: "anywhere",
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="h5"
        color={danger ? "error" : "text.primary"}
        sx={{ fontSize: { xs: "1.25rem", sm: "1.5rem" }, lineHeight: 1.15 }}
      >
        {value}
      </Typography>
    </SectionPaper>
  );
}

type ScheduleEditorMode = "new" | "edit" | "duplicate";
type ScheduleEditorTarget = {
  mode: ScheduleEditorMode;
  schedule?: ScheduleTemplate;
};

type ScheduleEditorPeriod = {
  localId: string;
  id: string;
  label: string;
  originalLabel: string;
  start: string;
  originalStart: string;
  durationInput: string;
  originalDurationMinutes: number;
};

type OutdatedSchedulePair = {
  privateSchedule: ScheduleTemplate;
  adminSchedule: ScheduleTemplate;
};

type ScheduleComparisonStatus =
  | "blank"
  | "match"
  | "timeMismatch"
  | "missing"
  | "extra"
  | "outOfOrder";

type ScheduleComparisonRow = {
  key: string;
  adminPeriod?: SchedulePeriod;
  teacherPeriod?: SchedulePeriod;
  adminStatus: ScheduleComparisonStatus;
  teacherStatus: ScheduleComparisonStatus;
  sortMinute: number;
  sortIndex: number;
  rowRank: number;
};

function normalizeSchedulePeriodName(label: string) {
  return String(label || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function schedulePeriodNamesMatch(left: SchedulePeriod, right: SchedulePeriod) {
  const leftName = normalizeSchedulePeriodName(left.label);
  return Boolean(leftName && leftName === normalizeSchedulePeriodName(right.label));
}

function sameSchedulePeriodTimes(left: SchedulePeriod, right: SchedulePeriod) {
  return left.start === right.start && left.end === right.end;
}

function sameSchedulePeriod(left: SchedulePeriod, right: SchedulePeriod) {
  return schedulePeriodNamesMatch(left, right) && sameSchedulePeriodTimes(left, right);
}

function schedulePeriodSortMinute(period?: SchedulePeriod) {
  return hhmmToMinutes(period?.start || "") ?? Number.MAX_SAFE_INTEGER;
}

function buildScheduleComparisonRows(
  adminPeriods: SchedulePeriod[],
  teacherPeriods: SchedulePeriod[],
): ScheduleComparisonRow[] {
  const matchedTeacherIndexes = new Set<number>();
  const matchesByAdminIndex = new Map<
    number,
    { adminPeriod: SchedulePeriod; teacherPeriod: SchedulePeriod; teacherIndex: number }
  >();

  adminPeriods.forEach((adminPeriod, adminIndex) => {
    const teacherIndex = teacherPeriods.findIndex(
      (teacherPeriod, candidateIndex) =>
        !matchedTeacherIndexes.has(candidateIndex) &&
        schedulePeriodNamesMatch(adminPeriod, teacherPeriod),
    );
    if (teacherIndex >= 0) {
      matchedTeacherIndexes.add(teacherIndex);
      matchesByAdminIndex.set(adminIndex, {
        adminPeriod,
        teacherPeriod: teacherPeriods[teacherIndex],
        teacherIndex,
      });
    }
  });

  const matchedAdminRows = adminPeriods
    .map((adminPeriod, adminIndex) => {
      const match = matchesByAdminIndex.get(adminIndex);
      return match ? { adminIndex, teacherIndex: match.teacherIndex, adminPeriod } : null;
    })
    .filter((item): item is { adminIndex: number; teacherIndex: number; adminPeriod: SchedulePeriod } =>
      Boolean(item),
    );
  const outOfOrderTeacherIndexes = new Set<number>();

  for (let leftIndex = 0; leftIndex < matchedAdminRows.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < matchedAdminRows.length; rightIndex += 1) {
      const left = matchedAdminRows[leftIndex];
      const right = matchedAdminRows[rightIndex];
      if (left.teacherIndex > right.teacherIndex) {
        outOfOrderTeacherIndexes.add(left.teacherIndex);
        outOfOrderTeacherIndexes.add(right.teacherIndex);
      }
    }
  }

  const rows: ScheduleComparisonRow[] = adminPeriods.map((adminPeriod, adminIndex) => {
    const match = matchesByAdminIndex.get(adminIndex);
    const timesMatch = Boolean(match && sameSchedulePeriodTimes(adminPeriod, match.teacherPeriod));
    const teacherOutOfOrder = Boolean(match && outOfOrderTeacherIndexes.has(match.teacherIndex));
    return {
      key: `admin-${adminPeriod.id}-${adminIndex}-${match?.teacherPeriod.id || "missing"}`,
      adminPeriod,
      teacherPeriod: match?.teacherPeriod,
      adminStatus: match ? (timesMatch ? "match" : "timeMismatch") : "missing",
      teacherStatus: match
        ? teacherOutOfOrder
          ? "outOfOrder"
          : timesMatch
            ? "match"
            : "timeMismatch"
        : "blank",
      sortMinute: Math.min(
        schedulePeriodSortMinute(adminPeriod),
        match ? schedulePeriodSortMinute(match.teacherPeriod) : Number.MAX_SAFE_INTEGER,
      ),
      sortIndex: match?.teacherIndex ?? adminIndex,
      rowRank: 1,
    };
  });

  teacherPeriods.forEach((teacherPeriod, teacherIndex) => {
    if (matchedTeacherIndexes.has(teacherIndex)) return;
    rows.push({
      key: `teacher-extra-${teacherPeriod.id}-${teacherIndex}`,
      teacherPeriod,
      adminStatus: "blank",
      teacherStatus: "extra",
      sortMinute: schedulePeriodSortMinute(teacherPeriod),
      sortIndex: teacherIndex,
      rowRank: 0,
    });
  });

  return rows.sort(
    (left, right) =>
      left.sortMinute - right.sortMinute ||
      left.sortIndex - right.sortIndex ||
      left.rowRank - right.rowRank,
  );
}

function scheduleCompliesWithAdmin(
  privateSchedule: ScheduleTemplate,
  adminSchedule: ScheduleTemplate,
) {
  return buildScheduleComparisonRows(adminSchedule.periods, privateSchedule.periods).every((row) => {
    if (!row.adminPeriod) return true;
    return Boolean(
      row.teacherPeriod &&
        row.adminStatus === "match" &&
        row.teacherStatus === "match" &&
      sameSchedulePeriod(row.adminPeriod, row.teacherPeriod),
    );
  });
}

function applyAdminScheduleSelection(draft: PawPassState, sharedScheduleId: string) {
  const sharedSchedule = draft.schedules.find(
    (schedule) => schedule.active && !schedule.ownerUserId && schedule.id === sharedScheduleId,
  );
  if (!sharedSchedule) return;

  draft.selectedScheduleId = sharedSchedule.id;
  draft.periodOverrideId = "";
  draft.selectedScheduleIdByUserId = draft.selectedScheduleIdByUserId || {};
  getTeachers(draft).forEach((teacher) => {
    const personalSchedule = getPersonalScheduleForSharedSchedule(
      draft,
      teacher.id,
      sharedSchedule.id,
    );
    draft.selectedScheduleIdByUserId[teacher.id] = personalSchedule?.id || sharedSchedule.id;
  });
}

const scheduleCopyName = (name: string) => `${name} Copy`;

const makeLocalScheduleId = () =>
  `schedule-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function schedulePeriodToEditorPeriod(period: SchedulePeriod, index: number): ScheduleEditorPeriod {
  const duration = periodDurationMinutes(period);
  return {
    localId: `${period.id}-${index}`,
    id: period.id,
    label: period.label,
    originalLabel: period.label,
    start: period.start,
    originalStart: period.start,
    durationInput: String(duration),
    originalDurationMinutes: duration,
  };
}

function makeBlankEditorPeriod(index: number, start = "08:00", durationMinutes = 45): ScheduleEditorPeriod {
  const duration = Math.max(1, Math.round(durationMinutes || 45));
  return {
    localId: `new-period-${Date.now()}-${index}`,
    id: "",
    label: `Period ${index + 1}`,
    originalLabel: `Period ${index + 1}`,
    start,
    originalStart: start,
    durationInput: String(duration),
    originalDurationMinutes: duration,
  };
}

function editorPeriodLabel(period: ScheduleEditorPeriod, index: number) {
  return period.label.trim() || period.originalLabel || `Period ${index + 1}`;
}

function editorPeriodStart(period: ScheduleEditorPeriod) {
  return period.start || period.originalStart || "08:00";
}

function editorPeriodDuration(period: ScheduleEditorPeriod) {
  const parsed = Number(period.durationInput);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.round(parsed)
    : Math.max(1, period.originalDurationMinutes || 45);
}

function editorPeriodsToSchedulePeriods(periods: ScheduleEditorPeriod[]) {
  const usedIds = new Set<string>();
  return periods.map((period, index) => {
    const label = editorPeriodLabel(period, index);
    const start = editorPeriodStart(period);
    let id = period.id || makePeriodId(label, index, usedIds);
    if (period.id) {
      if (usedIds.has(id)) {
        id = makePeriodId(label, index, usedIds);
      } else {
        usedIds.add(id);
      }
    }
    return {
      id,
      label,
      start,
      end: addMinutesToHHMM(start, editorPeriodDuration(period)),
    };
  });
}

function getOutdatedSchedulePairs(state: PawPassState, user: StaffUser | null): OutdatedSchedulePair[] {
  if (!user || user.role === "admin" || user.role === "security" || isDestinationStaff(user)) {
    return [];
  }

  const ownerKey = getScheduleSelectionKey(state, user);
  if (!ownerKey) return [];

  return state.schedules
    .filter((schedule) => schedule.active && schedule.ownerUserId === ownerKey && schedule.sourceScheduleId)
    .map((privateSchedule) => {
      const adminSchedule = state.schedules.find(
        (schedule) =>
          schedule.id === privateSchedule.sourceScheduleId &&
          schedule.active &&
          !schedule.ownerUserId,
      );
      return adminSchedule ? { privateSchedule, adminSchedule } : null;
    })
    .filter((item): item is OutdatedSchedulePair =>
      Boolean(item && !scheduleCompliesWithAdmin(item.privateSchedule, item.adminSchedule)),
    );
}

function scheduleComparisonCellSx(status: ScheduleComparisonStatus) {
  const colors: Record<ScheduleComparisonStatus, string> = {
    blank: "transparent",
    match: "#166534",
    timeMismatch: "#b91c1c",
    missing: "#7f1d1d",
    extra: "#111827",
    outOfOrder: "#c2410c",
  };
  return {
    color: colors[status],
    fontWeight: status === "blank" ? 400 : 900,
  };
}

function ScheduleComparisonCell({
  period,
  status,
}: {
  period?: SchedulePeriod;
  status: ScheduleComparisonStatus;
}) {
  if (!period) {
    return <Box sx={{ minHeight: 36 }} />;
  }
  const cellSx = scheduleComparisonCellSx(status);
  return (
    <Stack spacing={0.25} sx={{ minHeight: 36 }}>
      <Typography variant="body2" sx={cellSx}>
        {period.label}
      </Typography>
      <Typography variant="caption" sx={cellSx}>
        {period.start}-{period.end}
      </Typography>
    </Stack>
  );
}

function ScheduleComparisonPreview({
  adminPeriods,
  teacherPeriods,
}: {
  adminPeriods: SchedulePeriod[];
  teacherPeriods: SchedulePeriod[];
}) {
  const rows = buildScheduleComparisonRows(adminPeriods, teacherPeriods);
  return (
    <Box
      sx={{
        border: "1px solid rgba(15, 23, 42, 0.12)",
        borderRadius: 1,
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          bgcolor: "rgba(15, 23, 42, 0.05)",
        }}
      >
        <Typography variant="subtitle2" fontWeight={900} sx={{ p: 1 }}>
          Latest admin schedule
        </Typography>
        <Typography variant="subtitle2" fontWeight={900} sx={{ p: 1 }}>
          Your current copy
        </Typography>
      </Box>
      {rows.map((row) => (
        <Box
          key={row.key}
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            borderTop: "1px solid rgba(15, 23, 42, 0.08)",
          }}
        >
          <Box sx={{ p: 1, borderRight: "1px solid rgba(15, 23, 42, 0.08)" }}>
            <ScheduleComparisonCell period={row.adminPeriod} status={row.adminStatus} />
          </Box>
          <Box sx={{ p: 1 }}>
            <ScheduleComparisonCell period={row.teacherPeriod} status={row.teacherStatus} />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function SortableSchedulePeriodRow({
  period,
  index,
  periodsLength,
  onUpdate,
  onRemove,
}: {
  period: ScheduleEditorPeriod;
  index: number;
  periodsLength: number;
  onUpdate: (localId: string, patch: Partial<ScheduleEditorPeriod>) => void;
  onRemove: (localId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: period.localId });

  return (
    <Box
      ref={setNodeRef}
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "auto 1fr", md: "auto 1.2fr 0.8fr 0.8fr 0.8fr auto" },
        gap: 1,
        alignItems: "center",
        p: 1,
        border: "1px solid rgba(15, 23, 42, 0.12)",
        borderRadius: 1,
        bgcolor: isDragging ? "rgba(176, 196, 222, 0.35)" : "#ffffff",
        boxShadow: isDragging ? "0 12px 28px rgba(15, 23, 42, 0.16)" : "none",
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.86 : 1,
      }}
    >
      <Tooltip title="Hold and drag to reorder">
        <IconButton
          size="small"
          {...attributes}
          {...listeners}
          sx={{
            cursor: isDragging ? "grabbing" : "grab",
            touchAction: "none",
            gridRow: { xs: "1 / span 5", md: "auto" },
            alignSelf: "center",
          }}
          aria-label={`Reorder period ${index + 1}`}
        >
          <DragIndicatorIcon />
        </IconButton>
      </Tooltip>
      <TextField
        size="small"
        label="Name"
        value={period.label}
        onChange={(event) => onUpdate(period.localId, { label: event.target.value })}
      />
      <TextField
        size="small"
        type="time"
        label="Start"
        value={period.start}
        onChange={(event) => onUpdate(period.localId, { start: event.target.value })}
        InputLabelProps={{ shrink: true }}
      />
      <TextField
        size="small"
        type="number"
        label="Duration"
        value={period.durationInput}
        onChange={(event) => onUpdate(period.localId, { durationInput: event.target.value })}
      />
      <TextField
        size="small"
        label="End Preview"
        value={addMinutesToHHMM(editorPeriodStart(period), editorPeriodDuration(period))}
        InputProps={{ readOnly: true }}
      />
      <Tooltip title={periodsLength === 1 ? "At least one period is required" : "Remove period"}>
        <span>
          <IconButton
            color="error"
            disabled={periodsLength === 1}
            onClick={() => onRemove(period.localId)}
            aria-label={`Remove period ${index + 1}`}
          >
            <DeleteIcon />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}

function ScheduleEditorDialog({
  open,
  state,
  user,
  target,
  onClose,
  onMutate,
}: {
  open: boolean;
  state: PawPassState;
  user: StaffUser;
  target: ScheduleEditorTarget | null;
  onClose: () => void;
  onMutate: (mutator: (draft: PawPassState) => void) => void;
}) {
  const [name, setName] = useState("");
  const [periods, setPeriods] = useState<ScheduleEditorPeriod[]>([]);
  const schedule = target?.schedule;
  const ownerKey = getScheduleSelectionKey(state, user);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );
  const sourceAdminSchedule = schedule?.sourceScheduleId
    ? state.schedules.find((item) => item.id === schedule.sourceScheduleId && !item.ownerUserId)
    : undefined;
  const previewSchedulePeriods = useMemo(
    () => editorPeriodsToSchedulePeriods(periods),
    [periods],
  );
  const previewSchedule = schedule
    ? { ...schedule, periods: previewSchedulePeriods }
    : undefined;
  const adminChanged =
    Boolean(sourceAdminSchedule && previewSchedule) &&
    (Number(sourceAdminSchedule?.updatedAt || 0) > Number(schedule?.sourceAdminUpdatedAt || 0) ||
      !scheduleCompliesWithAdmin(
        previewSchedule as ScheduleTemplate,
        sourceAdminSchedule as ScheduleTemplate,
      ));

  useEffect(() => {
    if (!open) return;
    const baseSchedule = schedule;
    const basePeriods = baseSchedule?.periods.length
      ? baseSchedule.periods.map(schedulePeriodToEditorPeriod)
      : [makeBlankEditorPeriod(0)];
    setPeriods(basePeriods);
    if (target?.mode === "duplicate" && baseSchedule) {
      setName(scheduleCopyName(baseSchedule.name));
    } else if (target?.mode === "edit" && baseSchedule) {
      setName(
        baseSchedule.ownerUserId || user.role === "admin"
          ? baseSchedule.name
          : `${baseSchedule.name} - Mine`,
      );
    } else {
      setName("");
    }
  }, [open, target?.mode, schedule, user.role]);

  const title =
    target?.mode === "edit"
      ? schedule && !schedule.ownerUserId && user.role !== "admin"
        ? "Customize Shared Schedule"
        : "Edit Schedule"
      : target?.mode === "duplicate"
        ? "Duplicate Schedule"
        : "Add New Schedule";

  const insertPeriodAfter = (index: number) => {
    setPeriods((current) => {
      const previous = current[index];
      if (!previous) {
        return [
          ...current.slice(0, index + 1),
          makeBlankEditorPeriod(index + 1),
          ...current.slice(index + 1),
        ];
      }
      const previousDuration = editorPeriodDuration(previous);
      const shortenedDuration = Math.max(1, Math.floor(previousDuration / 2));
      const insertedDuration = Math.max(1, previousDuration - shortenedDuration);
      const insertedStart = addMinutesToHHMM(editorPeriodStart(previous), shortenedDuration);
      return [
        ...current.slice(0, index),
        { ...previous, durationInput: String(shortenedDuration) },
        makeBlankEditorPeriod(index + 1, insertedStart, insertedDuration),
        ...current.slice(index + 1),
      ];
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setPeriods((current) => {
      const oldIndex = current.findIndex((period) => period.localId === active.id);
      const newIndex = current.findIndex((period) => period.localId === over.id);
      if (oldIndex < 0 || newIndex < 0) return current;
      return arrayMove(current, oldIndex, newIndex);
    });
  };

  const updatePeriod = (
    localId: string,
    patch: Partial<ScheduleEditorPeriod>,
  ) => {
    setPeriods((current) =>
      current.map((period) =>
        period.localId === localId ? { ...period, ...patch } : period,
      ),
    );
  };

  const removePeriod = (localId: string) => {
    setPeriods((current) => current.filter((period) => period.localId !== localId));
  };

  const saveSchedule = () => {
    const cleanedName = name.trim() || schedule?.name || "New Schedule";
    if (!periods.length) return;
    const nextPeriods = editorPeriodsToSchedulePeriods(periods);

    onMutate((draft) => {
      const now = Date.now();
      const selectionKey = getScheduleSelectionKey(draft, user);
      draft.selectedScheduleIdByUserId = draft.selectedScheduleIdByUserId || {};
      const globalScheduleId = getGlobalSelectedScheduleId(draft);
      const source = schedule
        ? draft.schedules.find((item) => item.id === schedule.id)
        : undefined;
      const sourceIsShared = Boolean(source && !source.ownerUserId);
      const shouldCreatePrivateCopy =
        Boolean(source) &&
        (target?.mode === "duplicate" ||
          (target?.mode === "edit" && sourceIsShared && user.role !== "admin"));
      const shouldCreateNew = target?.mode === "new" || shouldCreatePrivateCopy || !source;

      if (shouldCreateNew) {
        const createdSchedule: ScheduleTemplate = {
          id: makeLocalScheduleId(),
          name: cleanedName,
          active: true,
          periods: nextPeriods,
          ownerUserId: user.role === "admin" ? undefined : ownerKey,
          createdByUserId: user.id,
          createdAt: now,
          updatedAt: now,
          sourceScheduleId:
            source && !source.ownerUserId && user.role !== "admin" ? source.id : source?.sourceScheduleId,
          sourceAdminUpdatedAt:
            source && !source.ownerUserId && user.role !== "admin"
              ? source.updatedAt || now
              : source?.sourceAdminUpdatedAt,
        };
        draft.schedules.push(createdSchedule);
        if (!createdSchedule.ownerUserId) {
          applyAdminScheduleSelection(draft, createdSchedule.id);
        } else if (
          selectionKey &&
          (!createdSchedule.sourceScheduleId || createdSchedule.sourceScheduleId === globalScheduleId)
        ) {
          draft.selectedScheduleIdByUserId[selectionKey] = createdSchedule.id;
          draft.periodOverrideId = "";
        }
        addAudit(
          draft,
          user.id,
          target?.mode === "duplicate" ? "schedule_duplicated" : "schedule_created",
          {
            scheduleId: createdSchedule.id,
            sourceScheduleId: source?.id,
            ownerUserId: createdSchedule.ownerUserId || "shared",
          },
        );
        return;
      }

      source.name = cleanedName;
      source.periods = nextPeriods;
      source.updatedAt = now;
      if (source.sourceScheduleId) {
        const adminSource = draft.schedules.find((item) => item.id === source.sourceScheduleId);
        source.sourceAdminUpdatedAt = adminSource?.updatedAt || source.sourceAdminUpdatedAt;
        source.adminUpdateDismissedAt = undefined;
      }
      if (!source.ownerUserId && user.role === "admin") {
        applyAdminScheduleSelection(draft, source.id);
      } else if (
        selectionKey &&
        source.ownerUserId === selectionKey &&
        (!source.sourceScheduleId || source.sourceScheduleId === globalScheduleId)
      ) {
        draft.selectedScheduleIdByUserId[selectionKey] = source.id;
        draft.periodOverrideId = "";
      }
      addAudit(draft, user.id, "schedule_updated", {
        scheduleId: source.id,
        ownerUserId: source.ownerUserId || "shared",
      });
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {adminChanged && sourceAdminSchedule && schedule ? (
            <Alert severity="warning" icon={<WarningAmberIcon />}>
              <Stack spacing={1.25}>
                <Typography fontWeight={900}>
                  The shared admin schedule changed after this private copy was made.
                </Typography>
                <ScheduleComparisonPreview
                  adminPeriods={sourceAdminSchedule.periods}
                  teacherPeriods={previewSchedulePeriods}
                />
              </Stack>
            </Alert>
          ) : null}

          <TextField
            label="Schedule name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            fullWidth
          />

          <Box>
            <Typography variant="h6">Periods</Typography>
            <Typography variant="body2" color="text.secondary">
              Set a start time and duration. The end time updates as a preview.
            </Typography>
          </Box>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={periods.map((period) => period.localId)}
              strategy={verticalListSortingStrategy}
            >
              <Stack spacing={0.5}>
                {periods.map((period, index) => (
                  <React.Fragment key={period.localId}>
                    <SortableSchedulePeriodRow
                      period={period}
                      index={index}
                      periodsLength={periods.length}
                      onUpdate={updatePeriod}
                      onRemove={removePeriod}
                    />
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto 1fr",
                        alignItems: "center",
                        gap: 1,
                        px: 1,
                      }}
                    >
                      <Divider />
                      <Tooltip title="Add period here">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => insertPeriodAfter(index)}
                          aria-label={`Add period after ${period.label || `period ${index + 1}`}`}
                        >
                          <AddIcon />
                        </IconButton>
                      </Tooltip>
                      <Divider />
                    </Box>
                  </React.Fragment>
                ))}
              </Stack>
            </SortableContext>
          </DndContext>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!periods.length}
          onClick={saveSchedule}
        >
          Save Schedule
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ScheduleSettingsSection({
  state,
  user,
  onMutate,
}: {
  state: PawPassState;
  user: StaffUser;
  onMutate: (mutator: (draft: PawPassState) => void) => void;
}) {
  const effectiveTeacherId = getEffectiveTeacherId(user, state);
  const visibleSchedules = getVisibleSchedules(state, user);
  const activeSchedule = getSchedule(state, user);
  const canManageSchedules =
    user.role === "admin" || user.role === "teacher" || user.role === "substitute";
  const outdatedPairs = getOutdatedSchedulePairs(state, user);
  const activeOutdatedPair =
    outdatedPairs.find((pair) => pair.privateSchedule.id === activeSchedule.id) ||
    outdatedPairs[0];
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [editorTarget, setEditorTarget] = useState<ScheduleEditorTarget | null>(null);

  const selectSchedule = (scheduleId: string) => {
    onMutate((draft) => {
      const selectionKey = getScheduleSelectionKey(draft, user);
      const selectedSchedule = draft.schedules.find(
        (schedule) => schedule.active && schedule.id === scheduleId,
      );
      draft.selectedScheduleIdByUserId = draft.selectedScheduleIdByUserId || {};
      if (user.role === "admin" && selectedSchedule && !selectedSchedule.ownerUserId) {
        applyAdminScheduleSelection(draft, selectedSchedule.id);
      } else if (selectionKey) {
        const personalSchedule =
          selectedSchedule && !selectedSchedule.ownerUserId
            ? getPersonalScheduleForSharedSchedule(draft, selectionKey, selectedSchedule.id)
            : undefined;
        draft.selectedScheduleIdByUserId[selectionKey] = personalSchedule?.id || scheduleId;
      }
      draft.periodOverrideId = "";
      addAudit(draft, user.id, "schedule_selected", { scheduleId }, { effectiveTeacherId });
    });
  };

  const openAdminUpdateEditor = (pair: OutdatedSchedulePair) => {
    setTemplatesOpen(false);
    setEditorTarget({ mode: "edit", schedule: pair.privateSchedule });
  };

  const updateButton = (pair: OutdatedSchedulePair, compact = false) => (
    <Button
      size={compact ? "small" : "medium"}
      variant="contained"
      startIcon={<WarningAmberIcon />}
      onClick={() => openAdminUpdateEditor(pair)}
      sx={{
        bgcolor: "#ca8a04",
        color: "#111827",
        fontWeight: 900,
        "&:hover": { bgcolor: "#a16207" },
      }}
    >
      Update Admin Schedule Now
    </Button>
  );

  return (
    <SectionPaper>
      <Stack spacing={1.5}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
          <Box flex={1}>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Typography variant="h6">Schedule</Typography>
              {canManageSchedules ? (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setEditorTarget({ mode: "new" })}
                >
                  Add New Schedule
                </Button>
              ) : null}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Select the day schedule used by the period carousel and request roster.
            </Typography>
          </Box>
          <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 240 } }}>
            <InputLabel id="settings-schedule-label">Schedule</InputLabel>
            <Select
              labelId="settings-schedule-label"
              label="Schedule"
              value={activeSchedule.id}
              onChange={(event) => selectSchedule(String(event.target.value))}
            >
              {visibleSchedules.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.name}
                  {item.ownerUserId ? " (personal)" : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
        {activeOutdatedPair ? (
          <Alert
            severity="warning"
            icon={<WarningAmberIcon />}
            action={updateButton(activeOutdatedPair, true)}
          >
            Admin updated {activeOutdatedPair.adminSchedule.name}. Your private copy still uses the
            older period setup until you review it side by side.
          </Alert>
        ) : null}
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Button size="small" variant="text" onClick={() => setTemplatesOpen(true)}>
            See All
          </Button>
        </Box>
      </Stack>
      <Dialog open={templatesOpen} onClose={() => setTemplatesOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>All Schedules</DialogTitle>
        <DialogContent>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Periods</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleSchedules.map((item) => {
                const outdatedPair = outdatedPairs.find((pair) => pair.privateSchedule.id === item.id);
                const editLabel = item.ownerUserId || user.role === "admin" ? "Edit" : "Customize";
                const teacherViewingSharedAdminSchedule =
                  !item.ownerUserId && (user.role === "teacher" || user.role === "substitute");
                return (
                  <TableRow
                    key={item.id}
                    sx={{
                      bgcolor: teacherViewingSharedAdminSchedule
                        ? "rgba(176, 196, 222, 0.45)"
                        : "inherit",
                    }}
                  >
                    <TableCell>
                      <Typography fontWeight={900}>{item.name}</Typography>
                      {item.sourceScheduleId ? (
                        <Typography variant="caption" color="text.secondary">
                          Based on an admin schedule
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {item.periods
                        .map((period) => `${period.label} ${period.start}-${period.end}`)
                        .join("; ")}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.75} justifyContent="flex-end" flexWrap="wrap">
                        {outdatedPair ? updateButton(outdatedPair, true) : null}
                        {canManageSchedules ? (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<EditIcon />}
                            onClick={() => setEditorTarget({ mode: "edit", schedule: item })}
                          >
                            {editLabel}
                          </Button>
                        ) : null}
                        {canManageSchedules ? (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<RefreshIcon />}
                            onClick={() => setEditorTarget({ mode: "duplicate", schedule: item })}
                          >
                            Duplicate
                          </Button>
                        ) : null}
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button variant="contained" onClick={() => setTemplatesOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
      <ScheduleEditorDialog
        open={Boolean(editorTarget)}
        state={state}
        user={user}
        target={editorTarget}
        onClose={() => setEditorTarget(null)}
        onMutate={onMutate}
      />
    </SectionPaper>
  );
}

function SettingsView({
  state,
  user,
  onMutate,
}: {
  state: PawPassState;
  user: StaffUser;
  onMutate: (mutator: (draft: PawPassState) => void) => void;
}) {
  const staffDestination = destinationForStaffRole(user.role);

  const setNumberSetting = (key: keyof typeof settingsDefaults, seconds: number) => {
    onMutate((draft) => {
      if (key === "quietModeDefault") return;
      draft.settings[key] = Math.max(1, seconds) * 1000;
      addAudit(draft, user.id, "settings_updated", { key, seconds });
    });
  };

  const setMinuteSetting = (key: "autoFreezeStartPeriodMs" | "autoFreezeEndPeriodMs", minutes: number) => {
    onMutate((draft) => {
      draft.settings[key] = Math.max(0, minutes) * 60_000;
      addAudit(draft, user.id, "settings_updated", { key, minutes });
    });
  };

  if (staffDestination && user.role !== "admin") {
    return (
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5">Settings</Typography>
          <Typography variant="body2" color="text.secondary">
            {destinationLabels[staffDestination]} can pause new requests or auto-pause when the active list reaches a limit.
          </Typography>
        </Box>
        <ScheduleSettingsSection state={state} user={user} onMutate={onMutate} />
        <DestinationBlockControls
          state={state}
          user={user}
          destinations={[staffDestination]}
          onMutate={onMutate}
        />
      </Stack>
    );
  }

  if (user.role !== "admin") {
    return (
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5">Settings</Typography>
        </Box>
        <ScheduleSettingsSection state={state} user={user} onMutate={onMutate} />
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5">Settings</Typography>
        <Typography variant="body2" color="text.secondary">
          Admin thresholds apply to all teachers and groups.
        </Typography>
      </Box>

      <ScheduleSettingsSection state={state} user={user} onMutate={onMutate} />

      <SectionPaper>
        <Stack spacing={2}>
          <Typography variant="h6">Configuration</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
            <TextField
              type="number"
              label="Permit response window (seconds)"
              value={Math.round(state.settings.permitWindowMs / 1000)}
              onChange={(event) => setNumberSetting("permitWindowMs", Number(event.target.value))}
            />
            <TextField
              type="number"
              label="Eloper threshold (seconds)"
              value={Math.round(state.settings.eloperAfterMs / 1000)}
              onChange={(event) => setNumberSetting("eloperAfterMs", Number(event.target.value))}
            />
            <TextField
              type="number"
              label="Pass-over retry (seconds)"
              value={Math.round(state.settings.retrySkippedAfterMs / 1000)}
              onChange={(event) => setNumberSetting("retrySkippedAfterMs", Number(event.target.value))}
            />
            <TextField
              type="number"
              label="Habit delay (seconds)"
              value={Math.round(state.settings.habitDelayMs / 1000)}
              onChange={(event) => setNumberSetting("habitDelayMs", Number(event.target.value))}
            />
            <TextField
              type="number"
              label="Auto-freeze start of period (minutes)"
              value={Math.round(state.settings.autoFreezeStartPeriodMs / 60_000)}
              onChange={(event) => setMinuteSetting("autoFreezeStartPeriodMs", Number(event.target.value))}
            />
            <TextField
              type="number"
              label="Auto-freeze end of period (minutes)"
              value={Math.round(state.settings.autoFreezeEndPeriodMs / 60_000)}
              onChange={(event) => setMinuteSetting("autoFreezeEndPeriodMs", Number(event.target.value))}
            />
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={state.settings.quietModeDefault}
                onChange={(event) =>
                  onMutate((draft) => {
                    draft.settings.quietModeDefault = event.target.checked;
                    addAudit(draft, user.id, "settings_updated", {
                      key: "quietModeDefault",
                      value: event.target.checked,
                    });
                  })
                }
              />
            }
            label="Quiet mode on by default"
          />
        </Stack>
      </SectionPaper>

      <DestinationBlockControls
        state={state}
        user={user}
        destinations={specialDestinationKeys}
        onMutate={onMutate}
      />
    </Stack>
  );
}

function TermsView() {
  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5">Terms and Disclosure</Typography>
        <Typography variant="body2" color="text.secondary">
          Plain-language staff terms for the app.
        </Typography>
      </Box>
      <SectionPaper>
        <Stack spacing={1.5}>
          <Typography variant="h6">Staff-only use</Typography>
          <Typography>
            Paw Pass is intended only for authorized teachers, substitutes, administrators, and
            security staff. Students should not operate this app or view records.
          </Typography>
          <Typography variant="h6">Student privacy</Typography>
          <Typography>
            Use only the minimum information needed to supervise hallway movement. Classroom views
            should use generated usernames. Full student ids, birth dates, home information, and
            unrelated student records should not be entered into Paw Pass.
          </Typography>
          <Typography variant="h6">Audit trail</Typography>
          <Typography>
            Actions are logged with the staff actor. When a substitute acts for a teacher, the
            substitute receives the audit attribution while the roster and class context remain the
            selected teacher's room.
          </Typography>
          <Typography variant="h6">School policy</Typography>
          <Typography>
            Paw Pass should be reviewed and approved by the school or district before production
            use. Retention, access, and disclosure settings should match district policy and
            applicable student privacy requirements.
          </Typography>
        </Stack>
      </SectionPaper>
    </Stack>
  );
}

function PawPassApp() {
  const [state, setState] = useState<PawPassState>(() => loadPawPassState());
  const [localNicknames, setLocalNicknames] = useState<LocalNicknameMap>(() => loadLocalNicknames());
  const [now, setNow] = useState(Date.now());
  const [view, setView] = useState<ViewKey>("home");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scheduleNoticeOpen, setScheduleNoticeOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(() =>
    typeof window === "undefined" ? "" : window.sessionStorage.getItem(currentUserStorageKey) || "",
  );
  const [error, setError] = useState("");

  const currentUser = useMemo(
    () => state.staffUsers.find((user) => user.id === currentUserId) || null,
    [state.staffUsers, currentUserId],
  );
  const destinationStaff = isDestinationStaff(currentUser);
  const activeView = destinationStaff
    ? view === "terms"
      ? "terms"
      : view === "settings"
        ? "settings"
        : "inbound"
    : view === "inbound"
      ? "home"
      : view;
  const effectiveTeacherId = getEffectiveTeacherId(currentUser, state);
  const activeEloperCount = currentUser
    ? state.elopers.filter(
        (eloper) => eloper.active && getVisibleTeacherIds(currentUser, state).includes(eloper.teacherId),
      ).length
    : 0;
  const scheduleUpdatePairs = currentUser
    ? getOutdatedSchedulePairs(state, currentUser)
    : [];
  const scheduleUpdateNoticeKey = scheduleUpdatePairs
    .map(
      ({ privateSchedule, adminSchedule }) =>
        `${privateSchedule.id}:${adminSchedule.updatedAt || 0}`,
    )
    .join("|");

  const mutate = (mutator: (draft: PawPassState) => void) => {
    try {
      setState((previous) => {
        const draft = deepClone(previous);
        mutator(draft);
        return draft;
      });
      setError("");
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Action failed.");
    }
  };

  const updateLocalNickname = (
    teacherId: string,
    periodId: string,
    username: string,
    nickname: string,
    previousUsername = username,
  ) => {
    setLocalNicknames((previous) => {
      const next = { ...previous };
      const key = localNicknameKey(teacherId, periodId, username);
      const previousKey = localNicknameKey(teacherId, periodId, previousUsername);
      if (previousKey !== key) delete next[previousKey];
      const cleanedNickname = normalizeNickname(nickname);
      if (cleanedNickname) {
        next[key] = cleanedNickname;
      } else {
        delete next[key];
      }
      saveLocalNicknames(next);
      return next;
    });
  };

  useEffect(() => {
    const tick = window.setInterval(() => {
      setNow(Date.now());
      setState((previous) => {
        const draft = deepClone(previous);
        return advanceQueues(draft) ? draft : previous;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    savePawPassState(state);
  }, [state]);

  useEffect(() => {
    if (scheduleUpdateNoticeKey) {
      setScheduleNoticeOpen(true);
    } else {
      setScheduleNoticeOpen(false);
    }
  }, [currentUserId, scheduleUpdateNoticeKey]);

  if (!currentUser) {
    return (
      <LoginScreen
        state={state}
        onSignIn={(user) => {
          mutate((draft) => {
            draft.termsAcceptedByUserId[user.id] = Date.now();
            addAudit(draft, user.id, "terms_accepted", { version: "local-draft-v1" });
            addAudit(draft, user.id, "login", { method: "local-demo", role: user.role });
          });
          setCurrentUserId(user.id);
          window.sessionStorage.setItem(currentUserStorageKey, user.id);
        }}
      />
    );
  }

  const logout = () => {
    setCurrentUserId("");
    window.sessionStorage.removeItem(currentUserStorageKey);
  };

  const resetDemo = () => {
    const fresh = createInitialState();
    setState(fresh);
    setLocalNicknames({});
    savePawPassState(fresh);
    saveLocalNicknames({});
  };

  const closeScheduleNotice = (openSettings = false) => {
    setScheduleNoticeOpen(false);
    if (openSettings) setView("settings");
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
        <Dialog
          open={scheduleNoticeOpen && scheduleUpdatePairs.length > 0}
          onClose={() => closeScheduleNotice(false)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>Admin Schedule Updated</DialogTitle>
          <DialogContent>
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <Alert severity="warning" icon={<WarningAmberIcon />}>
                An admin schedule used by one of your private schedules has changed. Your copy stays
                active until you update it.
              </Alert>
              {scheduleUpdatePairs.map(({ privateSchedule, adminSchedule }) => (
                <Box
                  key={`${privateSchedule.id}-${adminSchedule.id}`}
                  sx={{
                    border: "1px solid rgba(15, 23, 42, 0.12)",
                    borderRadius: 1,
                    p: 1.25,
                  }}
                >
                  <Typography fontWeight={900}>{privateSchedule.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Latest admin template: {adminSchedule.name}
                  </Typography>
                </Box>
              ))}
              <Typography variant="body2" color="text.secondary">
                Open Settings under Schedule to compare your copy side by side with the admin
                version, then use the ochre warning button to edit your copy.
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2, pt: 0 }}>
            <Button onClick={() => closeScheduleNotice(false)}>Close</Button>
            <Button variant="contained" onClick={() => closeScheduleNotice(true)}>
              Open Settings
            </Button>
          </DialogActions>
        </Dialog>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "260px 1fr" },
            minHeight: "100vh",
          }}
        >
          <Box sx={{ display: { xs: "none", md: "block" } }}>
            <Sidebar
              view={activeView}
              setView={setView}
              user={currentUser}
              activeEloperCount={activeEloperCount}
              scheduleWarningCount={scheduleUpdatePairs.length}
            />
          </Box>
          <Drawer
            open={mobileMenuOpen}
            onClose={() => setMobileMenuOpen(false)}
            ModalProps={{ keepMounted: true }}
            PaperProps={{ sx: { width: 280 } }}
          >
            <Sidebar
              view={activeView}
              setView={setView}
              user={currentUser}
              activeEloperCount={activeEloperCount}
              scheduleWarningCount={scheduleUpdatePairs.length}
              onNavigate={() => setMobileMenuOpen(false)}
            />
          </Drawer>
          <Box minWidth={0}>
            <TopBar
              state={state}
              user={currentUser}
              activeView={activeView}
              effectiveTeacherId={effectiveTeacherId}
              now={now}
              onMutate={mutate}
              onLogout={logout}
              onOpenMenu={() => setMobileMenuOpen(true)}
            />
            <Box component="main" sx={{ p: { xs: 1.5, sm: 2, lg: 3 } }}>
              <Stack spacing={2}>
                {error ? <Alert severity="error" onClose={() => setError("")}>{error}</Alert> : null}
                {activeView === "home" ? (
                  <HomeView
                    state={state}
                    user={currentUser}
                    effectiveTeacherId={effectiveTeacherId}
                    localNicknames={localNicknames}
                    now={now}
                    onMutate={mutate}
                  />
                ) : null}
                {activeView === "inbound" ? (
                  <DestinationInboundView
                    state={state}
                    user={currentUser}
                    localNicknames={localNicknames}
                    now={now}
                    onMutate={mutate}
                  />
                ) : null}
                {activeView === "rosters" ? (
                  <RosterView
                    state={state}
                    user={currentUser}
                    effectiveTeacherId={effectiveTeacherId}
                    localNicknames={localNicknames}
                    onLocalNicknameChange={updateLocalNickname}
                    onMutate={mutate}
                  />
                ) : null}
                {activeView === "elopers" ? (
                  <ElopersView
                    state={state}
                    user={currentUser}
                    localNicknames={localNicknames}
                    now={now}
                    onMutate={mutate}
                  />
                ) : null}
                {activeView === "map" ? (
                  <LiveMapView
                    state={state}
                    user={currentUser}
                    localNicknames={localNicknames}
                    now={now}
                    onMutate={mutate}
                  />
                ) : null}
                {activeView === "reports" ? (
                  <ReportsView
                    state={state}
                    user={currentUser}
                    localNicknames={localNicknames}
                    now={now}
                  />
                ) : null}
                {activeView === "settings" ? <SettingsView state={state} user={currentUser} onMutate={mutate} /> : null}
                {activeView === "terms" ? <TermsView /> : null}

                <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
                  <Button size="small" variant="text" startIcon={<RefreshIcon />} onClick={resetDemo}>
                    Reset local demo
                  </Button>
                </Stack>
              </Stack>
            </Box>
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default PawPassApp;
