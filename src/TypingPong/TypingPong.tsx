// TypingPong.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

const BOARD_COLS = 20;
const PADDLE_WIDTH_COLS = 5; // must be odd

const INITIAL_TRAVEL_TIME = 5;
const MIN_TRAVEL_TIME = 2;
const TRAVEL_TIME_STEP = 0.1;

// Normalized coordinates (0..1)
const TOP_PADDLE_Y = 0.1;
const BOTTOM_PADDLE_Y = 0.9;
const BALL_RADIUS = 0.02;
const VERTICAL_DISTANCE = BOTTOM_PADDLE_Y - TOP_PADDLE_Y;

type Side = "top" | "bottom";
type GameMode = "single" | "two";
type BotDifficulty = "easy" | "medium" | "hard";

interface Scores {
  top: number;
  bottom: number;
}

type SegmentEventType =
  | "wall-left"
  | "wall-right"
  | "paddle-top"
  | "paddle-bottom";

const MAX_WORD_LENGTH = 10;

  const WORD_BANK: Record<number, string[]> = {
  1: [
    "a",
    "i",
    // there really aren't many natural 1-letter words in English
  ],
  2: [
    "go",
    "do",
    "up",
    "no",
    "it",
    "in",
    "on",
    "we",
    "me",
    "to",
    "at",
    "an",
    "am",
    "as",
    "by",
    "he",
    "hi",
    "if",
    "is",
    "of",
    "or",
    "so",
    "us",
    "be",
    "my",
    "ox",
    "ok",
  ],
  3: [
    "cat",
    "dog",
    "sun",
    "sky",
    "run",
    "red",
    "blue",
    "big",
    "kid",
    "fun",
    "map",
    "box",
    "pen",
    "cup",
    "bag",
    "hat",
    "cap",
    "bat",
    "bus",
    "car",
    "bed",
    "top",
    "log",
    "bug",
    "ant",
    "bee",
    "web",
    "key",
    "jam",
    "ice",
    "sea",
    "row",
    "win",
    "toy",
    "hug",
    "lap",
    "sit",
    "fix",
    "mix",
    "hop",
    "dig",
  ],
  4: [
    "game",
    "code",
    "play",
    "time",
    "jump",
    "move",
    "good",
    "fast",
    "slow",
    "read",
    "type",
    "home",
    "word",
    "line",
    "page",
    "math",
    "desk",
    "book",
    "ball",
    "room",
    "star",
    "tree",
    "door",
    "talk",
    "walk",
    "show",
    "test",
    "quiz",
    "rule",
    "kind",
    "safe",
    "help",
    "join",
    "save",
    "need",
    "want",
    "work",
    "file",
    "menu",
    "open",
    "send",
    "site",
    "link",
    "text",
    "data",
    "user",
    "fact",
    "idea",
    "plan",
    "goal",
  ],
  5: [
    "skill",
    "learn",
    "smart",
    "quick",
    "brain",
    "mouse",
    "board",
    "write",
    "score",
    "level",
    "speed",
    "point",
    "think",
    "share",
    "click",
    "start",
    "class",
    "short",
    "light",
    "sound",
    "green",
    "brown",
    "stick",
    "press",
    "space",
    "shift",
    "enter",
    "arrow",
    "above",
    "below",
    "track",
    "happy",
    "funny",
    "great",
    "proud",
    "brave",
    "focus",
    "group",
    "essay",
    "paper",
    "notes",
    "rules",
    "tools",
    "build",
    "draft",
  ],
  6: [
    "school",
    "rocket",
    "friend",
    "castle",
    "planet",
    "bridge",
    "forest",
    "dragon",
    "letter",
    "number",
    "online",
    "screen",
    "middle",
    "person",
    "second",
    "answer",
    "choose",
    "random",
    "player",
    "delete",
    "insert",
    "search",
    "select",
    "export",
    "import",
    "social",
    "window",
    "dialog",
    "button",
    "volume",
    "camera",
    "tablet",
    "upload",
    "typing",
    "coding",
    "output",
    "cursor",
    "submit",
    "create",
    "record",
    "memory",
    "policy",
    "symbol",
  ],
  7: [
    "student",
    "teacher",
    "typing",
    "monster",
    "battle",
    "victory",
    "awesome",
    "rainbow",
    "picture",
    "library",
    "project",
    "example",
    "message",
    "profile",
    "improve",
    "drawing",
    "history",
    "science",
    "monitor",
    "village",
    "journey",
    "fantasy",
    "courage",
    "respect",
    "problem",
    "choices",
    "grammar",
    "timeout",
    "account",
    "privacy",
    "caution",
    "connect",
    "replies",
    "subject",
    "balance",
    "percent",
    "careful",
  ],
  8: [
    "keyboard",
    "computer",
    "language",
    "strategy",
    "learning",
    "distance",
    "sentence",
    "accuracy",
    "movement",
    "velocity",
    "internet",
    "notebook",
    "username",
    "password",
    "download",
    "homework",
    "research",
    "solution",
    "activity",
    "settings",
    "document",
    "feedback",
    "creation",
    "overview",
    "security",
    "practice",
    "tracking",
    "managing",
    "software",
    "database",
  ],
  9: [
    "challenge",
    "adventure",
    "schoolwork",
    "classroom",
    "important",
    "direction",
    "attention",
    "fantastic",
    "knowledge",
    "dinosaur",
    "character",
    "rectangle",
    "algorithm",
    "magnitude",
    "objective",
    "education",
    "paragraph",
    "organizer",
    "sensitive",
    "interface",
    "invisible",
    "difficult",
    "automatic",
    "community",
  ],
  10: [
    "concentration",
    "improvement",
    "technology",
    "confidence",
    "motivation",
    "completion",
    "interaction",
    "leadership",
    "definition",
    "creativity",
    "connection",
    "navigation",
    "evaluation",
    "generation",
    "background",
    "controller",
    "percentage",
    "regulation",
    "validation",
    "prediction",
    "electronic",
    "programmer",
    "classmates",
    "processing",
    "recordings",
  ],
};


