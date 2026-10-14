import { Box, Stack, Typography } from "@mui/material";
import type { MotionValue } from "motion/react";
import { motion, useTransform } from "motion/react";
import type { SceneAnimationSpec, SceneInteractionState } from "../types";
import { ComputingDiagram } from "../input-process-output/ComputingDiagram";
import { SystemDiagram } from "../complete-systems/SystemDiagram";

type AnimatedDiagramProps = {
  scene: SceneAnimationSpec;
  progress: MotionValue<number>;
  activeStepIndex: number;
  interaction: SceneInteractionState;
};

export function AnimatedDiagram({
  scene,
  progress,
  activeStepIndex,
  interaction,
}: AnimatedDiagramProps) {
  if (scene.kind === "recording-system" || scene.kind === "system-boundary" || scene.kind === "weather-system") {
    return <SystemDiagram scene={scene} progress={progress} interaction={interaction} />;
  }
  if (scene.kind === "input-capture" || scene.kind === "processing-rules" || scene.kind === "output-loop") {
    return <ComputingDiagram scene={scene} progress={progress} interaction={interaction} />;
  }
  if (scene.kind === "inclined-plane") {
    return (
      <RampDiagram
        progress={progress}
        activeStepIndex={activeStepIndex}
        interaction={interaction}
      />
    );
  }

  if (scene.kind === "lever") {
    return (
      <LeverDiagram
        progress={progress}
        activeStepIndex={activeStepIndex}
        interaction={interaction}
      />
    );
  }

  return <WorkTradeoffDiagram progress={progress} activeStepIndex={activeStepIndex} />;
}

function WorkTradeoffDiagram({
  progress,
  activeStepIndex,
}: {
  progress: MotionValue<number>;
  activeStepIndex: number;
}) {
  const pathLength = useTransform(progress, [0, 1], [80, 285]);
  const crateX = useTransform(progress, [0, 1], [98, 330]);
  const forceHeight = useTransform(progress, [0, 1], [118, 54]);
  const forceY = useTransform(progress, [0, 1], [142, 204]);
  const machinePathOpacity = useTransform(progress, [0.16, 0.42], [0, 1]);
  const distanceGlow = useTransform(progress, [0.2, 1], [0.2, 1]);
  const workMeter = useTransform(progress, [0, 1], [72, 72]);

  return (
    <Stack spacing={2}>
      <DiagramHeader
        title="Force x distance = work"
        detail={
          activeStepIndex === 0
            ? "Start with the hard version of the job."
            : activeStepIndex === 1
              ? "The force shrinks as the path stretches."
              : "The tradeoff keeps the work visible."
        }
      />
      <Box component="svg" viewBox="0 0 520 330" role="img" aria-label="Animated work tradeoff diagram">
        <rect x="0" y="0" width="520" height="330" rx="18" fill="#f8fafc" />
        <line x1="56" y1="250" x2="470" y2="250" stroke="#cbd5e1" strokeWidth="3" />
        <motion.path
          d="M108 238 C176 204 248 194 390 144"
          fill="none"
          stroke="#0f766e"
          strokeWidth="8"
          strokeLinecap="round"
          pathLength={machinePathOpacity}
          opacity={machinePathOpacity}
        />
        <motion.line
          x1="108"
          y1="274"
          x2={pathLength}
          y2="274"
          stroke="#2563eb"
          strokeWidth="7"
          strokeLinecap="round"
          opacity={distanceGlow}
        />
        <text x="58" y="294" fill="#334155" fontSize="16" fontWeight="700">
          distance
        </text>
        <motion.g style={{ x: crateX }}>
          <rect x="0" y="206" width="70" height="44" rx="7" fill="#f59e0b" />
          <rect x="9" y="214" width="52" height="10" rx="3" fill="#fbbf24" />
          <text x="18" y="237" fill="#78350f" fontSize="13" fontWeight="800">
            load
          </text>
        </motion.g>
        <motion.line
          x1="84"
          y1={forceY}
          x2="84"
          y2={forceHeight}
          stroke="#dc2626"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <motion.polygon
          points="84,92 68,124 100,124"
          fill="#dc2626"
          style={{ y: useTransform(progress, [0, 1], [0, 62]) }}
        />
        <text x="34" y="83" fill="#991b1b" fontSize="16" fontWeight="800">
          force
        </text>
        <rect x="316" y="36" width="132" height="30" rx="15" fill="#e0f2fe" />
        <motion.rect x="324" y="44" width={workMeter} height="14" rx="7" fill="#0284c7" />
        <text x="322" y="88" fill="#334155" fontSize="15" fontWeight="700">
          work meter stays visible
        </text>
        <EquationLabel x={86} y={36} progress={progress} />
      </Box>
    </Stack>
  );
}

