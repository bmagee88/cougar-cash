import type { SceneInteractionState, UserProfile, WeatherFault } from "../types";

export const userProfiles: Record<UserProfile, { label: string; needs: string[] }> = {
  student: { label: "Student", needs: ["Low weight between classrooms", "Long battery life", "Accessible controls"] },
  photographer: { label: "Photographer", needs: ["Space for image files", "Accurate display colors", "Camera connections"] },
  "video-editor": { label: "Video editor", needs: ["Processing and graphics performance", "Space for video files", "A useful editing display"] },
  library: { label: "Library checkout", needs: ["Durable equipment", "Barcode input and networking", "Simple, accessible controls"] },
  field: { label: "Field scientist", needs: ["Sensors for measurements", "Rugged, battery-powered equipment", "Reliable storage"] },
};

export const weatherFaults: { value: WeatherFault; label: string }[] = [
  { value: "none", label: "All parts working" },
  { value: "sensor", label: "Temperature sensor fails" },
  { value: "power", label: "Recorder loses power" },
  { value: "software", label: "Recording software stops" },
  { value: "storage", label: "Saving measurements fails" },
  { value: "display", label: "Library display fails" },
  { value: "network", label: "Network connection fails" },
];

export const weatherReadings = [
  { time: "09:00", temperature: 18 },
  { time: "09:05", temperature: 18.5 },
  { time: "09:10", temperature: 19 },
  { time: "09:15", temperature: 19.2 },
  { time: "09:20", temperature: 20 },
  { time: "09:25", temperature: 20.5 },
  { time: "09:30", temperature: 21 },
];

export function getRecordingResult(state: SceneInteractionState) {
  const source = state.recordingSource ?? "usb";
  const hasAudio = source === "built-in" || (state.microphoneConnected ?? true);
  const hasIntendedInput = hasAudio && source === "usb";
  const saved = hasAudio && (state.recordingSaved ?? true);
  const inputLabel = hasAudio ? (source === "usb" ? "USB microphone" : "Built-in microphone") : "No USB input";
  const feedback = !hasAudio
    ? "The selected USB microphone is disconnected. This attempt receives no intended audio, so there is no recording to play or save."
    : !hasIntendedInput
      ? "Audio is captured from the built-in microphone. The cable can be fine while software selects a different sound source."
      : !saved
        ? "You can listen to the recording in the working session, but no final file has been saved for later."
        : "The intended microphone supplies audio, the app records it, and a saved file is available for later.";
  return { source, hasAudio, hasIntendedInput, saved, inputLabel, feedback };
}

export function getWeatherResult(state: SceneInteractionState) {
  const fault = state.weatherFault ?? "none";
  const restarted = state.weatherRestarted ?? false;
  const collectionStopped = fault === "sensor" || fault === "power" || fault === "software";
  // The fault begins at 09:20; four earlier readings already exist and are saved.
  const captured = collectionStopped ? weatherReadings.slice(0, 4) : weatherReadings;
  const saved = fault === "storage" ? weatherReadings.slice(0, 4) : captured;
  const available = restarted ? saved : captured;
  const delivered = fault === "network" ? weatherReadings.slice(0, 4) : available;
  const displayed = fault === "display" ? [] : delivered;
  const explanations: Record<WeatherFault, string> = {
    none: "The sensor, recorder, saving, network, and display work together. Seven readings reach the library graph.",
    sensor: "The sensor supplies no new temperature input from 09:20. Earlier saved readings remain, but the graph stops growing.",
    power: "The recorder loses power at 09:20. It cannot run its software or record new measurements; the library retains the earlier readings.",
    software: "The sensor can still measure temperature, but the recorder's software stops collecting and organizing new readings at 09:20.",
    storage: restarted
      ? "After the restart, working memory is cleared. The graph is rebuilt from the four saved readings; the three unsaved readings are lost."
      : "The live graph still updates, but saving fails at 09:20. Only the first four readings are persistent; the last three remain in working memory.",
    display: "The recorder collects and saves all seven readings, and the network delivers them. A failed library display hides the graph; it does not erase the data.",
    network: "The recorder collects and saves all seven readings locally. The library receives no updates after 09:15 because its network connection fails.",
  };
  return { fault, restarted, captured, saved, available, delivered, displayed, explanation: explanations[fault] };
}
