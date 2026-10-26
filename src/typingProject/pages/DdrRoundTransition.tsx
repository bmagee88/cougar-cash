import React from "react";
import { Box, Button, Modal, Typography } from "@mui/material";
import { keyframes } from "@emotion/react";

export type FinishPhase = "celebrate" | "fadeGame" | "fadeFinished" | "motivate" | "motivateFade" | "3" | "2" | "1";
export type RecordSaveStatus = "saving" | "saved" | "failed";

export const FINISH_SEQUENCE: { at: number; phase: FinishPhase }[] = [
  { at: 1400, phase: "fadeGame" },
  { at: 1900, phase: "fadeFinished" },
  { at: 2250, phase: "motivate" },
  { at: 5250, phase: "motivateFade" },
  { at: 5500, phase: "3" },
  { at: 6150, phase: "2" },
  { at: 6800, phase: "1" },
];
export const FINISH_RESTART_MS = 7450;

const arrive = keyframes`
  from { opacity: 0; transform: translate(-50%, -46%) scale(0.88); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
`;
const burst = keyframes`
  0% { opacity: 0; transform: translate(0, 0) scale(0); }
  15% { opacity: 1; }
  100% { opacity: 0; transform: translate(var(--burst-x), var(--burst-y)) rotate(220deg) scale(0.6); }
`;
const savedGlow = keyframes`
  0%, 100% { box-shadow: 0 0 22px #facc1533; }
  50% { box-shadow: 0 0 44px #facc1566, inset 0 0 18px #facc151a; }
`;
const countIn = keyframes`
  from { opacity: 0; transform: scale(1.3); }
  25%, 75% { opacity: 1; transform: scale(1); }
  to { opacity: 0; transform: scale(0.85); }
`;
const messageIn = keyframes`
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
`;
const reducedMotion = {
  "@media (prefers-reduced-motion: reduce)": {
    "& *": { animation: "none !important", transition: "none !important" },
  },
};

type Props = {
  phase: FinishPhase | null;
  saveStatus: RecordSaveStatus;
  result: "lost" | "complete" | null;
  score: number;
  stats: string[][];
  onMenu: () => void;
};

