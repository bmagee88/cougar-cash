import { Chip, Stack, Typography } from "@mui/material";
import { Timer } from "../types/timer";

type Props = { timer: Timer };

export default function TimerPreview({ timer: t }: Props) {
  return (
    <Stack direction="column" spacing={1}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {t.start} - Start
      </Typography>

      {t.segments.map((seg, i) => (
        <Stack key={seg.id} direction="column" spacing={1}>
          <Chip
            label={seg.title || `Segment ${i + 1}`}
            sx={{ bgcolor: seg.color || "#9e9e9e", color: "#fff", fontWeight: 600 }}
          />
          {/* Hide the time for the LAST segment in preview */}
          {i < t.segments.length - 1 && (
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {seg.end}
            </Typography>
          )}
        </Stack>
      ))}

      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {t.end} - End
      </Typography>
    </Stack>
  );
}
