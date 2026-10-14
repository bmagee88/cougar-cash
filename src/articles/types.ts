export type SceneKind =
  | "work-tradeoff"
  | "inclined-plane"
  | "lever"
  | "input-capture"
  | "processing-rules"
  | "output-loop"
  | "recording-system"
  | "system-boundary"
  | "weather-system";

export type CheckpointKind =
  | "prediction"
  | "ramp-slider"
  | "fulcrum-choice"
  | "input-lab"
  | "rule-lab"
  | "output-selector"
  | "concept-check"
  | "recording-lab"
  | "boundary-lab"
  | "user-needs"
  | "weather-lab";

export type ProcessingRule = "double" | "add-ten" | "square";
export type OutputDestination = "display" | "speaker" | "motor";
export type WeatherFault = "none" | "sensor" | "power" | "software" | "storage" | "display" | "network";
export type SystemPurpose = "create" | "submit";
export type UserProfile = "student" | "photographer" | "video-editor" | "library" | "field";

export type SceneInteractionState = {
  selectedPrediction?: string;
  rampRun?: number;
  fulcrumPosition?: "near-effort" | "middle" | "near-load";
  inputText?: string;
  inputNumber?: number;
  processingRule?: ProcessingRule;
  outputDestination?: OutputDestination;
  conceptAnswer?: string;
  microphoneConnected?: boolean;
  recordingSource?: "usb" | "built-in";
  recordingSaved?: boolean;
  systemPurpose?: SystemPurpose;
  userProfile?: UserProfile;
  weatherFault?: WeatherFault;
  weatherRestarted?: boolean;
};

export type ScrollStepData = {
  id: string;
  eyebrow: string;
  title: string;
  body: string[];
  checkpoint?: CheckpointKind;
  question?: {
    prompt: string;
    correctValue: string;
    choices: { value: string; label: string; feedback: string }[];
  };
};

export type SceneAnimationSpec = {
  id: string;
  kind: SceneKind;
  title: string;
  objective: string;
  accent: string;
  visualElements: string[];
  initialState: string;
  finalState: string;
  trigger: string;
  interaction: string;
  defaultInteraction?: SceneInteractionState;
  steps: ScrollStepData[];
  caption?: string;
};

export type ScrollyChapter = {
  slug: string;
  title: string;
  subtitle: string;
  dek: string;
  gradeBand: string;
  readingTime: string;
  standards: string[];
  scenes: SceneAnimationSpec[];
  takeaways?: string[];
  sourceLabel?: string;
  mobileSticky?: boolean;
};

export type ArticleSummary = {
  slug: string;
  title: string;
  subtitle: string;
  gradeBand: string;
  readingTime: string;
  status: "Prototype" | "Ready" | "Planned";
  sectionLabel?: string;
  accent: string;
  path: string;
};
