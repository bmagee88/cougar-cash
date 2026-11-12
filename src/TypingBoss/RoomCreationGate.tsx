import React, { useState } from "react";
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { unlockTypingBossCreation } from "./api";

export default function RoomCreationGate({ children }: { children: (password: string) => React.ReactNode }) {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (unlocked) return <>{children(password)}</>;
  return <Box sx={{ maxWidth: 420, mx: "auto", p: 3, mt: 6 }}>
    <Paper component="form" onSubmit={async event => {
      event.preventDefault();
      setBusy(true); setError("");
      try { await unlockTypingBossCreation(password); setUnlocked(true); }
      catch (caught) { setError(caught instanceof Error ? caught.message : "Could not unlock room creation."); }
      finally { setBusy(false); }
    }} sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h5" fontWeight={900}>Room creation</Typography>
        <Typography>Enter the password to create a room.</Typography>
        <Box sx={{ position: "relative" }}>
          <TextField fullWidth autoFocus type="password" label="Password" value={password} disabled={busy}
            onChange={event => setPassword(event.target.value)} autoComplete="off"
            InputLabelProps={{ shrink: true }} inputProps={{ maxLength: 64 }}
            sx={{ "& input": { color: "transparent", WebkitTextFillColor: "transparent", caretColor: "#fff" } }} />
          <Box aria-hidden="true" data-testid="creation-password-mask" sx={{ position: "absolute", left: 14, right: 14, top: 16, overflow: "hidden", whiteSpace: "nowrap", pointerEvents: "none", color: "text.primary", font: "20px/24px monospace" }}>{"••".repeat(password.length)}</Box>
        </Box>
        {error && <Alert severity="error">{error}</Alert>}
        <Button type="submit" variant="contained" disabled={busy || !password}>{busy ? "Checking…" : "Unlock"}</Button>
        <Button href="/typing-boss/join">Join a room</Button>
      </Stack>
    </Paper>
  </Box>;
}
