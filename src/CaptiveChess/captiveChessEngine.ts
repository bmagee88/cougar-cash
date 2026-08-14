import { Chess } from "chess.js";
import type { Color, Move, Piece, PieceSymbol, Square } from "chess.js";

export type CaptivePiece = Piece;
export type PromotionPiece = "q" | "r" | "b" | "n";

export type CaptiveMap = Partial<Record<Square, CaptivePiece>>;

export type RemovedCaptive = CaptivePiece & {
  id: string;
  ply: number;
  reason: string;
};

export type MoveMarker = {
  from?: Square;
  to?: Square;
  releasedSquare?: Square;
  capturedCarrierSquare?: Square;
  rookFrom?: Square;
  rookTo?: Square;
};

export type HistoryEntry = {
  id: string;
  ply: number;
  side: Color;
  text: string;
  san?: string;
};

export type CaptiveChessState = {
  fen: string;
  captives: CaptiveMap;
  removed: RemovedCaptive[];
  history: HistoryEntry[];
  marker?: MoveMarker;
};

export type ApplyMoveRequest = {
  from: Square;
  to: Square;
  promotion?: PromotionPiece;
  releaseBeforeMove?: boolean;
};

export type ApplyMoveResult =
  | { ok: true; state: CaptiveChessState }
  | {
      ok: false;
      error?: string;
      needsPromotion?: true;
      promotions?: PromotionPiece[];
    };

export type VariantMove = {
  move: Move;
  releasesCaptive: boolean;
};

export const BOARD_FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
export const BOARD_RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;
export const PROMOTION_PIECES: PromotionPiece[] = ["q", "r", "b", "n"];

export function createInitialCaptiveChessState(): CaptiveChessState {
  const chess = new Chess();

  return {
    fen: chess.fen(),
    captives: {},
    removed: [],
    history: [
      {
        id: "start",
        ply: 0,
        side: "w",
        text: "Game started.",
      },
    ],
  };
}

export function createChess(state: CaptiveChessState) {
  return new Chess(state.fen);
}

export function opposite(color: Color): Color {
  return color === "w" ? "b" : "w";
}

export function squareFromParts(file: string, rank: string): Square {
  return `${file}${rank}` as Square;
}

export function pieceLabel(piece: CaptivePiece) {
  const color = piece.color === "w" ? "White" : "Black";
  const type = {
    p: "pawn",
    n: "knight",
    b: "bishop",
    r: "rook",
    q: "queen",
    k: "king",
  }[piece.type];

  return `${color} ${type}`;
}

export function pieceGlyph(piece: CaptivePiece) {
  const glyphs: Record<Color, Record<PieceSymbol, string>> = {
    w: {
      k: "♔",
      q: "♕",
      r: "♖",
      b: "♗",
      n: "♘",
      p: "♙",
    },
    b: {
      k: "♚",
      q: "♛",
      r: "♜",
      b: "♝",
      n: "♞",
      p: "♟",
    },
  };

  return glyphs[piece.color][piece.type];
}

export function colorName(color: Color) {
  return color === "w" ? "White" : "Black";
}

export function statusText(state: CaptiveChessState) {
  const chess = createChess(state);
  const turn = colorName(chess.turn());

  if (chess.isCheckmate()) return `Checkmate. ${colorName(opposite(chess.turn()))} wins.`;
  if (chess.isStalemate()) return "Stalemate.";
  if (chess.isInsufficientMaterial()) return "Draw by insufficient material.";
  if (chess.isThreefoldRepetition()) return "Draw by threefold repetition.";
  if (chess.isDrawByFiftyMoves()) return "Draw by fifty-move rule.";
  if (chess.isCheck()) return `${turn} to move, in check.`;
  return `${turn} to move.`;
}

export function getVariantMovesForSquare(
  state: CaptiveChessState,
  square: Square,
  releaseBeforeMove = false,
): VariantMove[] {
  const chess = createChess(state);
  const piece = chess.get(square);

  if (!piece || piece.color !== chess.turn() || chess.isGameOver()) {
    return [];
  }

  return (chess.moves({ square, verbose: true }) as Move[])
    .map((move) => ({
      move,
      releasesCaptive: shouldReleaseForMove(state, move, releaseBeforeMove),
    }))
    .filter(({ move }) =>
      buildMoveState(state, move, {
        releaseBeforeMove,
        includeHistory: false,
      }).ok,
    );
}

