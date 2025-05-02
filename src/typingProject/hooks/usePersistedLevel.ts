// import { useEffect, useState } from "react";

// export const usePersistedLevel = () => {
//   const [currentLevel, setCurrentLevel] = useState<number>(() => {
//     // Load from localStorage on initial render
//     const stored = localStorage.getItem("userLevel");
//     return stored ? parseInt(stored, 10) : 1; // default to level 1
//   });

//   useEffect(() => {
//     localStorage.setItem("userLevel", currentLevel.toString());
//   }, [currentLevel]);

//   return [currentLevel, setCurrentLevel] as const;
// };
import { useState, useEffect } from "react";

const LEVEL_KEY = "typing-game-level";

export const usePersistedLevel = (): [
  number,
  (level: number | ((prev: number) => number)) => void
] => {
  const getAdjustedLevel = () => {
    const stored = localStorage.getItem(LEVEL_KEY);
    const raw = stored ? parseInt(stored, 10) : 1;
    const adjusted = Math.max(1, raw - 5);
    localStorage.setItem(LEVEL_KEY, adjusted.toString());
    return adjusted;
  };

  const [level, setLevel] = useState<number>(getAdjustedLevel);

  useEffect(() => {
    localStorage.setItem(LEVEL_KEY, level.toString());
  }, [level]);

  return [level, setLevel];
};
