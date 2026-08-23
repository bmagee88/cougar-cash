import React, { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
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
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  ThemeProvider,
  Toolbar,
  Tooltip,
  Typography,
  createTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import DashboardIcon from "@mui/icons-material/Dashboard";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import GoogleIcon from "@mui/icons-material/Google";
import GroupsIcon from "@mui/icons-material/Groups";
import LogoutIcon from "@mui/icons-material/Logout";
import MapIcon from "@mui/icons-material/Map";
import PauseCircleIcon from "@mui/icons-material/PauseCircle";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PrivacyTipIcon from "@mui/icons-material/PrivacyTip";
import RefreshIcon from "@mui/icons-material/Refresh";
import ReportIcon from "@mui/icons-material/Report";
import SettingsIcon from "@mui/icons-material/Settings";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import {
  DestinationKey,
  ImportPreviewRow,
  PassRequest,
  PawPassState,
  StaffUser,
  accountForEloper,
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
  getEffectiveTeacherId,
  getRosterStudents,
  getRoomState,
  getSchedule,
  getStudent,
  getStudentUsername,
  getTeacherGroup,
  getTeacherName,
  getTeachers,
  getVisibleTeacherIds,
  isDestinationStaff,
  isValidStudentUsername,
  markRequestEloper,
  loadPawPassState,
  permitRequest,
  receiveDestinationStudent,
  returnStudent,
  roleLabels,
  savePawPassState,
  setRoomFrozen,
  settingsDefaults,
  softDeleteRosterStudent,
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

const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const currentUserStorageKey = "paw-pass-current-user";

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

function displayStatus(status: PassRequest["status"]) {
  const labels: Record<PassRequest["status"], string> = {
    delayed: "delayed",
    waiting: "waiting",
    offered: "pending",
    out: "out",
    received: "received",
    return_waiting: "waiting return",
    return_offered: "return pending",
    returning: "returning",
    returned: "returned",
    dismissed: "dismissed",
  };
  return labels[status];
}

function msUntil(value: number | undefined, now: number) {
  if (!value) return 0;
  return Math.max(0, value - now);
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
}: {
  view: ViewKey;
  setView: (view: ViewKey) => void;
  user: StaffUser;
  activeEloperCount: number;
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
        { key: "terms", label: "Terms", icon: <PrivacyTipIcon /> },
      ]
    : [
        { key: "home", label: "Home", icon: <DashboardIcon /> },
        { key: "rosters", label: "Edit Rosters", icon: <AssignmentIndIcon /> },
        { key: "elopers", label: "Elopers", icon: <ReportIcon /> },
        { key: "map", label: "Live Map", icon: <MapIcon /> },
        { key: "reports", label: "Reports", icon: <FactCheckIcon /> },
        { key: "settings", label: "Settings", icon: <SettingsIcon />, adminOnly: true },
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
              onClick={() => setView(item.key)}
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
            </ListItemButton>
          ))}
      </List>
    </Box>
  );
}