export function applyCaptiveMove(
  state: CaptiveChessState,
  request: ApplyMoveRequest,
): ApplyMoveResult {
  const chess = createChess(state);
  const piece = chess.get(request.from);

  if (!piece) {
    return { ok: false, error: "Choose a piece to move." };
  }

  if (piece.color !== chess.turn()) {
    return { ok: false, error: `${colorName(chess.turn())} moves now.` };
  }

  if (chess.isGameOver()) {
    return { ok: false, error: "The game is already over." };
  }

  const matches = (chess.moves({ square: request.from, verbose: true }) as Move[]).filter(
    (move) => move.to === request.to,
  );

  if (matches.length === 0) {
    return { ok: false, error: "That move is not legal." };
  }

  const promotionMoves = matches.filter((move) => move.isPromotion());
  if (promotionMoves.length > 0 && !request.promotion) {
    return {
      ok: false,
      needsPromotion: true,
      promotions: promotionMoves
        .map((move) => move.promotion as PromotionPiece)
        .filter(Boolean),
    };
  }

  const move =
    promotionMoves.length > 0
      ? promotionMoves.find((candidate) => candidate.promotion === request.promotion)
      : matches[0];

  if (!move) {
    return { ok: false, error: "Choose a promotion piece." };
  }

  return buildMoveState(state, move, {
    releaseBeforeMove: Boolean(request.releaseBeforeMove),
    includeHistory: true,
  });
}

export function executeCaptive(
  state: CaptiveChessState,
  carrierSquare: Square,
): ApplyMoveResult {
  const chess = createChess(state);
  const carrier = chess.get(carrierSquare);
  const captive = state.captives[carrierSquare];
  const side = chess.turn();

  if (!carrier || carrier.color !== side) {
    return { ok: false, error: "Choose one of your pieces with a captive." };
  }

  if (!captive) {
    return { ok: false, error: "That piece is not holding a captive." };
  }

  if (chess.isCheck()) {
    return { ok: false, error: "You must answer check before executing a captive." };
  }

  if (chess.isGameOver()) {
    return { ok: false, error: "The game is already over." };
  }

  const nextCaptives = cloneCaptives(state.captives);
  delete nextCaptives[carrierSquare];

  const ply = state.history.length;
  const text = `${colorName(side)} executed the ${pieceLabel(captive).toLowerCase()} held by the ${pieceLabel(
    carrier,
  ).toLowerCase()} on ${carrierSquare}.`;

  return {
    ok: true,
    state: {
      fen: advanceTurnFen(state.fen, side),
      captives: nextCaptives,
      removed: [
        {
          ...clonePiece(captive),
          id: `removed-${ply}`,
          ply,
          reason: text,
        },
        ...state.removed,
      ],
      history: [
        ...state.history,
        {
          id: `history-${ply}`,
          ply,
          side,
          text,
        },
      ],
      marker: {
        from: carrierSquare,
        to: carrierSquare,
      },
    },
  };
}

function buildMoveState(
  state: CaptiveChessState,
  move: Move,
  options: { releaseBeforeMove: boolean; includeHistory: boolean },
): ApplyMoveResult {
  const before = createChess(state);
  const movingPiece = before.get(move.from);

  if (!movingPiece) {
    return { ok: false, error: "Choose a piece to move." };
  }

  const side = movingPiece.color;
  const carrierCaptive = state.captives[move.from];
  const releasesCaptive = shouldReleaseForMove(state, move, options.releaseBeforeMove);
  const capturedCarrierSquare = move.isCapture()
    ? getCapturedCarrierSquare(move)
    : undefined;
  const capturedCarrierCaptive = capturedCarrierSquare
    ? state.captives[capturedCarrierSquare]
    : undefined;
  const castle = getCastleRookSquares(move);
  const rookCaptive = castle ? state.captives[castle.rookFrom] : undefined;
  const nextCaptives = cloneCaptives(state.captives);

  delete nextCaptives[move.from];

  if (capturedCarrierSquare) {
    delete nextCaptives[capturedCarrierSquare];
  }

  if (castle) {
    delete nextCaptives[castle.rookFrom];
  }

  const after = createChess(state);

  try {
    after.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion,
    });
  } catch {
    return { ok: false, error: "That move is not legal." };
  }

  if (carrierCaptive) {
    if (releasesCaptive) {
      if (!after.put(clonePiece(carrierCaptive), move.from)) {
        return {
          ok: false,
          error: `${pieceLabel(carrierCaptive)} cannot be freed on ${move.from}.`,
        };
      }
    } else {
      nextCaptives[move.to] = clonePiece(carrierCaptive);
    }
  }

  if (castle && rookCaptive) {
    nextCaptives[castle.rookTo] = clonePiece(rookCaptive);
  }

  if (move.isCapture() && move.captured) {
    nextCaptives[move.to] = {
      color: opposite(side),
      type: move.captured,
    };
  }

  if (releasesCaptive && isKingAttacked(after, side)) {
    return {
      ok: false,
      error: "Freeing that captive would leave your king in check.",
    };
  }

  const removed = capturedCarrierCaptive
    ? [
        {
          ...clonePiece(capturedCarrierCaptive),
          id: `removed-${state.history.length}`,
          ply: state.history.length,
          reason: `${pieceLabel(capturedCarrierCaptive)} was lost when its carrier was captured on ${capturedCarrierSquare}.`,
        },
        ...state.removed,
      ]
    : state.removed;

  const history = options.includeHistory
    ? [
        ...state.history,
        {
          id: `history-${state.history.length}`,
          ply: state.history.length,
          side,
          san: move.san,
          text: moveHistoryText({
            movingPiece,
            move,
            carrierCaptive,
            releasesCaptive,
            capturedCarrierCaptive,
          }),
        },
      ]
    : state.history;

  return {
    ok: true,
    state: {
      fen: after.fen(),
      captives: nextCaptives,
      removed,
      history,
      marker: {
        from: move.from,
        to: move.to,
        releasedSquare: releasesCaptive ? move.from : undefined,
        capturedCarrierSquare,
        rookFrom: castle?.rookFrom,
        rookTo: castle?.rookTo,
      },
    },
  };
}

