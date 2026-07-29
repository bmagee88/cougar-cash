import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DashboardIcon from "@mui/icons-material/Dashboard";
import DownloadIcon from "@mui/icons-material/Download";
import EditIcon from "@mui/icons-material/Edit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import HomeIcon from "@mui/icons-material/Home";
import ListAltIcon from "@mui/icons-material/ListAlt";
import MonitorIcon from "@mui/icons-material/Monitor";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ThumbUpAltOutlinedIcon from "@mui/icons-material/ThumbUpAltOutlined";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  createTheme,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ThemeProvider,
  Tooltip,
  Typography,
  Switch,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Link as RouterLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  closeSession,
  copyPost,
  createParticipant,
  createPost,
  createSession,
  deletePost,
  downloadSessionCsv,
  flagPost,
  getSession,
  getEventSourceUrl,
  listActiveSessions,
  plusOnePost,
  renameColumns,
  renameSession,
  startSession,
  updateShowMe,
  updatePost,
  verifyParticipant,
} from "./padletApi";
import {
  PadletColumn,
  PadletCredentials,
  PadletPost,
  PadletSessionSnapshot,
  PadletSessionSummary,
  PadletSessionType,
} from "./types";
import {
  PADLET_AUDIT_UPDATED_EVENT,
  TeacherFlaggedPostRecord,
  TeacherSessionAuditRecord,
  clearClosedTeacherSessions,
  clearTeacherFlaggedPosts,
  markTeacherSessionClosed,
  readStudentCheckIds,
  readTeacherFlaggedPosts,
  readTeacherSessionAudits,
  recordStudentCheckId,
  recordTeacherFlaggedPosts,
  recordTeacherSessionAudit,
  removeTeacherFlaggedPost,
  updateTeacherFlaggedPostNote,
} from "./auditStorage";

const SESSION_ID_PATTERN = /^session[0-9A-F]{3}$/;
const PARTICIPANT_CODE_PATTERN = /^user[0-9A-F]{4}$/;
const DEFAULT_MAX_LENGTH = 32;
const DEFAULT_SOFT_LENGTH = 16;
const PADLET_APP_PASSWORD = "theyrejustkids";
const PADLET_PASSWORD_KEY = "padletAppUnlocked";
const MAX_RECONNECT_ATTEMPTS = 5;

const padletTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#7dd3fc",
      contrastText: "#07111f",
    },
    background: {
      default: "#0f172a",
      paper: "#172033",
    },
    text: {
      primary: "#edf4ff",
      secondary: "#aebbd0",
    },
    divider: "#31415c",
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
  },
});

type SessionStatus = PadletSessionSnapshot["status"];

function hostStorageKey(sessionId: string) {
  return `padletHost:${sessionId}`;
}

function savedHostTokenForSession(sessionId: string) {
  if (!SESSION_ID_PATTERN.test(sessionId)) return "";

  try {
    const directToken = localStorage.getItem(hostStorageKey(sessionId)) || "";
    if (directToken) return directToken;

    const auditToken =
      readTeacherSessionAudits().find((record) => record.sessionId === sessionId)
        ?.hostToken || "";

    if (auditToken) {
      localStorage.setItem(hostStorageKey(sessionId), auditToken);
    }

    return auditToken;
  } catch {
    return "";
  }
}

function participantStorageKey(sessionId: string) {
  return `padletParticipant:${sessionId}`;
}

function savedParticipantCodeForSession(sessionId: string) {
  if (!SESSION_ID_PATTERN.test(sessionId)) return "";

  try {
    return normalizeParticipantAlias(
      localStorage.getItem(participantStorageKey(sessionId)) || ""
    );
  } catch {
    return "";
  }
}

function normalizeSessionAlias(value: string) {
  const hex = value
    .replace(/^session/i, "")
    .toUpperCase()
    .replace(/[^0-9A-F]/g, "")
    .slice(0, 3);

  return hex ? `session${hex}` : "";
}

function normalizeParticipantAlias(value: string) {
  const hex = value
    .replace(/^user/i, "")
    .toUpperCase()
    .replace(/[^0-9A-F]/g, "")
    .slice(0, 4);

  return hex ? `user${hex}` : "";
}

function normalizeAliasDigits(value: string, maxLength: number) {
  return value.toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, maxLength);
}

function aliasDigits(value: string) {
  return normalizeAliasDigits(value.replace(/^user/i, ""), 4);
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function formatRemaining(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function statusChipStyles(status: SessionStatus) {
  if (status === "active") {
    return {
      bgcolor: "#15803d",
      borderColor: "#15803d",
      color: "#fff",
    };
  }

  if (status === "closed" || status === "expired") {
    return {
      bgcolor: "#fde2e2",
      borderColor: "#f3b5b5",
      color: "#9f1239",
    };
  }

  return {
    bgcolor: "#fff7ed",
    borderColor: "#fed7aa",
    color: "#9a3412",
  };
}

function sessionTypeLabel(type: PadletSessionType) {
  return type === "one-q-many-a" ? "One Q, Many A" : "Two-column reflection";
}

function getErrorStatus(error: unknown) {
  return typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status?: number }).status)
    : undefined;
}

function avatarForCode(
  session: PadletSessionSnapshot | null | undefined,
  code: string
) {
  if (!session || !code || code === "HOST") return "";
  return (
    session.participantProfiles.find((profile) => profile.code === code)?.avatarUrl ||
    session.participants?.find((participant) => participant.code === code)
      ?.avatarUrl ||
    ""
  );
}

function joinUrlForSession(sessionId: string) {
  return `${window.location.origin}/padlet/join?session=${sessionId}`;
}

function AvatarAliasChip({
  alias,
  avatarUrl,
  labelPrefix = "",
  size = "small",
}: {
  alias: string;
  avatarUrl?: string;
  labelPrefix?: string;
  size?: "small" | "medium";
}) {
  return (
    <Chip
      avatar={
        avatarUrl ? (
          <Avatar src={avatarUrl} alt={alias} />
        ) : (
          <Avatar>{alias.slice(0, 1).toUpperCase()}</Avatar>
        )
      }
      label={`${labelPrefix}${alias}`}
      size={size}
      variant="outlined"
      sx={{
        fontFamily: "monospace",
        fontWeight: 900,
        fontSize: size === "medium" ? 18 : 15,
        height: size === "medium" ? 44 : 34,
        "& .MuiChip-avatar": {
          height: size === "medium" ? 34 : 26,
          width: size === "medium" ? 34 : 26,
        },
      }}
    />
  );
}

function AvatarAliasBlock({
  alias,
  avatarUrl,
  labelPrefix = "",
  size = "poster",
}: {
  alias: string;
  avatarUrl?: string;
  labelPrefix?: string;
  size?: "poster" | "like";
}) {
  const avatarSize = size === "poster" ? 54 : 40;
  const width = size === "poster" ? 72 : 58;

  return (
    <Stack
      spacing={0.5}
      alignItems="center"
      sx={{ width, minWidth: width, overflow: "hidden" }}
    >
      <Avatar
        src={avatarUrl}
        alt={alias}
        sx={{
          width: avatarSize,
          height: avatarSize,
          fontWeight: 900,
          fontSize: size === "poster" ? 22 : 16,
        }}
      >
        {alias.slice(0, 1).toUpperCase()}
      </Avatar>
      <Typography
        variant="caption"
        sx={{
          fontFamily: "monospace",
          fontWeight: 900,
          lineHeight: 1.1,
          maxWidth: "100%",
          overflowWrap: "anywhere",
          textAlign: "center",
        }}
      >
        {labelPrefix}
        {alias}
      </Typography>
    </Stack>
  );
}

function useSessionStream(
  sessionId: string | undefined,
  credentials: PadletCredentials | null
) {
  const [session, setSession] = useState<PadletSessionSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [streamError, setStreamError] = useState("");
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [terminalReason, setTerminalReason] = useState<
    "" | "not-found" | "reconnect-limit"
  >("");
  const hostToken = credentials?.hostToken;
  const code = credentials?.code;

  useEffect(() => {
    if (!sessionId || (!hostToken && !code)) {
      return undefined;
    }

    let closed = false;
    let attempts = 0;
    const activeCredentials = { hostToken, code };
    const source = new EventSource(getEventSourceUrl(sessionId, activeCredentials));

    async function checkSessionStillExists() {
      try {
        await getSession(sessionId, activeCredentials);
      } catch (caught) {
        const status = getErrorStatus(caught);
        if (status === 404 || status === 410) {
          source.close();
          setConnected(false);
          setTerminalReason("not-found");
          setStreamError("This session is no longer available.");
        }
      }
    }

    source.addEventListener("session", (event) => {
      if (closed) return;
      const message = event as MessageEvent<string>;
      setSession(JSON.parse(message.data));
      setConnected(true);
      setStreamError("");
      setReconnectAttempts(0);
      setTerminalReason("");
      attempts = 0;
    });

    source.onerror = () => {
      if (closed) return;
      attempts += 1;
      setConnected(false);
      setReconnectAttempts(attempts);
      setStreamError("Updates are reconnecting.");
      checkSessionStillExists();

      if (attempts >= MAX_RECONNECT_ATTEMPTS) {
        source.close();
        setTerminalReason("reconnect-limit");
        setStreamError("The connection could not be restored.");
      }
    };

    return () => {
      closed = true;
      source.close();
    };
  }, [code, hostToken, sessionId]);

  return {
    connected,
    reconnectAttempts,
    reconnecting: Boolean(streamError && !terminalReason),
    session,
    setSession,
    streamError,
    terminalReason,
  };
}