function RampDiagram({
  progress,
  activeStepIndex,
  interaction,
}: {
  progress: MotionValue<number>;
  activeStepIndex: number;
  interaction: SceneInteractionState;
}) {
  const rampRun = interaction.rampRun ?? 270;
  const rampStartX = 94;
  const rampStartY = 254;
  const rampHeight = 146;
  const rampEndX = rampStartX + rampRun;
  const rampEndY = rampStartY - rampHeight;
  const crateX = useTransform(progress, (latest) => rampStartX + rampRun * clamp(latest));
  const crateY = useTransform(progress, (latest) => rampStartY - rampHeight * clamp(latest));
  const travelPath = useTransform(progress, [0, 1], [0.12, 1]);
  const effortLength = Math.round(122 - (rampRun - 190) * 0.25);
  const slopeLabel = rampRun > 300 ? "gentler slope" : rampRun < 240 ? "steeper slope" : "moderate slope";

  return (
    <Stack spacing={2}>
      <DiagramHeader
        title="Inclined plane"
        detail={
          activeStepIndex === 2
            ? `${slopeLabel}: effort index ${Math.round(100 - (rampRun - 190) * 0.18)}`
            : "Same height, longer path."
        }
      />
      <Box component="svg" viewBox="0 0 520 330" role="img" aria-label="Animated inclined plane diagram">
        <rect x="0" y="0" width="520" height="330" rx="18" fill="#f8fafc" />
        <line x1="68" y1={rampStartY} x2="462" y2={rampStartY} stroke="#cbd5e1" strokeWidth="3" />
        <line x1={rampEndX} y1={rampStartY} x2={rampEndX} y2={rampEndY} stroke="#94a3b8" strokeWidth="3" strokeDasharray="7 7" />
        <text x={rampEndX + 10} y={(rampStartY + rampEndY) / 2} fill="#475569" fontSize="15" fontWeight="800">
          height
        </text>
        <polygon
          points={`${rampStartX},${rampStartY} ${rampEndX},${rampEndY} ${rampEndX},${rampStartY}`}
          fill="#dbeafe"
          stroke="#2563eb"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <motion.line
          x1={rampStartX}
          y1={rampStartY - 10}
          x2={rampEndX}
          y2={rampEndY - 10}
          stroke="#0f766e"
          strokeWidth="7"
          strokeLinecap="round"
          pathLength={travelPath}
        />
        <motion.g style={{ x: crateX, y: crateY }}>
          <rect x="-30" y="-44" width="64" height="42" rx="7" fill="#f59e0b" />
          <rect x="-21" y="-36" width="46" height="9" rx="3" fill="#fbbf24" />
        </motion.g>
        <line x1="88" y1="70" x2={88 + effortLength} y2="70" stroke="#dc2626" strokeWidth="9" strokeLinecap="round" />
        <polygon points={`${94 + effortLength},70 ${72 + effortLength},55 ${72 + effortLength},85`} fill="#dc2626" />
        <text x="86" y="50" fill="#991b1b" fontSize="16" fontWeight="800">
          effort force
        </text>
        <text x="98" y="294" fill="#334155" fontSize="16" fontWeight="800">
          travel distance increases along the ramp
        </text>
      </Box>
    </Stack>
  );
}

