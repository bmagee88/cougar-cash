import type { ReactNode } from "react";
import { Box } from "@mui/material";
import { motion, useTransform } from "motion/react";
import type { MotionValue } from "motion/react";
import type { SceneAnimationSpec, SceneInteractionState } from "../types";
import { processingRules, processInput } from "./processingModel";

type Props = { scene: SceneAnimationSpec; progress: MotionValue<number>; interaction: SceneInteractionState };
type DiagramProps = { progress: MotionValue<number>; interaction: SceneInteractionState };

export function ComputingDiagram({ scene, progress, interaction }: Props) {
  return (
    <Box component="figure" sx={{ m: 0 }}>
      <Box component="svg" viewBox="0 0 600 350" role="img" aria-labelledby={`${scene.id}-title ${scene.id}-description`} sx={{ width: "100%", height: "auto", display: "block", fontFamily: "inherit" }}>
        <title id={`${scene.id}-title`}>{scene.title}</title>
        <desc id={`${scene.id}-description`}>{scene.caption}</desc>
        <rect width="600" height="350" fill="#f5f8f9" rx="4" />
        {scene.kind === "input-capture" ? <InputDiagram progress={progress} interaction={interaction} /> : null}
        {scene.kind === "processing-rules" ? <ProcessingDiagram progress={progress} interaction={interaction} /> : null}
        {scene.kind === "output-loop" ? <OutputDiagram progress={progress} interaction={interaction} /> : null}
      </Box>
    </Box>
  );
}

function InputDiagram({ progress, interaction }: DiagramProps) {
  const x = useTransform(progress, [0, 0.7, 1], [153, 419, 419]);
  const packetOpacity = useTransform(progress, [0, 0.12, 0.66, 0.8], [0, 1, 1, 0]);
  const receivedOpacity = useTransform(progress, [0.48, 0.75], [0, 1]);
  const pathLength = useTransform(progress, [0, 0.7], [0, 1]);
  const message = interaction.inputText ?? "A";
  const hasInput = message.length > 0;

  return (
    <>
      <text x="32" y="39" fill="#007078" fontSize="17" fontWeight="800">AN ACTION BECOMES DATA</text>
      <rect x="294" y="66" width="284" height="246" fill="#e8f3f3" stroke="#007f86" strokeWidth="2" strokeDasharray="6 5" rx="4" />
      <text x="436" y="93" textAnchor="middle" fill="#007078" fontSize="17" fontWeight="700">Computing system</text>
      <Keyboard x={32} y={146} />
      <text x="131" y="267" textAnchor="middle" fill="#3f4f4b" fontSize="17" fontWeight="700">Keyboard</text>
      <text x="131" y="291" textAnchor="middle" fill="#3f4f4b" fontSize="15">captures a key press</text>
      <path d="M 230 184 H 350" stroke="#a5c6c9" strokeWidth="4" fill="none" />
      {hasInput ? <motion.path data-testid="input-trace" d="M 230 184 H 350" stroke="#007f86" strokeWidth="4" fill="none" pathLength={pathLength} /> : null}
      <path d="M 338 174 L 350 184 L 338 194" stroke="#007f86" strokeWidth="3" fill="none" />
      <rect x="349" y="122" width="208" height="134" fill="#fff" stroke="#b4ced1" strokeWidth="2" rx="4" />
      <text x="453" y="147" textAnchor="middle" fill="#3f4f4b" fontSize="16" fontWeight="700">Received data</text>
      <motion.g opacity={hasInput ? receivedOpacity : 1}>
        <text data-testid="received-data" x="453" y="203" textAnchor="middle" fill="#007078" fontSize={hasInput ? Math.min(28, 174 / (message.length * 1.05)) : 24} fontWeight="800">{hasInput ? message : "No text yet"}</text>
      </motion.g>
      {hasInput ? (
        <motion.g style={{ x }} opacity={packetOpacity}>
          <rect x="-19" y="166" width="38" height="36" fill="#007f86" rx="4" />
          <text x="0" y="191" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="700">{Array.from(message).slice(-1)[0]}</text>
        </motion.g>
      ) : null}
      <text x="290" y="223" textAnchor="middle" fill="#007078" fontSize="15" fontWeight="700">input</text>
    </>
  );
}

