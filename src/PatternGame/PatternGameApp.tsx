import AddIcon from "@mui/icons-material/Add";
import CasinoIcon from "@mui/icons-material/Casino";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DirectionsBoatIcon from "@mui/icons-material/DirectionsBoat";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LogoutIcon from "@mui/icons-material/Logout";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  createTheme,
  CssBaseline,
  Divider,
  FormControlLabel,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  ThemeProvider,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useCallback, useEffect, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import {
  Link as RouterLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  closePatternSession,
  createPatternParticipant,
  createPatternSession,
  getPatternEventSourceUrl,
  getPatternSession,
  startPatternSession,
  submitPatternCommand,
  verifyPatternParticipant,
} from "./api";
import {
  BattleAction,
  Habitat,
  LureColor,
  LureType,
  PatternCard,
  PatternCredentials,
  PatternFishGuess,
  PatternFullFish,
  PatternModifierDetail,
  PatternPlayerPublic,
  PatternSetResult,
  PatternSessionSnapshot,
  PatternTile,
  PatternTurnPhase,
  RetrieveType,
} from "./types";

const SESSION_ID_PATTERN = /^pattern[0-9A-F]{3}$/;
const PLAYER_CODE_PATTERN = /^angler[0-9A-F]{4}$/;
const MAX_RECONNECT_ATTEMPTS = 5;
const DICE_ROLL_ANIMATION_MS = 3000;
const LURES: LureType[] = ["Frog", "Jig", "Worm", "Crankbait", "Spinnerbait", "Swimbait"];
const COLORS: LureColor[] = ["Natural", "Dark", "Bright", "Flash"];
const RETRIEVES: RetrieveType[] = ["Slow", "Steady", "Erratic", "Fast"];
const TURN_PHASES: PatternTurnPhase[] = [
  "immediate",
  "move",
  "rig",
  "cast",
  "declare",
  "nibble",
  "set",
  "wait",
  "hookSet",
  "battle",
  "livewell",
  "cleanup",
];

const habitatNames: Record<Habitat, string> = {
  V: "Vegetation",
  W: "Wood",
  R: "Rock",
  O: "Open Water",
  D: "Deep Structure",
  M: "Muck",
};

const habitatCellBackgrounds: Record<Habitat, string> = {
  V: "#dff3c8",
  W: "#ead7bd",
  R: "#e4e8e7",
  O: "#d9f4fb",
  D: "#dfe7f4",
  M: "#d8c0a4",
};

const RULE_TEXT = {
  round:
    "The game lasts 12 rounds. After every angler takes a turn, the round advances; after round 12, livewells reveal for final weigh-in.",
  season:
    "Season is set by round: 1-3 Spring, 4-6 Summer, 7-9 Fall, 10-12 Winter. Season can add Nibble modifiers.",
  moon:
    "Moon advances each round on a New, Half, Full, Half cycle. Cards and table rules can reference the current moon.",
  weather:
    "Weather is drawn at the start of each round and applies to every angler that round. Weather can add Nibble modifiers.",
  activeEvent:
    "An Immediate Event applies for the current round only, then clears when the next round begins.",
  turn:
    "Only the active angler can move through the turn phases and submit fishing commands.",
  phase:
    "Turn phases proceed through Immediate, Move, Rig, Cast, Declare, Nibble, Set, Wait, Hook Set, Battle, Livewell, and Cleanup as needed.",
  boat:
    "Boat markers show anglers on this location tile. An angler may stay or move one orthogonal tile during Move.",
  activeFish:
    "Active Fish stay in this exact square until caught, spooked, or returned to their habitat. Casting here targets the same Fish.",
  alertFish:
    "Alert Fish take a Nibble penalty: -1 normally, or -2 during Tournament Pressure. A later failed Hook Set or escaped Battle triggers a Spook Check.",
  targetCell:
    "The dashed center is the 9-10 cast target on the 3 x 3 casting grid.",
  habitatIcon:
    "Habitat icons are weighted chances. If a cell shows repeated icons, each icon is one chance when selecting the hidden Fish habitat.",
  muck:
    "Muck ends the fishing attempt immediately. No Fish is found and there is no Nibble roll.",
  move:
    "During Move, stay on your current tile or move to one orthogonally adjacent tile.",
  rig:
    "During Rig, equip up to 2 Tackle cards from hand or unequip Tackle back to hand. Equipped Tackle is public and can modify later rolls.",
  cast:
    "Roll d10 to choose a square on your current tile. Rolls 9-10 land in the center square.",
  castLanding:
    "The bobber marks the exact square where the latest Cast roll landed.",
  declare:
    "Choose one Lure, Color, and Retrieve. These are checked against the Fish profile and Mood to produce Bite Box matches.",
  lure:
    "Lure is one of the three presentation choices. Matching the Fish profile or a hidden Mood option counts as a Bite Box match.",
  color:
    "Color is one of the three presentation choices. Matching the Fish profile or a hidden Mood option counts as a Bite Box match.",
  retrieve:
    "Retrieve is one of the three presentation choices. Matching the Fish profile or a hidden Mood option counts as a Bite Box match.",
  mood:
    "Mood reveals which category may have hidden extra matches. The exact extra options remain server-side until Bite Box resolves.",
  biteBox:
    "Bite Box counts presentation matches. Nibble DCs are 0 matches = DC 5, 1 match = DC 4, 2 matches = DC 3, 3 matches = DC 2.",
  hotHit:
    "A Hot Hit means the declaration matched a hidden Mood option. It adds +1 to the Nibble roll.",
  nibble:
    "Nibble rolls d6 plus modifiers against the match DC: 0 matches DC 5, 1 match DC 4, 2 matches DC 3, 3 matches DC 2. Modifiers are capped from -2 to +2, and a natural 1 fails.",
  setNow:
    "Set Now rolls Hook Set without waiting. Base target is 4+, modified by Hard Set, Wait, rod, and Tackle bonuses; after the roll, proceed applies the result.",
  wait:
    "Wait can be used once after a Nibble. It rolls first: 1-2 the Fish spits the lure, 3-4 no bonus, 5-6 gives +2 Hook Set. Proceed applies the Wait result.",
  hardSet:
    "Hard Set adds +2 to Hook Set. If it hooks the Fish, Battle starts with Tension unless your line is Monofilament.",
  hookSet:
    "Hook Set rolls d6 against the modified target. Proceed after the roll either starts Battle on success or resolves the failed window on a miss.",
  proceedSet:
    "Proceed applies the visible Wait or Hook Set result. It unlocks only after the dice animation has finished.",
  reel:
    "Reel rolls d6 against Fish Fight. Success moves one space toward LANDED; failure moves one space toward ESCAPED and can trigger the Fish ability.",
  pressure:
    "Pressure rolls d6 with +1 against Fish Fight. Power Reel adds another +1. Success moves one space toward LANDED; failure moves two spaces toward ESCAPED and can trigger the Fish ability.",
  giveLine:
    "Give Line does not roll. It moves one space toward ESCAPED, removes Tension, and suppresses the Fish ability for that step.",
  battleTrack:
    "Battle starts at space 4 on a 7-space track. Reach LANDED to catch the Fish; reach ESCAPED and the Fish may become Alert or spook.",
  tension:
    "Tension can come from Hard Set and some cards. Give Line removes it. Jump only punishes you when Tension is present.",
  tangle:
    "Tangle blocks progress: your next successful Reel or Pressure clears Tangle instead of moving toward LANDED.",
  livewell:
    "Keep up to 3 Bass in your livewell. Secret Fish reveal only to their owner until final weigh-in unless shown off.",
  showOff:
    "Show Off makes the landed Fish public immediately and draws 1 Action card.",
  cull:
    "If your livewell already has 3 Fish, release either the new Fish or one kept Fish back to its habitat.",
  cleanup:
    "Cleanup ends your turn after you discard down to 5 cards if needed.",
  hand:
    "Cards in your hand are private. Hand size is public, and you must end cleanup with 5 or fewer cards.",
  handCount:
    "Opponents see only this public hand count, not the identities of held cards.",
  cardCategory:
    "Card category determines when the card can be used: Tackle equips, Events can be Immediate, and Tricks or Interference are action cards.",
  deadCard:
    "Dead cards remain in hand but cannot be used for their normal effect.",
  tradeValue:
    "Trade Value is public negotiation information printed on the card; it is not a spendable resource.",
  tackle:
    "Equipped Tackle occupies one of 2 public slots and applies its printed rule while equipped. During Rig, it can be unequipped back to hand.",
  fight:
    "Fight is the target number for Reel and Pressure rolls. It is hidden until a successful Hook Set.",
  ability:
    "The Fish ability is hidden until the Fish is hooked. Failed Battle actions can trigger it once per Battle.",
  weight:
    "Fish weight counts for final weigh-in. Secret weights are hidden from opponents until reveal.",
  tell:
    "Tell options always include the Fish truth plus distractors. Use them to infer the best Lure, Color, and Retrieve.",
  innateProfile:
    "This is the Fish's true Lure, Color, and Retrieve profile. Matching these in Declare counts for Bite Box.",
};

function RuleTooltip({
  title,
  children,
  block = false,
}: {
  title: ReactNode;
  children: ReactElement;
  block?: boolean;
}) {
  return (
    <Tooltip
      arrow
      enterDelay={3000}
      enterNextDelay={3000}
      title={
        <Box sx={{ maxWidth: 320, fontSize: 13, lineHeight: 1.35 }}>
          {title}
        </Box>
      }
    >
      <Box
        component="span"
        sx={{
          display: block ? "block" : "inline-flex",
          width: block ? "100%" : "auto",
          maxWidth: "100%",
        }}
      >
        {children}
      </Box>
    </Tooltip>
  );
}

function seasonRuleText(season: string) {
  const detail =
    {
      Spring: "+1 Nibble in Vegetation or Wood.",
      Summer: "+1 Nibble in Deep Structure.",
      Fall: "+1 Nibble in Open Water or Rock.",
      Winter: "+1 Nibble on Slow retrieves and -1 on Fast retrieves.",
    }[season] || "Season-specific Nibble modifiers apply when their condition is met.";
  return `${RULE_TEXT.season} ${detail}`;
}

function weatherRuleText(weather: string) {
  const detail =
    {
      "Clear & Calm": "+1 Nibble with Natural color; Fluorocarbon also adds +1.",
      Overcast: "+1 Nibble with Crankbait, Spinnerbait, or Swimbait.",
      Windy: "+1 Nibble with Spinnerbait or Crankbait.",
      Rain: "+1 Nibble with Dark or Bright color; Rattle Chamber can also help.",
      "Cold Front": "+1 Nibble on Slow retrieves and -1 on Fast retrieves.",
      "Warm Stable": "+1 Nibble on Steady retrieves.",
      "Light Chop": "+1 Nibble with Flash color.",
      "Storm Front": "+1 Nibble with Spinnerbait or Swimbait.",
    }[weather] || "Weather-specific Nibble modifiers apply when their condition is met.";
  return `${RULE_TEXT.weather} ${detail}`;
}

function habitatRuleText(habitat: Habitat) {
  if (habitat === "M") return RULE_TEXT.muck;
  return `${habitatNames[habitat]} habitat. ${RULE_TEXT.habitatIcon}`;
}

function cardRuleText(card: PatternCard) {
  const parts = [
    `${card.name}: ${card.text}`,
    card.category === "tackle"
      ? RULE_TEXT.tackle
      : `${card.category[0].toUpperCase()}${card.category.slice(1)} card. ${RULE_TEXT.cardCategory}`,
  ];
  if (card.immediate) parts.push(RULE_TEXT.activeEvent);
  if (card.dead) parts.push(RULE_TEXT.deadCard);
  if (card.tradeValue) parts.push(`Trade Value ${card.tradeValue}. ${RULE_TEXT.tradeValue}`);
  return parts.join(" ");
}

function equipmentRuleText(kind: "rod" | "reel" | "line", value: string) {
  if (value === "Moderate Rod") {
    return "Moderate Rod ignores Jump once per Battle when Jump would trigger from Tension.";
  }
  if (value === "Medium-Heavy Rod") {
    return "Medium-Heavy Rod adds +1 Hook Set in Vegetation or Wood.";
  }
  if (value === "Heavy Rod") {
    return "Heavy Rod ignores Cover once per Battle.";
  }
  if (value === "Power Reel") {
    return "Power Reel adds +1 more to Pressure rolls, for +2 total before other effects.";
  }
  if (value === "Fast Reel") {
    return "Fast Reel cancels Run when the Fish ability triggers.";
  }
  if (value === "Balanced Reel") {
    return "Balanced Reel is the standard reel. Reel has no passive modifier; Pressure still gets its normal +1.";
  }
  if (value === "Fluorocarbon") {
    return "Fluorocarbon adds +1 Nibble during Clear & Calm weather.";
  }
  if (value === "Monofilament") {
    return "Monofilament prevents Hard Set from starting Battle with Tension.";
  }
  if (value === "Braid") {
    return "Braid ignores one Tangle per Battle.";
  }
  return `${kind[0].toUpperCase()}${kind.slice(1)} equipment. Its printed rule applies while equipped.`;
}

function battleActionRuleText(action: BattleAction) {
  if (action === "pressure") return RULE_TEXT.pressure;
  if (action === "giveLine") return RULE_TEXT.giveLine;
  return RULE_TEXT.reel;
}

function abilityRuleText(value: string | null) {
  if (!value) return RULE_TEXT.ability;
  const label = abilityLabel(value);
  const detail =
    {
      jump: "When Jump triggers with Tension, the Fish moves one extra space toward ESCAPED.",
      run: "When Run triggers, the Fish moves one extra space toward ESCAPED unless a Fast Reel cancels it.",
      cover: "When Cover triggers in Vegetation or Wood, it adds Tangle unless a Heavy Rod ignores it.",
      headShake: "When Head Shake triggers after Pressure, the Fish moves one extra space toward ESCAPED.",
      dive: "When Dive triggers at space 5 or farther in cover or structure, it adds Tangle.",
    }[value] || "This Fish ability can trigger once per Battle after a failed Battle roll.";
  return `${label}: ${detail}`;
}