function LeverDiagram({
  progress,
  activeStepIndex,
  interaction,
}: {
  progress: MotionValue<number>;
  activeStepIndex: number;
  interaction: SceneInteractionState;
}) {
  const choice = interaction.fulcrumPosition ?? "near-load";
  const chosenFulcrumX = choice === "near-effort" ? 190 : choice === "middle" ? 270 : 350;
  const scrollFulcrumX = useTransform(progress, [0, 1], [190, chosenFulcrumX]);
  const effortArrow = choice === "near-load" ? 58 : choice === "middle" ? 86 : 118;
  const effortText = choice === "near-load" ? "small effort" : choice === "middle" ? "medium effort" : "large effort";
  const boardRotation = useTransform(progress, [0, 1], [-3, 2]);

  return (
    <Stack spacing={2}>
      <DiagramHeader
        title="Lever and fulcrum"
        detail={
          activeStepIndex === 0
            ? "The board pivots at the fulcrum."
            : `${effortText} with this setup.`
        }
      />
      <Box component="svg" viewBox="0 0 520 330" role="img" aria-label="Animated lever diagram">
        <rect x="0" y="0" width="520" height="330" rx="18" fill="#f8fafc" />
        <line x1="56" y1="250" x2="464" y2="250" stroke="#cbd5e1" strokeWidth="3" />
        <motion.g style={{ rotate: boardRotation, transformOrigin: "270px 190px" }}>
          <rect x="94" y="178" width="350" height="24" rx="12" fill="#92400e" />
          <rect x="104" y="182" width="330" height="7" rx="4" fill="#d97706" opacity="0.85" />
          <rect x="382" y="128" width="56" height="50" rx="8" fill="#475569" />
          <text x="391" y="158" fill="#f8fafc" fontSize="13" fontWeight="800">
            load
          </text>
          <line x1="120" y1="102" x2="120" y2={102 + effortArrow} stroke="#dc2626" strokeWidth="9" strokeLinecap="round" />
          <polygon points={`${120},${106 + effortArrow} ${105},${82 + effortArrow} ${135},${82 + effortArrow}`} fill="#dc2626" />
          <text x="82" y="88" fill="#991b1b" fontSize="16" fontWeight="800">
            effort
          </text>
        </motion.g>
        <motion.g style={{ x: scrollFulcrumX }}>
          <polygon points="-28,250 28,250 0,196" fill="#f59e0b" stroke="#b45309" strokeWidth="4" />
          <text x="-29" y="278" fill="#78350f" fontSize="14" fontWeight="800">
            fulcrum
          </text>
        </motion.g>
        <path d="M156 132 C222 64 330 70 390 132" fill="none" stroke="#0f766e" strokeWidth="4" strokeDasharray="8 8" />
        <text x="168" y="58" fill="#0f766e" fontSize="15" fontWeight="800">
          longer effort arm = less force
        </text>
      </Box>
    </Stack>
  );
}

function DiagramHeader({ title, detail }: { title: string; detail: string }) {
  return (
    <Stack spacing={0.5}>
      <Typography
        component="h3"
        sx={{
          color: "#172121",
          fontSize: { xs: 22, md: 26 },
          lineHeight: 1.1,
          fontWeight: 900,
          letterSpacing: 0,
        }}
      >
        {title}
      </Typography>
      <Typography variant="body2" sx={{ color: "#52635f" }}>
        {detail}
      </Typography>
    </Stack>
  );
}

function EquationLabel({
  x,
  y,
  progress,
}: {
  x: number;
  y: number;
  progress: MotionValue<number>;
}) {
  const forceOpacity = useTransform(progress, [0, 0.45, 1], [1, 0.7, 0.48]);
  const distanceOpacity = useTransform(progress, [0, 0.45, 1], [0.45, 0.8, 1]);

  return (
    <g>
      <motion.text x={x} y={y} fill="#0f766e" fontSize="19" fontWeight="900" opacity={forceOpacity}>
        force
      </motion.text>
      <text x={x + 66} y={y} fill="#334155" fontSize="19" fontWeight="900">
        x
      </text>
      <motion.text x={x + 92} y={y} fill="#2563eb" fontSize="19" fontWeight="900" opacity={distanceOpacity}>
        distance
      </motion.text>
      <text x={x + 196} y={y} fill="#334155" fontSize="19" fontWeight="900">
        = work
      </text>
    </g>
  );
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}
