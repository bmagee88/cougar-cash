// TypingPong.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
  MenuItem,
} from "@mui/material";

const DEFAULT_BOARD_COLS = 20;
const DEFAULT_PADDLE_WIDTH_COLS = 5; // must be odd
const DEFAULT_STARTING_SPEED = 5; // seconds for ball to travel between paddles

// Normalized coordinates (0..1)
const TOP_PADDLE_Y = 0.1;
const BOTTOM_PADDLE_Y = 0.9;
const BALL_RADIUS = 0.02;
const VERTICAL_DISTANCE = BOTTOM_PADDLE_Y - TOP_PADDLE_Y;

type Side = "top" | "bottom";
type Phase = "preServe" | "rally" | "gameOver";

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
  1: ["a", "i"],
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function capitalize(side: Side): string {
  return side === "top" ? "Top" : "Bottom";
}

/**
 * Build a multi-word prompt whose total character count (including spaces)
 * is EXACTLY targetSteps if possible, using random word lengths.
 * Falls back to "at least targetSteps" if no exact combo is found.
 */
function buildPrompt(targetSteps: number): { text: string; totalChars: number } {
  const steps = Math.max(1, targetSteps);
  const lengths = Object.keys(WORD_BANK)
    .map(Number)
    .filter((len) => WORD_BANK[len] && WORD_BANK[len]!.length > 0);

  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function backtrack(remaining: number, isFirst: boolean): string[] | null {
    if (remaining === 0) return [];

    const shuffledLengths = shuffle(lengths);
    for (const len of shuffledLengths) {
      const cost = isFirst ? len : len + 1; // include space after first word
      if (cost > remaining) continue;

      const bank = WORD_BANK[len];
      if (!bank || bank.length === 0) continue;

      const word = bank[Math.floor(Math.random() * bank.length)];
      if (cost === remaining) {
        return [word];
      }

      const rest = backtrack(remaining - cost, false);
      if (rest) return [word, ...rest];
    }
    return null;
  }

  let words: string[] | null = null;
  for (let attempt = 0; attempt < 25 && !words; attempt++) {
    words = backtrack(steps, true);
  }

  if (words) {
    const text = words.join(" ");
    return { text, totalChars: text.length };
  }

  // Fallback: old "at least steps" behavior using longest words
  let text = "";
  let totalChars = 0;
  while (totalChars < steps) {
    const remaining = steps - totalChars;
    const maxLen = Math.min(MAX_WORD_LENGTH, remaining);
    const len = maxLen;
    const bank = WORD_BANK[len] ?? WORD_BANK[MAX_WORD_LENGTH];
    const word = bank[Math.floor(Math.random() * bank.length)];

    if (text.length > 0) {
      text += " ";
      totalChars += 1;
    }
    text += word;
    totalChars += word.length;
  }
  return { text, totalChars };
}

/**
 * Pick a random "serve word" (use 4–7 letter words).
 */
