import type { ReactNode } from "react";
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";
import { motion, useTransform } from "motion/react";
import type { MotionValue } from "motion/react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { SceneAnimationSpec, SceneInteractionState } from "../types";
import { getRecordingResult, getWeatherResult, userProfiles, weatherReadings } from "./systemModel";

type Props = { scene: SceneAnimationSpec; progress: MotionValue<number>; interaction: SceneInteractionState };
type DiagramProps = { progress: MotionValue<number>; interaction: SceneInteractionState };

export function SystemDiagram({ scene, progress, interaction }: Props) {
  if (scene.kind === "weather-system") return <WeatherDiagram {...{ scene, progress, interaction }} />;

  return (
    <Box component="svg" viewBox="0 0 600 370" role="img" aria-labelledby={`${scene.id}-title ${scene.id}-desc`} sx={{ width: "100%", height: "auto", fontFamily: "inherit" }}>
      <title id={`${scene.id}-title`}>{scene.title}</title>
      <desc id={`${scene.id}-desc`}>{scene.caption}</desc>
      <rect width="600" height="370" fill="#f5f8f9" rx="4" />
      {scene.kind === "recording-system" ? <RecordingDiagram {...{ progress, interaction }} /> : <BoundaryDiagram {...{ progress, interaction }} />}
    </Box>
  );
}

function RecordingDiagram({ progress, interaction }: DiagramProps) {
  const recording = getRecordingResult(interaction);
  const trace = useTransform(progress, [0.04, 0.55], [0, 1]);
  const detail = useTransform(progress, [0.12, 0.4], [0.15, 1]);
  const saveOpacity = useTransform(progress, [0.32, 0.6], [0.1, 1]);
  const selectedUSB = recording.source === "usb";
  const cableWorks = interaction.microphoneConnected ?? true;

  return (
    <>
      <text x="26" y="32" fontSize="17" fontWeight="800" fill="#007078">A CLASSROOM RECORDING SETUP</text>
      <rect x="220" y="71" width="210" height="252" rx="5" fill="#fff" stroke="#007f86" strokeWidth="2" />
      <text x="325" y="95" textAnchor="middle" fontSize="18" fontWeight="700" fill="#263a40">Chromebook</text>
      <Microphone x={60} y={92} />
      <text x="80" y="179" textAnchor="middle" fontSize="16" fill="#263a40" fontWeight="700">USB mic</text>
      <text x="80" y="203" textAnchor="middle" fontSize="15" fill={cableWorks ? "#007078" : "#a33860"}>{cableWorks ? "connected" : "disconnected"}</text>
      <path d="M 120 133 H 220" stroke={cableWorks ? "#b9c8cb" : "#a33860"} strokeWidth="3" fill="none" strokeDasharray={cableWorks ? undefined : "5 5"} />
      {selectedUSB && cableWorks ? <motion.path data-testid="recording-trace" d="M 120 133 H 220" stroke="#007f86" strokeWidth="4" fill="none" pathLength={trace} /> : null}
      <text x="172" y="119" textAnchor="middle" fontSize="15" fill="#3f4f4b">USB</text>
      <motion.g opacity={detail}>
        <rect x="237" y="108" width="176" height="34" rx="3" fill="#e4eef0" />
        <text x="325" y="130" textAnchor="middle" fontSize="16" fill="#263a40">Operating system</text>
        <rect x="237" y="154" width="176" height="47" rx="3" fill="#e9f3f3" />
        <text x="325" y="176" textAnchor="middle" fontSize="17" fontWeight="700" fill="#007078">Recording app</text>
        <text x="325" y="193" textAnchor="middle" fontSize="13" fill="#3f4f4b">{recording.inputLabel}</text>
        <text x="325" y="228" textAnchor="middle" fontSize="16" fill="#3f4f4b">Working memory</text>
        <path d="M 246 248 h 9 l 6 -10 l 6 20 l 6 -24 l 6 29 l 6 -15 h 15 l 7 -12 l 7 22 l 7 -18 l 7 11 h 22" fill="none" stroke={recording.hasAudio ? "#007f86" : "#b9c8cb"} strokeWidth="3" />
      </motion.g>
      <motion.g opacity={saveOpacity}>
        <rect x="238" y="275" width="174" height="32" rx="3" fill={recording.saved ? "#e8ecf8" : "#f4e8ed"} />
        <text x="325" y="296" textAnchor="middle" fontSize="16" fontWeight="700" fill={recording.saved ? "#365596" : "#8c2e50"}>{recording.saved ? "Saved audio file" : "No saved file"}</text>
      </motion.g>
      <path d="M 430 177 H 475" stroke="#b9c8cb" strokeWidth="3" />
      {recording.hasAudio ? <motion.path d="M 430 177 H 475" stroke="#007f86" strokeWidth="4" pathLength={trace} /> : null}
      <Headphones x={490} y={139} />
      <text x="520" y="240" textAnchor="middle" fontSize="15" fontWeight="700" fill="#263a40">Headphones</text>
      <text x="520" y="262" textAnchor="middle" fontSize="15" fill="#3f4f4b">{recording.hasAudio ? "audio plays" : "no new audio"}</text>
      <circle cx="65" cy="278" r="15" fill="#9a365c" />
      <path d="M 42 318 Q 65 288 88 318" fill="#f4e8ed" stroke="#9a365c" strokeWidth="3" />
      <text x="65" y="343" textAnchor="middle" fontSize="15" fill="#73223f" fontWeight="700">Student</text>
      <path d="M 97 294 H 150 V 177 H 220" stroke="#9a365c" strokeWidth="2" strokeDasharray="5 5" fill="none" />
      <text x="154" y="314" textAnchor="middle" fontSize="13" fill="#73223f">operates</text>
      <text x="154" y="332" textAnchor="middle" fontSize="13" fill="#73223f">the app</text>
      <text x="325" y="350" textAnchor="middle" fontSize="16" fontWeight="700" fill="#007078">Audio data moves through connected parts.</text>
    </>
  );
}

