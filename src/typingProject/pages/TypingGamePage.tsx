import {
  Box,
  Stack,
  TextField,
  Typography,
  Modal,
  Button,
  styled,
  IconButton,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  FormGroup,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  Snackbar,
  Alert,
  Tooltip,
  Tabs,
  Tab,
} from "@mui/material";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collectiblePairs, leagueTrophies, words } from "typingProject/resources/staticData";
/** @jsxImportSource @emotion/react */
import Confetti from "typingProject/Confetti";
import SettingsIcon from "@mui/icons-material/Settings";
import BackpackIcon from "@mui/icons-material/Backpack";
import LeaderboardIcon from "@mui/icons-material/Leaderboard";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import Drawer from "@mui/material/Drawer";
import Badge from "@mui/material/Badge";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { glow, pulse, pulseBadge, shake } from "typingProject/keyframes/keyframes";
import { INACTIVITY_PAUSE_SECONDS, TIMER } from "typingProject/constants/constants";
import HomeRowCheckModal from "typingProject/components/HomeRowCheckModal";
import { Link } from "react-router";
import goldIcon from "typingProject/assets/items/gold.svg";
import rubyIcon from "typingProject/assets/items/ruby.svg";
import emeraldIcon from "typingProject/assets/items/emerald.svg";
import sapphireIcon from "typingProject/assets/items/sapphire.svg";
import diamondIcon from "typingProject/assets/items/diamond.svg";
import collectionStarIcon from "typingProject/assets/effects/collection-star.svg";

// const AnimatedTimer = styled(Typography, {
//   shouldForwardProp: (prop) => prop !== "animate",
// })<{ animate?: boolean }>(({ animate }) => ({
//   ...(animate && {
//     animation: `${pulse} 0.5s ease-in-out`,
//   }),
// }));

const AnimatedTimer = styled(Typography)(({ theme }) => ({
  transition: "transform 0.5s ease-in-out",
  display: "inline-block",
}));

type LeagueId = "bronze" | "silver" | "gold" | "platinum" | "titanium";
type DifficultyId = "casual" | "hardcore" | "perfection" | "password";
type Difficulties = Record<DifficultyId, boolean>;
type CollectionFlightVariant = "single" | "pair";

type CollectionFlight = {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  wordWidth: number;
  wordHeight: number;
  variant: CollectionFlightVariant;
};

type BackpackBurst = {
  id: number;
  x: number;
  y: number;
};

type LeaderboardRun = {
  id: string;
  playerName: string;
  league: LeagueId;
  lost?: boolean;
  difficultyTags?: DifficultyId[];
  scoreLabel: string;
  scoreValue: number;
  level: number;
  correctChars: number;
  elapsedSeconds: number;
  timestamp: string;
  dateKey: string;
};

type LeaderboardTabId = "allTime" | "today";

type KeyStat = {
  attempts: number;
  misses: number;
};

type WordMistakeStat = {
  word: string;
  mistakeCount: number;
  lastMistakeAt: string;
};

type KeyStatsByKey = Record<string, KeyStat>;
type WordMistakeStatsByWord = Record<string, WordMistakeStat>;

const orderedItems = ["gold", "ruby", "emerald", "sapphire", "diamond"];
const leagueIds: LeagueId[] = ["bronze", "silver", "gold", "platinum", "titanium"];
const difficultyOptions: DifficultyId[] = ["casual", "hardcore", "perfection", "password"];
const difficultyBadges: Record<DifficultyId, { symbol: string; label: string; color: string }> = {
  casual: { symbol: "C", label: "Casual", color: "#69db7c" },
  hardcore: { symbol: "H", label: "Hardcore", color: "#ff6347" },
  perfection: { symbol: "P", label: "Perfection", color: "#ff69b4" },
  password: { symbol: "@", label: "Password", color: "#8be9fd" },
};
const leagueDescriptions: Record<LeagueId, string> = {
  bronze: "Lowercase words only.",
  silver: "Capitalized words.",
  gold: "Capitalized words plus a random . ! ? suffix.",
  platinum: "Capitalized words plus a random 0-9 digit and a random . ! ? , ' - = / suffix.",
  titanium: "Adds all keyboard characters and shifted symbols; rare symbols appear much less often.",
};
const difficultyDescriptions: Record<DifficultyId, string> = {
  casual: "Timer pressure is off; gameplay level can rise, but league level and highscore do not.",
  hardcore: "Losing resets the gameplay level back to 1.",
  perfection: "Any incorrect character immediately ends the run.",
  password:
    "Silver and above may capitalize letters and swap letters for allowed password-style symbols or numbers.",
};
const goldSymbols = [".", "!", "?"];
const decimalDigits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const platinumSymbols = [...goldSymbols, ",", "'", "-", "=", "/"];
const titaniumCommonCharacters = [
  ...decimalDigits,
  ...platinumSymbols,
  "[",
  "]",
  ";",
  "\\",
];
const titaniumUncommonCharacters = [
  "!",
  "@",
  "#",
  "$",
  "%",
  "&",
  "*",
  "(",
  ")",
  "_",
  "+",
  "{",
  "}",
  ":",
  '"',
  "<",
  ">",
  "~",
];
const titaniumRareCharacters = ["^", "`", "|"];
const titaniumCharacters = Array.from(
  new Set([...titaniumCommonCharacters, ...titaniumUncommonCharacters, ...titaniumRareCharacters])
);
const passwordSubstitutions: Record<string, string[]> = {
  a: ["4", "@"],
  b: ["8"],
  e: ["3"],
  g: ["6", "9"],
  i: ["1", "!", "|"],
  l: ["1", "!", "|"],
  o: ["0"],
  s: ["5", "$"],
  t: ["7", "+"],
  z: ["2"],
};
const playerNameStorageKey = "typingPlayerName";
const selectedLeagueStorageKey = "typingSelectedLeague";
const leagueLevelsStorageKey = "typingLeagueLevels";
const leagueCurrentLevelsStorageKey = "typingLeagueCurrentLevels";
const leagueHighscoresStorageKey = "typingLeagueHighscores";
const legacyLevelStorageKey = "typing-game-level";
const legacyHighscoreStorageKey = "typing-game-highscore";
const leaderboardAllTimeStorageKey = "typingLeaderboardAllTime";
const leaderboardTodayStorageKeyPrefix = "typingLeaderboardToday:";
const keyStatsStorageKey = "typingKeyStats";
const wordMistakeStatsStorageKey = "typingWordMistakeStats";
const keyboardRows = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
  [".", ",", "?", "!", "'", "-", "Space"],
];
const keyAccuracyScaleTicks = [0, 40, 80, 90, 100];

const itemIcons: Record<string, { alt: string; src: string }> = {
  gold: { alt: "Gold", src: goldIcon },
  ruby: { alt: "Ruby", src: rubyIcon },
  emerald: { alt: "Emerald", src: emeraldIcon },
  sapphire: { alt: "Sapphire", src: sapphireIcon },
  diamond: { alt: "Diamond", src: diamondIcon },
};

const wordLengthKeys = Object.keys(words).filter((key) => !["items", "powerups"].includes(key));
const allCollectiblePairs = Object.values(collectiblePairs).flat();
const itemWordSet = new Set(words.items);
const powerupWordSet = new Set(words.powerups);
const totalWordCount = Object.values(words).flat().length;
const sortedWordEntries = Object.entries(words)
  .sort(([a], [b]) => parseInt(a) - parseInt(b))
  .map(([length, wordList]) => [length, [...wordList].sort()] as [string, string[]]);
const playerNameWords = Array.from(
  new Set(
    wordLengthKeys
      .filter((key) => parseInt(key) >= 4)
      .flatMap((key) => words[key])
      .map((word) => word.toLowerCase().replace(/[^a-z]/g, ""))
      .filter((word) => word.length >= 4)
  )
);

const backpackConfettiColors = [
  "#ffd54f",
  "#ff6b6b",
  "#4dabf7",
  "#69db7c",
  "#f783ac",
  "#b197fc",
  "#ff922b",
  "#fff7ad",
];
const backpackConfettiPieces = Array.from({ length: 36 }, (_, index) => {
  const angle = (index / 36) * Math.PI * 2 - Math.PI / 2;
  const distance = 64 + (index % 4) * 18;

  return {
    dx: Math.round(Math.cos(angle) * distance),
    dy: Math.round(Math.sin(angle) * distance),
    color: backpackConfettiColors[index % backpackConfettiColors.length],
    rotate: (index % 2 === 0 ? 1 : -1) * (180 + index * 23),
    delay: (index % 9) * 18,
    width: index % 5 === 0 ? 8 : 6,
    height: index % 3 === 0 ? 14 : 10,
    radius: index % 4 === 0 ? "50%" : "2px",
  };
});

const collectionTrailParticles = [
  { x: -10, y: 22, dx: -18, dy: 12, size: 7, color: "#fff7ad", delay: 0 },
  { x: -18, y: 18, dx: -24, dy: 8, size: 5, color: "#ffd54f", delay: 70 },
  { x: -24, y: 27, dx: -20, dy: 14, size: 4, color: "#fffde7", delay: 130 },
  { x: -30, y: 15, dx: -28, dy: 6, size: 6, color: "#ffec99", delay: 190 },
  { x: -35, y: 30, dx: -25, dy: 16, size: 4, color: "#ffe066", delay: 250 },
  { x: -42, y: 21, dx: -30, dy: 10, size: 3, color: "#fff9db", delay: 310 },
  { x: -48, y: 33, dx: -22, dy: 18, size: 5, color: "#ffd43b", delay: 370 },
  { x: -54, y: 18, dx: -28, dy: 5, size: 3, color: "#fff7ad", delay: 430 },
];

const pairCollectionTrailColors = [
  "#fff0fb",
  "#ff8af0",
  "#ff4fd8",
  "#f72585",
  "#e879f9",
  "#c77dff",
  "#f0abfc",
  "#db2777",
];

const normalizeCollectedWord = (word: string) => word.toLowerCase().replace(/[^a-z]/g, "");

const getDateKey = () => new Date().toISOString().split("T")[0];

const createPlayerName = () => {
  const nameWord = playerNameWords[Math.floor(Math.random() * playerNameWords.length)] || "player";
  const suffix = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  const capitalizedNameWord = nameWord[0].toUpperCase() + nameWord.slice(1);

  return `${capitalizedNameWord}${suffix}`;
};

