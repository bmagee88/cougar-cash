import { Alert, Box, Slider, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import DesktopWindowsRoundedIcon from "@mui/icons-material/DesktopWindowsRounded";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import type { CheckpointKind, SceneInteractionState, ScrollStepData } from "../types";
import { processingRules, processInput } from "./processingModel";

type Props = {
  checkpoint: CheckpointKind;
  interaction: SceneInteractionState;
  onInteractionChange: (next: SceneInteractionState) => void;
  question?: ScrollStepData["question"];
};

export function ComputingCheckpoint({ checkpoint, interaction, onInteractionChange, question }: Props) {
  const change = (next: Partial<SceneInteractionState>) => onInteractionChange({ ...interaction, ...next });
  const controlStyle = { textTransform: "none" as const, fontWeight: 700, minHeight: 44, px: 1.5, gap: 0.75 };

  return (
    <Box sx={{ borderTop: "1px solid #b9c8cb", pt: 2, mt: 1 }}>
      {checkpoint === "input-lab" ? (
        <Stack spacing={1.5}>
          <TextField
            label="Input message"
            value={interaction.inputText ?? "A"}
            onChange={(event) => change({ inputText: event.target.value })}
            inputProps={{ maxLength: 12, "aria-describedby": "input-lab-feedback" }}
            fullWidth
            helperText="Up to 12 characters"
          />
          <Typography id="input-lab-feedback" role="status" sx={{ color: "#007078", overflowWrap: "anywhere" }}>
            Received data: <strong>{interaction.inputText === "" ? "No text yet" : interaction.inputText ?? "A"}</strong>
          </Typography>
        </Stack>
      ) : null}

      {checkpoint === "rule-lab" ? (
        <Stack spacing={2}>
          <Typography id="input-number-label" sx={{ fontWeight: 700 }}>
            Input number: {interaction.inputNumber ?? 4}
          </Typography>
          <Box sx={{ px: 1 }}>
            <Slider
              aria-labelledby="input-number-label"
              value={interaction.inputNumber ?? 4}
              min={0}
              max={12}
              step={1}
              marks={[{ value: 0, label: "0" }, { value: 6, label: "6" }, { value: 12, label: "12" }]}
              valueLabelDisplay="auto"
              onChange={(_, value) => change({ inputNumber: Array.isArray(value) ? value[0] : value })}
              sx={{ color: "#a33860" }}
            />
          </Box>
          <ToggleButtonGroup
            exclusive
            value={interaction.processingRule ?? "double"}
            onChange={(_, value) => { if (value) change({ processingRule: value }); }}
            aria-label="Processing instruction"
            sx={{ alignSelf: "flex-start", flexWrap: "wrap" }}
          >
            {Object.entries(processingRules).map(([value, rule]) => (
              <ToggleButton key={value} value={value} sx={controlStyle}>{rule.label}</ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Box role="status" aria-live="polite" aria-atomic="true" sx={{ p: 2, bgcolor: "#f4e8ed", borderLeft: "3px solid #a33860" }}>
            <Typography sx={{ color: "#73223f", fontWeight: 700 }}>
              {interaction.inputNumber ?? 4} → {processingRules[interaction.processingRule ?? "double"].instruction} → {processInput(interaction.inputNumber ?? 4, interaction.processingRule ?? "double")}
            </Typography>
          </Box>
        </Stack>
      ) : null}

      {checkpoint === "output-selector" ? (
        <Stack spacing={1.5}>
          <Typography sx={{ fontWeight: 700 }}>Output device</Typography>
          <ToggleButtonGroup
            exclusive
            value={interaction.outputDestination ?? "display"}
            onChange={(_, value) => { if (value) change({ outputDestination: value }); }}
            aria-label="Output device"
            sx={{ alignSelf: "flex-start", flexWrap: "wrap" }}
          >
            <ToggleButton value="display" sx={controlStyle}><DesktopWindowsRoundedIcon fontSize="small" />Display</ToggleButton>
            <ToggleButton value="speaker" sx={controlStyle}><VolumeUpRoundedIcon fontSize="small" />Speaker</ToggleButton>
            <ToggleButton value="motor" sx={controlStyle}><SettingsRoundedIcon fontSize="small" />Motor</ToggleButton>
          </ToggleButtonGroup>
          <Typography role="status" sx={{ color: "#3f4f4b", lineHeight: 1.7 }}>
            {(interaction.outputDestination ?? "display") === "display" ? "Visual output: the display shows a result." : interaction.outputDestination === "speaker" ? "Sound output: the speaker produces an alert." : "Physical output: the motor turns its shaft."}
          </Typography>
        </Stack>
      ) : null}

      {checkpoint === "concept-check" && question ? (
        <Stack spacing={1.5}>
          <Typography id="concept-question" sx={{ fontWeight: 700 }}>{question.prompt}</Typography>
          <ToggleButtonGroup
            exclusive
            value={interaction.conceptAnswer ?? ""}
            onChange={(_, value) => { if (value) change({ conceptAnswer: value }); }}
            aria-labelledby="concept-question"
            sx={{ alignSelf: "flex-start", display: "flex", flexDirection: "column", width: "100%" }}
          >
            {question.choices.map((choice) => (
              <ToggleButton key={choice.value} value={choice.value} sx={{ ...controlStyle, justifyContent: "flex-start", border: "1px solid #b9c8cb !important", borderRadius: "4px !important", mb: 1 }}>
                {choice.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          {question.choices.find((choice) => choice.value === interaction.conceptAnswer) ? (
            <Alert role="status" severity={interaction.conceptAnswer === question.correctValue ? "success" : "info"} sx={{ borderRadius: 1 }}>
              {question.choices.find((choice) => choice.value === interaction.conceptAnswer)?.feedback}
            </Alert>
          ) : null}
        </Stack>
      ) : null}
    </Box>
  );
}