function ProcessingDiagram({ progress, interaction }: DiagramProps) {
  const input = interaction.inputNumber ?? 4;
  const rule = interaction.processingRule ?? "double";
  const processOpacity = useTransform(progress, [0.12, 0.42], [0.25, 1]);
  const resultOpacity = useTransform(progress, [0.45, 0.75], [0, 1]);
  const pathLength = useTransform(progress, [0.05, 0.8], [0, 1]);

  return (
    <>
      <text x="30" y="39" fill="#8c2e50" fontSize="17" fontWeight="800">DATA + INSTRUCTIONS = A RESULT</text>
      <Stage x={20} label="INPUT" color="#007f86"><text x="96" y="191" textAnchor="middle" fill="#007078" fontSize="48" fontWeight="800">{input}</text><text x="96" y="222" textAnchor="middle" fill="#3f4f4b" fontSize="16">number</text></Stage>
      <motion.g opacity={processOpacity}>
        <Stage x={224} label="PROCESS" color="#a33860">
          <ChipIllustration x={264} y={127} />
          <text x="300" y="220" textAnchor="middle" fill="#8c2e50" fontSize="18" fontWeight="700">{processingRules[rule].label}</text>
        </Stage>
      </motion.g>
      <Stage x={428} label="OUTPUT" color="#4569ba">
        <motion.g opacity={resultOpacity}>
          <text data-testid="processing-result" x="504" y="191" textAnchor="middle" fill="#365596" fontSize="48" fontWeight="800">{processInput(input, rule)}</text>
          <text x="504" y="222" textAnchor="middle" fill="#3f4f4b" fontSize="16">result</text>
        </motion.g>
      </Stage>
      <path d="M 172 178 H 224 M 376 178 H 428" fill="none" stroke="#b9c8cb" strokeWidth="4" />
      <motion.path data-testid="processing-trace" d="M 172 178 H 224 M 376 178 H 428" fill="none" stroke="#a33860" strokeWidth="4" pathLength={pathLength} />
      <path d="M 211 168 L 224 178 L 211 188 M 415 168 L 428 178 L 415 188" fill="none" stroke="#a33860" strokeWidth="3" />
      <text x="300" y="285" textAnchor="middle" fill="#3f4f4b" fontSize="17">Instruction: {processingRules[rule].instruction}</text>
      <text x="300" y="315" textAnchor="middle" fill="#687879" fontSize="15">The CPU carries out the program's instruction.</text>
    </>
  );
}

