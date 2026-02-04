import React, { useEffect, useMemo, useState } from "react";
import {
  AppBar,
  Avatar,
  Box,
  Container,
  IconButton,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import { useAuth } from "./auth/AuthContext";
import { LoggedOutScreen } from "./screens/LoggedOutScreen";
import { StudentScreen } from "./screens/StudentScreen";
import { TeacherScreen } from "./screens/TeacherScreen";
import { backend } from "./mock/mockBackend";

export function Shell() {
  const { user, logout } = useAuth();
  const [snapshot, setSnapshot] = useState(() => backend.getSnapshot());

  // Polling mock backend state (replace later with events/websockets)
  useEffect(() => {
    const t = window.setInterval(() => {
      backend.tickHousekeeping();
      setSnapshot(backend.getSnapshot());
    }, 500);
    return () => window.clearInterval(t);
  }, []);

  const body = useMemo(() => {
    if (!user) return <LoggedOutScreen snapshot={snapshot} />;
    if (user.role === "student") return <StudentScreen snapshot={snapshot} />;
    if (user.role === "teacher") return <TeacherScreen snapshot={snapshot} />;
    return (
      <Box p={3}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Admin (later)
        </Typography>
        <Typography variant="body2">
          Reports section is planned but not built yet.
        </Typography>
      </Box>
    );
  }, [user, snapshot]);

  return (
    <Box minHeight="100vh" bgcolor="#f6f7fb">
      <AppBar position="sticky" elevation={0}>
        <Toolbar>
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{ flex: 1 }}
          >
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: 2,
                bgcolor: "rgba(255,255,255,0.2)",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
              }}
            >
              🐾
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Paw Pass
            </Typography>
          </Stack>

          {user ? (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Typography sx={{ display: { xs: "none", sm: "block" } }}>
                {user.displayName}
              </Typography>
              <Avatar src={user.photoURL} alt={user.displayName} />
              <IconButton color="inherit" onClick={logout} aria-label="logout">
                <LogoutIcon />
              </IconButton>
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Google Login Required
            </Typography>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth={false} sx={{ py: 3 }}>
        <Box mb={2}>
          <Typography variant="body2" sx={{ opacity: 0.8 }}>
            Time: {snapshot.currentHHMM} • Period: {snapshot.currentPeriod} •
            Requests {snapshot.blockedNow ? "Blocked" : "Open"}
          </Typography>
        </Box>

        {body}
      </Container>
    </Box>
  );
}