function FishEmojiIcon({ size = 18 }: { size?: number }) {
  return (
    <Box
      component="span"
      role="img"
      aria-label="active fish"
      sx={{ display: "inline-grid", placeItems: "center", fontSize: size, lineHeight: 1 }}
    >
      🐟
    </Box>
  );
}

function BobberIcon() {
  return (
    <Box
      aria-label="cast bobber"
      role="img"
      sx={{
        width: 24,
        height: 30,
        position: "relative",
        filter: "drop-shadow(0 2px 4px rgba(20,33,29,.28))",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          left: "50%",
          top: 0,
          width: 2,
          height: 9,
          bgcolor: "#1f2937",
          borderRadius: 99,
          transform: "translateX(-50%)",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          left: "50%",
          top: 6,
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: "2px solid #1f2937",
          overflow: "hidden",
          transform: "translateX(-50%)",
          bgcolor: "#fff7ed",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: "0 0 50% 0",
            bgcolor: "#dc2626",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 5,
            height: 5,
            borderRadius: "50%",
            bgcolor: "#1f2937",
            transform: "translate(-50%, -50%)",
          }}
        />
      </Box>
      <Box
        sx={{
          position: "absolute",
          left: "50%",
          bottom: 0,
          width: 22,
          height: 7,
          border: "2px solid rgba(8,127,140,.55)",
          borderTop: 0,
          borderRadius: "0 0 999px 999px",
          transform: "translateX(-50%)",
        }}
      />
    </Box>
  );
}

type DiceRollInfo = {
  key: string;
  label: string;
  message: string;
  sides: number;
  tone: PatternSessionSnapshot["log"][number]["tone"];
  value: number;
};

type GuessHistoryByFish = Record<string, PatternFishGuess[]>;
type FishWithGuessHistory = {
  publicId?: string | null;
  guessHistory?: PatternFishGuess[];
};

const d6Pips: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [
    [30, 30],
    [70, 70],
  ],
  3: [
    [30, 30],
    [50, 50],
    [70, 70],
  ],
  4: [
    [30, 30],
    [70, 30],
    [30, 70],
    [70, 70],
  ],
  5: [
    [30, 30],
    [70, 30],
    [50, 50],
    [30, 70],
    [70, 70],
  ],
  6: [
    [30, 26],
    [70, 26],
    [30, 50],
    [70, 50],
    [30, 74],
    [70, 74],
  ],
};

function getLatestDiceRoll(session: PatternSessionSnapshot): DiceRollInfo | null {
  const displayLog = displayLogEntries(session.log);
  for (let index = displayLog.length - 1; index >= 0; index -= 1) {
    const roll = parseDiceRollLog(displayLog[index]);
    if (roll) return roll;
  }
  return null;
}

function displayLogEntries(log: PatternSessionSnapshot["log"]) {
  let latestBiteBoxMatchCount: number | null = null;
  return log.map((entry) => {
    const message = displayLogMessage(entry.message, latestBiteBoxMatchCount);
    const biteBox = /Bite Box:\s+(\d+)\s+Matches/i.exec(entry.message);
    if (biteBox) latestBiteBoxMatchCount = Number(biteBox[1]);
    return { ...entry, message };
  });
}

function displayLogMessage(message: string, matchCount: number | null) {
  return message.replace(
    /Nibble roll\s+(\d+)([+-]\d+)?\s+vs\s+(?:DC\s*)?(\d+)\+?(?:\s+\(([+-]\d+)\))?:/i,
    (_match, roll: string, inlineModifier: string | undefined, loggedTarget: string, parenModifier: string | undefined) => {
      const modifier = inlineModifier || parenModifier || "";
      const dc = matchCount === null ? Number(loggedTarget) : nibbleTargetForMatches(matchCount);
      return `Nibble roll ${roll}${modifier} vs DC ${dc}:`;
    }
  );
}

function parseDiceRollLog(entry: PatternSessionSnapshot["log"][number]): DiceRollInfo | null {
  const message = entry.message;
  let match = /d10\s+(\d+)/i.exec(message);
  if (match) {
    return diceRollInfo(entry, "Cast", 10, Number(match[1]));
  }

  match = /Nibble roll\s+(\d+)/i.exec(message);
  if (match) {
    return diceRollInfo(entry, "Nibble", 6, Number(match[1]));
  }

  match = /waited\. Roll\s+(\d+)/i.exec(message);
  if (match) {
    return diceRollInfo(entry, "Wait", 6, Number(match[1]));
  }

  match = /(?:Hard Set|Hook Set|set):\s+(\d+)/i.exec(message);
  if (match) {
    return diceRollInfo(entry, "Hook Set", 6, Number(match[1]));
  }

  match = /chose\s+(Reel|Pressure):\s+(\d+)/i.exec(message);
  if (match) {
    return diceRollInfo(entry, match[1], 6, Number(match[2]));
  }

  match = /Spook check\s+(\d+)/i.exec(message);
  if (match) {
    return diceRollInfo(entry, "Spook Check", 6, Number(match[1]));
  }

  return null;
}

function diceRollInfo(
  entry: PatternSessionSnapshot["log"][number],
  label: string,
  sides: number,
  value: number
): DiceRollInfo {
  return {
    key: entry.id,
    label,
    message: entry.message,
    sides,
    tone: entry.tone,
    value,
  };
}

function useLocalGuessHistory(session: PatternSessionSnapshot) {
  const storageKey = guessHistoryStorageKey(session.id);
  const activeFishIds = (session.lake?.activeFish || [])
    .map((fish) => fish.publicId)
    .filter(Boolean)
    .sort()
    .join("|");
  const [historyByFish, setHistoryByFish] = useState<GuessHistoryByFish>(() =>
    readGuessHistoryStorage(storageKey)
  );
  const attempt = session.attempt;

  useEffect(() => {
    setHistoryByFish(readGuessHistoryStorage(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (!session.lake) return;
    const activeIds = new Set(
      (session.lake.activeFish || []).map((fish) => fish.publicId).filter(Boolean)
    );
    setHistoryByFish((current) => {
      const next: GuessHistoryByFish = {};
      Object.entries(current).forEach(([fishPublicId, guesses]) => {
        if (activeIds.has(fishPublicId)) next[fishPublicId] = guesses;
      });
      return shallowEqualGuessHistory(current, next) ? current : next;
    });
  }, [activeFishIds, session.lake]);

  useEffect(() => {
    if (
      !attempt?.fishPublicId ||
      !attempt.biteBoxResolved ||
      !attempt.declaration ||
      attempt.matchCount === null
    ) {
      return;
    }

    const player = session.players.find((item) => item.code === attempt.playerId);
    const guess: PatternFishGuess = {
      id: attempt.id,
      playerId: attempt.playerId,
      playerName: player?.name || "Angler",
      round: session.round,
      declaration: { ...attempt.declaration },
      matchCount: attempt.matchCount,
      hotHit: attempt.hotHit,
      nibbleRoll: attempt.nibbleRoll,
      nibbleModifier: attempt.nibbleModifier,
      nibbleTarget: attempt.nibbleTarget,
      nibbleRawModifier: attempt.nibbleRawModifier ?? attempt.nibbleModifier,
      nibbleDetails: normalizeModifierDetails(attempt.nibbleDetails),
      nibbleSuccess: attempt.nibbleSuccess,
    };

    setHistoryByFish((current) => {
      const fishHistory = current[attempt.fishPublicId] || [];
      const existingIndex = fishHistory.findIndex((item) => item.id === guess.id);
      if (existingIndex >= 0) {
        if (JSON.stringify(fishHistory[existingIndex]) === JSON.stringify(guess)) {
          return current;
        }
        const nextFishHistory = [...fishHistory];
        nextFishHistory[existingIndex] = guess;
        return {
          ...current,
          [attempt.fishPublicId]: nextFishHistory,
        };
      }
      return {
        ...current,
        [attempt.fishPublicId]: [...fishHistory, guess],
      };
    });
  }, [
    attempt?.biteBoxResolved,
    attempt?.declaration,
    attempt?.fishPublicId,
    attempt?.hotHit,
    attempt?.id,
    attempt?.matchCount,
    attempt?.nibbleModifier,
    attempt?.nibbleRoll,
    attempt?.nibbleRawModifier,
    attempt?.nibbleSuccess,
    attempt?.nibbleTarget,
    attempt?.nibbleDetails,
    attempt?.playerId,
    session.players,
    session.round,
  ]);

  useEffect(() => {
    writeGuessHistoryStorage(storageKey, historyByFish);
  }, [historyByFish, storageKey]);

  return historyByFish;
}

function guessHistoryForFish(
  fish: FishWithGuessHistory,
  localGuessHistory: GuessHistoryByFish = {}
) {
  const merged = new Map<string, PatternFishGuess>();
  (fish.guessHistory || []).forEach((guess) => merged.set(guess.id, guess));
  if (fish.publicId) {
    (localGuessHistory[fish.publicId] || []).forEach((guess) => merged.set(guess.id, guess));
  }
  return Array.from(merged.values());
}

function guessHistoryStorageKey(sessionId: string) {
  return `patternGuessHistory:${sessionId}`;
}

function normalizeModifierDetails(details: unknown): PatternModifierDetail[] {
  if (!Array.isArray(details)) return [];
  return details
    .filter(
      (detail) =>
        detail &&
        typeof detail === "object" &&
        typeof (detail as PatternModifierDetail).label === "string" &&
        typeof (detail as PatternModifierDetail).value === "number"
    )
    .map((detail) => ({
      label: (detail as PatternModifierDetail).label,
      value: (detail as PatternModifierDetail).value,
    }));
}

function readGuessHistoryStorage(storageKey: string): GuessHistoryByFish {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const next: GuessHistoryByFish = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([fishPublicId, guesses]) => {
      if (!Array.isArray(guesses)) return;
      const validGuesses = guesses.filter(isPatternFishGuessLike).map((guess) => ({
        ...guess,
        nibbleDetails: normalizeModifierDetails(guess.nibbleDetails),
      }));
      if (validGuesses.length > 0) next[fishPublicId] = validGuesses;
    });
    return next;
  } catch {
    return {};
  }
}

function writeGuessHistoryStorage(storageKey: string, historyByFish: GuessHistoryByFish) {
  try {
    if (Object.keys(historyByFish).length === 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(historyByFish));
  } catch {
    // Storage can be unavailable in private browsing or constrained browser sessions.
  }
}

function shallowEqualGuessHistory(left: GuessHistoryByFish, right: GuessHistoryByFish) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => {
    const leftGuesses = left[key] || [];
    const rightGuesses = right[key] || [];
    return (
      rightKeys.includes(key) &&
      leftGuesses.length === rightGuesses.length &&
      leftGuesses.every((guess, index) => guess.id === rightGuesses[index]?.id)
    );
  });
}

function isPatternFishGuessLike(value: unknown): value is PatternFishGuess {
  if (!value || typeof value !== "object") return false;
  const guess = value as PatternFishGuess;
  return (
    typeof guess.id === "string" &&
    typeof guess.playerId === "string" &&
    typeof guess.playerName === "string" &&
    typeof guess.round === "number" &&
    typeof guess.matchCount === "number" &&
    typeof guess.hotHit === "boolean" &&
    Boolean(guess.declaration) &&
    typeof guess.declaration.lure === "string" &&
    typeof guess.declaration.color === "string" &&
    typeof guess.declaration.retrieve === "string"
  );
}

function guessedMethods(history: PatternFishGuess[]) {
  const guessed = new Set<string>();
  history.forEach((guess) => {
    guessed.add(`lure:${guess.declaration.lure}`);
    guessed.add(`color:${guess.declaration.color}`);
    guessed.add(`retrieve:${guess.declaration.retrieve}`);
  });
  return guessed;
}

function randomDiceValue(sides: number) {
  return Math.floor(Math.random() * sides) + 1;
}

