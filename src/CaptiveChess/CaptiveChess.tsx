import React, { useMemo, useState } from "react";
import {
  Box,
  Button,
  ButtonGroup,
  Chip,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import SkipPreviousIcon from "@mui/icons-material/SkipPrevious";
import type { Piece, Square } from "chess.js";
import {
  BOARD_FILES,
  BOARD_RANKS,
  CaptivePiece,
  PromotionPiece,
  applyCaptiveMove,
  colorName,
  createChess,
  createInitialCaptiveChessState,
  executeCaptive,
  getVariantMovesForSquare,
  pieceGlyph,
  pieceLabel,
  squareFromParts,
  statusText,
} from "./captiveChessEngine";
import "./CaptiveChess.css";

type PendingPromotion = {
  from: Square;
  to: Square;
  releaseBeforeMove: boolean;
  promotions: PromotionPiece[];
};

type ActiveCaptive = {
  square: Square;
  carrier: Piece;
  captive: CaptivePiece;
};

const PROMOTION_LABELS: Record<PromotionPiece, string> = {
  q: "Queen",
  r: "Rook",
  b: "Bishop",
  n: "Knight",
};

function CaptiveChess() {
  const [timeline, setTimeline] = useState([createInitialCaptiveChessState()]);
  const [timelineIndex, setTimelineIndex] = useState(0);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [releaseBeforeMove, setReleaseBeforeMove] = useState(false);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [notice, setNotice] = useState("Standard chess position ready.");

  const state = timeline[timelineIndex];
  const chess = useMemo(() => createChess(state), [state]);
  const selectedPiece = selectedSquare ? chess.get(selectedSquare) : undefined;
  const selectedCaptive = selectedSquare ? state.captives[selectedSquare] : undefined;
  const selectedMoves = useMemo(
    () =>
      selectedSquare
        ? getVariantMovesForSquare(state, selectedSquare, releaseBeforeMove)
        : [],
    [state, selectedSquare, releaseBeforeMove],
  );
  const moveTargets = useMemo(() => {
    const targets = new Map<Square, typeof selectedMoves>();

    selectedMoves.forEach((variantMove) => {
      const moves = targets.get(variantMove.move.to) ?? [];
      targets.set(variantMove.move.to, [...moves, variantMove]);
    });

    return targets;
  }, [selectedMoves]);
  const activeCaptives = useMemo(() => getActiveCaptives(state.captives, chess), [
    state,
    chess,
  ]);
  const canGoBack = timelineIndex > 0;
  const canGoForward = timelineIndex < timeline.length - 1;

  function commitState(nextState: typeof state) {
    setTimeline((previous) => [...previous.slice(0, timelineIndex + 1), nextState]);
    setTimelineIndex((previous) => previous + 1);
    setSelectedSquare(null);
    setReleaseBeforeMove(false);
    setPendingPromotion(null);
    setNotice(nextState.history[nextState.history.length - 1]?.text ?? statusText(nextState));
  }

  function applyMove(from: Square, to: Square, promotion?: PromotionPiece) {
    const result = applyCaptiveMove(state, {
      from,
      to,
      promotion,
      releaseBeforeMove,
    });

    if (result.ok === true) {
      commitState(result.state);
      return;
    }

    if (result.needsPromotion) {
      setPendingPromotion({
        from,
        to,
        releaseBeforeMove,
        promotions: result.promotions ?? ["q", "r", "b", "n"],
      });
      return;
    }

    setNotice(result.error ?? "That move is not available.");
  }

  function handleSquareClick(square: Square) {
    if (pendingPromotion) return;

    const piece = chess.get(square);
    const targetMoves = moveTargets.get(square);

    if (selectedSquare && targetMoves?.length) {
      const promotions = uniquePromotions(targetMoves);

      if (promotions.length > 0) {
        setPendingPromotion({
          from: selectedSquare,
          to: square,
          releaseBeforeMove,
          promotions,
        });
        return;
      }

      applyMove(selectedSquare, square);
      return;
    }

    if (piece && piece.color === chess.turn()) {
      setSelectedSquare(square);
      setReleaseBeforeMove(false);
      setNotice(`${pieceLabel(piece)} selected on ${square}.`);
      return;
    }

    setSelectedSquare(null);
    setReleaseBeforeMove(false);
  }

  function handleExecute() {
    if (!selectedSquare) return;

    const result = executeCaptive(state, selectedSquare);

    if (result.ok === true) {
      commitState(result.state);
      return;
    }

    setNotice(result.error ?? "That captive cannot be executed.");
  }

  function goBack() {
    if (!canGoBack) return;
    setTimelineIndex((previous) => previous - 1);
    setSelectedSquare(null);
    setReleaseBeforeMove(false);
    setPendingPromotion(null);
    setNotice("Timeline moved back.");
  }

  function goForward() {
    if (!canGoForward) return;
    setTimelineIndex((previous) => previous + 1);
    setSelectedSquare(null);
    setReleaseBeforeMove(false);
    setPendingPromotion(null);
    setNotice("Timeline moved forward.");
  }

  function resetGame() {
    const nextState = createInitialCaptiveChessState();
    setTimeline([nextState]);
    setTimelineIndex(0);
    setSelectedSquare(null);
    setReleaseBeforeMove(false);
    setPendingPromotion(null);
    setNotice("Standard chess position ready.");
  }

  return (
    <Box className="captive-chess-page">
      <Box className="captive-chess-shell">
        <Box className="captive-chess-main">
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", sm: "center" }}
            justifyContent="space-between"
            className="captive-chess-header"
          >
            <Box>
              <Typography component="h1" className="captive-chess-title">
                Captive Chess
              </Typography>
              <Typography className="captive-chess-subtitle">{statusText(state)}</Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                className="turn-chip"
                label={`${colorName(chess.turn())} turn`}
                color={chess.turn() === "w" ? "default" : "primary"}
              />
              <Tooltip title="Go back">
                <span>
                  <IconButton
                    className="tool-icon-button"
                    onClick={goBack}
                    disabled={!canGoBack}
                    aria-label="Go back"
                  >
                    <SkipPreviousIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Go forward">
                <span>
                  <IconButton
                    className="tool-icon-button"
                    onClick={goForward}
                    disabled={!canGoForward}
                    aria-label="Go forward"
                  >
                    <SkipNextIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Restart">
                <IconButton
                  className="tool-icon-button"
                  onClick={resetGame}
                  aria-label="Restart"
                >
                  <RestartAltIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          <Box className="board-frame">
            <Box className="rank-labels" aria-hidden="true">
              {BOARD_RANKS.map((rank) => (
                <span key={rank}>{rank}</span>
              ))}
            </Box>
            <Box className="board-and-files">
              <Box className="chess-board" role="grid" aria-label="Captive chess board">
                {BOARD_RANKS.flatMap((rank, rowIndex) =>
                  BOARD_FILES.map((file, fileIndex) => {
                    const square = squareFromParts(file, rank);
                    const piece = chess.get(square);
                    const captive = state.captives[square];
                    const target = moveTargets.has(square);
                    const marker = state.marker;
                    const isSelected = selectedSquare === square;
                    const isLastMove =
                      marker?.from === square ||
                      marker?.to === square ||
                      marker?.releasedSquare === square ||
                      marker?.rookFrom === square ||
                      marker?.rookTo === square;
                    const isDark = (rowIndex + fileIndex) % 2 === 1;

                    return (
                      <button
                        key={square}
                        type="button"
                        className={[
                          "chess-square",
                          isDark ? "dark-square" : "light-square",
                          isSelected ? "selected-square" : "",
                          target ? "target-square" : "",
                          isLastMove ? "last-move-square" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => handleSquareClick(square)}
                        role="gridcell"
                        aria-label={square}
                      >
                        {piece && (
                          <span
                            className={`board-piece ${
                              piece.color === "w" ? "white-piece" : "black-piece"
                            }`}
                          >
                            {pieceGlyph(piece)}
                          </span>
                        )}
                        {piece && captive && (
                          <span
                            className={`captive-token ${
                              captive.color === "w" ? "white-captive" : "black-captive"
                            }`}
                            title={`Captive: ${pieceLabel(captive)}`}
                          >
                            {pieceGlyph(captive)}
                          </span>
                        )}
                        {target && <span className="target-dot" />}
                      </button>
                    );
                  }),
                )}
              </Box>
              <Box className="file-labels" aria-hidden="true">
                {BOARD_FILES.map((file) => (
                  <span key={file}>{file}</span>
                ))}
              </Box>
            </Box>
            {pendingPromotion && (
              <Paper className="promotion-panel" elevation={8}>
                <Typography className="panel-kicker">Promotion</Typography>
                <Stack direction="row" spacing={1} justifyContent="center">
                  {pendingPromotion.promotions.map((promotion) => {
                    const piece = {
                      color: chess.turn(),
                      type: promotion,
                    } as Piece;

                    return (
                      <Tooltip key={promotion} title={PROMOTION_LABELS[promotion]}>
                        <Button
                          className="promotion-button"
                          variant="contained"
                          onClick={() =>
                            applyMove(
                              pendingPromotion.from,
                              pendingPromotion.to,
                              promotion,
                            )
                          }
                        >
                          {pieceGlyph(piece)}
                        </Button>
                      </Tooltip>
                    );
                  })}
                </Stack>
              </Paper>
            )}
          </Box>
        </Box>

        <Stack spacing={2} className="captive-chess-side">
          <Paper className="side-panel" elevation={0}>
            <Typography className="panel-kicker">Selected</Typography>
            <Box className="selected-piece-row">
              <Box className="selected-piece-glyph">
                {selectedPiece ? pieceGlyph(selectedPiece) : "--"}
              </Box>
              <Box>
                <Typography className="selected-piece-title">
                  {selectedPiece ? `${pieceLabel(selectedPiece)} on ${selectedSquare}` : "No piece"}
                </Typography>
                <Typography className="selected-piece-subtitle">
                  {selectedCaptive
                    ? `Holding ${pieceLabel(selectedCaptive).toLowerCase()}`
                    : "No captive held"}
                </Typography>
              </Box>
            </Box>

            <Divider className="soft-divider" />

            <Stack spacing={1.25}>
              <ButtonGroup fullWidth disabled={!selectedCaptive}>
                <Tooltip title="Carry captive with the next move">
                  <Button
                    variant={!releaseBeforeMove ? "contained" : "outlined"}
                    startIcon={<LockIcon />}
                    onClick={() => setReleaseBeforeMove(false)}
                  >
                    Carry
                  </Button>
                </Tooltip>
                <Tooltip title="Free captive on the current square before moving">
                  <Button
                    variant={releaseBeforeMove ? "contained" : "outlined"}
                    startIcon={<LockOpenIcon />}
                    onClick={() => setReleaseBeforeMove(true)}
                  >
                    Free
                  </Button>
                </Tooltip>
              </ButtonGroup>

              <Tooltip title="Spend this turn to remove the held captive">
                <span>
                  <Button
                    fullWidth
                    color="error"
                    variant="outlined"
                    startIcon={<DeleteForeverIcon />}
                    disabled={!selectedCaptive || chess.isCheck()}
                    onClick={handleExecute}
                  >
                    Execute
                  </Button>
                </span>
              </Tooltip>
            </Stack>
          </Paper>

          <Paper className="side-panel" elevation={0}>
            <Typography className="panel-kicker">Cages</Typography>
            <Stack spacing={1}>
              {activeCaptives.length === 0 ? (
                <Typography className="muted-line">No active captives.</Typography>
              ) : (
                activeCaptives.map((item) => (
                  <Box className="cage-row" key={item.square}>
                    <span className="cage-carrier">{pieceGlyph(item.carrier)}</span>
                    <span className="cage-square">{item.square}</span>
                    <span className="cage-captive">{pieceGlyph(item.captive)}</span>
                  </Box>
                ))
              )}
            </Stack>
          </Paper>

          <Paper className="side-panel notice-panel" elevation={0}>
            <Typography className="panel-kicker">Table</Typography>
            <Typography className="notice-text">{notice}</Typography>
          </Paper>

          <Paper className="side-panel history-panel" elevation={0}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography className="panel-kicker">History</Typography>
              <Typography className="timeline-count">
                {timelineIndex}/{timeline.length - 1}
              </Typography>
            </Stack>
            <Stack spacing={0.75} className="history-list">
              {state.history
                .slice()
                .reverse()
                .map((entry) => (
                  <Box className="history-entry" key={entry.id}>
                    <span className="history-ply">{entry.ply}</span>
                    <span>{entry.text}</span>
                  </Box>
                ))}
            </Stack>
          </Paper>

          {state.removed.length > 0 && (
            <Paper className="side-panel" elevation={0}>
              <Typography className="panel-kicker">Out</Typography>
              <Stack spacing={0.75}>
                {state.removed.slice(0, 5).map((piece) => (
                  <Box className="removed-row" key={piece.id}>
                    <span>{pieceGlyph(piece)}</span>
                    <span>{pieceLabel(piece)}</span>
                  </Box>
                ))}
              </Stack>
            </Paper>
          )}
        </Stack>
      </Box>
    </Box>
  );
}

function getActiveCaptives(captives: Record<string, CaptivePiece | undefined>, chess: ReturnType<typeof createChess>) {
  const active: ActiveCaptive[] = [];

  Object.entries(captives).forEach(([square, captive]) => {
    const typedSquare = square as Square;
    const carrier = chess.get(typedSquare);

    if (carrier && captive) {
      active.push({
        square: typedSquare,
        carrier,
        captive,
      });
    }
  });

  return active;
}

function uniquePromotions(moves: ReturnType<typeof getVariantMovesForSquare>) {
  const promotions = new Set<PromotionPiece>();

  moves.forEach(({ move }) => {
    if (move.isPromotion() && move.promotion) {
      promotions.add(move.promotion as PromotionPiece);
    }
  });

  return Array.from(promotions);
}

export default CaptiveChess;
