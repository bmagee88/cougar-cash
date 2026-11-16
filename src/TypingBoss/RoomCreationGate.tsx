import React, { useState } from "react";
import { Alert, Box, Button, TextField } from "@mui/material";
import MainMenu from './MainMenu';
import { unlockTypingBossCreation } from "./api";

export default function RoomCreationGate({ children }: { children: (password: string) => React.ReactNode }) {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (unlocked) return <>{children(password)}</>;
  return <MainMenu>
    <Box component="form" className="tb-menu-unlock" onSubmit={async event => {
      event.preventDefault();
      setBusy(true); setError("");
      try { await unlockTypingBossCreation(password); setUnlocked(true); }
      catch (caught) { setError(caught instanceof Error ? caught.message : "Could not unlock room creation."); }
      finally { setBusy(false); }
    }}>
      <div className="tb-menu-password-row">
        <Box sx={{ position: "relative" }}>
          <TextField fullWidth type="password" label="Password" value={password} disabled={busy}
            onChange={event => setPassword(event.target.value)} autoComplete="off"
            InputLabelProps={{ shrink: true }} inputProps={{ maxLength: 64 }}
            sx={{ "& input": { color: "transparent", WebkitTextFillColor: "transparent", caretColor: "#fff" } }} />
          <Box aria-hidden="true" data-testid="creation-password-mask" sx={{ position: "absolute", left: 14, right: 14, top: 16, overflow: "hidden", whiteSpace: "nowrap", pointerEvents: "none", color: "text.primary", font: "20px/24px monospace" }}>{"••".repeat(password.length)}</Box>
        </Box>
        <Button type="submit" variant="outlined" disabled={busy || !password}>{busy ? "Checking…" : "Unlock"}</Button>
      </div>
      {error && <Alert severity="error" sx={{mt:2}}>{error}</Alert>}
    </Box>
  </MainMenu>;
}
