import * as React from "react";
import { Card, CardContent, CardHeader, IconButton, Stack, TextField, Typography } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { Timer } from "../types/timer";
import TimerPreview from "./TimerPreview";
import { durationLabel } from "../utils/time";

type Props = {
  timer: Timer;
  onRename: (id: string, name: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  width?: number;
};

export default function TimerCard({ timer: t, onRename, onEdit, onDelete, width = 400 }: Props) {
  return (
    <Card variant="outlined" sx={{ width, maxWidth: "100%", mx: "auto" }}>
      <CardHeader
        title={
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              value={t.name}
              onChange={(e) => onRename(t.id, e.target.value)}
              size="small"
              variant="standard"
              InputProps={{ disableUnderline: true }}
              sx={{
                fontSize: (theme) => theme.typography.h6.fontSize,
                fontWeight: 600,
                width: { xs: 160, sm: 220 },
                "& input": { fontWeight: 600 },
              }}
              placeholder="Timer name"
            />
            <Typography variant="body2" color="text.secondary">
              {/* duration shows as (xh ym) */}
              {durationLabel(t.start, t.end)}
              {/** You can compute this in parent or bring in util; keeping simple here: */ }
            </Typography>
          </Stack>
        }
        action={
          <Stack direction="row" spacing={0.5}>
            <IconButton aria-label="edit timer" onClick={() => onEdit(t.id)}>
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83l3.75 3.75l1.84-1.82Z"
                />
              </svg>
            </IconButton>
            <IconButton aria-label="delete timer" onClick={() => onDelete(t.id)}>
              <DeleteIcon />
            </IconButton>
          </Stack>
        }
      />
      <CardContent>
        <Stack spacing={1} sx={{ minWidth: 220 }}>
          <TimerPreview timer={t} />
        </Stack>
      </CardContent>
    </Card>
  );
}
