import { useState } from "react";

const HIGHSCORE_KEY = "typing-game-highscore";

export const usePersistedHighscore = (): [string, (score: string) => void] => {
  const [highscore, setHighscoreState] = useState(() => {
    return localStorage.getItem(HIGHSCORE_KEY) || "1.0";
  });

  const setHighscore = (score: string) => {
    localStorage.setItem(HIGHSCORE_KEY, score);
    setHighscoreState(score);
  };

  return [highscore, setHighscore];
};
