import {
  Alert, Box, Button, FormControl, FormControlLabel, InputLabel,
  MenuItem, Select, Stack, Switch, ToggleButton, ToggleButtonGroup, Typography,
} from "@mui/material";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import type { CheckpointKind, SceneInteractionState, UserProfile, WeatherFault } from "../types";
import { getRecordingResult, getWeatherResult, userProfiles, weatherFaults } from "./systemModel";

type Props = {
  checkpoint: CheckpointKind;
  interaction: SceneInteractionState;
  onInteractionChange: (next: SceneInteractionState) => void;
};

export function SystemCheckpoint({ checkpoint, interaction, onInteractionChange }: Props) {
  const change = (next: Partial<SceneInteractionState>) => onInteractionChange({ ...interaction, ...next });
  const recording = getRecordingResult(interaction);
  const weather = getWeatherResult(interaction);
  const profile = interaction.userProfile ?? "student";

  return (
    <Box sx={{ mt: 1, pt: 2, borderTop: "1px solid #b9c8cb" }}>
      {checkpoint === "recording-lab" ? (
        <Stack spacing={2}>
          <FormControlLabel
            control={<Switch checked={interaction.microphoneConnected ?? true} onChange={(_, checked) => change({ microphoneConnected: checked })} />}
            label="USB microphone connected"
          />
          <FormControl fullWidth>
            <InputLabel id="recording-source-label">Selected microphone</InputLabel>
            <Select
              labelId="recording-source-label"
              label="Selected microphone"
              value={interaction.recordingSource ?? "usb"}
              onChange={(event) => change({ recordingSource: event.target.value as "usb" | "built-in" })}
            >
              <MenuItem value="usb">USB microphone</MenuItem>
              <MenuItem value="built-in">Built-in microphone</MenuItem>
            </Select>
          </FormControl>
          <FormControlLabel
            control={<Switch checked={interaction.recordingSaved ?? true} onChange={(_, checked) => change({ recordingSaved: checked })} />}
            label="Save the final file"
          />
          <Alert
            role="status"
            severity={!recording.hasAudio ? "warning" : recording.hasIntendedInput && recording.saved ? "success" : "info"}
            sx={{ borderRadius: 1 }}
          >
            {recording.feedback}
          </Alert>
          <Typography variant="body2" sx={{ color: "#3f4f4b" }}>
            Saved file: {recording.saved ? "available" : "not available"}
          </Typography>
        </Stack>
      ) : null}

      {checkpoint === "boundary-lab" ? (
        <Stack spacing={1.5}>
          <Typography sx={{ fontWeight: 700 }}>Question for the model</Typography>
          <ToggleButtonGroup
            exclusive
            value={interaction.systemPurpose ?? null}
            onChange={(_, value) => { if (value) change({ systemPurpose: value }); }}
            aria-label="Question for the system boundary"
            sx={{ alignSelf: "flex-start", flexWrap: "wrap" }}
          >
            <ToggleButton value="create" sx={{ textTransform: "none", minHeight: 44 }}>Create a document</ToggleButton>
            <ToggleButton value="submit" sx={{ textTransform: "none", minHeight: 44 }}>Submit to a teacher</ToggleButton>
          </ToggleButtonGroup>
          <Typography role="status" sx={{ color: "#73223f", lineHeight: 1.7 }}>
            {interaction.systemPurpose === undefined ? "Two questions require different boundaries." : interaction.systemPurpose === "create"
              ? "Local boundary: keyboard, hardware, operating system, app, and display."
              : "Submission boundary: add the network, server-based service, and teacher's device."}
          </Typography>
        </Stack>
      ) : null}

      {checkpoint === "user-needs" ? (
        <Stack spacing={1.5}>
          <FormControl fullWidth>
            <InputLabel id="system-user-label">User and purpose</InputLabel>
            <Select
              labelId="system-user-label"
              label="User and purpose"
              value={profile}
              onChange={(event) => change({ userProfile: event.target.value as UserProfile })}
            >
              {Object.entries(userProfiles).map(([value, user]) => <MenuItem key={value} value={value}>{user.label}</MenuItem>)}
            </Select>
          </FormControl>
          <Box role="status" aria-live="polite" sx={{ borderLeft: "3px solid #9a365c", pl: 2 }}>
            {userProfiles[profile].needs.map((need) => <Typography key={need} sx={{ lineHeight: 1.8 }}>{need}</Typography>)}
          </Box>
        </Stack>
      ) : null}

      {checkpoint === "weather-lab" ? (
        <Stack spacing={2}>
          <FormControl fullWidth>
            <InputLabel id="weather-fault-label">Change one part</InputLabel>
            <Select
              labelId="weather-fault-label"
              label="Change one part"
              value={weather.fault}
              onChange={(event) => change({ weatherFault: event.target.value as WeatherFault, weatherRestarted: false })}
            >
              {weatherFaults.map((fault) => <MenuItem key={fault.value} value={fault.value}>{fault.label}</MenuItem>)}
            </Select>
          </FormControl>
          <Box role="status" aria-live="polite" aria-atomic="true">
            <Stack direction="row" flexWrap="wrap" gap={2} sx={{ mb: 1.5 }}>
              <Typography>Captured: <strong>{weather.captured.length}</strong></Typography>
              <Typography>Saved: <strong>{weather.saved.length}</strong></Typography>
              <Typography>Visible in library: <strong>{weather.displayed.length}</strong></Typography>
            </Stack>
            <Alert severity={weather.fault === "none" ? "success" : "info"} role="status" sx={{ borderRadius: 1 }}>
              {weather.explanation}
            </Alert>
          </Box>
          <Button
            variant="outlined"
            startIcon={weather.restarted ? <UndoRoundedIcon /> : <RestartAltRoundedIcon />}
            onClick={() => change({ weatherRestarted: !weather.restarted })}
            sx={{ alignSelf: "flex-start", textTransform: "none", minHeight: 44 }}
          >
            {weather.restarted ? "Restore working session" : "Restart recorder"}
          </Button>
          <Typography variant="body2" sx={{ color: "#3f4f4b", lineHeight: 1.7 }}>
            {weather.restarted ? "After restart: working memory is cleared and the graph is rebuilt from saved measurements." : "Snapshot at 09:30. One selected fault begins at 09:20. Restarting clears working memory; it does not repair the selected fault."}
          </Typography>
        </Stack>
      ) : null}
    </Box>
  );
}