export default function DdrRoundTransition({ phase, saveStatus, result, score, stats, onMenu }: Props) {
  const showFinished = phase === null || phase === "celebrate" || phase === "fadeGame" || phase === "fadeFinished";
  const showMessage = phase === "motivate" || phase === "motivateFade";
  const count = phase === "3" || phase === "2" || phase === "1" ? phase : null;

  return (
    <Box sx={{ position: "absolute", inset: 0, zIndex: 5, pointerEvents: "none", ...reducedMotion }}>
      {showFinished && (
        <>
          <Box aria-hidden sx={{ position: "absolute", inset: 0, overflow: "hidden" }}>
            {Array.from({ length: 24 }, (_, index) => {
              const angle = (index / 24) * Math.PI * 2;
              return (
                <Box key={index} sx={{
                  position: "absolute", left: "50%", top: "38%", width: 7, height: index % 2 ? 14 : 7,
                  bgcolor: ["#facc15", "#38d9a9", "#7dd3fc", "#ec4899"][index % 4],
                  borderRadius: index % 2 ? 0.5 : "50%",
                  "--burst-x": `${Math.cos(angle) * (180 + (index % 3) * 45)}px`,
                  "--burst-y": `${Math.sin(angle) * 220 + 70}px`,
                  animation: `${burst} 1250ms ${index % 3 * 60}ms ease-out both`,
                }} />
              );
            })}
          </Box>
          <Box role="dialog" aria-label="Round finished" aria-describedby="ddr-record-status" sx={{
            position: "absolute", left: "50%", top: "48%", transform: "translate(-50%, -50%)",
            width: "min(560px, calc(100vw - 32px))", boxSizing: "border-box", maxHeight: "80vh", overflowY: "auto",
            px: { xs: 2.5, sm: 3.5 }, py: { xs: 2.5, sm: 3 }, borderRadius: 2,
            border: "1px solid #facc1555", bgcolor: "rgba(5,7,13,0.96)",
            boxShadow: "0 24px 80px #0009, 0 0 65px #38d9a91a", textAlign: "center", pointerEvents: "auto",
            animation: `${arrive} 420ms ease-out`, opacity: phase === "fadeFinished" ? 0 : 1,
            transition: "opacity 350ms ease", color: "#f8fafc",
          }}>
            <Typography component="h2" sx={{ m: 0, fontWeight: 950, fontSize: { xs: 40, sm: 54 }, letterSpacing: "-0.04em" }}>
              Finished!
            </Typography>
            <Box id="ddr-record-status" role="status" sx={{
              mt: 1, mb: 1.5, py: 1, px: 1.5, borderRadius: 1,
              border: "2px solid #facc15", bgcolor: "#facc1514", color: "#fde047",
              animation: `${savedGlow} 900ms ease-in-out 2`, fontSize: { xs: 24, sm: 32 }, fontWeight: 950,
            }}>
              {saveStatus === "saved" ? "Record Saved!" : saveStatus === "failed" ? "Record could not be saved" : "Saving record…"}
            </Box>
            <Typography sx={{ color: "#94a3b8", fontWeight: 850, fontSize: "0.86rem" }}>
              {result === "complete" ? "time complete" : "hearts empty"}
            </Typography>
            <Typography sx={{ mt: 1.5, fontWeight: 950, fontSize: { xs: 36, sm: 48 }, lineHeight: 1 }}>{score.toLocaleString()}</Typography>
            <Typography sx={{ color: "#94a3b8", fontWeight: 850, fontSize: "0.78rem" }}>score</Typography>
            <Box sx={{ mt: 1.5, display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" }, gap: 0.75 }}>
              {stats.map(([label, value]) => (
                <Box key={label} sx={{ p: 0.75, borderRadius: 1, bgcolor: "#ffffff0b", border: "1px solid #ffffff12", minWidth: 0 }}>
                  <Typography sx={{ color: "#94a3b8", fontSize: "0.68rem", fontWeight: 850 }}>{label}</Typography>
                  <Typography sx={{ color: "#e2e8f0", fontSize: "0.82rem", fontWeight: 950, overflowWrap: "anywhere" }}>{value}</Typography>
                </Box>
              ))}
            </Box>
            <Typography sx={{ mt: 1.5, color: "#cbd5e1", fontWeight: 800, fontSize: "0.78rem" }}>Press [Tab] or (r)estart.</Typography>
            <Button size="small" onClick={onMenu} sx={{ mt: 0.5, color: "#94a3b8" }}>Menu (M)</Button>
          </Box>
        </>
      )}
      <Modal open={showMessage || count !== null} onClose={onMenu} aria-label="Next round countdown" sx={{ ...reducedMotion, color: "#f8fafc" }}
        slotProps={{ backdrop: { sx: { bgcolor: "rgba(5,7,13,0.97)" } } }}>
        <Box sx={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", textAlign: "center", width: "min(600px, calc(100vw - 32px))", outline: "none" }}>
          <Box sx={{ minHeight: { xs: 200, sm: 240 }, display: "grid", placeItems: "center" }}>
            {showMessage && (
              <Box sx={{ animation: `${messageIn} 250ms ease-out`, opacity: phase === "motivateFade" ? 0 : 1, transition: "opacity 250ms ease" }}>
                <Typography sx={{ color: "#38d9a9", textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 900, fontSize: 12, mb: 2 }}>Keep your rhythm</Typography>
                <Typography component="h2" sx={{ m: 0, fontSize: { xs: 34, sm: 52 }, lineHeight: 1.1, fontWeight: 950, letterSpacing: "-0.035em" }}>But don’t stop now…</Typography>
              </Box>
            )}
            {count && <Typography key={count} role="status" aria-label={`Starting in ${count}`} sx={{ fontSize: { xs: 140, sm: 190 }, fontWeight: 950, lineHeight: 1, color: "#7dd3fc", textShadow: "0 0 60px #38bdf844", animation: `${countIn} 650ms ease-out both` }}>{count}</Typography>}
          </Box>
          <Button onClick={onMenu} sx={{ mt: 3, color: "#94a3b8", pointerEvents: "auto" }}>Menu (M)</Button>
        </Box>
      </Modal>
    </Box>
  );
}
