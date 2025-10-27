import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Paper,
  Chip,
  Stack,
  Button,
  IconButton,
  LinearProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  Badge,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  alpha,
  Card,
  CardContent,
} from "@mui/material";

/**
 * PIZZA RUN — Polished MUI single-file game (no icon libs)
 * - Cleaner HUD, softer palette, modern cards
 * - Road tiles + subtle grass pattern + shadows
 * - Clearly labeled houses & shop
 * - Emoji-only icons (no lucide-react)
 */

// ===== Utility Types & Constants =====
const GRID_COLS = 20;
const GRID_ROWS = 12;
const CELL = 32; // px
const MAP_W = GRID_COLS * CELL;
const MAP_H = GRID_ROWS * CELL;

// Map entities positions
const HOUSES = [
  { id: "H1", x: 4, y: 1, label: "House A", emoji: "👨‍👩‍👧" },
  { id: "H2", x: 9, y: 1, label: "House B", emoji: "👨‍👦" },
  { id: "H3", x: 14, y: 1, label: "House C", emoji: "👩" },
];
const SHOP = { x: 1, y: GRID_ROWS - 2, label: "Shop" };
const PIZZA_CORNER = { x: GRID_COLS - 3, y: GRID_ROWS - 3 }; // decorative pizza zone bottom-right

// Movement
type Dir = "up" | "down" | "left" | "right";

// Task / Order
type Task = {
  id: string;
  houseId: string; // H1/H2/H3
  qtyRequired: number; // 1..3
  qtyDelivered: number; // increments
  createdAt: number; // ms
};

// Rating thresholds (seconds elapsed -> stars)
const RATING_THRESHOLDS = [
  { t: 20, stars: 5 },
  { t: 40, stars: 4 },
  { t: 70, stars: 3 },
  { t: 120, stars: 2 },
  { t: Infinity, stars: 1 },
];

