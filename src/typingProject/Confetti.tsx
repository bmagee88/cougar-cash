import React, { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";

// Decelerating animation for fast-to-slow movement
const riseLeft = keyframes`
  0% {
    transform: translate(0, 0) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translate(var(--x), var(--y)) rotate(720deg);
    opacity: 0;
  }
`;

const riseRight = keyframes`
  0% {
    transform: translate(0, 0) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translate(var(--x), var(--y)) rotate(720deg);
    opacity: 0;
  }
`;

const ConfettiPiece = styled.div<{
  $bottom: number;
  $delay: number;
  $rotation: number;
  $color: string;
  $side: "left" | "right";
  $size: number;
  $x: number;
  $y: number;
}>`
  position: fixed;
  bottom: ${({ $bottom }) => $bottom}%;
  ${({ $side }) => $side}: 0;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  background-color: ${({ $color }) => $color};
  animation: ${({ $side }) => ($side === "left" ? riseLeft : riseRight)} 3s ease-out
    ${({ $delay }) => $delay}s forwards;
  transform: rotate(${({ $rotation }) => $rotation}deg);
  pointer-events: none;
  z-index: 9999;

  --x: ${({ $side, $x }) => ($side === "left" ? $x : -$x)}vw;
  --y: ${({ $y }) => -$y}vh;
`;

const colors = ["#FFC107", "#E91E63", "#4CAF50", "#2196F3", "#FF5722"];

const Confetti: React.FC<{ count?: number }> = ({ count = 60 }) => {
  const [pieces, setPieces] = useState<any[]>([]);

  useEffect(() => {
    const confettiData = Array.from({ length: count }).map(() => ({
      id: Math.random().toString(36).substring(2),
      bottom: Math.random() * 30,
      delay: Math.random() * 1.5,
      rotation: Math.random() * 360,
      color: colors[Math.floor(Math.random() * colors.length)],
      side: Math.random() < 0.5 ? "left" : "right",
      size: 6 + Math.random() * 8, // 6px to 14px
      x: 20 + Math.random() * 60, // Horizontal travel (20-80vw)
      y: 40 + Math.random() * 40, // Vertical travel (40-80vh)
    }));
    setPieces(confettiData);

    const timer = setTimeout(() => setPieces([]), 4000);
    return () => clearTimeout(timer);
  }, [count]);

  return (
    <>
      {pieces.map(({ id, bottom, delay, rotation, color, side, size, x, y }) => (
        <ConfettiPiece
          key={id}
          $bottom={bottom}
          $delay={delay}
          $rotation={rotation}
          $color={color}
          $side={side}
          $size={size}
          $x={x}
          $y={y}
        />
      ))}
    </>
  );
};

export default Confetti;