function BoundaryDiagram({ progress, interaction }: DiagramProps) {
  const submitted = interaction.systemPurpose === "submit";
  const local = interaction.systemPurpose === "create";
  const boundaryWidth = useTransform(progress, [0.15, 0.6], [submitted ? 556 : 190, local ? 190 : 556]);
  const trace = useTransform(progress, [0.18, 0.7], [0, 1]);
  const profile = userProfiles[interaction.userProfile ?? "student"];

  return (
    <>
      <text x="24" y="32" fontSize="17" fontWeight="800" fill="#8c2e50">THE QUESTION SETS THE BOUNDARY</text>
      <motion.rect data-testid="system-boundary" x="22" y="62" width={boundaryWidth} height="234" rx="5" fill="#f4e8ed" fillOpacity="0.42" stroke="#9a365c" strokeWidth="2" strokeDasharray="7 5" />
      <Laptop x={40} y={124} />
      <text x="117" y="111" textAnchor="middle" fontSize="16" fontWeight="700" fill="#263a40">Student device</text>
      <text x="117" y="235" textAnchor="middle" fontSize="15" fill="#3f4f4b">Hardware + OS</text>
      <text x="117" y="256" textAnchor="middle" fontSize="15" fill="#3f4f4b">App + display</text>
      <path d="M 205 167 H 257 M 345 167 H 396 M 456 167 H 493" stroke="#b9c8cb" strokeWidth="3" fill="none" />
      {!local ? <motion.path data-testid="boundary-trace" d="M 205 167 H 257 M 345 167 H 396 M 456 167 H 493" stroke="#9a365c" strokeWidth="4" fill="none" pathLength={trace} /> : null}
      <rect x="257" y="144" width="87" height="47" fill="#fff" stroke="#4569ba" strokeWidth="2" rx="4" />
      <circle cx="277" cy="168" r="4" fill="#4569ba" /><circle cx="291" cy="168" r="4" fill="#4569ba" />
      <text x="300" y="223" textAnchor="middle" fontSize="16" fontWeight="700" fill="#365596">Network</text>
      <rect x="396" y="120" width="60" height="89" fill="#fff" stroke="#007f86" strokeWidth="2" rx="4" />
      {[137, 158, 179].map((y) => <rect key={y} x="406" y={y} width="40" height="12" fill="#d0e4e6" rx="2" />)}
      <text x="426" y="238" textAnchor="middle" fontSize="15" fill="#007078" fontWeight="700">Service</text>
      <rect x="493" y="135" width="70" height="59" fill="#263a40" rx="4" />
      <rect x="500" y="142" width="56" height="45" fill="#e8ecf8" rx="2" />
      <path d="M 528 194 V 208 M 507 209 H 549" stroke="#263a40" strokeWidth="4" />
      <text x="528" y="257" textAnchor="middle" fontSize="15" fill="#263a40" fontWeight="700">Teacher</text>
      <text x="300" y="326" textAnchor="middle" fontSize="17" fill="#73223f" fontWeight="700">{profile.label}: equipment for a purpose</text>
      <text x="300" y="351" textAnchor="middle" fontSize="15" fill="#3f4f4b">{profile.needs[0]}</text>
    </>
  );
}