function triangularPayout(min = 0, mode = 5, max = 10) {
  // Triangular distribution via inverse transform
  const F = (mode - min) / (max - min);
  const u = Math.random();
  if (u < F) return Math.floor(min + Math.sqrt(u * (max - min) * (mode - min)) + 0.0001);
  return Math.floor(max - Math.sqrt((1 - u) * (max - min) * (max - mode)) + 0.0001);
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function useInterval(callback: () => void, delay: number | null) {
  const savedRef = useRef(callback);
  useEffect(() => {
    savedRef.current = callback;
  }, [callback]);
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedRef.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

// Little helper to render rating stars
function Stars({ value }: { value: number }) {
  const v = Math.round(value);
  return (
    <Box component="span" sx={{ letterSpacing: 0.5 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Box key={i} component="span">{i < v ? "★" : "☆"}</Box>
      ))}
    </Box>
  );
}

// ===== Main App =====
export default function App() {
  const theme = useTheme();
  const [running, setRunning] = useState(false);
  const [shiftRemaining, setShiftRemaining] = useState(8 * 60); // seconds
  const [money, setMoney] = useState(0);
  const [hasPizza, setHasPizza] = useState(false); // inventory single slot
  const [player, setPlayer] = useState({ x: 3, y: GRID_ROWS - 2 });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [deliveries, setDeliveries] = useState(0);
  const [ratings, setRatings] = useState<number[]>([]);
  const [summaryOpen, setSummaryOpen] = useState(false);

  // Random task spawner (5-10s)
  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    function scheduleNext() {
      const ms = (5 + Math.random() * 5) * 1000; // 5..10s
      setTimeout(() => {
        if (cancelled || !running) return;
        // spawn a new task for a random house
        const house = HOUSES[Math.floor(Math.random() * HOUSES.length)];
        const qty = 1 + Math.floor(Math.random() * 3);
        const id = `T-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
        setTasks((prev) => [
          { id, houseId: house.id, qtyRequired: qty, qtyDelivered: 0, createdAt: Date.now() },
          ...prev,
        ]);
        scheduleNext();
      }, ms);
    }
    scheduleNext();
    return () => {
      cancelled = true;
    };
  }, [running]);

  // Shift countdown
  useInterval(
    () => {
      setShiftRemaining((s) => {
        if (!running) return s;
        if (s <= 1) {
          setRunning(false);
          setSummaryOpen(true);
          return 0;
        }
        return s - 1;
      });
    },
    running ? 1000 : null
  );

  
  // Collision checks — allow pickup/dropoff within ~1 tile
  const NEAR_RADIUS = 1;
  const isNear = (ax: number, ay: number, bx: number, by: number, r: number) =>
    Math.hypot(ax - bx, ay - by) <= r + 1e-9;

  const nearShop = isNear(player.x, player.y, SHOP.x, SHOP.y, NEAR_RADIUS);
  const houseUnderPlayer = useMemo(
    () => HOUSES.find((h) => isNear(player.x, player.y, h.x, h.y, NEAR_RADIUS)) || null,
    [player]
  );

  // Primary action (Space or Action button)
  const handleAction = useCallback(() => {
    if (!running) return;
    // Pickup at shop
    if (nearShop && !hasPizza) {
      setHasPizza(true);
      return;
    }
    // Deliver at house if task exists
    if (houseUnderPlayer && hasPizza) {
      const idx = tasks.findIndex((t) => t.houseId === houseUnderPlayer.id);
      if (idx !== -1) {
        const t = tasks[idx];
        if (t.qtyDelivered < t.qtyRequired) {
          const payout = triangularPayout(0, 5, 10);
          setMoney((m) => m + payout);
          setDeliveries((d) => d + 1);
          setHasPizza(false);
          const now = Date.now();
          const updated: Task = { ...t, qtyDelivered: t.qtyDelivered + 1 };
          const remaining = updated.qtyRequired - updated.qtyDelivered;
          setTasks((prev) => {
            const clone = [...prev];
            if (remaining <= 0) {
              clone.splice(idx, 1);
              const elapsedSec = (now - t.createdAt) / 1000;
              const stars = RATING_THRESHOLDS.find((r) => elapsedSec <= r.t)?.stars || 1;
              setRatings((rs) => [...rs, stars]);
            } else {
              clone[idx] = updated;
            }
            return clone;
          });
        }
      }
    }
  }, [running, nearShop, hasPizza, houseUnderPlayer, tasks]);


  // Keyboard controls
  const keys = useRef<{ [k: string]: boolean }>({});
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const key = e.key;
      const code = (e as any).code || "";
      // Robust space detection across browsers + prevent page scroll
      if (key === " " || key === "Spacebar" || key === "Space" || code === "Space") {
        e.preventDefault();
        handleAction();
        return;
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) {
        e.preventDefault();
      }
      keys.current[key.toLowerCase()] = true;
    };
    const onUp = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [handleAction]);

  // Movement tick
  useInterval(() => {
    if (!running) return;
    let { x, y } = player;
    const step = 1; // grid step in cells
    if (keys.current["arrowup"] || keys.current["w"]) y -= step;
    if (keys.current["arrowdown"] || keys.current["s"]) y += step;
    if (keys.current["arrowleft"] || keys.current["a"]) x -= step;
    if (keys.current["arrowright"] || keys.current["d"]) x += step;
    x = clamp(x, 0, GRID_COLS - 1);
    y = clamp(y, 0, GRID_ROWS - 1);
    if (x !== player.x || y !== player.y) setPlayer({ x, y });
  }, 150);

  const tileRect = (x: number, y: number) => ({ left: x * CELL, top: y * CELL, width: CELL, height: CELL });

  const avgRating = ratings.length
    ? ratings.reduce((a, b) => a + b, 0) / ratings.length
    : 0;

  const resetGame = () => {
    setRunning(false);
    setShiftRemaining(8 * 60);
    setMoney(0);
    setHasPizza(false);
    setPlayer({ x: 3, y: GRID_ROWS - 2 });
    setTasks([]);
    setDeliveries(0);
    setRatings([]);
    setSummaryOpen(false);
  };

  // D-pad buttons
  const nudge = (dir: Dir) => {
    if (!running) return;
    let { x, y } = player;
    if (dir === "up") y -= 1;
    if (dir === "down") y += 1;
    if (dir === "left") x -= 1;
    if (dir === "right") x += 1;
    setPlayer({ x: clamp(x, 0, GRID_COLS - 1), y: clamp(y, 0, GRID_ROWS - 1) });
  };

  // Pretty backgrounds
  const grass = `repeating-linear-gradient(45deg, ${alpha(
    theme.palette.success.light,
    0.08
  )} 0 10px, ${alpha(theme.palette.success.dark, 0.08)} 10px 20px)`;

  const roadColor = alpha(theme.palette.grey[700], 0.9);
  const laneColor = alpha("#fff", 0.5);

  const hudChip = (label: string) => (
    <Chip
      label={label}
      sx={{
        bgcolor: alpha(theme.palette.background.paper, 0.7),
        border: `1px solid ${alpha(theme.palette.common.white, 0.15)}`,
        backdropFilter: "blur(6px)",
      }}
      size="small"
    />
  );

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", gridTemplateRows: "auto 1fr", bgcolor: "#0a0f1a" }}>
      <AppBar position="static" elevation={0} sx={{ bgcolor: "#0a0f1a", borderBottom: `1px solid ${alpha("#fff", 0.08)}` }}>
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            🍕 Pizza Run — Shift
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            {hudChip(`💵 $${money}`)}
            {hudChip(`⏱️ ${Math.floor(shiftRemaining / 60)}:${String(shiftRemaining % 60).padStart(2, "0")}`)}
            {hudChip(hasPizza ? "Inventory: 🍕" : "Inventory: empty")}
            {hudChip(`Avg `)}
            <Stars value={avgRating} />
            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
            {!running ? (
              <Tooltip title="Start shift">
                <Button variant="contained" color="success" onClick={() => setRunning(true)} sx={{ borderRadius: 999 }}>
                  ▶ Start
                </Button>
              </Tooltip>
            ) : (
              <Tooltip title="Pause shift">
                <Button variant="outlined" color="warning" onClick={() => setRunning(false)} sx={{ borderRadius: 999 }}>
                  ■ Pause
                </Button>
              </Tooltip>
            )}
            <Tooltip title="Reset">
              <Button onClick={resetGame} sx={{ borderRadius: 999 }}>↻ Reset</Button>
            </Tooltip>
          </Stack>
        </Toolbar>
        {running && <LinearProgress />}
      </AppBar>

      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 2, p: 2 }}>
        {/* Map Area */}
        <Paper
          elevation={6}
          tabIndex={0}
          sx={{ outline: "none",
            position: "relative",
            width: MAP_W,
            height: MAP_H,
            overflow: "hidden",
            mx: "auto",
            borderRadius: 4,
            backgroundImage: grass,
            boxShadow: `0 10px 40px ${alpha("#000", 0.4)}`,
          }}
        >
          {/* Light grid */}
          {Array.from({ length: GRID_ROWS }).map((_, r) => (
            <Box key={`row-${r}`} sx={{ position: "absolute", left: 0, top: r * CELL, width: MAP_W, height: 1, bgcolor: "rgba(255,255,255,0.04)" }} />
          ))}
          {Array.from({ length: GRID_COLS }).map((_, c) => (
            <Box key={`col-${c}`} sx={{ position: "absolute", top: 0, left: c * CELL, width: 1, height: MAP_H, bgcolor: "rgba(255,255,255,0.04)" }} />
          ))}

          {/* Simple roads: vertical to houses, horizontal at row 2 */}
          {/* Horizontal main road under houses */}
          <Box sx={{ position: "absolute", left: 0, top: CELL * 2 - CELL / 2, width: MAP_W, height: CELL, bgcolor: roadColor, boxShadow: `inset 0 0 0 2px ${alpha("#000", 0.2)}` }} />
          {/* Lane markings */}
          {Array.from({ length: 12 }).map((_, i) => (
            <Box key={`lane-${i}`} sx={{ position: "absolute", top: CELL * 2 - 2, left: i * CELL * 1.7 + CELL / 2, width: CELL, height: 4, bgcolor: laneColor, borderRadius: 2 }} />
          ))}

          {/* Vertical driveways to each house */}
          {HOUSES.map((h) => (
            <Box key={`drv-${h.id}`} sx={{ position: "absolute", left: h.x * CELL, top: CELL * 2, width: CELL, height: CELL, bgcolor: roadColor }} />
          ))}

          {/* Houses (top) */}
          {HOUSES.map((h) => (
            <Box key={h.id} sx={{ position: "absolute", ...tileRect(h.x, h.y) }}>
              <Box
                sx={{
                  position: "absolute",
                  inset: 4,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.info.main, 0.18),
                  border: `2px solid ${alpha(theme.palette.info.light, 0.8)}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Stack spacing={0.5} alignItems="center">
                  <Typography component="span" fontSize={18}>🏠</Typography>
                  <Typography variant="caption" sx={{ color: "#e0e7ff", fontWeight: 700 }}>{h.label}</Typography>
                  <Typography sx={{ fontSize: 16 }}>{h.emoji}</Typography>
                </Stack>
              </Box>
            </Box>
          ))}

          {/* Shop (bottom-left) */}
          <Box sx={{ position: "absolute", ...tileRect(SHOP.x, SHOP.y) }}>
            <Box
              sx={{
                position: "absolute",
                inset: 4,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.success.main, 0.18),
                border: `2px solid ${alpha(theme.palette.success.light, 0.8)}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                p: 0.5,
              }}
            >
              <Stack spacing={0} alignItems="center">
                <Typography component="span" fontSize={18}>🏪</Typography>
                <Typography variant="caption" sx={{ color: "#c9ffda", fontWeight: 700 }}>{SHOP.label}</Typography>
                <Typography sx={{ fontSize: 18 }}>🍕</Typography>
                <Typography variant="caption" sx={{ color: "#c9ffda" }}>Space: pickup (within 1 tile)</Typography>
              </Stack>
            </Box>
          </Box>

          {/* Pizza Corner (decor, bottom-right) */}
          <Box sx={{ position: "absolute", ...tileRect(PIZZA_CORNER.x, PIZZA_CORNER.y) }}>
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                transform: "rotate(45deg)",
                borderRadius: 2,
                bgcolor: alpha("#ffb8c6", 0.15),
                border: `2px solid ${alpha("#ffb8c6", 0.9)}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Typography sx={{ transform: "rotate(-45deg)", fontSize: 22 }}>🍕</Typography>
            </Box>
          </Box>

          {/* Player (blue circle with pulse) */}
          <Box
            sx={{
              position: "absolute",
              left: player.x * CELL + 6,
              top: player.y * CELL + 6,
              width: CELL - 12,
              height: CELL - 12,
              borderRadius: "50%",
              bgcolor: "#4da3ff",
              border: "2px solid #bfe0ff",
              boxShadow: "0 0 0 6px rgba(77,163,255,0.15), 0 0 18px rgba(77,163,255,0.6)",
              transition: "left 80ms linear, top 80ms linear",
            }}
          />

          {/* Floating D-Pad */}
          <Box
            sx={{
              position: "absolute",
              right: 12,
              bottom: 12,
              display: "grid",
              gridTemplateColumns: "40px 40px 40px",
              gridTemplateRows: "40px 40px 40px",
              gap: 1,
              p: 1,
              bgcolor: alpha("#0a0f1a", 0.5),
              borderRadius: 3,
              border: `1px solid ${alpha("#fff", 0.12)}`,
              backdropFilter: "blur(6px)",
            }}
          >
            <Box />
            <IconButton color="primary" onClick={() => nudge("up")} sx={{ border: `1px solid ${alpha("#fff", 0.2)}`, borderRadius: 2 }}>↑</IconButton>
            <Box />
            <IconButton color="primary" onClick={() => nudge("left")} sx={{ border: `1px solid ${alpha("#fff", 0.2)}`, borderRadius: 2 }}>←</IconButton>
            <IconButton color="secondary" onClick={handleAction} sx={{ border: `1px solid ${alpha("#fff", 0.2)}`, borderRadius: 2 }}>🍕</IconButton>
            <IconButton color="primary" onClick={() => nudge("right")} sx={{ border: `1px solid ${alpha("#fff", 0.2)}`, borderRadius: 2 }}>→</IconButton>
            <Box />
            <IconButton color="primary" onClick={() => nudge("down")} sx={{ border: `1px solid ${alpha("#fff", 0.2)}`, borderRadius: 2 }}>↓</IconButton>
            <Box />
          </Box>
        </Paper>

        {/* Sidebar: Tasks & Controls */}
        <Stack spacing={2}>
          <Card elevation={4} sx={{ borderRadius: 3, overflow: "hidden" }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>🧾 Orders</Typography>
              <List dense>
                {tasks.length === 0 && (
                  <ListItem>
                    <ListItemText primary="No active orders. Stand by…" secondary="New tasks appear every 5–10 seconds." />
                  </ListItem>
                )}
                {tasks.map((t) => {
                  const house = HOUSES.find((h) => h.id === t.houseId)!;
                  const remaining = t.qtyRequired - t.qtyDelivered;
                  const elapsed = Math.floor((Date.now() - t.createdAt) / 1000);
                  return (
                    <ListItem key={t.id} sx={{ alignItems: "flex-start" }}>
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Badge color={remaining > 0 ? "warning" : "success"} badgeContent={`${remaining}/${t.qtyRequired}`}>
                              <Typography component="span">🏠</Typography>
                            </Badge>
                            <Typography variant="subtitle2" fontWeight={700}>{house.label}</Typography>
                            <Chip size="small" label={`${elapsed}s`} />
                          </Stack>
                        }
                        secondary={`Deliver ${t.qtyRequired} pizza${t.qtyRequired > 1 ? "s" : ""}. Space near the house to deliver.`}
                      />
                    </ListItem>
                  );
                })}
              </List>
            </CardContent>
          </Card>

          <Card elevation={4} sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>🎮 How to Play</Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Move with arrow keys / WASD or use the pad. Press <b>Space</b> at the Shop to pick up a pizza (inventory holds 1). Press <b>Space</b> at a House to deliver.
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Stack direction="row" spacing={1}>
                <Chip label={`Deliveries: ${deliveries}`} size="small" />
                <Chip label={`Ratings: ${ratings.length}`} size="small" />
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>

      {/* Summary Dialog */}
      <Dialog open={summaryOpen} onClose={() => setSummaryOpen(false)}>
        <DialogTitle>Shift Complete</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ mt: 1 }}>
            <Typography><b>Money Earned:</b> ${money}</Typography>
            <Typography><b>Total Deliveries:</b> {deliveries}</Typography>
            <Typography><b>Ratings Received:</b> {ratings.length}</Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography><b>Average Rating:</b></Typography>
              <Stars value={avgRating} />
              <Typography>({avgRating.toFixed(2)})</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSummaryOpen(false)}>Close</Button>
          <Button onClick={resetGame} variant="contained">Play Again</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
