import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Slider,
  Stack,
  Typography,
} from "@mui/material";
import type {
  CheckpointKind,
  SceneAnimationSpec,
  SceneInteractionState,
  ScrollStepData,
} from "../types";
import { ComputingCheckpoint } from "../input-process-output/ComputingCheckpoint";
import { SystemCheckpoint } from "../complete-systems/SystemCheckpoint";

type InteractiveCheckpointProps = {
  checkpoint: CheckpointKind;
  scene: SceneAnimationSpec;
  interaction: SceneInteractionState;
  onInteractionChange: (next: SceneInteractionState) => void;
  question?: ScrollStepData["question"];
};

const predictionChoices = [
  {
    value: "distance",
    label: "The distance increases",
    feedback:
      "Exactly. The machine can lower the force by spreading the same job over a longer path.",
  },
  {
    value: "work",
    label: "The work disappears",
    feedback:
      "Not quite. The work does not disappear; the machine changes how that work is done.",
  },
  {
    value: "mass",
    label: "The box gets lighter",
    feedback:
      "The box has the same mass. The setup changes the needed effort force.",
  },
];

const fulcrumChoices: {
  value: NonNullable<SceneInteractionState["fulcrumPosition"]>;
  label: string;
}[] = [
  { value: "near-effort", label: "Near effort" },
  { value: "middle", label: "Middle" },
  { value: "near-load", label: "Near load" },
];

export function InteractiveCheckpoint({
  checkpoint,
  scene,
  interaction,
  onInteractionChange,
  question,
}: InteractiveCheckpointProps) {
  if (checkpoint === "recording-lab" || checkpoint === "boundary-lab" || checkpoint === "user-needs" || checkpoint === "weather-lab") {
    return <SystemCheckpoint checkpoint={checkpoint} interaction={interaction} onInteractionChange={onInteractionChange} />;
  }
  if (checkpoint === "input-lab" || checkpoint === "rule-lab" || checkpoint === "output-selector" || checkpoint === "concept-check") {
    return <ComputingCheckpoint checkpoint={checkpoint} interaction={interaction} onInteractionChange={onInteractionChange} question={question} />;
  }
  if (checkpoint === "prediction") {
    const selected = interaction.selectedPrediction ?? "";
    const selectedChoice = predictionChoices.find(
      (choice) => choice.value === selected
    );
    const choosePrediction = (value: string) =>
      onInteractionChange({
        ...interaction,
        selectedPrediction: value,
      });

    return (
      <Box
        sx={{
          mt: 1,
          p: 2,
          border: "1px solid rgba(15, 118, 110, 0.24)",
          bgcolor: "rgba(15, 118, 110, 0.06)",
        }}
      >
        <Stack spacing={1.5}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            What changes when the force gets smaller?
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {predictionChoices.map((choice) => (
              <Button
                key={choice.value}
                variant={selected === choice.value ? "contained" : "outlined"}
                color={choice.value === "distance" ? "primary" : "inherit"}
                onPointerDown={() => choosePrediction(choice.value)}
                onClick={() => choosePrediction(choice.value)}
                sx={{
                  borderRadius: 1,
                  textTransform: "none",
                  fontWeight: 700,
                }}
              >
                {choice.label}
              </Button>
            ))}
          </Stack>
          {selectedChoice ? (
            <Alert
              severity={selectedChoice.value === "distance" ? "success" : "info"}
              sx={{ borderRadius: 1 }}
            >
              {selectedChoice.feedback}
            </Alert>
          ) : null}
        </Stack>
      </Box>
    );
  }

  if (checkpoint === "ramp-slider") {
    const rampRun = interaction.rampRun ?? scene.defaultInteraction?.rampRun ?? 270;
    const effort = Math.round(100 - (rampRun - 190) * 0.18);

    return (
      <Box
        sx={{
          mt: 1,
          p: 2,
          border: "1px solid rgba(37, 99, 235, 0.24)",
          bgcolor: "rgba(37, 99, 235, 0.06)",
        }}
      >
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" gap={2}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Ramp length
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Effort index: {effort}
            </Typography>
          </Stack>
          <Slider
            aria-label="Ramp length"
            value={rampRun}
            min={190}
            max={360}
            step={10}
            valueLabelDisplay="auto"
            onChange={(_, value) =>
              onInteractionChange({
                ...interaction,
                rampRun: Array.isArray(value) ? value[0] : value,
              })
            }
          />
          <Typography variant="body2" sx={{ color: "#3f4f4b" }}>
            Longer ramps lower the effort force, but the crate travels farther.
          </Typography>
        </Stack>
      </Box>
    );
  }

  const fulcrumPosition =
    interaction.fulcrumPosition ??
    scene.defaultInteraction?.fulcrumPosition ??
    "near-load";
  const isBestChoice = fulcrumPosition === "near-load";
  const chooseFulcrum = (
    value: NonNullable<SceneInteractionState["fulcrumPosition"]>
  ) =>
    onInteractionChange({
      ...interaction,
      fulcrumPosition: value,
    });

  return (
    <Box
      sx={{
        mt: 1,
        p: 2,
        border: "1px solid rgba(180, 83, 9, 0.26)",
        bgcolor: "rgba(180, 83, 9, 0.07)",
      }}
    >
      <Stack spacing={1.5}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
          Where should the fulcrum go?
        </Typography>
        <ButtonGroup
          variant="outlined"
          aria-label="Choose fulcrum position"
          sx={{ alignSelf: "flex-start", flexWrap: "wrap" }}
        >
          {fulcrumChoices.map((choice) => (
            <Button
              key={choice.value}
              variant={fulcrumPosition === choice.value ? "contained" : "outlined"}
              color="warning"
              onPointerDown={() => chooseFulcrum(choice.value)}
              onClick={() => chooseFulcrum(choice.value)}
              sx={{ borderRadius: 1, textTransform: "none", fontWeight: 700 }}
            >
              {choice.label}
            </Button>
          ))}
        </ButtonGroup>
        <Alert severity={isBestChoice ? "success" : "info"} sx={{ borderRadius: 1 }}>
          {isBestChoice
            ? "Yes. Moving the fulcrum near the load gives the effort side a longer lever arm."
            : "This setup can still work, but it needs more effort than placing the fulcrum near the load."}
        </Alert>
      </Stack>
    </Box>
  );
}
