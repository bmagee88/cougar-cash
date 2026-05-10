import React from "react";
import { Box } from "@mui/material";
import type { Trait } from "./types";

export function getTraitSx(trait: Trait) {
  if (trait === "proficient") return { color: "success.main", fontWeight: 800 };
  if (trait === "struggle") return { color: "error.main", fontWeight: 800 };
  if (trait === "aceInTheHole") return { color: "info.main", fontWeight: 800 };
  if (trait === "weakness") return { color: "error.dark", fontWeight: 800 };
  return { color: "text.primary" };
}

export function StyledBattleText({ text }: { text: string }) {
  const parts = text.split(/(Super Effective|Not Effective|Effective)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (part === "Super Effective") return <Box key={index} component="span" sx={{ fontWeight: 900 }}>{part}</Box>;
        if (part === "Not Effective") return <Box key={index} component="span" sx={{ fontStyle: "italic" }}>{part}</Box>;
        if (part === "Effective") return <Box key={index} component="span" sx={{ textDecoration: "underline" }}>{part}</Box>;
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </>
  );
}
