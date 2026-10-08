import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ShadowBoxingArena, {
  ActiveActionView,
  PhaseEvent,
  PlayerRecapStatus,
} from "./ShadowBoxingArena";
import ShadowBoxingResults from "./ShadowBoxingResults";
import ShadowBoxingSetup from "./ShadowBoxingSetup";
import {
  AI_DIFFICULTIES,
  AiAttackPlan,
  pickQuestionAnswerDirection,
  planAiAttack,
  planAiDefense,
} from "./engine/aiPlayer";
import {
  answerAttackQuestion,
  answerDefenseQuestion,
  completeCorrection,
  continueAfterHeartLost,
  continueAfterRoleSwitch,
  createNewMatch,
  DEFAULT_SETTINGS,
  forceAttacker,
  handleDefenseTimeout,
} from "./engine/gameEngine";
import { nowMs } from "./engine/timing";
import {
  ComboRecap,
  Direction,
  DirectionalOption,
  GameState,
  MatchSettings,
  PlayerId,
} from "./types/shadowBoxing";

const STORAGE_KEY = "shadow-boxing-settings-v1";
const TIMERS_ENABLED = false;
const RECAP_FREEZE_MS = 500;

interface RecapProgress {
  key: string;
  index: number;
}

interface RecapRace {
  key: string;
  attackerId: PlayerId;
  defenderId: PlayerId;
  phase: "attack" | "defense";
  recaps: ComboRecap[];
}

interface RaceFinish {
  key: string;
  atMs: number;
}

const EMPTY_PROGRESS: Record<PlayerId, RecapProgress> = {
  player: { key: "", index: 0 },
  computer: { key: "", index: 0 },
};

const EMPTY_FROZEN_UNTIL: Record<PlayerId, number> = {
  player: 0,
  computer: 0,
};

function emptyRaceFinishes(): Record<PlayerId, RaceFinish | undefined> {
  return {
    player: undefined,
    computer: undefined,
  };
}

function loadSettings(): MatchSettings {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return {
      ...DEFAULT_SETTINGS,
      ...JSON.parse(raw),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: MatchSettings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage is optional for this game.
  }
}

function getArrowDirection(key: string): Direction | undefined {
  if (key === "ArrowUp") return "up";
  if (key === "ArrowRight") return "right";
  if (key === "ArrowDown") return "down";
  if (key === "ArrowLeft") return "left";
  return undefined;
}

function getProgressForRace(
  progress: RecapProgress,
  key: string
): number {
  return progress.key === key ? progress.index : 0;
}

function getRecapRace(
  state: GameState | null,
  completedKeys: string[]
): RecapRace | undefined {
  if (!state || state.comboRecaps.length === 0) return undefined;

  const recapKey = state.comboRecaps
    .map((recap, index) => `${index}:${recap.conceptId}:${recap.correctDirection}`)
    .join("|");

  if (state.phase === "attacker-answer") {
    const key = `attack:${state.attackerId}:${state.defenderId}:${state.attackStartTimeMs}:${recapKey}`;
    if (completedKeys.includes(key)) return undefined;
    return {
      key,
      attackerId: state.attackerId,
      defenderId: state.defenderId,
      phase: "attack",
      recaps: state.comboRecaps,
    };
  }

  if (state.phase === "defender-live" && state.currentAttack) {
    const key = `defense:${state.attackerId}:${state.defenderId}:${state.currentAttack.attackStartedAtMs}:${recapKey}`;
    if (completedKeys.includes(key)) return undefined;
    return {
      key,
      attackerId: state.attackerId,
      defenderId: state.defenderId,
      phase: "defense",
      recaps: state.comboRecaps,
    };
  }

  return undefined;
}

function recapOptions(recap: ComboRecap): DirectionalOption[] {
  return recap.options;
}

