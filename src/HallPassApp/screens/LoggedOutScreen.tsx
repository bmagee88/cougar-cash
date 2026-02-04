import React, { useMemo } from "react";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";
import { useAuth } from "../auth/AuthContext";

function roleChipColor(role: string) {
  if (role === "student") return "success";
  if (role === "teacher") return "primary";
  if (role === "admin") return "warning";
  return "default";
}

function fmtTime(ts?: number) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return "";
  }
}

function logLabel(kind?: string) {
  switch (kind) {
    case "request_created":
      return "Request created";
    case "request_blocked":
      return "Request blocked";
    case "request_called":
      return "Student called";
    case "student_returned":
      return "Student returned";
    case "late_return_flagged":
      return "Late return (Code 26)";
    case "period_cleared":
      return "Period cleared";
    case "teacher_falsified_return":
      return "Teacher falsified return";
    case "freeze_on":
      return "Freeze ON";
    case "freeze_off":
      return "Freeze OFF";
    default:
      return kind || "Log";
  }
}

function logAccent(kind?: string) {
  if (kind === "late_return_flagged") return "rgba(183,28,28,0.10)";
  if (kind === "request_blocked") return "rgba(255,143,0,0.10)";
  if (kind === "request_called") return "rgba(13,71,161,0.10)";
  if (kind === "student_returned") return "rgba(27,94,32,0.10)";
  if (kind === "freeze_on" || kind === "freeze_off") return "rgba(26,35,126,0.10)";
  return "rgba(0,0,0,0.05)";
}