function TopBar({
  state,
  user,
  effectiveTeacherId,
  now,
  onMutate,
  onLogout,
}: {
  state: PawPassState;
  user: StaffUser;
  effectiveTeacherId: string;
  now: number;
  onMutate: (mutator: (draft: PawPassState) => void) => void;
  onLogout: () => void;
}) {
  const schedule = getSchedule(state);
  const currentPeriod = getCurrentPeriod(state, new Date(now));
  const teachers = getTeachers(state);
  const quiet = state.quietModeByUserId[user.id] ?? state.settings.quietModeDefault;
  const staffDestination = destinationForStaffRole(user.role);

  if (staffDestination) {
    return (
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: "1px solid rgba(15, 23, 42, 0.12)" }}
      >
        <Toolbar sx={{ gap: 1.5, flexWrap: "wrap", py: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1 }}>
            <Box sx={{ width: 54 }}>
              <DestinationArt destination={staffDestination} size={48} />
            </Box>
            <Box>
              <Typography variant="h6" lineHeight={1.1}>
                {destinationLabels[staffDestination]} Desk
              </Typography>
              <Chip size="small" color="success" label="Inbound students" />
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
            >
              {quiet ? <VolumeOffIcon /> : <VolumeUpIcon />}
            </IconButton>
          </Tooltip>

          <Stack direction="row" spacing={1} alignItems="center">
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
      <Toolbar sx={{ gap: 1.5, flexWrap: "wrap", py: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, minWidth: 180 }}>
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel id="schedule-label">Schedule</InputLabel>
            <Select
              labelId="schedule-label"
              label="Schedule"
              value={state.selectedScheduleId}
              onChange={(event) => {
                const scheduleId = String(event.target.value);
                onMutate((draft) => {
                  draft.selectedScheduleId = scheduleId;
                  draft.periodOverrideId = "";
                  addAudit(draft, user.id, "schedule_selected", { scheduleId }, { effectiveTeacherId });
                });
              }}
            >
              {state.schedules
                .filter((item) => item.active)
                .map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.name}
                  </MenuItem>
              ))}
            </Select>
          </FormControl>
          {user.role === "substitute" ? (
            <Chip size="small" color="warning" label={`Audit actor: ${user.displayName}`} />
          ) : null}
        </Stack>

        {(user.role === "substitute" || canViewAll(user)) && (
          <FormControl size="small" sx={{ minWidth: 210 }}>
            <InputLabel id="acting-teacher-label">Acting for</InputLabel>
            <Select
              labelId="acting-teacher-label"
              label="Acting for"
              value={effectiveTeacherId}
              onChange={(event) => selectTeacher(String(event.target.value))}
            >
              {teachers.map((teacher) => (
                <MenuItem key={teacher.id} value={teacher.id}>
                  {teacher.displayName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <Tooltip title={quiet ? "Quiet mode on" : "Quiet mode off"}>
          <IconButton
            onClick={() => {
              onMutate((draft) => {
                const next = !(draft.quietModeByUserId[user.id] ?? draft.settings.quietModeDefault);
                draft.quietModeByUserId[user.id] = next;
                addAudit(draft, user.id, "quiet_mode_changed", { quiet: next }, { effectiveTeacherId });
              });
            }}
          >
            {quiet ? <VolumeOffIcon /> : <VolumeUpIcon />}
          </IconButton>
        </Tooltip>

        <Stack direction="row" spacing={1} alignItems="center">
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
      </Toolbar>
      <Box sx={{ px: 2, pb: 1.25 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" sx={{ rowGap: 0.75 }}>
          {schedule.periods.map((period) => {
            const selected = currentPeriod.id === period.id;
            return (
              <Chip
                key={period.id}
                label={period.label}
                color={selected ? "primary" : "default"}
                variant={selected ? "filled" : "outlined"}
                onClick={() => selectPeriod(period.id)}
                sx={{ fontWeight: selected ? 900 : 700 }}
              />
            );
          })}
        </Stack>
      </Box>
    </AppBar>
  );
}

function RequestDestinationDialog({
  open,
  studentUsername,
  onClose,
  onSelect,
}: {
  open: boolean;
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
          {requestActionKeys.map((destination) => (
            <Tooltip key={destination} title={destinationLabels[destination]}>
              <Button
                aria-label={destinationLabels[destination]}
                variant="outlined"
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
            </Tooltip>
          ))}
        </Box>
      </DialogContent>
    </Dialog>
  );
}

function HomeView({
  state,
  user,
  effectiveTeacherId,
  now,
  onMutate,
}: {
  state: PawPassState;
  user: StaffUser;
  effectiveTeacherId: string;
  now: number;
  onMutate: (mutator: (draft: PawPassState) => void) => void;
}) {
  const [tab, setTab] = useState(0);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const lastDingRef = useRef("");
  const currentPeriod = getCurrentPeriod(state, new Date(now));
  const autoFreezeWindow = getAutoFreezeWindow(state, new Date(now));
  const room = getRoomState(deepClone(state), effectiveTeacherId);
  const group = getTeacherGroup(state, effectiveTeacherId);
  const rosterStudents = getRosterStudents(state, effectiveTeacherId, currentPeriod.id);
  const quiet = state.quietModeByUserId[user.id] ?? state.settings.quietModeDefault;

  const offered = state.requests
    .filter((request) => request.teacherId === effectiveTeacherId && request.status === "offered")
    .sort((left, right) => left.requestedAt - right.requestedAt);
  const returnOffered = state.requests
    .filter((request) => request.teacherId === effectiveTeacherId && request.status === "return_offered")
    .sort((left, right) => Number(left.returnRequestedAt || left.requestedAt) - Number(right.returnRequestedAt || right.requestedAt));
  const activeAway = state.requests
    .filter((request) => request.teacherId === effectiveTeacherId && teacherAwayStatuses.includes(request.status))
    .sort((left, right) => Number(left.permittedAt || 0) - Number(right.permittedAt || 0));
  const groupNormalOut = state.requests.find(
    (request) => request.groupId === group.id && request.status === "out" && !request.isMedicalOverride,
  );
  useEffect(() => {
    const ids = [...returnOffered, ...offered].map((request) => request.id).join("|");
    if (ids && ids !== lastDingRef.current && !quiet) {
      playDing();
    }
    lastDingRef.current = ids;
  }, [offered, quiet, returnOffered]);

  const requestForStudent = (destination: DestinationKey) => {
    if (!selectedStudentId) return;
    onMutate((draft) => {
      const actor = draft.staffUsers.find((item) => item.id === user.id);
      if (!actor) return;
      if (destination === "eloper") {
        createEloperRequest(
          draft,
          actor,
          effectiveTeacherId,
          currentPeriod.id,
          selectedStudentId,
        );
      } else {
        createPassRequest(
          draft,
          actor,
          effectiveTeacherId,
          currentPeriod.id,
          destination,
          selectedStudentId,
        );
      }
      advanceQueues(draft);
    });
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
      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Button
          variant={room.frozen ? "contained" : "outlined"}
          color={room.frozen ? "warning" : "primary"}
          startIcon={room.frozen ? <PauseCircleIcon /> : <PlayArrowIcon />}
          onClick={toggleFreeze}
        >
          {room.frozen ? "Room Frozen" : "Freeze Requests"}
        </Button>
      </Stack>

      {autoFreezeWindow ? (
        <Alert severity="info">
          Auto-freeze is active at the {autoFreezeWindow.phase} of {autoFreezeWindow.period.label}. Requests can line up, but new hall departures wait.
        </Alert>
      ) : null}

      {room.frozen ? (
        <Alert severity="warning">
          Requests from this room are frozen. Existing queued students keep their original place and will get priority when thawed.
        </Alert>
      ) : null}

      <SectionPaper sx={{ p: 0 }}>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} aria-label="Paw Pass home tabs">
          <Tab label="Active" />
          <Tab label="Request" />
        </Tabs>
      </SectionPaper>

      {tab === 0 ? (
        <Stack spacing={2}>
          {returnOffered.map((request) => (
            <ReturnCallPanel
              key={request.id}
              state={state}
              request={request}
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
              onFreeze={toggleFreeze}
            />
          ))}

          {activeAway.map((request) => (
            <ActiveAwayPanel
              key={request.id}
              state={state}
              request={request}
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
                    ? `${getStudentUsername(state, groupNormalOut.studentId)} from ${getTeacherName(
                        state,
                        groupNormalOut.teacherId,
                      )} is out. Your queued students keep their position.`
                    : "No student from this room is out or pending right now."}
                </Typography>
              </Stack>
            </Paper>
          ) : null}

          <TeacherQueueAccordions
            state={state}
            effectiveTeacherId={effectiveTeacherId}
          />
        </Stack>
      ) : (
        <SectionPaper>
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
                  const alreadyActive = state.requests.some(
                    (request) =>
                      request.studentId === student.id &&
                      activePassStatuses.includes(request.status),
                  );
                  return (
                    <Button
                      key={student.id}
                      variant="contained"
                      disabled={room.frozen || alreadyActive}
                      onClick={() => setSelectedStudentId(student.id)}
                      sx={{
                        minHeight: 86,
                        fontSize: { xs: 15, sm: 17 },
                        overflowWrap: "anywhere",
                        bgcolor: student.medicalPriority ? "#0f766e" : "#1f2937",
                        "&:hover": { bgcolor: student.medicalPriority ? "#115e59" : "#111827" },
                      }}
                    >
                      <Stack spacing={0.5} alignItems="center">
                        <span>{student.username}</span>
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
        </SectionPaper>
      )}

      <RequestDestinationDialog
        open={Boolean(selectedStudentId)}
        studentUsername={selectedStudentId ? getStudentUsername(state, selectedStudentId) : ""}
        onClose={() => setSelectedStudentId("")}
        onSelect={requestForStudent}
      />
    </Stack>
  );
}

function OfferPanel({
  state,
  request,
  now,
  onPermit,
  onDismiss,
  onFreeze,
}: {
  state: PawPassState;
  request: PassRequest;
  now: number;
  onPermit: () => void;
  onDismiss: () => void;
  onFreeze: () => void;
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
              Pending
            </Typography>
            <Typography variant="h4" sx={{ overflowWrap: "anywhere" }}>
              {getStudentUsername(state, request.studentId)}
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
          <Button color="inherit" variant="outlined" onClick={onFreeze} sx={{ color: "white", borderColor: "white" }}>
            Freeze
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

function ReturnCallPanel({
  state,
  request,
  now,
  onCallBack,
}: {
  state: PawPassState;
  request: PassRequest;
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
              {getStudentUsername(state, request.studentId)}
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
  now,
  onReturn,
}: {
  state: PawPassState;
  request: PassRequest;
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
      }. The group pass can keep moving.`,
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
              {getStudentUsername(state, request.studentId)}
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

function TeacherQueueAccordions({
  state,
  effectiveTeacherId,
}: {
  state: PawPassState;
  effectiveTeacherId: string;
}) {
  const group = getTeacherGroup(state, effectiveTeacherId);
  const activeQueue = state.requests
    .filter(
      (request) =>
        request.groupId === group.id &&
        activePassStatuses.includes(request.status),
    )
    .sort(
      (left, right) =>
        statusOrder(left.status) - statusOrder(right.status) ||
        left.requestedAt - right.requestedAt,
    );

  return (
    <SectionPaper>
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Typography variant="h6">Queue</Typography>
          <Chip size="small" label={group.name} />
        </Stack>

        {group.teacherIds.map((teacherId) => {
          const room = getRoomState(deepClone(state), teacherId);
          const teacherRequests = activeQueue.filter(
            (request) => request.teacherId === teacherId,
          );

          return (
            <Accordion key={teacherId} disableGutters>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography fontWeight={900}>{getTeacherName(state, teacherId)}</Typography>
                  {room.frozen ? (
                    <Chip size="small" color="warning" label="Frozen" />
                  ) : (
                    <Chip size="small" variant="outlined" label="Open" />
                  )}
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                {teacherRequests.length ? (
                  <Stack spacing={0.75}>
                    {teacherRequests.map((request) => (
                      <Box
                        key={request.id}
                        sx={{
                          display: "grid",
                          gridTemplateColumns: {
                            xs: "1fr",
                            sm: "1fr 1fr auto auto",
                          },
                          gap: 1,
                          alignItems: "center",
                          borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
                          pb: 0.75,
                        }}
                      >
                        <Typography fontWeight={900}>
                          {getStudentUsername(state, request.studentId)}
                        </Typography>
                        <Typography variant="body2">
                          {getTeacherName(state, request.teacherId)}
                        </Typography>
                        <Chip
                          size="small"
                          color={room.frozen ? "warning" : "success"}
                          variant={room.frozen ? "filled" : "outlined"}
                          label={room.frozen ? "Frozen" : "Open"}
                        />
                        <Chip
                          size="small"
                          label={`${destinationEmojis[request.destination]} ${destinationLabels[request.destination]}`}
                        />
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Typography color="text.secondary">No students in this queue.</Typography>
                )}
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Stack>
    </SectionPaper>
  );
}

function RosterView({
  state,
  user,
  effectiveTeacherId,
  onMutate,
}: {
  state: PawPassState;
  user: StaffUser;
  effectiveTeacherId: string;
  onMutate: (mutator: (draft: PawPassState) => void) => void;
}) {
  const currentPeriod = getCurrentPeriod(state);
  const schedule = getSchedule(state);
  const [periodId, setPeriodId] = useState(currentPeriod.id === "off" ? schedule.periods[0]?.id || "p1" : currentPeriod.id);
  const [addPeriodIds, setAddPeriodIds] = useState<string[]>([currentPeriod.id === "off" ? schedule.periods[0]?.id || "p1" : currentPeriod.id]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [internalStudentId, setInternalStudentId] = useState("");
  const [medicalPriority, setMedicalPriority] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<ImportPreviewRow[]>([]);
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add student.");
    }
  };

  const parseCsv = (file: File) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        setPreview(buildImportPreview(state, result.data || []));
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

      <SectionPaper>
        <Stack spacing={2}>
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
          <Button variant="contained" startIcon={<AddIcon />} onClick={addStudent} sx={{ alignSelf: "flex-start" }}>
            Add Student
          </Button>
        </Stack>
      </SectionPaper>

      <SectionPaper>
        <Stack spacing={1.5}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
            <Box flex={1}>
              <Typography variant="h6">CSV Import Preview</Typography>
              <Typography variant="body2" color="text.secondary">
                Accepted headers: firstName, lastName, internalStudentId, medicalPriority.
              </Typography>
            </Box>
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
                  <TableCell>Medical</TableCell>
                  <TableCell>Issues</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {preview.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.rowNumber}</TableCell>
                    <TableCell>{row.username}</TableCell>
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
        <Typography variant="h6" sx={{ mb: 1 }}>
          Current Roster
        </Typography>
        {students.length ? (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Username</TableCell>
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
                  onMutate={onMutate}
                />
              ))}
            </TableBody>
          </Table>
        ) : (
          <Typography color="text.secondary">No students in this period yet.</Typography>
        )}
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
  onMutate,
}: {
  state: PawPassState;
  user: StaffUser;
  teacherId: string;
  periodId: string;
  studentId: string;
  onMutate: (mutator: (draft: PawPassState) => void) => void;
}) {
  const student = getStudent(state, studentId);
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(student?.username || "");
  const [medical, setMedical] = useState(Boolean(student?.medicalPriority));
  const [error, setError] = useState("");

  if (!student) return null;

  const save = () => {
    try {
      onMutate((draft) => {
        const actor = draft.staffUsers.find((item) => item.id === user.id);
        if (!actor) return;
        updateStudent(draft, actor, teacherId, studentId, {
          username,
          medicalPriority: medical,
        });
      });
      setError("");
      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save student.");
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
            />
            {error ? <Typography variant="caption" color="error">{error}</Typography> : null}
          </Stack>
        ) : (
          <Typography fontWeight={900}>{student.username}</Typography>
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
            <Button size="small" variant="contained" onClick={save}>
              Save
            </Button>
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
  now,
  onMutate,
}: {
  state: PawPassState;
  user: StaffUser;
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
                              return (
                                <TableRow key={eloper.id}>
                                  <TableCell>
                                    <Typography fontWeight={900}>
                                      {getStudentUsername(state, eloper.studentId)}
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
                                      Accounted For
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
  now,
  onMutate,
}: {
  state: PawPassState;
  user: StaffUser;
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
                      {getStudentUsername(state, request.studentId)}
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
        onBlur={cancelEditing}
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
  now,
  onMutate,
}: {
  state: PawPassState;
  user: StaffUser;
  now: number;
  onMutate: (mutator: (draft: PawPassState) => void) => void;
}) {
  const visibleTeachers = new Set(getVisibleTeacherIds(user, state));
  const visibleGroups = state.groups.filter((group) =>
    group.teacherIds.some((teacherId) => visibleTeachers.has(teacherId)),
  );

  return (
    <Stack spacing={2}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2 }}>
        {visibleGroups.map((group) => {
          const groupRequests = state.requests.filter(
            (request) =>
              request.groupId === group.id &&
              activePassStatuses.includes(request.status),
          );
          const active = groupRequests.filter((request) => request.status === "out");
          const pending = groupRequests.filter((request) => request.status === "offered");
          const waiting = groupRequests.filter((request) => request.status === "waiting" || request.status === "delayed");
          const totalWaiting = groupRequests.filter((request) => request.status !== "out").length;
          const activeElopers = state.elopers.filter((eloper) => eloper.groupId === group.id && eloper.active);

          return (
            <SectionPaper key={group.id}>
              <Stack spacing={1.5}>
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
                  <Chip
                    color={totalWaiting ? "warning" : "default"}
                    label={`Total Waiting ${totalWaiting}`}
                  />
                  {activeElopers.length ? <Chip color="error" label={`${activeElopers.length} eloper`} /> : null}
                </Stack>

                <Divider />

                {group.teacherIds
                  .map((teacherId) => {
                    const room = getRoomState(deepClone(state), teacherId);
                    const teacherRequests = groupRequests.filter((request) => request.teacherId === teacherId);
                    return (
                      <Box
                        key={teacherId}
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", sm: "1fr auto" },
                          gap: 1,
                          py: 0.75,
                          borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
                        }}
                      >
                        <Box>
                          <Typography fontWeight={900}>{getTeacherName(state, teacherId)}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {teacherRequests.length
                              ? teacherRequests
                                  .map((request) =>
                                    `${getStudentUsername(state, request.studentId)}: ${displayStatus(
                                      request.status,
                                    )} - ${destinationEmojis[request.destination]} ${destinationLabels[request.destination]}`,
                                  )
                                  .join(", ")
                              : "No active queue items"}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
                          {room.frozen ? <Chip size="small" color="warning" label="Frozen" /> : null}
                        </Stack>
                      </Box>
                    );
                  })}

                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip color={active.length ? "error" : "default"} label={`Out ${active.length}`} />
                  <Chip color={pending.length ? "success" : "default"} label={`Pending ${pending.length}`} />
                  <Chip label={`Waiting ${waiting.length}`} />
                  <Chip label={`Updated ${formatTime(now)}`} />
                </Stack>
              </Stack>
            </SectionPaper>
          );
        })}
      </Box>
    </Stack>
  );
}

function ReportsView({ state, user, now }: { state: PawPassState; user: StaffUser; now: number }) {
  const [teacherFilterId, setTeacherFilterId] = useState("all");
  const fullAccess = canViewAll(user);
  const teachers = getTeachers(state);
  const selectedTeacherFilterId =
    fullAccess && (teacherFilterId === "all" || teachers.some((teacher) => teacher.id === teacherFilterId))
      ? teacherFilterId
      : "all";
  const reportTeacherIds = fullAccess
    ? selectedTeacherFilterId === "all"
      ? teachers.map((teacher) => teacher.id)
      : [selectedTeacherFilterId]
    : [getEffectiveTeacherId(user, state)].filter(Boolean);
  const reportTeacherSet = new Set(reportTeacherIds);
  const rosterStudentIds = new Set<string>();
  const rosterTeacherIdsByStudent = new Map<string, Set<string>>();

  state.rosters
    .filter((roster) => roster.active && reportTeacherSet.has(roster.teacherId))
    .forEach((roster) => {
      state.rosterEntries
        .filter((entry) => entry.active && entry.rosterId === roster.id)
        .forEach((entry) => {
          rosterStudentIds.add(entry.studentId);
          const teacherIds = rosterTeacherIdsByStudent.get(entry.studentId) || new Set<string>();
          teacherIds.add(roster.teacherId);
          rosterTeacherIdsByStudent.set(entry.studentId, teacherIds);
        });
    });

  const eligibleStudents =
    fullAccess && selectedTeacherFilterId === "all"
      ? state.students.filter((student) => student.active)
      : state.students.filter((student) => student.active && rosterStudentIds.has(student.id));

  const eligibleStudentIds = new Set(eligibleStudents.map((student) => student.id));
  const scopedRequests = state.requests.filter(
    (request) =>
      reportTeacherSet.has(request.teacherId) &&
      (fullAccess && selectedTeacherFilterId === "all"
        ? true
        : eligibleStudentIds.has(request.studentId)),
  );
  const returned = scopedRequests.filter((request) => request.status === "returned" && request.permittedAt && request.returnedAt);
  const calledRequests = scopedRequests.filter((request) => request.offeredAt);
  const averageWaitMs = calledRequests.length
    ? calledRequests.reduce(
        (total, request) => total + Number(request.offeredAt! - request.requestedAt),
        0,
      ) / calledRequests.length
    : 0;
  const totalElopers = state.elopers.filter(
    (eloper) =>
      reportTeacherSet.has(eloper.teacherId) &&
      (fullAccess && selectedTeacherFilterId === "all"
        ? true
        : eligibleStudentIds.has(eloper.studentId)),
  );
  const eloperRequestIds = new Set(totalElopers.map((eloper) => eloper.requestId));
  const nonEloperReturned = returned.filter((request) => !eloperRequestIds.has(request.id));
  const averageNonEloperMs = nonEloperReturned.length
    ? nonEloperReturned.reduce((total, request) => total + Number(request.returnedAt! - request.permittedAt!), 0) /
      nonEloperReturned.length
    : 0;
  const eloperDurations = totalElopers
    .map((eloper) => {
      const request = scopedRequests.find((item) => item.id === eloper.requestId);
      const start = request?.permittedAt || eloper.permittedAt;
      const end = request?.returnedAt || eloper.accountedForAt || (eloper.active ? now : eloper.flaggedAt);
      return Math.max(0, Number(end) - Number(start));
    })
    .filter((duration) => duration > 0);
  const averageEloperMs = eloperDurations.length
    ? eloperDurations.reduce((total, duration) => total + duration, 0) / eloperDurations.length
    : 0;

  const requestCounts = requestActionKeys.map((destination) => ({
    destination,
    count: scopedRequests.filter((request) => request.destination === destination).length,
  }));

  const studentStats = eligibleStudents
    .map((student) => {
      const requests = scopedRequests.filter((request) => request.studentId === student.id);
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
      const eloperCount = state.elopers.filter(
        (eloper) => eloper.studentId === student.id && reportTeacherSet.has(eloper.teacherId),
      ).length;
      const teacherNames = Array.from(rosterTeacherIdsByStudent.get(student.id) || [])
        .map((teacherId) => getTeacherName(state, teacherId))
        .join(", ");
      return {
        student,
        teacherNames: teacherNames || "No active roster",
        requests: requests.length,
        averageMs: avg,
        averageWaitMs: avgWait,
        eloperCount,
      };
    })
    .sort((left, right) => right.requests - left.requests || left.student.username.localeCompare(right.student.username));

  return (
    <Stack spacing={2}>
      {fullAccess ? (
        <SectionPaper>
          <FormControl size="small" sx={{ minWidth: 260 }}>
            <InputLabel id="report-teacher-filter-label">Teacher</InputLabel>
            <Select
              labelId="report-teacher-filter-label"
              label="Teacher"
              value={selectedTeacherFilterId}
              onChange={(event) => setTeacherFilterId(String(event.target.value))}
            >
              <MenuItem value="all">All teachers</MenuItem>
              {teachers.map((teacher) => (
                <MenuItem key={teacher.id} value={teacher.id}>
                  {teacher.displayName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </SectionPaper>
      ) : null}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(6, 1fr)" }, gap: 1.5 }}>
        <Metric label="Requests" value={scopedRequests.length} />
        <Metric label="Returned" value={returned.length} />
        <Metric label="Total Elopers" value={totalElopers.length} danger={totalElopers.length > 0} />
        <Metric label="Avg Out Non-Elopers" value={averageNonEloperMs ? formatDuration(averageNonEloperMs) : "0:00"} />
        <Metric label="Avg Out Elopers" value={averageEloperMs ? formatDuration(averageEloperMs) : "0:00"} danger={averageEloperMs > 0} />
        <Metric label="Avg Wait To Call" value={averageWaitMs ? formatDuration(averageWaitMs) : "0:00"} />
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "0.85fr 1.15fr" }, gap: 2 }}>
        <SectionPaper>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h6" flex={1}>
              Requests
            </Typography>
            <Chip label={scopedRequests.length} />
          </Stack>
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
        </SectionPaper>

        <SectionPaper>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Student Habits
          </Typography>
          {studentStats.length ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Username</TableCell>
                  {fullAccess ? <TableCell>Teacher</TableCell> : null}
                  <TableCell>Requests</TableCell>
                  <TableCell>Avg Wait</TableCell>
                  <TableCell>Avg Out Non-Elopers</TableCell>
                  <TableCell>Elopers</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {studentStats.map((row) => (
                  <TableRow key={row.student.id}>
                    <TableCell>{row.student.username}</TableCell>
                    {fullAccess ? <TableCell>{row.teacherNames}</TableCell> : null}
                    <TableCell>{row.requests}</TableCell>
                    <TableCell>{row.averageWaitMs ? formatDuration(row.averageWaitMs) : "0:00"}</TableCell>
                    <TableCell>{row.averageMs ? formatDuration(row.averageMs) : "0:00"}</TableCell>
                    <TableCell>{row.eloperCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Typography color="text.secondary">No pass history yet.</Typography>
          )}
        </SectionPaper>
      </Box>
    </Stack>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: React.ReactNode; danger?: boolean }) {
  return (
    <SectionPaper sx={{ bgcolor: danger ? "#fef2f2" : "#ffffff" }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" color={danger ? "error" : "text.primary"}>
        {value}
      </Typography>
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
  if (user.role !== "admin") {
    return (
      <Alert severity="warning">
        Settings are admin-only. Teachers and substitutes can still use quiet mode from the top bar.
      </Alert>
    );
  }

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

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5">Settings</Typography>
        <Typography variant="body2" color="text.secondary">
          Admin thresholds apply to all teachers and groups.
        </Typography>
      </Box>

      <SectionPaper>
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
          sx={{ mt: 1 }}
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
      </SectionPaper>

      <SectionPaper>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Schedule Templates
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Periods</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {state.schedules.map((schedule) => (
              <TableRow key={schedule.id}>
                <TableCell>{schedule.name}</TableCell>
                <TableCell>
                  {schedule.periods
                    .map((period) => `${period.label} ${period.start}-${period.end}`)
                    .join("; ")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionPaper>
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
  const [now, setNow] = useState(Date.now());
  const [view, setView] = useState<ViewKey>("home");
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

  useEffect(() => {
    const tick = window.setInterval(() => {
      setNow(Date.now());
      setState((previous) => {
        const draft = deepClone(previous);
        advanceQueues(draft);
        return draft;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    savePawPassState(state);
  }, [state]);

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
    savePawPassState(fresh);
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "260px 1fr" },
            minHeight: "100vh",
          }}
        >
          <Sidebar
            view={activeView}
            setView={setView}
            user={currentUser}
            activeEloperCount={activeEloperCount}
          />
          <Box minWidth={0}>
            <TopBar
              state={state}
              user={currentUser}
              effectiveTeacherId={effectiveTeacherId}
              now={now}
              onMutate={mutate}
              onLogout={logout}
            />
            <Box component="main" sx={{ p: { xs: 1.5, sm: 2, lg: 3 } }}>
              <Stack spacing={2}>
                {error ? <Alert severity="error" onClose={() => setError("")}>{error}</Alert> : null}
                {activeView === "home" ? (
                  <HomeView
                    state={state}
                    user={currentUser}
                    effectiveTeacherId={effectiveTeacherId}
                    now={now}
                    onMutate={mutate}
                  />
                ) : null}
                {activeView === "inbound" ? (
                  <DestinationInboundView
                    state={state}
                    user={currentUser}
                    now={now}
                    onMutate={mutate}
                  />
                ) : null}
                {activeView === "rosters" ? (
                  <RosterView
                    state={state}
                    user={currentUser}
                    effectiveTeacherId={effectiveTeacherId}
                    onMutate={mutate}
                  />
                ) : null}
                {activeView === "elopers" ? (
                  <ElopersView
                    state={state}
                    user={currentUser}
                    now={now}
                    onMutate={mutate}
                  />
                ) : null}
                {activeView === "map" ? (
                  <LiveMapView
                    state={state}
                    user={currentUser}
                    now={now}
                    onMutate={mutate}
                  />
                ) : null}
                {activeView === "reports" ? <ReportsView state={state} user={currentUser} now={now} /> : null}
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
