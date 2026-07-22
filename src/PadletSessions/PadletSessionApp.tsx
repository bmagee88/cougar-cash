import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadIcon from "@mui/icons-material/Download";
import EditIcon from "@mui/icons-material/Edit";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ThumbUpAltOutlinedIcon from "@mui/icons-material/ThumbUpAltOutlined";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Link as RouterLink,
  Navigate,
  Route,
  Routes,
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
  getEventSourceUrl,
  plusOnePost,
  renameColumns,
  startSession,
  updatePost,
  verifyParticipant,
} from "./padletApi";
import {
  PadletColumn,
  PadletCredentials,
  PadletPost,
  PadletSessionSnapshot,
} from "./types";

const SESSION_ID_PATTERN = /^[0-9A-F]{3}$/;
const PARTICIPANT_CODE_PATTERN = /^[0-9A-F]{4}$/;
const DEFAULT_MAX_LENGTH = 32;
const DEFAULT_SOFT_LENGTH = 16;

function hostStorageKey(sessionId: string) {
  return `padletHost:${sessionId}`;
}

function participantStorageKey(sessionId: string) {
  return `padletParticipant:${sessionId}`;
}

function normalizeHex(value: string, maxLength: number) {
  return value
    .toUpperCase()
    .replace(/[^0-9A-F]/g, "")
    .slice(0, maxLength);
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

function statusColor(status: PadletSessionSnapshot["status"]) {
  if (status === "active") return "success";
  if (status === "setup") return "warning";
  if (status === "closed") return "default";
  return "error";
}

function useSessionStream(
  sessionId: string | undefined,
  credentials: PadletCredentials | null
) {
  const [session, setSession] = useState<PadletSessionSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [streamError, setStreamError] = useState("");
  const hostToken = credentials?.hostToken;
  const code = credentials?.code;

  useEffect(() => {
    if (!sessionId || (!hostToken && !code)) {
      return undefined;
    }

    const source = new EventSource(getEventSourceUrl(sessionId, { hostToken, code }));

    source.addEventListener("session", (event) => {
      const message = event as MessageEvent<string>;
      setSession(JSON.parse(message.data));
      setConnected(true);
      setStreamError("");
    });

    source.onerror = () => {
      setConnected(false);
      setStreamError("Live updates are reconnecting.");
    };

    return () => {
      source.close();
    };
  }, [code, hostToken, sessionId]);

  return { connected, session, setSession, streamError };
}

function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f6f8fb",
        color: "#172033",
        py: { xs: 2, md: 3 },
      }}
    >
      <Container maxWidth="xl">{children}</Container>
    </Box>
  );
}