function getActualActionView(state: GameState | null): ActiveActionView | undefined {
  if (!state) return undefined;

  if (state.phase === "attacker-answer" && state.attackQuestion) {
    return {
      actorId: state.attackerId,
      promptLabel: state.attackQuestion.prompt,
      options: state.attackQuestion.options,
      mode: "attack",
    };
  }

  if (state.phase === "defender-live" && state.currentAttack) {
    return {
      actorId: state.defenderId,
      promptLabel: state.currentAttack.defenseQuestion.prompt,
      options: state.currentAttack.defenseQuestion.options,
      mode: "defense",
    };
  }

  if (state.phase === "correction" && state.correctionReplay) {
    return {
      actorId: state.defenderId,
      promptLabel: state.correctionReplay.targetConcept.term,
      options: state.correctionReplay.question.options,
      highlightedDirection: state.correctionReplay.question.correctDirection,
      mode: "correction",
    };
  }

  return undefined;
}

function isRaceFinished(
  playerId: PlayerId,
  race: RecapRace | undefined,
  finishes: Record<PlayerId, RaceFinish | undefined>
): boolean {
  return Boolean(race && finishes[playerId]?.key === race.key);
}

function getRecapIndex(
  playerId: PlayerId,
  race: RecapRace,
  progressByPlayer: Record<PlayerId, RecapProgress>,
  finishes: Record<PlayerId, RaceFinish | undefined>
): number {
  if (isRaceFinished(playerId, race, finishes)) {
    return race.recaps.length;
  }

  return Math.min(
    getProgressForRace(progressByPlayer[playerId], race.key),
    race.recaps.length - 1
  );
}

function getActiveViews(
  state: GameState | null,
  recapRace: RecapRace | undefined,
  progressByPlayer: Record<PlayerId, RecapProgress>,
  finishes: Record<PlayerId, RaceFinish | undefined>
): Record<PlayerId, ActiveActionView | undefined> {
  const views: Record<PlayerId, ActiveActionView | undefined> = {
    player: undefined,
    computer: undefined,
  };

  if (recapRace) {
    (["player", "computer"] as PlayerId[]).forEach((playerId) => {
      if (isRaceFinished(playerId, recapRace, finishes)) return;
      const index = getRecapIndex(playerId, recapRace, progressByPlayer, finishes);
      const recap = recapRace.recaps[index];
      if (!recap) return;

      views[playerId] = {
        actorId: playerId,
        promptLabel: recap.prompt,
        options: recapOptions(recap),
        mode: playerId === recapRace.attackerId ? "attack" : "defense",
        isRecap: true,
      };
    });

    return views;
  }

  const activeView = getActualActionView(state);
  if (activeView) {
    views[activeView.actorId] = activeView;
  }

  return views;
}

function getAvailableDirections(activeView: ActiveActionView | undefined): Direction[] {
  return activeView?.options.map((option) => option.direction) ?? [];
}

function isFrozen(playerId: PlayerId, frozenUntil: Record<PlayerId, number>): boolean {
  return frozenUntil[playerId] > nowMs();
}

function canLocalPlayerAct(
  state: GameState | null,
  activeView: ActiveActionView | undefined,
  frozenUntil: Record<PlayerId, number>
): boolean {
  if (!state || !activeView) return false;
  return (
    activeView.actorId === "player" &&
    state.players.player.controller === "local" &&
    !isFrozen("player", frozenUntil)
  );
}

function pickWrongDirection(options: DirectionalOption[], correctDirection: Direction): Direction {
  return (
    options.find((option) => option.direction !== correctDirection)?.direction ??
    correctDirection
  );
}

