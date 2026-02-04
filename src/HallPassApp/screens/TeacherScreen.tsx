import React, { useMemo } from "react";
import {
  Box,
  Card,
  CardContent,
  Fab,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import CampaignIcon from "@mui/icons-material/Campaign";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { useAuth } from "../auth/AuthContext";
import { backend } from "../mock/mockBackend";

export function TeacherScreen({ snapshot }: { snapshot: any }) {
  const { user } = useAuth();

  // TODO: later derive from teacher uid -> class mapping
  const classId = "class-101";

  const freeze = snapshot.freezeByClass?.[classId] ?? false;

  const myClassOut = useMemo(() => {
    // find active outs in ANY group, but only for this class
    let boyOut: any = null;
    let girlOut: any = null;

    for (const groupId of Object.keys(snapshot.activeOutByGroup || {})) {
      const g = snapshot.activeOutByGroup[groupId];
      const m = g?.["M"];
      const f = g?.["F"];

      if (m?.classId === classId && (m.status === "out" || m.status === "late")) boyOut = m;
      if (f?.classId === classId && (f.status === "out" || f.status === "late")) girlOut = f;
    }

    return { boyOut, girlOut };
  }, [snapshot, classId]);

  const boyText = myClassOut.boyOut ? myClassOut.boyOut.displayName : "Occupied";
  const girlText = myClassOut.girlOut ? myClassOut.girlOut.displayName : "Occupied";

  const boyBg = myClassOut.boyOut ? "#1b5e20" : "#b71c1c";
  const girlBg = myClassOut.girlOut ? "#1b5e20" : "#b71c1c";

  const clockIns = snapshot.clockInsByClass?.[classId] ?? [];

  const toggleFreeze = () => backend.setFreeze(classId, !freeze);

  const callNextBoy = () => backend.callNextForGroup("group-ab", "M");
  const callNextGirl = () => backend.callNextForGroup("group-ab", "F");

  const falsify = (uid: string) => backend.teacherFalsifyReturn(classId, uid);

  return (
    <Box sx={{ pb: 14 }}>
      <Box
        display='grid'
        gridTemplateColumns={{ xs: "1fr", md: "340px 1fr" }}
        gap={2}
      >
        {/* Left: clock-ins list */}
        <Card sx={{ borderRadius: 4 }}>
          <CardContent>
            <Typography
              variant='h6'
              sx={{ fontWeight: 800, mb: 1 }}
            >
              Clock-ins (this class)
            </Typography>
            <List
              dense
              disablePadding
            >
              {clockIns.length === 0 ? (
                <Typography
                  variant='body2'
                  sx={{ opacity: 0.7 }}
                >
                  No returns yet.
                </Typography>
              ) : (
                clockIns.map((c: any, idx: number) => (
                  <ListItemButton
                    key={`${c.uid}-${c.returnedAt}-${idx}`}
                    onClick={() => falsify(c.uid)}
                  >
                    <ListItemText
                      primaryTypographyProps={{
                        sx: {
                          fontWeight: idx === 0 ? 900 : 600,
                          fontSize: idx === 0 ? 18 : 14,
                        },
                      }}
                      primary={c.displayName}
                      secondary={`Lunch: ${c.lunchNumber} • ${new Date(
                        c.returnedAt || Date.now()
                      ).toLocaleTimeString()}`}
                    />
                  </ListItemButton>
                ))
              )}
            </List>
            <Typography
              variant='caption'
              sx={{ opacity: 0.7 }}
            >
              Click a name to falsify/confirm a clock-in.
            </Typography>
          </CardContent>
        </Card>

        {/* Center: occupancy + call controls */}
        <Card sx={{ borderRadius: 4, position: "relative", overflow: "hidden" }}>
          <CardContent>
            <Stack spacing={2}>
              <Typography
                variant='h5'
                sx={{ fontWeight: 900 }}
              >
                Teacher Panel
              </Typography>

              {/* Two occupancy panels */}
              <Box
                display='grid'
                gridTemplateColumns={{ xs: "1fr", sm: "1fr 1fr" }}
                gap={2}
              >
                {/* Boy slot */}
                <Box
                  sx={{
                    borderRadius: 4,
                    p: 3,
                    textAlign: "center",
                    bgcolor: boyBg,
                    color: "white",
                    fontWeight: 900,
                    fontSize: 26,
                    border: "4px solid #1976d2", // blue border
                  }}
                >
                  <Typography sx={{ fontWeight: 900, opacity: 0.9, mb: 0.5 }}>
                    BOY
                  </Typography>
                  {boyText}
                  {myClassOut.boyOut?.status === "late" ? (
                    <Typography sx={{ mt: 1, fontSize: 13, opacity: 0.9 }}>
                      LATE RETURN (Code 26)
                    </Typography>
                  ) : null}
                </Box>

                {/* Girl slot */}
                <Box
                  sx={{
                    borderRadius: 4,
                    p: 3,
                    textAlign: "center",
                    bgcolor: girlBg,
                    color: "white",
                    fontWeight: 900,
                    fontSize: 26,
                    border: "4px solid #ec407a", // pink border
                  }}
                >
                  <Typography sx={{ fontWeight: 900, opacity: 0.9, mb: 0.5 }}>
                    GIRL
                  </Typography>
                  {girlText}
                  {myClassOut.girlOut?.status === "late" ? (
                    <Typography sx={{ mt: 1, fontSize: 13, opacity: 0.9 }}>
                      LATE RETURN (Code 26)
                    </Typography>
                  ) : null}
                </Box>
              </Box>

              {/* Call controls */}
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
              >
                <IconButton
                  onClick={callNextBoy}
                  sx={{
                    border: "1px solid rgba(0,0,0,0.1)",
                    borderRadius: 2,
                  }}
                >
                  <PlayArrowIcon />
                </IconButton>
                <Typography sx={{ alignSelf: "center" }}>
                  Call next BOY (group-ab)
                </Typography>

                <Box flex={1} />

                <IconButton
                  onClick={callNextGirl}
                  sx={{
                    border: "1px solid rgba(0,0,0,0.1)",
                    borderRadius: 2,
                  }}
                >
                  <PlayArrowIcon />
                </IconButton>
                <Typography sx={{ alignSelf: "center" }}>
                  Call next GIRL (group-ab)
                </Typography>
              </Stack>

              <Typography
                variant='body2'
                sx={{ opacity: 0.75 }}
              >
                Each group can have 1 boy and 1 girl out at a time. Freeze is
                per-class: if frozen, your students are skipped while the group
                continues. When unfrozen, skipped students get next priority.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Box>

      {/* Floating buttons (viewport-fixed) */}
      <Box
        sx={{
          position: "fixed",
          right: 16,
          bottom: 16,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
          zIndex: (theme) => theme.zIndex.modal + 1,
        }}
      >
        <Fab
          color='error'
          aria-label='alert'
        >
          <CampaignIcon />
        </Fab>

        <Fab
          variant='extended'
          onClick={toggleFreeze}
          sx={{
            bgcolor: freeze ? "#0d47a1" : "#e3f2fd",
            color: freeze ? "white" : "#0d47a1",
            fontWeight: 800,
          }}
        >
          <AcUnitIcon sx={{ mr: 1 }} />
          Bathroom Freeze: {freeze ? "ON" : "OFF"}
        </Fab>
      </Box>
    </Box>
  );
}