function DiceRoller({ session }: { session: PatternSessionSnapshot }) {
  const latest = getLatestDiceRoll(session);
  const latestKey = latest?.key;
  const latestSides = latest?.sides;
  const latestValue = latest?.value;
  const [rolling, setRolling] = useState(false);
  const [displayValue, setDisplayValue] = useState<number | null>(latestValue || null);

  useEffect(() => {
    if (!latestKey || !latestSides || latestValue == null) {
      setRolling(false);
      setDisplayValue(null);
      return undefined;
    }

    setRolling(true);
    setDisplayValue(randomDiceValue(latestSides));
    const interval = window.setInterval(() => {
      setDisplayValue(randomDiceValue(latestSides));
    }, 85);
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
      setDisplayValue(latestValue);
      setRolling(false);
    }, DICE_ROLL_ANIMATION_MS);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [latestKey, latestSides, latestValue]);

  const toneColor =
    latest?.tone === "hit" || latest?.tone === "victory"
      ? "#15803d"
      : latest?.tone === "miss" || latest?.tone === "danger"
      ? "#b45309"
      : "#087f8c";

  return (
    <Paper
      sx={{
        p: 1.5,
        border: "1px solid",
        borderColor: "divider",
        overflow: "hidden",
        background:
          "linear-gradient(135deg, rgba(8,127,140,0.1), rgba(255,254,250,0.9) 42%, rgba(194,65,12,0.08))",
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center">
        <DiceFace sides={latest?.sides || 6} value={displayValue} rolling={rolling} color={toneColor} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 850 }}>
            Dice
          </Typography>
          <Typography sx={{ fontWeight: 950, lineHeight: 1.15 }}>
            {latest ? `${latest.label} d${latest.sides}` : "Ready"}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {latest ? (rolling ? "Rolling..." : latest.message) : "Waiting for the next roll"}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function useSetProceedReady(resultId?: string | null, proceedAfter?: string | null) {
  const [ready, setReady] = useState(true);

  useEffect(() => {
    if (!resultId) {
      setReady(true);
      return undefined;
    }

    setReady(false);
    const serverDelay = proceedAfter ? Date.parse(proceedAfter) - Date.now() : 0;
    const delay = Math.max(DICE_ROLL_ANIMATION_MS, Number.isFinite(serverDelay) ? serverDelay : 0);
    const timeout = window.setTimeout(() => setReady(true), Math.max(0, delay));
    return () => window.clearTimeout(timeout);
  }, [resultId, proceedAfter]);

  return ready;
}

function DiceFace({
  sides,
  value,
  rolling,
  color,
}: {
  sides: number;
  value: number | null;
  rolling: boolean;
  color: string;
}) {
  const pips = value && sides === 6 ? d6Pips[value] || [] : [];
  return (
    <Box
      sx={{
        width: 76,
        height: 76,
        flex: "0 0 auto",
        perspective: 420,
      }}
    >
      <Box
        sx={{
          width: "100%",
          height: "100%",
          position: "relative",
          display: "grid",
          placeItems: "center",
          border: "2px solid rgba(20,33,29,.72)",
          borderRadius: 2,
          bgcolor: "#fffefa",
          color,
          boxShadow: rolling
            ? "0 16px 34px rgba(20,33,29,.22)"
            : "0 8px 18px rgba(20,33,29,.16)",
          transformStyle: "preserve-3d",
          animation: rolling ? "patternDiceRoll 0.52s linear infinite" : "none",
          "@keyframes patternDiceRoll": {
            "0%": { transform: "rotateX(0deg) rotateY(0deg) rotateZ(0deg) scale(1)" },
            "35%": { transform: "rotateX(142deg) rotateY(92deg) rotateZ(-18deg) scale(1.06)" },
            "70%": { transform: "rotateX(278deg) rotateY(205deg) rotateZ(14deg) scale(.98)" },
            "100%": { transform: "rotateX(360deg) rotateY(360deg) rotateZ(0deg) scale(1)" },
          },
        }}
      >
        {pips.length > 0 ? (
          pips.map(([left, top]) => (
            <Box
              key={`${left}-${top}`}
              sx={{
                position: "absolute",
                left: `${left}%`,
                top: `${top}%`,
                width: 11,
                height: 11,
                borderRadius: "50%",
                bgcolor: color,
                transform: "translate(-50%, -50%)",
                boxShadow: "inset 0 -1px 1px rgba(0,0,0,.2)",
              }}
            />
          ))
        ) : (
          <Typography sx={{ fontWeight: 950, fontSize: 30, lineHeight: 1 }}>
            {value || "-"}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function habitatPlacement(index: number, count: number) {
  if (count <= 1) return { x: 0, y: 0, rotate: -5 };
  const radius = count <= 2 ? 11 : count <= 4 ? 15 : 18;
  const angle = -90 + (360 / count) * index;
  return {
    x: Math.cos((angle * Math.PI) / 180) * radius,
    y: Math.sin((angle * Math.PI) / 180) * radius,
    rotate: ((index % 5) - 2) * 9,
  };
}

function HabitatGlyph({
  habitat,
  index,
  count,
}: {
  habitat: Habitat;
  index: number;
  count: number;
}) {
  const placement = habitatPlacement(index, count);
  const size = count <= 1 ? 42 : count <= 2 ? 37 : count <= 4 ? 32 : 28;
  return (
    <Box
      sx={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate(-50%, -50%) translate(${placement.x}px, ${placement.y}px) rotate(${placement.rotate}deg)`,
        zIndex: index + 1,
      }}
    >
      <RuleTooltip title={habitatRuleText(habitat)}>
        <Box sx={{ width: size, height: size }}>
          <HabitatArtwork habitat={habitat} />
        </Box>
      </RuleTooltip>
    </Box>
  );
}

function HabitatArtwork({ habitat }: { habitat: Habitat }) {
  if (habitat === "V") return <VegetationIcon />;
  if (habitat === "W") return <WoodIcon />;
  if (habitat === "R") return <RockIcon />;
  if (habitat === "D") return <DeepIcon />;
  if (habitat === "M") return <MuckIcon />;
  return <OpenWaterIcon />;
}

function IconShell({
  children,
  bg,
  border,
}: {
  children: ReactNode;
  bg: string;
  border: string;
}) {
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        position: "relative",
        borderRadius: "50%",
        bgcolor: bg,
        border: `2px solid ${border}`,
        boxShadow: "0 4px 10px rgba(20,33,29,.18), inset 0 1px 2px rgba(255,255,255,.7)",
        overflow: "hidden",
      }}
    >
      {children}
    </Box>
  );
}

function VegetationIcon() {
  return (
    <IconShell bg="#9bd46f" border="#2f6f3b">
      <Box
        sx={{
          position: "absolute",
          left: "17%",
          top: "34%",
          width: "66%",
          height: "39%",
          borderRadius: "60% 48% 58% 44%",
          bgcolor: "#3f9b4e",
          transform: "rotate(-18deg)",
        }}
      />
      {[22, 42, 62].map((left, index) => (
        <Box
          key={left}
          sx={{
            position: "absolute",
            left: `${left}%`,
            bottom: "16%",
            width: "8%",
            height: "58%",
            borderRadius: 99,
            bgcolor: "#1f6f3d",
            transform: `rotate(${index === 1 ? 0 : index === 0 ? -22 : 24}deg)`,
          }}
        />
      ))}
    </IconShell>
  );
}

function WoodIcon() {
  return (
    <IconShell bg="#d8ad76" border="#7c4d21">
      <Box
        sx={{
          position: "absolute",
          left: "12%",
          top: "38%",
          width: "76%",
          height: "26%",
          borderRadius: 99,
          bgcolor: "#8b5a2b",
          transform: "rotate(-18deg)",
          boxShadow: "inset 0 4px 0 rgba(255,255,255,.14)",
        }}
      />
      {[23, 76].map((left) => (
        <Box
          key={left}
          sx={{
            position: "absolute",
            left: `${left}%`,
            top: "41%",
            width: "17%",
            height: "17%",
            borderRadius: "50%",
            border: "2px solid #5f3518",
            bgcolor: "#c98a43",
            transform: "translate(-50%, -50%) rotate(-18deg)",
          }}
        />
      ))}
    </IconShell>
  );
}

function RockIcon() {
  return (
    <IconShell bg="#d9dee1" border="#5f6c72">
      <Box
        sx={{
          position: "absolute",
          left: "17%",
          top: "33%",
          width: "42%",
          height: "42%",
          borderRadius: "46% 54% 42% 58%",
          bgcolor: "#7f8b91",
          transform: "rotate(-16deg)",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          right: "14%",
          top: "24%",
          width: "40%",
          height: "48%",
          borderRadius: "52% 42% 55% 45%",
          bgcolor: "#a0a9ae",
          transform: "rotate(18deg)",
          boxShadow: "inset -5px -5px 0 rgba(61,72,78,.22)",
        }}
      />
    </IconShell>
  );
}

function OpenWaterIcon() {
  return (
    <IconShell bg="#93d8f5" border="#1679a1">
      {[30, 50, 70].map((top, index) => (
        <Box
          key={top}
          sx={{
            position: "absolute",
            left: index % 2 ? "16%" : "8%",
            top: `${top}%`,
            width: "78%",
            height: "16%",
            borderTop: "3px solid #087f8c",
            borderRadius: "50%",
            opacity: 0.86,
          }}
        />
      ))}
    </IconShell>
  );
}

function DeepIcon() {
  return (
    <IconShell bg="#a9c2e4" border="#314b7a">
      <Box
        sx={{
          position: "absolute",
          left: "26%",
          top: "14%",
          width: "48%",
          height: "72%",
          bgcolor: "#355f9a",
          clipPath: "polygon(50% 0%, 90% 42%, 68% 100%, 27% 100%, 10% 42%)",
          boxShadow: "inset -7px -8px 0 rgba(23,45,84,.35)",
        }}
      />
      {[35, 53, 70].map((top) => (
        <Box
          key={top}
          sx={{
            position: "absolute",
            left: "31%",
            top: `${top}%`,
            width: "38%",
            borderTop: "2px solid rgba(232,240,255,.72)",
            borderRadius: "50%",
          }}
        />
      ))}
    </IconShell>
  );
}

function MuckIcon() {
  return (
    <IconShell bg="#b9956b" border="#6f5132">
      {[24, 45, 66].map((left, index) => (
        <Box
          key={left}
          sx={{
            position: "absolute",
            left: `${left}%`,
            top: `${index === 1 ? 35 : 55}%`,
            width: index === 1 ? "34%" : "24%",
            height: index === 1 ? "28%" : "20%",
            borderRadius: "50%",
            bgcolor: index === 1 ? "#765436" : "#8f6944",
            transform: "translate(-50%, -50%)",
            opacity: 0.86,
          }}
        />
      ))}
    </IconShell>
  );
}

const patternTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#087f8c",
      contrastText: "#f8fafc",
    },
    secondary: {
      main: "#c2410c",
    },
    background: {
      default: "#f5f7f2",
      paper: "#fffefa",
    },
    text: {
      primary: "#14211d",
      secondary: "#56645f",
    },
    divider: "rgba(20, 33, 29, 0.16)",
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 850,
          letterSpacing: 0,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
  },
});

function hostStorageKey(sessionId: string) {
  return `patternHost:${sessionId}`;
}

function playerStorageKey(sessionId: string) {
  return `patternPlayer:${sessionId}`;
}

function normalizeSessionAlias(value: string) {
  const hex = value
    .replace(/^pattern/i, "")
    .toUpperCase()
    .replace(/[^0-9A-F]/g, "")
    .slice(0, 3);
  return hex ? `pattern${hex}` : "";
}

function normalizePlayerCode(value: string) {
  const hex = value
    .replace(/^angler/i, "")
    .toUpperCase()
    .replace(/[^0-9A-F]/g, "")
    .slice(0, 4);
  return hex ? `angler${hex}` : "";
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function joinUrlForSession(sessionId: string) {
  return `${window.location.origin}/the-pattern/join?session=${sessionId}`;
}

function usePatternStream(
  sessionId: string | undefined,
  credentials: PatternCredentials | null
) {
  const [session, setSession] = useState<PatternSessionSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [streamError, setStreamError] = useState("");
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [terminalReason, setTerminalReason] = useState<
    "" | "not-found" | "reconnect-limit"
  >("");
  const hostToken = credentials?.hostToken;
  const code = credentials?.code;

  useEffect(() => {
    if (!sessionId || (!hostToken && !code)) return undefined;

    let closed = false;
    let attempts = 0;
    const activeCredentials = { hostToken, code };
    const source = new EventSource(getPatternEventSourceUrl(sessionId, activeCredentials));

    async function checkSessionStillExists() {
      try {
        await getPatternSession(sessionId, activeCredentials);
      } catch (caught) {
        const status =
          typeof caught === "object" && caught !== null && "status" in caught
            ? Number((caught as { status?: number }).status)
            : undefined;
        if (status === 404 || status === 410) {
          source.close();
          setConnected(false);
          setTerminalReason("not-found");
          setStreamError("This Pattern game is no longer available.");
        }
      }
    }

    source.addEventListener("session", (event) => {
      if (closed) return;
      const message = event as MessageEvent<string>;
      setSession(JSON.parse(message.data));
      setConnected(true);
      setStreamError("");
      setReconnectAttempts(0);
      setTerminalReason("");
      attempts = 0;
    });

    source.onerror = () => {
      if (closed) return;
      attempts += 1;
      setConnected(false);
      setReconnectAttempts(attempts);
      setStreamError("Updates are reconnecting.");
      checkSessionStillExists();
      if (attempts >= MAX_RECONNECT_ATTEMPTS) {
        source.close();
        setTerminalReason("reconnect-limit");
        setStreamError("The connection could not be restored.");
      }
    };

    return () => {
      closed = true;
      source.close();
    };
  }, [code, hostToken, sessionId]);

  return {
    connected,
    reconnectAttempts,
    reconnecting: Boolean(streamError && !terminalReason),
    session,
    streamError,
    terminalReason,
  };
}

function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        color: "text.primary",
        py: { xs: 2, md: 3 },
        background:
          "linear-gradient(180deg, #f5f7f2 0%, #edf6f4 46%, #fbfaf4 100%)",
      }}
    >
      <Container maxWidth="xl">{children}</Container>
    </Box>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <PageFrame>
      <Paper sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <CircularProgress size={22} />
          <Typography>{label}</Typography>
        </Stack>
      </Paper>
    </PageFrame>
  );
}

function CreateGamePage() {
  const navigate = useNavigate();
  const [name, setName] = useState("Friday Night Pattern");
  const [lakeWidth, setLakeWidth] = useState(3);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    setBusy(true);
    setError("");
    try {
      const response = await createPatternSession({ name, lakeWidth });
      const sessionId = normalizeSessionAlias(response.sessionId || response.session.id);
      localStorage.setItem(hostStorageKey(sessionId), response.hostToken);
      navigate(`/the-pattern/host/${sessionId}`);
    } catch (caught) {
      setError(messageFromError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageFrame>
      <Stack spacing={2}>
        <TitleBar
          title="THE PATTERN"
          subtitle="Networked bass-fishing deduction, bite checks, and livewell scoring."
        />
        <Grid container spacing={2}>
          <Grid item xs={12} md={7}>
            <Paper sx={{ p: 2.5, border: "1px solid", borderColor: "divider" }}>
              <Stack spacing={2}>
                <Typography variant="h5" sx={{ fontWeight: 950 }}>
                  Create Game
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={7}>
                    <TextField
                      fullWidth
                      label="Game name"
                      value={name}
                      onChange={(event) => setName(event.target.value.slice(0, 42))}
                    />
                  </Grid>
                  <Grid item xs={12} md={5}>
                    <TextField
                      select
                      fullWidth
                      label="Lake size"
                      value={lakeWidth}
                      onChange={(event) => setLakeWidth(Number(event.target.value))}
                    >
                      <MenuItem value={2}>2 x 2</MenuItem>
                      <MenuItem value={3}>2 x 3</MenuItem>
                      <MenuItem value={4}>2 x 4</MenuItem>
                    </TextField>
                  </Grid>
                </Grid>
                {error && <Alert severity="error">{error}</Alert>}
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  disabled={busy || !name.trim()}
                  onClick={handleCreate}
                >
                  Create network game
                </Button>
              </Stack>
            </Paper>
          </Grid>
          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 2.5, border: "1px solid", borderColor: "divider" }}>
              <Stack spacing={2}>
                <Typography variant="h5" sx={{ fontWeight: 950 }}>
                  Join Game
                </Typography>
                <TextField
                  fullWidth
                  label="Game code"
                  value={joinCode}
                  placeholder="patternABC"
                  onChange={(event) => setJoinCode(normalizeSessionAlias(event.target.value))}
                />
                <Button
                  component={RouterLink}
                  to={`/the-pattern/join?session=${normalizeSessionAlias(joinCode)}`}
                  variant="outlined"
                  disabled={!SESSION_ID_PATTERN.test(normalizeSessionAlias(joinCode))}
                >
                  Continue to join
                </Button>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Stack>
    </PageFrame>
  );
}

function HostSessionPage() {
  const { sessionId } = useParams();
  const normalizedSessionId = normalizeSessionAlias(sessionId || "");
  const hostToken =
    normalizedSessionId && SESSION_ID_PATTERN.test(normalizedSessionId)
      ? localStorage.getItem(hostStorageKey(normalizedSessionId)) || ""
      : "";
  const credentials = hostToken ? { hostToken } : null;
  const { session, reconnecting, streamError } = usePatternStream(
    normalizedSessionId,
    credentials
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canStart = Boolean(session && session.status === "setup" && session.players.length >= 1);

  if (!normalizedSessionId || !SESSION_ID_PATTERN.test(normalizedSessionId)) {
    return <Navigate to="/the-pattern" replace />;
  }

  if (!hostToken) {
    return (
      <PageFrame>
        <Alert severity="warning">
          This browser does not have the host token for {normalizedSessionId}.
        </Alert>
      </PageFrame>
    );
  }

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (caught) {
      setError(messageFromError(caught));
    } finally {
      setBusy(false);
    }
  }

  if (!session) return <LoadingPanel label="Loading Pattern host table..." />;

  return (
    <PageFrame>
      <Stack spacing={2}>
        <TitleBar title={session.name} subtitle={`Host table ${session.id}`} />
        {reconnecting && <Alert severity="info">{streamError}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
        <Paper sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", md: "center" }}
          >
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip label={session.status.toUpperCase()} color="primary" />
              <Chip label={`${session.players.length}/4 anglers`} />
              <Chip label={`Lake 2 x ${session.lakeWidth}`} />
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <CopyButton label="Copy join link" value={joinUrlForSession(session.id)} />
              <Button component={RouterLink} to={`/the-pattern/join?session=${session.id}`}>
                Join screen
              </Button>
              {session.status === "setup" && (
                <Button
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  disabled={!canStart || busy}
                  onClick={() => run(() => startPatternSession(session.id, hostToken))}
                >
                  Start game
                </Button>
              )}
              {session.status !== "closed" && session.status !== "complete" && (
                <Button
                  color="error"
                  startIcon={<LogoutIcon />}
                  disabled={busy}
                  onClick={() => run(() => closePatternSession(session.id, hostToken))}
                >
                  Close
                </Button>
              )}
            </Stack>
          </Stack>
        </Paper>
        <GameTable session={session} credentials={{ hostToken }} readOnly />
      </Stack>
    </PageFrame>
  );
}

function JoinPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [sessionId, setSessionId] = useState(
    normalizeSessionAlias(searchParams.get("session") || "")
  );
  const [name, setName] = useState("Angler");
  const [existingCode, setExistingCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function joinNew() {
    setBusy(true);
    setError("");
    try {
      const response = await createPatternParticipant(sessionId, name);
      localStorage.setItem(playerStorageKey(sessionId), response.code);
      navigate(`/the-pattern/play/${sessionId}`);
    } catch (caught) {
      setError(messageFromError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function reconnect() {
    const code = normalizePlayerCode(existingCode);
    setBusy(true);
    setError("");
    try {
      const response = await verifyPatternParticipant(sessionId, code);
      localStorage.setItem(playerStorageKey(sessionId), response.code);
      navigate(`/the-pattern/play/${sessionId}`);
    } catch (caught) {
      setError(messageFromError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageFrame>
      <Stack spacing={2}>
        <TitleBar title="Join THE PATTERN" subtitle="Take a seat at the lake." />
        <Paper sx={{ p: 2.5, border: "1px solid", borderColor: "divider" }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Game code"
                value={sessionId}
                onChange={(event) => setSessionId(normalizeSessionAlias(event.target.value))}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Angler name"
                value={name}
                onChange={(event) => setName(event.target.value.slice(0, 28))}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Button
                fullWidth
                sx={{ height: "100%" }}
                variant="contained"
                disabled={busy || !SESSION_ID_PATTERN.test(sessionId) || !name.trim()}
                onClick={joinNew}
              >
                Join as new angler
              </Button>
            </Grid>
          </Grid>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                label="Existing angler code"
                value={existingCode}
                placeholder="anglerABCD"
                onChange={(event) => setExistingCode(normalizePlayerCode(event.target.value))}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Button
                fullWidth
                sx={{ height: "100%" }}
                variant="outlined"
                disabled={
                  busy ||
                  !SESSION_ID_PATTERN.test(sessionId) ||
                  !PLAYER_CODE_PATTERN.test(normalizePlayerCode(existingCode))
                }
                onClick={reconnect}
              >
                Reconnect
              </Button>
            </Grid>
          </Grid>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Paper>
      </Stack>
    </PageFrame>
  );
}

function PlayerSessionPage() {
  const { sessionId } = useParams();
  const normalizedSessionId = normalizeSessionAlias(sessionId || "");
  const code =
    normalizedSessionId && SESSION_ID_PATTERN.test(normalizedSessionId)
      ? localStorage.getItem(playerStorageKey(normalizedSessionId)) || ""
      : "";
  const credentials = code ? { code } : null;
  const { session, reconnecting, streamError } = usePatternStream(
    normalizedSessionId,
    credentials
  );

  if (!normalizedSessionId || !SESSION_ID_PATTERN.test(normalizedSessionId)) {
    return <Navigate to="/the-pattern" replace />;
  }

  if (!code) {
    return (
      <PageFrame>
        <Alert
          severity="info"
          action={
            <Button component={RouterLink} to={`/the-pattern/join?session=${normalizedSessionId}`}>
              Join
            </Button>
          }
        >
          This browser has no angler code for {normalizedSessionId}.
        </Alert>
      </PageFrame>
    );
  }

  if (!session) return <LoadingPanel label="Loading Pattern lake..." />;

  return (
    <PageFrame>
      <Stack spacing={2}>
        <TitleBar title={session.name} subtitle={`Angler table ${session.id}`} />
        {reconnecting && <Alert severity="info">{streamError}</Alert>}
        <GameTable session={session} credentials={{ code }} />
      </Stack>
    </PageFrame>
  );
}

function TitleBar({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Paper sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1}
        alignItems={{ xs: "stretch", md: "center" }}
        justifyContent="space-between"
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 950, letterSpacing: 0 }}>
            {title}
          </Typography>
          <Typography sx={{ color: "text.secondary" }}>{subtitle}</Typography>
        </Box>
        <Button component={RouterLink} to="/the-pattern" variant="outlined">
          Pattern home
        </Button>
      </Stack>
    </Paper>
  );
}

function GameTable({
  session,
  credentials,
  readOnly = false,
}: {
  session: PatternSessionSnapshot;
  credentials: PatternCredentials;
  readOnly?: boolean;
}) {
  const localGuessHistory = useLocalGuessHistory(session);

  if (session.status === "setup") {
    return <LobbyPanel session={session} />;
  }

  if (session.status === "complete") {
    return (
      <Grid container spacing={2}>
        <Grid item xs={12} lg={8}>
          <LakeBoard session={session} readOnly={readOnly} />
        </Grid>
        <Grid item xs={12} lg={4}>
          <Stack spacing={2}>
            <ResultsPanel session={session} />
            <LogPanel session={session} />
          </Stack>
        </Grid>
      </Grid>
    );
  }

  return (
    <Stack spacing={1.5}>
      <ConditionsBar session={session} />
      <PhaseTrack phase={session.turn?.phase || null} />
      <AnglersStrip session={session} />
      <Grid container spacing={2} alignItems="flex-start">
        <Grid item xs={12} md={8}>
          <Stack spacing={1.5}>
            <LakeBoard session={session} readOnly={readOnly} />
            <PlayerHandPanel
              session={session}
              credentials={credentials}
              readOnly={readOnly}
            />
          </Stack>
        </Grid>
        <Grid item xs={12} md={4}>
          <Stack spacing={2}>
            <DiceRoller session={session} />
            <TurnPanel
              session={session}
              credentials={credentials}
              readOnly={readOnly}
              localGuessHistory={localGuessHistory}
            />
          </Stack>
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid item xs={12} lg={6}>
          <Stack spacing={2}>
            <FishIntelPanel
              session={session}
              currentPlayerCode={session.me?.code || null}
              localGuessHistory={localGuessHistory}
            />
            <RulesPanel />
          </Stack>
        </Grid>
        <Grid item xs={12} lg={6}>
          <LogPanel session={session} />
        </Grid>
      </Grid>
    </Stack>
  );
}

function LobbyPanel({ session }: { session: PatternSessionSnapshot }) {
  return (
    <Paper sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
      <Stack spacing={2}>
        <Typography variant="h5" sx={{ fontWeight: 950 }}>
          Lobby
        </Typography>
        <Grid container spacing={1.5}>
          {session.players.map((player) => (
            <Grid item xs={12} md={6} key={player.code}>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <DirectionsBoatIcon color="primary" />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 900 }}>{player.name}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {player.code}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>
        {session.players.length === 0 && (
          <Alert severity="info">Share the join link and add at least one angler.</Alert>
        )}
      </Stack>
    </Paper>
  );
}

function ConditionsBar({ session }: { session: PatternSessionSnapshot }) {
  return (
    <Paper sx={{ p: 1.5, border: "1px solid", borderColor: "divider" }}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
        <RuleTooltip title={RULE_TEXT.round}>
          <Chip label={`Round ${session.round}/12`} color="primary" />
        </RuleTooltip>
        <RuleTooltip title={seasonRuleText(session.season)}>
          <Chip label={session.season || "Season"} />
        </RuleTooltip>
        <RuleTooltip title={RULE_TEXT.moon}>
          <Chip label={`${session.moon || "Moon"} Moon`} />
        </RuleTooltip>
        <RuleTooltip title={weatherRuleText(session.weather)}>
          <Chip label={session.weather || "Weather"} />
        </RuleTooltip>
        {session.activeEvent && (
          <RuleTooltip title={`${RULE_TEXT.activeEvent} ${session.activeEvent.text}`}>
            <Chip color="secondary" label={session.activeEvent.name} />
          </RuleTooltip>
        )}
      </Stack>
    </Paper>
  );
}

function PhaseTrack({ phase }: { phase: PatternTurnPhase | null }) {
  return (
    <Paper sx={{ p: 1, border: "1px solid", borderColor: "divider" }}>
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
        {TURN_PHASES.map((item) => {
          const active = item === phase;
          return (
            <RuleTooltip key={item} title={RULE_TEXT.phase}>
              <Chip
                size="small"
                label={phaseLabel(item)}
                color={active ? "primary" : "default"}
                variant={active ? "filled" : "outlined"}
                sx={{
                  fontWeight: active ? 950 : 750,
                  opacity: phase ? (active ? 1 : 0.62) : 0.72,
                }}
              />
            </RuleTooltip>
          );
        })}
      </Stack>
    </Paper>
  );
}

function LakeBoard({
  session,
  readOnly,
}: {
  session: PatternSessionSnapshot;
  readOnly: boolean;
}) {
  const lake = session.lake;
  if (!lake) return <LobbyPanel session={session} />;
  const lakeMaxWidth = Math.min(720, lake.width * 170);

  const playersByTile = new Map<string, PatternPlayerPublic[]>();
  session.players.forEach((player) => {
    if (!player.locationTileId) return;
    const list = playersByTile.get(player.locationTileId) || [];
    list.push(player);
    playersByTile.set(player.locationTileId, list);
  });

  const activeFishByCell = new Map<string, { alert: boolean }>();
  lake.activeFish.forEach((fish) => {
    if (!fish.location) return;
    activeFishByCell.set(
      `${fish.location.tileInstanceId}:${fish.location.row}:${fish.location.column}`,
      { alert: fish.alert }
    );
  });

  return (
    <Paper
      sx={{
        p: 1,
        border: "1px solid",
        borderColor: "divider",
        maxHeight: "50vh",
        overflow: "auto",
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: `repeat(${Math.min(lake.width, 2)}, minmax(0, 1fr))`,
            md: `repeat(${lake.width}, minmax(0, 1fr))`,
          },
          gap: 0.75,
          maxWidth: { md: lakeMaxWidth },
          mx: "auto",
        }}
      >
        {lake.tiles
          .slice()
          .sort((a, b) => a.row - b.row || a.column - b.column)
          .map((tile) => (
            <LocationTile
              key={tile.id}
              tile={tile}
              players={playersByTile.get(tile.id) || []}
              activeFishByCell={activeFishByCell}
              selected={session.turn?.cast?.tileId === tile.id}
              cast={session.turn?.cast || null}
              readOnly={readOnly}
            />
          ))}
      </Box>
    </Paper>
  );
}

function LocationTile({
  tile,
  players,
  activeFishByCell,
  selected,
  cast,
}: {
  tile: PatternTile;
  players: PatternPlayerPublic[];
  activeFishByCell: Map<string, { alert: boolean }>;
  selected: boolean;
  cast: NonNullable<PatternSessionSnapshot["turn"]>["cast"];
  readOnly: boolean;
}) {
  const shoreAtTop = tile.rotation === 180;
  return (
    <Paper
      variant="outlined"
      sx={{
        position: "relative",
        p: 0.75,
        pt: shoreAtTop ? 1.55 : 0.75,
        pb: shoreAtTop ? 0.75 : 1.55,
        borderColor: selected ? "primary.main" : "divider",
        bgcolor: selected ? alpha("#087f8c", 0.07) : "background.paper",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          left: 8,
          right: 8,
          top: shoreAtTop ? 6 : "auto",
          bottom: shoreAtTop ? "auto" : 6,
          height: 7,
          borderRadius: 99,
          bgcolor: "#d8bb86",
          border: "1px solid rgba(124, 78, 31, .22)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.45)",
          pointerEvents: "none",
        }}
      />
      <Stack spacing={0.5}>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0.35 }}>
          {tile.grid.map((row, rowIndex) =>
            row.map((cell, columnIndex) => (
              <LakeCell
                key={`${rowIndex}-${columnIndex}`}
                cell={cell}
                fishState={activeFishByCell.get(`${tile.id}:${rowIndex}:${columnIndex}`)}
                target={rowIndex === 1 && columnIndex === 1}
                castLanded={
                  cast?.tileId === tile.id && cast.row === rowIndex && cast.column === columnIndex
                }
              />
            ))
          )}
        </Box>
        {players.length > 0 && (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {players.map((player) => (
              <RuleTooltip key={player.code} title={RULE_TEXT.boat}>
                <Chip size="small" icon={<DirectionsBoatIcon />} label={player.name} />
              </RuleTooltip>
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

function LakeCell({
  cell,
  fishState,
  target,
  castLanded,
}: {
  cell: Habitat[];
  fishState?: { alert: boolean };
  target: boolean;
  castLanded: boolean;
}) {
  const cellRule = cell.includes("M")
    ? RULE_TEXT.muck
    : `${target ? `${RULE_TEXT.targetCell} ` : ""}${
        castLanded ? `${RULE_TEXT.castLanding} ` : ""
      }${RULE_TEXT.habitatIcon}`;
  const primaryHabitat = cell.includes("M") ? "M" : cell[0] || "O";
  return (
    <RuleTooltip title={cellRule} block>
      <Box
        sx={{
          minHeight: { xs: 46, md: 54 },
          aspectRatio: "1 / 1",
          border: "1px solid",
          borderColor: target ? "primary.main" : "divider",
          bgcolor: habitatCellBackgrounds[primaryHabitat],
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 0.5,
          overflow: "hidden",
        }}
      >
        <Box sx={{ position: "absolute", inset: 4, zIndex: 1 }}>
          {cell.map((habitat, index) => (
            <HabitatGlyph
              key={`${habitat}-${index}`}
              habitat={habitat}
              index={index}
              count={cell.length}
            />
          ))}
        </Box>
        {target && (
          <Box
            sx={{
              position: "absolute",
              inset: 5,
              border: "1px dashed",
              borderColor: "primary.main",
              pointerEvents: "none",
            }}
          />
        )}
        {castLanded && (
          <RuleTooltip title={RULE_TEXT.castLanding}>
            <Box
              sx={{
                position: "absolute",
                left: 3,
                bottom: 1,
                zIndex: 20,
                pointerEvents: "auto",
              }}
            >
              <BobberIcon />
            </Box>
          </RuleTooltip>
        )}
        {fishState && (
          <RuleTooltip
            title={
              fishState.alert
                ? `${RULE_TEXT.activeFish} ${RULE_TEXT.alertFish}`
                : RULE_TEXT.activeFish
            }
          >
            <Box
              sx={{
                position: "absolute",
                right: 4,
                bottom: 4,
                zIndex: 30,
                width: 22,
                height: 22,
                borderRadius: "50%",
                bgcolor: "#f97316",
                color: "#fff7ed",
                display: "grid",
                placeItems: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,.25)",
              }}
            >
              <FishEmojiIcon size={16} />
              {fishState.alert && (
                <Box
                  sx={{
                    position: "absolute",
                    top: -8,
                    right: -8,
                    zIndex: 31,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    bgcolor: "#facc15",
                    color: "#7c2d12",
                    display: "grid",
                    placeItems: "center",
                    border: "2px solid #fff7ed",
                    boxShadow: "0 2px 7px rgba(0,0,0,.28)",
                  }}
                >
                  <WarningAmberIcon sx={{ fontSize: 13 }} />
                </Box>
              )}
            </Box>
          </RuleTooltip>
        )}
      </Box>
    </RuleTooltip>
  );
}

function SetResultPanel({ result }: { result: PatternSetResult }) {
  const isWait = result.mode === "wait";
  const severity =
    (isWait && result.waitSpit) || (!isWait && result.hookSuccess === false)
      ? "warning"
      : !isWait && result.hookSuccess
      ? "success"
      : "info";

  return (
    <Alert severity={severity}>
      <Stack spacing={1}>
        <Typography sx={{ fontWeight: 950 }}>
          {isWait ? "Wait Result" : result.hardSet ? "Hard Set Result" : "Hook Set Result"}
        </Typography>
        <Typography variant="body2">
          {isWait ? waitResultText(result) : hookSetResultText(result)}
        </Typography>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          {isWait ? (
            <>
              <RuleTooltip title={RULE_TEXT.wait}>
                <Chip size="small" label={`Wait roll ${result.waitRoll ?? "-"}`} />
              </RuleTooltip>
              <RuleTooltip title={RULE_TEXT.wait}>
                <Chip
                  size="small"
                  color={result.waitSpit ? "warning" : result.waitBonus ? "success" : "default"}
                  variant={result.waitSpit || result.waitBonus ? "filled" : "outlined"}
                  label={
                    result.waitSpit
                      ? "Fish spits"
                      : result.waitBonus
                      ? `Hook Set ${formatModifier(result.waitBonus)}`
                      : "No bonus"
                  }
                />
              </RuleTooltip>
            </>
          ) : (
            <>
              <RuleTooltip title={RULE_TEXT.hookSet}>
                <Chip
                  size="small"
                  color={result.hookSuccess ? "success" : "warning"}
                  label={`Roll ${result.hookRoll ?? "-"} vs ${result.hookTarget ?? "-"}+`}
                />
              </RuleTooltip>
              <RuleTooltip title={RULE_TEXT.hookSet}>
                <Chip
                  size="small"
                  color={result.hookSuccess ? "success" : "warning"}
                  variant={result.hookSuccess ? "filled" : "outlined"}
                  label={result.hookSuccess ? "Hooked" : "Miss"}
                />
              </RuleTooltip>
              <HookSetModifierChips details={result.hookDetails} modifier={result.hookModifier} />
            </>
          )}
        </Stack>
      </Stack>
    </Alert>
  );
}

function HookSetModifierChips({
  details,
  modifier,
}: {
  details?: PatternModifierDetail[];
  modifier: number | null;
}) {
  const normalizedDetails = normalizeModifierDetails(details);
  const total = modifier || 0;

  return (
    <>
      {normalizedDetails.length === 0 && total === 0 && (
        <RuleTooltip title={RULE_TEXT.hookSet}>
          <Chip size="small" variant="outlined" label="No Hook Set modifiers" />
        </RuleTooltip>
      )}
      {normalizedDetails.length === 0 && total !== 0 && (
        <RuleTooltip title={RULE_TEXT.hookSet}>
          <Chip
            size="small"
            color={total > 0 ? "success" : "warning"}
            variant="outlined"
            label={`Total ${formatModifier(total)}`}
          />
        </RuleTooltip>
      )}
      {normalizedDetails.map((detail) => (
        <RuleTooltip key={`${detail.label}-${detail.value}`} title={RULE_TEXT.hookSet}>
          <Chip
            size="small"
            color={detail.value > 0 ? "success" : detail.value < 0 ? "warning" : "default"}
            variant="outlined"
            label={`${detail.label} ${formatModifier(detail.value)}`}
          />
        </RuleTooltip>
      ))}
      {normalizedDetails.length > 0 && (
        <RuleTooltip title={RULE_TEXT.hookSet}>
          <Chip
            size="small"
            color={total > 0 ? "success" : total < 0 ? "warning" : "default"}
            label={`Total ${formatModifier(total)}`}
          />
        </RuleTooltip>
      )}
    </>
  );
}

function waitResultText(result: PatternSetResult) {
  if (result.waitSpit) {
    return `Wait roll ${result.waitRoll}: the Fish will spit the lure when you proceed.`;
  }
  if (result.waitBonus) {
    return `Wait roll ${result.waitRoll}: the Fish committed. Proceed to Hook Set with ${formatModifier(
      result.waitBonus
    )}.`;
  }
  return `Wait roll ${result.waitRoll}: the Fish still has it. Proceed to Hook Set with no Wait bonus.`;
}

function hookSetResultText(result: PatternSetResult) {
  if (result.hookSuccess) {
    return `Hook Set roll ${result.hookRoll} vs ${result.hookTarget}+: success. Proceed to reveal Fight and start Battle.`;
  }
  return `Hook Set roll ${result.hookRoll} vs ${result.hookTarget}+: miss. Proceed to resolve the failed Hook Set window.`;
}

function setProceedButtonLabel(result: PatternSetResult | null) {
  if (!result) return "Proceed";
  if (result.mode === "wait") {
    return result.waitSpit ? "Resolve Wait" : "Proceed to Hook Set";
  }
  return result.hookSuccess ? "Proceed to Battle" : "Resolve Hook Set";
}

function TurnPanel({
  session,
  credentials,
  readOnly,
  localGuessHistory,
}: {
  session: PatternSessionSnapshot;
  credentials: PatternCredentials;
  readOnly: boolean;
  localGuessHistory: GuessHistoryByFish;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lure, setLure] = useState<LureType>("Jig");
  const [color, setColor] = useState<LureColor>("Natural");
  const [retrieve, setRetrieve] = useState<RetrieveType>("Slow");
  const [hardSet, setHardSet] = useState(false);
  const [showOff, setShowOff] = useState(false);
  const [releaseFishId, setReleaseFishId] = useState("");
  const me = session.me || null;
  const activePlayer = session.players.find((player) => player.code === session.turn?.playerId);
  const isMyTurn = Boolean(me && session.turn?.playerId === me.code);
  const phase = session.turn?.phase;
  const setResult = session.turn?.setResult || null;
  const canProceedSet = useSetProceedReady(setResult?.id, setResult?.proceedAfter);
  const selectedFish = session.lake?.activeFish.find(
    (fish) => fish.publicId === session.turn?.selectedFishPublicId
  );

  const run = useCallback(
    async (command: Record<string, unknown>) => {
      setBusy(true);
      setError("");
      try {
        await submitPatternCommand(session.id, credentials, command);
      } catch (caught) {
        setError(messageFromError(caught));
      } finally {
        setBusy(false);
      }
    },
    [credentials, session.id]
  );

  if (readOnly || !me) {
    return (
      <Paper sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Stack spacing={1}>
          <Typography variant="h6" sx={{ fontWeight: 950 }}>
            Turn
          </Typography>
          <Typography sx={{ color: "text.secondary" }}>
            {activePlayer ? `${activePlayer.name}: ${phase}` : "No active turn"}
          </Typography>
          {session.attempt && <AttemptPanel session={session} />}
          {setResult && <SetResultPanel result={setResult} />}
          {session.battle && <BattleTrack battle={session.battle} />}
        </Stack>
      </Paper>
    );
  }

  const canAct = isMyTurn && !busy;

  return (
    <Paper sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 950 }}>
              Turn Panel
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {activePlayer ? `${activePlayer.name} | ${phase}` : "Waiting"}
            </Typography>
          </Box>
          {isMyTurn && <Chip color="primary" label="Your turn" />}
        </Stack>
        {error && <Alert severity="error">{error}</Alert>}
        {!isMyTurn && (
          <Alert severity="info">
            Waiting for {activePlayer?.name || "the active angler"}.
          </Alert>
        )}

        {phase === "immediate" && isMyTurn && (
          <ImmediateControls me={me} busy={!canAct} onCommand={run} />
        )}
        {phase === "move" && isMyTurn && (
          <MoveControls session={session} meCode={me.code} busy={!canAct} onCommand={run} />
        )}
        {phase === "rig" && isMyTurn && (
          <RigControls me={me} busy={!canAct} onCommand={run} />
        )}
        {phase === "cast" && isMyTurn && (
          <RuleTooltip title={RULE_TEXT.cast} block>
            <Button
              variant="contained"
              startIcon={<CasinoIcon />}
              disabled={!canAct}
              onClick={() => run({ command: "cast" })}
            >
              Roll cast
            </Button>
          </RuleTooltip>
        )}
        {phase === "declare" && (
          <Stack spacing={1.5}>
            {selectedFish && (
              <ActiveFishPanel
                fish={selectedFish}
                currentPlayerCode={me.code}
                localGuessHistory={localGuessHistory}
              />
            )}
            {session.attempt && <AttemptPanel session={session} />}
            {isMyTurn && (
              <>
                <Grid container spacing={1}>
                  <Grid item xs={12} sm={4}>
                    <RuleTooltip title={RULE_TEXT.lure} block>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="Lure"
                        value={lure}
                        onChange={(event) => setLure(event.target.value as LureType)}
                      >
                        {LURES.map((item) => (
                          <MenuItem key={item} value={item}>
                            {item}
                          </MenuItem>
                        ))}
                      </TextField>
                    </RuleTooltip>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <RuleTooltip title={RULE_TEXT.color} block>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="Color"
                        value={color}
                        onChange={(event) => setColor(event.target.value as LureColor)}
                      >
                        {COLORS.map((item) => (
                          <MenuItem key={item} value={item}>
                            {item}
                          </MenuItem>
                        ))}
                      </TextField>
                    </RuleTooltip>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <RuleTooltip title={RULE_TEXT.retrieve} block>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="Retrieve"
                        value={retrieve}
                        onChange={(event) => setRetrieve(event.target.value as RetrieveType)}
                      >
                        {RETRIEVES.map((item) => (
                          <MenuItem key={item} value={item}>
                            {item}
                          </MenuItem>
                        ))}
                      </TextField>
                    </RuleTooltip>
                  </Grid>
                </Grid>
                <RuleTooltip title={RULE_TEXT.declare} block>
                  <Button
                    variant="contained"
                    disabled={!canAct}
                    onClick={() =>
                      run({ command: "declare", lure, color, retrieve })
                    }
                  >
                    Lock presentation
                  </Button>
                </RuleTooltip>
              </>
            )}
          </Stack>
        )}
        {phase === "nibble" && (
          <Stack spacing={1.5}>
            {selectedFish && (
              <ActiveFishPanel
                fish={selectedFish}
                currentPlayerCode={me.code}
                localGuessHistory={localGuessHistory}
              />
            )}
            {session.attempt && <AttemptPanel session={session} />}
            {isMyTurn && (
              <RuleTooltip title={RULE_TEXT.nibble} block>
                <Button
                  variant="contained"
                  startIcon={<CasinoIcon />}
                  disabled={!canAct}
                  onClick={() => run({ command: "rollNibble" })}
                >
                  Roll Nibble
                </Button>
              </RuleTooltip>
            )}
          </Stack>
        )}
        {phase === "set" && (
          <Stack spacing={1.5}>
            <AttemptPanel session={session} />
            <Alert severity="info">
              Roll Hook Set now, or Wait once first. Wait rolls d6: 1-2 spits the lure,
              3-4 keeps it with no bonus, and 5-6 adds +2 to Hook Set.
            </Alert>
            {session.turn?.waitUsed && (
              <RuleTooltip title={RULE_TEXT.wait} block>
                <Chip
                  color={session.turn.waitBonus ? "success" : "default"}
                  variant={session.turn.waitBonus ? "filled" : "outlined"}
                  label={
                    session.turn.waitBonus
                      ? `Wait bonus ${formatModifier(session.turn.waitBonus)}`
                      : "Wait used: no bonus"
                  }
                />
              </RuleTooltip>
            )}
            {isMyTurn && (
              <>
                <RuleTooltip title={RULE_TEXT.hardSet} block>
                  <Box component="span" sx={{ display: "block" }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={hardSet}
                          onChange={(event) => setHardSet(event.target.checked)}
                        />
                      }
                      label="Hard Set (+2, starts Battle with Tension)"
                    />
                  </Box>
                </RuleTooltip>
                <Stack direction="row" spacing={1}>
                  <RuleTooltip title={RULE_TEXT.setNow} block>
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={<CasinoIcon />}
                      disabled={!canAct}
                      onClick={() => run({ command: "setHook", mode: "now", hardSet })}
                    >
                      Roll Hook Set
                    </Button>
                  </RuleTooltip>
                  <RuleTooltip title={RULE_TEXT.wait} block>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<CasinoIcon />}
                      disabled={!canAct || session.turn?.waitUsed}
                      onClick={() => run({ command: "setHook", mode: "wait", hardSet })}
                    >
                      Roll Wait
                    </Button>
                  </RuleTooltip>
                </Stack>
              </>
            )}
          </Stack>
        )}
        {(phase === "wait" || phase === "hookSet") && (
          <Stack spacing={1.5}>
            {selectedFish && (
              <ActiveFishPanel
                fish={selectedFish}
                currentPlayerCode={me.code}
                localGuessHistory={localGuessHistory}
              />
            )}
            {session.attempt && <AttemptPanel session={session} />}
            {setResult && <SetResultPanel result={setResult} />}
            {isMyTurn && (
              <RuleTooltip title={RULE_TEXT.proceedSet} block>
                <Button
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  disabled={!canAct || !canProceedSet || !setResult}
                  onClick={() => run({ command: "proceedSet" })}
                >
                  {canProceedSet ? setProceedButtonLabel(setResult) : "Rolling..."}
                </Button>
              </RuleTooltip>
            )}
          </Stack>
        )}
        {phase === "battle" && (
          <Stack spacing={1.5}>
            {session.battle && <BattleTrack battle={session.battle} />}
            {selectedFish && (
              <ActiveFishPanel
                fish={selectedFish}
                currentPlayerCode={me.code}
                localGuessHistory={localGuessHistory}
              />
            )}
            {isMyTurn && (
              <Grid container spacing={1}>
                {(["reel", "pressure", "giveLine"] as BattleAction[]).map((action) => (
                  <Grid item xs={12} sm={4} key={action}>
                    <RuleTooltip title={battleActionRuleText(action)} block>
                      <Button
                        fullWidth
                        variant={action === "pressure" ? "contained" : "outlined"}
                        disabled={!canAct}
                        onClick={() => run({ command: "battleStep", action })}
                      >
                        {action === "giveLine"
                          ? "Give Line"
                          : action === "pressure"
                          ? "Pressure"
                          : "Reel"}
                      </Button>
                    </RuleTooltip>
                  </Grid>
                ))}
              </Grid>
            )}
          </Stack>
        )}
        {phase === "livewell" && isMyTurn && me.pendingCatch && (
          <Stack spacing={1.5}>
            <PrivateFishPanel
              fish={me.pendingCatch}
              label="Landed Fish"
              currentPlayerCode={me.code}
            />
            <RuleTooltip title={RULE_TEXT.showOff} block>
              <Box component="span" sx={{ display: "block" }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={showOff}
                      onChange={(event) => setShowOff(event.target.checked)}
                    />
                  }
                  label="Show Off publicly and draw 1 Action card"
                />
              </Box>
            </RuleTooltip>
            {me.livewell.length >= 3 && (
              <RuleTooltip title={RULE_TEXT.cull} block>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Release one Fish"
                  value={releaseFishId}
                  onChange={(event) => setReleaseFishId(event.target.value)}
                >
                  <MenuItem value={me.pendingCatch.id}>
                    New Fish | {me.pendingCatch.weight.toFixed(1)} lb
                  </MenuItem>
                  {me.livewell.map((slot) => (
                    <MenuItem key={slot.fish.id} value={slot.fish.id}>
                      Slot {slot.slot} | {slot.fish.weight.toFixed(1)} lb
                    </MenuItem>
                  ))}
                </TextField>
              </RuleTooltip>
            )}
            <RuleTooltip title={RULE_TEXT.livewell} block>
              <Button
                variant="contained"
                disabled={!canAct || (me.livewell.length >= 3 && !releaseFishId)}
                onClick={() =>
                  run({
                    command: "livewell",
                    reveal: showOff,
                    releaseFishId: releaseFishId || undefined,
                  })
                }
              >
                Confirm livewell
              </Button>
            </RuleTooltip>
          </Stack>
        )}
        {phase === "cleanup" && isMyTurn && (
          <Stack spacing={1}>
            {me.hand.length > 5 && (
              <Alert severity="warning">Discard down to 5 cards.</Alert>
            )}
            <RuleTooltip title={RULE_TEXT.cleanup} block>
              <Button
                variant="contained"
                disabled={!canAct || me.hand.length > 5}
                onClick={() => run({ command: "endTurn" })}
              >
                End turn
              </Button>
            </RuleTooltip>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

function ImmediateControls({
  me,
  busy,
  onCommand,
}: {
  me: NonNullable<PatternSessionSnapshot["me"]>;
  busy: boolean;
  onCommand: (command: Record<string, unknown>) => void;
}) {
  const card = me.hand.find((item) => item.id === me.pendingImmediateCardId);
  if (!card) return <Alert severity="warning">Immediate card not found in hand.</Alert>;

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack spacing={1}>
        <RuleTooltip title={cardRuleText(card)}>
          <Typography sx={{ fontWeight: 950 }}>{card.name}</Typography>
        </RuleTooltip>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {card.text}
        </Typography>
        <Stack direction="row" spacing={1}>
          <RuleTooltip title={RULE_TEXT.activeEvent} block>
            <Button
              fullWidth
              variant="contained"
              startIcon={<CheckIcon />}
              disabled={busy}
              onClick={() => onCommand({ command: "immediate", play: true })}
            >
              Play now
            </Button>
          </RuleTooltip>
          <RuleTooltip title={RULE_TEXT.deadCard} block>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<CloseIcon />}
              disabled={busy}
              onClick={() => onCommand({ command: "immediate", play: false })}
            >
              Decline
            </Button>
          </RuleTooltip>
        </Stack>
      </Stack>
    </Paper>
  );
}

function MoveControls({
  session,
  meCode,
  busy,
  onCommand,
}: {
  session: PatternSessionSnapshot;
  meCode: string;
  busy: boolean;
  onCommand: (command: Record<string, unknown>) => void;
}) {
  const mePublic = session.players.find((player) => player.code === meCode);
  const legalTileIds = new Set([
    mePublic?.locationTileId || "",
    ...(session.me?.adjacentTileIds || []),
  ]);
  const tiles = session.lake?.tiles.filter((tile) => legalTileIds.has(tile.id)) || [];

  return (
    <Stack spacing={1}>
      <Typography sx={{ fontWeight: 900 }}>Move</Typography>
      {tiles.map((tile) => (
        <RuleTooltip key={tile.id} title={RULE_TEXT.move} block>
          <Button
            variant={tile.id === mePublic?.locationTileId ? "contained" : "outlined"}
            disabled={busy}
            onClick={() => onCommand({ command: "move", tileId: tile.id })}
          >
            {tile.id === mePublic?.locationTileId ? "Stay at " : "Move to "}
            {tile.name}
          </Button>
        </RuleTooltip>
      ))}
    </Stack>
  );
}

function RigControls({
  me,
  busy,
  onCommand,
}: {
  me: NonNullable<PatternSessionSnapshot["me"]>;
  busy: boolean;
  onCommand: (command: Record<string, unknown>) => void;
}) {
  const tackle = me.hand.filter((card) => card.category === "tackle");
  return (
    <Stack spacing={1.5}>
      <Typography sx={{ fontWeight: 900 }}>Rig / Equip</Typography>
      {tackle.length > 0 ? (
        <RuleTooltip title={RULE_TEXT.tackle}>
          <Chip label={`${tackle.length} Tackle in hand`} />
        </RuleTooltip>
      ) : (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          No Tackle cards in hand.
        </Typography>
      )}
      <RuleTooltip title={RULE_TEXT.rig} block>
        <Button
          variant="contained"
          disabled={busy}
          onClick={() => onCommand({ command: "finishRig" })}
        >
          Continue to cast
        </Button>
      </RuleTooltip>
    </Stack>
  );
}

function AttemptPanel({ session }: { session: PatternSessionSnapshot }) {
  const attempt = session.attempt;
  if (!attempt) return null;
  const displayedNibbleTarget = nibbleTargetForMatches(attempt.matchCount);
  const hasNibbleRoll = attempt.nibbleRoll !== null;
  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <RuleTooltip title={RULE_TEXT.mood}>
            <Chip label={`Mood: ${attempt.moodCategory.toUpperCase()}`} color="primary" />
          </RuleTooltip>
          <RuleTooltip title={habitatRuleText(attempt.habitat)}>
            <Chip label={attempt.habitatLabel} />
          </RuleTooltip>
        </Stack>
        {attempt.declaration && (
          <RuleTooltip title={RULE_TEXT.declare}>
            <Typography variant="body2">
              {attempt.declaration.lure} / {attempt.declaration.color} /{" "}
              {attempt.declaration.retrieve}
            </Typography>
          </RuleTooltip>
        )}
        {attempt.biteBoxResolved && (
          <Stack spacing={0.75}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <RuleTooltip title={RULE_TEXT.biteBox}>
                <Chip
                  icon={<CasinoIcon />}
                  label={`${attempt.matchCount} Matches -> DC ${displayedNibbleTarget}`}
                  color="secondary"
                />
              </RuleTooltip>
              <RuleTooltip title={RULE_TEXT.hotHit}>
                <Chip
                  label={attempt.hotHit ? "Hot Hit +1" : "No Hot Hit"}
                  color={attempt.hotHit ? "warning" : "default"}
                  variant={attempt.hotHit ? "filled" : "outlined"}
                />
              </RuleTooltip>
              <RuleTooltip title={RULE_TEXT.nibble}>
                <Chip
                  label={
                    hasNibbleRoll
                      ? `Nibble ${attempt.nibbleRoll}${formatModifier(
                          attempt.nibbleModifier
                        )} vs DC ${displayedNibbleTarget}`
                      : `Nibble ready vs DC ${displayedNibbleTarget}`
                  }
                  color={
                    hasNibbleRoll && attempt.nibbleSuccess
                      ? "success"
                      : hasNibbleRoll
                      ? "default"
                      : "primary"
                  }
                  variant={hasNibbleRoll ? "filled" : "outlined"}
                />
              </RuleTooltip>
            </Stack>
            <NibbleModifierChips
              details={attempt.nibbleDetails}
              modifier={attempt.nibbleModifier}
              rawModifier={attempt.nibbleRawModifier}
            />
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

function NibbleModifierChips({
  details,
  modifier,
  rawModifier,
}: {
  details?: PatternModifierDetail[];
  modifier: number | null;
  rawModifier?: number | null;
}) {
  const normalizedDetails = normalizeModifierDetails(details);
  const extraDetails = normalizedDetails.filter((detail) => detail.label !== "Hot Hit");
  const total = modifier || 0;
  const rawTotal = rawModifier ?? total;
  const capped = rawTotal !== total;

  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
      {extraDetails.length === 0 && !capped && total === 0 && (
        <RuleTooltip title={RULE_TEXT.nibble}>
          <Chip size="small" variant="outlined" label="No Nibble modifiers" />
        </RuleTooltip>
      )}
      {extraDetails.length === 0 && !capped && total !== 0 && (
        <RuleTooltip title={RULE_TEXT.nibble}>
          <Chip
            size="small"
            color={total > 0 ? "success" : "warning"}
            variant="outlined"
            label={`Total ${formatModifier(total)}`}
          />
        </RuleTooltip>
      )}
      {extraDetails.map((detail) => (
        <RuleTooltip key={`${detail.label}-${detail.value}`} title={RULE_TEXT.nibble}>
          <Chip
            size="small"
            color={detail.value > 0 ? "success" : detail.value < 0 ? "warning" : "default"}
            variant="outlined"
            label={`${detail.label} ${formatModifier(detail.value)}`}
          />
        </RuleTooltip>
      ))}
      {capped && (
        <RuleTooltip title={RULE_TEXT.nibble}>
          <Chip
            size="small"
            color="warning"
            label={`Cap ${formatModifier(rawTotal)} -> ${formatModifier(total)}`}
          />
        </RuleTooltip>
      )}
    </Stack>
  );
}

function ActiveFishPanel({
  fish,
  currentPlayerCode,
  localGuessHistory,
}: {
  fish: NonNullable<PatternSessionSnapshot["lake"]>["activeFish"][number];
  currentPlayerCode?: string | null;
  localGuessHistory?: GuessHistoryByFish;
}) {
  const history = guessHistoryForFish(fish, localGuessHistory);
  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <FishEmojiIcon size={22} />
          <RuleTooltip title={RULE_TEXT.activeFish}>
            <Typography sx={{ fontWeight: 950 }}>{fish.habitatLabel} Fish</Typography>
          </RuleTooltip>
          {fish.alert && (
            <RuleTooltip title={RULE_TEXT.alertFish}>
              <Chip
                size="small"
                color="warning"
                icon={<WarningAmberIcon />}
                label="Alert"
                sx={{ fontWeight: 950 }}
              />
            </RuleTooltip>
          )}
        </Stack>
        <TellChips tell={fish.tell} />
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <RuleTooltip title={RULE_TEXT.fight}>
            <Chip label={fish.fight ? `Fight ${fish.fight}` : "Fight hidden"} />
          </RuleTooltip>
          <RuleTooltip title={abilityRuleText(fish.ability)}>
            <Chip label={fish.ability ? abilityLabel(fish.ability) : "Ability hidden"} />
          </RuleTooltip>
          <RuleTooltip title={RULE_TEXT.weight}>
            <Chip label="Weight hidden" />
          </RuleTooltip>
        </Stack>
        <MastermindHistory history={history} currentPlayerCode={currentPlayerCode} />
      </Stack>
    </Paper>
  );
}

function FishIntelPanel({
  session,
  currentPlayerCode,
  localGuessHistory,
}: {
  session: PatternSessionSnapshot;
  currentPlayerCode?: string | null;
  localGuessHistory: GuessHistoryByFish;
}) {
  const activeFish = session.lake?.activeFish || [];
  if (activeFish.length === 0) return null;

  return (
    <Paper sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
      <Stack spacing={1}>
        <Typography variant="h6" sx={{ fontWeight: 950 }}>
          Active Fish Intel
        </Typography>
        {activeFish.map((fish, index) => {
          const history = guessHistoryForFish(fish, localGuessHistory);
          return (
            <Accordion key={fish.publicId} disableGutters sx={{ border: "1px solid", borderColor: "divider" }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack
                  direction="row"
                  spacing={0.75}
                  alignItems="center"
                  flexWrap="wrap"
                  useFlexGap
                  sx={{ minWidth: 0 }}
                >
                  <FishEmojiIcon size={18} />
                  <Typography sx={{ fontWeight: 900 }}>
                    {fish.habitatLabel} Fish {index + 1}
                  </Typography>
                  <Chip size="small" label={`${history.length} guesses`} />
                  {fish.alert && (
                    <Chip size="small" color="warning" icon={<WarningAmberIcon />} label="Alert" />
                  )}
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1}>
                  <TellChips tell={fish.tell} />
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    <RuleTooltip title={RULE_TEXT.fight}>
                      <Chip size="small" label={fish.fight ? `Fight ${fish.fight}` : "Fight hidden"} />
                    </RuleTooltip>
                    <RuleTooltip title={abilityRuleText(fish.ability)}>
                      <Chip
                        size="small"
                        label={fish.ability ? abilityLabel(fish.ability) : "Ability hidden"}
                      />
                    </RuleTooltip>
                  </Stack>
                  <MastermindHistory history={history} currentPlayerCode={currentPlayerCode} />
                </Stack>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Stack>
    </Paper>
  );
}

function MastermindHistory({
  history,
  currentPlayerCode,
}: {
  history: PatternFishGuess[];
  currentPlayerCode?: string | null;
}) {
  const guessed = guessedMethods(history);
  const guessedCount = guessed.size;
  const recentHistory = history.slice(-5).reverse();

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1,
        bgcolor: alpha("#087f8c", 0.04),
      }}
    >
      <Stack spacing={0.9}>
        <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="space-between">
          <RuleTooltip title={RULE_TEXT.biteBox}>
            <Typography variant="caption" sx={{ fontWeight: 950 }}>
              Mastermind
            </Typography>
          </RuleTooltip>
          <Chip size="small" label={`${guessedCount}/14 tried`} />
        </Stack>
        {recentHistory.length > 0 ? (
          <Stack spacing={0.55}>
            {recentHistory.map((guess, index) => {
              const ownGuess = guess.playerId === currentPlayerCode;
              const nibbleTarget = nibbleTargetForMatches(guess.matchCount);
              return (
                <Box
                  key={guess.id}
                  sx={{
                    p: 0.75,
                    border: "1px solid",
                    borderColor: ownGuess ? "primary.main" : "divider",
                    bgcolor: ownGuess ? alpha("#087f8c", 0.07) : "background.paper",
                  }}
                >
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Chip
                      size="small"
                      color={guess.matchCount >= 2 ? "success" : "default"}
                      label={`${guess.matchCount}/3 right`}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`DC ${nibbleTarget}`}
                    />
                    {guess.hotHit && (
                      <Chip size="small" color="warning" label="Hot Hit +1" />
                    )}
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography
                        variant="caption"
                        sx={{ display: "block", color: "text.secondary", lineHeight: 1.2 }}
                      >
                        {ownGuess ? "You" : guess.playerName} | Round {guess.round}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block",
                          fontWeight: 850,
                          lineHeight: 1.25,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {guess.declaration.lure} / {guess.declaration.color} /{" "}
                        {guess.declaration.retrieve}
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      #{history.length - index}
                    </Typography>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        ) : (
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            No guesses on this Fish yet.
          </Typography>
        )}
        <MethodCoverage guessed={guessed} />
      </Stack>
    </Paper>
  );
}

function MethodCoverage({ guessed }: { guessed: Set<string> }) {
  return (
    <Stack spacing={0.55}>
      <MethodGroup label="Lure" prefix="lure" values={LURES} guessed={guessed} />
      <MethodGroup label="Color" prefix="color" values={COLORS} guessed={guessed} />
      <MethodGroup label="Retrieve" prefix="retrieve" values={RETRIEVES} guessed={guessed} />
    </Stack>
  );
}

function MethodGroup({
  label,
  prefix,
  values,
  guessed,
}: {
  label: string;
  prefix: "lure" | "color" | "retrieve";
  values: string[];
  guessed: Set<string>;
}) {
  return (
    <Stack direction="row" spacing={0.45} flexWrap="wrap" useFlexGap alignItems="center">
      <Typography variant="caption" sx={{ width: 52, fontWeight: 950 }}>
        {label}
      </Typography>
      {values.map((value) => {
        const tried = guessed.has(`${prefix}:${value}`);
        return (
          <RuleTooltip
            key={value}
            title={
              tried
                ? `${value} has been tried against this Fish. The game only reveals total matches, not which exact method is correct.`
                : `${value} has not been tried against this Fish yet.`
            }
          >
            <Chip
              size="small"
              variant={tried ? "filled" : "outlined"}
              color={tried ? "primary" : "default"}
              label={value}
              sx={{
                height: 22,
                fontSize: 11,
                opacity: tried ? 1 : 0.54,
                "& .MuiChip-label": { px: 0.75 },
              }}
            />
          </RuleTooltip>
        );
      })}
    </Stack>
  );
}

function BattleTrack({ battle }: { battle: NonNullable<PatternSessionSnapshot["battle"]> }) {
  const spaces = ["LANDED", "1", "2", "3", "4", "5", "6", "7", "ESCAPED"];
  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
          <RuleTooltip title={RULE_TEXT.battleTrack}>
            <Typography sx={{ fontWeight: 950 }}>Battle Track</Typography>
          </RuleTooltip>
          {battle.tension && (
            <RuleTooltip title={RULE_TEXT.tension}>
              <Chip size="small" color="warning" label="Tension" />
            </RuleTooltip>
          )}
          {battle.tangled && (
            <RuleTooltip title={RULE_TEXT.tangle}>
              <Chip size="small" color="secondary" label="Tangle" />
            </RuleTooltip>
          )}
          {battle.abilityUsed && (
            <RuleTooltip title={RULE_TEXT.ability}>
              <Chip size="small" label="Ability used" />
            </RuleTooltip>
          )}
        </Stack>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 0.5 }}>
          {spaces.map((space, index) => {
            const active = index === battle.position;
            return (
              <RuleTooltip key={space} title={RULE_TEXT.battleTrack} block>
                <Box
                  sx={{
                    minHeight: 42,
                    display: "grid",
                    placeItems: "center",
                    border: "1px solid",
                    borderColor: active ? "secondary.main" : "divider",
                    bgcolor: active ? alpha("#c2410c", 0.13) : "#fffefa",
                    fontWeight: 950,
                    fontSize: { xs: 10, sm: 12 },
                  }}
                >
                  {space}
                </Box>
              </RuleTooltip>
            );
          })}
        </Box>
      </Stack>
    </Paper>
  );
}

function AnglersStrip({ session }: { session: PatternSessionSnapshot }) {
  const activePlayerCode = session.turn?.playerId;
  if (session.players.length === 0) return null;

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 0.75,
      }}
    >
      {session.players.map((player) => {
        const isActive = player.code === activePlayerCode;
        const isMe = player.code === session.me?.code;
        return (
          <Paper
            key={player.code}
            variant="outlined"
            sx={{
              p: 0.85,
              minHeight: 102,
              borderColor: isActive ? "primary.main" : "divider",
              bgcolor: isActive ? alpha("#087f8c", 0.07) : "background.paper",
              overflow: "hidden",
            }}
          >
            <Stack spacing={0.55}>
              <Stack direction="row" spacing={0.65} alignItems="center" sx={{ minWidth: 0 }}>
                <DirectionsBoatIcon sx={{ fontSize: 18, color: isActive ? "primary.main" : "text.secondary" }} />
                <Typography
                  variant="body2"
                  sx={{
                    minWidth: 0,
                    flex: 1,
                    fontWeight: 950,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {player.name}
                  {isMe ? " (You)" : ""}
                </Typography>
                {isActive && <Chip size="small" color="primary" label="Turn" sx={{ height: 20 }} />}
              </Stack>
              <Stack direction="row" spacing={0.35} flexWrap="wrap" useFlexGap>
                {(["rod", "reel", "line"] as const).map((kind) => (
                  <RuleTooltip
                    key={kind}
                    title={equipmentRuleText(kind, player.equipment[kind])}
                  >
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`${kind[0].toUpperCase()}: ${player.equipment[kind]}`}
                      sx={{
                        maxWidth: "100%",
                        height: 20,
                        fontSize: 10,
                        "& .MuiChip-label": {
                          px: 0.55,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        },
                      }}
                    />
                  </RuleTooltip>
                ))}
              </Stack>
              <Stack direction="row" spacing={0.35} flexWrap="wrap" useFlexGap>
                <RuleTooltip title={RULE_TEXT.handCount}>
                  <Chip size="small" label={`${player.handCount} cards`} sx={{ height: 20, fontSize: 10 }} />
                </RuleTooltip>
                <RuleTooltip title={RULE_TEXT.livewell}>
                  <Chip
                    size="small"
                    label={`${player.livewell.length}/3 livewell`}
                    sx={{ height: 20, fontSize: 10 }}
                  />
                </RuleTooltip>
                {player.tackleSlots.map((card) => (
                  <RuleTooltip key={card.id} title={cardRuleText(card)}>
                    <Chip
                      size="small"
                      color="secondary"
                      variant="outlined"
                      label={card.name}
                      sx={{
                        maxWidth: "100%",
                        height: 20,
                        fontSize: 10,
                        "& .MuiChip-label": {
                          px: 0.55,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        },
                      }}
                    />
                  </RuleTooltip>
                ))}
              </Stack>
            </Stack>
          </Paper>
        );
      })}
    </Box>
  );
}

function PlayerHandPanel({
  session,
  credentials,
  readOnly,
}: {
  session: PatternSessionSnapshot;
  credentials: PatternCredentials;
  readOnly: boolean;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const me = session.me || null;
  if (!me) return null;
  const phase = session.turn?.phase || null;
  const isMyTurn = session.turn?.playerId === me.code;
  const canAct = isMyTurn && !readOnly && !busy;
  const mePublic = session.players.find((player) => player.code === me.code);
  const equippedTackle = mePublic?.tackleSlots || [];
  const equippedActionLabel = () => {
    if (!isMyTurn || readOnly || phase !== "rig") return null;
    return "Unequip";
  };
  const handActionLabel = (card: PatternCard) => {
    if (!isMyTurn || readOnly) return null;
    if (phase === "cleanup") return "Discard";
    if (phase === "rig" && card.category === "tackle") return "Equip";
    return null;
  };

  async function run(command: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await submitPatternCommand(session.id, credentials, command);
    } catch (caught) {
      setError(messageFromError(caught));
    } finally {
      setBusy(false);
    }
  }

  function handleHandAction(card: PatternCard) {
    if (phase === "cleanup") {
      run({ command: "discard", cardId: card.id });
    } else if (phase === "rig" && card.category === "tackle") {
      run({ command: "equipTackle", cardId: card.id });
    }
  }

  function handleEquippedAction(card: PatternCard) {
    if (phase === "rig") {
      run({ command: "unequipTackle", cardId: card.id });
    }
  }

  return (
    <Paper sx={{ p: 1.5, border: "1px solid", borderColor: "divider" }}>
      <Stack spacing={1.25}>
        {equippedTackle.length > 0 && (
          <>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <RuleTooltip title={RULE_TEXT.tackle}>
                <Typography sx={{ fontWeight: 950 }}>Equipped Tackle</Typography>
              </RuleTooltip>
              <RuleTooltip title={RULE_TEXT.tackle}>
                <Chip size="small" label={`${equippedTackle.length}/2 equipped`} />
              </RuleTooltip>
            </Stack>
            <HandList
              cards={equippedTackle}
              actionLabel={equippedActionLabel}
              disabled={!canAct}
              onAction={handleEquippedAction}
            />
            <Divider />
          </>
        )}
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <RuleTooltip title={RULE_TEXT.hand}>
            <Typography sx={{ fontWeight: 950 }}>Your Hand</Typography>
          </RuleTooltip>
          <RuleTooltip title={RULE_TEXT.hand}>
            <Chip size="small" label={`${me.hand.length} cards`} />
          </RuleTooltip>
        </Stack>
        {error && <Alert severity="error">{error}</Alert>}
        {phase === "cleanup" && isMyTurn && me.hand.length > 5 && (
          <Alert severity="warning">Discard down to 5 cards.</Alert>
        )}
        <HandList
          cards={me.hand}
          actionLabel={handActionLabel}
          disabled={!canAct}
          onAction={handleHandAction}
        />
        {me.livewell.length > 0 && (
          <>
            <Divider />
            <Typography sx={{ fontWeight: 950 }}>Your Livewell</Typography>
            <Grid container spacing={1}>
              {me.livewell.map((slot) => (
                <Grid item xs={12} md={4} key={slot.fish.id}>
                  <PrivateFishPanel
                    fish={slot.fish}
                    label={`Slot ${slot.slot}${slot.revealed ? " | public" : " | secret"}`}
                    currentPlayerCode={me.code}
                  />
                </Grid>
              ))}
            </Grid>
          </>
        )}
      </Stack>
    </Paper>
  );
}

function HandList({
  cards,
  actionLabel,
  disabled = false,
  onAction,
}: {
  cards: PatternCard[];
  actionLabel?: string | ((card: PatternCard) => string | null);
  disabled?: boolean;
  onAction?: (card: PatternCard) => void;
}) {
  if (cards.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        No cards.
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "repeat(2, minmax(0, 1fr))",
          sm: "repeat(auto-fill, minmax(150px, 1fr))",
          xl: "repeat(auto-fill, minmax(168px, 1fr))",
        },
        gap: 1,
        alignItems: "stretch",
      }}
    >
      {cards.map((card) => {
        const label =
          typeof actionLabel === "function" ? actionLabel(card) : actionLabel || null;
        return (
          <RuleTooltip key={card.id} title={cardRuleText(card)} block>
            <Paper
              variant="outlined"
              sx={{
                minHeight: 256,
                p: 0.75,
                opacity: card.dead ? 0.58 : 1,
                bgcolor: card.dead ? alpha("#78716c", 0.08) : "#fffefa",
                borderColor: card.dead ? alpha("#78716c", 0.45) : alpha(cardCategoryColor(card.category), 0.7),
                display: "flex",
                flexDirection: "column",
                gap: 0.7,
                overflow: "hidden",
                boxShadow: "0 8px 18px rgba(20,33,29,.08)",
              }}
            >
            <Box
              sx={{
                minHeight: 36,
                px: 0.75,
                py: 0.45,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: alpha(cardCategoryColor(card.category), 0.08),
                display: "flex",
                alignItems: "center",
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 950,
                  lineHeight: 1.12,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {card.name}
              </Typography>
            </Box>
            <TradingCardArt card={card} />
            <Box
              sx={{
                px: 0.7,
                py: 0.5,
                borderTop: "1px solid",
                borderBottom: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack direction="row" spacing={0.4} flexWrap="wrap" useFlexGap alignItems="center">
                <RuleTooltip title={RULE_TEXT.cardCategory}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: cardCategoryColor(card.category),
                      fontWeight: 950,
                      letterSpacing: 0,
                      textTransform: "uppercase",
                    }}
                  >
                    {cardCategoryLabel(card.category)}
                  </Typography>
                </RuleTooltip>
                {card.dead && (
                  <RuleTooltip title={RULE_TEXT.deadCard}>
                    <Chip size="small" color="warning" label="Dead" sx={{ height: 19, fontSize: 10 }} />
                  </RuleTooltip>
                )}
                {card.tradeValue && (
                  <RuleTooltip title={RULE_TEXT.tradeValue}>
                    <Chip size="small" label={`TV ${card.tradeValue}`} sx={{ height: 19, fontSize: 10 }} />
                  </RuleTooltip>
                )}
              </Stack>
            </Box>
            <Typography
              variant="caption"
              sx={{
                px: 0.7,
                color: "text.secondary",
                lineHeight: 1.25,
                flex: 1,
                overflowWrap: "anywhere",
              }}
            >
              {card.text}
            </Typography>
            {label && onAction && (
              <RuleTooltip
                title={label === "Equip" || label === "Unequip" ? RULE_TEXT.tackle : RULE_TEXT.cleanup}
                block
              >
                <Button
                  size="small"
                  variant="outlined"
                  disabled={disabled}
                  onClick={() => onAction(card)}
                  sx={{ mt: "auto" }}
                >
                  {label}
                </Button>
              </RuleTooltip>
            )}
            </Paper>
          </RuleTooltip>
        );
      })}
    </Box>
  );
}

function TradingCardArt({ card }: { card: PatternCard }) {
  const color = cardCategoryColor(card.category);
  return (
    <Box
      sx={{
        height: 94,
        border: "1px solid",
        borderColor: alpha(color, 0.55),
        bgcolor: alpha(color, 0.08),
        background: `linear-gradient(135deg, ${alpha(color, 0.22)}, #fffefa 54%, ${alpha(
          "#d8bb86",
          0.52
        )})`,
        position: "relative",
        overflow: "hidden",
        "&:before": {
          content: '""',
          position: "absolute",
          left: -20,
          right: -20,
          bottom: 12,
          height: 30,
          borderRadius: "50%",
          borderTop: `3px solid ${alpha(color, 0.5)}`,
        },
        "&:after": {
          content: '""',
          position: "absolute",
          left: "18%",
          right: "18%",
          bottom: 24,
          height: 2,
          bgcolor: alpha(color, 0.35),
          boxShadow: `0 9px 0 ${alpha(color, 0.25)}, 0 18px 0 ${alpha(color, 0.16)}`,
        },
      }}
    >
      <Box
        sx={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 52,
          height: 52,
          transform: "translate(-50%, -54%)",
          borderRadius: "50%",
          border: `2px solid ${alpha(color, 0.72)}`,
          bgcolor: alpha("#fffefa", 0.82),
          display: "grid",
          placeItems: "center",
          boxShadow: "0 8px 20px rgba(20,33,29,.12)",
        }}
      >
        <Typography sx={{ color, fontWeight: 950, fontSize: 22, lineHeight: 1 }}>
          {card.name.slice(0, 2).toUpperCase()}
        </Typography>
      </Box>
    </Box>
  );
}

function PrivateFishPanel({
  fish,
  label,
  currentPlayerCode,
}: {
  fish: PatternFullFish;
  label: string;
  currentPlayerCode?: string | null;
}) {
  const history = fish.guessHistory || [];
  return (
    <Paper variant="outlined" sx={{ p: 1.25 }}>
      <Stack spacing={0.75}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <RuleTooltip title={RULE_TEXT.livewell}>
            <Typography sx={{ fontWeight: 950 }}>{label}</Typography>
          </RuleTooltip>
          <RuleTooltip title={RULE_TEXT.weight}>
            <Chip color="secondary" size="small" label={`${fish.weight.toFixed(1)} lb`} />
          </RuleTooltip>
        </Stack>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          <RuleTooltip title={habitatRuleText(fish.habitat)}>
            <Chip size="small" label={fish.habitatLabel} />
          </RuleTooltip>
          <RuleTooltip title={RULE_TEXT.fight}>
            <Chip size="small" label={`Fight ${fish.fight}`} />
          </RuleTooltip>
          <RuleTooltip title={abilityRuleText(fish.ability)}>
            <Chip size="small" label={abilityLabel(fish.ability)} />
          </RuleTooltip>
        </Stack>
        <RuleTooltip title={RULE_TEXT.innateProfile}>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {fish.innateProfile.lure} / {fish.innateProfile.color} /{" "}
            {fish.innateProfile.retrieve}
          </Typography>
        </RuleTooltip>
        {history.length > 0 && (
          <MastermindHistory history={history} currentPlayerCode={currentPlayerCode} />
        )}
      </Stack>
    </Paper>
  );
}

function TellChips({ tell }: { tell: PatternFullFish["tell"] }) {
  return (
    <Stack spacing={0.5}>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        <RuleTooltip title={RULE_TEXT.tell}>
          <Typography variant="caption" sx={{ fontWeight: 950, minWidth: 58 }}>
            Lure
          </Typography>
        </RuleTooltip>
        {tell.lures.map((item) => (
          <RuleTooltip key={item} title={RULE_TEXT.tell}>
            <Chip size="small" label={item} />
          </RuleTooltip>
        ))}
      </Stack>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        <RuleTooltip title={RULE_TEXT.tell}>
          <Typography variant="caption" sx={{ fontWeight: 950, minWidth: 58 }}>
            Color
          </Typography>
        </RuleTooltip>
        {tell.colors.map((item) => (
          <RuleTooltip key={item} title={RULE_TEXT.tell}>
            <Chip size="small" label={item} />
          </RuleTooltip>
        ))}
      </Stack>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        <RuleTooltip title={RULE_TEXT.tell}>
          <Typography variant="caption" sx={{ fontWeight: 950, minWidth: 58 }}>
            Retrieve
          </Typography>
        </RuleTooltip>
        {tell.retrieves.map((item) => (
          <RuleTooltip key={item} title={RULE_TEXT.tell}>
            <Chip size="small" label={item} />
          </RuleTooltip>
        ))}
      </Stack>
    </Stack>
  );
}

function LogPanel({ session }: { session: PatternSessionSnapshot }) {
  const displayLog = displayLogEntries(session.log);
  return (
    <Paper sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
      <Stack spacing={1}>
        <Typography variant="h6" sx={{ fontWeight: 950 }}>
          Public Log
        </Typography>
        <Stack spacing={0.75} sx={{ maxHeight: 360, overflowY: "auto", pr: 0.5 }}>
          {displayLog
            .slice()
            .reverse()
            .map((entry) => (
              <Box
                key={entry.id}
                sx={{
                  px: 1,
                  py: 0.75,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor:
                    entry.tone === "hit" || entry.tone === "victory"
                      ? alpha("#16a34a", 0.08)
                      : entry.tone === "miss" || entry.tone === "danger"
                      ? alpha("#c2410c", 0.08)
                      : alpha("#087f8c", 0.05),
                }}
              >
                <Typography variant="body2">{entry.message}</Typography>
              </Box>
            ))}
        </Stack>
      </Stack>
    </Paper>
  );
}

function ResultsPanel({ session }: { session: PatternSessionSnapshot }) {
  const results = session.results;
  if (!results) return null;
  return (
    <Paper sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
      <Stack spacing={1}>
        <Typography variant="h6" sx={{ fontWeight: 950 }}>
          Final Weigh-In
        </Typography>
        {results.standings.map((standing, index) => (
          <Paper key={standing.playerId} variant="outlined" sx={{ p: 1.25 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip label={`#${index + 1}`} color={index === 0 ? "secondary" : "default"} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontWeight: 950 }}>{standing.name}</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {standing.totalWeight.toFixed(1)} lb total
                </Typography>
              </Box>
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Paper>
  );
}

function RulesPanel() {
  return (
    <Accordion disableGutters sx={{ border: "1px solid", borderColor: "divider" }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography sx={{ fontWeight: 950 }}>Rules Reference</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1}>
          <RuleLine title="Cast" text="d10 maps to the 3 x 3 grid; 9-10 hit center." />
          <RuleLine title="Find" text="Weighted habitat icons pick one hidden Bass from that habitat." />
          <RuleLine title="Mood" text="Only the category is public; hidden added options stay server-side." />
          <RuleLine title="Bite Box" text="0 matches DC 5, 1 match DC 4, 2 matches DC 3, 3 matches DC 2." />
          <RuleLine title="Set" text="Base 4+. Wait can spit, hold, or grant +2. Hard Set adds +2 and Tension." />
          <RuleLine title="Battle" text="Reel rolls vs Fight, Pressure gets +1 but misses move 2, Give Line suppresses ability." />
          <RuleLine title="Livewell" text="Keep 3 Bass. Secret Fish reveal only to their owner until final weigh-in." />
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

function RuleLine({ title, text }: { title: string; text: string }) {
  return (
    <Typography variant="body2">
      <Box component="span" sx={{ fontWeight: 950 }}>
        {title}:
      </Box>{" "}
      {text}
    </Typography>
  );
}

function CopyButton({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outlined"
      startIcon={<ContentCopyIcon />}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      }}
    >
      {copied ? "Copied" : label}
    </Button>
  );
}

function nibbleTargetForMatches(matchCount: number | null | undefined) {
  if (matchCount === null || matchCount === undefined) return 5;
  return [5, 4, 3, 2][matchCount] || 5;
}

function cardCategoryLabel(category: PatternCard["category"]) {
  return (
    {
      tackle: "Tackle",
      trick: "Trick",
      interference: "Interference",
      event: "Event",
    }[category] || category
  );
}

function cardCategoryColor(category: PatternCard["category"]) {
  return (
    {
      tackle: "#087f8c",
      trick: "#7c3aed",
      interference: "#b45309",
      event: "#15803d",
    }[category] || "#14211d"
  );
}

function phaseLabel(phase: PatternTurnPhase) {
  return (
    {
      immediate: "Immediate",
      move: "Move",
      rig: "Rig",
      cast: "Cast",
      declare: "Declare",
      nibble: "Nibble",
      set: "Set",
      wait: "Wait",
      hookSet: "Hook Set",
      battle: "Battle",
      livewell: "Livewell",
      cleanup: "Cleanup",
    }[phase] || phase
  );
}

function formatModifier(value: number | null) {
  if (!value) return "";
  return value > 0 ? `+${value}` : `${value}`;
}

function abilityLabel(value: string) {
  return (
    {
      jump: "Jump",
      run: "Run",
      cover: "Cover",
      headShake: "Head Shake",
      dive: "Dive",
    }[value] || value
  );
}

export default function PatternGameApp() {
  return (
    <ThemeProvider theme={patternTheme}>
      <CssBaseline />
      <Routes>
        <Route index element={<CreateGamePage />} />
        <Route path="host/:sessionId" element={<HostSessionPage />} />
        <Route path="join" element={<JoinPage />} />
        <Route path="play/:sessionId" element={<PlayerSessionPage />} />
        <Route path="*" element={<Navigate to="/the-pattern" replace />} />
      </Routes>
    </ThemeProvider>
  );
}
