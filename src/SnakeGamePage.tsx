
// SnakeGame.tsx
import React, { useState, useEffect, useRef } from "react";

type Coord = { x: number; y: number };
type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

const gridSize = 20;

const getRandomCoord = (): Coord => ({
  x: Math.floor(Math.random() * gridSize),
  y: Math.floor(Math.random() * gridSize),
});

const SnakeGamePage: React.FC = () => {
  const [snake, setSnake] = useState<Coord[]>([{ x: 10, y: 10 }]);
  const [direction] = useState<Direction>("RIGHT");
  const [food, setFood] = useState<Coord>(getRandomCoord);
  const [gameOver, setGameOver] = useState(false);
  const moveRef = useRef(direction);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const newDir =
        e.key === "ArrowUp"
          ? "UP"
          : e.key === "ArrowDown"
          ? "DOWN"
          : e.key === "ArrowLeft"
          ? "LEFT"
          : e.key === "ArrowRight"
          ? "RIGHT"
          : null;

      if (
        newDir &&
        !(
          (moveRef.current === "UP" && newDir === "DOWN") ||
          (moveRef.current === "DOWN" && newDir === "UP") ||
          (moveRef.current === "LEFT" && newDir === "RIGHT") ||
          (moveRef.current === "RIGHT" && newDir === "LEFT")
        )
      ) {
        moveRef.current = newDir;
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const newSnake = [...snake];
      const head = { ...newSnake[0] };

      switch (moveRef.current) {
        case "UP":
          head.y -= 1;
          break;
        case "DOWN":
          head.y += 1;
          break;
        case "LEFT":
          head.x -= 1;
          break;
        case "RIGHT":
          head.x += 1;
          break;
      }

      // Game over conditions
      if (
        head.x < 0 ||
        head.y < 0 ||
        head.x >= gridSize ||
        head.y >= gridSize ||
        newSnake.some(segment => segment.x === head.x && segment.y === head.y)
      ) {
        setGameOver(true);
        clearInterval(interval);
        return;
      }

      newSnake.unshift(head);

      if (head.x === food.x && head.y === food.y) {
        setFood(getRandomCoord());
      } else {
        newSnake.pop();
      }

      setSnake(newSnake);
    }, 150);

    return () => clearInterval(interval);
  }, [snake, food]);

  return (
    <div>
      <h2>Snake Game</h2>
      {gameOver && <h3>Game Over!</h3>}
      <div
        style={{
          display: "grid",
          gridTemplateRows: `repeat(${gridSize}, 20px)`,
          gridTemplateColumns: `repeat(${gridSize}, 20px)`,
          gap: "1px",
          background: "#333",
        }}
      >
        {Array.from({ length: gridSize * gridSize }).map((_, i) => {
          const x = i % gridSize;
          const y = Math.floor(i / gridSize);
          const isSnake = snake.some(segment => segment.x === x && segment.y === y);
          const isFood = food.x === x && food.y === y;

          return (
            <div
              key={i}
              style={{
                width: "20px",
                height: "20px",
                backgroundColor: isSnake ? "limegreen" : isFood ? "red" : "black",
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

export default SnakeGamePage;
