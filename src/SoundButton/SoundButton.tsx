import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";

const PASSWORD = "teacheronly";
const BUTTON_COOLDOWN_SECONDS = 10;
const STORAGE_KEY = "secret-sound-button-auth";
const SOUND_MANIFEST_PATH = `${process.env.PUBLIC_URL || ""}/assets/sounds/index.json`;
const SOUND_BASE_PATH = `${process.env.PUBLIC_URL || ""}/assets/sounds`;
const ALLOWED_EXTENSIONS = [".mp3", ".wav", ".ogg", ".m4a"];

function withDefaultExtension(file: string): string {
  const hasKnownExtension = ALLOWED_EXTENSIONS.some((ext) =>
    file.toLowerCase().endsWith(ext)
  );
  return hasKnownExtension ? file : `${file}.mp3`;
}

function toPublicSoundPath(file: string): string {
  const normalized = withDefaultExtension(file.trim()).replace(/^\/+/, "");
  if (normalized.startsWith("assets/")) {
    return `${process.env.PUBLIC_URL || ""}/${normalized}`;
  }
  return `${SOUND_BASE_PATH}/${normalized}`;
}

async function loadAllSounds(): Promise<string[]> {
  try {
    const response = await fetch(SOUND_MANIFEST_PATH, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Failed to load sound manifest: ${response.status}`);
    }

    const files = (await response.json()) as unknown;
    if (!Array.isArray(files)) {
      throw new Error("Sound manifest must be a JSON array of filenames.");
    }

    const unique = Array.from(
      new Set(
        files
          .filter((file): file is string => typeof file === "string")
          .map((file) => file.trim())
          .filter(Boolean)
          .map(toPublicSoundPath)
      )
    );

    return unique;
  } catch (error) {
    console.error("Could not load sounds:", error);
    return [];
  }
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export default function SoundButton() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [passwordCooldownMs, setPasswordCooldownMs] = useState(0);
  const [cooldownSecondsLeft, setCooldownSecondsLeft] = useState(0);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [lastSound, setLastSound] = useState("");
  const [soundFiles, setSoundFiles] = useState<string[]>([]);
  const [loadError, setLoadError] = useState("");
  const [playError, setPlayError] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const passwordTimerRef = useRef<number | null>(null);
  const buttonTimerRef = useRef<number | null>(null);

  const isPasswordLocked = passwordCooldownMs > 0;
  const isButtonLocked = cooldownSecondsLeft > 0;

  const buttonLabel = useMemo(() => {
    if (soundFiles.length === 0) return "NO SOUND";
    if (isButtonLocked) return `${cooldownSecondsLeft}s`;
    return "PRESS";
  }, [cooldownSecondsLeft, isButtonLocked, soundFiles.length]);

  useEffect(() => {
    const savedAuth = localStorage.getItem(STORAGE_KEY);
    if (savedAuth === "true") {
      setIsAuthenticated(true);
    }

    loadAllSounds().then((files) => {
      setSoundFiles(files);
      if (files.length === 0) {
        setLoadError("No playable sound files were found.");
      } else {
        setLoadError("");
      }
    });

    audioRef.current = new Audio();
    audioRef.current.preload = "auto";

    return () => {
      if (passwordTimerRef.current) window.clearInterval(passwordTimerRef.current);
      if (buttonTimerRef.current) window.clearInterval(buttonTimerRef.current);
      audioRef.current?.pause();
    };
  }, []);

  const startPasswordCooldown = (attemptCount: number) => {
    const seconds = Math.min(2 ** (attemptCount - 1), 300);
    setPasswordCooldownMs(seconds * 1000);

    if (passwordTimerRef.current) {
      window.clearInterval(passwordTimerRef.current);
    }

    const endTime = Date.now() + seconds * 1000;
    passwordTimerRef.current = window.setInterval(() => {
      const remaining = Math.max(0, endTime - Date.now());
      setPasswordCooldownMs(remaining);
      if (remaining <= 0 && passwordTimerRef.current) {
        window.clearInterval(passwordTimerRef.current);
        passwordTimerRef.current = null;
      }
    }, 100);
  };

  const startButtonCooldown = () => {
    setCooldownSecondsLeft(BUTTON_COOLDOWN_SECONDS);

    if (buttonTimerRef.current) {
      window.clearInterval(buttonTimerRef.current);
    }

    const endTime = Date.now() + BUTTON_COOLDOWN_SECONDS * 1000;
    buttonTimerRef.current = window.setInterval(() => {
      const remainingSeconds = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setCooldownSecondsLeft(remainingSeconds);
      if (remainingSeconds <= 0 && buttonTimerRef.current) {
        window.clearInterval(buttonTimerRef.current);
        buttonTimerRef.current = null;
      }
    }, 150);
  };

  const handlePasswordSubmit = () => {
    if (isPasswordLocked) return;

    if (passwordInput === PASSWORD) {
      setIsAuthenticated(true);
      localStorage.setItem(STORAGE_KEY, "true");
      setPasswordInput("");
      setFailedAttempts(0);
      setPasswordCooldownMs(0);
      return;
    }

    const nextAttempts = failedAttempts + 1;
    setFailedAttempts(nextAttempts);
    setPasswordInput("");
    startPasswordCooldown(nextAttempts);
  };

  const playRandomSound = async () => {
    if (!isAuthenticated || isButtonLocked || soundFiles.length === 0 || !audioRef.current) {
      return;
    }

    setPlayError("");
    const chosenSound = randomItem(soundFiles);
    setLastSound(chosenSound.split("/").pop() ?? chosenSound);

    try {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = encodeURI(chosenSound);
      audioRef.current.load();
      await audioRef.current.play();
      startButtonCooldown();
    } catch (error) {
      console.error("Audio playback failed:", error);
      setPlayError(`Could not play ${chosenSound.split("/").pop() ?? "sound"}`);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem(STORAGE_KEY);
    setMenuAnchor(null);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100vw",
        bgcolor: "#111111",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <IconButton
        onClick={(e) => setMenuAnchor(e.currentTarget)}
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          color: "#111111",
          opacity: 0.92,
          zIndex: 2,
          "&:hover": {
            color: "#1b1b1b",
            bgcolor: "rgba(255,255,255,0.03)",
          },
        }}
        aria-label="settings"
      >
        <MenuIcon />
      </IconButton>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem onClick={handleLogout}>Lock screen</MenuItem>
      </Menu>

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          px: 2,
        }}
      >
        <Button
          onClick={playRandomSound}
          disabled={!isAuthenticated || isButtonLocked || soundFiles.length === 0}
          sx={{
            width: 260,
            height: 260,
            minWidth: 260,
            borderRadius: "50%",
            background: "radial-gradient(circle at 30% 30%, #ff7676 0%, #d92d2d 45%, #8f1111 100%)",
            border: "10px solid #2f2f2f",
            boxShadow: "0 18px 0 #1d1d1d, 0 28px 40px rgba(0,0,0,0.35), inset 0 10px 18px rgba(255,255,255,0.22), inset 0 -14px 18px rgba(0,0,0,0.3)",
            color: "#fff8dc",
            fontFamily: '"Arial Black", "Roboto", sans-serif',
            fontSize: "2rem",
            fontWeight: 900,
            letterSpacing: "0.08em",
            textAlign: "center",
            lineHeight: 1.1,
            px: 2,
            userSelect: "none",
            transition: "transform 100ms ease, box-shadow 100ms ease, filter 120ms ease",
            "&:hover": {
              background: "radial-gradient(circle at 30% 30%, #ff7676 0%, #d92d2d 45%, #8f1111 100%)",
              filter: "brightness(1.03)",
            },
            "&:active": {
              transform: "translateY(10px)",
              boxShadow: "0 6px 0 rgba(0,0,0,0.45), inset 0 8px 14px rgba(0,0,0,0.26)",
            },
            "&.Mui-disabled": {
              color: "#fff8dc",
              opacity: 0.75,
            },
          }}
        >
          {buttonLabel}
        </Button>

        <Box sx={{ width: 240, visibility: isButtonLocked ? "visible" : "hidden" }}>
          <LinearProgress
            variant="determinate"
            value={((BUTTON_COOLDOWN_SECONDS - cooldownSecondsLeft) / BUTTON_COOLDOWN_SECONDS) * 100}
            sx={{ height: 8, borderRadius: 999 }}
          />
        </Box>

        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.18)", textAlign: "center", minHeight: 18 }}>
          {playError || loadError || (lastSound ? `Played: ${lastSound}` : "")}
        </Typography>
      </Box>

      <Dialog open={!isAuthenticated} maxWidth="xs" fullWidth>
        <DialogTitle>Enter Password</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Password"
              type="password"
              fullWidth
              autoFocus
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handlePasswordSubmit();
                }
              }}
              disabled={isPasswordLocked}
            />

            {isPasswordLocked && (
              <Box>
                <Typography variant="body2" color="error" sx={{ mb: 1 }}>
                  Try again in {(passwordCooldownMs / 1000).toFixed(1)} seconds.
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={
                    failedAttempts > 0
                      ? Math.max(
                          0,
                          Math.min(
                            100,
                            100 - (passwordCooldownMs / (Math.min(2 ** (failedAttempts - 1), 300) * 1000)) * 100
                          )
                        )
                      : 0
                  }
                />
              </Box>
            )}

            {!isPasswordLocked && failedAttempts > 0 && (
              <Typography variant="body2" color="error">
                Incorrect password.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handlePasswordSubmit} disabled={isPasswordLocked || !passwordInput}>
            Unlock
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