// const BOT_SETTINGS: Record<
//   BotDifficulty,
//   { moveInterval: number; mistakeChance: number }
// > = {
//   easy: { moveInterval: 0.2, mistakeChance: 0.25 },
//   medium: { moveInterval: 0.12, mistakeChance: 0.1 },
//   hard: { moveInterval: 0.08, mistakeChance: 0.02 },
// };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function capitalize(side: Side): string {
  return side === "top" ? "Top" : "Bottom";
}

/**
 * Build a multi-word prompt whose total character count (including spaces)
 * is at least targetSteps.
 */
function buildPrompt(targetSteps: number): { text: string; totalChars: number } {
  const steps = Math.max(1, targetSteps);
  let text = "";
  let totalChars = 0;

  while (totalChars < steps) {
    const remaining = steps - totalChars;
    const maxLen = Math.min(MAX_WORD_LENGTH, remaining);

    const len = maxLen;
    const words = WORD_BANK[len] ?? WORD_BANK[MAX_WORD_LENGTH];
    const word = words[Math.floor(Math.random() * words.length)];

    if (text.length > 0) {
      text += " ";
      totalChars += 1; // space
    }

    text += word;
    totalChars += word.length;
  }

  return { text, totalChars };
}

/**
 * Reflect a 1D motion with bouncing walls at 0 and 1.
 */
function reflectX(x0: number, vx: number, time: number): number {
  const width = 1;
  const period = 2 * width;
  let pos = x0 + vx * time;
  pos = ((pos % period) + period) % period; // positive modulo
  if (pos > width) {
    pos = period - pos;
  }
  return clamp(pos, 0, 1);
}

