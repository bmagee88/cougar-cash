import {
  Box,
  Button,
  Chip,
  Container,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import { Link as RouterLink } from "react-router-dom";
import type { ArticleSummary } from "./types";
import { simpleMachinesSummary } from "./simple-machines/simpleMachinesChapter";
import { inputProcessOutputSummary } from "./input-process-output/inputProcessOutputChapter";
import { completeSystemsSummary } from "./complete-systems/completeSystemsChapter";

const articles: ArticleSummary[] = [
  inputProcessOutputSummary,
  completeSystemsSummary,
  simpleMachinesSummary,
  {
    slug: "ecosystem-energy",
    title: "Ecosystem Energy",
    subtitle: "Follow energy through producers, consumers, and decomposers.",
    gradeBand: "Middle School Life Science",
    readingTime: "Planned",
    status: "Planned",
    accent: "#4d7c0f",
    path: "/articles",
  },
  {
    slug: "data-and-variation",
    title: "Data and Variation",
    subtitle: "Read distributions with dot plots, centers, and spread.",
    gradeBand: "Middle School Math",
    readingTime: "Planned",
    status: "Planned",
    accent: "#7c3aed",
    path: "/articles",
  },
];

export default function ArticlesDirectory() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f7faf9",
        color: "#172121",
        py: { xs: 6, md: 9 },
      }}
    >
      <Container maxWidth="lg">
        <Stack spacing={5}>
          <Box
            component="header"
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 280px" },
              gap: { xs: 3, md: 6 },
              alignItems: "end",
            }}
          >
            <Stack spacing={2}>
              <Chip
                icon={<MenuBookRoundedIcon />}
                label="Interactive Articles"
                sx={{
                  alignSelf: "flex-start",
                  borderRadius: 1,
                  bgcolor: "rgba(15, 118, 110, 0.10)",
                  color: "#0f766e",
                  fontWeight: 900,
                }}
              />
              <Typography
                component="h1"
                sx={{
                  fontFamily:
                    'Georgia, "Times New Roman", "Source Serif Pro", serif',
                  fontSize: { xs: 44, sm: 58, md: 72 },
                  lineHeight: 0.98,
                  letterSpacing: 0,
                }}
              >
                Articles Directory
              </Typography>
              <Typography
                sx={{
                  maxWidth: 760,
                  fontSize: { xs: 18, md: 21 },
                  lineHeight: 1.7,
                  color: "#52635f",
                }}
              >
                Explore how things work, from the computers on your desk to the
                machines that move a load. Read, investigate, and put each idea
                to the test.
              </Typography>
            </Stack>
            <Box
              sx={{
                borderLeft: { md: "3px solid rgba(15, 118, 110, 0.24)" },
                pl: { md: 3 },
              }}
            >
              <Typography sx={{ color: "#3f4f4b", lineHeight: 1.7 }}>
                Computer science, physical science, and mathematics.
                Choose a chapter to begin.
              </Typography>
            </Box>
          </Box>

          <Grid container spacing={3}>
            {articles.map((article) => (
              <Grid item xs={12} md={4} key={article.slug}>
                <ArticleCard article={article} />
              </Grid>
            ))}
          </Grid>
        </Stack>
      </Container>
    </Box>
  );
}

function ArticleCard({ article }: { article: ArticleSummary }) {
  const isReady = article.status !== "Planned";

  return (
    <Paper
      elevation={0}
      sx={{
        height: "100%",
        border: "1px solid rgba(15, 23, 42, 0.12)",
        borderTop: `5px solid ${article.accent}`,
        borderRadius: 1,
        bgcolor: "#ffffff",
        overflow: "hidden",
      }}
    >
      <Stack spacing={2.5} sx={{ p: 3, height: "100%" }}>
        <Stack direction="row" justifyContent="space-between" gap={1}>
          <Chip
            label={article.sectionLabel ?? article.status}
            size="small"
            sx={{
              borderRadius: 1,
              bgcolor: `${article.accent}18`,
              color: article.accent,
              fontWeight: 900,
            }}
          />
          <Typography variant="body2" sx={{ color: "#64748b", fontWeight: 700 }}>
            {article.readingTime}
          </Typography>
        </Stack>
        <Box>
          <Typography
            component="h2"
            sx={{
              fontSize: 28,
              lineHeight: 1.08,
              fontWeight: 900,
              letterSpacing: 0,
              color: "#172121",
            }}
          >
            {article.title}
          </Typography>
          <Typography sx={{ mt: 1, color: "#52635f", lineHeight: 1.65 }}>
            {article.subtitle}
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: "#64748b", fontWeight: 800 }}>
          {article.gradeBand}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          component={RouterLink}
          to={article.path}
          disabled={!isReady}
          endIcon={isReady ? <ArrowForwardRoundedIcon /> : undefined}
          variant={isReady ? "contained" : "outlined"}
          sx={{
            alignSelf: "flex-start",
            borderRadius: 1,
            textTransform: "none",
            fontWeight: 900,
            bgcolor: isReady ? article.accent : undefined,
            "&:hover": {
              bgcolor: isReady ? article.accent : undefined,
            },
          }}
        >
          {isReady ? "Open article" : "Coming soon"}
        </Button>
      </Stack>
    </Paper>
  );
}
