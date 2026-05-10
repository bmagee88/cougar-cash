import { useEffect, useState } from "react";
import { Paper, Typography } from "@mui/material";
import type { BattleMessage } from "../types";
import { StyledBattleText } from "../uiHelpers";
import { RollBandBar } from "./RollBandBar";

export function BattleTextBox({ messages, onAdvance, devMode }: { messages: BattleMessage[]; onAdvance: () => void; devMode: boolean }) {
  const [visibleText, setVisibleText] = useState("");
  const currentMessage = messages[0];
  const currentText = currentMessage?.text ?? "";

  useEffect(() => {
    setVisibleText("");
    if (!currentText) return;
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setVisibleText(currentText.slice(0, index));
      if (index >= currentText.length) window.clearInterval(timer);
    }, 1);
    return () => window.clearInterval(timer);
  }, [currentText]);

  if (!currentMessage) return null;
  const isFinishedTyping = visibleText.length >= currentText.length;

  return (
    <Paper
      onClick={() => {
        if (isFinishedTyping) onAdvance();
        else setVisibleText(currentText);
      }}
      sx={{ p: 2, borderRadius: 3, border: "3px solid", borderColor: "text.primary", cursor: "pointer", bgcolor: "background.paper", boxShadow: 6 }}
    >
      <Typography variant="body1" fontWeight={700} sx={{ minHeight: 56 }}><StyledBattleText text={visibleText} /></Typography>
      {devMode && isFinishedTyping && currentMessage.rollBar && <RollBandBar data={currentMessage.rollBar} />}
      <Typography variant="caption" color="text.secondary">{isFinishedTyping ? "Click for next" : "Click to finish text"}</Typography>
    </Paper>
  );
}