function DebugPanel({
  state,
  skipDelays,
  onSkipDelaysChange,
  onForceRole,
  paused,
  onPausedChange,
}: {
  state: GameState;
  skipDelays: boolean;
  onSkipDelaysChange: (checked: boolean) => void;
  onForceRole: (attackerId: "player" | "computer") => void;
  paused: boolean;
  onPausedChange: (paused: boolean) => void;
}) {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        position: "fixed",
        right: 12,
        bottom: 12,
        zIndex: 20,
        width: 300,
        p: 1.5,
        borderRadius: 2,
        bgcolor: "rgba(255,255,255,0.96)",
      }}
    >
      <Stack spacing={1}>
        <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
          Debug
        </Typography>
        <Typography variant="caption">Phase: {state.phase}</Typography>
        <Typography variant="caption">
          Attack time: {state.currentAttack?.attackTimeMs.toFixed(1) ?? "none"}
        </Typography>
        <Typography variant="caption">
          Defender limit:{" "}
          {state.currentAttack?.defenderTimeLimitMs.toFixed(1) ?? "none"}
        </Typography>
        <Typography variant="caption">
          Combo failures: {state.comboFailures}
        </Typography>
        <Typography variant="caption">
          Failed concepts: {state.failedConceptIds.join(", ") || "none"}
        </Typography>
        <Typography variant="caption">
          Stored recaps: {state.comboRecaps.length}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button size="small" onClick={() => onForceRole("player")}>
            Human
          </Button>
          <Button size="small" onClick={() => onForceRole("computer")}>
            Computer
          </Button>
        </Stack>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={skipDelays}
              onChange={(event) => onSkipDelaysChange(event.target.checked)}
            />
          }
          label="Skip animations"
        />
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={paused}
              onChange={(event) => onPausedChange(event.target.checked)}
            />
          }
          label="Paused"
        />
      </Stack>
    </Paper>
  );
}

