import React, { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";
import { useAuth } from "../auth/AuthContext";
import { backend, type RequestType } from "../mock/mockBackend";

export function StudentScreen({ snapshot }: { snapshot: any }) {
  const { user } = useAuth();
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const myActive = useMemo(() => {
    if (!user?.uid || !user?.groupId || !user?.gender) return null;
    const active = snapshot.activeOutByGroup?.[user.groupId]?.[user.gender];
    if (active?.uid === user.uid) return active;
    return null;
  }, [snapshot, user]);

  const msLeft = useMemo(() => {
    if (!myActive) return null;
    return Math.max(0, myActive.dueBy - Date.now());
  }, [myActive, snapshot.currentHHMM]); // re-eval on time ticks

  const timeLeftText = useMemo(() => {
    if (msLeft == null) return "";
    const totalSec = Math.ceil(msLeft / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }, [msLeft]);

  const request = (type: RequestType) => {
    if (!user) return;
    if (type !== "bathroom") return;

    const res = backend.createBathroomRequest(user);
    if (!res.ok) {
      setStatusMsg(res.reason === "blocked_time" ? "Requests are blocked right now." : "Request failed.");
      return;
    }
    setStatusMsg("Bathroom request sent. Wait to be called.");
  };

  const returnToClass = () => {
    if (!user) return;
    const res = backend.studentReturn(user.uid);
    if (res.ok) setStatusMsg("Clocked back in. Thank you!");
    else setStatusMsg("Could not clock in (not found).");
  };

  return (
    <Card sx={{ borderRadius: 4 }}>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Student Requests
          </Typography>

          {statusMsg && <Alert onClose={() => setStatusMsg(null)}>{statusMsg}</Alert>}

          {/* If called: show countdown button */}
          {myActive ? (
            <Box>
              <Typography sx={{ mb: 1 }}>
                You are {myActive.status === "late" ? "LATE — return now" : "out"}.
              </Typography>
              <Button
                fullWidth
                size="large"
                variant="contained"
                onClick={returnToClass}
                sx={{
                  py: 2,
                  fontWeight: 800,
                  fontSize: 18,
                }}
              >
                {myActive.status === "late"
                  ? "RETURN NOW (LATE)"
                  : `Return to Class • ${timeLeftText} left`}
              </Button>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                If you don’t return within 3 minutes, you’ll be flagged to Code 26.
              </Typography>
            </Box>
          ) : (
            <Stack spacing={1.5}>
              <Button variant="contained" size="large" onClick={() => request("bathroom")}>
                Request Bathroom
              </Button>
              <Button variant="outlined" size="large" disabled>
                Request Water Fountain (disabled for now)
              </Button>
              <Button variant="outlined" size="large" disabled>
                Request Nurse (disabled for now)
              </Button>
              <Button variant="outlined" size="large" disabled>
                Request Office (disabled for now)
              </Button>
              <Button variant="outlined" size="large" disabled>
                Request Counselor (disabled for now)
              </Button>
            </Stack>
          )}

          <Box>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              Class: {user?.classId} • Group: {user?.groupId} • Lunch: {user?.lunchNumber}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