function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        color: "text.primary",
        py: { xs: 2, md: 3 },
      }}
    >
      <Container maxWidth="xl">{children}</Container>
    </Box>
  );
}

function StatusChip({ status }: { status: SessionStatus }) {
  return (
    <Chip
      size="small"
      variant="outlined"
      label={status.toUpperCase()}
      sx={{ fontWeight: 700, letterSpacing: 0, ...statusChipStyles(status) }}
    />
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <PageFrame>
      <Paper
        elevation={0}
        sx={{
          border: "1px solid #d9e2ef",
          borderRadius: 2,
          p: 3,
          display: "flex",
          alignItems: "center",
          gap: 2,
        }}
      >
        <CircularProgress size={22} />
        <Typography>{label}</Typography>
      </Paper>
    </PageFrame>
  );
}

function ReconnectOverlay({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 1300,
        bgcolor: "rgba(7, 17, 31, 0.68)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          border: "1px solid #31415c",
          borderRadius: 2,
          p: 2,
          minWidth: 220,
          textAlign: "center",
        }}
      >
        <CircularProgress size={30} sx={{ mb: 1 }} />
        <Typography sx={{ fontWeight: 800 }}>Reconnecting</Typography>
      </Paper>
    </Box>
  );
}

function CreateSessionPanel() {
  const navigate = useNavigate();
  const [boardName, setBoardName] = useState("Class Board");
  const [sessionType, setSessionType] =
    useState<PadletSessionType>("good-not-good");
  const [columnA, setColumnA] = useState("Good At");
  const [columnB, setColumnB] = useState("Not Good At");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canCreate =
    Boolean(boardName.trim()) &&
    (sessionType === "one-q-many-a"
      ? Boolean(prompt.trim())
      : Boolean(columnA.trim() && columnB.trim()));

  async function handleCreate() {
    setBusy(true);
    setError("");

    try {
      const response = await createSession(
        sessionType === "one-q-many-a"
          ? { name: boardName, type: sessionType, prompt }
          : { name: boardName, type: sessionType, columnTitles: [columnA, columnB] }
      );
      const createdSessionId = normalizeSessionAlias(
        response.sessionId || response.session.id
      );
      localStorage.setItem(hostStorageKey(createdSessionId), response.hostToken);
      localStorage.setItem(hostStorageKey(response.session.id), response.hostToken);
      recordTeacherSessionAudit(response.session, response.hostToken);
      navigate(`/padlet/host/${createdSessionId}`);
    } catch (caught) {
      setError(messageFromError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: 0 }}>
          Create Session
        </Typography>
        <Typography sx={{ color: "text.secondary", mt: 0.5 }}>
          Start a one-hour classroom board and share the join link.
        </Typography>
      </Box>

      <Paper
        elevation={0}
        sx={{ border: "1px solid #d9e2ef", borderRadius: 2, p: 3 }}
      >
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Board name"
              value={boardName}
              inputProps={{ maxLength: 64 }}
              onChange={(event) => setBoardName(event.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              select
              fullWidth
              label="Session type"
              value={sessionType}
              onChange={(event) =>
                setSessionType(event.target.value as PadletSessionType)
              }
            >
              <MenuItem value="good-not-good">Two-column reflection</MenuItem>
              <MenuItem value="one-q-many-a">One Q, Many A</MenuItem>
            </TextField>
          </Grid>
          {sessionType === "good-not-good" ? (
            <>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="First column"
                  value={columnA}
                  inputProps={{ maxLength: DEFAULT_MAX_LENGTH }}
                  onChange={(event) => setColumnA(event.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Second column"
                  value={columnB}
                  inputProps={{ maxLength: DEFAULT_MAX_LENGTH }}
                  onChange={(event) => setColumnB(event.target.value)}
                />
              </Grid>
            </>
          ) : (
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Starting statement"
                value={prompt}
                inputProps={{ maxLength: 240 }}
                onChange={(event) => setPrompt(event.target.value)}
              />
              <Typography
                variant="caption"
                component="div"
                sx={{ color: "text.secondary", textAlign: "right", mt: 0.25 }}
              >
                {prompt.length}/240
              </Typography>
            </Grid>
          )}
        </Grid>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        <Stack direction="row" spacing={1.5} sx={{ mt: 3 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            disabled={busy || !canCreate}
            onClick={handleCreate}
          >
            Create session
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}

function SessionsPage() {
  useAuditVersion();
  const nowMs = useNow();
  const [activeSessions, setActiveSessions] = useState<PadletSessionSummary[]>(
    []
  );
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionListError, setSessionListError] = useState("");
  const [copiedSessionId, setCopiedSessionId] = useState("");
  const [displayCodeSession, setDisplayCodeSession] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [clearClosedConfirmOpen, setClearClosedConfirmOpen] = useState(false);
  const closedSessions = readTeacherSessionAudits()
    .filter((session) => session.status === "closed" || session.status === "expired")
    .sort(
      (a, b) =>
        new Date(b.closedAt || b.createdAt).getTime() -
        new Date(a.closedAt || a.createdAt).getTime()
    );

  const loadSessions = useCallback(async () => {
    try {
      const response = await listActiveSessions();
      const activeIds = new Set(response.sessions.map((session) => session.id));
      readTeacherSessionAudits()
        .filter(
          (session) =>
            (session.status === "setup" || session.status === "active") &&
            session.hostToken &&
            !activeIds.has(session.sessionId)
        )
        .forEach((session) => markTeacherSessionClosed(session.sessionId));
      setActiveSessions(response.sessions);
      setSessionListError("");
    } catch (caught) {
      setSessionListError(messageFromError(caught));
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
    const timer = window.setInterval(loadSessions, 10000);
    return () => window.clearInterval(timer);
  }, [loadSessions]);

  async function copyJoinUrl(sessionId: string) {
    try {
      await navigator.clipboard.writeText(joinUrlForSession(sessionId));
      setCopiedSessionId(sessionId);
      window.setTimeout(() => setCopiedSessionId(""), 1400);
    } catch (caught) {
      setSessionListError(messageFromError(caught));
    }
  }

  async function closeFromList(session: PadletSessionSummary) {
    const hostToken = savedHostTokenForSession(session.id);
    if (!hostToken) {
      setSessionListError("Host access for this session is not saved in this browser.");
      return;
    }

    try {
      const response = await closeSession(session.id, hostToken);
      recordTeacherSessionAudit(response.session, hostToken);
    } catch (caught) {
      const status = getErrorStatus(caught);
      if (status === 404 || status === 410 || status === undefined) {
        markTeacherSessionClosed(session.id);
      } else {
        setSessionListError(messageFromError(caught));
      }
    } finally {
      loadSessions();
    }
  }

  function confirmClearClosedSessions() {
    clearClosedTeacherSessions();
    setClearClosedConfirmOpen(false);
  }

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: 0 }}>
          Sessions
        </Typography>
        <Typography sx={{ color: "text.secondary", mt: 0.5 }}>
          Active sessions are the boards currently held in the backend memory.
        </Typography>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Accordion
            defaultExpanded
            disableGutters
            sx={{
              border: "1px solid #d9e2ef",
              borderRadius: 2,
              bgcolor: "background.paper",
              overflow: "hidden",
              "&:before": { display: "none" },
              "&.Mui-expanded": { m: 0 },
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Active Sessions
                </Typography>
                <Chip label={`${activeSessions.length} active`} size="small" />
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1.5 }}>
                <Button size="small" onClick={loadSessions}>
                  Refresh
                </Button>
              </Stack>

              {sessionListError && (
                <Alert severity="error" sx={{ mb: 1.5 }}>
                  {sessionListError}
                </Alert>
              )}

              {loadingSessions ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={18} />
                  <Typography sx={{ color: "text.secondary" }}>
                    Loading sessions...
                  </Typography>
                </Stack>
              ) : activeSessions.length === 0 ? (
                <Typography sx={{ color: "text.secondary" }}>
                  No active sessions are running right now.
                </Typography>
              ) : (
                <Stack spacing={1.25}>
                  {activeSessions.map((session) => (
                    <SessionSummaryCard
                      key={session.id}
                      session={session}
                      nowMs={nowMs}
                      copied={copiedSessionId === session.id}
                      onCopy={() => copyJoinUrl(session.id)}
                      onDisplayCode={() =>
                        setDisplayCodeSession({ id: session.id, name: session.name })
                      }
                      onClose={() => closeFromList(session)}
                    />
                  ))}
                </Stack>
              )}
            </AccordionDetails>
          </Accordion>
        </Grid>

        <Grid item xs={12}>
          <Accordion
            disableGutters
            sx={{
              border: "1px solid #d9e2ef",
              borderRadius: 2,
              bgcolor: "background.paper",
              overflow: "hidden",
              "&:before": { display: "none" },
              "&.Mui-expanded": { m: 0 },
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Closed Sessions
                </Typography>
                <Chip label={`${closedSessions.length} saved`} size="small" />
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1.5 }}>
                <Button
                  color="error"
                  size="small"
                  variant="outlined"
                  disabled={closedSessions.length === 0}
                  onClick={() => setClearClosedConfirmOpen(true)}
                >
                  Clear closed sessions
                </Button>
              </Stack>
              {closedSessions.length === 0 ? (
                <Typography sx={{ color: "text.secondary" }}>
                  No closed sessions saved on this host computer.
                </Typography>
              ) : (
                <Stack spacing={1.25}>
                  {closedSessions.map((session) => (
                    <ClosedSessionCard
                      key={`${session.sessionId}-${session.closedAt || session.createdAt}`}
                      session={session}
                    />
                  ))}
                </Stack>
              )}
            </AccordionDetails>
          </Accordion>
        </Grid>
      </Grid>

      <Dialog
        open={Boolean(displayCodeSession)}
        onClose={() => setDisplayCodeSession(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{displayCodeSession?.name}</DialogTitle>
        <DialogContent>
          <Typography
            sx={{
              fontFamily: "monospace",
              fontSize: { xs: 44, sm: 72 },
              fontWeight: 900,
              letterSpacing: 0,
              textAlign: "center",
              py: 3,
            }}
          >
            {displayCodeSession?.id}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDisplayCodeSession(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={clearClosedConfirmOpen}
        onClose={() => setClearClosedConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Clear closed sessions?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: "text.secondary" }}>
            Are you sure you want to remove the closed-session history saved on this
            computer?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearClosedConfirmOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmClearClosedSessions}>
            Clear sessions
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function SessionSummaryCard({
  session,
  nowMs,
  copied,
  onCopy,
  onDisplayCode,
  onClose,
}: {
  session: PadletSessionSummary;
  nowMs: number;
  copied: boolean;
  onCopy: () => void;
  onDisplayCode: () => void;
  onClose: () => void;
}) {
  const hostToken = savedHostTokenForSession(session.id);
  const joinUrl = joinUrlForSession(session.id);
  const expiresAtMs = new Date(session.expiresAt).getTime();
  const remainingSeconds = Number.isFinite(expiresAtMs)
    ? Math.ceil((expiresAtMs - nowMs) / 1000)
    : session.remainingSeconds;

  return (
    <Accordion
      defaultExpanded
      disableGutters
      sx={{
        border: "1px solid #d9e2ef",
        borderRadius: 2,
        bgcolor: "background.paper",
        overflow: "hidden",
        "&:before": { display: "none" },
        "&.Mui-expanded": { m: 0 },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack spacing={1} sx={{ minWidth: 0, width: "100%" }}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              label={session.id}
              size="small"
              sx={{ fontFamily: "monospace", fontWeight: 800 }}
            />
            <StatusChip status={session.status} />
            <Chip label={sessionTypeLabel(session.type)} size="small" />
          </Stack>
          <Typography sx={{ fontWeight: 900, fontSize: 20 }}>
            {session.name}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {session.participantCount} joined, {session.postCount} posts,{" "}
            {formatRemaining(remainingSeconds)} remaining
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", md: "flex-start" }}
        >
          <Stack spacing={1} sx={{ minWidth: 0, flex: 1 }}>
            {session.prompt && (
              <Typography sx={{ color: "text.secondary" }}>{session.prompt}</Typography>
            )}
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Created: {formatDateTimeWithDow(session.createdAt)}
            </Typography>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ xs: "stretch", sm: "center" }}
              sx={{ minWidth: 0 }}
            >
              <Button
                size="small"
                variant="outlined"
                startIcon={<ContentCopyIcon />}
                onClick={onCopy}
                sx={{ flexShrink: 0 }}
              >
                {copied ? "Copied" : "Copy join link"}
              </Button>
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                  fontFamily: "monospace",
                  overflowWrap: "anywhere",
                }}
              >
                {joinUrl}
              </Typography>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            {hostToken && (
              <Button
                component={RouterLink}
                to={`/padlet/host/${session.id}`}
                size="small"
                variant="outlined"
              >
                Host
              </Button>
            )}
            <Button size="small" variant="outlined" onClick={onDisplayCode}>
              Display join code
            </Button>
            <Tooltip title="Close session">
              <span>
                <IconButton
                  color="error"
                  size="small"
                  disabled={!hostToken}
                  onClick={onClose}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

function ClosedSessionCard({
  session,
}: {
  session: TeacherSessionAuditRecord;
}) {
  return (
    <Accordion
      disableGutters
      sx={{
        border: "1px solid #d9e2ef",
        borderRadius: 2,
        bgcolor: "background.paper",
        overflow: "hidden",
        "&:before": { display: "none" },
        "&.Mui-expanded": { m: 0 },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack spacing={1} sx={{ minWidth: 0, width: "100%" }}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              label={session.sessionId}
              size="small"
              sx={{ fontFamily: "monospace", fontWeight: 800 }}
            />
            <StatusChip status={session.status} />
            <Chip label={sessionTypeLabel(session.sessionType)} size="small" />
            <Chip label={`${session.participantCount} joined`} size="small" />
          </Stack>
          <Typography sx={{ fontWeight: 900, fontSize: 20 }}>
            {session.boardName}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Ended: {formatDateTimeWithDow(session.closedAt)}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        {session.prompt && (
          <Typography sx={{ color: "text.secondary" }}>{session.prompt}</Typography>
        )}
        <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
          Created: {formatDateTimeWithDow(session.createdAt)}
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Ended: {formatDateTimeWithDow(session.closedAt)}
        </Typography>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
          {session.participants.map((participant) => (
            <AvatarAliasChip
              key={participant.code}
              alias={participant.code}
              avatarUrl={participant.avatarUrl}
            />
          ))}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

function flaggedPostKey(post: Pick<TeacherFlaggedPostRecord, "sessionId" | "id" | "flaggedAt">) {
  return `${post.sessionId}-${post.id}-${post.flaggedAt}`;
}

function FlaggedPostNoteField({ post }: { post: TeacherFlaggedPostRecord }) {
  return (
    <TextField
      label="Note id"
      size="small"
      value={post.noteId || ""}
      inputProps={{ maxLength: 80 }}
      onChange={(event) => updateTeacherFlaggedPostNote(post, event.target.value)}
      sx={{ minWidth: 140 }}
    />
  );
}

function HostSessionPage() {
  const navigate = useNavigate();
  const params = useParams();
  const sessionId = normalizeSessionAlias(params.sessionId || "");
  const [hostToken] = useState(() =>
    sessionId ? savedHostTokenForSession(sessionId) : ""
  );
  const credentials = useMemo(
    () => (hostToken ? { hostToken } : null),
    [hostToken]
  );
  const {
    reconnecting,
    session,
    setSession,
    streamError,
    terminalReason,
  } = useSessionStream(sessionId, credentials);
  const [actionError, setActionError] = useState("");
  const [copied, setCopied] = useState(false);

  const joinUrl = useMemo(() => {
    if (!sessionId) return "";
    return `${window.location.origin}/padlet/join?session=${sessionId}`;
  }, [sessionId]);

  useEffect(() => {
    if (session && hostToken) {
      recordTeacherSessionAudit(session, hostToken);
    }
  }, [hostToken, session]);

  useEffect(() => {
    if (terminalReason && sessionId) {
      markTeacherSessionClosed(sessionId);
      navigate(`/padlet/join?session=${sessionId}`, { replace: true });
    }
  }, [navigate, sessionId, terminalReason]);

  const runHostAction = useCallback(
    async (action: () => Promise<{ session: PadletSessionSnapshot }>) => {
      setActionError("");
      try {
        const response = await action();
        setSession(response.session);
      } catch (caught) {
        setActionError(messageFromError(caught));
      }
    },
    [setSession]
  );

  async function copyJoinUrl() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch (caught) {
      setActionError(messageFromError(caught));
    }
  }

  if (!SESSION_ID_PATTERN.test(sessionId) || !hostToken) {
    return (
      <PageFrame>
        <Stack spacing={2}>
          <Alert severity="warning" sx={{ borderRadius: 2 }}>
            Host access for this session is not saved in this browser. If you just
            created it, the host key did not make it into this site&apos;s local
            browser storage.
          </Alert>
          <Button
            component={RouterLink}
            to="/padlet"
            variant="contained"
            sx={{ alignSelf: "flex-start" }}
          >
            Back to dashboard
          </Button>
        </Stack>
      </PageFrame>
    );
  }

  if (!session) {
    return <LoadingPanel label="Connecting to host session..." />;
  }

  return (
    <PageFrame>
      <Stack spacing={2}>
        <Paper
          elevation={0}
          sx={{ border: "1px solid #d9e2ef", borderRadius: 2, p: 2 }}
        >
          <Stack
            direction={{ xs: "column", lg: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", lg: "center" }}
            justifyContent="space-between"
          >
            <Stack spacing={0.5}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Box sx={{ width: { xs: "100%", md: 320 } }}>
                  <BoardNameEditor
                    name={session.name}
                    disabled={
                      session.status === "closed" || session.status === "expired"
                    }
                    onRename={(name) =>
                      runHostAction(() => renameSession(session.id, hostToken, name))
                    }
                  />
                </Box>
                <Chip
                  label={session.id}
                  size="small"
                  sx={{ fontFamily: "monospace", fontWeight: 800 }}
                />
                <StatusChip status={session.status} />
              </Stack>
              <Typography sx={{ color: "text.secondary" }}>
                Join URL: {joinUrl}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                variant="outlined"
                startIcon={<ContentCopyIcon />}
                onClick={copyJoinUrl}
              >
                {copied ? "Copied" : "Copy link"}
              </Button>
              <Button
                component={RouterLink}
                to="/padlet/teacher-dashboard"
                variant="outlined"
                startIcon={<DashboardIcon />}
              >
                  Monitoring
                </Button>
              {(session.status === "closed" || session.status === "expired") && (
                <Button
                  component={RouterLink}
                  to="/padlet"
                  variant="contained"
                  startIcon={<DashboardIcon />}
                >
                  Back to dashboard
                </Button>
              )}
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={() =>
                  runHostAction(async () => {
                    await downloadSessionCsv(session, hostToken);
                    return { session };
                  })
                }
              >
                CSV
              </Button>
              {session.status === "setup" && (
                <Button
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  onClick={() =>
                    runHostAction(() => startSession(session.id, hostToken))
                  }
                >
                  Open session
                </Button>
              )}
              {session.status !== "closed" && session.status !== "expired" && (
                <Button
                  color="error"
                  variant="outlined"
                  startIcon={<CloseIcon />}
                  onClick={() => {
                    if (window.confirm("Close this session now?")) {
                      runHostAction(() => closeSession(session.id, hostToken));
                    }
                  }}
                >
                  Close
                </Button>
              )}
            </Stack>
          </Stack>
        </Paper>

        {streamError && <Alert severity="info">{streamError}</Alert>}
        {actionError && <Alert severity="error">{actionError}</Alert>}
        <ReconnectOverlay show={reconnecting} />

        <SessionStatusAlert session={session} role="host" />

        <BoardCanvas
          session={session}
          credentials={{ hostToken }}
          actorCode="HOST"
          canModerate
          onError={setActionError}
          onSessionChange={setSession}
        />

        <HostFlaggedPostsPanel sessionId={session.id} />
      </Stack>
    </PageFrame>
  );
}

function HostFlaggedPostsPanel({ sessionId }: { sessionId: string }) {
  useAuditVersion();
  const flaggedPosts = readTeacherFlaggedPosts().filter(
    (post) => post.sessionId === sessionId
  );

  return (
    <Paper
      elevation={0}
      sx={{ border: "1px solid #d9e2ef", borderRadius: 2, p: 2 }}
    >
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
        Flagged Posts
      </Typography>
      {flaggedPosts.length === 0 ? (
        <Typography sx={{ color: "text.secondary" }}>
          No flagged posts saved for this session.
        </Typography>
      ) : (
        <Stack spacing={1.25}>
          {flaggedPosts.map((post) => (
            <Box
              key={flaggedPostKey(post)}
              sx={{
                border: "1px solid #f3b5b5",
                borderRadius: 2,
                p: 1.5,
                bgcolor: "rgba(127, 29, 29, 0.18)",
              }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                alignItems={{ xs: "stretch", sm: "center" }}
                flexWrap="wrap"
                useFlexGap
              >
                <AvatarAliasChip
                  alias={post.studentCode}
                  avatarUrl={post.studentAvatarUrl || post.authorAvatarUrl}
                  labelPrefix="Student "
                />
                <FlaggedPostNoteField post={post} />
                <Chip label={post.postType || "post"} size="small" />
                <Chip
                  label={`Flagged ${formatDateTime(post.flaggedAt)}`}
                  size="small"
                />
              </Stack>
              <Typography sx={{ mt: 1, wordBreak: "break-word" }}>
                {post.text}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                Posted: {formatDateTime(post.createdAt)}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Paper>
  );
}

function JoinPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [sessionId, setSessionId] = useState(() =>
    normalizeSessionAlias(searchParams.get("session") || "")
  );
  const [issuedCode, setIssuedCode] = useState("");
  const [issuedAvatarUrl, setIssuedAvatarUrl] = useState("");
  const [issuedBoardName, setIssuedBoardName] = useState("");
  const [enteredCode, setEnteredCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const savedCode = savedParticipantCodeForSession(sessionId);

  useEffect(() => {
    const storedCode = savedParticipantCodeForSession(sessionId);

    if (storedCode) {
      setIssuedCode(storedCode);
      setIssuedAvatarUrl("");
      setIssuedBoardName("");
      setEnteredCode(aliasDigits(storedCode));
      setError("");
      return;
    }

    setIssuedCode("");
    setIssuedAvatarUrl("");
    setIssuedBoardName("");
    setEnteredCode("");
  }, [sessionId]);

  async function handleGetCode() {
    setBusy(true);
    setError("");

    try {
      const storedCode = savedParticipantCodeForSession(sessionId);
      const response = storedCode
        ? await verifyParticipant(sessionId, storedCode)
        : await createParticipant(sessionId);
      localStorage.setItem(participantStorageKey(sessionId), response.code);
      setIssuedCode(response.code);
      setIssuedAvatarUrl(response.avatarUrl || avatarForCode(response.session, response.code));
      setIssuedBoardName(response.session.name);
      setEnteredCode(aliasDigits(response.code));
      recordStudentCheckId({
        sessionId,
        code: response.code,
        avatarUrl: response.avatarUrl,
        session: response.session,
      });
    } catch (caught) {
      setError(messageFromError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    const normalizedCode = normalizeParticipantAlias(enteredCode);
    const storedCode = savedParticipantCodeForSession(sessionId);

    if (storedCode && normalizedCode !== storedCode) {
      setIssuedCode(storedCode);
      setEnteredCode(aliasDigits(storedCode));
      setError(`This browser is already assigned ${storedCode} for this session.`);
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response = await verifyParticipant(sessionId, normalizedCode);
      localStorage.setItem(participantStorageKey(sessionId), response.code);
      recordStudentCheckId({
        sessionId,
        code: response.code,
        avatarUrl: response.avatarUrl,
        session: response.session,
      });
      navigate(`/padlet/session/${sessionId}?code=${response.code}`);
    } catch (caught) {
      setError(messageFromError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageFrame>
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: 0 }}>
            Join Board
          </Typography>
          <Typography sx={{ color: "text.secondary", mt: 0.5 }}>
            Enter the session id from your host.
          </Typography>
        </Box>

        <Paper
          elevation={0}
          sx={{ border: "1px solid #d9e2ef", borderRadius: 2, p: 3 }}
        >
          <Stack spacing={2}>
            <Alert severity="info">
              Posts are anonymous to classmates by default, but your teacher can still
              connect posts to your alias.
            </Alert>
            <TextField
              label="Session id"
              value={sessionId}
              inputProps={{ maxLength: 10 }}
              onChange={(event) =>
                setSessionId(normalizeSessionAlias(event.target.value))
              }
              sx={{ maxWidth: 240 }}
            />
            <Button
              variant="contained"
              disabled={busy || !SESSION_ID_PATTERN.test(sessionId)}
              onClick={handleGetCode}
              sx={{ alignSelf: "flex-start" }}
            >
              {savedCode ? "Use saved alias" : "Get alias"}
            </Button>
            <Button
              component={RouterLink}
              to="/padlet/check-id"
              sx={{ alignSelf: "flex-start" }}
            >
              Check this browser&apos;s ids
            </Button>

            {issuedCode && (
              <Box
                sx={{
                  border: "1px solid #d9e2ef",
                  borderRadius: 2,
                  p: 2,
                  bgcolor: "background.default",
                }}
              >
                <Stack spacing={1.5}>
                  {issuedBoardName && (
                    <Typography sx={{ fontWeight: 800 }}>
                      {issuedBoardName}
                    </Typography>
                  )}
                  <Typography sx={{ fontWeight: 700 }}>Your alias</Typography>
                  <AvatarAliasChip
                    alias={issuedCode}
                    avatarUrl={issuedAvatarUrl}
                    size="medium"
                  />
                  <TextField
                    label="Enter alias"
                    value={enteredCode}
                    inputProps={{ maxLength: 4 }}
                    onChange={(event) =>
                      setEnteredCode(normalizeAliasDigits(event.target.value, 4))
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !busy &&
                        PARTICIPANT_CODE_PATTERN.test(
                          normalizeParticipantAlias(enteredCode)
                        )
                      ) {
                        event.preventDefault();
                        handleJoin();
                      }
                    }}
                    sx={{ maxWidth: 240 }}
                  />
                  <Button
                    variant="contained"
                    disabled={
                      busy ||
                      !PARTICIPANT_CODE_PATTERN.test(
                        normalizeParticipantAlias(enteredCode)
                      )
                    }
                    onClick={handleJoin}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    Join session
                  </Button>
                </Stack>
              </Box>
            )}

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </Paper>
      </Stack>
    </PageFrame>
  );
}

function ClientSessionPage() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const sessionId = normalizeSessionAlias(params.sessionId || "");
  const [code] = useState(() => {
    const queryCode = normalizeParticipantAlias(searchParams.get("code") || "");
    if (queryCode) return queryCode;
    return sessionId
      ? normalizeParticipantAlias(
          localStorage.getItem(participantStorageKey(sessionId)) || ""
        )
      : "";
  });
  const credentials = useMemo(() => (code ? { code } : null), [code]);
  const {
    reconnecting,
    session,
    setSession,
    streamError,
    terminalReason,
  } = useSessionStream(sessionId, credentials);
  const [actionError, setActionError] = useState("");
  const showMe = Boolean(
    session?.participantProfiles.find((profile) => profile.code === code)?.showMe
  );

  const updateOwnVisibility = useCallback(
    async (nextShowMe: boolean) => {
      if (!session) return;
      setActionError("");
      try {
        const response = await updateShowMe(session.id, code, nextShowMe);
        setSession(response.session);
      } catch (caught) {
        const status = getErrorStatus(caught);
        if (status === 404 || status === 410) {
          navigate(`/padlet/join?session=${sessionId}`, { replace: true });
          return;
        }
        setActionError(messageFromError(caught));
      }
    },
    [code, navigate, session, sessionId, setSession]
  );

  useEffect(() => {
    if (sessionId && PARTICIPANT_CODE_PATTERN.test(code)) {
      localStorage.setItem(participantStorageKey(sessionId), code);
    }
  }, [code, sessionId]);

  useEffect(() => {
    if (session && sessionId && PARTICIPANT_CODE_PATTERN.test(code)) {
      recordStudentCheckId({
        sessionId,
        code,
        avatarUrl: avatarForCode(session, code),
        session,
      });
    }
  }, [code, session, sessionId]);

  useEffect(() => {
    if (terminalReason && sessionId) {
      navigate(`/padlet/join?session=${sessionId}`, { replace: true });
    }
  }, [navigate, sessionId, terminalReason]);

  if (!SESSION_ID_PATTERN.test(sessionId) || !PARTICIPANT_CODE_PATTERN.test(code)) {
    return <Navigate to={`/padlet/join?session=${sessionId}`} replace />;
  }

  if (!session) {
    return <LoadingPanel label="Joining session..." />;
  }

  return (
    <PageFrame>
      <Stack spacing={2}>
        <Paper
          elevation={0}
          sx={{ border: "1px solid #d9e2ef", borderRadius: 2, p: 2 }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            alignItems={{ xs: "flex-start", md: "center" }}
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: 0 }}>
                {session.name}
              </Typography>
              <StatusChip status={session.status} />
            </Stack>
            <AvatarAliasChip
              alias={code}
              avatarUrl={avatarForCode(session, code)}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={showMe}
                  onChange={(event) => updateOwnVisibility(event.target.checked)}
                />
              }
              label="Show me"
            />
          </Stack>
        </Paper>

        <Alert severity="info">
          Your posts are anonymous to classmates unless you turn on Show me, but your
          teacher can still connect posts to your alias.
        </Alert>

        {streamError && <Alert severity="info">{streamError}</Alert>}
        {actionError && <Alert severity="error">{actionError}</Alert>}
        <ReconnectOverlay show={reconnecting} />

        <SessionStatusAlert session={session} role="participant" />

        <BoardCanvas
          session={session}
          credentials={{ code }}
          actorCode={code}
          canModerate={false}
          onError={setActionError}
          onSessionChange={setSession}
        />
      </Stack>
    </PageFrame>
  );
}

function formatDateTime(value?: string | number | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString();
}

function formatDateTimeWithDow(value?: string | number | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function CheckIdPage() {
  const records = readStudentCheckIds();

  return (
    <PageFrame>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: 0 }}>
              Check ID
            </Typography>
            <Typography sx={{ color: "text.secondary", mt: 0.5 }}>
              Session ids and user aliases saved in this browser.
            </Typography>
          </Box>
          <Button component={RouterLink} to="/padlet/join">
            Join
          </Button>
        </Stack>

        <Paper
          elevation={0}
          sx={{ border: "1px solid #d9e2ef", borderRadius: 2, p: 2 }}
        >
          {records.length === 0 ? (
            <Typography sx={{ color: "text.secondary" }}>
              No saved session codes on this browser.
            </Typography>
          ) : (
            <Stack spacing={1.25}>
              {records.map((record) => (
                <Box
                  key={`${record.sessionId}-${record.code}`}
                  sx={{
                    border: "1px solid #d9e2ef",
                    borderRadius: 2,
                    p: 1.5,
                    bgcolor: "background.paper",
                  }}
                >
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip
                      label={record.sessionId}
                      size="small"
                      sx={{ fontFamily: "monospace", fontWeight: 800 }}
                    />
                    <AvatarAliasChip
                      alias={record.code}
                      avatarUrl={record.avatarUrl}
                    />
                    {record.sessionType && (
                      <Chip label={record.sessionType} size="small" />
                    )}
                  </Stack>
                  {record.boardName && (
                    <Typography sx={{ mt: 1, fontWeight: 800 }}>
                      {record.boardName}
                    </Typography>
                  )}
                  {record.prompt && (
                    <Typography sx={{ mt: 0.5, color: "text.secondary" }}>
                      {record.prompt}
                    </Typography>
                  )}
                  <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
                    First saved: {formatDateTime(record.joinedAt)}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Last seen: {formatDateTime(record.lastSeenAt)}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </Paper>
      </Stack>
    </PageFrame>
  );
}

function useAuditVersion() {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const refresh = () => setVersion((current) => current + 1);
    window.addEventListener(PADLET_AUDIT_UPDATED_EVENT, refresh);
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener(PADLET_AUDIT_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return version;
}

function useNow(intervalMs = 1000) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return nowMs;
}

function PasswordGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return localStorage.getItem(PADLET_PASSWORD_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password === PADLET_APP_PASSWORD) {
      localStorage.setItem(PADLET_PASSWORD_KEY, "true");
      setUnlocked(true);
      setError("");
      return;
    }

    setError("That password did not match.");
  }

  if (unlocked) {
    return <>{children}</>;
  }

  return (
    <PageFrame>
      <Box sx={{ maxWidth: 420, mx: "auto", pt: { xs: 4, md: 8 } }}>
        <Paper
          component="form"
          elevation={0}
          onSubmit={handleSubmit}
          sx={{ border: "1px solid #d9e2ef", borderRadius: 2, p: 3 }}
        >
          <Stack spacing={2}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: 0 }}>
                Padlet Access
              </Typography>
              <Typography sx={{ color: "text.secondary", mt: 0.5 }}>
                Enter the teacher password to continue.
              </Typography>
            </Box>
            <TextField
              autoFocus
              fullWidth
              type="password"
              label="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained">
              Unlock
            </Button>
          </Stack>
        </Paper>
      </Box>
    </PageFrame>
  );
}

function PadletShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navItems = [
    { to: "/padlet", label: "Home", icon: <HomeIcon /> },
    { to: "/padlet/teacher-dashboard", label: "Monitoring", icon: <MonitorIcon /> },
    { to: "/padlet/sessions", label: "Sessions", icon: <ListAltIcon /> },
  ];

  return (
    <PageFrame>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "220px minmax(0, 1fr)" },
          gap: 2,
          alignItems: "start",
        }}
      >
        <Paper
          component="nav"
          elevation={0}
          sx={{
            border: "1px solid #d9e2ef",
            borderRadius: 2,
            p: 1.25,
            position: { md: "sticky" },
            top: { md: 24 },
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 900, color: "text.secondary", px: 1, py: 0.75 }}
          >
            Padlet
          </Typography>
          <Stack spacing={0.5}>
            {navItems.map((item) => {
              const selected = location.pathname === item.to;
              return (
                <Button
                  key={item.to}
                  component={RouterLink}
                  to={item.to}
                  startIcon={item.icon}
                  variant={selected ? "contained" : "text"}
                  color={selected ? "primary" : "inherit"}
                  sx={{ justifyContent: "flex-start" }}
                >
                  {item.label}
                </Button>
              );
            })}
          </Stack>
        </Paper>
        <Box sx={{ minWidth: 0 }}>{children}</Box>
      </Box>
    </PageFrame>
  );
}

function ProtectedPadletPage({ children }: { children: React.ReactNode }) {
  return (
    <PasswordGate>
      <PadletShell>{children}</PadletShell>
    </PasswordGate>
  );
}

function ProtectedHostPage({ children }: { children: React.ReactNode }) {
  return <PasswordGate>{children}</PasswordGate>;
}

function PadletHomePage() {
  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: 0 }}>
          Padlet Home
        </Typography>
        <Typography sx={{ color: "text.secondary", mt: 0.5 }}>
          Create boards, manage sessions, and monitor flagged responses.
        </Typography>
      </Box>

      <CreateSessionPanel />

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Paper
            elevation={0}
            sx={{ border: "1px solid #d9e2ef", borderRadius: 2, p: 2 }}
          >
            <Stack spacing={1.5}>
              <ListAltIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Sessions
              </Typography>
              <Typography sx={{ color: "text.secondary" }}>
                See active boards, show join codes, and close sessions.
              </Typography>
              <Button
                component={RouterLink}
                to="/padlet/sessions"
                variant="contained"
                sx={{ alignSelf: "flex-start" }}
              >
                Open sessions
              </Button>
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper
            elevation={0}
            sx={{ border: "1px solid #d9e2ef", borderRadius: 2, p: 2 }}
          >
            <Stack spacing={1.5}>
              <MonitorIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Monitoring
              </Typography>
              <Typography sx={{ color: "text.secondary" }}>
                Review flagged posts from this browser.
              </Typography>
              <Button
                component={RouterLink}
                to="/padlet/teacher-dashboard"
                variant="outlined"
                sx={{ alignSelf: "flex-start" }}
              >
                Open monitoring
              </Button>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
}

function TeacherDashboardPage() {
  useAuditVersion();
  const [filterInput, setFilterInput] = useState("");
  const [flagFilters, setFlagFilters] = useState<string[]>([]);
  const [flagSort, setFlagSort] = useState("flaggedAtDesc");
  const flaggedPosts = readTeacherFlaggedPosts();
  const filteredFlaggedPosts = useMemo(() => {
    const matchedPosts = flaggedPosts.filter((post) => {
      const haystack = [
        post.sessionId,
        post.sessionName,
        post.studentCode,
        post.noteId,
        post.text,
        formatDateTimeWithDow(post.flaggedAt),
        formatDateTime(post.flaggedAt),
      ]
        .join(" ")
        .toLowerCase();

      return flagFilters.every((filter) =>
        haystack.includes(filter.toLowerCase())
      );
    });

    return [...matchedPosts].sort((a, b) => {
      if (flagSort === "flaggedAtAsc") {
        return new Date(a.flaggedAt).getTime() - new Date(b.flaggedAt).getTime();
      }
      if (flagSort === "studentAsc") {
        return a.studentCode.localeCompare(b.studentCode);
      }
      if (flagSort === "sessionAsc") {
        return a.sessionId.localeCompare(b.sessionId);
      }

      return new Date(b.flaggedAt).getTime() - new Date(a.flaggedAt).getTime();
    });
  }, [flagFilters, flagSort, flaggedPosts]);

  function addFilter() {
    const filter = filterInput.trim();
    if (!filter) return;
    setFlagFilters((current) =>
      current.includes(filter) ? current : [...current, filter]
    );
    setFilterInput("");
  }

  function clearAllFlaggedRecords() {
    if (
      window.confirm(
        "Are you sure you want to clear all flagged-post records saved on this computer?"
      )
    ) {
      clearTeacherFlaggedPosts();
    }
  }

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: 0 }}>
          Monitoring
        </Typography>
        <Typography sx={{ color: "text.secondary", mt: 0.5 }}>
          Flagged-post records saved in this browser.
        </Typography>
      </Box>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
      >
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          Flagged Posts
        </Typography>
        <Button
          color="error"
          variant="outlined"
          startIcon={<CloseIcon />}
          disabled={flaggedPosts.length === 0}
          onClick={clearAllFlaggedRecords}
        >
          Clear all flagged
        </Button>
      </Stack>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.25}
        alignItems={{ xs: "stretch", sm: "center" }}
      >
        <TextField
          label="Filter flagged posts"
          size="small"
          value={filterInput}
          onChange={(event) => setFilterInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addFilter();
            }
          }}
          sx={{ flex: 1 }}
        />
        <Button variant="outlined" onClick={addFilter}>
          Add filter
        </Button>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="flag-sort-label">Sort</InputLabel>
          <Select
            labelId="flag-sort-label"
            label="Sort"
            value={flagSort}
            onChange={(event) => setFlagSort(event.target.value)}
          >
            <MenuItem value="flaggedAtDesc">Newest flagged</MenuItem>
            <MenuItem value="flaggedAtAsc">Oldest flagged</MenuItem>
            <MenuItem value="studentAsc">Student alias</MenuItem>
            <MenuItem value="sessionAsc">Session id</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {flagFilters.length > 0 && (
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          {flagFilters.map((filter) => (
            <Chip
              key={filter}
              label={filter}
              onDelete={() =>
                setFlagFilters((current) =>
                  current.filter((item) => item !== filter)
                )
              }
            />
          ))}
        </Stack>
      )}

      <TableContainer
        component={Paper}
        elevation={0}
        sx={{ border: "1px solid #d9e2ef", borderRadius: 2 }}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>session id</TableCell>
              <TableCell>student alias / note id</TableCell>
              <TableCell>flagged date time</TableCell>
              <TableCell>message posted</TableCell>
              <TableCell align="right">clear</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredFlaggedPosts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography sx={{ color: "text.secondary" }}>
                    No flagged posts match the current filter.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredFlaggedPosts.map((post) => (
                <TableRow key={flaggedPostKey(post)}>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 800 }}>
                    {post.sessionId}
                  </TableCell>
                  <TableCell>
                    <Stack
                      direction={{ xs: "column", lg: "row" }}
                      spacing={1}
                      alignItems={{ xs: "stretch", lg: "center" }}
                    >
                      <AvatarAliasChip
                        alias={post.studentCode}
                        avatarUrl={post.studentAvatarUrl || post.authorAvatarUrl}
                      />
                      <FlaggedPostNoteField post={post} />
                    </Stack>
                  </TableCell>
                  <TableCell>{formatDateTimeWithDow(post.flaggedAt)}</TableCell>
                  <TableCell sx={{ wordBreak: "break-word", minWidth: 240 }}>
                    {post.text}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Clear flagged row">
                      <IconButton
                        color="error"
                        size="small"
                        onClick={() => removeTeacherFlaggedPost(post)}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}

function SessionStatusAlert({
  session,
  role,
}: {
  session: PadletSessionSnapshot;
  role: "host" | "participant";
}) {
  if (session.status === "setup") {
    return (
      <Alert severity={role === "host" ? "info" : "warning"}>
        {role === "host"
          ? "Students can join now. Open the session when you are ready for posts."
          : "The host has not opened the session yet."}
      </Alert>
    );
  }

  if (session.status === "closed") {
    return <Alert severity="info">This session is closed.</Alert>;
  }

  if (session.status === "expired") {
    return <Alert severity="error">This session has expired.</Alert>;
  }

  return null;
}

function BoardCanvas({
  session,
  credentials,
  actorCode,
  canModerate,
  onError,
  onSessionChange,
}: {
  session: PadletSessionSnapshot;
  credentials: PadletCredentials;
  actorCode: string;
  canModerate: boolean;
  onError: (message: string) => void;
  onSessionChange: (session: PadletSessionSnapshot) => void;
}) {
  const isInteractive = session.status === "active";
  const hostToken = credentials.hostToken || "";
  const avatarByCode = useMemo(
    () =>
      new Map(
        session.participantProfiles.map((profile) => [
          profile.code,
          profile.avatarUrl,
        ])
      ),
    [session.participantProfiles]
  );
  const showByCode = useMemo(
    () =>
      new Map(
        session.participantProfiles.map((profile) => [
          profile.code,
          Boolean(profile.showMe),
        ])
      ),
    [session.participantProfiles]
  );

  const runAction = useCallback(
    async (action: () => Promise<{ session: PadletSessionSnapshot }>) => {
      onError("");
      try {
        const response = await action();
        onSessionChange(response.session);
      } catch (caught) {
        onError(messageFromError(caught));
      }
    },
    [onError, onSessionChange]
  );

  function targetColumnFor(column: PadletColumn) {
    return session.columns.find((item) => item.id !== column.id) || column;
  }

  if (session.type === "one-q-many-a") {
    return (
      <OneQManyABoard
        session={session}
        credentials={credentials}
        actorCode={actorCode}
        canModerate={canModerate}
        canInteract={isInteractive}
        hostToken={hostToken}
        avatarByCode={avatarByCode}
        showByCode={showByCode}
        runAction={runAction}
      />
    );
  }

  return (
    <Grid container spacing={2}>
      {session.columns.map((column) => {
        const columnPosts = session.posts.filter(
          (post) => post.columnId === column.id
        );
        const targetColumn = targetColumnFor(column);

        return (
          <Grid item xs={12} md={6} key={column.id}>
            <Paper
              elevation={0}
              sx={{
                border: "1px solid #d9e2ef",
                borderRadius: 2,
                p: 2,
                minHeight: { xs: 360, md: "calc(100vh - 230px)" },
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
              }}
            >
              <Stack spacing={1}>
                {canModerate ? (
                  <ColumnTitleEditor
                    column={column}
                    disabled={session.status === "closed" || session.status === "expired"}
                    onRename={(title) =>
                      runAction(() =>
                        renameColumns(session.id, hostToken, [
                          { id: column.id, title },
                        ])
                      )
                    }
                  />
                ) : (
                  <Typography
                    variant="h5"
                    sx={{ fontWeight: 800, letterSpacing: 0, minHeight: 40 }}
                  >
                    {column.title}
                  </Typography>
                )}

                <AddPostComposer
                  disabled={!isInteractive}
                  maxLength={session.limits?.maxPostLength || DEFAULT_MAX_LENGTH}
                  softLength={session.limits?.softPostLength || DEFAULT_SOFT_LENGTH}
                  onAdd={(text) =>
                    runAction(() => createPost(session.id, credentials, column.id, text))
                  }
                />
              </Stack>

              <Divider />

              <Stack spacing={1.25} sx={{ flex: 1 }}>
                {columnPosts.map((post) => (
                  <PostItem
                    key={post.id}
                    post={post}
                    actorCode={actorCode}
                    canInteract={isInteractive}
                    canModerate={canModerate}
                    avatarByCode={avatarByCode}
                    showByCode={showByCode}
                    restrictOwnPlusOne={session.type === "good-not-good"}
                    maxLength={session.limits?.maxPostLength || DEFAULT_MAX_LENGTH}
                    softLength={session.limits?.softPostLength || DEFAULT_SOFT_LENGTH}
                    copyDirection={
                      session.columns[0]?.id === column.id ? "right" : "left"
                    }
                    targetColumnTitle={targetColumn.title}
                    onPlusOne={() =>
                      runAction(() => plusOnePost(session.id, credentials, post.id))
                    }
                    onCopy={() =>
                      runAction(() =>
                        copyPost(session.id, credentials, post.id, targetColumn.id)
                      )
                    }
                    onDelete={() =>
                      runAction(() => deletePost(session.id, hostToken, post.id))
                    }
                    onFlag={() =>
                      runAction(async () => {
                        const response = await flagPost(
                          session.id,
                          hostToken,
                          post.id
                        );
                        recordTeacherFlaggedPosts(response.flaggedPosts);
                        return response;
                      })
                    }
                    onUpdate={(text) =>
                      runAction(() => updatePost(session.id, hostToken, post.id, text))
                    }
                  />
                ))}
              </Stack>
            </Paper>
          </Grid>
        );
      })}
    </Grid>
  );
}

function postTime(post: PadletPost) {
  return typeof post.createdAt === "number"
    ? post.createdAt
    : new Date(post.createdAt).getTime();
}

function sortByPlusOnes(posts: PadletPost[]) {
  return [...posts].sort((a, b) => {
    const likeDifference = b.plusOnes.length - a.plusOnes.length;
    if (likeDifference !== 0) return likeDifference;
    return postTime(a) - postTime(b);
  });
}

function OneQManyABoard({
  session,
  credentials,
  actorCode,
  canModerate,
  canInteract,
  hostToken,
  avatarByCode,
  showByCode,
  runAction,
}: {
  session: PadletSessionSnapshot;
  credentials: PadletCredentials;
  actorCode: string;
  canModerate: boolean;
  canInteract: boolean;
  hostToken: string;
  avatarByCode: Map<string, string | undefined>;
  showByCode: Map<string, boolean>;
  runAction: (
    action: () => Promise<{ session: PadletSessionSnapshot }>
  ) => Promise<void>;
}) {
  const questionColumn =
    session.columns.find((column) => column.id === "questions") ||
    session.columns[0];
  const answerColumn =
    session.columns.find((column) => column.id === "answers") ||
    session.columns[1];
  const questions = sortByPlusOnes(
    session.posts.filter(
      (post) => post.postType === "question" || post.columnId === "questions"
    )
  );

  function answersFor(questionId: string) {
    return sortByPlusOnes(
      session.posts.filter(
        (post) =>
          post.parentPostId === questionId ||
          (post.postType === "answer" && post.parentPostId === questionId)
      )
    );
  }

  function flagAndStore(postId: string) {
    return runAction(async () => {
      const response = await flagPost(session.id, hostToken, postId);
      recordTeacherFlaggedPosts(response.flaggedPosts);
      return response;
    });
  }

  return (
    <Paper
      elevation={0}
      sx={{
        border: "1px solid #d9e2ef",
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <Stack spacing={0}>
        <Box
          sx={{
            borderBottom: "1px solid #d9e2ef",
            bgcolor: "background.default",
            p: { xs: 1.5, md: 2 },
          }}
        >
          <Typography
            variant="overline"
            sx={{ color: "text.secondary", fontWeight: 800, letterSpacing: 0 }}
          >
            Statement
          </Typography>
          <Typography sx={{ fontSize: 18, fontWeight: 700, mt: 0.5 }}>
            {session.prompt}
          </Typography>
        </Box>

        <Box
          sx={{
            borderBottom: "1px solid #d9e2ef",
            bgcolor: "background.paper",
            p: { xs: 1.5, md: 2 },
          }}
        >
          <Box sx={{ maxWidth: 360 }}>
            <Typography
              variant="subtitle2"
              sx={{ color: "text.secondary", fontWeight: 800, mb: 0.75 }}
            >
              {questionColumn?.title || "Questions"}
            </Typography>
            <AddPostComposer
              disabled={!canInteract}
              maxLength={session.limits?.maxPostLength || DEFAULT_MAX_LENGTH}
              softLength={session.limits?.softPostLength || DEFAULT_SOFT_LENGTH}
              placeholder="Add question"
              onAdd={(text) =>
                runAction(() =>
                  createPost(session.id, credentials, "questions", text)
                )
              }
            />
          </Box>
        </Box>

        <Box sx={{ overflowX: "auto" }}>
          <Box sx={{ minWidth: { xs: 0, md: 880 } }}>
            <Box
              sx={{
                display: { xs: "none", md: "grid" },
                gridTemplateColumns: "320px minmax(520px, 1fr)",
                borderBottom: "1px solid #d9e2ef",
                bgcolor: "background.default",
              }}
            >
              <Box
                sx={{
                  px: 2,
                  py: 1,
                  borderRight: "1px solid #d9e2ef",
                  position: "sticky",
                  left: 0,
                  bgcolor: "background.default",
                  zIndex: 2,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", fontWeight: 800 }}
                >
                  {questionColumn?.title || "Questions"}
                </Typography>
              </Box>
              <Box sx={{ px: 2, py: 1 }}>
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", fontWeight: 800 }}
                >
                  {answerColumn?.title || "Answers"}
                </Typography>
              </Box>
            </Box>

          {questions.length === 0 && (
            <Box
              sx={{
                border: "1px dashed #b8c5d6",
                borderRadius: 2,
                p: 3,
                m: 2,
                textAlign: "center",
                color: "text.secondary",
              }}
            >
              <Typography>No questions yet.</Typography>
            </Box>
          )}

          {questions.map((question) => {
            const answers = answersFor(question.id);

            return (
              <Box
                key={question.id}
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "320px minmax(520px, 1fr)" },
                  borderBottom: "1px solid #d9e2ef",
                  bgcolor: "background.paper",
                  "&:last-child": { borderBottom: 0 },
                }}
              >
                <Box
                  sx={{
                    borderRight: { md: "1px solid #d9e2ef" },
                    bgcolor: "background.paper",
                    p: 1.25,
                    position: { md: "sticky" },
                    left: 0,
                    zIndex: 1,
                  }}
                >
                  <PostItem
                    post={question}
                    actorCode={actorCode}
                    canInteract={canInteract}
                    canModerate={canModerate}
                    avatarByCode={avatarByCode}
                    showByCode={showByCode}
                    restrictOwnPlusOne={false}
                    maxLength={session.limits?.maxPostLength || DEFAULT_MAX_LENGTH}
                    softLength={session.limits?.softPostLength || DEFAULT_SOFT_LENGTH}
                    allowCopy={false}
                    onPlusOne={() =>
                      runAction(() => plusOnePost(session.id, credentials, question.id))
                    }
                    onDelete={() =>
                      runAction(() => deletePost(session.id, hostToken, question.id))
                    }
                    onFlag={() => flagAndStore(question.id)}
                    onUpdate={(text) =>
                      runAction(() =>
                        updatePost(session.id, hostToken, question.id, text)
                      )
                    }
                  />
                </Box>

                <Box
                  sx={{
                    bgcolor: "rgba(14, 165, 233, 0.08)",
                    p: 1.25,
                    minHeight: 150,
                    display: "flex",
                    alignItems: "stretch",
                    gap: 1,
                    overflowX: "auto",
                  }}
                >
                  {answers.map((answer) => (
                    <Box
                      key={answer.id}
                      sx={{
                        width: { xs: 240, sm: 252 },
                        flex: "0 0 auto",
                      }}
                    >
                      <PostItem
                        post={answer}
                        actorCode={actorCode}
                        canInteract={canInteract}
                        canModerate={canModerate}
                        avatarByCode={avatarByCode}
                        showByCode={showByCode}
                        restrictOwnPlusOne={false}
                        maxLength={
                          session.limits?.maxPostLength || DEFAULT_MAX_LENGTH
                        }
                        softLength={
                          session.limits?.softPostLength || DEFAULT_SOFT_LENGTH
                        }
                        allowCopy={false}
                        onPlusOne={() =>
                          runAction(() =>
                            plusOnePost(session.id, credentials, answer.id)
                          )
                        }
                        onDelete={() =>
                          runAction(() => deletePost(session.id, hostToken, answer.id))
                        }
                        onFlag={() => flagAndStore(answer.id)}
                        onUpdate={(text) =>
                          runAction(() =>
                            updatePost(session.id, hostToken, answer.id, text)
                          )
                        }
                      />
                    </Box>
                  ))}

                  <Box
                    key={`answer-composer-${question.id}`}
                    sx={{
                      width: { xs: 240, sm: 252 },
                      flex: "0 0 auto",
                      border: "1px dashed #b8c5d6",
                      borderRadius: 2,
                      bgcolor: "background.paper",
                      p: 1,
                      alignSelf: "flex-start",
                    }}
                  >
                    <AddPostComposer
                      disabled={!canInteract}
                      maxLength={session.limits?.maxPostLength || DEFAULT_MAX_LENGTH}
                      softLength={session.limits?.softPostLength || DEFAULT_SOFT_LENGTH}
                      placeholder="Add answer"
                      onAdd={(text) =>
                        runAction(() =>
                          createPost(
                            session.id,
                            credentials,
                            "answers",
                            text,
                            question.id
                          )
                        )
                      }
                    />
                  </Box>
                </Box>
              </Box>
            );
          })}
          </Box>
        </Box>
      </Stack>
    </Paper>
  );
}

function BoardNameEditor({
  name,
  disabled,
  onRename,
}: {
  name: string;
  disabled: boolean;
  onRename: (name: string) => void;
}) {
  const [draft, setDraft] = useState(name);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(name);
    }
  }, [focused, name]);

  useEffect(() => {
    const nextName = draft.trim();
    if (disabled || !nextName || nextName === name) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      onRename(nextName);
    }, 450);

    return () => window.clearTimeout(timer);
  }, [disabled, draft, name, onRename]);

  return (
    <TextField
      value={draft}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(event) => setDraft(event.target.value.slice(0, 64))}
      inputProps={{ maxLength: 64 }}
      variant="standard"
      fullWidth
      sx={{
        "& .MuiInputBase-input": {
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: 0,
        },
      }}
    />
  );
}

