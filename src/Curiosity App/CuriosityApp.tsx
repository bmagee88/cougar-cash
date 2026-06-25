import React, { useEffect, useMemo, useRef, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import {
  Box,
  IconButton,
  Stack,
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

const STORAGE_KEY = "curiosity-app-tree-v1";
const ROOT_ID = "root";

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
        prompt: "Topic summary",
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

function textPreview(text: string, fallback: string) {
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function getSafeNode(tree: CuriosityTree, nodeId: string): CuriosityNode {
  return tree.nodes[nodeId] ?? tree.nodes[tree.rootId];
}

function getChildNodes(tree: CuriosityTree, node: CuriosityNode) {
  return node.childIds
    .map((childId) => tree.nodes[childId])
    .filter((child): child is CuriosityNode => Boolean(child));
}

function usePersistedTree() {
  const [tree, setTree] = useState<CuriosityTree>(loadStoredTree);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
  }, [tree]);

  return [tree, setTree] as const;
}

function updateNode(
  tree: CuriosityTree,
  nodeId: string,
  updater: (node: CuriosityNode) => CuriosityNode
): CuriosityTree {
  const existingNode = tree.nodes[nodeId];
  if (!existingNode) return tree;

  const nextNode = updater(existingNode);

  return {
    ...tree,
    nodes: {
      ...tree.nodes,
      [nodeId]: {
        ...nextNode,
        updatedAt: now(),
      },
    },
  };
}

function Surface({
  children,
  color,
  onClick,
  minHeight,
}: {
  children?: React.ReactNode;
  color: string;
  onClick?: () => void;
  minHeight?: number | string;
}) {
  return (
    <Box
      onClick={onClick}
      sx={{
        bgcolor: color,
        border: "1px solid rgba(24, 45, 76, 0.09)",
        borderRadius: 1,
        boxShadow: "0 10px 30px rgba(31, 41, 55, 0.06)",
        height: "100%",
        minHeight,
        overflow: "hidden",
      }}
    >
      {children}
    </Box>
  );
}

function AnswerColumn({
  node,
  title,
  placeholder,
  canGoBack,
  onBack,
  onAnswerChange,
}: {
  node: CuriosityNode;
  title: string;
  placeholder: string;
  canGoBack: boolean;
  onBack: () => void;
  onAnswerChange: (value: string) => void;
}) {
  return (
    <Surface color="#eaf6ff">
      <Stack sx={{ height: "100%", p: 1.5 }} gap={1.25}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="overline"
              sx={{ color: "#38607d", display: "block", lineHeight: 1.3 }}
            >
              {title}
            </Typography>
            <Typography
              variant="h6"
              sx={{
                color: "#18324a",
                fontSize: { xs: "1rem", md: "1.1rem" },
                fontWeight: 800,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {textPreview(node.prompt, title)}
            </Typography>
          </Box>

          {canGoBack && (
            <Tooltip title="Back">
              <IconButton
                aria-label="Back"
                onClick={onBack}
                size="small"
                sx={{
                  bgcolor: "rgba(255,255,255,0.7)",
                  border: "1px solid rgba(56, 96, 125, 0.15)",
                }}
              >
                <ArrowBackIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>

        <TextField
          value={node.answer}
          onChange={(event) => onAnswerChange(event.target.value)}
          placeholder={placeholder}
          multiline
          fullWidth
          variant="standard"
          InputProps={{
            disableUnderline: true,
          }}
          sx={{
            flex: 1,
            minHeight: 0,
            "& .MuiInputBase-root": {
              alignItems: "flex-start",
              color: "#17344e",
              fontSize: "1rem",
              height: "100%",
              lineHeight: 1.55,
              overflow: "auto",
              p: 1,
            },
            "& textarea": {
              height: "100% !important",
              overflow: "auto !important",
            },
          }}
        />
      </Stack>
    </Surface>
  );
}

function QuestionComposer({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" || event.ctrlKey) return;

    event.preventDefault();
    onSubmit();
  }

  return (
    <TextField
      autoFocus
      multiline
      minRows={3}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="Write a question..."
      fullWidth
      sx={{
        bgcolor: "#f7efff",
        border: "1px solid rgba(108, 64, 145, 0.12)",
        borderRadius: 1,
        "& .MuiOutlinedInput-root": {
          alignItems: "flex-start",
          borderRadius: 1,
          color: "#3e2659",
          fontWeight: 600,
        },
        "& fieldset": {
          borderColor: "transparent",
        },
      }}
    />
  );
}

function QuestionsColumn({
  questions,
  selectedQuestionId,
  isComposing,
  draftQuestion,
  onStartComposing,
  onDraftChange,
  onSubmitDraft,
  onSelectQuestion,
}: {
  questions: CuriosityNode[];
  selectedQuestionId?: string;
  isComposing: boolean;
  draftQuestion: string;
  onStartComposing: () => void;
  onDraftChange: (value: string) => void;
  onSubmitDraft: () => void;
  onSelectQuestion: (id: string) => void;
}) {
  const questionRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (!selectedQuestionId) return;

    questionRefs.current[selectedQuestionId]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [selectedQuestionId]);

  return (
    <Surface color="#fbf7ff">
      <Stack sx={{ height: "100%", p: 1.5 }} gap={1.25}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="overline"
              sx={{ color: "#6b4c86", display: "block", lineHeight: 1.3 }}
            >
              Questions
            </Typography>
            <Typography
              variant="h6"
              sx={{
                color: "#2e1747",
                fontSize: { xs: "1rem", md: "1.1rem" },
                fontWeight: 800,
              }}
            >
              {questions.length}
            </Typography>
          </Box>

          <Tooltip title="Add question">
            <IconButton
              aria-label="Add question"
              onClick={onStartComposing}
              size="small"
              sx={{
                bgcolor: "#efe1ff",
                border: "1px solid rgba(108, 64, 145, 0.15)",
                color: "#4c2170",
                "&:hover": {
                  bgcolor: "#e6d3fb",
                },
              }}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        <Stack
          gap={1}
          sx={{
            flex: 1,
            minHeight: 260,
            overflowY: "auto",
            pb: 0.25,
          }}
        >
          {questions.length === 0 && !isComposing && (
            <Stack
              alignItems="center"
              justifyContent="center"
              sx={{
                color: "#6b4c86",
                flex: 1,
                minHeight: 240,
                px: 3,
                textAlign: "center",
              }}
            >
              <Typography fontWeight={700}>
                Press the add button to create a question.
              </Typography>
            </Stack>
          )}

          {questions.map((question) => {
            const isSelected = selectedQuestionId === question.id;

            return (
              <Box
                key={question.id}
                component="button"
                ref={(element: HTMLButtonElement | null) => {
                  questionRefs.current[question.id] = element;
                }}
                type="button"
                onClick={() => onSelectQuestion(question.id)}
                sx={{
                  bgcolor: "#f0e4ff",
                  border: isSelected
                    ? "2px solid rgba(93, 52, 140, 0.38)"
                    : "1px solid rgba(108, 64, 145, 0.12)",
                  borderRadius: 1,
                  color: "#32184e",
                  cursor: "pointer",
                  flex: isSelected ? "0 0 50%" : "0 0 44px",
                  font: "inherit",
                  minHeight: isSelected ? 170 : 44,
                  outline: "none",
                  overflow: "hidden",
                  p: isSelected ? 1.5 : 1,
                  textAlign: "left",
                  transition:
                    "flex-basis 220ms ease, min-height 220ms ease, border-color 160ms ease, background-color 160ms ease",
                  width: "100%",
                  "&:hover": {
                    bgcolor: "#ead9ff",
                  },
                  "&:focus-visible": {
                    boxShadow: "0 0 0 3px rgba(93, 52, 140, 0.18)",
                  },
                }}
              >
                <Typography
                  sx={{
                    display: isSelected ? "block" : "inline-block",
                    fontWeight: 800,
                    lineHeight: 1.35,
                    maxWidth: "100%",
                    overflow: "hidden",
                    textOverflow: isSelected ? "clip" : "ellipsis",
                    whiteSpace: isSelected ? "pre-wrap" : "nowrap",
                  }}
                >
                  {question.prompt}
                </Typography>

                {isSelected && (
                  <Typography
                    sx={{
                      color: "#694783",
                      mt: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {textPreview(question.answer, "No answer yet.")}
                  </Typography>
                )}
              </Box>
            );
          })}

          {isComposing && (
            <QuestionComposer
              value={draftQuestion}
              onChange={onDraftChange}
              onSubmit={onSubmitDraft}
            />
          )}
        </Stack>
      </Stack>
    </Surface>
  );
}

function SelectedAnswerColumn({
  selectedQuestion,
  onAnswerChange,
  onOpenAnswer,
}: {
  selectedQuestion?: CuriosityNode;
  onAnswerChange: (nodeId: string, value: string) => void;
  onOpenAnswer: () => void;
}) {
  if (!selectedQuestion) {
    return <Surface color="#eaf6ff" />;
  }

  return (
    <Surface color="#eaf6ff" onClick={onOpenAnswer}>
      <Stack sx={{ height: "100%", p: 1.5 }} gap={1.25}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="overline"
              sx={{ color: "#38607d", display: "block", lineHeight: 1.3 }}
            >
              Answer
            </Typography>
            <Typography
              variant="h6"
              sx={{
                color: "#18324a",
                fontSize: { xs: "1rem", md: "1.1rem" },
                fontWeight: 800,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {selectedQuestion.prompt}
            </Typography>
          </Box>

          <Tooltip title="Open answer">
            <IconButton
              aria-label="Open answer"
              onClick={(event) => {
                event.stopPropagation();
                onOpenAnswer();
              }}
              size="small"
              sx={{
                bgcolor: "rgba(255,255,255,0.7)",
                border: "1px solid rgba(56, 96, 125, 0.15)",
              }}
            >
              <ArrowForwardIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        <TextField
          value={selectedQuestion.answer}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => onAnswerChange(selectedQuestion.id, event.target.value)}
          placeholder="Write the answer..."
          multiline
          fullWidth
          variant="standard"
          InputProps={{
            disableUnderline: true,
          }}
          sx={{
            flex: 1,
            minHeight: 0,
            "& .MuiInputBase-root": {
              alignItems: "flex-start",
              color: "#17344e",
              fontSize: "1rem",
              height: "100%",
              lineHeight: 1.55,
              overflow: "auto",
              p: 1,
            },
            "& textarea": {
              height: "100% !important",
              overflow: "auto !important",
            },
          }}
        />
      </Stack>
    </Surface>
  );
}

export default function CuriosityApp() {
  const [tree, setTree] = usePersistedTree();
  const [currentNodeId, setCurrentNodeId] = useState(tree.rootId);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | undefined>();
  const [pathIds, setPathIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("horizontal");
  const [isComposing, setIsComposing] = useState(false);
  const [draftQuestion, setDraftQuestion] = useState("");
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  const currentNode = getSafeNode(tree, currentNodeId);
  const questions = useMemo(() => getChildNodes(tree, currentNode), [tree, currentNode]);
  const selectedQuestion = selectedQuestionId ? tree.nodes[selectedQuestionId] : undefined;
  const isVertical = !isDesktop || viewMode === "vertical";

  useEffect(() => {
    if (!tree.nodes[currentNodeId]) {
      setCurrentNodeId(tree.rootId);
      setSelectedQuestionId(undefined);
    }
  }, [currentNodeId, tree]);

  useEffect(() => {
    if (selectedQuestionId && !currentNode.childIds.includes(selectedQuestionId)) {
      setSelectedQuestionId(undefined);
    }
  }, [currentNode.childIds, selectedQuestionId]);

  function updateAnswer(nodeId: string, value: string) {
    setTree((existingTree) =>
      updateNode(existingTree, nodeId, (node) => ({
        ...node,
        answer: value,
      }))
    );
  }

  function addQuestion() {
    const prompt = draftQuestion.trim();
    if (!prompt) return;

    const questionId = createId();
    const createdAt = now();

    setTree((existingTree) => ({
      ...existingTree,
      nodes: {
        ...existingTree.nodes,
        [currentNode.id]: {
          ...existingTree.nodes[currentNode.id],
          childIds: [...existingTree.nodes[currentNode.id].childIds, questionId],
          updatedAt: createdAt,
        },
        [questionId]: {
          id: questionId,
          prompt,
          answer: "",
          childIds: [],
          createdAt,
          updatedAt: createdAt,
        },
      },
    }));
    setSelectedQuestionId(questionId);
    setDraftQuestion("");
    setIsComposing(false);
  }

  function openSelectedAnswer() {
    if (!selectedQuestion) return;

    setPathIds((existingPath) => [...existingPath, currentNode.id]);
    setCurrentNodeId(selectedQuestion.id);
    setSelectedQuestionId(undefined);
    setDraftQuestion("");
    setIsComposing(false);
  }

  function goBack() {
    const previousNodeId = pathIds[pathIds.length - 1];
    if (!previousNodeId) return;

    setPathIds((existingPath) => existingPath.slice(0, -1));
    setCurrentNodeId(previousNodeId);
    setSelectedQuestionId(currentNode.id);
    setDraftQuestion("");
    setIsComposing(false);
  }

  return (
    <Box
      sx={{
        bgcolor: "#f6f8fb",
        minHeight: "100vh",
        p: { xs: 1.25, sm: 2, md: 3 },
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 1.25 }}
      >
        <Box />

        {isDesktop && (
          <Tooltip title={viewMode === "horizontal" ? "Vertical view" : "Horizontal view"}>
            <IconButton
              aria-label="Toggle curiosity layout"
              onClick={() =>
                setViewMode((existingMode) =>
                  existingMode === "horizontal" ? "vertical" : "horizontal"
                )
              }
              sx={{
                bgcolor: "#ffffff",
                border: "1px solid rgba(24, 45, 76, 0.1)",
                boxShadow: "0 8px 24px rgba(31, 41, 55, 0.06)",
                color: "#21364f",
              }}
            >
              {viewMode === "horizontal" ? <SwapVertIcon /> : <SwapHorizIcon />}
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      <Stack
        direction={isVertical ? "column" : "row"}
        gap={1.25}
        sx={{
          height: isVertical ? "auto" : "clamp(500px, calc(100vh - 118px), 760px)",
          minHeight: isVertical ? 0 : 500,
          overflow: "hidden",
          width: "100%",
        }}
      >
        <Box
          sx={{
            flex: isVertical ? "none" : "1 1 0",
            minHeight: isVertical ? 260 : 0,
            minWidth: 0,
          }}
        >
          <AnswerColumn
            node={currentNode}
            title={currentNode.id === tree.rootId ? "Topic Summary" : "Answer"}
            placeholder={
              currentNode.id === tree.rootId ? "Write the topic summary..." : "Write the answer..."
            }
            canGoBack={pathIds.length > 0}
            onBack={goBack}
            onAnswerChange={(value) => updateAnswer(currentNode.id, value)}
          />
        </Box>

        <Box
          sx={{
            flex: isVertical ? "none" : "1 1 0",
            minHeight: isVertical ? 360 : 0,
            minWidth: 0,
          }}
        >
          <QuestionsColumn
            questions={questions}
            selectedQuestionId={selectedQuestionId}
            isComposing={isComposing}
            draftQuestion={draftQuestion}
            onStartComposing={() => setIsComposing(true)}
            onDraftChange={setDraftQuestion}
            onSubmitDraft={addQuestion}
            onSelectQuestion={setSelectedQuestionId}
          />
        </Box>

        <Box
          sx={{
            flex: isVertical ? "none" : "1 1 0",
            minHeight: isVertical ? 260 : 0,
            minWidth: 0,
          }}
        >
          <SelectedAnswerColumn
            selectedQuestion={selectedQuestion}
            onAnswerChange={updateAnswer}
            onOpenAnswer={openSelectedAnswer}
          />
        </Box>
      </Stack>
    </Box>
  );
}
