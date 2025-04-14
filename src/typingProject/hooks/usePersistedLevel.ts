import { useEffect, useState } from "react";

export const usePersistedLevel = () => {
  const [currentLevel, setCurrentLevel] = useState<number>(() => {
    // Load from localStorage on initial render
    const stored = localStorage.getItem("userLevel");
    return stored ? parseInt(stored, 10) : 1; // default to level 1
  });

  useEffect(() => {
    localStorage.setItem("userLevel", currentLevel.toString());
  }, [currentLevel]);

  return [currentLevel, setCurrentLevel] as const;
};
