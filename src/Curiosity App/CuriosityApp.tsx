import React, { useEffect, useMemo, useRef, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import FilterListIcon from "@mui/icons-material/FilterList";
import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import MenuIcon from "@mui/icons-material/Menu";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Menu,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";

type CuriosityNode = {
  id: string;
  prompt: string;
  answer: string;
  childIds: string[];
  createdAt: number;
  updatedAt: number;
};

type CuriosityTree = {
  version: 1;
  rootId: string;
  nodes: Record<string, CuriosityNode>;
};

type ViewMode = "horizontal" | "vertical";
type NewQuestionMode = "next" | "answer" | "child";
type MoveDirection = "up" | "down";
type ColumnDirection = "left" | "right";
type HighlightTarget = {
  level: number;
  questionId: string;
};

type ThemePalette = {
  pageBg: string;
  boardBg: string;
  columnBg: string;
  questionBg: string;
  questionHover: string;
  questionText: string;
  answerBg: string;
  answerText: string;
  composerBg: string;
  accent: string;
};

type ConnectorLine = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type ConnectorCanvas = {
  width: number;
  height: number;
};

const STORAGE_KEY = "curiosity-app-tree-v1";
const ROOT_ID = "root";
const GREEN_THEME: { light: ThemePalette; dark: ThemePalette } = {
  light: {
    pageBg: "#eef5ec",
    boardBg: "#d8e5cf",
    columnBg: "#fbfdf8",
    questionBg: "#e3efdc",
    questionHover: "#d3e4ca",
    questionText: "#1f392a",
    answerBg: "#e6f2ed",
    answerText: "#1b3a31",
    composerBg: "#f4f8ee",
    accent: "#4d7e5d",
  },
  dark: {
    pageBg: "#101812",
    boardBg: "#18251b",
    columnBg: "#203226",
    questionBg: "#294432",
    questionHover: "#34553f",
    questionText: "#edf7ed",
    answerBg: "#1d3a31",
    answerText: "#eefaf3",
    composerBg: "#243a2b",
    accent: "#99cd96",
  },
};

function now() {
  return Date.now();
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `curiosity-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createInitialTree(): CuriosityTree {
  const createdAt = now();

  return {
    version: 1,
    rootId: ROOT_ID,
    nodes: {
      [ROOT_ID]: {
        id: ROOT_ID,
        prompt: "Root",
        answer: "",
        childIds: [],
        createdAt,
        updatedAt: createdAt,
      },
    },
  };
}

function isCuriosityTree(value: unknown): value is CuriosityTree {
  if (!value || typeof value !== "object") return false;

  const tree = value as CuriosityTree;
  return (
    tree.version === 1 &&
    typeof tree.rootId === "string" &&
    Boolean(tree.nodes) &&
    typeof tree.nodes === "object" &&
    Boolean(tree.nodes[tree.rootId])
  );
}

function loadStoredTree(): CuriosityTree {
  if (typeof window === "undefined") {
    return createInitialTree();
  }

  try {
    const rawTree = window.localStorage.getItem(STORAGE_KEY);
    if (!rawTree) return createInitialTree();

    const parsedTree = JSON.parse(rawTree);
    return isCuriosityTree(parsedTree) ? parsedTree : createInitialTree();
  } catch {
    return createInitialTree();
  }
}

function usePersistedTree() {
  const [tree, setTree] = useState<CuriosityTree>(loadStoredTree);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
  }, [tree]);

  return [tree, setTree] as const;
}

function getChildNodes(tree: CuriosityTree, node: CuriosityNode) {
  return node.childIds
    .map((childId) => tree.nodes[childId])
    .filter((child): child is CuriosityNode => Boolean(child));
}

function collectQuestionIds(tree: CuriosityTree, nodeId: string) {
  const ids: string[] = [];

  function visit(id: string) {
    const node = tree.nodes[id];
    if (!node || id === tree.rootId) return;

    ids.push(id);
    node.childIds.forEach(visit);
  }

  visit(nodeId);
  return ids;
}

function wordsFromFilterText(text: string) {
  return Array.from(
    new Set(
      text
        .split(/\s+/)
        .map((word) => word.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function questionMatchesFilters(question: CuriosityNode, filterWords: string[]) {
  if (filterWords.length === 0) return true;

  const searchable = `${question.prompt} ${question.answer}`.toLowerCase();
  return filterWords.some((word) => searchable.includes(word));
}

function updateNode(
  tree: CuriosityTree,
  nodeId: string,
  updater: (node: CuriosityNode) => CuriosityNode
): CuriosityTree {
  const existingNode = tree.nodes[nodeId];
  if (!existingNode) return tree;

  return {
    ...tree,
    nodes: {
      ...tree.nodes,
      [nodeId]: {
        ...updater(existingNode),
        updatedAt: now(),
      },
    },
  };
}

function clampIndex(index: number, length: number) {
  if (length <= 0) return -1;
  return Math.min(Math.max(index, 0), length - 1);
}

function QuestionComposer({
  value,
  shouldFocus,
  onChange,
  onSubmit,
  onHighlightNavigate,
  onFocused,
}: {
  value: string;
  shouldFocus?: boolean;
  onChange: (value: string) => void;
  onSubmit: (mode: NewQuestionMode) => void;
  onHighlightNavigate: (direction: MoveDirection | ColumnDirection) => void;
  onFocused?: () => void;
}) {
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  useEffect(() => {
    if (!shouldFocus) return;

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      onFocused?.();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [onFocused, shouldFocus]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.ctrlKey) {
      if (
        event.key === "ArrowUp" ||
        event.key === "ArrowDown" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight"
      ) {
        event.preventDefault();
        event.stopPropagation();
        const direction =
          event.key === "ArrowUp"
            ? "up"
            : event.key === "ArrowDown"
              ? "down"
              : event.key === "ArrowLeft"
                ? "left"
                : "right";
        onHighlightNavigate(direction);
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "r") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (key === "q") {
        event.preventDefault();
        event.stopPropagation();
        inputRef.current?.focus();
        return;
      }

      if (key === "n") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }

    if (event.key === "Tab" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      onSubmit("child");
      return;
    }

    if (event.key !== "Enter" || event.ctrlKey) return;

    event.preventDefault();
    onSubmit(event.shiftKey ? "answer" : "next");
  }

  return (
    <TextField
      inputRef={inputRef}
      multiline
      minRows={3}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="Write a question..."
      fullWidth
      sx={{
        bgcolor: "var(--curiosity-composer-bg)",
        border: "1px solid rgba(55, 93, 64, 0.18)",
        borderRadius: 1,
        "& .MuiOutlinedInput-root": {
          alignItems: "flex-start",
          borderRadius: 1,
          color: "var(--curiosity-question-text)",
          fontWeight: 700,
        },
        "& fieldset": {
          borderColor: "transparent",
        },
      }}
    />
  );
}

function QuestionCard({
  question,
  isSelected,
  isHighlighted,
  isVertical,
  shouldFocusCard,
  shouldFocusAnswer,
  onSelect,
  onPromptChange,
  onAnswerChange,
  onAddChildQuestion,
  onFocusNewSibling,
  onMoveQuestion,
  onHighlightNavigate,
  onRequestDelete,
  onCardFocused,
  onAnswerFocused,
}: {
  question: CuriosityNode;
  isSelected: boolean;
  isHighlighted: boolean;
  isVertical: boolean;
  shouldFocusCard: boolean;
  shouldFocusAnswer: boolean;
  onSelect: () => void;
  onPromptChange: (value: string) => void;
  onAnswerChange: (value: string) => void;
  onAddChildQuestion: () => void;
  onFocusNewSibling: () => void;
  onMoveQuestion: (direction: MoveDirection) => void;
  onHighlightNavigate: (direction: MoveDirection | ColumnDirection) => void;
  onRequestDelete: () => void;
  onCardFocused: () => void;
  onAnswerFocused: () => void;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const answerRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const promptRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [promptDraft, setPromptDraft] = useState(question.prompt);
  const [confirmPromptOpen, setConfirmPromptOpen] = useState(false);

  useEffect(() => {
    if (isEditingPrompt) return;

    setPromptDraft(question.prompt);
  }, [isEditingPrompt, question.prompt]);

  useEffect(() => {
    if (!isEditingPrompt) return;

    const frame = window.requestAnimationFrame(() => {
      promptRef.current?.focus();
      promptRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isEditingPrompt]);

  useEffect(() => {
    if (!isSelected || !shouldFocusCard || shouldFocusAnswer) return;

    const frame = window.requestAnimationFrame(() => {
      cardRef.current?.focus();
      onCardFocused();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isSelected, onCardFocused, shouldFocusAnswer, shouldFocusCard]);

  useEffect(() => {
    if (!isSelected || !shouldFocusAnswer) return;

    const frame = window.requestAnimationFrame(() => {
      answerRef.current?.focus();
      onAnswerFocused();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isSelected, onAnswerFocused, shouldFocusAnswer]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      event.stopPropagation();
      onMoveQuestion(event.key === "ArrowUp" ? "up" : "down");
      return;
    }

    if (event.ctrlKey) {
      const key = event.key.toLowerCase();

      if (key === "r") {
        event.preventDefault();
        event.stopPropagation();
        setIsEditingPrompt(true);
        setPromptDraft(question.prompt);
        return;
      }

      if (key === "q") {
        event.preventDefault();
        event.stopPropagation();
        onFocusNewSibling();
        return;
      }

      if (key === "n") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        onHighlightNavigate(event.key === "ArrowUp" ? "up" : "down");
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        event.stopPropagation();
        onHighlightNavigate(event.key === "ArrowLeft" ? "left" : "right");
        return;
      }
    }

    if (event.key === "Tab" && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      onAddChildQuestion();
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    onSelect();
  }

  function handleTabToChild(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab" || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onAddChildQuestion();
  }

  function handlePromptKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (
      (event.ctrlKey || event.altKey) &&
      (event.key === "ArrowUp" ||
        event.key === "ArrowDown" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight")
    ) {
      return;
    }

    const key = event.key.toLowerCase();

    if (event.ctrlKey && key === "r") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (event.ctrlKey && key === "q") {
      event.preventDefault();
      event.stopPropagation();
      onFocusNewSibling();
      return;
    }

    if (event.ctrlKey && key === "n") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    handleTabToChild(event);
    if (event.defaultPrevented) return;

    if (event.key === "Enter" && !event.ctrlKey) {
      event.preventDefault();
      event.stopPropagation();
      if (promptDraft.trim() && promptDraft.trim() !== question.prompt.trim()) {
        setConfirmPromptOpen(true);
      } else {
        setIsEditingPrompt(false);
        setPromptDraft(question.prompt);
      }
      return;
    }

    event.stopPropagation();
  }

  function confirmPromptChange() {
    const nextPrompt = promptDraft.trim();
    if (nextPrompt) {
      onPromptChange(nextPrompt);
    }
    setConfirmPromptOpen(false);
    setIsEditingPrompt(false);
    window.requestAnimationFrame(() => {
      answerRef.current?.focus();
    });
  }

  return (
    <>
    <Box
      ref={cardRef}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      sx={{
        bgcolor: "var(--curiosity-question-bg)",
        border: isSelected
          ? "2px solid var(--curiosity-accent)"
          : isHighlighted
            ? "2px solid rgba(197, 143, 54, 0.72)"
            : "1px solid rgba(55, 93, 64, 0.16)",
        borderRadius: 1,
        boxShadow: isHighlighted ? "0 0 0 4px rgba(197, 143, 54, 0.2)" : "none",
        color: "var(--curiosity-question-text)",
        cursor: "pointer",
        height: "100%",
        outline: "none",
        overflow: "hidden",
        p: isSelected ? 1.25 : 1,
        pb: isSelected && isVertical ? 7 : isSelected ? 1.25 : 1,
        pr: isSelected && !isVertical ? 7 : isSelected ? 5 : 1,
        position: "relative",
        transition:
          "flex-basis 220ms ease, min-height 220ms ease, border-color 160ms ease, background-color 160ms ease",
        "&:hover": {
          bgcolor: "var(--curiosity-question-hover)",
        },
        "&:focus-visible": {
          boxShadow: "0 0 0 3px rgba(77, 126, 93, 0.24)",
        },
      }}
    >
      <Stack gap={1} sx={{ height: "100%" }}>
        <Stack direction="row" alignItems="flex-start" gap={1}>
          {isEditingPrompt ? (
            <TextField
              inputRef={promptRef}
              value={promptDraft}
              onChange={(event) => setPromptDraft(event.target.value)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={handlePromptKeyDown}
              multiline
              fullWidth
              variant="standard"
              InputProps={{
                disableUnderline: true,
              }}
              sx={{
                flex: 1,
                minWidth: 0,
                "& .MuiInputBase-root": {
                  alignItems: "flex-start",
                  color: "var(--curiosity-question-text)",
                  fontSize: "1rem",
                  fontWeight: 850,
                  lineHeight: 1.35,
                  p: 0,
                },
                "& textarea": {
                  overflow: "hidden !important",
                },
              }}
            />
          ) : (
            <Typography
              sx={{
                display: isSelected ? "block" : "inline-block",
                flex: 1,
                fontWeight: 850,
                lineHeight: 1.35,
                maxWidth: "100%",
                minWidth: 0,
                overflow: "hidden",
                textOverflow: isSelected ? "clip" : "ellipsis",
                whiteSpace: isSelected ? "pre-wrap" : "nowrap",
              }}
            >
              {question.prompt}
            </Typography>
          )}

        </Stack>

        {isSelected && (
          <>
            <Tooltip title="Delete question">
              <IconButton
                aria-label="Delete question"
                onClick={(event) => {
                  event.stopPropagation();
                  onRequestDelete();
                }}
                onKeyDown={handleTabToChild}
                size="small"
                sx={{
                  bgcolor: "#ffe9ee",
                  border: "1px solid rgba(175, 73, 92, 0.16)",
                  color: "#b24b5d",
                  height: 24,
                  minHeight: 24,
                  minWidth: 24,
                  position: "absolute",
                  right: 8,
                  top: 8,
                  width: 24,
                  zIndex: 5,
                  "&:hover": {
                    bgcolor: "#ffdbe4",
                  },
                  "& .MuiSvgIcon-root": {
                    fontSize: 16,
                  },
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <TextField
              inputRef={answerRef}
              value={question.answer}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                handleTabToChild(event);
                if (event.defaultPrevented) return;
                if (event.ctrlKey || event.altKey) return;
                event.stopPropagation();
              }}
              onChange={(event) => onAnswerChange(event.target.value)}
              placeholder="Write the answer..."
              multiline
              fullWidth
              variant="standard"
              InputProps={{
                disableUnderline: true,
              }}
              sx={{
                bgcolor: "var(--curiosity-answer-bg)",
                border: "1px solid rgba(45, 95, 76, 0.16)",
                borderRadius: 1,
                flex: 1,
                minHeight: 0,
                "& .MuiInputBase-root": {
                  alignItems: "flex-start",
                  color: "var(--curiosity-answer-text)",
                  fontSize: "0.98rem",
                  height: "100%",
                  lineHeight: 1.5,
                  overflow: "auto",
                  p: 1,
                },
                "& textarea": {
                  height: "100% !important",
                  overflow: "auto !important",
                },
              }}
            />

            <Stack
              direction="column"
              gap={0.5}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={handleTabToChild}
              sx={{
                bottom: isVertical ? 10 : "auto",
                left: isVertical ? "50%" : "auto",
                position: "absolute",
                right: isVertical ? "auto" : 10,
                top: isVertical ? "auto" : "50%",
                transform: isVertical ? "translateX(-50%)" : "translateY(-50%)",
                zIndex: 4,
              }}
            >
              <Tooltip title="Add child question">
                <IconButton
                  aria-label="Add child question"
                  onClick={onAddChildQuestion}
                  size="small"
                  sx={{
                    bgcolor: "var(--curiosity-composer-bg)",
                    border: "1px solid rgba(55, 93, 64, 0.2)",
                    color: "var(--curiosity-accent)",
                    "&:hover": {
                      bgcolor: "var(--curiosity-question-hover)",
                    },
                  }}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </>
        )}
      </Stack>
    </Box>
    <Dialog open={confirmPromptOpen} onClose={() => setConfirmPromptOpen(false)}>
      <DialogTitle>Change this question?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Changing this question might change the logic of the chain beneath it.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setConfirmPromptOpen(false)}>Cancel</Button>
        <Button autoFocus color="error" variant="contained" onClick={confirmPromptChange}>
          Confirm Change
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}

function QuestionColumn({
  columnIndex,
  questions,
  selectedQuestionId,
  isVertical,
  shouldFocusComposer,
  highlightQuestionId,
  focusCardQuestionId,
  focusAnswerQuestionId,
  onSubmitQuestion,
  onSelectQuestion,
  onPromptChange,
  onAnswerChange,
  onAddChildQuestion,
  onFocusNewSibling,
  onMoveQuestion,
  onHighlightNavigate,
  onHighlightFromComposer,
  onRequestDelete,
  onComposerFocused,
  onCardFocused,
  onAnswerFocused,
}: {
  columnIndex: number;
  questions: CuriosityNode[];
  selectedQuestionId?: string;
  isVertical: boolean;
  shouldFocusComposer: boolean;
  highlightQuestionId?: string;
  focusCardQuestionId?: string;
  focusAnswerQuestionId?: string;
  onSubmitQuestion: (prompt: string, mode: NewQuestionMode) => void;
  onSelectQuestion: (questionId: string) => void;
  onPromptChange: (questionId: string, value: string) => void;
  onAnswerChange: (questionId: string, value: string) => void;
  onAddChildQuestion: (questionId: string) => void;
  onFocusNewSibling: () => void;
  onMoveQuestion: (questionId: string, direction: MoveDirection) => void;
  onHighlightNavigate: (
    questionId: string,
    direction: MoveDirection | ColumnDirection
  ) => void;
  onHighlightFromComposer: (
    visibleQuestionIds: string[],
    direction: MoveDirection | ColumnDirection
  ) => void;
  onRequestDelete: (questionId: string) => void;
  onComposerFocused: () => void;
  onCardFocused: () => void;
  onAnswerFocused: () => void;
}) {
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const chipRailRef = useRef<HTMLDivElement | null>(null);
  const filterInputRef = useRef<HTMLInputElement | null>(null);
  const [draftQuestion, setDraftQuestion] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState("");
  const [filterWords, setFilterWords] = useState<string[]>([]);
  const [canScrollChipsLeft, setCanScrollChipsLeft] = useState(false);
  const [canScrollChipsRight, setCanScrollChipsRight] = useState(false);
  const visibleQuestions = useMemo(
    () => questions.filter((question) => questionMatchesFilters(question, filterWords)),
    [filterWords, questions]
  );

  const updateChipScrollButtons = React.useCallback(() => {
    const rail = chipRailRef.current;
    if (!rail) {
      setCanScrollChipsLeft(false);
      setCanScrollChipsRight(false);
      return;
    }

    const maxScroll = rail.scrollWidth - rail.clientWidth;
    setCanScrollChipsLeft(rail.scrollLeft > 1);
    setCanScrollChipsRight(rail.scrollLeft < maxScroll - 1);
  }, []);

  useEffect(() => {
    if (!selectedQuestionId) return;

    questionRefs.current[selectedQuestionId]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [selectedQuestionId]);

  useEffect(() => {
    updateChipScrollButtons();

    const rail = chipRailRef.current;
    if (!rail) return undefined;

    rail.addEventListener("scroll", updateChipScrollButtons, { passive: true });
    window.addEventListener("resize", updateChipScrollButtons);

    return () => {
      rail.removeEventListener("scroll", updateChipScrollButtons);
      window.removeEventListener("resize", updateChipScrollButtons);
    };
  }, [filterOpen, filterWords, updateChipScrollButtons]);

  function applyFilterDraft() {
    const words = wordsFromFilterText(filterDraft);
    if (words.length === 0) return;

    setFilterWords((existingWords) => Array.from(new Set([...existingWords, ...words])));
    setFilterDraft("");
    setFilterOpen(true);
    window.requestAnimationFrame(updateChipScrollButtons);
  }

  function removeFilterWord(wordToRemove: string) {
    setFilterWords((existingWords) => existingWords.filter((word) => word !== wordToRemove));
    window.requestAnimationFrame(updateChipScrollButtons);
  }

  function scrollChips(direction: "left" | "right") {
    chipRailRef.current?.scrollBy({
      behavior: "smooth",
      left: direction === "left" ? -140 : 140,
    });
  }

  function handleFilterKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter") return;

    event.preventDefault();
    applyFilterDraft();
  }

  function submitDraftQuestion(mode: NewQuestionMode) {
    const prompt = draftQuestion.trim();
    if (!prompt) return;

    onSubmitQuestion(prompt, mode);
    setDraftQuestion("");
  }

  function focusFilterInput() {
    setFilterOpen(true);
    window.requestAnimationFrame(() => {
      filterInputRef.current?.focus();
    });
  }

  function handleColumnKeyDownCapture(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!event.ctrlKey) return;

    const key = event.key.toLowerCase();
    if (key !== "f" && key !== "i") return;

    event.preventDefault();
    event.stopPropagation();
    focusFilterInput();
  }

  return (
    <Stack
      onKeyDownCapture={handleColumnKeyDownCapture}
      gap={1}
          sx={{
            bgcolor: "var(--curiosity-column-bg)",
            border: "1px solid rgba(55, 93, 64, 0.12)",
            borderRadius: 1,
            boxShadow: "0 10px 30px rgba(23, 43, 28, 0.06)",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
        p: 1.25,
        position: "relative",
      }}
    >
      <Stack gap={0.75}>
        <Stack direction="row" alignItems="center" gap={0.75}>
          {filterOpen && (
            <TextField
              inputRef={filterInputRef}
              value={filterDraft}
              onChange={(event) => setFilterDraft(event.target.value)}
              onKeyDown={handleFilterKeyDown}
              onBlur={() => setFilterOpen(false)}
              placeholder="Filter words"
              size="small"
              fullWidth
              sx={{
                "& .MuiOutlinedInput-root": {
                  bgcolor: "var(--curiosity-composer-bg)",
                  borderRadius: 1,
                  color: "var(--curiosity-question-text)",
                  height: 36,
                },
              }}
            />
          )}

          <Tooltip title={filterOpen ? "Apply filter words" : "Filter questions"}>
            <IconButton
              aria-label={filterOpen ? "Apply filter words" : "Filter questions"}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                if (!filterOpen) {
                  focusFilterInput();
                  return;
                }

                applyFilterDraft();
              }}
              size="small"
              sx={{
                bgcolor:
                  filterWords.length > 0
                    ? "var(--curiosity-question-hover)"
                    : "var(--curiosity-question-bg)",
                border: "1px solid rgba(55, 93, 64, 0.18)",
                color: "var(--curiosity-accent)",
                flexShrink: 0,
                "&:hover": {
                  bgcolor: "var(--curiosity-question-hover)",
                },
              }}
            >
              <FilterListIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        {filterWords.length > 0 && (
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ minWidth: 0 }}>
            {canScrollChipsLeft && (
              <IconButton
                aria-label="Previous filter words"
                onClick={() => scrollChips("left")}
                size="small"
                sx={{
                  bgcolor: "var(--curiosity-composer-bg)",
                  color: "var(--curiosity-accent)",
                  flexShrink: 0,
                  height: 28,
                  width: 28,
                }}
              >
                <KeyboardArrowLeftIcon fontSize="small" />
              </IconButton>
            )}

            <Box
              ref={chipRailRef}
              sx={{
                display: "flex",
                flex: 1,
                gap: 0.5,
                minWidth: 0,
                overflowX: "auto",
                overflowY: "hidden",
                scrollbarWidth: "none",
                whiteSpace: "nowrap",
                "&::-webkit-scrollbar": {
                  display: "none",
                },
              }}
            >
              {filterWords.map((word) => (
                <Chip
                  key={word}
                  label={word}
                  onDelete={() => removeFilterWord(word)}
                  size="small"
                  sx={{
                    bgcolor: "var(--curiosity-question-bg)",
                    color: "var(--curiosity-question-text)",
                    flexShrink: 0,
                    fontWeight: 700,
                  }}
                />
              ))}
            </Box>

            {canScrollChipsRight && (
              <IconButton
                aria-label="Next filter words"
                onClick={() => scrollChips("right")}
                size="small"
                sx={{
                  bgcolor: "var(--curiosity-composer-bg)",
                  color: "var(--curiosity-accent)",
                  flexShrink: 0,
                  height: 28,
                  width: 28,
                }}
              >
                <KeyboardArrowRightIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
        )}
      </Stack>

      <Stack
        gap={1}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          pb: 0.25,
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": {
            display: "none",
          },
        }}
      >
        {visibleQuestions.length === 0 && filterWords.length > 0 && (
          <Stack
            alignItems="center"
            justifyContent="center"
            sx={{
              color: "var(--curiosity-question-text)",
              minHeight: 90,
              px: 3,
              textAlign: "center",
            }}
          >
            <Typography fontWeight={750}>No questions match these filters.</Typography>
          </Stack>
        )}

        {visibleQuestions.map((question) => {
          const isSelected = selectedQuestionId === question.id;

          return (
            <Box
              key={question.id}
              ref={(element: HTMLDivElement | null) => {
                questionRefs.current[question.id] = element;
              }}
              data-active-card-level={isSelected ? columnIndex : undefined}
              sx={{
                flex: isSelected ? "0 0 50%" : "0 0 44px",
                minHeight: isSelected ? 230 : 44,
                transition: "flex-basis 220ms ease, min-height 220ms ease",
                width: "100%",
              }}
            >
              <QuestionCard
                question={question}
                isSelected={isSelected}
                isHighlighted={highlightQuestionId === question.id}
                isVertical={isVertical}
                shouldFocusCard={focusCardQuestionId === question.id}
                shouldFocusAnswer={focusAnswerQuestionId === question.id}
                onSelect={() => onSelectQuestion(question.id)}
                onPromptChange={(value) => onPromptChange(question.id, value)}
                onAnswerChange={(value) => onAnswerChange(question.id, value)}
                onAddChildQuestion={() => onAddChildQuestion(question.id)}
                onFocusNewSibling={onFocusNewSibling}
                onMoveQuestion={(direction) => onMoveQuestion(question.id, direction)}
                onHighlightNavigate={(direction) => onHighlightNavigate(question.id, direction)}
                onRequestDelete={() => onRequestDelete(question.id)}
                onCardFocused={onCardFocused}
                onAnswerFocused={onAnswerFocused}
              />
            </Box>
          );
        })}

        <QuestionComposer
          value={draftQuestion}
          shouldFocus={shouldFocusComposer}
          onChange={setDraftQuestion}
          onSubmit={submitDraftQuestion}
          onHighlightNavigate={(direction) =>
            onHighlightFromComposer(
              visibleQuestions.map((question) => question.id),
              direction
            )
          }
          onFocused={onComposerFocused}
        />
      </Stack>
    </Stack>
  );
}

export default function CuriosityApp() {
  const [tree, setTree] = usePersistedTree();
  const [activePath, setActivePath] = useState<string[]>([]);
  const [highlightTarget, setHighlightTarget] = useState<HighlightTarget | undefined>();
  const [scrollColumnIndex, setScrollColumnIndex] = useState<number | undefined>();
  const [focusCardQuestionId, setFocusCardQuestionId] = useState<string | undefined>();
  const [focusAnswerQuestionId, setFocusAnswerQuestionId] = useState<string | undefined>();
  const [focusComposerParentId, setFocusComposerParentId] = useState<string | undefined>();
  const [viewMode, setViewMode] = useState<ViewMode>("horizontal");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [themeMenuAnchor, setThemeMenuAnchor] = useState<HTMLElement | null>(null);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | undefined>();
  const [connectorLines, setConnectorLines] = useState<ConnectorLine[]>([]);
  const [connectorCanvas, setConnectorCanvas] = useState<ConnectorCanvas>({
    width: 0,
    height: 0,
  });
  const boardRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const columnRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const isVertical = !isDesktop || viewMode === "vertical";
  const themePalette = GREEN_THEME[isDarkMode ? "dark" : "light"];
  const themeMenuOpen = Boolean(themeMenuAnchor);
  const deleteCandidate = deleteCandidateId ? tree.nodes[deleteCandidateId] : undefined;
  const deleteCount = deleteCandidateId ? collectQuestionIds(tree, deleteCandidateId).length : 0;

  useEffect(() => {
    setActivePath((existingPath) => {
      const nextPath: string[] = [];
      let parentId = tree.rootId;

      for (const questionId of existingPath) {
        const parentNode = tree.nodes[parentId];
        if (!parentNode?.childIds.includes(questionId) || !tree.nodes[questionId]) break;

        nextPath.push(questionId);
        parentId = questionId;
      }

      return nextPath.length === existingPath.length ? existingPath : nextPath;
    });
  }, [tree]);

  const parentIds = useMemo(() => [tree.rootId, ...activePath], [activePath, tree.rootId]);

  useEffect(() => {
    if (!highlightTarget) return undefined;

    function handleControlRelease(event: KeyboardEvent) {
      if (event.key !== "Control") return;

      setActivePath((existingPath) => [
        ...existingPath.slice(0, highlightTarget.level),
        highlightTarget.questionId,
      ]);
      setFocusCardQuestionId(undefined);
      setFocusAnswerQuestionId(highlightTarget.questionId);
      setFocusComposerParentId(undefined);
      setScrollColumnIndex(highlightTarget.level);
      setHighlightTarget(undefined);
    }

    window.addEventListener("keyup", handleControlRelease);

    return () => window.removeEventListener("keyup", handleControlRelease);
  }, [highlightTarget]);

  useEffect(() => {
    if (scrollColumnIndex === undefined) return;

    const frame = window.requestAnimationFrame(() => {
      columnRefs.current[scrollColumnIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: isVertical ? "nearest" : "end",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isVertical, parentIds.length, scrollColumnIndex]);

  useEffect(() => {
    const board = boardRef.current;
    const rail = railRef.current;
    if (!board || !rail) return undefined;

    let frame = 0;
    let timeout = 0;

    const updateConnectors = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const boardRect = board.getBoundingClientRect();
        const railRect = rail.getBoundingClientRect();
        const railOffsetX = railRect.left - boardRect.left + board.scrollLeft;
        const railOffsetY = railRect.top - boardRect.top + board.scrollTop;
        const canvasWidth = Math.ceil(
          Math.max(board.clientWidth, railOffsetX + rail.scrollWidth)
        );
        const canvasHeight = Math.ceil(
          Math.max(board.clientHeight, railOffsetY + rail.scrollHeight)
        );
        const nextLines: ConnectorLine[] = [];

        for (let level = 0; level < activePath.length - 1; level += 1) {
          const from = board.querySelector(
            `[data-active-card-level="${level}"]`
          ) as HTMLElement | null;
          const to = board.querySelector(
            `[data-active-card-level="${level + 1}"]`
          ) as HTMLElement | null;

          if (!from || !to) continue;

          const fromRect = from.getBoundingClientRect();
          const toRect = to.getBoundingClientRect();

          nextLines.push({
            id: `${activePath[level]}-${activePath[level + 1]}`,
            x1: isVertical
              ? fromRect.left + fromRect.width / 2 - boardRect.left + board.scrollLeft
              : fromRect.right - boardRect.left + board.scrollLeft,
            y1: isVertical
              ? fromRect.bottom - boardRect.top + board.scrollTop
              : fromRect.top + fromRect.height / 2 - boardRect.top + board.scrollTop,
            x2: isVertical
              ? toRect.left + toRect.width / 2 - boardRect.left + board.scrollLeft
              : toRect.left - boardRect.left + board.scrollLeft,
            y2: isVertical
              ? toRect.top - boardRect.top + board.scrollTop
              : toRect.top + toRect.height / 2 - boardRect.top + board.scrollTop,
          });
        }

        setConnectorCanvas((currentCanvas) =>
          currentCanvas.width === canvasWidth && currentCanvas.height === canvasHeight
            ? currentCanvas
            : {
                width: canvasWidth,
                height: canvasHeight,
              }
        );
        setConnectorLines(nextLines);
      });
    };

    updateConnectors();
    timeout = window.setTimeout(updateConnectors, 260);
    board.addEventListener("scroll", updateConnectors, { passive: true });
    window.addEventListener("resize", updateConnectors);
    const mutationObserver = new MutationObserver(updateConnectors);
    mutationObserver.observe(rail, {
      attributes: true,
      childList: true,
      subtree: true,
    });
    const resizeObserver = new ResizeObserver(updateConnectors);
    resizeObserver.observe(board);
    resizeObserver.observe(rail);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      board.removeEventListener("scroll", updateConnectors);
      window.removeEventListener("resize", updateConnectors);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
    };
  }, [activePath, isVertical, parentIds.length, tree]);

  function getColumnLevel(parentId: string) {
    return parentIds.indexOf(parentId);
  }

  function updateAnswer(questionId: string, value: string) {
    setTree((existingTree) =>
      updateNode(existingTree, questionId, (node) => ({
        ...node,
        answer: value,
      }))
    );
  }

  function updatePrompt(questionId: string, value: string) {
    setTree((existingTree) =>
      updateNode(existingTree, questionId, (node) => ({
        ...node,
        prompt: value,
      }))
    );
  }

  function selectQuestion(level: number, questionId: string) {
    setActivePath((existingPath) => [...existingPath.slice(0, level), questionId]);
    setHighlightTarget(undefined);
    setFocusCardQuestionId(undefined);
    setFocusAnswerQuestionId(undefined);
    setFocusComposerParentId(undefined);
    setScrollColumnIndex(level + 1);
  }

  function startChildQuestion(level: number, questionId: string) {
    setActivePath((existingPath) => [...existingPath.slice(0, level), questionId]);
    setHighlightTarget(undefined);
    setFocusCardQuestionId(undefined);
    setFocusAnswerQuestionId(undefined);
    setFocusComposerParentId(questionId);
    setScrollColumnIndex(level + 1);
  }

  function moveQuestion(level: number, questionId: string, direction: MoveDirection) {
    const parentId = parentIds[level];
    const parentNode = tree.nodes[parentId];
    if (!parentNode) return;

    const currentIndex = parentNode.childIds.indexOf(questionId);
    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= parentNode.childIds.length) return;

    const childIds = [...parentNode.childIds];
    [childIds[currentIndex], childIds[nextIndex]] = [childIds[nextIndex], childIds[currentIndex]];

    setTree((existingTree) =>
      updateNode(existingTree, parentId, (node) => ({
        ...node,
        childIds,
      }))
    );
    setHighlightTarget(undefined);
    setFocusCardQuestionId(undefined);
    setFocusAnswerQuestionId(questionId);
    setFocusComposerParentId(undefined);
    setScrollColumnIndex(level);
  }

  function focusNewQuestionBox(level: number) {
    const parentId = parentIds[level];
    if (!parentId) return;

    setHighlightTarget(undefined);
    setFocusCardQuestionId(undefined);
    setFocusAnswerQuestionId(undefined);
    setFocusComposerParentId(parentId);
    setScrollColumnIndex(level);
  }

  function getNextQuestionHighlight(
    source: HighlightTarget,
    direction: MoveDirection | ColumnDirection
  ): HighlightTarget {
    const sourceParentId = parentIds[source.level];
    const sourceIds = tree.nodes[sourceParentId]?.childIds ?? [];
    const sourceIndex = sourceIds.indexOf(source.questionId);
    if (sourceIndex < 0) return source;

    if (direction === "up" || direction === "down") {
      const nextIndex = direction === "up" ? sourceIndex - 1 : sourceIndex + 1;
      if (nextIndex < 0 || nextIndex >= sourceIds.length) return source;

      return {
        level: source.level,
        questionId: sourceIds[nextIndex],
      };
    }

    const nextLevel = direction === "left" ? source.level - 1 : source.level + 1;
    if (nextLevel < 0 || nextLevel >= parentIds.length) return source;

    const nextParentId = parentIds[nextLevel];
    const nextIds = tree.nodes[nextParentId]?.childIds ?? [];
    const nextIndex = clampIndex(sourceIndex, nextIds.length);
    if (nextIndex < 0) return source;

    return {
      level: nextLevel,
      questionId: nextIds[nextIndex],
    };
  }

  function highlightQuestion(
    level: number,
    questionId: string,
    direction: MoveDirection | ColumnDirection
  ) {
    setHighlightTarget((existingTarget) => {
      const nextTarget = getNextQuestionHighlight(existingTarget ?? { level, questionId }, direction);
      setScrollColumnIndex(nextTarget.level);
      return nextTarget;
    });
  }

  function highlightFromComposer(
    level: number,
    visibleQuestionIds: string[],
    direction: MoveDirection | ColumnDirection
  ) {
    function getInitialComposerHighlight(): HighlightTarget | undefined {
      if (direction === "up") {
        const targetQuestionId = visibleQuestionIds[visibleQuestionIds.length - 1];
        return targetQuestionId ? { level, questionId: targetQuestionId } : undefined;
      }

      if (direction === "down") return undefined;

      const targetLevel = direction === "left" ? level - 1 : level + 1;
      if (targetLevel < 0 || targetLevel >= parentIds.length) return undefined;

      const targetParentId = parentIds[targetLevel];
      const targetChildIds = tree.nodes[targetParentId]?.childIds ?? [];
      const clampedIndex = clampIndex(visibleQuestionIds.length, targetChildIds.length);
      if (clampedIndex < 0) return undefined;

      return {
        level: targetLevel,
        questionId: targetChildIds[clampedIndex],
      };
    }

    setHighlightTarget((existingTarget) => {
      const nextTarget = existingTarget
        ? getNextQuestionHighlight(existingTarget, direction)
        : getInitialComposerHighlight();
      if (!nextTarget) return existingTarget;

      setScrollColumnIndex(nextTarget.level);
      return nextTarget;
    });
  }

  function requestDeleteQuestion(questionId: string) {
    setDeleteCandidateId(questionId);
  }

  function closeDeleteDialog() {
    setDeleteCandidateId(undefined);
  }

  function confirmDeleteQuestion() {
    if (!deleteCandidateId) return;

    const deletedIds = collectQuestionIds(tree, deleteCandidateId);
    const deletedSet = new Set(deletedIds);
    const deletedAt = now();

    setTree((existingTree) => {
      const nextNodes: Record<string, CuriosityNode> = {};

      Object.entries(existingTree.nodes).forEach(([nodeId, node]) => {
        if (deletedSet.has(nodeId)) return;

        const childIds = node.childIds.filter((childId) => !deletedSet.has(childId));
        nextNodes[nodeId] =
          childIds.length === node.childIds.length
            ? node
            : {
                ...node,
                childIds,
                updatedAt: deletedAt,
              };
      });

      return {
        ...existingTree,
        nodes: nextNodes,
      };
    });

    setActivePath((existingPath) => {
      const deletedIndex = existingPath.findIndex((questionId) => deletedSet.has(questionId));
      return deletedIndex === -1 ? existingPath : existingPath.slice(0, deletedIndex);
    });

    setFocusCardQuestionId((questionId) =>
      questionId && deletedSet.has(questionId) ? undefined : questionId
    );
    setHighlightTarget((target) =>
      target && deletedSet.has(target.questionId) ? undefined : target
    );
    setFocusAnswerQuestionId((questionId) =>
      questionId && deletedSet.has(questionId) ? undefined : questionId
    );
    setFocusComposerParentId((parentId) =>
      parentId && deletedSet.has(parentId) ? undefined : parentId
    );
    setDeleteCandidateId(undefined);
  }

  function addQuestion(parentId: string, prompt: string, mode: NewQuestionMode) {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) return;

    const parentLevel = getColumnLevel(parentId);
    const questionId = createId();
    const createdAt = now();

    setTree((existingTree) => {
      const parentNode = existingTree.nodes[parentId];
      if (!parentNode) return existingTree;

      return {
        ...existingTree,
        nodes: {
          ...existingTree.nodes,
          [parentId]: {
            ...parentNode,
            childIds: [...parentNode.childIds, questionId],
            updatedAt: createdAt,
          },
          [questionId]: {
            id: questionId,
            prompt: cleanPrompt,
            answer: "",
            childIds: [],
            createdAt,
            updatedAt: createdAt,
          },
        },
      };
    });

    if (parentLevel < 0) return;

    if (mode === "answer") {
      setActivePath((existingPath) => [...existingPath.slice(0, parentLevel), questionId]);
      setHighlightTarget(undefined);
      setFocusCardQuestionId(undefined);
      setFocusAnswerQuestionId(questionId);
      setFocusComposerParentId(undefined);
      setScrollColumnIndex(parentLevel);
      return;
    }

    if (mode === "child") {
      setActivePath((existingPath) => [...existingPath.slice(0, parentLevel), questionId]);
      setHighlightTarget(undefined);
      setFocusCardQuestionId(undefined);
      setFocusAnswerQuestionId(undefined);
      setFocusComposerParentId(questionId);
      setScrollColumnIndex(parentLevel + 1);
      return;
    }

    setHighlightTarget(undefined);
    setFocusCardQuestionId(undefined);
    setFocusAnswerQuestionId(undefined);
    setFocusComposerParentId(parentId);
    setScrollColumnIndex(parentLevel);
  }

  return (
    <Box
      sx={{
        "--curiosity-page-bg": themePalette.pageBg,
        "--curiosity-board-bg": themePalette.boardBg,
        "--curiosity-column-bg": themePalette.columnBg,
        "--curiosity-question-bg": themePalette.questionBg,
        "--curiosity-question-hover": themePalette.questionHover,
        "--curiosity-question-text": themePalette.questionText,
        "--curiosity-answer-bg": themePalette.answerBg,
        "--curiosity-answer-text": themePalette.answerText,
        "--curiosity-composer-bg": themePalette.composerBg,
        "--curiosity-accent": themePalette.accent,
        bgcolor: "var(--curiosity-page-bg)",
        minHeight: "100vh",
        p: { xs: 1.25, sm: 2, md: 3 },
      }}
    >
      <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mb: 1 }}>
        <Tooltip title={isDarkMode ? "Light mode" : "Dark mode"}>
          <Switch
            checked={isDarkMode}
            inputProps={{ "aria-label": "Toggle dark mode" }}
            onChange={(event) => setIsDarkMode(event.target.checked)}
            size="small"
            sx={{
              mr: 0.5,
              "& .MuiSwitch-switchBase": {
                color: "var(--curiosity-accent)",
              },
              "& .MuiSwitch-switchBase.Mui-checked": {
                color: "var(--curiosity-accent)",
              },
              "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                bgcolor: "var(--curiosity-accent)",
                opacity: 0.42,
              },
              "& .MuiSwitch-track": {
                bgcolor: "var(--curiosity-question-hover)",
                opacity: 1,
              },
            }}
          />
        </Tooltip>
        {isDesktop && (
          <Tooltip title={isVertical ? "Horizontal view" : "Vertical view"}>
            <IconButton
              aria-label="Toggle curiosity layout"
              onClick={() =>
                setViewMode((existingMode) =>
                  existingMode === "horizontal" ? "vertical" : "horizontal"
                )
              }
              sx={{
                bgcolor: "var(--curiosity-composer-bg)",
                border: "1px solid rgba(55, 93, 64, 0.18)",
                boxShadow: "0 8px 24px rgba(23, 43, 28, 0.1)",
                color: "var(--curiosity-question-text)",
                "&:hover": {
                  bgcolor: "var(--curiosity-question-hover)",
                },
              }}
            >
              {isVertical ? <SwapHorizIcon /> : <SwapVertIcon />}
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Theme">
          <IconButton
            aria-label="Theme menu"
            onClick={(event) => setThemeMenuAnchor(event.currentTarget)}
            sx={{
              bgcolor: "var(--curiosity-composer-bg)",
              border: "1px solid rgba(55, 93, 64, 0.18)",
              boxShadow: "0 8px 24px rgba(23, 43, 28, 0.1)",
              color: "var(--curiosity-question-text)",
              "&:hover": {
                bgcolor: "var(--curiosity-question-hover)",
              },
            }}
          >
            <MenuIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      <Menu
        anchorEl={themeMenuAnchor}
        open={themeMenuOpen}
        onClose={() => setThemeMenuAnchor(null)}
      />

      <Box
        ref={boardRef}
        sx={{
          bgcolor: "var(--curiosity-board-bg)",
          border: "1px solid rgba(55, 93, 64, 0.16)",
          borderRadius: 1,
          boxShadow: "0 12px 36px rgba(23, 43, 28, 0.1)",
          height: isVertical
            ? "clamp(520px, calc(100vh - 92px), 820px)"
            : "clamp(520px, calc(100vh - 92px), 780px)",
          overflowX: isVertical ? "hidden" : "auto",
          overflowY: isVertical ? "auto" : "hidden",
          p: 1.25,
          position: "relative",
        }}
      >
        <Box
          component="svg"
          aria-hidden="true"
          width={connectorCanvas.width}
          height={connectorCanvas.height}
          viewBox={`0 0 ${Math.max(connectorCanvas.width, 1)} ${Math.max(
            connectorCanvas.height,
            1
          )}`}
          sx={{
            height: connectorCanvas.height || 1,
            inset: 0,
            overflow: "visible",
            pointerEvents: "none",
            position: "absolute",
            width: connectorCanvas.width || 1,
            zIndex: 2,
          }}
        >
          {connectorLines.map((line) => {
            const controlOffset = isVertical
              ? Math.max(40, Math.abs(line.y2 - line.y1) / 2)
              : Math.max(40, Math.abs(line.x2 - line.x1) / 2);
            const path = isVertical
              ? `M ${line.x1} ${line.y1} C ${line.x1} ${line.y1 + controlOffset}, ${line.x2} ${line.y2 - controlOffset}, ${line.x2} ${line.y2}`
              : `M ${line.x1} ${line.y1} C ${line.x1 + controlOffset} ${line.y1}, ${line.x2 - controlOffset} ${line.y2}, ${line.x2} ${line.y2}`;

            return (
              <path
                key={line.id}
                d={path}
                fill="none"
                stroke="var(--curiosity-accent)"
                strokeLinecap="round"
                strokeOpacity={0.72}
                strokeWidth={3}
              />
            );
          })}
        </Box>

        <Box
          ref={railRef}
          sx={{
            display: "flex",
            flexDirection: isVertical ? "column" : "row",
            gap: "12px",
            height: isVertical ? "auto" : "100%",
            minWidth: 0,
            position: "relative",
            zIndex: 1,
          }}
        >
          {parentIds.map((parentId, level) => {
            const parentNode = tree.nodes[parentId];
            if (!parentNode) return null;

            const selectedQuestionId = activePath[level];
            const questions = getChildNodes(tree, parentNode);

            return (
              <Box
                key={`${parentId}-${level}`}
                ref={(element: HTMLDivElement | null) => {
                  columnRefs.current[level] = element;
                }}
                sx={{
                  flex: isVertical
                    ? isDesktop
                      ? "0 0 500px"
                      : "0 0 46vh"
                    : "0 0 calc((100% - 24px) / 3)",
                  height: isVertical ? (isDesktop ? 500 : "46vh") : "100%",
                  minWidth: isVertical ? "100%" : "calc((100% - 24px) / 3)",
                }}
              >
                <QuestionColumn
                  columnIndex={level}
                  questions={questions}
                  selectedQuestionId={selectedQuestionId}
                  isVertical={isVertical}
                  shouldFocusComposer={focusComposerParentId === parentId}
                  highlightQuestionId={
                    highlightTarget?.level === level ? highlightTarget.questionId : undefined
                  }
                  focusCardQuestionId={focusCardQuestionId}
                  focusAnswerQuestionId={focusAnswerQuestionId}
                  onSubmitQuestion={(prompt, mode) => addQuestion(parentId, prompt, mode)}
                  onSelectQuestion={(questionId) => selectQuestion(level, questionId)}
                  onPromptChange={updatePrompt}
                  onAnswerChange={updateAnswer}
                  onAddChildQuestion={(questionId) => startChildQuestion(level, questionId)}
                  onFocusNewSibling={() => focusNewQuestionBox(level)}
                  onMoveQuestion={(questionId, direction) =>
                    moveQuestion(level, questionId, direction)
                  }
                  onHighlightNavigate={(questionId, direction) =>
                    highlightQuestion(level, questionId, direction)
                  }
                  onHighlightFromComposer={(visibleQuestionIds, direction) =>
                    highlightFromComposer(level, visibleQuestionIds, direction)
                  }
                  onRequestDelete={requestDeleteQuestion}
                  onComposerFocused={() => setFocusComposerParentId(undefined)}
                  onCardFocused={() => setFocusCardQuestionId(undefined)}
                  onAnswerFocused={() => setFocusAnswerQuestionId(undefined)}
                />
              </Box>
            );
          })}
        </Box>
      </Box>

      <Dialog open={Boolean(deleteCandidate)} onClose={closeDeleteDialog}>
        <DialogTitle>Delete this question?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will delete the selected question
            {deleteCount > 1 ? ` and ${deleteCount - 1} child question${deleteCount === 2 ? "" : "s"}` : ""}
            . This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmDeleteQuestion}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