function ColumnTitleEditor({
  column,
  disabled,
  onRename,
}: {
  column: PadletColumn;
  disabled: boolean;
  onRename: (title: string) => void;
}) {
  const [draft, setDraft] = useState(column.title);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(column.title);
    }
  }, [column.title, focused]);

  useEffect(() => {
    const title = draft.trim();
    if (disabled || !title || title === column.title) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      onRename(title);
    }, 450);

    return () => window.clearTimeout(timer);
  }, [column.title, disabled, draft, onRename]);

  return (
    <TextField
      value={draft}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(event) =>
        setDraft(event.target.value.slice(0, DEFAULT_MAX_LENGTH))
      }
      inputProps={{ maxLength: DEFAULT_MAX_LENGTH }}
      variant="standard"
      fullWidth
      sx={{
        "& .MuiInputBase-input": {
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: 0,
        },
      }}
    />
  );
}

function AddPostComposer({
  disabled,
  maxLength,
  softLength,
  placeholder = "Add post",
  onAdd,
}: {
  disabled: boolean;
  maxLength: number;
  softLength: number;
  placeholder?: string;
  onAdd: (text: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const overSoftLimit = value.length / softLength > 1;

  async function submit() {
    const text = value.trim();
    if (!text) return;

    let posted = false;
    setBusy(true);
    try {
      await onAdd(text);
      setValue("");
      posted = true;
    } finally {
      setBusy(false);
      if (posted) {
        window.setTimeout(() => inputRef.current?.focus(), 0);
      }
    }
  }

  return (
    <Box>
      <TextField
        fullWidth
        size="small"
        inputRef={inputRef}
        disabled={disabled || busy}
        value={value}
        placeholder={placeholder}
        inputProps={{ maxLength }}
        onChange={(event) => setValue(event.target.value.slice(0, maxLength))}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        }}
        InputProps={{
          endAdornment: (
            <Button
              size="small"
              variant="contained"
              disabled={disabled || busy || !value.trim()}
              onClick={submit}
              sx={{ minWidth: 64, ml: 0.75 }}
            >
              Post
            </Button>
          ),
        }}
      />
      <Typography
        variant="caption"
        component="div"
        sx={{
          color: overSoftLimit ? "error.main" : "text.secondary",
          textAlign: "right",
          mt: 0.25,
          fontWeight: overSoftLimit ? 700 : 500,
        }}
      >
        {value.length}/{softLength}
      </Typography>
    </Box>
  );
}

