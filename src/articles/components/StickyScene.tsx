import { Box, Chip, Stack, Typography } from "@mui/material";
import type { MotionValue } from "motion/react";
import type { SceneAnimationSpec, SceneInteractionState } from "../types";
import { AnimatedDiagram } from "./AnimatedDiagram";

type StickySceneProps = {
  scene: SceneAnimationSpec;
  progress: MotionValue<number>;
  activeStepIndex: number;
  interaction: SceneInteractionState;
  mobileSticky?: boolean;
};

export function StickyScene({
  scene,
  progress,
  activeStepIndex,
  interaction,
  mobileSticky = false,
}: StickySceneProps) {
  return (
    <Box
      sx={{
        position: { xs: mobileSticky ? "sticky" : "relative", md: "sticky" },
        top: { xs: 8, md: 24 },
        order: { xs: mobileSticky ? -1 : 0, md: 0 },
        zIndex: 2,
        alignSelf: "start",
        py: { xs: mobileSticky ? 0 : 2, md: 4 },
      }}
    >
      <Box
        sx={{
          border: "1px solid rgba(15, 23, 42, 0.14)",
          bgcolor: "#ffffff",
          boxShadow: "0 24px 70px rgba(15, 23, 42, 0.10)",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            p: { xs: mobileSticky ? 1.25 : 2, md: 2.5 },
            borderBottom: "1px solid rgba(15, 23, 42, 0.10)",
            background:
              "linear-gradient(180deg, rgba(248,250,252,0.95), rgba(255,255,255,0.95))",
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
            <Box>
              <Typography
                variant="overline"
                sx={{ color: scene.accent, fontWeight: 900, letterSpacing: 0 }}
              >
                Step {activeStepIndex + 1}
              </Typography>
              <Typography
                component="h2"
                sx={{
                  color: "#172121",
                  fontSize: { xs: 22, md: 26 },
                  lineHeight: 1.12,
                  fontWeight: 900,
                  letterSpacing: 0,
                }}
              >
                {scene.title}
              </Typography>
            </Box>
            <Chip
              label={mobileSticky ? `${activeStepIndex + 1} / ${scene.steps.length}` : scene.kind.replace("-", " ")}
              size="small"
              sx={{
                bgcolor: `${scene.accent}18`,
                color: scene.accent,
                fontWeight: 800,
                borderRadius: 1,
                textTransform: "capitalize",
              }}
            />
          </Stack>
        </Box>
        <Box sx={{ p: { xs: mobileSticky ? 1 : 2, md: 3 }, "& svg": { display: "block", width: "100%", ...(mobileSticky ? { maxHeight: { xs: "26svh", md: "none" } } : {}) } }}>
          <AnimatedDiagram
            scene={scene}
            progress={progress}
            activeStepIndex={activeStepIndex}
            interaction={interaction}
          />
        </Box>
        <Box
          sx={{
            px: { xs: 2, md: 3 },
            pb: { xs: 2, md: 3 },
            display: { xs: mobileSticky ? "none" : "block", md: "block" },
          }}
        >
          <Typography
            variant="body2"
            sx={{ color: "#52635f", lineHeight: 1.65 }}
          >
            {scene.caption ?? scene.objective}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