export function LoggedOutScreen({ snapshot }: { snapshot?: any }) {
  const { demoUsers, loginAsDemoUid } = useAuth();

  const grouped = useMemo(() => {
    const students = demoUsers.filter((u) => u.role === "student");
    const teachers = demoUsers.filter((u) => u.role === "teacher");
    const admins = demoUsers.filter((u) => u.role === "admin");
    return { students, teachers, admins };
  }, [demoUsers]);

  const queues = useMemo(() => {
    const byGroup = snapshot?.bathroomQueueByGroup ?? {};
    const activeOut = snapshot?.activeOutByGroup ?? {};
    const code26 = snapshot?.code26Queue ?? [];
    const logs = snapshot?.logs ?? [];
    return { byGroup, activeOut, code26, logs };
  }, [snapshot]);

  const hasQueues =
    snapshot &&
    (Object.keys(queues.byGroup || {}).length > 0 || (queues.code26?.length ?? 0) > 0);

  const hasLogs = snapshot && (queues.logs?.length ?? 0) > 0;

  // Layout:
  // - Desktop: [Logs] [Login Grid] [Queues]
  // - Mobile: stacks naturally
  return (
    <Box
      display='grid'
      gridTemplateColumns={{
        xs: "1fr",
        md: "0.55fr 1.35fr 0.65fr",
      }}
      gap={2}
    >
      {/* LEFT: Logs */}
      <Card sx={{ borderRadius: 4, height: { md: "fit-content" } }}>
        <CardContent>
          <Stack spacing={1.5}>
            <Stack spacing={0.25}>
              <Typography variant='h6' sx={{ fontWeight: 900 }}>
                Logs
              </Typography>
              <Typography variant='caption' sx={{ opacity: 0.8 }}>
                Latest first • {snapshot?.currentHHMM} • Period {snapshot?.currentPeriod}
              </Typography>
            </Stack>

            {!hasLogs ? (
              <Typography variant='body2' sx={{ opacity: 0.7 }}>
                No activity yet. Create a request to see logs here.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {queues.logs.slice(0, 18).map((l: any) => (
                  <Box
                    key={l.id}
                    sx={{
                      borderRadius: 3,
                      p: 1.25,
                      bgcolor: logAccent(l.kind),
                      border: "1px solid rgba(0,0,0,0.08)",
                    }}
                  >
                    <Stack direction='row' justifyContent='space-between' spacing={1}>
                      <Typography sx={{ fontWeight: 900, fontSize: 13 }}>
                        {logLabel(l.kind)}
                      </Typography>
                      <Typography variant='caption' sx={{ opacity: 0.75, whiteSpace: "nowrap" }}>
                        {fmtTime(l.ts)}
                      </Typography>
                    </Stack>

                    {/* Minimal details preview */}
                    <Typography variant='caption' sx={{ opacity: 0.8 }}>
                      {l.kind === "request_created" && l.details
                        ? `${l.details.displayName} • ${l.details.classId} • ${l.details.gender}`
                        : l.kind === "request_called" && l.details?.out
                        ? `${l.details.out.displayName} called • due ${fmtTime(l.details.out.dueBy)}`
                        : l.kind === "student_returned" && l.details?.returned
                        ? `${l.details.returned.displayName} returned`
                        : l.kind === "late_return_flagged" && l.details?.late
                        ? `${l.details.late.displayName} flagged Code 26`
                        : l.kind === "period_cleared" && l.details
                        ? `Cleared ${l.details.from} → ${l.details.to}`
                        : l.kind === "freeze_on" || l.kind === "freeze_off"
                        ? `Class ${l.details?.classId}`
                        : ""}
                    </Typography>
                  </Box>
                ))}
                {(queues.logs.length ?? 0) > 18 ? (
                  <Typography variant='caption' sx={{ opacity: 0.7 }}>
                    +{queues.logs.length - 18} more…
                  </Typography>
                ) : null}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* MIDDLE: Login / Pick account */}
      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Stack spacing={2.5} alignItems='center' textAlign='center'>
            <Box
  aria-label="leopard mascot"
  sx={{
    width: 160,
    height: 160,
    display: "grid",
    placeItems: "center",
    borderRadius: 6,
    bgcolor: "rgba(0,0,0,0.04)",
  }}
>
  <Typography sx={{ fontSize: 110, lineHeight: 1 }}>
    🐆
  </Typography>
</Box>

            <Stack spacing={0.5} alignItems='center'>
              <Typography variant='h5' sx={{ fontWeight: 900 }}>
                Sign in with Google
              </Typography>
              <Typography variant='body2' sx={{ maxWidth: 640, opacity: 0.8 }}>
                Demo mode: pick a Google account below (students / teachers / admin).
                Later we’ll swap this with real Google OAuth.
              </Typography>
            </Stack>

            <Divider flexItem sx={{ my: 1 }} />

            <Box width='100%'>
              <Typography
                variant='subtitle1'
                sx={{ fontWeight: 900, mb: 1, textAlign: "left" }}
              >
                Pick an account
              </Typography>

              <Grid container spacing={1.5}>
                {[...grouped.teachers, ...grouped.students, ...grouped.admins].map((u) => (
                  <Grid item xs={12} sm={6} md={4} key={u.uid}>
                    <Card
                      variant='outlined'
                      sx={{
                        borderRadius: 4,
                        cursor: "pointer",
                        transition: "transform 120ms ease, box-shadow 120ms ease",
                        "&:hover": { transform: "translateY(-2px)", boxShadow: 2 },
                      }}
                      onClick={() => loginAsDemoUid(u.uid)}
                    >
                      <CardContent>
                        <Stack direction='row' spacing={1.5} alignItems='center'>
                          <Avatar src={u.photoURL} alt={u.displayName} sx={{ width: 44, height: 44 }} />
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography
                              sx={{
                                fontWeight: 900,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {u.displayName}
                            </Typography>

                            <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap'>
                              <Chip
                                size='small'
                                label={u.role.toUpperCase()}
                                color={roleChipColor(u.role)}
                              />
                              {u.role === "student" ? (
                                <>
                                  <Chip size='small' variant='outlined' label={`Lunch ${u.lunchNumber}`} />
                                  <Chip size='small' variant='outlined' label={`${u.classId}`} />
                                  <Chip size='small' variant='outlined' label={`${u.groupId}`} />
                                </>
                              ) : null}
                            </Stack>
                          </Box>
                        </Stack>

                        <Button
                          fullWidth
                          sx={{ mt: 2, fontWeight: 900 }}
                          variant='contained'
                          startIcon={<GoogleIcon />}
                          onClick={(e) => {
                            e.stopPropagation();
                            loginAsDemoUid(u.uid);
                          }}
                        >
                          Continue with Google
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>

            <Divider flexItem sx={{ my: 1 }} />

            <Typography variant='caption' sx={{ opacity: 0.75 }}>
              Note: In production, this screen will only show a single “Continue with Google” button.
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* RIGHT: Queues snapshot */}
      <Card sx={{ borderRadius: 4, height: { md: "fit-content" } }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack spacing={0.25}>
              <Typography variant='h6' sx={{ fontWeight: 900 }}>
                Live Queues
              </Typography>
              <Typography variant='caption' sx={{ opacity: 0.8 }}>
                Snapshot (demo backend) • {snapshot?.currentHHMM} • Period {snapshot?.currentPeriod}
              </Typography>
            </Stack>

            {!hasQueues ? (
              <Typography variant='body2' sx={{ opacity: 0.7 }}>
                No queued requests yet.
              </Typography>
            ) : (
              <>
                {Object.keys(queues.byGroup || {}).map((groupId) => {
                  const q = queues.byGroup[groupId] || [];
                  const outM = queues.activeOut?.[groupId]?.["M"] ?? null;
                  const outF = queues.activeOut?.[groupId]?.["F"] ?? null;

                  return (
                    <Box key={groupId}>
                      <Typography sx={{ fontWeight: 900, mb: 0.5 }}>{groupId}</Typography>

                      <Stack direction='row' spacing={1} sx={{ mb: 1 }} flexWrap='wrap'>
                        <Chip
                          size='small'
                          label={outM ? `Boy out: ${outM.displayName}` : "Boy out: none"}
                          variant='outlined'
                        />
                        <Chip
                          size='small'
                          label={outF ? `Girl out: ${outF.displayName}` : "Girl out: none"}
                          variant='outlined'
                        />
                      </Stack>

                      {q.length === 0 ? (
                        <Typography variant='body2' sx={{ opacity: 0.7 }}>
                          Queue empty
                        </Typography>
                      ) : (
                        <Stack spacing={1}>
                          {q.slice(0, 6).map((r: any, idx: number) => (
                            <Box
                              key={r.requestId}
                              sx={{
                                border: "1px solid rgba(0,0,0,0.08)",
                                borderRadius: 3,
                                p: 1.25,
                              }}
                            >
                              <Stack direction='row' alignItems='center' justifyContent='space-between' spacing={1}>
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography
                                    sx={{
                                      fontWeight: idx === 0 ? 900 : 700,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {r.displayName}
                                  </Typography>
                                  <Typography variant='caption' sx={{ opacity: 0.75 }}>
                                    {r.classId} • Lunch {r.lunchNumber} • {r.gender}
                                  </Typography>
                                </Box>
                                <Typography variant='caption' sx={{ opacity: 0.75, whiteSpace: "nowrap" }}>
                                  {fmtTime(r.createdAt)}
                                </Typography>
                              </Stack>
                            </Box>
                          ))}
                          {q.length > 6 ? (
                            <Typography variant='caption' sx={{ opacity: 0.75 }}>
                              +{q.length - 6} more…
                            </Typography>
                          ) : null}
                        </Stack>
                      )}
                    </Box>
                  );
                })}

                <Divider />

                <Box>
                  <Typography sx={{ fontWeight: 900, mb: 0.5 }}>
                    Code 26 (late returns)
                  </Typography>
                  {queues.code26?.length ? (
                    <Stack spacing={1}>
                      {queues.code26.slice(0, 6).map((x: any, idx: number) => (
                        <Box
                          key={`${x.uid}-${x.calledAt}-${idx}`}
                          sx={{
                            border: "1px solid rgba(0,0,0,0.08)",
                            borderRadius: 3,
                            p: 1.25,
                          }}
                        >
                          <Typography sx={{ fontWeight: idx === 0 ? 900 : 700 }}>
                            {x.displayName}
                          </Typography>
                          <Typography variant='caption' sx={{ opacity: 0.75 }}>
                            {x.classId} • {x.groupId} • due {fmtTime(x.dueBy)}
                          </Typography>
                        </Box>
                      ))}
                      {queues.code26.length > 6 ? (
                        <Typography variant='caption' sx={{ opacity: 0.75 }}>
                          +{queues.code26.length - 6} more…
                        </Typography>
                      ) : null}
                    </Stack>
                  ) : (
                    <Typography variant='body2' sx={{ opacity: 0.7 }}>
                      None flagged right now.
                    </Typography>
                  )}
                </Box>
              </>
            )}

            <Divider />

            {snapshot?.blockedNow ? (
              <Box sx={{ borderRadius: 3, p: 1.25, bgcolor: "rgba(183,28,28,0.08)" }}>
                <Typography sx={{ fontWeight: 900 }}>Requests are currently BLOCKED</Typography>
                <Typography variant='caption' sx={{ opacity: 0.8 }}>
                  In a blocked time range. Students cannot request right now.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ borderRadius: 3, p: 1.25, bgcolor: "rgba(27,94,32,0.08)" }}>
                <Typography sx={{ fontWeight: 900 }}>Requests are OPEN</Typography>
                <Typography variant='caption' sx={{ opacity: 0.8 }}>
                  Students can enter the queue right now.
                </Typography>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