const sortLeaderboardRuns = (runs: LeaderboardRun[]) =>
  [...runs].sort((a, b) => {
    if (b.scoreValue !== a.scoreValue) return b.scoreValue - a.scoreValue;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

const getLegacyLeaderboardStorageKey = (tab: LeaderboardTabId, dateKey = getDateKey()) =>
  tab === "allTime" ? leaderboardAllTimeStorageKey : `${leaderboardTodayStorageKeyPrefix}${dateKey}`;

const getLeaderboardStorageKey = (
  tab: LeaderboardTabId,
  league: LeagueId,
  dateKey = getDateKey()
) =>
  tab === "allTime"
    ? `${leaderboardAllTimeStorageKey}:${league}`
    : `${leaderboardTodayStorageKeyPrefix}${league}:${dateKey}`;

const readLeaderboardRuns = (storageKey: string): LeaderboardRun[] => {
  const stored = localStorage.getItem(storageKey);
  if (!stored) return [];

  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
};

const keepTopLeaderboardRuns = (runs: LeaderboardRun[]) => sortLeaderboardRuns(runs).slice(0, 10);

const readStoredRecord = <T,>(storageKey: string): Record<string, T> => {
  const stored = localStorage.getItem(storageKey);
  if (!stored) return {};

  try {
    return JSON.parse(stored);
  } catch {
    return {};
  }
};

const isLeagueId = (value: string | null): value is LeagueId =>
  !!value && leagueIds.includes(value as LeagueId);

const readStoredLeague = () => {
  const storedLeague = localStorage.getItem(selectedLeagueStorageKey);
  return isLeagueId(storedLeague) ? storedLeague : "bronze";
};

const normalizeLevel = (value: unknown) => {
  const level = Number(value);
  return Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
};

const getScoreLevel = (score: string) => normalizeLevel(score.split(".")[0]);

const createLeagueLevelRecord = () =>
  leagueIds.reduce((acc, league) => {
    acc[league] = 1;
    return acc;
  }, {} as Record<LeagueId, number>);

const readLeagueLevels = () => {
  const storedLevels = readStoredRecord<number>(leagueLevelsStorageKey);
  const levels = createLeagueLevelRecord();

  leagueIds.forEach((league) => {
    if (storedLevels[league] !== undefined) {
      levels[league] = normalizeLevel(storedLevels[league]);
    }
  });

  if (storedLevels.bronze === undefined) {
    const legacyLevel = localStorage.getItem(legacyLevelStorageKey);
    if (legacyLevel) levels.bronze = normalizeLevel(legacyLevel);
  }

  return levels;
};

const readLeagueCurrentLevels = (fallbackLevels: Record<LeagueId, number>) => {
  const storedLevels = readStoredRecord<number>(leagueCurrentLevelsStorageKey);
  const levels = createLeagueLevelRecord();

  leagueIds.forEach((league) => {
    levels[league] =
      storedLevels[league] !== undefined
        ? normalizeLevel(storedLevels[league])
        : normalizeLevel(fallbackLevels[league] || 1);
  });

  return levels;
};

const readLeagueHighscores = () => {
  const storedHighscores = readStoredRecord<string>(leagueHighscoresStorageKey);
  const legacyHighscore = localStorage.getItem(legacyHighscoreStorageKey) || "1.0";

  return leagueIds.reduce((acc, league) => {
    acc[league] = storedHighscores[league] || (league === "bronze" ? legacyHighscore : "1.0");
    return acc;
  }, {} as Record<LeagueId, string>);
};

const getLeagueScopedStorageKey = (baseKey: string, league: LeagueId) => `${baseKey}:${league}`;

const readLeagueScopedRecord = <T,>(baseKey: string, league: LeagueId): Record<string, T> => {
  const scopedRecord = readStoredRecord<T>(getLeagueScopedStorageKey(baseKey, league));
  if (Object.keys(scopedRecord).length > 0 || league !== "bronze") return scopedRecord;

  return readStoredRecord<T>(baseKey);
};

const persistLeagueStats = (
  league: LeagueId,
  keyStats: KeyStatsByKey,
  wordMistakeStats: WordMistakeStatsByWord
) => {
  localStorage.setItem(getLeagueScopedStorageKey(keyStatsStorageKey, league), JSON.stringify(keyStats));
  localStorage.setItem(
    getLeagueScopedStorageKey(wordMistakeStatsStorageKey, league),
    JSON.stringify(wordMistakeStats)
  );
};

const readLeaderboardRunsForLeague = (
  tab: LeaderboardTabId,
  league: LeagueId,
  dateKey = getDateKey()
) => {
  const scopedRuns = readLeaderboardRuns(getLeaderboardStorageKey(tab, league, dateKey));
  if (scopedRuns.length > 0 || league !== "bronze") return keepTopLeaderboardRuns(scopedRuns);

  return keepTopLeaderboardRuns(readLeaderboardRuns(getLegacyLeaderboardStorageKey(tab, dateKey)));
};

const normalizeStatKey = (char: string) => {
  if (char === " ") return "Space";
  return char.toUpperCase();
};

const getKeyAccuracyColor = (stat?: KeyStat) => {
  if (!stat?.attempts) return "#333";

  const accuracy = Math.max(0, Math.min(1, (stat.attempts - stat.misses) / stat.attempts));
  const hue = accuracy <= 0.8 ? Math.round((accuracy / 0.8) * 60) : Math.round(60 + ((accuracy - 0.8) / 0.2) * 60);
  return `hsl(${hue}, 68%, 43%)`;
};

const getKeyStatLabel = (key: string, stat?: KeyStat) => {
  const attempts = stat?.attempts || 0;
  const misses = stat?.misses || 0;
  const missedPercent = attempts ? Math.round((misses / attempts) * 100) : 0;
  const correctPercent = attempts ? 100 - missedPercent : 0;

  return `${key}: ${missedPercent}% missed (${misses}/${attempts}) · ${correctPercent}% correct`;
};

const getTopWordMistakes = (stats: WordMistakeStatsByWord) =>
  Object.values(stats)
    .filter((stat) => stat.mistakeCount > 0)
    .sort((a, b) => {
      if (b.mistakeCount !== a.mistakeCount) return b.mistakeCount - a.mistakeCount;
      return new Date(b.lastMistakeAt).getTime() - new Date(a.lastMistakeAt).getTime();
    })
    .slice(0, 10);

const capitalizeLeagueWord = (word: string) =>
  word.length ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word;

const getRandomArrayItem = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

const insertAtRandomIndex = (word: string, character: string) => {
  const insertIndex = Math.floor(Math.random() * (word.length + 1));
  return `${word.slice(0, insertIndex)}${character}${word.slice(insertIndex)}`;
};

const randomizeLetterCase = (word: string, uppercaseChance: number) =>
  word
    .split("")
    .map((character) =>
      /[a-z]/i.test(character) && Math.random() < uppercaseChance
        ? character.toUpperCase()
        : character
    )
    .join("");

const getTitaniumCharacter = () => {
  const roll = Math.random();

  if (roll < 0.78) return getRandomArrayItem(titaniumCommonCharacters);
  if (roll < 0.98) return getRandomArrayItem(titaniumUncommonCharacters);
  return getRandomArrayItem(titaniumRareCharacters);
};

const getAllowedPasswordCharacters = (league: LeagueId) => {
  if (league === "bronze" || league === "silver") return new Set<string>();
  if (league === "gold") return new Set(goldSymbols);
  if (league === "platinum") return new Set([...decimalDigits, ...platinumSymbols]);
  return new Set([...decimalDigits, ...titaniumCharacters]);
};

const getActiveDifficultyTags = (difficulties: Difficulties) =>
  difficultyOptions.filter((difficulty) => difficulties[difficulty]);

const applyPasswordDifficulty = (word: string, league: LeagueId) => {
  if (league === "bronze") return word;

  const allowedCharacters = getAllowedPasswordCharacters(league);
  let changed = false;
  const transformedCharacters = word.split("").map((character) => {
    if (!/[a-z]/i.test(character)) return character;

    const lowerCharacter = character.toLowerCase();
    const substitutionOptions = (passwordSubstitutions[lowerCharacter] || []).filter((option) =>
      allowedCharacters.has(option)
    );

    if (substitutionOptions.length && Math.random() < 0.26) {
      changed = true;
      return getRandomArrayItem(substitutionOptions);
    }

    if (Math.random() < 0.34) {
      const capitalized = character.toUpperCase();
      changed = changed || capitalized !== character;
      return capitalized;
    }

    return character.toLowerCase();
  });

  if (!changed) {
    const letterIndexes = transformedCharacters
      .map((character, index) => (/[a-z]/i.test(character) ? index : -1))
      .filter((index) => index !== -1);

    if (letterIndexes.length) {
      const randomLetterIndex = getRandomArrayItem(letterIndexes);
      transformedCharacters[randomLetterIndex] = transformedCharacters[randomLetterIndex].toUpperCase();
    }
  }

  return transformedCharacters.join("");
};

const decorateWordForLeague = (word: string, league: LeagueId, passwordMode: boolean) => {
  if (league === "bronze") return word;

  let decoratedWord = capitalizeLeagueWord(word);
  if (league === "gold") {
    decoratedWord = `${decoratedWord}${getRandomArrayItem(goldSymbols)}`;
  }

  if (league === "platinum") {
    decoratedWord = `${decoratedWord}${getRandomArrayItem(decimalDigits)}${getRandomArrayItem(
      platinumSymbols
    )}`;
  }

  if (league === "titanium") {
    decoratedWord = randomizeLetterCase(decoratedWord, 0.18);
    decoratedWord = insertAtRandomIndex(decoratedWord, getTitaniumCharacter());
    decoratedWord = insertAtRandomIndex(decoratedWord, getTitaniumCharacter());

    if (Math.random() < 0.35) {
      decoratedWord = insertAtRandomIndex(decoratedWord, getTitaniumCharacter());
    }
  }

  return passwordMode ? applyPasswordDifficulty(decoratedWord, league) : decoratedWord;
};

const decorateWordsForLeague = (wordList: string[], league: LeagueId, passwordMode: boolean) =>
  wordList.map((word) => decorateWordForLeague(word, league, passwordMode));

const CollectionFlightStar: React.FC<{
  flight: CollectionFlight;
  onFinish: (flight: CollectionFlight) => void;
}> = ({ flight, onFinish }) => {
  const starRef = useRef<HTMLDivElement>(null);
  const isPairFlight = flight.variant === "pair";

  useEffect(() => {
    if (!starRef.current) return;

    const starSize = 44;
    const radiusX = Math.max(54, flight.wordWidth * 0.72);
    const radiusY = Math.max(42, flight.wordHeight * 2.05);
    const deltaX = flight.endX - flight.startX;
    const deltaY = flight.endY - flight.startY;

    const getTransform = (x: number, y: number, scale: number, rotate: number) =>
      `translate(${x - starSize / 2}px, ${y - starSize / 2}px) scale(${scale}) rotate(${rotate}deg)`;

    const animation = starRef.current.animate(
      [
        {
          transform: getTransform(flight.startX, flight.startY, 0.55, 0),
          opacity: 0,
          offset: 0,
        },
        {
          transform: getTransform(flight.startX - radiusX * 0.25, flight.startY + radiusY * 1.08, 0.85, 65),
          opacity: 1,
          offset: 0.12,
        },
        {
          transform: getTransform(flight.startX - radiusX * 1.15, flight.startY + radiusY * 0.72, 1, 150),
          opacity: 1,
          offset: 0.25,
        },
        {
          transform: getTransform(flight.startX - radiusX * 1.05, flight.startY - radiusY * 0.52, 1, 245),
          opacity: 1,
          offset: 0.38,
        },
        {
          transform: getTransform(flight.startX + radiusX * 0.58, flight.startY - radiusY * 0.82, 1, 335),
          opacity: 1,
          offset: 0.5,
        },
        {
          transform: getTransform(flight.startX + radiusX * 0.9, flight.startY + radiusY * 0.18, 1.05, 430),
          opacity: 1,
          offset: 0.6,
        },
        {
          transform: getTransform(flight.startX + deltaX * 0.26, flight.startY + deltaY * 0.3 - 8, 1.05, 500),
          opacity: 1,
          offset: 0.7,
        },
        {
          transform: getTransform(flight.startX + deltaX * 0.52, flight.startY + deltaY * 0.55 - 72, 1.05, 570),
          opacity: 1,
          offset: 0.82,
        },
        {
          transform: getTransform(flight.startX + deltaX * 0.82, flight.startY + deltaY * 0.82 - 44, 0.9, 650),
          opacity: 1,
          offset: 0.93,
        },
        {
          transform: getTransform(flight.endX, flight.endY, 0.35, 720),
          opacity: 0,
          offset: 1,
        },
      ],
      {
        duration: 1450,
        easing: "cubic-bezier(0.74, 0.02, 1, 1)",
        fill: "forwards",
      }
    );

    animation.onfinish = () => onFinish(flight);

    return () => animation.cancel();
  }, [flight, onFinish]);

  return (
    <Box
      ref={starRef}
      aria-hidden='true'
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        width: 44,
        height: 44,
        zIndex: 2400,
        pointerEvents: "none",
        transform: "translate(-100px, -100px)",
        willChange: "transform, opacity",
        "@keyframes collectionTrailSpark": {
          "0%": {
            opacity: 0.9,
            transform: "translate(0, 0) scale(1)",
          },
          "100%": {
            opacity: 0,
            transform: "translate(var(--trail-dx), var(--trail-dy)) scale(0.25) rotate(120deg)",
          },
        },
        "@keyframes pairCollectionAura": {
          "0%": {
            opacity: 0.55,
            transform: "scale(0.84) rotate(0deg)",
          },
          "100%": {
            opacity: 1,
            transform: "scale(1.2) rotate(35deg)",
          },
        },
      }}>
      {collectionTrailParticles.map((particle, index) => {
        const particleColor = isPairFlight
          ? pairCollectionTrailColors[index % pairCollectionTrailColors.length]
          : particle.color;

        return (
          <Box
            key={`${particle.x}-${particle.y}-${particle.delay}`}
            sx={{
              "--trail-dx": `${particle.dx}px`,
              "--trail-dy": `${particle.dy}px`,
              position: "absolute",
              left: `${particle.x}px`,
              top: `${particle.y}px`,
              width: particle.size,
              height: particle.size,
              borderRadius: "50%",
              bgcolor: particleColor,
              boxShadow: `0 0 ${particle.size * (isPairFlight ? 3 : 2)}px ${particleColor}`,
              animation: "collectionTrailSpark 580ms ease-out infinite",
              animationDelay: `${particle.delay}ms`,
            }}
          />
        );
      })}
      {isPairFlight && (
        <Box
          sx={{
            position: "absolute",
            inset: -8,
            borderRadius: "50%",
            border: "2px solid rgba(255, 79, 216, 0.76)",
            boxShadow:
              "0 0 18px rgba(255, 79, 216, 0.95), 0 0 34px rgba(199, 125, 255, 0.72), inset 0 0 14px rgba(255, 138, 240, 0.64)",
            animation: "pairCollectionAura 520ms ease-in-out infinite alternate",
          }}
        />
      )}
      <Box
        component='img'
        src={collectionStarIcon}
        alt=''
        sx={{
          position: "relative",
          width: 44,
          height: 44,
          display: "block",
          filter: isPairFlight
            ? "hue-rotate(225deg) saturate(2.2) brightness(1.18) drop-shadow(0 0 8px #fff0fb) drop-shadow(0 0 20px #ff4fd8) drop-shadow(0 0 30px #c026d3)"
            : "drop-shadow(0 0 8px #fff7ad) drop-shadow(0 0 16px #ffc107)",
        }}
      />
    </Box>
  );
};