function moveHistoryText({
  movingPiece,
  move,
  carrierCaptive,
  releasesCaptive,
  capturedCarrierCaptive,
}: {
  movingPiece: CaptivePiece;
  move: Move;
  carrierCaptive?: CaptivePiece;
  releasesCaptive: boolean;
  capturedCarrierCaptive?: CaptivePiece;
}) {
  const clauses = [
    `${colorName(movingPiece.color)} ${pieceLabel(movingPiece)
      .toLowerCase()
      .replace(`${colorName(movingPiece.color).toLowerCase()} `, "")} ${move.from} to ${
      move.to
    }`,
  ];

  if (move.san) {
    clauses[0] += ` (${move.san})`;
  }

  if (carrierCaptive && releasesCaptive) {
    clauses.push(`freed ${pieceLabel(carrierCaptive).toLowerCase()} on ${move.from}`);
  }

  if (move.isCapture() && move.captured) {
    clauses.push(`caged ${pieceLabel({ color: opposite(movingPiece.color), type: move.captured }).toLowerCase()}`);
  }

  if (capturedCarrierCaptive) {
    clauses.push(`${pieceLabel(capturedCarrierCaptive).toLowerCase()} was lost`);
  }

  return `${clauses.join("; ")}.`;
}

function shouldReleaseForMove(
  state: CaptiveChessState,
  move: Move,
  releaseBeforeMove: boolean,
) {
  return Boolean(state.captives[move.from] && (releaseBeforeMove || move.isCapture()));
}

function getCapturedCarrierSquare(move: Move): Square {
  if (!move.isEnPassant()) {
    return move.to;
  }

  return `${move.to[0]}${move.from[1]}` as Square;
}

function getCastleRookSquares(move: Move):
  | {
      rookFrom: Square;
      rookTo: Square;
    }
  | undefined {
  if (!move.isKingsideCastle() && !move.isQueensideCastle()) return undefined;

  const rank = move.from[1];

  if (move.isKingsideCastle()) {
    return {
      rookFrom: `h${rank}` as Square,
      rookTo: `f${rank}` as Square,
    };
  }

  return {
    rookFrom: `a${rank}` as Square,
    rookTo: `d${rank}` as Square,
  };
}

function isKingAttacked(chess: Chess, color: Color) {
  const kingSquare = chess.findPiece({ color, type: "k" })[0];
  return kingSquare ? chess.isAttacked(kingSquare, opposite(color)) : true;
}

function advanceTurnFen(fen: string, side: Color) {
  const parts = fen.split(" ");
  parts[1] = opposite(side);
  parts[3] = "-";
  parts[4] = "0";

  if (side === "b") {
    parts[5] = String(Number(parts[5]) + 1);
  }

  return parts.join(" ");
}

function clonePiece(piece: CaptivePiece): CaptivePiece {
  return {
    color: piece.color,
    type: piece.type,
  };
}

function cloneCaptives(captives: CaptiveMap): CaptiveMap {
  return Object.fromEntries(
    Object.entries(captives).map(([square, piece]) => [
      square,
      piece ? clonePiece(piece) : undefined,
    ]),
  ) as CaptiveMap;
}