const TypingPong: React.FC = () => {
  // Game mode & bot difficulty
  const [gameMode, setGameMode] = useState<GameMode>("single");
  const [botDifficulty, setBotDifficulty] =
    useState<BotDifficulty>("medium");

  // Treat paddleCol as the *center column* (can overhang the walls)
  const [topPaddleCol, setTopPaddleCol] = useState<number>(0);
  const [bottomPaddleCol, setBottomPaddleCol] = useState<number>(
    BOARD_COLS - 1
  );

  const [ballPos, setBallPos] = useState<{ x: number; y: number }>({
    x: 0.5,
    y: 0.5,
  });

  const [travelTime, setTravelTime] =
    useState<number>(INITIAL_TRAVEL_TIME);
  const [scores, setScores] = useState<Scores>({ top: 0, bottom: 0 });

  // Typing prompt state
  const [promptText, setPromptText] = useState<string>("");
  const [typedText, setTypedText] = useState<string>("");

  // Index of the character that corresponds to a *center hit*
  const [centerStepIndex, setCenterStepIndex] =
    useState<number>(0);
  const [distanceColsState, setDistanceColsState] =
    useState<number>(0);

  const [statusMessage, setStatusMessage] = useState<string>(
    "Press Start to begin! In 1 Player mode, you control the bottom paddle; the top is a bot."
  );

  const [currentAttacker, setCurrentAttacker] =
    useState<Side>("bottom");
  const [currentDefender, setCurrentDefender] =
    useState<Side>("top");
  const [targetHitCol, setTargetHitCol] =
    useState<number | null>(null);

  const [isRunning, setIsRunning] = useState<boolean>(false);

  // Refs for loop and kinematics
  const ballPosRef = useRef(ballPos);
  const velocityRef = useRef<{ vx: number; vy: number }>({
    vx: 0,
    vy: 0,
  });

  const topPaddleRef = useRef(topPaddleCol);
  const bottomPaddleRef = useRef(bottomPaddleCol);

  const travelTimeRef = useRef(travelTime);
  const attackerRef = useRef<Side>(currentAttacker);
  const defenderRef = useRef<Side>(currentDefender);

  const isRunningRef = useRef<boolean>(isRunning);
  const animationFrameIdRef = useRef<number | null>(null);

  // Segment interpolation refs
  const segmentStartPosRef = useRef<{ x: number; y: number }>({
    x: 0.5,
    y: 0.5,
  });
  const segmentEndPosRef = useRef<{ x: number; y: number }>({
    x: 0.5,
    y: 0.5,
  });
  const segmentDurationRef = useRef<number>(0); // seconds
  const segmentStartTimeRef = useRef<number | null>(null);
  const currentEventRef = useRef<{
    t: number;
    type: SegmentEventType;
  } | null>(null);

  // Refs for "underline logic" (used to determine hits & bounces)
  const typedLengthRef = useRef<number>(0);
  const targetHitColRef = useRef<number | null>(null);
  const distanceColsRef = useRef<number>(0);

  // Bot refs
  const botDifficultyRef = useRef<BotDifficulty>("medium");
  const botMoveAccumulatorRef = useRef<number>(0);

  useEffect(() => {
    ballPosRef.current = ballPos;
  }, [ballPos]);

  useEffect(() => {
    topPaddleRef.current = topPaddleCol;
  }, [topPaddleCol]);

  useEffect(() => {
    bottomPaddleRef.current = bottomPaddleCol;
  }, [bottomPaddleCol]);

  useEffect(() => {
    travelTimeRef.current = travelTime;
  }, [travelTime]);

  useEffect(() => {
    attackerRef.current = currentAttacker;
  }, [currentAttacker]);

  useEffect(() => {
    defenderRef.current = currentDefender;
  }, [currentDefender]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    targetHitColRef.current = targetHitCol;
  }, [targetHitCol]);

  useEffect(() => {
    distanceColsRef.current = distanceColsState;
  }, [distanceColsState]);

  useEffect(() => {
    typedLengthRef.current = typedText.length;
  }, [typedText]);

  useEffect(() => {
    botDifficultyRef.current = botDifficulty;
  }, [botDifficulty]);

  useEffect(() => {
    return () => {
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, []);

  const halfPaddleUnits = Math.floor(PADDLE_WIDTH_COLS / 2);
  const paddleWidthNorm = PADDLE_WIDTH_COLS / BOARD_COLS;

  const getPaddleCenterCol = (col: number) => col; // allow overhang

  const getPaddleCenterXNorm = (col: number) => {
    if (BOARD_COLS <= 1) return 0.5;
    const centerCol = getPaddleCenterCol(col);
    return centerCol / (BOARD_COLS - 1);
  };

  const getPaddleBoundsNorm = (col: number) => {
    const centerX = getPaddleCenterXNorm(col);
    const minX = centerX - paddleWidthNorm / 2;
    const maxX = centerX + paddleWidthNorm / 2;
    return { minX, maxX };
  };

  // --- Set up defender's prompt and predicted hit column ---
  const setupDefensePrompt = (
    attacker: Side,
    defender: Side,
    ballX: number,
    ballY: number,
    vx: number,
    vy: number
  ): void => {
    // In single-player mode, if the defender is the BOT (top),
    // we skip prompt/underline logic and let the AI handle it.
    if (gameMode === "single" && defender === "top") {
      setPromptText("");
      setTypedText("");
      typedLengthRef.current = 0;
      setTargetHitCol(null);
      targetHitColRef.current = null;
      setCenterStepIndex(0);
      setDistanceColsState(0);
      distanceColsRef.current = 0;

      setStatusMessage(
        "Bot is defending on top. Get ready to defend when it's your turn!"
      );
      return;
    }

    const targetY = defender === "top" ? TOP_PADDLE_Y : BOTTOM_PADDLE_Y;
    const timeToDefender = (targetY - ballY) / vy;

    const defenderColCenter =
      defender === "top"
        ? getPaddleCenterCol(topPaddleRef.current)
        : getPaddleCenterCol(bottomPaddleRef.current);

    if (timeToDefender <= 0) {
      // fallback: simple short prompt
      const distanceColsFallback = 3;
      const totalStepsFallback =
        distanceColsFallback + Math.floor(PADDLE_WIDTH_COLS / 2);
      const { text } = buildPrompt(totalStepsFallback);

      setPromptText(text);
      setTypedText("");
      typedLengthRef.current = 0;

      setTargetHitCol(defenderColCenter);
      targetHitColRef.current = defenderColCenter;

      const centerIdxFallback = Math.max(distanceColsFallback - 1, 0);
      setCenterStepIndex(centerIdxFallback);
      setDistanceColsState(distanceColsFallback);
      distanceColsRef.current = distanceColsFallback;

      setStatusMessage(
        `${capitalize(defender)} player: type the prompt to be ready!`
      );
      return;
    }

    const predictedXNorm = reflectX(ballX, vx, timeToDefender);
    const predictedCol = Math.round(predictedXNorm * (BOARD_COLS - 1));
    setTargetHitCol(predictedCol);
    targetHitColRef.current = predictedCol;

    const distanceCols = Math.abs(
      predictedCol - Math.round(defenderColCenter)
    );

    // Word length = distance to center + half paddle width (floored)
    const extraLetters = halfPaddleUnits;
    const totalSteps = distanceCols + extraLetters;

    const { text } = buildPrompt(totalSteps);

    // Center-hit letter is the d-th letter typed → index d-1
    const centerIndex = Math.max(distanceCols - 1, 0);

    setCenterStepIndex(centerIndex);
    setDistanceColsState(distanceCols);
    distanceColsRef.current = distanceCols;

    setPromptText(text);
    setTypedText("");
    typedLengthRef.current = 0;

    setStatusMessage(
      `${capitalize(defender)} player: type the prompt. Each character moves the paddle one column.`
    );
  };

  // --- Paddle hit: bounce and speed up - using UNDERLINES for human side ---
  const handlePaddleBounce = (
    side: Side,
    x: number,
    y: number
  ): { x: number; y: number; vx: number; vy: number } => {
    // Speed adjustment (rally-only; scoring will reset later)
    const newTravelTime = Math.max(
      MIN_TRAVEL_TIME,
      parseFloat((travelTimeRef.current - TRAVEL_TIME_STEP).toFixed(2))
    );
    setTravelTime(newTravelTime);
    travelTimeRef.current = newTravelTime;

    const verticalSpeedMag = VERTICAL_DISTANCE / newTravelTime;
    const directionSign = side === "top" ? 1 : -1; // top hit -> ball goes down; bottom hit -> up

    const predictedCol = targetHitColRef.current;
    const distanceCols = distanceColsRef.current;
    const totalStepsPlanned = distanceCols + halfPaddleUnits;
    const typedStepsRaw = typedLengthRef.current;
    const typedSteps = Math.min(typedStepsRaw, totalStepsPlanned);

    let relCols: number;
    let xAfter: number;

    const useUnderlineLogic =
      !(
        gameMode === "single" && side === "top"
      ) && // never use underlines for bot
      predictedCol != null &&
      distanceCols > 0;

    if (useUnderlineLogic) {
      // Use UNDERLINES to compute where on the paddle the ball hits
      const centerColAtCollision = predictedCol + (typedSteps - distanceCols);
      const rawRel = predictedCol - centerColAtCollision;
      relCols = clamp(
        Math.round(rawRel),
        -halfPaddleUnits,
        halfPaddleUnits
      );

      // Snap ball X to exactly where it "hits" (the predicted column)
      xAfter = clamp(predictedCol / (BOARD_COLS - 1), 0, 1);
    } else {
      // Fallback to actual x if underline info missing or side is bot
      const paddleColCenter =
        side === "top"
          ? getPaddleCenterCol(topPaddleRef.current)
          : getPaddleCenterCol(bottomPaddleRef.current);
      const hitCol = Math.round(x * (BOARD_COLS - 1));
      relCols = clamp(
        hitCol - Math.round(paddleColCenter),
        -halfPaddleUnits,
        halfPaddleUnits
      );
      // Snap to the actual hit column
      xAfter = clamp(hitCol / (BOARD_COLS - 1), 0, 1);
    }

    const absRel = Math.abs(relCols);

    let vx: number;
    let vy: number;

    if (absRel === 0) {
      // CENTER HIT:
      // - slope = 3/1 (vertical/horizontal)
      // - vertical direction based on paddle side
      // - horizontal direction follows previous vx sign
      const oldVel = velocityRef.current;
      let horizSign = 0;
      if (oldVel.vx > 0) horizSign = 1;
      else if (oldVel.vx < 0) horizSign = -1;
      else horizSign = Math.random() < 0.5 ? -1 : 1;

      vy = verticalSpeedMag * directionSign;
      const vxMag = verticalSpeedMag / 3; // slope = rise/run = 3
      vx = vxMag * horizSign;
    } else {
      // Off-center: |offset|=1 -> slope 1; |offset|>=2 -> slope 1/2
      const slope = absRel === 1 ? 1 : 0.5; // rise/run
      vy = verticalSpeedMag * directionSign;
      const vxMag = verticalSpeedMag / slope;
      const horizontalSign = relCols > 0 ? 1 : -1; // +offset -> right, -offset -> left
      vx = vxMag * horizontalSign;
    }

    const attacker = side;
    const defender: Side = side === "top" ? "bottom" : "top";
    setCurrentAttacker(attacker);
    setCurrentDefender(defender);

    const newX = xAfter;
    const newY = y; // already snapped to paddle line by caller

    setupDefensePrompt(attacker, defender, newX, newY, vx, vy);
    setStatusMessage(`${capitalize(attacker)} hit the ball!`);

    return { x: newX, y: newY, vx, vy };
  };

const handlePoint = (
  winner: Side
): { x: number; y: number; vx: number; vy: number } => {
  const loser: Side = winner === "top" ? "bottom" : "top";

  // Update score
  setScores((prev) => ({
    ...prev,
    [winner]: prev[winner] + 1,
  }));

  // Reset travel time to default on every point
  setTravelTime(INITIAL_TRAVEL_TIME);
  travelTimeRef.current = INITIAL_TRAVEL_TIME;

  // End the round – do NOT auto-start the next one
  setStatusMessage(
    `${capitalize(winner)} scored! Press Start to serve the next round.`
  );

  setCurrentAttacker(winner);
  setCurrentDefender(loser);

  // Stop the game loop
  setIsRunning(false);
  isRunningRef.current = false;

  if (animationFrameIdRef.current !== null) {
    cancelAnimationFrame(animationFrameIdRef.current);
    animationFrameIdRef.current = null;
  }

  // Clear typing state / prompt for the new round
  setPromptText("");
  setTypedText("");
  typedLengthRef.current = 0;
  setTargetHitCol(null);
  targetHitColRef.current = null;
  setCenterStepIndex(0);
  setDistanceColsState(0);
  distanceColsRef.current = 0;

  // Park the ball in the center, not moving
  const x = 0.5;
  const y = 0.5;
  const vx = 0;
  const vy = 0;

  ballPosRef.current = { x, y };
  velocityRef.current = { vx, vy };
  setBallPos({ x, y });

  // Also clear any segment info so nothing keeps animating
  segmentStartPosRef.current = { x, y };
  segmentEndPosRef.current = { x, y };
  segmentDurationRef.current = 0;
  segmentStartTimeRef.current = null;
  currentEventRef.current = null;

  // We still return something for callers, but it won't be used
  return { x, y, vx, vy };
};


  // --- Uses UNDERLINES (for human) or geometry (for bot) to decide hit vs score ---
  const handlePaddleRegion = (
    side: Side,
    x: number,
    y: number,
    vx: number,
    vy: number
  ): { x: number; y: number; vx: number; vy: number } => {
    // Snap ball to paddle line
    y =
      side === "top"
        ? TOP_PADDLE_Y + BALL_RADIUS
        : BOTTOM_PADDLE_Y - BALL_RADIUS;

    const predictedCol = targetHitColRef.current;
    const distanceCols = distanceColsRef.current;
    const totalStepsPlanned = distanceCols + halfPaddleUnits;
    const typedStepsRaw = typedLengthRef.current;
    const typedSteps = Math.min(typedStepsRaw, totalStepsPlanned);

    const isBotSide = gameMode === "single" && side === "top";

    if (!isBotSide && predictedCol != null && distanceCols > 0) {
      // HUMAN defender side: use underlines as the *true* paddle position
      const centerColAtCollision = predictedCol + (typedSteps - distanceCols);
      const minCol = centerColAtCollision - halfPaddleUnits;
      const maxCol = centerColAtCollision + halfPaddleUnits;

      const isHit = predictedCol >= minCol && predictedCol <= maxCol;

      if (isHit) {
        // Hit: let handlePaddleBounce figure out the new angle,
        // and snap the ball to the exact hit column.
        return handlePaddleBounce(side, x, y);
      } else {
        // Miss: other side scores, regardless of actual ball.x
        const winner: Side = side === "top" ? "bottom" : "top";
        return handlePoint(winner);
      }
    }

    // BOT side or missing underline data: use actual paddle geometry
    const paddleCol =
      side === "top" ? topPaddleRef.current : bottomPaddleRef.current;
    const { minX, maxX } = getPaddleBoundsNorm(paddleCol);

    if (x >= minX && x <= maxX) {
      return handlePaddleBounce(side, x, y);
    } else {
      const winner: Side = side === "top" ? "bottom" : "top";
      return handlePoint(winner);
    }
  };

  // --- Bot logic: moves top paddle toward ball based on difficulty ---
//   const updateBot = (
//     dt: number,
//     x: number,
//     y: number,
//     vx: number,
//     vy: number
//   ) => {
//     if (gameMode !== "single") return;
//     if (!isRunningRef.current) return;

//     // Only care when ball is moving towards the top paddle
//     if (vy >= 0) return;

//     botMoveAccumulatorRef.current += dt;
//     const settings = BOT_SETTINGS[botDifficultyRef.current];

//     while (botMoveAccumulatorRef.current >= settings.moveInterval) {
//       botMoveAccumulatorRef.current -= settings.moveInterval;

//       setTopPaddleCol((prev) => {
//         const desiredCol = Math.round(x * (BOARD_COLS - 1));
//         let error = desiredCol - prev;
//         if (error === 0) return prev;

//         let step = error > 0 ? 1 : -1;

//         // chance to move the wrong way
//         if (Math.random() < settings.mistakeChance) {
//           step = -step;
//         }

//         return prev + step;
//       });
//     }
//   };

  // --- PLAN NEXT SEGMENT (from current x,y,vx,vy to next wall or paddle line) ---
  const planNextSegment = (startX: number, startY: number, vx: number, vy: number) => {
    const events: { t: number; type: SegmentEventType }[] = [];
    const EPS = 1e-6;

    // Side walls
    if (vx < 0) {
      const t = (BALL_RADIUS - startX) / vx; // vx < 0
      if (t > EPS) events.push({ t, type: "wall-left" });
    }
    if (vx > 0) {
      const t = ((1 - BALL_RADIUS) - startX) / vx;
      if (t > EPS) events.push({ t, type: "wall-right" });
    }

    // Paddles (horizontal lines)
    const topLine = TOP_PADDLE_Y + BALL_RADIUS;
    const bottomLine = BOTTOM_PADDLE_Y - BALL_RADIUS;

    if (vy < 0) {
      const t = (topLine - startY) / vy; // vy < 0
      if (t > EPS) events.push({ t, type: "paddle-top" });
    }
    if (vy > 0) {
      const t = (bottomLine - startY) / vy;
      if (t > EPS) events.push({ t, type: "paddle-bottom" });
    }

    if (events.length === 0) {
      // No events => don't move
      segmentDurationRef.current = 0;
      currentEventRef.current = null;
      return;
    }

    events.sort((a, b) => a.t - b.t);
    const next = events[0];

    const duration = next.t; // seconds
    const endX = startX + vx * duration;
    const endY = startY + vy * duration;

    segmentStartPosRef.current = { x: startX, y: startY };
    segmentEndPosRef.current = { x: endX, y: endY };
    segmentDurationRef.current = duration;
    currentEventRef.current = next;
  };

  // --- SMOOTH SEGMENT-BASED GAME LOOP (LERP BETWEEN ENDPOINTS ONLY) ---
  const gameLoop = (timestamp: number) => {
    // if (!isRunningRef.current) return;

    if (segmentStartTimeRef.current === null) {
      segmentStartTimeRef.current = timestamp;
    }

    const start = segmentStartPosRef.current;
    const end = segmentEndPosRef.current;
    const duration = segmentDurationRef.current;

    if (duration <= 0 || !currentEventRef.current) {
      // Nothing to animate
      setBallPos(ballPosRef.current);
    } else {
      const elapsed = (timestamp - segmentStartTimeRef.current) / 1000;
      const t = clamp(elapsed / duration, 0, 1);

      const x = start.x + (end.x - start.x) * t;
      const y = start.y + (end.y - start.y) * t;

      ballPosRef.current = { x, y };
      setBallPos({ x, y });

      if (elapsed >= duration) {
        // Segment finished: process event and plan the next one
        const evt = currentEventRef.current;
        let { vx, vy } = velocityRef.current;
        let newX = end.x;
        let newY = end.y;

        if (evt) {
          if (evt.type === "wall-left") {
            vx = Math.abs(vx);
          } else if (evt.type === "wall-right") {
            vx = -Math.abs(vx);
          } else if (evt.type === "paddle-top") {
            const res = handlePaddleRegion("top", newX, newY, vx, vy);
            newX = res.x;
            newY = res.y;
            vx = res.vx;
            vy = res.vy;
          } else if (evt.type === "paddle-bottom") {
            const res = handlePaddleRegion("bottom", newX, newY, vx, vy);
            newX = res.x;
            newY = res.y;
            vx = res.vx;
            vy = res.vy;
          }
        }

        // Update refs
        velocityRef.current = { vx, vy };
        ballPosRef.current = { x: newX, y: newY };
        setBallPos({ x: newX, y: newY });

        // Plan next segment from this new state
        planNextSegment(newX, newY, vx, vy);
        segmentStartTimeRef.current = timestamp;
      }
    }

if (isRunningRef.current) {
  animationFrameIdRef.current = requestAnimationFrame(gameLoop);
} else {
  animationFrameIdRef.current = null;
}
  };

  const startServe = (attacker: Side) => {
    setIsRunning(true);
    isRunningRef.current = true;
    botMoveAccumulatorRef.current = 0;

    const defender: Side = attacker === "top" ? "bottom" : "top";
    setCurrentAttacker(attacker);
    setCurrentDefender(defender);

    const paddleColCenter =
      attacker === "top"
        ? getPaddleCenterCol(topPaddleRef.current)
        : getPaddleCenterCol(bottomPaddleRef.current);

    const startX = getPaddleCenterXNorm(paddleColCenter);
    const startY =
      attacker === "top"
        ? TOP_PADDLE_Y + BALL_RADIUS
        : BOTTOM_PADDLE_Y - BALL_RADIUS;

    const verticalSpeedMag = VERTICAL_DISTANCE / travelTimeRef.current;
    const directionSign = attacker === "top" ? 1 : -1; // toward opposite side
    const vy = verticalSpeedMag * directionSign;

    const baseSlope = 1;
    const vxMag = verticalSpeedMag / baseSlope;
    const horizontalSign = Math.random() < 0.5 ? -1 : 1;
    const vx = vxMag * horizontalSign;

    ballPosRef.current = { x: startX, y: startY };
    velocityRef.current = { vx, vy };
    setBallPos({ x: startX, y: startY });

    // Set up defender prompt for this rally
    setupDefensePrompt(attacker, defender, startX, startY, vx, vy);

    // Plan first segment from serve
    planNextSegment(startX, startY, vx, vy);
    segmentStartTimeRef.current = null; // will be set on first frame

    if (animationFrameIdRef.current !== null) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }
    animationFrameIdRef.current = requestAnimationFrame((ts) => {
      // Reset bot accumulator and start time for consistency
      botMoveAccumulatorRef.current = 0;
      segmentStartTimeRef.current = ts;
      gameLoop(ts);
    });
  };

  const handleReset = () => {
    setScores({ top: 0, bottom: 0 });
    setTravelTime(INITIAL_TRAVEL_TIME);
    travelTimeRef.current = INITIAL_TRAVEL_TIME;

    setTopPaddleCol(0);
    setBottomPaddleCol(BOARD_COLS - 1);

    setPromptText("");
    setTypedText("");
    typedLengthRef.current = 0;
    setTargetHitCol(null);
    targetHitColRef.current = null;
    setCenterStepIndex(0);
    setDistanceColsState(0);
    distanceColsRef.current = 0;

    setStatusMessage(
      "Game reset. Press a Start button to serve. In 1 Player mode, you control the bottom paddle."
    );
    setIsRunning(false);
    isRunningRef.current = false;

    if (animationFrameIdRef.current !== null) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }

    ballPosRef.current = { x: 0.5, y: 0.5 };
    velocityRef.current = { vx: 0, vy: 0 };
    setBallPos({ x: 0.5, y: 0.5 });

    botMoveAccumulatorRef.current = 0;

    // Clear segment info
    segmentStartPosRef.current = { x: 0.5, y: 0.5 };
    segmentEndPosRef.current = { x: 0.5, y: 0.5 };
    segmentDurationRef.current = 0;
    segmentStartTimeRef.current = null;
    currentEventRef.current = null;
  };

  // --- Typing logic: move defender 1 column per correct char ---
  const moveDefenderPaddleOneStep = () => {
    const defender = defenderRef.current;

    // In single-player, the bot (top) never moves by typing
    if (gameMode === "single" && defender === "top") {
      return;
    }

    if (defender === "top") {
      setTopPaddleCol((prev) => {
        const target = targetHitColRef.current ?? prev;
        const step = target > prev ? 1 : target < prev ? -1 : 1;
        return prev + step;
      });
    } else {
      setBottomPaddleCol((prev) => {
        const target = targetHitColRef.current ?? prev;
        const step = target > prev ? 1 : target < prev ? -1 : 1;
        return prev + step;
      });
    }
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (!promptText || !isRunningRef.current) return;

    const key = event.key;
    const index = typedText.length;
    if (index >= promptText.length) return;

    const expectedChar = promptText[index];

    const lowerKey = key.toLowerCase();
    const isLetter = lowerKey >= "a" && lowerKey <= "z";
    const isSpace = key === " ";

    if (!isLetter && !isSpace) return;

    if (
      (isSpace && expectedChar === " ") ||
      (isLetter && expectedChar === lowerKey)
    ) {
      event.preventDefault();
      const newTyped = typedText + expectedChar;
      setTypedText(newTyped);
      typedLengthRef.current = newTyped.length;
      moveDefenderPaddleOneStep();

      if (newTyped.length === promptText.length) {
        setStatusMessage(
          `${capitalize(
            defenderRef.current
          )} finished the prompt. The paddle may have overshot or undershot—watch the bounce!`
        );
      }
    } else {
      // optional miss feedback
    }
  };

  const columnWidthPercent = 100 / BOARD_COLS;

  const getPaddleLeftPercent = (col: number) => {
    const centerCol = getPaddleCenterCol(col);
    const startCol = centerCol - PADDLE_WIDTH_COLS / 2;
    return (startCol / BOARD_COLS) * 100;
  };

  // Prompt render:
  //  - Only the NEXT letter to type is highlighted (bright).
  //  - Center-hit letter is green.
  //  - Underlines show current paddle span at predicted hit line.
  const renderPromptWithUnderlines = (text: string) => {
    if (!text) return null;

    const chars = text.split("");
    const totalStepsPlanned = distanceColsState + halfPaddleUnits;
    const typedSteps = Math.min(typedText.length, totalStepsPlanned);

    // Where is the paddle center *in character space* right now?
    const centerIdxNow =
      centerStepIndex - (distanceColsState - typedSteps); // can go left or right
    const startIdx = Math.round(centerIdxNow - halfPaddleUnits);
    const endIdx = Math.round(centerIdxNow + halfPaddleUnits);

    const activeIndex = typedText.length; // next letter to type

    return (
      <Box textAlign="center">
        <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
          Defender prompt:
        </Typography>
        <Box
          sx={{
            display: "inline-flex",
            flexWrap: "wrap",
            gap: 0.25,
            mt: 0.5,
          }}
        >
          {chars.map((ch, idx) => {
            const isCenter = idx === centerStepIndex;
            const isUnderlined = idx >= startIdx && idx <= endIdx;
            const isTyped = idx < typedText.length;
            const isActive = idx === activeIndex; // ONLY this one gets the "what to type" highlight

            const displayChar = ch === " " ? "·" : ch;

            return (
              <Box
                key={`${ch}-${idx}`}
                component="span"
                sx={{
                  fontFamily: "monospace",
                  fontSize: "1.4rem",
                  fontWeight: isCenter ? 800 : isActive ? 700 : 400,
                  color: isCenter
                    ? "rgb(34,197,94)" // center-hit letter
                    : isActive
                    ? "#f9fafb" // next letter to type
                    : "#9ca3af",
                  opacity: isTyped && !isCenter && !isActive ? 0.6 : 1,
                  textDecoration: isCenter ? "underline" : "none",
                  textUnderlineOffset: "4px",
                  borderBottom: isUnderlined
                    ? "2px solid rgba(248,250,252,0.95)"
                    : "2px solid transparent",
                }}
              >
                {displayChar}
              </Box>
            );
          })}
        </Box>
        <Typography
          variant="caption"
          sx={{ mt: 0.5, display: "block", color: "#9ca3af" }}
        >
          Bright character = next letter to type. Green letter = perfect
          center hit. Underlines show where the paddle will be when the ball
          reaches the predicted hit column.
        </Typography>
      </Box>
    );
  };

  return (
    <Box
      sx={{
        p: 2,
        bgcolor: "#020617", // dark mode background
        minHeight: "100vh",
      }}
    >
      <Paper
        elevation={3}
        sx={{
          maxWidth: 1000,
          mx: "auto",
          p: 3,
          bgcolor: "#0b1120", // dark card
          color: "#e5e7eb",
          borderRadius: 3,
          boxShadow: 4,
        }}
      >
        <Stack spacing={2}>
          <Typography
            variant="h4"
            align="center"
            sx={{ color: "#f9fafb" }}
          >
            Typing Pong
          </Typography>

          {/* Mode & difficulty controls */}
          <Stack
            direction="row"
            spacing={2}
            justifyContent="space-between"
            alignItems="center"
          >
            <ToggleButtonGroup
              value={gameMode}
              exclusive
              onChange={(_, val: GameMode | null) => {
                if (val) setGameMode(val);
              }}
              size="small"
              disabled={isRunning}
            >
              <ToggleButton value="single">1 Player</ToggleButton>
              <ToggleButton value="two">2 Players</ToggleButton>
            </ToggleButtonGroup>

            {gameMode === "single" && (
              <FormControl
                size="small"
                sx={{ minWidth: 160 }}
                disabled={isRunning}
              >
                <InputLabel id="bot-difficulty-label">
                  Bot Difficulty
                </InputLabel>
                <Select
                  labelId="bot-difficulty-label"
                  label="Bot Difficulty"
                  value={botDifficulty}
                  onChange={(e) =>
                    setBotDifficulty(e.target.value as BotDifficulty)
                  }
                  sx={{
                    color: "#e5e7eb",
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#4b5563",
                    },
                    "&:hover .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#e5e7eb",
                    },
                    "& .MuiSvgIcon-root": {
                      color: "#e5e7eb",
                    },
                  }}
                >
                  <MenuItem value="easy">Easy</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="hard">Hard</MenuItem>
                </Select>
              </FormControl>
            )}
          </Stack>

          <Stack direction="row" justifyContent="space-between">
            <Typography variant="subtitle1">
              Top Score: <strong>{scores.top}</strong>
              {gameMode === "single" && " (Bot)"}
            </Typography>
            <Typography variant="subtitle1">
              Bottom Score: <strong>{scores.bottom}</strong>
              {gameMode === "single" && " (You)"}
            </Typography>
          </Stack>

          {/* Main area: the field */}
          <Stack direction="row" spacing={2} alignItems="flex-start">
            {/* Game Field */}
            <Box
              sx={{
                position: "relative",
                flex: 2,
                height: 360,
                bgcolor: "#020617",
                borderRadius: 2,
                border: "2px solid #4b5563",
                overflow: "hidden",
              }}
            >
              {/* Grid vertical lines */}
              {Array.from({ length: BOARD_COLS + 1 }).map((_, col) => (
                <Box
                  key={col}
                  sx={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: `${(col / BOARD_COLS) * 100}%`,
                    width: "1px",
                    bgcolor: "rgba(148, 163, 184, 0.15)",
                  }}
                />
              ))}

              {/* Column labels */}
              {Array.from({ length: BOARD_COLS }).map((_, col) => (
                <Box
                  key={`label-${col}`}
                  sx={{
                    position: "absolute",
                    bottom: 4,
                    left: `${((col + 0.5) / BOARD_COLS) * 100}%`,
                    transform: "translateX(-50%)",
                    fontSize: "0.6rem",
                    color: "#9ca3af",
                  }}
                >
                  {col}
                </Box>
              ))}

              {/* Y labels */}
              <Box
                sx={{
                  position: "absolute",
                  left: 4,
                  top: `${TOP_PADDLE_Y * 100}%`,
                  transform: "translateY(-50%)",
                  fontSize: "0.6rem",
                  color: "#9ca3af",
                }}
              >
                y={TOP_PADDLE_Y}
              </Box>
              <Box
                sx={{
                  position: "absolute",
                  left: 4,
                  top: `${BOTTOM_PADDLE_Y * 100}%`,
                  transform: "translateY(-50%)",
                  fontSize: "0.6rem",
                  color: "#9ca3af",
                }}
              >
                y={BOTTOM_PADDLE_Y}
              </Box>

              {/* Horizontal bounce lines */}
              <Box
                sx={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: `${TOP_PADDLE_Y * 100}%`,
                  height: 2,
                  bgcolor: "rgba(96, 165, 250, 0.5)",
                }}
              />
              <Box
                sx={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: `${BOTTOM_PADDLE_Y * 100}%`,
                  height: 2,
                  bgcolor: "rgba(96, 165, 250, 0.5)",
                }}
              />

              {/* Center line */}
              <Box
                sx={{
                  position: "absolute",
                  left: "50%",
                  top: 0,
                  bottom: 0,
                  width: "2px",
                  bgcolor: "rgba(148, 163, 184, 0.3)",
                }}
              />

              {/* Top paddle */}
              <Box
                sx={{
                  position: "absolute",
                  top: "4%",
                  height: 10,
                  width: `${PADDLE_WIDTH_COLS * columnWidthPercent}%`,
                  left: `${getPaddleLeftPercent(topPaddleCol)}%`,
                  bgcolor: "#fbbf24",
                  borderRadius: 999,
                  boxShadow: 2,
                }}
              />

              {/* Bottom paddle */}
              <Box
                sx={{
                  position: "absolute",
                  bottom: "4%",
                  height: 10,
                  width: `${PADDLE_WIDTH_COLS * columnWidthPercent}%`,
                  left: `${getPaddleLeftPercent(bottomPaddleCol)}%`,
                  bgcolor: "#22c55e",
                  borderRadius: 999,
                  boxShadow: 2,
                }}
              />

              {/* Ball */}
              <Box
                sx={{
                  position: "absolute",
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  bgcolor: "#38bdf8",
                  left: `${ballPos.x * 100}%`,
                  top: `${ballPos.y * 100}%`,
                  transform: "translate(-50%, -50%)",
                  boxShadow: "0 0 12px rgba(56, 189, 248, 0.8)",
                }}
              />
            </Box>
          </Stack>

          {/* Typing control */}
          <Stack spacing={1}>
            <Typography variant="body1" align="center">
              {statusMessage}
            </Typography>

            {promptText && renderPromptWithUnderlines(promptText)}

            <TextField
              label="Type here"
              variant="outlined"
              value={typedText}
              onKeyDown={handleKeyDown}
              InputProps={{ readOnly: true }}
              helperText={
                isRunning
                  ? "Type letters and spaces exactly as shown. Each character moves the defending paddle by one column."
                  : "Press a Start button, then click here and type to defend."
              }
              sx={{
                maxWidth: 400,
                mx: "auto",
                "& .MuiInputBase-root": {
                  color: "#e5e7eb",
                },
                "& .MuiInputLabel-root": {
                  color: "#9ca3af",
                },
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#4b5563",
                },
                "&:hover .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#e5e7eb",
                },
                "& .MuiFormHelperText-root": {
                  color: "#9ca3af",
                },
              }}
            />
          </Stack>

          <Stack direction="row" justifyContent="center" spacing={2}>
            <Button
              variant="contained"
              onClick={() => startServe("bottom")}
              disabled={isRunning}
            >
              Start (Bottom serves)
            </Button>
            <Button
              variant="outlined"
              onClick={() => startServe("top")}
              disabled={isRunning}
            >
              Start (Top serves)
            </Button>
            <Button
              variant="text"
              onClick={handleReset}
              sx={{ color: "#e5e7eb" }}
            >
              Reset Game
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
};

export default TypingPong;