export default function ShadowBoxingGame() {
  const [settings, setSettings] = useState<MatchSettings>(() => loadSettings());
  const [state, setState] = useState<GameState | null>(null);
  const [skipDelays, setSkipDelays] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [paused, setPaused] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [activeDirection, setActiveDirection] = useState<Direction | undefined>();
  const [phaseEvents, setPhaseEvents] = useState<PhaseEvent[]>([]);
  const [completedRecapKeys, setCompletedRecapKeys] = useState<string[]>([]);
  const [recapProgress, setRecapProgress] =
    useState<Record<PlayerId, RecapProgress>>(EMPTY_PROGRESS);
  const [raceFinishes, setRaceFinishes] =
    useState<Record<PlayerId, RaceFinish | undefined>>(emptyRaceFinishes);
  const [frozenUntil, setFrozenUntil] =
    useState<Record<PlayerId, number>>(EMPTY_FROZEN_UNTIL);
  const activeDirectionRef = useRef<Direction | undefined>(undefined);
  const recapProgressRef =
    useRef<Record<PlayerId, RecapProgress>>(EMPTY_PROGRESS);
  const raceFinishesRef =
    useRef<Record<PlayerId, RaceFinish | undefined>>(emptyRaceFinishes());
  const resolvingRaceKeyRef = useRef<string | undefined>(undefined);
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const aiAttackPlanRef = useRef<{
    startTimeMs: number;
    plan: AiAttackPlan;
  } | null>(null);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const startMatch = useCallback(() => {
    const emptyFinishes = emptyRaceFinishes();
    setCompletedRecapKeys([]);
    setRecapProgress(EMPTY_PROGRESS);
    recapProgressRef.current = EMPTY_PROGRESS;
    setRaceFinishes(emptyFinishes);
    raceFinishesRef.current = emptyFinishes;
    setFrozenUntil(EMPTY_FROZEN_UNTIL);
    setPhaseEvents([]);
    resolvingRaceKeyRef.current = undefined;
    setState(createNewMatch(settings, nowMs()));
  }, [settings]);

  useEffect(() => {
    recapProgressRef.current = recapProgress;
  }, [recapProgress]);

  useEffect(() => {
    raceFinishesRef.current = raceFinishes;
  }, [raceFinishes]);

  const recapRace = useMemo(
    () => getRecapRace(state, completedRecapKeys),
    [completedRecapKeys, state]
  );
  const activeViews = useMemo(
    () => getActiveViews(state, recapRace, recapProgress, raceFinishes),
    [raceFinishes, recapProgress, recapRace, state]
  );
  const playerActiveView = activeViews.player;
  const localCanAct = canLocalPlayerAct(state, playerActiveView, frozenUntil);
  const raceKey = recapRace?.key;
  const raceDefenderId = recapRace?.defenderId;
  const raceRecapCount = recapRace?.recaps.length ?? 0;
  const playerRaceFinish =
    raceKey && raceFinishes.player?.key === raceKey
      ? raceFinishes.player
      : undefined;
  const computerRaceFinish =
    raceKey && raceFinishes.computer?.key === raceKey
      ? raceFinishes.computer
      : undefined;
  const computerRecapIndex = recapRace
    ? getRecapIndex("computer", recapRace, recapProgress, raceFinishes)
    : 0;
  const computerRaceActive = Boolean(activeViews.computer?.isRecap);
  const computerFrozen = isFrozen("computer", frozenUntil);
  const playerFrozen = isFrozen("player", frozenUntil);

  const freezeActor = useCallback((playerId: PlayerId) => {
    const until = nowMs() + RECAP_FREEZE_MS;
    setFrozenUntil((previous) => ({
      ...previous,
      [playerId]: until,
    }));

    window.setTimeout(() => {
      setFrozenUntil((previous) =>
        previous[playerId] <= until
          ? {
              ...previous,
              [playerId]: 0,
            }
          : previous
      );
    }, RECAP_FREEZE_MS);
  }, []);

  const addPhaseEvent = useCallback(
    (playerId: PlayerId, symbol: string, color: string) => {
      const id = Date.now() + Math.random();
      setPhaseEvents((previous) => [
        ...previous.filter((event) => event.playerId !== playerId),
        { id, playerId, symbol, color },
      ]);
      window.setTimeout(() => {
        setPhaseEvents((previous) =>
          previous.filter((event) => event.id !== id)
        );
      }, 2500);
    },
    []
  );

  const logActualChoice = useCallback(
    (current: GameState | null, direction: Direction) => {
      if (!current) return;

      if (current.phase === "attacker-answer" && current.attackQuestion) {
        const actorId = current.attackerId;
        addPhaseEvent(
          actorId,
          direction === current.attackQuestion.correctDirection ? "✓" : "✕",
          direction === current.attackQuestion.correctDirection ? "#16a34a" : "#dc2626"
        );
        return;
      }

      if (current.phase === "defender-live" && current.currentAttack) {
        const actorId = current.defenderId;
        addPhaseEvent(
          actorId,
          direction === current.currentAttack.defenseQuestion.correctDirection
            ? "✓"
            : "✕",
          direction === current.currentAttack.defenseQuestion.correctDirection
            ? "#16a34a"
            : "#dc2626"
        );
      }
    },
    [addPhaseEvent]
  );

  const answerRaceRecap = useCallback(
    (playerId: PlayerId, race: RecapRace, direction: Direction) => {
      setActiveDirection(undefined);

      const currentFinishes = raceFinishesRef.current;
      const currentProgress = recapProgressRef.current;

      if (currentFinishes[playerId]?.key === race.key) {
        return;
      }

      const index = getRecapIndex(
        playerId,
        race,
        currentProgress,
        currentFinishes
      );
      const recap = race.recaps[index];
      if (!recap) return;

      if (direction !== recap.correctDirection) {
        freezeActor(playerId);
        return;
      }

      const nextIndex = index + 1;
      const nextProgress = {
        ...recapProgressRef.current,
        [playerId]: {
          key: race.key,
          index: nextIndex,
        },
      };
      recapProgressRef.current = nextProgress;
      setRecapProgress(nextProgress);

      if (nextIndex >= race.recaps.length) {
        const finishedAt = nowMs();
        const latestFinishes = raceFinishesRef.current;
        if (latestFinishes[playerId]?.key !== race.key) {
          const nextFinishes = {
            ...latestFinishes,
            [playerId]: {
              key: race.key,
              atMs: finishedAt,
            },
          };
          raceFinishesRef.current = nextFinishes;
          setRaceFinishes(nextFinishes);
        }

        const completedProgress = {
          ...recapProgressRef.current,
          [playerId]: {
            key: race.key,
            index: race.recaps.length,
          },
        };
        recapProgressRef.current = completedProgress;
        setRecapProgress(completedProgress);
      }
    },
    [freezeActor]
  );

  const handleChoose = useCallback(
    (playerId: PlayerId, direction: Direction) => {
      activeDirectionRef.current = undefined;
      setActiveDirection(undefined);

      const activeView = activeViews[playerId];
      if (!activeView || activeView.actorId !== playerId) return;
      if (isFrozen(playerId, frozenUntil)) return;

      if (recapRace && activeView.isRecap) {
        answerRaceRecap(playerId, recapRace, direction);
        return;
      }

      logActualChoice(state, direction);
      setState((previous) => {
        if (!previous) return previous;

        if (previous.phase === "attacker-answer") {
          return answerAttackQuestion(previous, direction, nowMs());
        }

        if (previous.phase === "defender-live") {
          return answerDefenseQuestion(previous, direction);
        }

        if (previous.phase === "correction") {
          return completeCorrection(previous, direction, nowMs());
        }

        return previous;
      });
    },
    [
      activeViews,
      answerRaceRecap,
      frozenUntil,
      logActualChoice,
      recapRace,
      state,
    ]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (debugMode && event.code === "Space" && !event.repeat) {
        event.preventDefault();
        setPaused((current) => !current);
        return;
      }

      const direction = getArrowDirection(event.key);
      if (!direction || !localCanAct) return;
      if (!getAvailableDirections(playerActiveView).includes(direction)) return;
      event.preventDefault();
      activeDirectionRef.current = direction;
      setActiveDirection(direction);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const direction = getArrowDirection(event.key);
      if (!direction || !localCanAct) return;
      event.preventDefault();
      if (activeDirectionRef.current === direction && !paused) {
        handleChoose("player", direction);
      }
      if (activeDirectionRef.current === direction) {
        activeDirectionRef.current = undefined;
      }
      setActiveDirection((current) =>
        current === direction ? undefined : current
      );
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [debugMode, handleChoose, localCanAct, paused, playerActiveView]);

  useEffect(() => {
    activeDirectionRef.current = undefined;
    setActiveDirection(undefined);
  }, [
    state?.phase,
    state?.attackQuestion,
    state?.currentAttack,
    state?.correctionReplay,
    playerActiveView?.promptLabel,
    playerActiveView?.isRecap,
    recapRace?.key,
    recapProgress.player.index,
  ]);

  useEffect(() => {
    if (state?.comboRecaps.length === 0) {
      const emptyFinishes = emptyRaceFinishes();
      setCompletedRecapKeys([]);
      setRecapProgress(EMPTY_PROGRESS);
      recapProgressRef.current = EMPTY_PROGRESS;
      setRaceFinishes(emptyFinishes);
      raceFinishesRef.current = emptyFinishes;
      resolvingRaceKeyRef.current = undefined;
    }
  }, [state?.comboRecaps.length]);

  useEffect(() => {
    if (!raceKey || resolvingRaceKeyRef.current !== raceKey) {
      resolvingRaceKeyRef.current = undefined;
    }
  }, [raceKey]);

  useEffect(() => {
    if (
      !raceKey ||
      !raceDefenderId ||
      !playerRaceFinish ||
      !computerRaceFinish ||
      resolvingRaceKeyRef.current === raceKey
    ) {
      return undefined;
    }

    resolvingRaceKeyRef.current = raceKey;
    const winnerId: PlayerId =
      playerRaceFinish.atMs <= computerRaceFinish.atMs ? "player" : "computer";
    const loserId: PlayerId = winnerId === "player" ? "computer" : "player";

    addPhaseEvent(winnerId, "✓", "#16a34a");
    addPhaseEvent(loserId, "✕", "#dc2626");

    const id = window.setTimeout(() => {
      setCompletedRecapKeys((previous) =>
        previous.includes(raceKey) ? previous : [...previous, raceKey]
      );
      const emptyFinishes = emptyRaceFinishes();
      const completedProgress = {
        ...recapProgressRef.current,
        player: { key: raceKey, index: raceRecapCount },
        computer: { key: raceKey, index: raceRecapCount },
      };
      setRaceFinishes(emptyFinishes);
      raceFinishesRef.current = emptyFinishes;
      setRecapProgress(completedProgress);
      recapProgressRef.current = completedProgress;
      resolvingRaceKeyRef.current = undefined;

      if (winnerId === raceDefenderId) {
        setState((previous) =>
          previous ? forceAttacker(previous, raceDefenderId, nowMs()) : previous
        );
      }
    }, 2500);

    return () => window.clearTimeout(id);
  }, [
    addPhaseEvent,
    computerRaceFinish,
    playerRaceFinish,
    raceDefenderId,
    raceKey,
    raceRecapCount,
  ]);

  useEffect(() => {
    if (!state) return undefined;
    if (paused) return undefined;
    if (state.phase !== "role-switch" && state.phase !== "heart-lost") {
      return undefined;
    }

    const delayMs = skipDelays || reduceMotion ? 120 : 2000;
    const id = window.setTimeout(() => {
      setState((previous) => {
        if (!previous) return previous;
        if (previous.phase === "role-switch") {
          return continueAfterRoleSwitch(previous, nowMs());
        }
        if (previous.phase === "heart-lost") {
          return continueAfterHeartLost(previous, nowMs());
        }
        return previous;
      });
    }, delayMs);

    return () => window.clearTimeout(id);
  }, [paused, reduceMotion, skipDelays, state]);

  useEffect(() => {
    if (
      !TIMERS_ENABLED ||
      !state ||
      paused ||
      state.phase !== "defender-live" ||
      state.players[state.defenderId].controller !== "local" ||
      typeof state.defenseDeadlineMs !== "number"
    ) {
      return undefined;
    }

    const delayMs = Math.max(0, state.defenseDeadlineMs - nowMs());
    const id = window.setTimeout(() => {
      setState((previous) => (previous ? handleDefenseTimeout(previous) : previous));
    }, delayMs);

    return () => window.clearTimeout(id);
  }, [paused, state]);

  useEffect(() => {
    if (
      !state ||
      !recapRace ||
      !computerRaceActive ||
      paused ||
      state.players.computer.controller !== "ai" ||
      computerFrozen ||
      Boolean(computerRaceFinish) ||
      resolvingRaceKeyRef.current === recapRace.key
    ) {
      return undefined;
    }

    const recap = recapRace.recaps[computerRecapIndex];
    if (!recap) return undefined;

    const config = AI_DIFFICULTIES[state.settings.difficulty];
    const responseTimeMs =
      config.minResponseMs + Math.random() * (config.maxResponseMs - config.minResponseMs);
    const knowsAnswer = Math.random() < config.accuracy;
    const direction = knowsAnswer
      ? recap.correctDirection
      : pickWrongDirection(recapOptions(recap), recap.correctDirection);
    const delayMs = Math.min(responseTimeMs, 1200);

    const id = window.setTimeout(() => {
      answerRaceRecap("computer", recapRace, direction);
    }, delayMs);

    return () => window.clearTimeout(id);
  }, [
    answerRaceRecap,
    computerRaceActive,
    computerRaceFinish,
    computerRecapIndex,
    computerFrozen,
    paused,
    recapRace,
    state,
  ]);

  useEffect(() => {
    if (
      !state ||
      paused ||
      recapRace ||
      state.phase !== "attacker-answer" ||
      state.players[state.attackerId].controller !== "ai" ||
      !state.attackQuestion ||
      typeof state.attackStartTimeMs !== "number"
    ) {
      return undefined;
    }

    const storedPlan = aiAttackPlanRef.current;
    const plan =
      storedPlan && storedPlan.startTimeMs === state.attackStartTimeMs
        ? storedPlan.plan
        : planAiAttack(state.currentTargets, state.settings.difficulty);
    aiAttackPlanRef.current = {
      startTimeMs: state.attackStartTimeMs,
      plan,
    };
    const answerDirection = pickQuestionAnswerDirection(
      state.attackQuestion,
      plan.knowsAnswer
    );
    const plannedAnswerAt = state.attackStartTimeMs + plan.totalAttackTimeMs;
    const delayMs = Math.max(120, plannedAnswerAt - nowMs());

    const id = window.setTimeout(() => {
      logActualChoice(state, answerDirection);
      setState((previous) =>
        previous ? answerAttackQuestion(previous, answerDirection, nowMs()) : previous
      );
    }, delayMs);

    return () => window.clearTimeout(id);
  }, [logActualChoice, paused, recapRace, state]);

  useEffect(() => {
    if (
      !state ||
      paused ||
      recapRace ||
      state.phase !== "defender-live" ||
      state.players[state.defenderId].controller !== "ai" ||
      !state.currentAttack
    ) {
      return undefined;
    }

    const plan = planAiDefense(
      state.currentAttack.defenseQuestion,
      state.settings.difficulty,
      state.currentAttack.defenderTimeLimitMs
    );
    const delayMs = Math.min(
      plan.responseTimeMs,
      TIMERS_ENABLED ? state.currentAttack.defenderTimeLimitMs : 1400
    );

    const id = window.setTimeout(() => {
      logActualChoice(state, plan.answerDirection);
      setState((previous) => {
        if (!previous || previous.phase !== "defender-live") return previous;
        return TIMERS_ENABLED && plan.timedOut
          ? handleDefenseTimeout(previous)
          : answerDefenseQuestion(previous, plan.answerDirection);
      });
    }, delayMs);

    return () => window.clearTimeout(id);
  }, [logActualChoice, paused, recapRace, state]);

  useEffect(() => {
    if (
      !state ||
      paused ||
      state.phase !== "correction" ||
      state.players[state.defenderId].controller !== "ai" ||
      !state.correctionReplay
    ) {
      return undefined;
    }

    const delayMs = skipDelays || reduceMotion ? 120 : 850;
    const direction = state.correctionReplay.question.correctDirection;
    const id = window.setTimeout(() => {
      setState((previous) =>
        previous ? completeCorrection(previous, direction, nowMs()) : previous
      );
    }, delayMs);

    return () => window.clearTimeout(id);
  }, [paused, reduceMotion, skipDelays, state]);

  if (!state) {
    return (
      <ShadowBoxingSetup
        settings={settings}
        onChange={setSettings}
        onStart={startMatch}
      />
    );
  }

  if (state.phase === "game-over") {
    return (
      <ShadowBoxingResults
        state={state}
        onPlayAgain={() => {
          const emptyFinishes = emptyRaceFinishes();
          setCompletedRecapKeys([]);
          setRecapProgress(EMPTY_PROGRESS);
          recapProgressRef.current = EMPTY_PROGRESS;
          setRaceFinishes(emptyFinishes);
          raceFinishesRef.current = emptyFinishes;
          setFrozenUntil(EMPTY_FROZEN_UNTIL);
          setPhaseEvents([]);
          resolvingRaceKeyRef.current = undefined;
          setState(createNewMatch(settings, nowMs()));
        }}
        onChangeSettings={() => setState(null)}
      />
    );
  }

  const recapStatus: Record<PlayerId, PlayerRecapStatus> = {
    computer: {
      index: recapRace
        ? getRecapIndex("computer", recapRace, recapProgress, raceFinishes)
        : Math.min(recapProgress.computer.index, state.comboRecaps.length),
      total: state.comboRecaps.length,
      frozen: computerFrozen,
    },
    player: {
      index: recapRace
        ? getRecapIndex("player", recapRace, recapProgress, raceFinishes)
        : Math.min(recapProgress.player.index, state.comboRecaps.length),
      total: state.comboRecaps.length,
      frozen: playerFrozen,
    },
  };

  return (
    <Box>
      <ShadowBoxingArena
        state={state}
        activeViews={activeViews}
        activeDirection={activeDirection}
        phaseEvents={phaseEvents}
        darkMode={darkMode}
        debugMode={debugMode}
        paused={paused}
        recapStatus={recapStatus}
        onChoose={handleChoose}
        onChangeSettings={() => setState(null)}
        onDarkModeChange={setDarkMode}
        onDebugModeChange={setDebugMode}
      />
      {debugMode && (
        <DebugPanel
          state={state}
          skipDelays={skipDelays}
          onSkipDelaysChange={setSkipDelays}
          paused={paused}
          onPausedChange={setPaused}
          onForceRole={(attackerId) =>
            setState((previous) =>
              previous ? forceAttacker(previous, attackerId, nowMs()) : previous
            )
          }
        />
      )}
    </Box>
  );
}

