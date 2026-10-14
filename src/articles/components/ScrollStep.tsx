import type { ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";
import type { ScrollStepData } from "../types";

type ScrollStepProps = {
  step: ScrollStepData;
  active: boolean;
  index: number;
  total: number;
  children?: ReactNode;
  mobileSticky?: boolean;
};

export function ScrollStep({
  step,
  active,
  index,
  total,
  children,
  mobileSticky = false,
}: ScrollStepProps) {
  return (
    <Box
      component="section"
      aria-current={active ? "step" : undefined}
      sx={{
        minHeight: { xs: mobileSticky ? "58svh" : "auto", md: "72vh" },
        py: { xs: 3, md: 8 },
        display: "flex",
        alignItems: "center",
      }}
    >
      <Box
        sx={{
          width: "100%",
          borderLeft: "3px solid",
          borderColor: active ? "primary.main" : "divider",
          pl: { xs: 2, sm: 3 },
          py: 2,
          opacity: active || mobileSticky ? 1 : 0.7,
          transition: "opacity 180ms ease, border-color 180ms ease",
          "@media (prefers-reduced-motion: reduce)": {
            transition: "none",
          },
        }}
      >
        <Stack spacing={1.5}>
          <Typography
            variant="overline"
            sx={{
              color: "primary.main",
              fontWeight: 800,
              letterSpacing: 0,
              lineHeight: 1.2,
            }}
          >
            {step.eyebrow} {index + 1}/{total}
          </Typography>
          <Typography
            component="h3"
            variant="h4"
            sx={{
              color: "#172121",
              fontFamily:
                'Georgia, "Times New Roman", "Source Serif Pro", serif',
              fontSize: { xs: 26, sm: 30, md: 34 },
              lineHeight: 1.08,
              letterSpacing: 0,
            }}
          >
            {step.title}
          </Typography>
          {step.body.map((paragraph) => (
            <Typography
              key={paragraph}
              variant="body1"
              sx={{
                color: "#3f4f4b",
                fontSize: { xs: 17, md: 18 },
                lineHeight: 1.78,
              }}
            >
              {paragraph}
            </Typography>
          ))}
          {children}
        </Stack>
      </Box>
    </Box>
  );
}