const BackpackBurstEffect: React.FC<{
  burst: BackpackBurst;
  onComplete: (id: number) => void;
}> = ({ burst, onComplete }) => {
  useEffect(() => {
    const timeout = window.setTimeout(() => onComplete(burst.id), 1100);
    return () => window.clearTimeout(timeout);
  }, [burst.id, onComplete]);

  return (
    <Box
      aria-hidden='true'
      sx={{
        position: "fixed",
        left: burst.x,
        top: burst.y,
        zIndex: 2390,
        pointerEvents: "none",
        "@keyframes backpackConfettiBurst": {
          "0%": {
            opacity: 1,
            transform: "translate(-50%, -50%) scale(0.25) rotate(0deg)",
          },
          "55%": {
            opacity: 1,
          },
          "100%": {
            opacity: 0,
            transform:
              "translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1.18) rotate(var(--turn))",
          },
        },
        "@keyframes backpackShockwave": {
          "0%": {
            opacity: 0.9,
            transform: "translate(-50%, -50%) scale(0.15)",
          },
          "100%": {
            opacity: 0,
            transform: "translate(-50%, -50%) scale(2.5)",
          },
        },
      }}>
      <Box
        sx={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 70,
          height: 70,
          border: "3px solid rgba(255, 245, 157, 0.9)",
          borderRadius: "50%",
          boxShadow: "0 0 24px rgba(255, 213, 79, 0.75)",
          animation: "backpackShockwave 720ms ease-out forwards",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 38,
          height: 38,
          border: "2px solid rgba(116, 192, 252, 0.85)",
          borderRadius: "50%",
          animation: "backpackShockwave 900ms ease-out forwards",
          animationDelay: "110ms",
        }}
      />
      {backpackConfettiPieces.map((piece) => (
        <Box
          key={`${burst.id}-${piece.dx}-${piece.dy}`}
          sx={{
            "--dx": `${piece.dx}px`,
            "--dy": `${piece.dy}px`,
            "--turn": `${piece.rotate}deg`,
            position: "absolute",
            left: 0,
            top: 0,
            width: piece.width,
            height: piece.height,
            borderRadius: piece.radius,
            bgcolor: piece.color,
            boxShadow: `0 0 10px ${piece.color}`,
            animation: "backpackConfettiBurst 980ms ease-out forwards",
            animationDelay: `${piece.delay}ms`,
            willChange: "transform, opacity",
          }}
        />
      ))}
    </Box>
  );
};