function PostItem({
  post,
  actorCode,
  canInteract,
  canModerate,
  avatarByCode,
  showByCode,
  restrictOwnPlusOne = false,
  maxLength,
  softLength,
  allowCopy = true,
  copyDirection,
  targetColumnTitle,
  onPlusOne,
  onCopy,
  onDelete,
  onFlag,
  onUpdate,
}: {
  post: PadletPost;
  actorCode: string;
  canInteract: boolean;
  canModerate: boolean;
  avatarByCode: Map<string, string | undefined>;
  showByCode: Map<string, boolean>;
  restrictOwnPlusOne?: boolean;
  maxLength: number;
  softLength: number;
  allowCopy?: boolean;
  copyDirection?: "left" | "right";
  targetColumnTitle?: string;
  onPlusOne: () => Promise<void>;
  onCopy?: () => Promise<void>;
  onDelete: () => Promise<void>;
  onFlag?: () => Promise<void>;
  onUpdate: (text: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.text);
  const [busy, setBusy] = useState(false);
  const alreadyPlusOne = post.plusOnes.includes(actorCode);
  const restrictedPlusOneCodes = post.restrictedPlusOneCodes || [
    post.authorCode,
  ];
  const restrictedStudentPlusOne =
    restrictOwnPlusOne && !canModerate && restrictedPlusOneCodes.includes(actorCode);
  const plusOneTooltip = restrictedStudentPlusOne
    ? "You cannot +1 your own post or copied post"
    : alreadyPlusOne
    ? "Already added"
    : "+1";
  const overSoftLimit = draft.length / softLength > 1;
  const authorVisible =
    canModerate ||
    post.authorCode === "HOST" ||
    Boolean(post.authorShowMe) ||
    showByCode.get(post.authorCode);
  const authorAlias = authorVisible ? post.authorCode : "Anon";
  const authorAvatarUrl = authorVisible
    ? post.authorAvatarUrl || avatarByCode.get(post.authorCode)
    : undefined;
  const visiblePlusOnes = post.plusOnes.filter(
    (code) => canModerate || showByCode.get(code)
  );
  const anonymousPlusOneCount = post.plusOnes.length - visiblePlusOnes.length;

  useEffect(() => {
    if (!editing) {
      setDraft(post.text);
    }
  }, [editing, post.text]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    const text = draft.trim();
    if (!text) return;
    await run(async () => {
      await onUpdate(text);
      setEditing(false);
    });
  }

  return (
    <Box
      sx={{
        border: "1px solid #d9e2ef",
        borderRadius: 2,
        bgcolor: "background.paper",
        p: 1.5,
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "64px minmax(0, 1fr)", sm: "76px minmax(0, 1fr)" },
          gap: 1.25,
          alignItems: "start",
        }}
      >
        <AvatarAliasBlock alias={authorAlias} avatarUrl={authorAvatarUrl} />

        <Stack spacing={1} sx={{ minWidth: 0 }}>
          <Stack direction="row" justifyContent="flex-end" spacing={0.25}>
            <Tooltip title={plusOneTooltip}>
              <span>
                <IconButton
                  size="small"
                  disabled={
                    !canInteract ||
                    busy ||
                    alreadyPlusOne ||
                    restrictedStudentPlusOne
                  }
                  onClick={() => run(onPlusOne)}
                >
                  <ThumbUpAltOutlinedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            {allowCopy && onCopy && (
              <Tooltip title={`Copy to ${targetColumnTitle}`}>
                <span>
                  <IconButton
                    size="small"
                    disabled={!canInteract || busy}
                    onClick={() => run(onCopy)}
                  >
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <ContentCopyIcon sx={{ fontSize: 17 }} />
                      {copyDirection === "right" ? (
                        <ArrowForwardIcon sx={{ fontSize: 17 }} />
                      ) : (
                        <ArrowBackIcon sx={{ fontSize: 17 }} />
                      )}
                    </Box>
                  </IconButton>
                </span>
              </Tooltip>
            )}
            {canModerate && (
              <>
                <Tooltip title="Edit">
                  <span>
                    <IconButton
                      size="small"
                      disabled={!canInteract || busy}
                      onClick={() => setEditing(true)}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Delete">
                  <span>
                    <IconButton
                      size="small"
                      color="error"
                      disabled={!canInteract || busy}
                      onClick={() => run(onDelete)}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                {onFlag && (
                  <Tooltip title="Flag and remove">
                    <span>
                      <IconButton
                        size="small"
                        color="warning"
                        disabled={busy}
                        onClick={() => run(onFlag)}
                      >
                        <FlagOutlinedIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                )}
              </>
            )}
          </Stack>

          {editing ? (
            <Box>
              <TextField
                fullWidth
                size="small"
                value={draft}
                inputProps={{ maxLength }}
                onChange={(event) =>
                  setDraft(event.target.value.slice(0, maxLength))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    saveEdit();
                  }
                }}
              />
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mt: 0.5 }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    color: overSoftLimit ? "error.main" : "text.secondary",
                    fontWeight: overSoftLimit ? 700 : 500,
                  }}
                >
                  {draft.length}/{softLength}
                </Typography>
                <Stack direction="row" spacing={0.5}>
                  <Tooltip title="Save">
                    <span>
                      <IconButton
                        size="small"
                        disabled={busy || !draft.trim()}
                        onClick={saveEdit}
                      >
                        <CheckIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Cancel">
                    <IconButton
                      size="small"
                      disabled={busy}
                      onClick={() => {
                        setDraft(post.text);
                        setEditing(false);
                      }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            </Box>
          ) : (
            <Typography sx={{ wordBreak: "break-word", fontSize: 18 }}>
              {post.text}
            </Typography>
          )}

          {post.plusOnes.length > 0 && (
            <Stack
              direction="row"
              spacing={1}
              flexWrap="wrap"
              useFlexGap
              alignItems="center"
            >
              <Chip
                label={`+1 x${post.plusOnes.length}`}
                size="small"
                sx={{ fontWeight: 900 }}
              />
              {visiblePlusOnes.map((code) => (
                <AvatarAliasBlock
                  key={code}
                  alias={code}
                  avatarUrl={avatarByCode.get(code)}
                  labelPrefix="+1 "
                  size="like"
                />
              ))}
              {anonymousPlusOneCount > 0 && visiblePlusOnes.length > 0 && (
                <Chip
                  label={`${anonymousPlusOneCount} anon`}
                  size="small"
                  variant="outlined"
                />
              )}
            </Stack>
          )}
        </Stack>
      </Box>
    </Box>
  );
}

export default function PadletSessionApp() {
  return (
    <ThemeProvider theme={padletTheme}>
      <CssBaseline />
      <Routes>
        <Route
          index
          element={
            <ProtectedPadletPage>
              <PadletHomePage />
            </ProtectedPadletPage>
          }
        />
        <Route
          path="sessions"
          element={
            <ProtectedPadletPage>
              <SessionsPage />
            </ProtectedPadletPage>
          }
        />
        <Route
          path="host/:sessionId"
          element={
            <ProtectedHostPage>
              <HostSessionPage />
            </ProtectedHostPage>
          }
        />
        <Route path="join" element={<JoinPage />} />
        <Route path="session/:sessionId" element={<ClientSessionPage />} />
        <Route path="check-id" element={<CheckIdPage />} />
        <Route
          path="teacher-dashboard"
          element={
            <ProtectedPadletPage>
              <TeacherDashboardPage />
            </ProtectedPadletPage>
          }
        />
        <Route path="*" element={<Navigate to="/padlet" replace />} />
      </Routes>
    </ThemeProvider>
  );
}
