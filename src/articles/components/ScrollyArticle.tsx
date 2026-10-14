import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Box,
  Chip,
  Container,
  Divider,
  GlobalStyles,
  Stack,
  Typography,
} from "@mui/material";
import { alpha, createTheme, ThemeProvider } from "@mui/material/styles";
import { useMotionValue, useReducedMotion, useScroll } from "motion/react";
import type {
  SceneAnimationSpec,
  SceneInteractionState,
  ScrollyChapter,
} from "../types";
import { InteractiveCheckpoint } from "./InteractiveCheckpoint";
import { ScrollStep } from "./ScrollStep";
import { StickyScene } from "./StickyScene";

type ScrollyArticleProps = {
  chapter: ScrollyChapter;
  hero?: ReactNode;
};

const articleTheme = createTheme({
  palette: {
    primary: {
      main: "#0f766e",
    },
    warning: {
      main: "#b45309",
    },
    background: {
      default: "#f7faf9",
    },
  },
  typography: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
});

export default function ScrollyArticle({ chapter, hero }: ScrollyArticleProps) {
  return (
    <ThemeProvider theme={articleTheme}>
      <GlobalStyles styles={{ "@media (prefers-reduced-motion: reduce)": { html: { scrollBehavior: "auto" } } }} />
      <Box
        component="article"
        sx={{
          minHeight: "100vh",
          bgcolor: "#f7faf9",
          color: "#172121",
        }}
      >
        {hero ?? <ArticleHero chapter={chapter} />}
        <Container maxWidth="xl" sx={{ pb: { xs: 8, md: 12 } }}>
          {chapter.scenes.map((scene, index) => (
            <ScrollyScene
              key={scene.id}
              scene={scene}
              sceneNumber={index + 1}
              totalScenes={chapter.scenes.length}
              mobileSticky={chapter.mobileSticky ?? false}
            />
          ))}
          <ChapterOutro chapter={chapter} />
        </Container>
      </Box>
    </ThemeProvider>
  );
}