function WeatherDiagram({ scene, progress, interaction }: Props) {
  const weather = getWeatherResult(interaction);
  const trace = useTransform(progress, [0.04, 0.55], [0, 1]);
  const graphOpacity = useTransform(progress, [0.2, 0.52], [0.1, 1]);
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down("md"));
  const statusColor = (failed: boolean) => failed ? "#9a365c" : "#007f86";
  const localStops = ["sensor", "power", "software"].includes(weather.fault);
  const graphData = weatherReadings.map((reading) => ({
    time: reading.time,
    temperature: weather.displayed.find((point) => point.time === reading.time)?.temperature ?? null,
  }));

  return (
    <Box component="figure" sx={{ m: 0 }}>
      <Box component="svg" viewBox="0 0 600 175" role="img" aria-labelledby={`${scene.id}-title ${scene.id}-desc`} sx={{ width: "100%", height: "auto", fontFamily: "inherit" }}>
        <title id={`${scene.id}-title`}>{scene.title}</title>
        <desc id={`${scene.id}-desc`}>{weather.explanation}</desc>
        <rect width="600" height="175" fill="#f5f8f9" rx="4" />
        <ModelNode x={16} width={118} title="Sensor" color={statusColor(weather.fault === "sensor")}><text x="75" y="104" textAnchor="middle" fill="#3f4f4b" fontSize="16">Temperature</text></ModelNode>
        <ModelNode x={175} width={210} title="Recorder" color={statusColor(localStops || weather.fault === "storage")}>
          <text x="280" y="95" textAnchor="middle" fontSize="16" fill="#3f4f4b">Power + software</text>
          <text x="280" y="118" textAnchor="middle" fontSize="15" fill="#3f4f4b">Data {weather.available.length} / Saved {weather.saved.length}</text>
        </ModelNode>
        <ModelNode x={449} width={133} title="Library" color={statusColor(weather.fault === "display")}><text x="516" y="104" textAnchor="middle" fill="#3f4f4b" fontSize="16">Display graph</text></ModelNode>
        <path d="M 134 91 H 175 M 385 91 H 449" fill="none" stroke="#b9c8cb" strokeWidth="3" />
        <motion.path data-testid="weather-trace" d="M 134 91 H 175 M 385 91 H 449" fill="none" stroke={statusColor(localStops || weather.fault === "network")} strokeWidth="4" pathLength={trace} />
        <text x="417" y="152" textAnchor="middle" fontSize="15" fill={statusColor(weather.fault === "network")} fontWeight="700">Network</text>
        <text x="154" y="151" textAnchor="middle" fontSize="15" fill="#3f4f4b">Input</text>
      </Box>
      <motion.div style={{ opacity: graphOpacity }}>
        <Box role="img" aria-label={`Library temperature graph: ${weather.displayed.length} visible readings${weather.fault === "display" ? "; display unavailable" : ""}.`} data-testid="weather-graph" sx={{ pt: 1, bgcolor: "#fff" }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#365596", mb: 0.5 }}>Library / Temperature (Celsius)</Typography>
          {weather.fault === "display" ? (
            <Box sx={{ height: compact ? 112 : 165, display: "grid", placeItems: "center", bgcolor: "#f4e8ed" }}><Typography sx={{ color: "#73223f", fontWeight: 700 }}>Display unavailable</Typography></Box>
          ) : (
            <ResponsiveContainer width="100%" height={compact ? 112 : 165}>
              <LineChart data={graphData} margin={{ top: 8, right: 14, bottom: 4, left: -20 }}>
                <CartesianGrid stroke="#e1e8eb" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} tickLine={false} interval="preserveStartEnd" minTickGap={12} />
                <YAxis domain={[17, 22]} ticks={[18, 20, 22]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Line type="linear" dataKey="temperature" stroke="#4569ba" strokeWidth={3} dot={{ r: 3, fill: "#4569ba" }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Box>
      </motion.div>
    </Box>
  );
}

function ModelNode({ x, width, title, color, children }: { x: number; width: number; title: string; color: string; children: ReactNode }) {
  return <g><rect x={x} y="46" width={width} height="89" rx="4" fill="#fff" stroke={color} strokeWidth="2" /><text x={x + width / 2} y="70" textAnchor="middle" fontSize="18" fill={color} fontWeight="700">{title}</text>{children}</g>;
}

export function Microphone({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x}, ${y})`}><rect x="4" width="32" height="48" rx="16" fill="#d0e4e6" stroke="#007f86" strokeWidth="3" /><path d="M -5 31 V 39 Q -5 60 20 60 Q 45 60 45 39 V 31 M 20 60 V 74 M 4 75 H 36" fill="none" stroke="#007f86" strokeWidth="3" /></g>;
}

export function Headphones({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x}, ${y})`}><path d="M 0 49 V 29 Q 0 -5 30 -5 Q 60 -5 60 29 V 49" fill="none" stroke="#4569ba" strokeWidth="7" /><rect x="-4" y="29" width="17" height="37" rx="5" fill="#4569ba" /><rect x="47" y="29" width="17" height="37" rx="5" fill="#4569ba" /></g>;
}

export function Laptop({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x}, ${y})`}><rect width="155" height="84" rx="4" fill="#263a40" /><rect x="8" y="8" width="139" height="66" fill="#fff" rx="2" /><path d="M 27 27 H 122 M 27 41 H 110 M 27 55 H 88" stroke="#9a365c" strokeWidth="4" /><path d="M -9 87 H 164 L 157 98 H -2 Z" fill="#a9bdc3" /></g>;
}