const TypingGamePage: React.FC = () => {
  const getTodayKey = () => new Date().toISOString().split("T")[0];
  const calculateStreak = (): number => {
    const saved = localStorage.getItem("dailies");
    if (!saved) return 0;
    const dailies = JSON.parse(saved);

    let streak = 0;
    const today = new Date();

    for (let i = 0; i < 100; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const key = date.toISOString().split("T")[0];

      if (dailies[key]?.goalMet) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  };

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState<LeagueId>(() => readStoredLeague());
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboardTab, setLeaderboardTab] = useState<LeaderboardTabId>("allTime");
  const [statsOpen, setStatsOpen] = useState(false);
  const [leagueLevels, setLeagueLevels] = useState<Record<LeagueId, number>>(() => readLeagueLevels());
  const [leagueCurrentLevels, setLeagueCurrentLevels] = useState<Record<LeagueId, number>>(() =>
    readLeagueCurrentLevels(readLeagueLevels())
  );
  const [leagueHighscores, setLeagueHighscores] = useState<Record<LeagueId, string>>(() =>
    readLeagueHighscores()
  );
  const [playerName] = useState(() => {
    const stored = localStorage.getItem(playerNameStorageKey);
    if (stored) return stored;

    const generatedName = createPlayerName();
    localStorage.setItem(playerNameStorageKey, generatedName);
    return generatedName;
  });
  const [allTimeRuns, setAllTimeRuns] = useState<LeaderboardRun[]>(() =>
    readLeaderboardRunsForLeague("allTime", selectedLeague)
  );
  const [todayRuns, setTodayRuns] = useState<LeaderboardRun[]>(() =>
    readLeaderboardRunsForLeague("today", selectedLeague)
  );
  const [keyStats, setKeyStats] = useState<KeyStatsByKey>(() =>
    readLeagueScopedRecord<KeyStat>(keyStatsStorageKey, selectedLeague)
  );
  const [wordMistakeStats, setWordMistakeStats] = useState<WordMistakeStatsByWord>(() =>
    readLeagueScopedRecord<WordMistakeStat>(wordMistakeStatsStorageKey, selectedLeague)
  );
  const keyStatsRef = useRef<KeyStatsByKey>(keyStats);
  const wordMistakeStatsRef = useRef<WordMistakeStatsByWord>(wordMistakeStats);
  const statsLeagueRef = useRef<LeagueId>(selectedLeague);
  const statsPersistTimeoutRef = useRef<number | null>(null);
  const wordMistakeRecordedIndexesRef = useRef<Set<number>>(new Set());
  const runRecordedRef = useRef(false);

  const [collectedWords, setCollectedWords] = useState<string[]>(() => {
    const stored = localStorage.getItem("collectedWords");
    return stored ? JSON.parse(stored) : [];
  });
  const collectedWordSet = useMemo(() => new Set(collectedWords), [collectedWords]);
  const officialLeagueLevels = useMemo(
    () =>
      leagueIds.reduce((acc, league) => {
        const storedLeagueLevel = leagueLevels[league] || 1;
        const highscoreLevel = getScoreLevel(leagueHighscores[league] || "1.0");
        acc[league] = Math.min(storedLeagueLevel, highscoreLevel);
        return acc;
      }, {} as Record<LeagueId, number>),
    [leagueHighscores, leagueLevels]
  );
  const savedLeagueLevel = officialLeagueLevels[selectedLeague] || 1;
  const currentLevel = leagueCurrentLevels[selectedLeague] || savedLeagueLevel;
  const highscore = leagueHighscores[selectedLeague] || "1.0";

  const setCurrentLevel = useCallback(
    (levelOrUpdater: number | ((prev: number) => number)) => {
      setLeagueCurrentLevels((prev) => {
        const currentLeagueLevel = prev[selectedLeague] || savedLeagueLevel;
        const nextLevel =
          typeof levelOrUpdater === "function" ? levelOrUpdater(currentLeagueLevel) : levelOrUpdater;
        const updatedLevels = {
          ...prev,
          [selectedLeague]: normalizeLevel(nextLevel),
        };

        localStorage.setItem(leagueCurrentLevelsStorageKey, JSON.stringify(updatedLevels));
        return updatedLevels;
      });
    },
    [savedLeagueLevel, selectedLeague]
  );

  const saveLeagueLevel = useCallback(
    (level: number) => {
      setLeagueLevels((prev) => {
        const normalizedLevel = normalizeLevel(level);
        const updatedLevels = {
          ...prev,
          [selectedLeague]: Math.max(prev[selectedLeague] || 1, normalizedLevel),
        };

        localStorage.setItem(leagueLevelsStorageKey, JSON.stringify(updatedLevels));
        return updatedLevels;
      });
    },
    [selectedLeague]
  );

  const setHighscore = useCallback(
    (score: string) => {
      setLeagueHighscores((prev) => {
        const updatedHighscores = {
          ...prev,
          [selectedLeague]: score,
        };

        localStorage.setItem(leagueHighscoresStorageKey, JSON.stringify(updatedHighscores));
        return updatedHighscores;
      });
    },
    [selectedLeague]
  );

  const [isHomeRowCheckOpen, setHomeRowCheckOpen] = useState(true);

  // const [homeRowChecksThisLevel, setHomeRowChecksThisLevel] = useState(0);

  // const maxChecksThisLevel = currentLevel >= 30 ? 3 : currentLevel >= 10 ? 2 : 1;

  // const flyRef = useRef<HTMLDivElement>(null);

  const lastWordRef = useRef<string>("");

  const [foundNewPair, setFoundNewPair] = useState(false);
  const [newlyCollectedCount, setNewlyCollectedCount] = useState(() => {
    const stored = localStorage.getItem("newlyCollectedCount");
    return stored ? parseInt(stored) : 0;
  });
  const [collectedPairs, setCollectedPairs] = useState<string[]>(() => {
    const stored = localStorage.getItem("collectedPairs");
    return stored ? JSON.parse(stored) : [];
  });
  const collectedPairSet = useMemo(() => new Set(collectedPairs), [collectedPairs]);

  const [scrollAnchorLine] = useState(0);

  const [shouldShake, setShouldShake] = useState(false);
  const [activeWordList, setActiveWordList] = useState<string[]>([]);
  const [sourceWordList, setSourceWordList] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [statuses, setStatuses] = useState<(null | "correct" | "incorrect")[]>(
    Array(activeWordList.join(" ").length).fill(null)
  );
  const [timer, setTimer] = useState(TIMER);
  const [timerStarted, setTimerStarted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [collectionFlights, setCollectionFlights] = useState<CollectionFlight[]>([]);
  const [backpackBursts, setBackpackBursts] = useState<BackpackBurst[]>([]);
  const focusTypingInput = useCallback(() => {
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);
  const handleHomeRowCheckClose = useCallback(() => {
    setHomeRowCheckOpen(false);
    focusTypingInput();
  }, [focusTypingInput]);
  const [highscoreUpdated, setHighscoreUpdated] = useState(false);
  // const [levelCompleted, setLevelCompleted] = useState(false);
  const [isNewHighscore, setIsNewHighscore] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const [lineCharCount, setLineCharCount] = useState<number[]>([]);

  const [currentLine, setCurrentLine] = useState(0);
  const currentLineEndIndex = useMemo(
    () => lineCharCount.slice(0, currentLine + 1).reduce((acc, val) => acc + val, 0),
    [currentLine, lineCharCount]
  );

  const [pausedForInactivity, setPausedForInactivity] = useState(false);

  const [goalMetFromStorage, setGoalMetFromStorage] = useState(false);

  const [snackbar, setSnackbar] = useState<{
    message: string;
    open: boolean;
    severity?: "success" | "info" | "warning" | "error";
  }>({ message: "", open: false });

  const showSnackbar = (
    message: string,
    severity: "success" | "info" | "warning" | "error" = "info"
  ) => {
    setSnackbar({ message, open: true, severity });
  };

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [difficulties, setDifficulties] = useState<Difficulties>({
    casual: false,
    hardcore: false,
    perfection: false,
    password: false,
  });
  const isHardcore = difficulties.hardcore;
  const runDifficultyTagsRef = useRef<DifficultyId[]>([]);

  const [playTime, setPlayTime] = useState(() => {
    const saved = localStorage.getItem("dailies");
    const dailies = saved ? JSON.parse(saved) : {};
    const today = getTodayKey();
    return dailies[today]?.playTime || 0;
  });

  const [collectedItemCounts, setCollectedItemCounts] = useState<Record<string, number>>(() => {
    const stored = localStorage.getItem("collectedItemCounts");
    return stored ? JSON.parse(stored) : {};
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [collectedPowerupCounts, setCollectedPowerupCounts] = useState<Record<string, number>>(
    () => {
      const stored = localStorage.getItem("collectedPowerupCounts");
      return stored ? JSON.parse(stored) : {};
    }
  );

  const [correctWordCount, setCorrectWordCount] = useState(() => {
    const saved = localStorage.getItem("dailies");
    const dailies = saved ? JSON.parse(saved) : {};
    const today = getTodayKey();
    return dailies[today]?.correctWordCount || 0;
  });

  const isItem = (word: string) => itemWordSet.has(normalizeCollectedWord(word));
  const isPowerup = (word: string) => powerupWordSet.has(normalizeCollectedWord(word));

  const [streak, setStreak] = useState(() => calculateStreak());

  const handleDifficultiesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target as HTMLInputElement & { name: DifficultyId };
    if (name === "password" && selectedLeague === "bronze") return;

    setDifficulties((prev) => {
      const newDifficulties = { ...prev, [name]: checked };

      if (checked && !runDifficultyTagsRef.current.includes(name)) {
        runDifficultyTagsRef.current = [...runDifficultyTagsRef.current, name];
      }

      if (name === "casual" && prev.casual && !checked) {
        // Reset game only if casual is turned OFF
        resetGame(true, false);
      }

      return newDifficulties;
    });
  };

  const scheduleStatsPersist = useCallback(() => {
    const league = selectedLeague;

    if (statsPersistTimeoutRef.current) {
      window.clearTimeout(statsPersistTimeoutRef.current);
    }

    statsPersistTimeoutRef.current = window.setTimeout(() => {
      persistLeagueStats(league, keyStatsRef.current, wordMistakeStatsRef.current);
      statsPersistTimeoutRef.current = null;
    }, 500);
  }, [selectedLeague]);

  const syncStatsDrawer = useCallback(() => {
    setKeyStats(keyStatsRef.current);
    setWordMistakeStats(wordMistakeStatsRef.current);
  }, []);

  const openStatsDrawer = useCallback(() => {
    syncStatsDrawer();
    setStatsOpen(true);
  }, [syncStatsDrawer]);

  const recordKeyAttempt = useCallback(
    (expectedChar: string, isCorrect: boolean) => {
      const key = normalizeStatKey(expectedChar);
      const existing = keyStatsRef.current[key] || { attempts: 0, misses: 0 };
      const updatedStats = {
        ...keyStatsRef.current,
        [key]: {
          attempts: existing.attempts + 1,
          misses: existing.misses + (isCorrect ? 0 : 1),
        },
      };

      keyStatsRef.current = updatedStats;
      if (statsOpen) setKeyStats(updatedStats);
      scheduleStatsPersist();
    },
    [scheduleStatsPersist, statsOpen]
  );

  const recordWordMistake = useCallback(
    (wordIndex: number) => {
      if (wordMistakeRecordedIndexesRef.current.has(wordIndex)) return;

      const displayWord = sourceWordList[wordIndex] || activeWordList[wordIndex];
      const word = normalizeCollectedWord(displayWord || "");
      if (!word) return;

      wordMistakeRecordedIndexesRef.current.add(wordIndex);

      const existing = wordMistakeStatsRef.current[word] || {
        word,
        mistakeCount: 0,
        lastMistakeAt: "",
      };
      const updatedStats = {
        ...wordMistakeStatsRef.current,
        [word]: {
          word,
          mistakeCount: existing.mistakeCount + 1,
          lastMistakeAt: new Date().toISOString(),
        },
      };

      wordMistakeStatsRef.current = updatedStats;
      if (statsOpen) setWordMistakeStats(updatedStats);
      scheduleStatsPersist();
    },
    [activeWordList, scheduleStatsPersist, sourceWordList, statsOpen]
  );

  useEffect(() => {
    return () => {
      if (statsPersistTimeoutRef.current) {
        window.clearTimeout(statsPersistTimeoutRef.current);
        persistLeagueStats(statsLeagueRef.current, keyStatsRef.current, wordMistakeStatsRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedLeague === "bronze" && difficulties.password) {
      setDifficulties((prev) => ({ ...prev, password: false }));
      runDifficultyTagsRef.current = runDifficultyTagsRef.current.filter((tag) => tag !== "password");
      return;
    }

    localStorage.setItem(selectedLeagueStorageKey, selectedLeague);

    if (statsPersistTimeoutRef.current) {
      window.clearTimeout(statsPersistTimeoutRef.current);
      persistLeagueStats(statsLeagueRef.current, keyStatsRef.current, wordMistakeStatsRef.current);
      statsPersistTimeoutRef.current = null;
    }

    const nextKeyStats = readLeagueScopedRecord<KeyStat>(keyStatsStorageKey, selectedLeague);
    const nextWordMistakeStats = readLeagueScopedRecord<WordMistakeStat>(
      wordMistakeStatsStorageKey,
      selectedLeague
    );

    keyStatsRef.current = nextKeyStats;
    wordMistakeStatsRef.current = nextWordMistakeStats;
    statsLeagueRef.current = selectedLeague;
    wordMistakeRecordedIndexesRef.current = new Set();
    runRecordedRef.current = false;

    setKeyStats(nextKeyStats);
    setWordMistakeStats(nextWordMistakeStats);
    setAllTimeRuns(readLeaderboardRunsForLeague("allTime", selectedLeague));
    setTodayRuns(readLeaderboardRunsForLeague("today", selectedLeague));
  }, [difficulties.password, selectedLeague]);

  useEffect(() => {
    showSnackbar("Marathon Mode available in settings.", "info");
  }, []);

  // const handleLeagueChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  //   setSelectedLeague(event.target.value);
  // };

  const isCasual = difficulties.casual;

  const getCollectedWordRect = useCallback((startWordIndex: number, wordCount = 1) => {
    const wordBox = containerRef.current;
    if (!wordBox) return null;

    const matchingRects = Array.from(
      wordBox.querySelectorAll<HTMLElement>("[data-word-index][data-word-char='true']")
    )
      .filter((element) => {
        const wordIndex = Number(element.dataset.wordIndex);
        return wordIndex >= startWordIndex && wordIndex < startWordIndex + wordCount;
      })
      .map((element) => element.getBoundingClientRect());

    if (!matchingRects.length) return null;

    const bounds = matchingRects.reduce(
      (acc, rect) => ({
        left: Math.min(acc.left, rect.left),
        top: Math.min(acc.top, rect.top),
        right: Math.max(acc.right, rect.right),
        bottom: Math.max(acc.bottom, rect.bottom),
      }),
      {
        left: matchingRects[0].left,
        top: matchingRects[0].top,
        right: matchingRects[0].right,
        bottom: matchingRects[0].bottom,
      }
    );

    return {
      left: bounds.left,
      top: bounds.top,
      width: bounds.right - bounds.left,
      height: bounds.bottom - bounds.top,
    };
  }, []);

  const startCollectionFlight = useCallback(
    (startWordIndex: number, wordCount = 1, variant: CollectionFlightVariant = "single") => {
      const wordRect = getCollectedWordRect(startWordIndex, wordCount);
      const backpackRect = document.getElementById("backpack-icon")?.getBoundingClientRect();

      if (!wordRect || !backpackRect) return;

      const flight = {
        id: Date.now() + Math.random(),
        startX: wordRect.left + wordRect.width / 2,
        startY: wordRect.top + wordRect.height / 2,
        endX: backpackRect.left + backpackRect.width / 2,
        endY: backpackRect.top + backpackRect.height / 2,
        wordWidth: wordRect.width,
        wordHeight: wordRect.height,
        variant,
      };

      setCollectionFlights((current) => [...current, flight].slice(-10));
    },
    [getCollectedWordRect]
  );

  const handleCollectionFlightFinish = useCallback((flight: CollectionFlight) => {
    setCollectionFlights((current) => current.filter((item) => item.id !== flight.id));
    setBackpackBursts((current) =>
      [
        ...current,
        {
          id: flight.id,
          x: flight.endX,
          y: flight.endY,
        },
      ].slice(-10)
    );
  }, []);

  const handleBackpackBurstComplete = useCallback((id: number) => {
    setBackpackBursts((current) => current.filter((burst) => burst.id !== id));
  }, []);

  const checkForNewPairsFromWords = (sourceWords: string[]) => {
    const normalizedWords = sourceWords.map(normalizeCollectedWord);

    for (const pair of allCollectiblePairs) {
      const pairWords = pair.split(" ");
      const pairStartIndex = normalizedWords.findIndex((word, index) =>
        pairWords.every((pairWord, pairWordIndex) => normalizedWords[index + pairWordIndex] === pairWord)
      );

      if (pairStartIndex !== -1 && !collectedPairSet.has(pair)) {
        const updatedPairs = [...collectedPairs, pair];
        setCollectedPairs(updatedPairs);
        localStorage.setItem("collectedPairs", JSON.stringify(updatedPairs));

        if (!newPairSet.has(pair)) {
          setNewPairs((prev) => {
            const updated = [...prev, pair];
            localStorage.setItem("newPairs", JSON.stringify(updated));
            return updated;
          });
        }

        setNewlyCollectedCount((prev) => {
          const updated = prev + 1;
          localStorage.setItem("newlyCollectedCount", updated.toString());
          return updated;
        });
        setFoundNewPair(true);
        setTimeout(() => setFoundNewPair(false), 1000);
        startCollectionFlight(pairStartIndex, pairWords.length, "pair");
        return true;
      }
    }

    return false;
  };

  useEffect(() => {
    const saved = localStorage.getItem("dailies");
    if (saved) {
      const dailies = JSON.parse(saved);
      const today = getTodayKey();
      if (dailies[today]?.goalMet) {
        setGoalMetFromStorage(true);
      }
    }
  }, []);

  const lineHeight = 24 * 1.2; // or whatever you used for lineHeight in your Box

  const DAILY_GOAL_SECONDS = 15 * 60;

  const inactivityRef = useRef<NodeJS.Timeout | null>(null);

  const resetInactivityTimer = () => {
    // if (isCasual) return; // Don't set inactivity timer in casual mode

    if (inactivityRef.current) clearTimeout(inactivityRef.current);

    inactivityRef.current = setTimeout(() => {
      setPausedForInactivity(true);
    }, INACTIVITY_PAUSE_SECONDS * 1000);
  };

  useEffect(() => {
    if (!timerStarted || gameCompleted) return;
    ensureTodayInitialized();

    const today = getTodayKey();
    const saved = localStorage.getItem("dailies");
    const dailies = saved ? JSON.parse(saved) : {};

    dailies[today] = {
      ...(dailies[today] || {}),
      correctWordCount,
    };

    localStorage.setItem("dailies", JSON.stringify(dailies));
  }, [correctWordCount, timerStarted, gameCompleted]);

  useEffect(() => {
    if (!timerStarted || gameCompleted || pausedForInactivity) return;

    const interval = setInterval(() => {
      const today = getTodayKey();
      ensureTodayInitialized();

      setPlayTime((prev) => {
        const updated = prev + 1;

        const saved = localStorage.getItem("dailies");
        const dailies = saved ? JSON.parse(saved) : {};
        dailies[today] = {
          ...(dailies[today] || {}),
          playTime: updated,
          correctWordCount, // save the latest word count as well
        };
        localStorage.setItem("dailies", JSON.stringify(dailies));

        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerStarted, gameCompleted, pausedForInactivity]);

  const dailyGoalMet =
    correctWordCount >= 75 && playTime >= DAILY_GOAL_SECONDS && currentLevel >= 5;

  useEffect(() => {
    const today = getTodayKey();
    const saved = localStorage.getItem("dailies");
    const dailies = saved ? JSON.parse(saved) : {};
    ensureTodayInitialized();

    if (dailyGoalMet && !dailies[today]?.goalMet) {
      dailies[today] = {
        ...(dailies[today] || {}),
        goalMet: true,
        playTime,
        correctWordCount,
      };
      localStorage.setItem("dailies", JSON.stringify(dailies));
      setGoalMetFromStorage(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyGoalMet]);

  const ensureTodayInitialized = () => {
    const today = new Date().toISOString().split("T")[0];

    const lastInitializedDate = localStorage.getItem("dailies_last_initialized");

    if (lastInitializedDate === today) {
      return; // Already initialized today
    }

    // Mark that we've initialized for today
    localStorage.setItem("dailies_last_initialized", today);

    const saved = localStorage.getItem("dailies");
    const dailies = saved ? JSON.parse(saved) : {};

    if (!dailies[today]) {
      dailies[today] = {
        playTime: 0,
        correctWordCount: 0,
        goalMet: false,
      };
      localStorage.setItem("dailies", JSON.stringify(dailies));
    }
  };

  // streak
  useEffect(() => {
    if (dailyGoalMet) {
      setStreak(calculateStreak());
    }
  }, [dailyGoalMet]);

  // updates playtime each second in local storage

  useEffect(() => {
    if (currentIndex >= currentLineEndIndex && currentLine < lineCharCount.length - 1) {
      setCurrentLine((prev) => prev + 1);

      if (containerRef.current) {
        containerRef.current.scrollBy({
          top: lineHeight,
          behavior: "smooth",
        });
      }
    }
  }, [currentIndex, currentLine, currentLineEndIndex, lineCharCount.length, lineHeight]);

  const calculateLineWidths = (containerRef, activeWordList): number[] => {
    const containerWidth = containerRef.current?.offsetWidth;
    const charWidth = containerRef.current?.querySelector("span")?.offsetWidth; // Measure a single character's width

    if (!containerWidth || !charWidth) return [];

    let lineWidths = []; // array of numbers
    let currentLineWidth = 0; // pixels // updates
    let currentLine = 0;
    let charsInCurrentLine = 0; // numbers
    let wordsInCurrentLine = 0;
    let spacesInLine = 0;

    // Split the word list into individual words
    activeWordList.forEach((word) => {
      const wordLength = word.length; // number of cahracters in the word
      const wordWidth = wordLength * charWidth; // pixels in the word
      // wordsInCurrentLine++;

      // Check if adding this word exceeds the container width
      currentLineWidth += 10;
      if (currentLineWidth + wordWidth > containerWidth) {
        // If it does, move to the next line
        spacesInLine = wordsInCurrentLine - 1;
        lineWidths[currentLine] = charsInCurrentLine + spacesInLine; // Save the number of characters for this line
        currentLine++;
        currentLineWidth = 0; // Reset width for new line
        charsInCurrentLine = 0; // Reset characters in line
        wordsInCurrentLine = 0;
      }

      // Add word width to current line width
      // adds the word that exceeded the width to the next line
      currentLineWidth -= 10;
      currentLineWidth += wordWidth;
      charsInCurrentLine += wordLength; // Count characters in current line
      wordsInCurrentLine++;
    });

    // Store the last line characters count
    spacesInLine = wordsInCurrentLine - 1;
    lineWidths[currentLine] = charsInCurrentLine + spacesInLine;

    return lineWidths[0] === -1 ? lineWidths.splice(1, lineWidths.length) : lineWidths;
  };

  useEffect(() => {
    setLineCharCount(calculateLineWidths(containerRef, activeWordList));
    let debounceTimeout: NodeJS.Timeout;

    const handleResize = () => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        setLineCharCount(calculateLineWidths(containerRef, activeWordList));
      }, 2000); // 2 seconds
    };
    window.addEventListener("resize", handleResize); // Recalculate on window resize
    return () => {
      clearTimeout(debounceTimeout);
      window.removeEventListener("resize", handleResize);
    };
  }, [activeWordList, containerRef]);

  // useEffect(() => {}, [currentLevel]);

  const handleWin = () => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 4000);
  };

  // const handleLevelComplete = () => {
  //   setLevelCompleted(true);

  //   // Reset the state after 2 seconds (so confetti animation runs)
  //   setTimeout(() => {
  //     setLevelCompleted(false);
  //   }, 2000); // Duration to match confetti animation time
  // };

  // useEffect(() => {
  //   const newRandomWords = getRandomWords(currentLevel);

  //   if (containerRef.current) {
  //     const widths = calculateLineWidths(containerRef, newRandomWords);
  //     setLineCharCount(widths);
  //   }
  //   setActiveWordList(newRandomWords); // Set active words when level changes or game resets
  // }, [currentLevel]);

  const [newWords, setNewWords] = useState<string[]>(() => {
    const stored = localStorage.getItem("newWords");
    return stored ? JSON.parse(stored) : [];
  });
  const newWordSet = useMemo(() => new Set(newWords), [newWords]);

  useEffect(() => {
    loadLevelWords(currentLevel);
    setInput("");
    setCurrentIndex(0);
    setCurrentLine(0);
    setTimer(TIMER);
    setTimerStarted(false);
    setGameCompleted(false);
    setShowModal(false);
    runRecordedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLevel, difficulties.password, selectedLeague]);

  useEffect(() => {
    if (!isHomeRowCheckOpen) {
      focusTypingInput();
    }
  }, [focusTypingInput, isHomeRowCheckOpen]);

  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const handleTimeOutRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!timerStarted || gameCompleted) return;

    // Stop timer if paused
    if (pausedForInactivity || isCasual) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    // Start timer
    if (!timerIntervalRef.current) {
      timerIntervalRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current as NodeJS.Timeout);
            timerIntervalRef.current = null;
            handleTimeOutRef.current();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [timerStarted, gameCompleted, pausedForInactivity, isCasual]);

  // const handleKeyDownModal = useCallback(
  //   (e: KeyboardEvent) => {
  //     if (e.key === " ") {
  //       if (!isHomeRowCheckOpen && homeRowChecksThisLevel < maxChecksThisLevel) {
  //         e.preventDefault(); // prevent unwanted space typing
  //         setHomeRowCheckOpen(true);
  //         setHomeRowChecksThisLevel((prev) => prev + 1);
  //       }
  //     }
  //   },
  //   [isHomeRowCheckOpen, homeRowChecksThisLevel, maxChecksThisLevel]
  // );

  // useEffect(() => {
  //   window.addEventListener("keydown", handleKeyDownModal);
  //   return () => window.removeEventListener("keydown", handleKeyDownModal);
  // }, [handleKeyDownModal]);

  // useEffect(() => {
  //   // Reset modal count when level changes
  //   setHomeRowChecksThisLevel(0);
  // }, [currentLevel]);
  useEffect(() => {
    // Reset modal count when level changes
    setHomeRowCheckOpen(true);
    setTimerStarted(false);
  }, [currentLevel, selectedLeague]);

  // Add this inside your TypingGamePage component
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        resetGame(false, true); // Trigger reset game when Enter key is pressed
      }
    };

    // Add event listener when modal is open
    if (showModal) {
      document.addEventListener("keydown", handleKeyDown);
    }

    // Clean up the event listener when the modal is closed
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal]); // Run this effect when 'showModal' changes

  const getRandomWords = (level: number): string[] => {
    const minChars = level * 5 - 20;
    const maxChars = level * 5 + 20;

    const attempts = 1000;

    for (let attempt = 0; attempt < attempts; attempt++) {
      const result: string[] = [];

      // Step 1: Generate base words
      for (let i = 0; i < level; i++) {
        const key = wordLengthKeys[Math.floor(Math.random() * wordLengthKeys.length)];
        const wordList = words[key];
        const word = wordList[Math.floor(Math.random() * wordList.length)];
        result.push(word);
      }

      // Step 2: Try inserting an item using cycle logic
      const selectedItem = getRandomItemWithChance(orderedItems, 0.25);
      let itemIndex = -1;

      if (selectedItem) {
        itemIndex = Math.floor(Math.random() * result.length);
        result[itemIndex] = selectedItem;
      }

      // Step 3: 10% chance to insert a powerup (avoid overwriting item)
      if (Math.random() < 0.1 && words.powerups?.length) {
        const powerup = words.powerups[Math.floor(Math.random() * words.powerups.length)];
        let powerupIndex = Math.floor(Math.random() * result.length);

        let avoidConflictAttempts = 0;
        while (powerupIndex === itemIndex && result.length > 1 && avoidConflictAttempts < 5) {
          powerupIndex = Math.floor(Math.random() * result.length);
          avoidConflictAttempts++;
        }

        result[powerupIndex] = powerup;
      }

      // Step 4: Check character count
      const totalChars = result.reduce((sum, word) => sum + word.length, 0);
      if (totalChars >= minChars && totalChars <= maxChars) {
        // Step 5: Optionally inject collectible pair
        if (level >= 10) {
          const randomPair =
            allCollectiblePairs[Math.floor(Math.random() * allCollectiblePairs.length)];
          const pairWords = randomPair.split(" ");

          const replaceIndex = Math.floor(Math.random() * (result.length - 1));
          result.splice(replaceIndex, 2, ...pairWords);
        }

        return result;
      }
    }

    // Fallback: basic list
    const fallbackWords = Array.from({ length: level }, () => {
      const key = wordLengthKeys[Math.floor(Math.random() * wordLengthKeys.length)];
      const wordList = words[key];
      return wordList[Math.floor(Math.random() * wordList.length)];
    });
    return fallbackWords;
  };

  const loadLevelWords = (level: number) => {
    const sourceWords = getRandomWords(level);
    const nextWords = decorateWordsForLeague(sourceWords, selectedLeague, difficulties.password);
    wordMistakeRecordedIndexesRef.current = new Set();
    runDifficultyTagsRef.current = getActiveDifficultyTags(difficulties);
    setSourceWordList(sourceWords);
    setActiveWordList(nextWords);
    lastWordRef.current = sourceWords[sourceWords.length - 1]; // ✅ Store last word
    setStatuses(Array(nextWords.join(" ").length).fill(null)); // immediate sync
    if (containerRef.current) {
      const widths = calculateLineWidths(containerRef, nextWords);
      setLineCharCount(widths);
    }
  };

  const fullText = useMemo(() => activeWordList.join(" "), [activeWordList]);
  const fullTextCharacters = useMemo(() => fullText.split(""), [fullText]);
  const charWordIndexes = useMemo(() => {
    const indexes: number[] = [];

    activeWordList.forEach((word, wordIndex) => {
      for (let i = 0; i < word.length; i++) {
        indexes.push(wordIndex);
      }

      if (wordIndex < activeWordList.length - 1) {
        indexes.push(wordIndex + 1);
      }
    });

    return indexes;
  }, [activeWordList]);
  const wordCompletionIndexes = useMemo(() => {
    let index = 0;
    return activeWordList.map((word) => {
      index += word.length + 1;
      return index;
    });
  }, [activeWordList]);
  const [highscoreLevel, highscoreCharCount] = useMemo(() => {
    const [level = "0", chars = "0"] = highscore.split(".");
    return [Number(level), Number(chars)];
  }, [highscore]);

  const recordLeaderboardRun = (statusSnapshot = statuses, lost = false) => {
    if (runRecordedRef.current) return;

    runRecordedRef.current = true;

    const correctChars = statusSnapshot.filter((status) => status === "correct").length;
    const dateKey = getDateKey();
    const timestamp = new Date().toISOString();
    const difficultyTags = Array.from(new Set(runDifficultyTagsRef.current));
    const difficultyLossTags = lost ? difficultyTags : [];
    const run: LeaderboardRun = {
      id: `${timestamp}-${Math.random().toString(36).slice(2)}`,
      playerName,
      league: selectedLeague,
      lost,
      difficultyTags: difficultyLossTags.length ? difficultyLossTags : undefined,
      scoreLabel: `${currentLevel}.${correctChars}`,
      scoreValue: currentLevel * 10000 + correctChars,
      level: currentLevel,
      correctChars,
      elapsedSeconds: Math.max(0, TIMER - timer),
      timestamp,
      dateKey,
    };

    const allTimeStorageRuns = keepTopLeaderboardRuns([
      ...readLeaderboardRuns(getLeaderboardStorageKey("allTime", selectedLeague)),
      run,
    ]);
    const todayStorageKey = getLeaderboardStorageKey("today", selectedLeague, dateKey);
    const todayStorageRuns = keepTopLeaderboardRuns([...readLeaderboardRuns(todayStorageKey), run]);

    localStorage.setItem(
      getLeaderboardStorageKey("allTime", selectedLeague),
      JSON.stringify(allTimeStorageRuns)
    );
    localStorage.setItem(todayStorageKey, JSON.stringify(todayStorageRuns));
    setAllTimeRuns(allTimeStorageRuns);
    setTodayRuns(todayStorageRuns);
  };

  const [itemCollectedThisLevel, setItemCollectedThisLevel] = useState(false);
  const [powerupCollectedThisLevel, setPowerupCollectedThisLevel] = useState(false);

  const collectResourceForWord = (displayWord: string | undefined) => {
    if (!displayWord) return;

    const wordKey = normalizeCollectedWord(displayWord);
    if (!wordKey) return;

    if (!itemCollectedThisLevel && itemWordSet.has(wordKey)) {
      setCollectedItemCounts((prev) => {
        const updated = {
          ...prev,
          [wordKey]: (prev[wordKey] || 0) + 1,
        };
        localStorage.setItem("collectedItemCounts", JSON.stringify(updated));
        return updated;
      });
      setItemCollectedThisLevel(true);
    }

    if (!powerupCollectedThisLevel && powerupWordSet.has(wordKey)) {
      setCollectedPowerupCounts((prev) => {
        const updated = {
          ...prev,
          [wordKey]: (prev[wordKey] || 0) + 1,
        };
        localStorage.setItem("collectedPowerupCounts", JSON.stringify(updated));
        return updated;
      });
      setPowerupCollectedThisLevel(true);
    }
  };

  const collectWord = (displayWord: string | undefined, wordIndex: number, animate = true) => {
    if (!displayWord) return false;

    const wordKey = normalizeCollectedWord(displayWord);
    if (!wordKey) return false;

    const isTargetCollected = collectedWordSet.has(wordKey);

    if (!isTargetCollected) {
      const updatedWords = [...collectedWords, wordKey];
      setCollectedWords(updatedWords);
      localStorage.setItem("collectedWords", JSON.stringify(updatedWords));

      if (animate) {
        startCollectionFlight(wordIndex, 1);
      }
    }

    if (!isTargetCollected && !newWordSet.has(wordKey)) {
      const updatedNew = [...newWords, wordKey];
      setNewWords(updatedNew);
      localStorage.setItem("newWords", JSON.stringify(updatedNew));
    }

    return !isTargetCollected;
  };

  const collectCompletedWord = (
    displayWord: string | undefined,
    wordIndex: number,
    sourceWords: string[],
    animateSingle = true
  ) => {
    collectResourceForWord(displayWord);
    const foundPair = checkForNewPairsFromWords(sourceWords);
    collectWord(displayWord, wordIndex, animateSingle && !foundPair);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const lastChar = value[value.length - 1];
    const justTypedChar = fullText[currentIndex];
    const newIndex = currentIndex + 1;

    resetInactivityTimer();
    if (pausedForInactivity) setPausedForInactivity(false);

    // Check if space was just typed and we're on a word boundary
    if (lastChar === " " && justTypedChar === " ") {
      // Get the word the user just typed (excluding the space)
      const typedWords = value.trimEnd().split(" ");
      const targetWordIndex = typedWords.length - 1;
      const lastTypedWord = typedWords[typedWords.length - 1];

      // Get the corresponding word from the target text
      const targetWord = activeWordList[targetWordIndex];
      const sourceWord = sourceWordList[targetWordIndex] || targetWord;

      // // Check if all characters in the target word were typed correctly
      // let charStart = 0;
      // for (let i = 0; i < typedWords.length - 1; i++) {
      //   charStart += fullWords[i].length + 1; // +1 for space
      // }

      // Find the character index where the lastTypedWord ends
      const endCharIndex = wordCompletionIndexes[targetWordIndex] || 0;

      // Check if all characters up to that point are correct
      let isFullyCorrect = true;
      for (let i = 0; i < endCharIndex - 1; i++) {
        if (statuses[i] !== "correct") {
          isFullyCorrect = false;
          break;
        }
      }

      if (isFullyCorrect) {
        if (lastTypedWord === targetWord) {
          setCorrectWordCount((prev) => prev + 1);
          collectCompletedWord(sourceWord, targetWordIndex, sourceWordList.slice(0, targetWordIndex + 1));
        }
      }
    }

    const isBackspace = value.length < input.length;

    if (isBackspace) {
      const newStatuses = [...statuses];
      newStatuses[currentIndex - 1] = null;
      setStatuses(newStatuses);
      setCurrentIndex((prev) => Math.max(prev - 1, 0));
      setInput(value);
      return;
    }

    // If the first character typed is a space, start the timer but don't advance index or change status
    if (value.length === 1 && lastChar === " " && !timerStarted) {
      setTimerStarted(true);
      setInput(value);
      return;
    }

    if (currentIndex >= fullText.length) return; // prevent typing beyond the word list

    const newStatuses = [...statuses];
    const isCorrect = lastChar === fullText[currentIndex];
    const expectedChar = fullText[currentIndex];
    const expectedWordIndex =
      expectedChar === " " ? Math.max(0, charWordIndexes[currentIndex] - 1) : charWordIndexes[currentIndex];

    recordKeyAttempt(expectedChar, isCorrect);
    if (!isCorrect) {
      recordWordMistake(expectedWordIndex);
    }

    newStatuses[currentIndex] = isCorrect ? "correct" : "incorrect";

    // 🔥 Perfection mode ends the game immediately on mistake
    if (difficulties.perfection && !isCorrect) {
      setStatuses(newStatuses);
      recordLeaderboardRun(newStatuses, true);
      setGameCompleted(true);
      setShowModal(true);
      return;
    }

    setStatuses(newStatuses);
    setCurrentIndex(currentIndex + 1);
    setInput(value);

    // newIndex = currentIndex + 1;
    if (newIndex > currentLineEndIndex && currentLine < lineCharCount.length - 1) {
      setCurrentLine((prev) => prev + 1);
      if (containerRef.current && currentLine >= scrollAnchorLine + 3) {
        const lineHeight = 21.84 * 1.2; // adjust if needed /////////////////////////////
        containerRef.current.scrollBy({
          top: lineHeight,
          behavior: "smooth",
        });
      }
    }

    // Update highscore based on the number of correct characters typed so far
    const correctCount = newStatuses.filter((s) => s === "correct").length;
    const score = `${currentLevel}.${correctCount}`;

    // Update highscore if the new count is greater
    if (currentLevel >= highscoreLevel && correctCount > highscoreCharCount && !isCasual) {
      setIsNewHighscore(true);
      setHighscore(score);
      setShouldShake(true);
      setHighscoreUpdated(true);
      setTimeout(() => setShouldShake(false), 300); // Match the duration of animation
    }

    // Check if all the letters are correct before timer runs out
    if (correctCount === fullText.length) {
      startNextLevel(value);
    }

    // Start the timer on the first key press if not already started
    if (!timerStarted) {
      setTimerStarted(true);
    }
  };

  const handleTimeOut = () => {
    // collectLastTypedWord();
    recordLeaderboardRun(statuses, true);
    setShowModal(true);
  };

  useEffect(() => {
    handleTimeOutRef.current = handleTimeOut;
  });

  const startNextLevel = (completedInput = input) => {
    const typedWords = completedInput.trim().split(" ");
    const lastTypedWord = typedWords[typedWords.length - 1];
    const lastWord = lastWordRef.current;
    const lastDisplayWord = activeWordList[activeWordList.length - 1];

    if (lastTypedWord === lastDisplayWord) {
      collectCompletedWord(lastWord, activeWordList.length - 1, sourceWordList);
    }

    setItemCollectedThisLevel(false);
    setPowerupCollectedThisLevel(false);
    // handleLevelComplete();
    handleWin();
    setGameCompleted(true);

    if (isCasual) {
      setCurrentLevel((prev) => prev + 1);
    } else {
      const nextLevel = currentLevel + 1;
      setCurrentLevel(nextLevel);
      saveLeagueLevel(nextLevel);
      const score = `${nextLevel}.0`;
      if (parseFloat(score) > parseFloat(highscore)) {
        setHighscore(score); // Update highscore if new one is better
      }
    }

    setCurrentLine(0);
    setTimer(TIMER); // Reset the timer
    setInput(""); // Clear the input field
    setCurrentIndex(0); // Reset index
    setTimerStarted(false); // Reset the timer start flag
    setGameCompleted(false); // Reset the game completed flag
    setCorrectWordCount((prev) => prev + 1);
    if (containerRef.current) {
      containerRef.current.scrollBy({
        top: -10000,
        behavior: "smooth",
      });
    }
  };

  const resetGame = (offCasual?: boolean, fromHighscoreModal?: boolean) => {
    // const shouldResetToLevel1 = offCasual && !fromHighscoreModal;
    runRecordedRef.current = false;
    if (containerRef.current) {
      containerRef.current.scrollBy({
        top: -10000,
        behavior: "smooth",
      });
    }
    setCurrentLine(0);
    setIsNewHighscore(false);
    setHighscoreUpdated(false); // call this wherever you reset game
    setTimer(TIMER); // Reset timer
    setGameCompleted(false);
    setShowModal(false);
    setInput(""); // Reset input field
    setCurrentIndex(0); // Reset index
    //   setCurrentLevel((prev) => { if(shouldResetToLevel1) return 1; return prev> 1? prev - 1: 1})
    const nextLevel = offCasual || isHardcore ? 1 : Math.max(1, currentLevel - 1);
    setCurrentLevel(nextLevel);
    if (nextLevel === currentLevel) {
      loadLevelWords(nextLevel);
    }
    setTimerStarted(false); // Reset timer start flag
  };

  const collectedWordCount = collectedWords.length;
  const wordCollectionPercent = Math.round((collectedWordCount / totalWordCount) * 100);
  const leaderboardRuns = leaderboardTab === "allTime" ? allTimeRuns : todayRuns;
  const todayLeaderboardLabel = getDateKey();
  const topWordMistakes = useMemo(() => getTopWordMistakes(wordMistakeStats), [wordMistakeStats]);

  // const [leaderboard, setLeaderboard] = useState([
  //   { name: "brian", highscore: 12 },
  //   { name: "derp", highscore: 16 },
  // ]);

  // useEffect(() => {
  //   const ws = new WebSocket("ws://localhost:3001");

  //   ws.onmessage = (event) => {
  //     const msg = JSON.parse(event.data);
  //     if (msg.type === "leaderboard") {
  //       setLeaderboard(msg.data); // Set state
  //     }
  //   };

  //   ws.onopen = () => {
  //     const name = localStorage.getItem("username") || "Guest";
  //     const highscore = localStorage.getItem("highscore") || "0.0";
  //     ws.send(JSON.stringify({ name, highscore }));
  //   };

  //   return () => ws.close();
  // }, []);

  // const animatePairToBackpack = (fromEl: HTMLElement, toEl: HTMLElement) => {
  //   const flyEl = flyRef.current;
  //   if (!flyEl) return;

  //   const fromRect = fromEl.getBoundingClientRect();
  //   const toRect = toEl.getBoundingClientRect();

  //   flyEl.style.left = `${fromRect.left}px`;
  //   flyEl.style.top = `${fromRect.top}px`;
  //   flyEl.style.opacity = "1";
  //   flyEl.style.transform = "translate(0, 0)";

  //   // Force reflow to start transition
  //   void flyEl.offsetWidth;

  //   const dx = toRect.left - fromRect.left;
  //   const dy = toRect.top - fromRect.top;

  //   flyEl.style.transform = `translate(${dx}px, ${dy}px) scale(0.2)`;
  //   flyEl.style.opacity = "0";

  //   setTimeout(() => {
  //     flyEl.style.transform = "";
  //     flyEl.style.opacity = "0";
  //   }, 1000);
  // };

  // const collectLastTypedWord = () => {
  //   const fullWords = fullText.split(" ");
  //   const typedUpTo = fullText.slice(0, currentIndex);
  //   const typedWords = typedUpTo.trim().split(" ");
  //   const lastIndex = typedWords.length - 1;

  //   if (lastIndex >= 0 && lastIndex < fullWords.length) {
  //     const typedWord = typedWords[lastIndex];
  //     const expectedWord = fullWords[lastIndex];

  //     if (typedWord === expectedWord && !collectedWords.includes(typedWord)) {
  //       const updated = [...collectedWords, typedWord];
  //       setCollectedWords(updated);
  //       localStorage.setItem("collectedWords", JSON.stringify(updated));
  //     }
  //   }
  // };

  const [newPairs, setNewPairs] = useState<string[]>(() => {
    const stored = localStorage.getItem("newPairs");
    return stored ? JSON.parse(stored) : [];
  });
  const newPairSet = useMemo(() => new Set(newPairs), [newPairs]);
  useEffect(() => {
    if (!drawerOpen) {
      setNewPairs([]); // 👈 Clear "New" flags
    }
  }, [drawerOpen]);

  const getRandomItemWithChance = (items: string[], chance = 0.5): string | null => {
    if (Math.random() < 0.25) {
      return null;
    }
    for (const item of items) {
      if (Math.random() < chance) {
        return item;
      }
    }
    return null;
  };

  return (
    <Stack
      sx={{
        justifyContent: "center",
        alignItems: "center",
        minHeight: "calc(100vh - 1.5rem)",
        background: "linear-gradient(to right, #283c86, #45a247)",
      }}>
      {/* <div
        ref={flyRef}
        style={{
          position: "fixed",
          pointerEvents: "none",
          zIndex: 2000,
          opacity: 0,
          fontWeight: "bold",
          color: "gold",
          fontSize: "1rem",
          transition: "transform 0.8s ease-in-out, opacity 0.3s ease-in",
        }}>
        🎒+
      </div> */}

      {collectionFlights.map((flight) => (
        <CollectionFlightStar
          key={flight.id}
          flight={flight}
          onFinish={handleCollectionFlightFinish}
        />
      ))}

      {backpackBursts.map((burst) => (
        <BackpackBurstEffect
          key={burst.id}
          burst={burst}
          onComplete={handleBackpackBurstComplete}
        />
      ))}

      <Typography
        sx={{
          position: "absolute",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          color: "white",
          fontWeight: "bold",
          letterSpacing: 0,
          textShadow: "0 2px 8px rgba(0, 0, 0, 0.45)",
          zIndex: 5,
        }}>
        {playerName}
      </Typography>

      <Drawer
        anchor='right'
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setNewWords([]);
          setNewPairs([]);
          setNewlyCollectedCount(0);

          localStorage.removeItem("newWords");
          localStorage.removeItem("newPairs");
          localStorage.setItem("newlyCollectedCount", "0");
        }}
        PaperProps={{
          sx: {
            width: "33%",
            backgroundColor: "#1c1c1c",
            color: "white",
            padding: 2,
          },
        }}>
        {drawerOpen && (
          <>
            <Typography
              variant='h5'
              sx={{ mb: 2, color: "marigold", textAlign: "center", fontWeight: "bold" }}>
              📘 Word Collection
            </Typography>
            <Typography
              variant='h5'
              sx={{
                mb: 2,
                color: "marigold",
                textAlign: "center",
                fontWeight: "bold",
                lineHeight: ".25rem",
              }}>
              {" "}
              ({collectedWordCount} / {totalWordCount}) {wordCollectionPercent}%
            </Typography>

            <Accordion
              defaultExpanded={false}
              sx={{
                backgroundColor: "#2e2e2e",
                color: "white",
                border: "1px solid #555",
                borderRadius: "8px",
                mb: 1,
                "&:before": { display: "none" },
              }}>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: "gold" }} />}
                sx={{
                  backgroundColor: "#1c1c1c",
                  borderBottom: "1px solid #333",
                  borderRadius: "8px 8px 0 0",
                  "& .MuiTypography-root": {
                    color: "gold",
                    fontWeight: "bold",
                  },
                }}>
                <Typography sx={{ color: "gold", mb: 1 }}>Single Words</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {sortedWordEntries.map(([length, wordList]) => (
                    <Box
                      key={length}
                      sx={{ mb: 2 }}>
                      <Typography sx={{ color: "#aaa", fontWeight: "bold", mb: 1 }}>
                        Length {length}
                      </Typography>
                      <List
                        dense
                        sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                        {wordList.map((word, index) => (
                          <ListItem
                            key={`${length}-${word}-${index}`}
                            sx={{
                              width: "auto",
                              p: 0.5,
                              pl: 1,
                              pr: 1,
                              backgroundColor: "#333",
                              borderRadius: 1,
                              color: collectedWordSet.has(word) ? "white" : "#888",
                              fontWeight: collectedWordSet.has(word) ? "bold" : "normal",
                              textTransform: "capitalize",
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}>
                            <span>{word}</span>
                            {newWordSet.has(word) && (
                              <Typography
                                component='span'
                                sx={{ color: "hotpink", fontSize: "0.75rem", fontWeight: "bold" }}>
                                New
                              </Typography>
                            )}
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  ))}
              </AccordionDetails>
            </Accordion>

            <Typography
              variant='h5'
              sx={{ mb: 2, color: "marigold", textAlign: "center", fontWeight: "bold" }}>
              🎒 Word Pair Collection
            </Typography>

            {Object.entries(collectiblePairs).map(([theme, pairs]) => {
              const collectedCount = pairs.filter((pair) => collectedPairSet.has(pair)).length;
              return (
                <Accordion
                  key={theme}
                  defaultExpanded={false}
                  sx={{
                    backgroundColor: "#2e2e2e",
                    color: "white",
                    border: "1px solid #555",
                    borderRadius: "8px",
                    mb: 1,
                    "&:before": { display: "none" },
                  }}>
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon sx={{ color: "gold" }} />}
                    sx={{
                      backgroundColor: "#1c1c1c",
                      borderBottom: "1px solid #333",
                      borderRadius: "8px 8px 0 0",
                      "& .MuiTypography-root": {
                        color: "gold",
                        fontWeight: "bold",
                      },
                    }}>
                    <Typography>
                      {theme} ({collectedCount} / {pairs.length})
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ backgroundColor: "#1c1c1c" }}>
                    <List dense>
                      {pairs.map((pair) => {
                        return (
                          <Box
                            key={pair}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              px: 1,
                              py: 0.5,
                            }}>
                            <Typography
                              sx={{
                                color: collectedPairSet.has(pair) ? "marigold" : "#888",
                                fontWeight: collectedPairSet.has(pair) ? "bold" : "normal",
                                textTransform: "capitalize",
                              }}>
                              {pair}
                            </Typography>
                            {newPairSet.has(pair) && (
                              <Typography
                                sx={{
                                  fontSize: "0.7rem",
                                  color: "hotpink",
                                  fontWeight: "bold",
                                  ml: 1,
                                }}>
                                New
                              </Typography>
                            )}
                          </Box>
                        );
                      })}
                    </List>
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </>
        )}
      </Drawer>
      <Drawer
        anchor='right'
        open={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: "92%", sm: 380 },
            backgroundColor: "#1c1c1c",
            color: "white",
            p: 2,
          },
        }}>
        <Typography
          variant='h5'
          sx={{ color: "gold", fontWeight: "bold", mb: 1 }}>
          Leaderboard
        </Typography>
        <Typography sx={{ color: "#aaa", mb: 2, textTransform: "capitalize" }}>
          {playerName} - {leagueTrophies[selectedLeague].emoji} {selectedLeague} League
        </Typography>
        <Tabs
          value={leaderboardTab}
          onChange={(_, value) => setLeaderboardTab(value as LeaderboardTabId)}
          variant='fullWidth'
          sx={{
            mb: 2,
            minHeight: 38,
            "& .MuiTab-root": { color: "#aaa", minHeight: 38, textTransform: "none" },
            "& .Mui-selected": { color: "gold !important", fontWeight: "bold" },
            "& .MuiTabs-indicator": { backgroundColor: "gold" },
          }}>
          <Tab
            value='allTime'
            label='All Time'
          />
          <Tab
            value='today'
            label='Today'
          />
        </Tabs>
        <Typography sx={{ color: "#888", fontSize: "0.85rem", mb: 1 }}>
          {leaderboardTab === "allTime" ? "Top 10 runs" : `Top 10 runs for ${todayLeaderboardLabel}`}
        </Typography>
        <Stack spacing={1}>
          {leaderboardRuns.length === 0 ? (
            <Typography sx={{ color: "#777", py: 2 }}>No runs yet.</Typography>
          ) : (
            leaderboardRuns.map((run, index) => (
              <Box
                key={run.id}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "32px 1fr auto",
                  gap: 1,
                  alignItems: "center",
                  bgcolor: index === 0 ? "#3D2E00" : "#2e2e2e",
                  border: index === 0 ? "1px solid #ffe135" : "1px solid #444",
                  borderRadius: 1,
                  p: 1,
                }}>
                <Typography sx={{ color: index === 0 ? "gold" : "#bbb", fontWeight: "bold" }}>
                  #{index + 1}
                </Typography>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: "bold", color: "white" }}>{run.playerName}</Typography>
                  <Typography sx={{ color: "#aaa", fontSize: "0.78rem" }}>
                    {new Date(run.timestamp).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}{" "}
                    · {run.elapsedSeconds}s
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.75 }}>
                  {(run.difficultyTags || []).map((difficulty) => {
                    const badge = difficultyBadges[difficulty];
                    if (!badge) return null;

                    return (
                      <Tooltip
                        key={`${run.id}-${difficulty}`}
                        title={`Lost with ${badge.label} enabled`}
                        arrow>
                        <Box
                          component='span'
                          sx={{
                            minWidth: 18,
                            height: 18,
                            px: 0.4,
                            borderRadius: "50%",
                            border: `1px solid ${badge.color}`,
                            color: badge.color,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.72rem",
                            fontWeight: "bold",
                            lineHeight: 1,
                            boxShadow: `0 0 8px ${badge.color}`,
                          }}>
                          {badge.symbol}
                        </Box>
                      </Tooltip>
                    );
                  })}
                  <Typography sx={{ color: "gold", fontWeight: "bold" }}>{run.scoreLabel}</Typography>
                </Box>
              </Box>
            ))
          )}
        </Stack>
      </Drawer>
      <Drawer
        anchor='right'
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: "95%", sm: 520 },
            backgroundColor: "#1c1c1c",
            color: "white",
            p: 2,
          },
        }}>
        <Typography
          variant='h5'
          sx={{ color: "gold", fontWeight: "bold", mb: 0.5 }}>
          Typing Stats
        </Typography>
        <Typography sx={{ color: "#aaa", mb: 2, textTransform: "capitalize" }}>
          {leagueTrophies[selectedLeague].emoji} {selectedLeague} League
        </Typography>
        <Stack spacing={0.75}>
          {keyboardRows.map((row, rowIndex) => (
            <Box
              key={`keyboard-row-${rowIndex}`}
              sx={{
                display: "flex",
                justifyContent: "center",
                gap: 0.75,
              }}>
              {row.map((key) => {
                const stat = keyStats[key];
                const accuracy = stat?.attempts
                  ? Math.round(((stat.attempts - stat.misses) / stat.attempts) * 100)
                  : null;

                return (
                  <Tooltip
                    key={key}
                    title={getKeyStatLabel(key, stat)}
                    arrow>
                    <Box
                      sx={{
                        width: key === "Space" ? 150 : 38,
                        height: 38,
                        borderRadius: 1,
                        bgcolor: getKeyAccuracyColor(stat),
                        border: "1px solid rgba(255, 255, 255, 0.18)",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "bold",
                        fontSize: key === "Space" ? "0.75rem" : "0.9rem",
                        boxShadow: stat?.attempts ? "0 0 10px rgba(0, 0, 0, 0.25)" : "none",
                        flexShrink: 0,
                      }}>
                      {key === "Space" ? `Space${accuracy !== null ? ` ${accuracy}%` : ""}` : key}
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>
          ))}
        </Stack>
        <Box sx={{ mt: 2.25 }}>
          <Box
            sx={{
              height: 16,
              borderRadius: "999px",
              border: "1px solid rgba(255, 255, 255, 0.28)",
              background:
                "linear-gradient(to right, hsl(0, 68%, 43%) 0%, hsl(30, 70%, 46%) 40%, hsl(60, 72%, 43%) 80%, hsl(90, 70%, 42%) 90%, hsl(120, 68%, 43%) 100%)",
              boxShadow: "inset 0 1px 5px rgba(0, 0, 0, 0.36), 0 0 12px rgba(255, 255, 255, 0.08)",
            }}
          />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              mt: 0.75,
              color: "#bbb",
              fontSize: "0.74rem",
              fontWeight: "bold",
            }}>
            {keyAccuracyScaleTicks.map((tick) => (
              <Box
                key={tick}
                component='span'
                sx={{
                  textAlign: tick === 0 ? "left" : tick === 100 ? "right" : "center",
                }}>
                {tick}% correct
              </Box>
            ))}
          </Box>
        </Box>
        <Typography
          variant='h6'
          sx={{ color: "gold", fontWeight: "bold", mt: 3, mb: 1 }}>
          Mistake Words
        </Typography>
        <Stack spacing={1}>
          {topWordMistakes.length === 0 ? (
            <Typography sx={{ color: "#777", py: 1 }}>No mistake words yet.</Typography>
          ) : (
            topWordMistakes.map((stat, index) => (
              <Box
                key={stat.word}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "32px 1fr auto",
                  gap: 1,
                  alignItems: "center",
                  bgcolor: index === 0 ? "#3D2E00" : "#2e2e2e",
                  border: index === 0 ? "1px solid #ffe135" : "1px solid #444",
                  borderRadius: 1,
                  p: 1,
                }}>
                <Typography sx={{ color: index === 0 ? "gold" : "#bbb", fontWeight: "bold" }}>
                  #{index + 1}
                </Typography>
                <Typography sx={{ color: "white", fontWeight: "bold", textTransform: "capitalize" }}>
                  {stat.word}
                </Typography>
                <Typography sx={{ color: "tomato", fontWeight: "bold" }}>{stat.mistakeCount}</Typography>
              </Box>
            ))
          )}
        </Stack>
      </Drawer>
      <Stack
        direction='row'
        alignItems='center'
        spacing={0.75}
        sx={{
          position: "absolute",
          top: 10,
          left: 10,
          zIndex: 10,
          flexWrap: "wrap",
          maxWidth: { xs: "62vw", md: "none" },
        }}>
        {leagueIds.map((league) => {
          const isActiveLeague = selectedLeague === league;
          const trophy = leagueTrophies[league];
          const leagueLabel = `${league[0].toUpperCase()}${league.slice(1)} League`;
          const leagueCurrentLevel = leagueCurrentLevels[league] || officialLeagueLevels[league] || 1;
          const leagueMaxLevel = officialLeagueLevels[league] || 1;

          return (
            <Tooltip
              key={league}
              title={`${leagueLabel} - Current level ${leagueCurrentLevel}. Max level ${leagueMaxLevel}. ${leagueDescriptions[league]}`}
              arrow>
              <Box
                onClick={() => setSelectedLeague(league)}
                sx={{
                  width: 54,
                  minHeight: 58,
                  borderRadius: 1,
                  border: isActiveLeague
                    ? `2px solid ${trophy.color}`
                    : "1px solid rgba(255, 255, 255, 0.22)",
                  bgcolor: isActiveLeague ? "rgba(255, 225, 53, 0.12)" : "rgba(0, 0, 0, 0.18)",
                  color: "white",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: isActiveLeague
                    ? `0 0 16px ${trophy.color}, inset 0 0 12px rgba(255, 255, 255, 0.12)`
                    : "none",
                  transform: isActiveLeague ? "translateY(1px)" : "none",
                  transition: "border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
                  ":hover": {
                    borderColor: trophy.color,
                    boxShadow: `0 0 12px ${trophy.color}`,
                  },
                }}>
                <Typography
                  aria-hidden='true'
                  sx={{
                    color: trophy.color,
                    fontSize: "1.15rem",
                    lineHeight: 1,
                    filter: isActiveLeague ? `drop-shadow(0 0 5px ${trophy.color})` : "none",
                  }}>
                  {trophy.emoji}
                </Typography>
                <Typography
                  sx={{
                    mt: 0.35,
                    color: isActiveLeague ? trophy.color : "#d5d5d5",
                    fontSize: "0.72rem",
                    fontWeight: "bold",
                    lineHeight: 1,
                  }}>
                  Lv {leagueCurrentLevel}
                </Typography>
                <Typography
                  sx={{
                    mt: 0.2,
                    color: isActiveLeague ? trophy.color : "#aaa",
                    fontSize: "0.62rem",
                    fontWeight: "bold",
                    lineHeight: 1,
                  }}>
                  Max {leagueMaxLevel}
                </Typography>
              </Box>
            </Tooltip>
          );
        })}
      </Stack>
      <Stack
        direction={"row"}
        sx={{ position: "absolute", top: 10, right: 10 }}>
        <Stack
          spacing={0.5}
          alignItems='flex-end'>
          <Stack direction={"row"}>
            <Stack
              direction='row'
              alignItems='center'
              justifyContent='flex-end'
              spacing={0.5}
              sx={{ pr: 1 }}>
              {difficultyOptions.map((difficulty) => {
                const badge = difficultyBadges[difficulty];
                const isDisabled = difficulty === "password" && selectedLeague === "bronze";

                return (
                  <Tooltip
                    key={difficulty}
                    title={
                      isDisabled
                        ? "Password difficulty starts in Silver League because Bronze has lowercase words only."
                        : difficultyDescriptions[difficulty]
                    }
                    arrow>
                    <FormControlLabel
                      name={difficulty}
                      control={
                        <Checkbox
                          name={difficulty}
                          checked={difficulties[difficulty]}
                          onChange={handleDifficultiesChange}
                          disabled={isDisabled}
                          size='small'
                          sx={{
                            color: badge.color,
                            p: 0.25,
                            "&.Mui-checked": { color: badge.color },
                            "&.Mui-disabled": { color: "#666" },
                          }}
                        />
                      }
                      label={
                        <Typography
                          sx={{
                            color: isDisabled ? "#777" : difficulties[difficulty] ? badge.color : "#d5d5d5",
                            fontSize: "0.78rem",
                            fontWeight: "bold",
                            lineHeight: 1,
                          }}>
                          {badge.symbol}
                        </Typography>
                      }
                      sx={{
                        m: 0,
                        px: 0.5,
                        py: 0.35,
                        borderRadius: 1,
                        opacity: isDisabled ? 0.58 : 1,
                        border: difficulties[difficulty]
                          ? `1px solid ${badge.color}`
                          : "1px solid rgba(255, 255, 255, 0.22)",
                        bgcolor: difficulties[difficulty] ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.18)",
                        boxShadow: difficulties[difficulty] ? `0 0 10px ${badge.color}` : "none",
                        "& .MuiFormControlLabel-label": {
                          display: "flex",
                        },
                        ":hover": {
                          borderColor: badge.color,
                        },
                      }}
                    />
                  </Tooltip>
                );
              })}
            </Stack>
            <IconButton
              onClick={() => setSettingsOpen(true)}
              sx={{ color: "white", pr: 1, alignSelf: "flex-end" }}>
              <SettingsIcon fontSize='large' />
            </IconButton>
          </Stack>

          {/* Backpack icon with dual badges */}
          <Badge
            badgeContent={newWords.length}
            color='warning'
            invisible={newWords.length === 0}
            anchorOrigin={{ vertical: "top", horizontal: "left" }}
            sx={{
              "& .MuiBadge-badge": {
                transform: "translate(0%, 5%)",
                fontSize: "0.9rem",
                fontWeight: "bold",
                minWidth: 20,
                height: 20,
                padding: "0 4px",
              },
            }}>
            <Badge
              badgeContent={newlyCollectedCount}
              color='info'
              invisible={newlyCollectedCount === 0}
              sx={{
                "& .MuiBadge-badge": {
                  transform: "translate(30%, -35%)",
                  animation: foundNewPair ? `${pulseBadge} 0.8s ease` : "",
                  fontSize: "0.75rem",
                  fontWeight: "bold",
                  minWidth: 20,
                  height: 20,
                  padding: "0 4px",
                },
              }}>
              <IconButton
                id='backpack-icon'
                onClick={() => setDrawerOpen(true)}
                sx={{ color: "white" }}>
                <BackpackIcon fontSize='large' />
              </IconButton>
            </Badge>
          </Badge>
          <Tooltip
            title='Leaderboard'
            arrow>
            <IconButton
              onClick={() => setLeaderboardOpen(true)}
              sx={{ color: "white", mt: -0.5 }}>
              <LeaderboardIcon fontSize='large' />
            </IconButton>
          </Tooltip>
          <Tooltip
            title='Stats'
            arrow>
            <IconButton
              onClick={openStatsDrawer}
              sx={{ color: "white", mt: -1 }}>
              <QueryStatsIcon fontSize='large' />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            bgcolor: "#2e2e2e",
            color: "white",
            p: 4,
            borderRadius: 3,
            boxShadow: 5,
            width: 300,
          }}>
          <Typography
            variant='h6'
            sx={{ mb: 2, textAlign: "center", color: "gold" }}>
            League
          </Typography>
          <RadioGroup
            value={selectedLeague}
            onChange={(e) => setSelectedLeague(e.target.value as LeagueId)}
            sx={{ display: "flex", gap: 1 }}>
            {leagueIds.map((league) => {
              const isActiveLeague = selectedLeague === league;
              const trophy = leagueTrophies[league];
              const leagueCurrentLevel = leagueCurrentLevels[league] || officialLeagueLevels[league] || 1;
              const leagueMaxLevel = officialLeagueLevels[league] || 1;

              return (
                <FormControlLabel
                  key={league}
                  value={league}
                  // name={league}
                  control={<Radio sx={{ display: "none" }} />}
                  label={
                    <Box
                      sx={{
                        textTransform: "capitalize",
                        border: isActiveLeague ? `2px solid ${trophy.color}` : "1px solid grey",
                        borderRadius: 2,
                        px: 2,
                        py: 1,
                        backgroundColor: isActiveLeague ? "#3D2E00" : "#1c1c1c",
                        color: "white",
                        cursor: "pointer",
                        fontWeight: isActiveLeague ? "bold" : "normal",
                        textAlign: "center",
                        boxShadow: isActiveLeague ? `0 0 14px ${trophy.color}` : "none",
                        ":hover": {
                          backgroundColor: "#333",
                        },
                      }}>
                      {trophy.emoji} {league} - Level {leagueCurrentLevel} / Max {leagueMaxLevel}
                    </Box>
                  }
                  sx={{ m: 0 }}
                />
              );
            })}
          </RadioGroup>
          <Typography
            variant='h6'
            sx={{ mt: 3, mb: 1, textAlign: "center", color: "gold" }}>
            Difficulties
          </Typography>
          <FormGroup>
            {difficultyOptions.map((diff) => {
              const isDisabled = diff === "password" && selectedLeague === "bronze";

              return (
                <FormControlLabel
                  key={diff}
                  name={diff}
                  control={
                    <Checkbox
                      name={diff}
                      checked={difficulties[diff]}
                      onChange={
                        (e) => handleDifficultiesChange(e)
                        // (e) => {
                        //   // setDifficulties((prev) => ({ ...prev, [diff]: e.target.checked }));
                        //   handleDifficultiesChange(e);
                        //   return;
                        // }
                        // (e) => setDifficulties((prev) => ({ ...prev, [diff]: e.target.checked }))
                      }
                      disabled={isDisabled}
                      sx={{ color: "white" }}
                    />
                  }
                  label={
                    <Typography sx={{ textTransform: "capitalize", color: isDisabled ? "#777" : "white" }}>
                      {diff}
                    </Typography>
                  }
                />
              );
            })}
          </FormGroup>
          <Typography
            variant='h6'
            sx={{ mt: 3, mb: 1, textAlign: "center", color: "gold" }}>
            Modes
          </Typography>
          <Link to='./marathon'>
            <Button>Marathon Mode {"->"}</Button>
          </Link>
        </Box>
      </Modal>

      {/* <Dialog
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}>
          <DialogTitle>Settings</DialogTitle>
          <DialogContent>
            <FormControl
              component='fieldset'
              sx={{ mb: 2 }}>
              <FormLabel component='legend'>League</FormLabel>
              <RadioGroup
                value={selectedLeague}
                onChange={handleLeagueChange}
                row>
                <FormControlLabel
                  value='bronze'
                  control={<Radio />}
                  label='Bronze'
                />
                <FormControlLabel
                  value='silver'
                  control={<Radio />}
                  label='Silver'
                />
                <FormControlLabel
                  value='gold'
                  control={<Radio />}
                  label='Gold'
                />
                <FormControlLabel
                  value='platinum'
                  control={<Radio />}
                  label='Platinum'
                />
              </RadioGroup>
            </FormControl>
  
            <FormControl component='fieldset'>
              <FormLabel component='legend'>Difficulties</FormLabel>
              <Box sx={{ display: "flex", flexDirection: "column" }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={difficulties.casual}
                      onChange={handleDifficultyChange}
                      name='casual'
                    />
                  }
                  label='Casual'
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={difficulties.hardcore}
                      onChange={handleDifficultyChange}
                      name='hardcore'
                    />
                  }
                  label='Hardcore'
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={difficulties.perfection}
                      onChange={handleDifficultyChange}
                      name='perfection'
                    />
                  }
                  label='Perfection'
                />
              </Box>
            </FormControl>
          </DialogContent>
        </Dialog> */}
      {/* {leaderboard.map((entry, i) => (
          <Typography key={entry.name}>
            {i + 1}. {entry.name} — {entry.highscore}
          </Typography>
        ))} */}
      <Typography
        variant='subtitle1'
        color='gold'
        sx={{ fontWeight: "bold", mb: 1 }}>
        🔥 Streak: {streak} day{streak === 1 ? "" : "s"}
      </Typography>
      <Typography
        variant='h5'
        color='white'
        sx={{
          animation: goalMetFromStorage ? `${glow} 1.5s infinite alternate` : undefined,
          fontWeight: goalMetFromStorage ? "bold" : "normal",
          letterSpacing: goalMetFromStorage ? 1.5 : "normal",
          textTransform: goalMetFromStorage ? "uppercase" : "none",
          mb: ".5rem",
        }}>
        Daily Goal {goalMetFromStorage ? "COMPLETE" : "Progress"}
      </Typography>

      {!goalMetFromStorage && (
        <Tooltip
          title={`${Math.floor(playTime / 60)}m ${playTime % 60}s / 15m — Play Time Goal`}
          arrow>
          <Box
            sx={{
              width: "80%",
              bgcolor: "#2e2e2e",
              height: 12,
              borderRadius: "12px",
              mb: ".3rem",
            }}>
            <Box
              sx={{
                width: `${
                  playTime / DAILY_GOAL_SECONDS >= 1 ? 100 : (playTime / DAILY_GOAL_SECONDS) * 100
                }%`,
                height: "100%",
                borderRadius: "12px",
                bgcolor: correctWordCount >= 75 && currentLevel >= 5 ? "green" : "grey",
                transition: "width 0.5s ease",
              }}
            />
          </Box>
        </Tooltip>
      )}
      {/* <Typography
          variant='caption'
          color='white'
          textAlign='center'
          sx={{ marginBottom: "1rem" }}>
          {Math.floor(playTime / 60)}m {playTime % 60}s / 15m
        </Typography> */}
      {!goalMetFromStorage && (
        <Tooltip
          title={`${correctWordCount} / 75 correct words — Word Accuracy Goal`}
          arrow>
          <Box
            sx={{
              width: "80%",
              bgcolor: "#2e2e2e",
              height: 12,
              borderRadius: "12px",
              mb: ".3rem",
            }}>
            <Box
              sx={{
                width: `${correctWordCount >= 75 ? 100 : (correctWordCount / 75) * 100}%`,
                height: "100%",
                borderRadius: "12px",
                bgcolor: correctWordCount >= 75 ? "green" : "grey",
                transition: "width 0.5s ease",
              }}
            />
          </Box>
        </Tooltip>
      )}
      {/* <Typography
          variant='caption'
          color='white'
          textAlign='center'
          sx={{ marginBottom: "1rem" }}>
          {correctWordCount + "/ 75"}
        </Typography> */}

      {!goalMetFromStorage && (
        <Tooltip
          title={`Level ${currentLevel} / 5 — Minimum Level Goal`}
          arrow>
          <Box
            sx={{
              width: "80%",
              bgcolor: "#2e2e2e",
              height: 12,
              borderRadius: "12px",
              mb: ".5rem",
            }}>
            <Box
              sx={{
                width: `${currentLevel >= 5 ? 100 : (currentLevel / 5) * 100}%`,
                height: "100%",
                borderRadius: "12px",
                bgcolor: currentLevel >= 5 ? "green" : "grey",
                transition: "width 0.5s ease",
              }}
            />
          </Box>
        </Tooltip>
      )}
      {/* <Typography
          variant='caption'
          color='white'
          textAlign='center'
          sx={{ marginBottom: "1rem" }}>
          {currentLevel + "/ 5"}
        </Typography> */}

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
        {orderedItems.map((item) => {
          const count = collectedItemCounts[item] || 0;
          const icon = itemIcons[item];

          return (
            <Box
              key={item}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                fontWeight: "bold",
                color: "gold",
              }}>
              <Box
                component='img'
                src={icon.src}
                alt={icon.alt}
                sx={{
                  width: 30,
                  height: 30,
                  display: "block",
                  filter: count > 0 ? "none" : "grayscale(1) opacity(0.55)",
                }}
              />
              <Typography sx={{ fontWeight: "bold", fontSize: "1rem" }}>{count}</Typography>
            </Box>
          );
        })}
      </Box>

      <Box
        id='box_for_level'
        sx={{
          fontFamily: "monospace",
          padding: 3,
          borderRadius: 3,
          backgroundColor: "#2e2e2e",
          width: "80%",
          // maxWidth: "600px",
        }}>
        <Typography sx={{ color: "#fff", textAlign: "center", fontSize: 28, marginBottom: 2 }}>
          Level {currentLevel}
        </Typography>
        <Box
          sx={{
            fontSize: 24,
            color: "#fff",
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 2,
          }}>
          <Typography>
            HighScore:{" "}
            <Box
              component={"span"}
              sx={{
                display: "inline-block",
                fontWeight: highscoreUpdated ? "bold" : "normal",
                animation: shouldShake ? `${shake} 0.3s ease-in-out` : "none",
              }}>
              {highscore}
            </Box>
          </Typography>

          <Typography
            sx={{
              fontWeight: "bold",
              display: "flex",
              gap: 1,
              alignItems: "center",
              color: "white",
            }}>
            <>
              {difficulties.hardcore && (
                <span style={{ color: "#ff6347", fontWeight: "bold" }}>HARDCORE</span>
              )}
              {difficulties.perfection && (
                <span style={{ color: "#ff69b4", fontWeight: "bold" }}>PERFECTION</span>
              )}
              {difficulties.password && (
                <span style={{ color: "#8be9fd", fontWeight: "bold" }}>PASSWORD</span>
              )}
              {difficulties.casual ? (
                <span style={{ color: "lightgreen", fontWeight: "bold" }}>CASUAL</span>
              ) : pausedForInactivity ? (
                <span style={{ color: "orange", animation: `${pulse} 1s infinite` }}>⏸ Paused</span>
              ) : timer <= INACTIVITY_PAUSE_SECONDS ? (
                <AnimatedTimer
                  key={"timer-" + timer}
                  sx={{
                    animation: `${pulse} 0.5s ease-in-out`,
                  }}>
                  Time left: {timer}s
                </AnimatedTimer>
              ) : (
                <span>Time left: {timer}s</span>
              )}
            </>
          </Typography>
        </Box>

        <Box
          id='active-word-list-box'
          ref={containerRef}
          sx={{
            fontSize: 21.84,
            marginBottom: 2,
            lineHeight: 1.2,
            // maxHeight: `${24 * 1.2 * 3}px`, // 3 lines
            maxHeight: "80vh",
            overflowY: "auto",
            scrollbarWidth: "none", // Firefox
            "&::-webkit-scrollbar": {
              display: "none", // Chrome, Safari
            },
          }}>
          {fullTextCharacters.map((char, i) => {
            const isActive = i === currentIndex;
            const status = statuses[i];

            const wordIndex = charWordIndexes[i];
            const word = sourceWordList[wordIndex] || activeWordList[wordIndex];

            // Base color logic (item/powerup override)
            let baseColor = isActive
              ? "#3D2E00"
              : status === "correct"
              ? "green"
              : status === "incorrect"
              ? "red"
              : "lightgray";

            if (!isActive && !status) {
              if (isItem(word)) baseColor = "gold";
              if (isPowerup(word)) baseColor = "blue";
            }

            const backgroundColor = isActive
              ? "#ffe135" // Banana yellow background for current character
              : status === "correct"
              ? "lightgreen"
              : status === "incorrect"
              ? "lightcoral"
              : "transparent";

            return (
              <span
                key={"awl-" + i}
                data-word-index={wordIndex}
                data-word-char={char === " " ? undefined : "true"}
                style={{
                  color: baseColor,
                  backgroundColor,
                  padding: "2px 5px",
                  borderRadius: isActive ? "4px" : "0px",
                  fontWeight: isActive ? "bold" : "normal",
                }}>
                {char}
              </span>
            );
          })}
        </Box>

        {/* {lineCharCount.map((w, index) => {
            // console.log("linewidths", lineWidths);
            return (
              <Typography
                key={w + "-" + index}
                color='white'>
                {w}
              </Typography>
            );
          })} */}

        <TextField
          type='text'
          inputRef={inputRef}
          value={input}
          onChange={handleChange}
          sx={{
            fontSize: 24,
            width: "100%",
            padding: 2,
            backgroundColor: "#fff",
            borderRadius: 1,
            color: "#333",
          }}
        />

        <Modal
          open={showModal}
          onClose={() => resetGame(false, true)}
          aria-labelledby='modal-title'
          aria-describedby='modal-description'>
          <Box
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              backgroundColor: "white",
              padding: 4,
              borderRadius: 3,
              boxShadow: 5,
              width: "340px",
              textAlign: "center",
              border: isNewHighscore ? "3px solid #4caf50" : "none",
            }}>
            <Typography
              id='modal-title'
              variant='h5'
              sx={{
                fontWeight: "bold",
                color: isNewHighscore ? "#4caf50" : "text.primary",
                mb: 2,
              }}>
              {isNewHighscore ? "🏆 New High Score!" : "So close, try again!"}
            </Typography>

            {isNewHighscore && (
              <Typography
                sx={{
                  fontSize: 16,
                  color: "#388e3c",
                  mb: 2,
                }}>
                You're improving fast — keep it up!
              </Typography>
            )}

            <Button
              onClick={() => resetGame(false, true)}
              variant='contained'
              sx={{
                marginTop: 1,
                borderRadius: 2,
                fontSize: 16,
                backgroundColor: "#45a247",
                "&:hover": {
                  backgroundColor: "#3c8e3c",
                },
              }}>
              {isNewHighscore ? "Keep Going! 🔥" : "Try Again! 💪"}
            </Button>
          </Box>
        </Modal>
      </Box>
      {/* Show Confetti when a level is completed */}
      {showConfetti && <Confetti />}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
      <HomeRowCheckModal
        open={isHomeRowCheckOpen}
        onClose={handleHomeRowCheckClose}
        // setTimerStarted={setTimerStarted}
      />
    </Stack>
  );
};

export default TypingGamePage;