function OutputDiagram({ progress, interaction }: DiagramProps) {
  const destination = interaction.outputDestination ?? "display";
  const outward = useTransform(progress, [0.05, 0.5], [0, 1]);
  const effect = useTransform(progress, [0.32, 0.6], [0.12, 1]);
  const returnPath = useTransform(progress, [0.45, 0.72], [0, 1]);
  const rotation = useTransform(progress, [0.35, 0.85], [0, 180]);
  const label = destination === "display" ? "Visual output" : destination === "speaker" ? "Sound output" : "Physical output";

  return (
    <>
      <text x="30" y="39" fill="#365596" fontSize="17" fontWeight="800">RESULTS TRAVEL OUTWARD</text>
      <rect x="32" y="111" width="180" height="135" fill="#fff" stroke="#b9c8cb" strokeWidth="2" rx="4" />
      <ChipIllustration x={87} y={133} />
      <text x="122" y="229" textAnchor="middle" fill="#3f4f4b" fontSize="17" fontWeight="700">Computer</text>
      <path d="M 212 173 H 354" stroke="#b9c8cb" strokeWidth="4" fill="none" />
      <motion.path data-testid="output-trace" d="M 212 173 H 354" stroke="#4569ba" strokeWidth="4" fill="none" pathLength={outward} />
      <path d="M 341 163 L 354 173 L 341 183" stroke="#4569ba" strokeWidth="3" fill="none" />
      <text x="283" y="150" textAnchor="middle" fill="#365596" fontSize="16" fontWeight="700">output signal</text>
      {destination === "display" ? (
        <>
          <rect x="356" y="83" width="188" height="172" fill="#263a40" rx="10" />
          <rect x="367" y="95" width="166" height="144" fill="#e9effb" rx="3" />
          <motion.g opacity={effect}>
            <text x="450" y="130" textAnchor="middle" fill="#365596" fontSize="16" fontWeight="700">Result ready</text>
            <rect x="403" y="153" width="94" height="44" fill="#4569ba" rx="4" />
            <text x="450" y="181" textAnchor="middle" fill="#fff" fontSize="19" fontWeight="700">Play</text>
          </motion.g>
          <motion.circle cx="488" cy="191" r="15" fill="#007f86" fillOpacity="0.18" stroke="#007f86" strokeWidth="2" opacity={returnPath} />
        </>
      ) : destination === "speaker" ? (
        <>
          <rect x="358" y="115" width="57" height="111" fill="#4569ba" rx="4" />
          <path d="M 392 130 L 451 98 V 244 L 392 211 Z" fill="#e0e8f8" stroke="#4569ba" strokeWidth="3" />
          <motion.g opacity={effect}>
            <path d="M 469 135 Q 501 173 469 211 M 488 113 Q 538 173 488 233" stroke="#4569ba" strokeWidth="5" fill="none" />
          </motion.g>
        </>
      ) : (
        <>
          <rect x="357" y="133" width="109" height="82" fill="#e0e8f8" stroke="#4569ba" strokeWidth="3" rx="8" />
          <text x="411" y="182" textAnchor="middle" fill="#365596" fontSize="18" fontWeight="700">Motor</text>
          <path d="M 466 174 H 514" stroke="#4569ba" strokeWidth="9" />
          <motion.g style={{ rotate: rotation, transformOrigin: "514px 174px" }}>
            <rect x="508" y="129" width="12" height="90" rx="4" fill="#a33860" />
            <circle cx="514" cy="174" r="11" fill="#365596" />
          </motion.g>
        </>
      )}
      <text x="450" y="279" textAnchor="middle" fill="#365596" fontSize="17" fontWeight="700">{label}</text>
      {destination === "display" ? (
        <>
          <motion.path data-testid="next-input-trace" d="M 450 289 V 307 H 122 V 252" fill="none" stroke="#007f86" strokeWidth="3" strokeDasharray="6 5" opacity={returnPath} />
          <motion.g opacity={returnPath}>
            <path d="M 112 264 L 122 252 L 132 264" fill="none" stroke="#007f86" strokeWidth="3" />
            <text x="290" y="337" textAnchor="middle" fill="#007078" fontSize="15" fontWeight="700">The touchscreen detects a tap: the next input.</text>
          </motion.g>
        </>
      ) : (
        <text x="300" y="330" textAnchor="middle" fill="#3f4f4b" fontSize="15">{destination === "speaker" ? "The speaker produces sound as output." : "The motor produces movement as output."}</text>
      )}
    </>
  );
}

function Stage({ x, label, color, children }: { x: number; label: string; color: string; children: ReactNode }) {
  return <g><rect x={x} y="85" width="152" height="162" fill="#fff" stroke={color} strokeWidth="2" rx="4" /><text x={x + 76} y="69" textAnchor="middle" fill={color} fontSize="17" fontWeight="800">{label}</text>{children}</g>;
}

export function ChipIllustration({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      {[12, 28, 44, 60].map((offset) => <path key={offset} d={`M ${offset} -8 V 0 M ${offset} 72 V 80 M -8 ${offset} H 0 M 72 ${offset} H 80`} stroke="#a33860" strokeWidth="3" />)}
      <rect width="72" height="72" fill="#f4e8ed" stroke="#a33860" strokeWidth="3" rx="4" />
      <rect x="12" y="12" width="48" height="48" fill="#a33860" rx="3" />
      <text x="36" y="43" textAnchor="middle" fill="#fff" fontSize="15" fontWeight="800">CPU</text>
    </g>
  );
}

export function Keyboard({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect width="198" height="86" fill="#fff" stroke="#007f86" strokeWidth="2" rx="5" />
      {[0, 1, 2].map((row) => [0, 1, 2, 3, 4, 5].map((col) => <rect key={`${row}-${col}`} x={12 + col * 30} y={10 + row * 21} width="23" height="15" rx="2" fill={row === 1 && col === 0 ? "#007f86" : "#d0e4e6"} />))}
      <rect x="53" y="72" width="95" height="6" rx="2" fill="#d0e4e6" />
    </g>
  );
}