function getRandomServeWord(): string {
  const lengths = [4, 5, 6, 7];
  const len = lengths[Math.floor(Math.random() * lengths.length)];
  const bank = WORD_BANK[len] ?? WORD_BANK[4];
  return bank[Math.floor(Math.random() * bank.length)];
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
  // Board / paddle / speed settings (menu)
  const [boardCols, setBoardCols] = useState<number>(DEFAULT_BOARD_COLS);
  const [paddleWidthCols, setPaddleWidthCols] =
    useState<number>(DEFAULT_PADDLE_WIDTH_COLS);
  const [startingSpeed, setStartingSpeed] =
    useState<number>(DEFAULT_STARTING_SPEED);
  const [maxPoints, setMaxPoints] = useState<number | null>(null); // null = no limit

  // Treat paddleCol as the *center column* (can overhang the walls)
  const [topPaddleCol, setTopPaddleCol] = useState<number>(0);
  const [bottomPaddleCol, setBottomPaddleCol] = useState<number>(
    DEFAULT_BOARD_COLS - 1
  );

  const [ballPos, setBallPos] = useState<{ x: number; y: number }>({
    x: 0.5,
    y: 0.5,
  });

  const [travelTime, setTravelTime] =
    useState<number>(DEFAULT_STARTING_SPEED);
  const [scores, setScores] = useState<Scores>({ top: 0, bottom: 0 });

  // Typing prompt state (defender)
  const [promptText, setPromptText] = useState<string>("");
  const [typedText, setTypedText] = useState<string>("");

  // Serve-phase typing
  const [serveWord, setServeWord] = useState<string>(getRandomServeWord());
  const [serveText, setServeText] = useState<string>("");
  const [serveTimeLeft, setServeTimeLeft] = useState<number>(30);

  // Index of the character that corresponds to a *center hit*
  const [centerStepIndex, setCenterStepIndex] =
    useState<number>(0);
  const [distanceColsState, setDistanceColsState] =
    useState<number>(0);

  const [statusMessage, setStatusMessage] = useState<string>(
    "Bottom serves first. Use arrow keys to position your paddle, type the serve word, and press Enter to launch."
  );

  const [currentAttacker, setCurrentAttacker] =
    useState<Side>("bottom");
  const [currentDefender, setCurrentDefender] =
    useState<Side>("top");
  const [targetHitCol, setTargetHitCol] =
    useState<number | null>(null);

  const [phase, setPhase] = useState<Phase>("preServe");
  const phaseRef = useRef<Phase>("preServe");

  const [isRunning, setIsRunning] = useState<boolean>(false);

  // Refs for loop and kinematics
  const ballPosRef = useRef(ballPos);
  const velocityRef = useRef<{ vx: number; vy: number }>({
    vx: 0,
    vy: 0,
  });

  const topPaddleRef = useRef(topPaddleCol);
  const bottomPaddleRef = useRef(bottomPaddleCol);

  const travelTimeRef = useRef<number>(DEFAULT_STARTING_SPEED);
  const attackerRef = useRef<Side>("bottom");
  const defenderRef = useRef<Side>("top");

  const isRunningRef = useRef<boolean>(false);
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

  // Input refs for auto-focus
  const defenseInputRef = useRef<HTMLInputElement | null>(null);
  const serveInputRef = useRef<HTMLInputElement | null>(null);

  // --- derived values based on settings ---
  const halfPaddleUnits = Math.floor(paddleWidthCols / 2);
  const paddleWidthNorm = paddleWidthCols / boardCols;
  const columnWidthPercent = 100 / boardCols;

  // --- sync refs with state ---
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
    phaseRef.current = phase;
  }, [phase]);

  // Focus defender input when rally starts
  useEffect(() => {
    if (phase === "rally") {
      setTimeout(() => {
        defenseInputRef.current?.focus();
      }, 0);
    }
  }, [phase]);

  // Focus serve input whenever we enter preServe (e.g., after a point)
  useEffect(() => {
    if (phase === "preServe") {
      setTimeout(() => {
        serveInputRef.current?.focus();
      }, 0);
    }
  }, [phase]);

  useEffect(() => {
    return () => {
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, []);

  // --- helper: center/paddle utilities ---
  const getPaddleCenterCol = (col: number) => col; // allow overhang

  const getPaddleCenterXNorm = (col: number) => {
    if (boardCols <= 1) return 0.5;
    const centerCol = getPaddleCenterCol(col);
    return centerCol / (boardCols - 1);
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
        distanceColsFallback + Math.floor(paddleWidthCols / 2);
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
    const predictedCol = Math.round(
      predictedXNorm * (boardCols - 1)
    );
    setTargetHitCol(predictedCol);
    targetHitColRef.current = predictedCol;

    const distanceCols = Math.abs(
      predictedCol - Math.round(defenderColCenter)
    );

    // Word steps = distance to center + half paddle width (floored)
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
      `${capitalize(
        defender
      )} player: type the prompt. Each character moves the paddle one column.`
    );
  };

  // --- Paddle hit: bounce and speed up - using UNDERLINES ---
  const handlePaddleBounce = (
    side: Side,
    x: number,
    y: number
  ): { x: number; y: number; vx: number; vy: number } => {
    // Speed adjustment (rally-only; scoring will reset later)
    const minTime = 2;
    const newTravelTime = Math.max(
      minTime,
      parseFloat((travelTimeRef.current - 0.1).toFixed(2))
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

    if (predictedCol != null && distanceCols > 0) {
      // Use UNDERLINES to compute where on the paddle the ball hits
      const centerColAtCollision = predictedCol + (typedSteps - distanceCols);
      const rawRel = predictedCol - centerColAtCollision;
      relCols = clamp(
        Math.round(rawRel),
        -halfPaddleUnits,
        halfPaddleUnits
      );

      // Snap ball X to exactly where it "hits" (the predicted column)
      xAfter = clamp(predictedCol / (boardCols - 1), 0, 1);
    } else {
      // Fallback to actual x if underline info missing
      const paddleColCenter =
        side === "top"
          ? getPaddleCenterCol(topPaddleRef.current)
          : getPaddleCenterCol(bottomPaddleRef.current);
      const hitCol = Math.round(x * (boardCols - 1));
      relCols = clamp(
        hitCol - Math.round(paddleColCenter),
        -halfPaddleUnits,
        halfPaddleUnits
      );
      // Snap to the actual hit column
      xAfter = clamp(hitCol / (boardCols - 1), 0, 1);
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

  const resetDefensePromptState = () => {
    setPromptText("");
    setTypedText("");
    typedLengthRef.current = 0;
    setTargetHitCol(null);
    targetHitColRef.current = null;
    setCenterStepIndex(0);
    setDistanceColsState(0);
    distanceColsRef.current = 0;
  };

  const stopAnimation = () => {
    setIsRunning(false);
    isRunningRef.current = false;
    if (animationFrameIdRef.current !== null) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
  };

  // --- Called when a point is scored ---
  const handlePoint = (winner: Side): void => {
    const loser: Side = winner === "top" ? "bottom" : "top";

    stopAnimation();

    // Reset travel time to starting speed on every point
    setTravelTime(startingSpeed);
    travelTimeRef.current = startingSpeed;

    resetDefensePromptState();

    setScores((prev) => {
      const updated: Scores = {
        ...prev,
        [winner]: prev[winner] + 1,
      };
      const newScore = updated[winner];
      const reachedLimit =
        maxPoints !== null && newScore >= maxPoints;

      if (reachedLimit) {
        setStatusMessage(
          `${capitalize(
            winner
          )} wins ${updated.top}-${updated.bottom}! Press Reset to play again.`
        );
        setPhase("gameOver");
        phaseRef.current = "gameOver";
      } else {
        setCurrentAttacker(winner);
        setCurrentDefender(loser);
        beginPreServe(winner);
      }

      return updated;
    });
  };

  // --- Uses UNDERLINES to decide hit vs score ---
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

    if (predictedCol != null && distanceCols > 0) {
      // Use underlines as the *true* paddle position
      const centerColAtCollision = predictedCol + (typedSteps - distanceCols);
      const minCol = centerColAtCollision - halfPaddleUnits;
      const maxCol = centerColAtCollision + halfPaddleUnits;

      const isHit = predictedCol >= minCol && predictedCol <= maxCol;

      if (isHit) {
        // Hit: bounce with underline logic
        return handlePaddleBounce(side, x, y);
      } else {
        // Miss: other side scores, regardless of actual ball.x
        const winner: Side = side === "top" ? "bottom" : "top";
        handlePoint(winner);
        return { x, y, vx: 0, vy: 0 };
      }
    }

    // Fallback: use actual paddle geometry
    const paddleCol =
      side === "top" ? topPaddleRef.current : bottomPaddleRef.current;
    const { minX, maxX } = getPaddleBoundsNorm(paddleCol);

    if (x >= minX && x <= maxX) {
      return handlePaddleBounce(side, x, y);
    } else {
      const winner: Side = side === "top" ? "bottom" : "top";
      handlePoint(winner);
      return { x, y, vx: 0, vy: 0 };
    }
  };

  // --- PLAN NEXT SEGMENT (from current x,y,vx,vy to next wall or paddle line) ---
  const planNextSegment = (
    startX: number,
    startY: number,
    vx: number,
    vy: number
  ) => {
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
    if (!isRunningRef.current) {
      animationFrameIdRef.current = null;
      return;
    }

    const start = segmentStartPosRef.current;
    const end = segmentEndPosRef.current;
    const duration = segmentDurationRef.current;

    if (duration <= 0 || !currentEventRef.current) {
      // Nothing to animate
      setBallPos(ballPosRef.current);
    } else {
      if (segmentStartTimeRef.current === null) {
        segmentStartTimeRef.current = timestamp;
      }

      const elapsed =
        (timestamp - segmentStartTimeRef.current) / 1000;
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

        // If a point was scored, isRunningRef may now be false
        if (!isRunningRef.current) {
          animationFrameIdRef.current = null;
          return;
        }

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

  // --- Launch a serve from the current attacker ---
  const launchServe = (attacker: Side) => {
    if (phaseRef.current === "gameOver") return;

    const defender: Side = attacker === "top" ? "bottom" : "top";

    setPhase("rally");
    phaseRef.current = "rally";

    setCurrentAttacker(attacker);
    setCurrentDefender(defender);

    // Ball starts at attacker's paddle center
    const paddleColCenter =
      attacker === "top"
        ? getPaddleCenterCol(topPaddleRef.current)
        : getPaddleCenterCol(bottomPaddleRef.current);

    const startX = getPaddleCenterXNorm(paddleColCenter);
    const startY =
      attacker === "top"
        ? TOP_PADDLE_Y + BALL_RADIUS
        : BOTTOM_PADDLE_Y - BALL_RADIUS;

    const verticalSpeedMag =
      VERTICAL_DISTANCE / travelTimeRef.current;
    const directionSign = attacker === "top" ? 1 : -1; // toward opposite side
    const vy = verticalSpeedMag * directionSign;

    const baseSlope = 1;
    const vxMag = verticalSpeedMag / baseSlope;
    const horizontalSign = Math.random() < 0.5 ? -1 : 1;
    const vx = vxMag * horizontalSign;

    ballPosRef.current = { x: startX, y: startY };
    velocityRef.current = { vx, vy };
    setBallPos({ x: startX, y: startY });

    // Defender prompt
    setupDefensePrompt(attacker, defender, startX, startY, vx, vy);

    // Clear serve UI
    setServeText("");
    setServeTimeLeft(0);

    // Plan first segment from serve
    planNextSegment(startX, startY, vx, vy);
    segmentStartTimeRef.current = null;

    // Start animation
    setIsRunning(true);
    isRunningRef.current = true;

    if (animationFrameIdRef.current !== null) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }
    animationFrameIdRef.current = requestAnimationFrame(gameLoop);
  };

  // --- Move into pre-serve phase for a given attacker ---
  const beginPreServe = (attacker: Side) => {
    if (phaseRef.current === "gameOver") return;

    stopAnimation();
    resetDefensePromptState();

    setPhase("preServe");
    phaseRef.current = "preServe";

    setCurrentAttacker(attacker);
    setCurrentDefender(attacker === "top" ? "bottom" : "top");
    attackerRef.current = attacker;
    defenderRef.current = attacker === "top" ? "bottom" : "top";

    // Ball parked at attacker's paddle line
    const paddleColCenter =
      attacker === "top"
        ? getPaddleCenterCol(topPaddleRef.current)
        : getPaddleCenterCol(bottomPaddleRef.current);
    const x = getPaddleCenterXNorm(paddleColCenter);
    const y =
      attacker === "top"
        ? TOP_PADDLE_Y + BALL_RADIUS
        : BOTTOM_PADDLE_Y - BALL_RADIUS;

    ballPosRef.current = { x, y };
    velocityRef.current = { vx: 0, vy: 0 };
    setBallPos({ x, y });

    segmentStartPosRef.current = { x, y };
    segmentEndPosRef.current = { x, y };
    segmentDurationRef.current = 0;
    segmentStartTimeRef.current = null;
    currentEventRef.current = null;

    // New serve word & countdown
    const word = getRandomServeWord();
    setServeWord(word);
    setServeText("");
    setServeTimeLeft(30);

    setStatusMessage(
      `${capitalize(
        attacker
      )} to serve. Use arrow keys to move your paddle, type the word, and press Enter to launch.`
    );
  };

  // --- Serve countdown timer (30s) ---
  useEffect(() => {
    if (phase !== "preServe") return;

    setServeTimeLeft(30);
    let cancelled = false;

    const id = window.setInterval(() => {
      if (cancelled) return;
      setServeTimeLeft((prev) => {
        // If phase changed, stop
        if (phaseRef.current !== "preServe") {
          window.clearInterval(id);
          return prev;
        }

        if (prev <= 1) {
          window.clearInterval(id);
          // Auto-launch if not already running
          if (!isRunningRef.current) {
            launchServe(attackerRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // --- Keyboard: attacker moves paddle with arrow keys during pre-serve ---
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (phaseRef.current !== "preServe") return;

      // Arrow keys move the ATTACKER's paddle
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const attacker = attackerRef.current;

        const delta = e.key === "ArrowLeft" ? -1 : 1;

        if (attacker === "top") {
          setTopPaddleCol((prev) => prev + delta);
        } else {
          setBottomPaddleCol((prev) => prev + delta);
        }
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // --- Typing logic: move defender 1 column per correct char ---
  const moveDefenderPaddleOneStep = () => {
    const defender = defenderRef.current;

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

  // Defender typing
  const handleDefenseKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (phaseRef.current !== "rally") return;
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

  // Serve typing
  const handleServeKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (phaseRef.current !== "preServe") return;

    if (event.key === "Enter") {
      event.preventDefault();
      // Require at least one character typed before serving
      if (serveText.trim().length === 0) {
        setStatusMessage(
          "Type at least one letter of the word before serving."
        );
        return;
      }
      if (!isRunningRef.current) {
        launchServe(attackerRef.current);
      }
    }
  };

  const getPaddleLeftPercent = (col: number) => {
    const centerCol = getPaddleCenterCol(col);
    const startCol = centerCol - paddleWidthCols / 2;
    return (startCol / boardCols) * 100;
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
            const isActive = idx === activeIndex; // ONLY this one gets the "next" highlight

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

  const handleReset = () => {
    stopAnimation();
    setScores({ top: 0, bottom: 0 });
    setTravelTime(startingSpeed);
    travelTimeRef.current = startingSpeed;

    setTopPaddleCol(0);
    setBottomPaddleCol(boardCols - 1);

    resetDefensePromptState();

    setPhase("preServe");
    phaseRef.current = "preServe";
    setStatusMessage(
      "Bottom serves first. Use arrow keys to position your paddle, type the serve word, and press Enter to launch."
    );
    beginPreServe("bottom");
  };

  // --- Settings handlers (side menu) ---
  const handleBoardColsChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const raw = parseInt(event.target.value, 10);
    if (Number.isNaN(raw)) return;
    const val = clamp(raw, 8, 50);
    setBoardCols(val);
    // keep paddles roughly at ends
    setTopPaddleCol(0);
    setBottomPaddleCol(val - 1);
  };

  const handlePaddleWidthChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const raw = parseInt(event.target.value, 10);
    if (Number.isNaN(raw)) return;
    // force odd width, at least 1, at most boardCols
    let val = clamp(raw, 1, boardCols);
    if (val % 2 === 0) val += 1;
    if (val > boardCols) val = boardCols - 1; // still odd
    setPaddleWidthCols(val);
  };

  const handleStartingSpeedChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const raw = parseFloat(event.target.value);
    if (Number.isNaN(raw)) return;
    const val = clamp(raw, 1, 10); // 1–10 seconds
    setStartingSpeed(val);
  };

  // Kick off initial pre-serve for bottom on first mount
  useEffect(() => {
    beginPreServe("bottom");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          maxWidth: 1100,
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

          <Stack direction="row" justifyContent="space-between">
            <Typography variant="subtitle1">
              Top Score: <strong>{scores.top}</strong>
            </Typography>
            <Typography variant="subtitle1">
              Bottom Score: <strong>{scores.bottom}</strong>
            </Typography>
          </Stack>

          {/* Main area: settings + field */}
          <Stack direction="row" spacing={2} alignItems="flex-start">
            {/* Settings side menu */}
            <Box
              sx={{
                width: 260,
                p: 2,
                bgcolor: "#020617",
                borderRadius: 2,
                border: "1px solid #4b5563",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <Typography variant="subtitle1">
                Game Settings
              </Typography>
              <TextField
                label="Columns"
                type="number"
                size="small"
                value={boardCols}
                onChange={handleBoardColsChange}
                disabled={phase === "rally"}
                sx={{
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
                }}
                inputProps={{ min: 8, max: 50 }}
              />
              <TextField
                label="Paddle width"
                type="number"
                size="small"
                value={paddleWidthCols}
                onChange={handlePaddleWidthChange}
                disabled={phase === "rally"}
                sx={{
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
                }}
                inputProps={{ min: 1, max: boardCols }}
              />
              <TextField
                label="Starting travel time (s)"
                type="number"
                size="small"
                value={startingSpeed}
                onChange={handleStartingSpeedChange}
                disabled={phase === "rally"}
                sx={{
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
                }}
                inputProps={{ step: 0.5, min: 1, max: 10 }}
              />
              <TextField
                select
                label="Point max"
                size="small"
                value={maxPoints === null ? "infinity" : String(maxPoints)}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "infinity") setMaxPoints(null);
                  else setMaxPoints(parseInt(val, 10));
                }}
                disabled={phase === "rally"}
                sx={{
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
                }}
              >
                {[3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => (
                  <MenuItem key={n} value={String(n)}>
                    {n} points
                  </MenuItem>
                ))}
                <MenuItem value="infinity">No limit</MenuItem>
              </TextField>
              <Typography
                variant="caption"
                sx={{ color: "#9ca3af" }}
              >
                Changes apply on new serves. Reset to restart with
                updated settings.
              </Typography>
            </Box>

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
              {Array.from({ length: boardCols + 1 }).map((_, col) => (
                <Box
                  key={col}
                  sx={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: `${(col / boardCols) * 100}%`,
                    width: "1px",
                    bgcolor: "rgba(148, 163, 184, 0.15)",
                  }}
                />
              ))}

              {/* Column labels */}
              {Array.from({ length: boardCols }).map((_, col) => (
                <Box
                  key={`label-${col}`}
                  sx={{
                    position: "absolute",
                    bottom: 4,
                    left: `${((col + 0.5) / boardCols) * 100}%`,
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
                  width: `${paddleWidthCols * columnWidthPercent}%`,
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
                  width: `${paddleWidthCols * columnWidthPercent}%`,
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

          {/* Typing controls */}
          <Stack spacing={1}>
            <Typography variant="body1" align="center">
              {statusMessage}
            </Typography>

            {phase === "preServe" && (
              <Box textAlign="center">
                <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
                  Serve word (
                  {capitalize(currentAttacker)} serves in{" "}
                  {serveTimeLeft}s):
                </Typography>
                <Typography
                  variant="h6"
                  sx={{ mb: 1, color: "#fbbf24" }}
                >
                  {serveWord}
                </Typography>
                <TextField
                  label="Type to get ready, then press Enter to serve"
                  variant="outlined"
                  value={serveText}
                  onChange={(e) => setServeText(e.target.value)}
                  onKeyDown={handleServeKeyDown}
                  inputRef={serveInputRef}
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
                  helperText="Use Arrow keys to position your paddle while you type."
                />
              </Box>
            )}

            {phase === "rally" && (
              <>
                {promptText && renderPromptWithUnderlines(promptText)}
                <TextField
                  label="Defender typing"
                  variant="outlined"
                  value={typedText}
                  onKeyDown={handleDefenseKeyDown}
                  inputRef={defenseInputRef}
                  InputProps={{ readOnly: true }}
                  helperText={
                    isRunning
                      ? "Type letters and spaces exactly as shown. Each character moves the defending paddle by one column."
                      : "Wait for the serve to launch."
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
              </>
            )}
          </Stack>

          <Stack direction="row" justifyContent="center" spacing={2}>
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
