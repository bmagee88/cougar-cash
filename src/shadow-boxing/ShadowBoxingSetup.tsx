import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Slider,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import SportsMmaIcon from "@mui/icons-material/SportsMma";
import { MatchSettings } from "./types/shadowBoxing";
import { DEFAULT_MATCH_HEARTS } from "./engine/gameEngine";
import { TOPIC_LABELS } from "./data/vocabulary";

interface ShadowBoxingSetupProps {
  settings: MatchSettings;
  onChange: (settings: MatchSettings) => void;
  onStart: () => void;
}

const DIFFICULTIES: MatchSettings["difficulty"][] = [
  "easy",
  "medium",
  "hard",
  "expert",
  "wizz",
];

const TOPICS: MatchSettings["topic"][] = [
  "ela",
  "computers",
  "engineering",
  "painting",
  "music",
  "history",
  "science",
  "environmental",
  "math",
  "mixed",
];

export default function ShadowBoxingSetup({
  settings,
  onChange,
  onStart,
}: ShadowBoxingSetupProps) {
  const updateSetting = <TKey extends keyof MatchSettings>(
    key: TKey,
    value: MatchSettings[TKey]
  ) => onChange({ ...settings, [key]: value });

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        p: { xs: 2, sm: 4 },
        background:
          "linear-gradient(135deg, #fdf2f8 0%, #ecfeff 44%, #fef9c3 100%)",
      }}
    >
      <Paper
        elevation={10}
        sx={{
          width: "100%",
          maxWidth: 760,
          borderRadius: 2,
          p: { xs: 2.5, sm: 4 },
          border: "1px solid rgba(15,23,42,0.12)",
        }}
      >
        <Stack spacing={3}>
          <Stack spacing={1}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <SportsMmaIcon sx={{ color: "#0f766e", fontSize: 34 }} />
              <Typography
                variant="h3"
                component="h1"
                sx={{ fontWeight: 950, color: "#0f172a", lineHeight: 1 }}
              >
                Vocabulary Shadow Boxing
              </Typography>
            </Stack>
            <Typography variant="body1" sx={{ color: "#475569", maxWidth: 620 }}>
              Pick a lane, prove the word, then defend fast when the counter comes.
            </Typography>
          </Stack>

          <Stack spacing={2.25}>
            <FormControl fullWidth>
              <InputLabel id="shadow-boxing-difficulty-label">Difficulty</InputLabel>
              <Select
                labelId="shadow-boxing-difficulty-label"
                label="Difficulty"
                value={settings.difficulty}
                onChange={(event: SelectChangeEvent) =>
                  updateSetting(
                    "difficulty",
                    event.target.value as MatchSettings["difficulty"]
                  )
                }
              >
                {DIFFICULTIES.map((difficulty) => (
                  <MenuItem key={difficulty} value={difficulty}>
                    {difficulty.toUpperCase()}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="shadow-boxing-topic-label">Topic</InputLabel>
              <Select
                labelId="shadow-boxing-topic-label"
                label="Topic"
                value={settings.topic}
                onChange={(event: SelectChangeEvent) =>
                  updateSetting("topic", event.target.value as MatchSettings["topic"])
                }
              >
                {TOPICS.map((topic) => (
                  <MenuItem key={topic} value={topic}>
                    {TOPIC_LABELS[topic]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              alignItems={{ xs: "stretch", sm: "center" }}
              justifyContent="space-between"
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.trickMe}
                    onChange={(event) =>
                      updateSetting("trickMe", event.target.checked)
                    }
                  />
                }
                label="Trick Me"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.lessDecisions}
                    onChange={(event) =>
                      updateSetting("lessDecisions", event.target.checked)
                    }
                  />
                }
                label="Less Decisions"
              />

              <FormControl sx={{ minWidth: { xs: "100%", sm: 160 } }}>
                <InputLabel id="shadow-boxing-hearts-label">Hearts</InputLabel>
                <Select
                  labelId="shadow-boxing-hearts-label"
                  label="Hearts"
                  value={String(settings.hearts || DEFAULT_MATCH_HEARTS)}
                  onChange={(event: SelectChangeEvent) =>
                    updateSetting("hearts", Number(event.target.value))
                  }
                >
                  {[1, 2, 3, 4, 5].map((hearts) => (
                    <MenuItem key={hearts} value={String(hearts)}>
                      {hearts}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <Box>
              <Typography
                id="shadow-boxing-combo-threshold-label"
                variant="body2"
                sx={{ fontWeight: 800, mb: 1, color: "#334155" }}
              >
                Combo hits to lose a heart: {settings.comboHitsRequired}
              </Typography>
              <Slider
                aria-labelledby="shadow-boxing-combo-threshold-label"
                min={1}
                max={5}
                step={1}
                marks
                value={settings.comboHitsRequired}
                onChange={(_, value) =>
                  updateSetting(
                    "comboHitsRequired",
                    Array.isArray(value) ? value[0] : value
                  )
                }
              />
            </Box>
          </Stack>

          <Button
            variant="contained"
            size="large"
            onClick={onStart}
            startIcon={<SportsMmaIcon />}
            sx={{
              py: 1.5,
              borderRadius: 2,
              fontWeight: 900,
              bgcolor: "#0f766e",
              "&:hover": { bgcolor: "#115e59" },
            }}
          >
            START MATCH
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