function StatusChip({ session }: { session: PadletSessionSnapshot }) {
  return (
    <Chip
      size="small"
      color={statusColor(session.status)}
      label={session.status.toUpperCase()}
      sx={{ fontWeight: 700, letterSpacing: 0 }}
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

function HostCreatePage() {
  const navigate = useNavigate();
  const [columnA, setColumnA] = useState("Good At");
  const [columnB, setColumnB] = useState("Not Good At");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    setBusy(true);
    setError("");

    try {
      const response = await createSession([columnA, columnB]);
      localStorage.setItem(hostStorageKey(response.sessionId), response.hostToken);
      navigate(`/padlet/host/${response.sessionId}`);
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
            Live Board
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
                select
                fullWidth
                label="Session type"
                value="good-not-good"
              >
                <MenuItem value="good-not-good">Two-column reflection</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="First column"
                value={columnA}
                inputProps={{ maxLength: DEFAULT_MAX_LENGTH }}
                onChange={(event) => setColumnA(event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Second column"
                value={columnB}
                inputProps={{ maxLength: DEFAULT_MAX_LENGTH }}
                onChange={(event) => setColumnB(event.target.value)}
              />
            </Grid>
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
              disabled={busy || !columnA.trim() || !columnB.trim()}
              onClick={handleCreate}
            >
              Create session
            </Button>
            <Button component={RouterLink} to="/padlet/join">
              Student join
            </Button>
          </Stack>
        </Paper>
      </Stack>
    </PageFrame>
  );
}

function HostSessionPage() {
  const params = useParams();
  const sessionId = normalizeHex(params.sessionId || "", 3);
  const [hostToken] = useState(() =>
    sessionId ? localStorage.getItem(hostStorageKey(sessionId)) || "" : ""
  );
  const credentials = useMemo(
    () => (hostToken ? { hostToken } : null),
    [hostToken]
  );
  const { connected, session, setSession, streamError } = useSessionStream(
    sessionId,
    credentials
  );
  const [actionError, setActionError] = useState("");
  const [copied, setCopied] = useState(false);

  const joinUrl = useMemo(() => {
    if (!sessionId) return "";
    return `${window.location.origin}/padlet/join?session=${sessionId}`;
  }, [sessionId]);

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
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          Host access for this session is not available in this browser.
        </Alert>
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
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: 0 }}>
                  Host Board
                </Typography>
                <Chip
                  label={session.id}
                  size="small"
                  sx={{ fontFamily: "monospace", fontWeight: 800 }}
                />
                <StatusChip session={session} />
                <Chip
                  size="small"
                  variant="outlined"
                  label={connected ? "Live" : "Reconnecting"}
                />
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

        <SessionStatusAlert session={session} role="host" />

        <BoardCanvas
          session={session}
          credentials={{ hostToken }}
          actorCode="HOST"
          canModerate
          onError={setActionError}
          onSessionChange={setSession}
        />
      </Stack>
    </PageFrame>
  );
}

function JoinPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [sessionId, setSessionId] = useState(() =>
    normalizeHex(searchParams.get("session") || "", 3)
  );
  const [issuedCode, setIssuedCode] = useState("");
  const [enteredCode, setEnteredCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleGetCode() {
    setBusy(true);
    setError("");
    setIssuedCode("");
    setEnteredCode("");

    try {
      const response = await createParticipant(sessionId);
      setIssuedCode(response.code);
    } catch (caught) {
      setError(messageFromError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    setBusy(true);
    setError("");

    try {
      const response = await verifyParticipant(sessionId, enteredCode);
      localStorage.setItem(participantStorageKey(sessionId), response.code);
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
            Enter the three-character session id from your host.
          </Typography>
        </Box>

        <Paper
          elevation={0}
          sx={{ border: "1px solid #d9e2ef", borderRadius: 2, p: 3 }}
        >
          <Stack spacing={2}>
            <TextField
              label="Session id"
              value={sessionId}
              inputProps={{ maxLength: 3, style: { textTransform: "uppercase" } }}
              onChange={(event) => setSessionId(normalizeHex(event.target.value, 3))}
              sx={{ maxWidth: 240 }}
            />
            <Button
              variant="contained"
              disabled={busy || !SESSION_ID_PATTERN.test(sessionId)}
              onClick={handleGetCode}
              sx={{ alignSelf: "flex-start" }}
            >
              Get code
            </Button>

            {issuedCode && (
              <Box
                sx={{
                  border: "1px solid #d9e2ef",
                  borderRadius: 2,
                  p: 2,
                  bgcolor: "#fbfcfe",
                }}
              >
                <Stack spacing={1.5}>
                  <Typography sx={{ fontWeight: 700 }}>Your code</Typography>
                  <Chip
                    label={issuedCode}
                    sx={{
                      alignSelf: "flex-start",
                      fontFamily: "monospace",
                      fontWeight: 900,
                      fontSize: 18,
                      height: 36,
                    }}
                  />
                  <TextField
                    label="Enter code"
                    value={enteredCode}
                    inputProps={{
                      maxLength: 4,
                      style: { textTransform: "uppercase" },
                    }}
                    onChange={(event) =>
                      setEnteredCode(normalizeHex(event.target.value, 4))
                    }
                    sx={{ maxWidth: 240 }}
                  />
                  <Button
                    variant="contained"
                    disabled={busy || !PARTICIPANT_CODE_PATTERN.test(enteredCode)}
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
  const params = useParams();
  const [searchParams] = useSearchParams();
  const sessionId = normalizeHex(params.sessionId || "", 3);
  const [code] = useState(() => {
    const queryCode = normalizeHex(searchParams.get("code") || "", 4);
    if (queryCode) return queryCode;
    return sessionId
      ? localStorage.getItem(participantStorageKey(sessionId)) || ""
      : "";
  });
  const credentials = useMemo(() => (code ? { code } : null), [code]);
  const { connected, session, setSession, streamError } = useSessionStream(
    sessionId,
    credentials
  );
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (sessionId && PARTICIPANT_CODE_PATTERN.test(code)) {
      localStorage.setItem(participantStorageKey(sessionId), code);
    }
  }, [code, sessionId]);

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
                Session {session.id}
              </Typography>
              <StatusChip session={session} />
              <Chip
                label={code}
                size="small"
                sx={{ fontFamily: "monospace", fontWeight: 800 }}
              />
              <Chip
                size="small"
                variant="outlined"
                label={connected ? "Live" : "Reconnecting"}
              />
            </Stack>
            <Typography sx={{ color: "text.secondary" }}>
              {formatRemaining(session.remainingSeconds)} remaining
            </Typography>
          </Stack>
        </Paper>

        {streamError && <Alert severity="info">{streamError}</Alert>}
        {actionError && <Alert severity="error">{actionError}</Alert>}

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
  onAdd,
}: {
  disabled: boolean;
  maxLength: number;
  softLength: number;
  onAdd: (text: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const overSoftLimit = value.length / softLength > 1;

  async function submit() {
    const text = value.trim();
    if (!text) return;

    setBusy(true);
    try {
      await onAdd(text);
      setValue("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box>
      <TextField
        fullWidth
        size="small"
        disabled={disabled || busy}
        value={value}
        placeholder="Add post"
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
            <Tooltip title="Post">
              <span>
                <IconButton
                  edge="end"
                  size="small"
                  disabled={disabled || busy || !value.trim()}
                  onClick={submit}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
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
  maxLength,
  softLength,
  copyDirection,
  targetColumnTitle,
  onPlusOne,
  onCopy,
  onDelete,
  onUpdate,
}: {
  post: PadletPost;
  actorCode: string;
  canInteract: boolean;
  canModerate: boolean;
  maxLength: number;
  softLength: number;
  copyDirection: "left" | "right";
  targetColumnTitle: string;
  onPlusOne: () => Promise<void>;
  onCopy: () => Promise<void>;
  onDelete: () => Promise<void>;
  onUpdate: (text: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.text);
  const [busy, setBusy] = useState(false);
  const alreadyPlusOne = post.plusOnes.includes(actorCode);
  const overSoftLimit = draft.length / softLength > 1;

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
        bgcolor: "#fff",
        p: 1.5,
      }}
    >
      <Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between" spacing={1}>
          <Chip
            label={post.authorCode}
            size="small"
            variant="outlined"
            sx={{ fontFamily: "monospace", fontWeight: 800 }}
          />
          <Stack direction="row" spacing={0.25}>
            <Tooltip title={alreadyPlusOne ? "Already added" : "+1"}>
              <span>
                <IconButton
                  size="small"
                  disabled={!canInteract || busy || alreadyPlusOne}
                  onClick={() => run(onPlusOne)}
                >
                  <ThumbUpAltOutlinedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
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
              </>
            )}
          </Stack>
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
          <Typography sx={{ wordBreak: "break-word", fontSize: 16 }}>
            {post.text}
          </Typography>
        )}

        {post.plusOnes.length > 0 && (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {post.plusOnes.map((code) => (
              <Chip
                key={code}
                label={`+1 ${code}`}
                size="small"
                sx={{
                  height: 22,
                  fontFamily: "monospace",
                  fontWeight: 800,
                }}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

export default function PadletSessionApp() {
  return (
    <Routes>
      <Route index element={<HostCreatePage />} />
      <Route path="host/:sessionId" element={<HostSessionPage />} />
      <Route path="join" element={<JoinPage />} />
      <Route path="session/:sessionId" element={<ClientSessionPage />} />
      <Route path="*" element={<Navigate to="/padlet" replace />} />
    </Routes>
  );
}