function ArticleHero({ chapter }: ScrollyArticleProps) {
  return (
    <Box
      component="header"
      sx={{
        borderBottom: "1px solid rgba(15, 23, 42, 0.10)",
        bgcolor: "#f7faf9",
      }}
    >
      <Container
        maxWidth="lg"
        sx={{
          minHeight: { xs: "auto", md: "78vh" },
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 0.95fr) 420px" },
          gap: { xs: 4, md: 8 },
          alignItems: "center",
          pt: { xs: 8, md: 10 },
          pb: { xs: 6, md: 8 },
        }}
      >
        <Stack spacing={3}>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            <Chip label={chapter.gradeBand} sx={{ borderRadius: 1, fontWeight: 800 }} />
            <Chip label={chapter.readingTime} sx={{ borderRadius: 1, fontWeight: 800 }} />
          </Stack>
          <Box>
            <Typography
              component="p"
              sx={{
                color: "#0f766e",
                fontWeight: 900,
                textTransform: "uppercase",
                fontSize: 14,
                letterSpacing: 0,
                mb: 1.5,
              }}
            >
              Interactive STEM Article
            </Typography>
            <Typography
              component="h1"
              sx={{
                fontFamily:
                  'Georgia, "Times New Roman", "Source Serif Pro", serif',
                fontSize: { xs: 48, sm: 64, md: 82 },
                lineHeight: 0.94,
                letterSpacing: 0,
                color: "#172121",
              }}
            >
              {chapter.title}
            </Typography>
            <Typography
              component="p"
              sx={{
                mt: 1.5,
                fontSize: { xs: 25, md: 32 },
                lineHeight: 1.08,
                fontWeight: 800,
                color: "#31524d",
              }}
            >
              {chapter.subtitle}
            </Typography>
          </Box>
          <Typography
            sx={{
              maxWidth: 720,
              fontSize: { xs: 18, md: 21 },
              lineHeight: 1.7,
              color: "#52635f",
            }}
          >
            {chapter.dek}
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {chapter.standards.map((standard) => (
              <Chip
                key={standard}
                label={standard}
                variant="outlined"
                sx={{ borderRadius: 1, fontWeight: 700 }}
              />
            ))}
          </Stack>
        </Stack>
        <Box
          aria-hidden="true"
          sx={{
            minHeight: 340,
            border: "1px solid rgba(15, 23, 42, 0.12)",
            bgcolor: "#ffffff",
            boxShadow: "0 24px 70px rgba(15, 23, 42, 0.10)",
            p: 3,
            display: { xs: "none", md: "block" },
          }}
        >
          <Box component="svg" viewBox="0 0 360 300" sx={{ width: "100%", height: "100%" }}>
            <rect x="16" y="218" width="320" height="10" rx="5" fill="#cbd5e1" />
            <polygon points="48,218 300,82 300,218" fill="#dbeafe" stroke="#2563eb" strokeWidth="7" />
            <rect x="126" y="152" width="58" height="44" rx="8" fill="#f59e0b" />
            <polygon points="218,228 278,228 248,172" fill="#fbbf24" stroke="#b45309" strokeWidth="5" />
            <rect x="90" y="84" width="178" height="20" rx="10" fill="#92400e" />
            <line x1="70" y1="64" x2="70" y2="126" stroke="#dc2626" strokeWidth="8" strokeLinecap="round" />
            <polygon points="70,132 54,104 86,104" fill="#dc2626" />
            <text x="36" y="268" fill="#0f766e" fontSize="18" fontWeight="900">
              force changes
            </text>
            <text x="184" y="48" fill="#2563eb" fontSize="17" fontWeight="900">
              distance changes
            </text>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

function ScrollyScene({
  scene,
  sceneNumber,
  totalScenes,
  mobileSticky,
}: {
  scene: SceneAnimationSpec;
  sceneNumber: number;
  totalScenes: number;
  mobileSticky: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [interaction, setInteraction] = useState<SceneInteractionState>(
    scene.defaultInteraction ?? {}
  );
  const prefersReducedMotion = useReducedMotion();
  const reducedProgress = useMotionValue(0);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 70%", "end 30%"],
  });

  useEffect(() => {
    reducedProgress.set(
      scene.steps.length <= 1 ? 1 : activeStepIndex / (scene.steps.length - 1)
    );
  }, [activeStepIndex, reducedProgress, scene.steps.length]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.length) return;
        const focusY = window.innerHeight * (mobileSticky && window.innerWidth < 900 ? 0.72 : 0.5);
        const nearest = stepRefs.current.reduce(
          (best, node, index) => {
            if (!node) return best;
            const rect = node.getBoundingClientRect();
            const distance = Math.abs(rect.top + rect.height / 2 - focusY);
            return distance < best.distance ? { index, distance } : best;
          },
          { index: 0, distance: Infinity }
        );
        setActiveStepIndex(nearest.index);
      },
      {
        threshold: [0.24, 0.4, 0.58, 0.72],
        rootMargin: mobileSticky && window.innerWidth < 900 ? "-40% 0px -10% 0px" : "-18% 0px -36% 0px",
      }
    );

    stepRefs.current.forEach((node) => {
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, [scene.id, mobileSticky]);

  const progress = prefersReducedMotion ? reducedProgress : scrollYProgress;
  const themeColor = scene.accent;

  return (
    <Box
      component="section"
      ref={containerRef}
      aria-label={scene.title}
      sx={{
        py: { xs: 5, md: 8 },
        "--scene-accent": themeColor,
      }}
    >
      <Stack spacing={1.5} sx={{ mb: { xs: 3, md: 0 } }}>
        <Typography
          variant="overline"
          sx={{ color: themeColor, fontWeight: 900, letterSpacing: 0 }}
        >
          Scene {sceneNumber} of {totalScenes}
        </Typography>
        <Divider sx={{ borderColor: alpha(themeColor, 0.26) }} />
      </Stack>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 0.88fr) minmax(420px, 1.12fr)" },
          gap: { xs: 2, md: 7 },
          alignItems: "start",
        }}
      >
        <Box>
          {scene.steps.map((step, index) => (
            <Box
              key={step.id}
              ref={(node: HTMLDivElement | null) => {
                stepRefs.current[index] = node;
              }}
              data-step-index={index}
            >
              <ScrollStep
                step={step}
                active={index === activeStepIndex}
                index={index}
                total={scene.steps.length}
                mobileSticky={mobileSticky}
              >
                {step.checkpoint ? (
                  <InteractiveCheckpoint
                    checkpoint={step.checkpoint}
                    scene={scene}
                    question={step.question}
                    interaction={interaction}
                    onInteractionChange={setInteraction}
                  />
                ) : null}
              </ScrollStep>
            </Box>
          ))}
        </Box>
        <StickyScene
          scene={scene}
          progress={progress}
          activeStepIndex={activeStepIndex}
          interaction={interaction}
          mobileSticky={mobileSticky}
        />
      </Box>
    </Box>
  );
}

function ChapterOutro({ chapter }: ScrollyArticleProps) {
  const takeaways = chapter.takeaways ?? [
    "Simple machines can lower the effort force by increasing distance, changing direction, or reducing friction.",
    "They do not erase work; they change the way the work is done.",
    "Mechanical advantage compares output force with input force.",
  ];

  return (
    <Box
      component="section"
      sx={{
        mt: { xs: 4, md: 8 },
        py: { xs: 5, md: 7 },
        borderTop: "1px solid rgba(15, 23, 42, 0.12)",
      }}
    >
      <Container maxWidth="md">
        <Stack spacing={2.5}>
          <Typography
            component="h2"
            sx={{
              fontFamily:
                'Georgia, "Times New Roman", "Source Serif Pro", serif',
              fontSize: { xs: 34, md: 48 },
              lineHeight: 1.04,
              letterSpacing: 0,
            }}
          >
            {chapter.takeaways ? "Carry the idea with you" : "What the first three scenes prove"}
          </Typography>
          {takeaways.map((takeaway) => (
            <Typography
              key={takeaway}
              sx={{
                fontSize: { xs: 18, md: 20 },
                lineHeight: 1.7,
                color: "#3f4f4b",
              }}
            >
              {takeaway}
            </Typography>
          ))}
          {chapter.sourceLabel ? (
            <Typography variant="body2" sx={{ color: "#52635f", lineHeight: 1.7 }}>
              {chapter.sourceLabel}
            </Typography>
          ) : null}
        </Stack>
      </Container>
    </Box>
  );
}
