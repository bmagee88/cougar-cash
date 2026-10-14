import type { ReactNode } from "react";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { Link as RouterLink } from "react-router-dom";
import type { ScrollyChapter } from "../types";

type Props = { chapter: ScrollyChapter; section: string; accent: string; children: ReactNode };

export function ChapterHero({ chapter, section, accent, children }: Props) {
  return (
    <Box component="header" sx={{ borderBottom: "1px solid #ccd9dc", bgcolor: "#edf3f4" }}>
      <Container maxWidth="lg" sx={{ pt: { xs: 2, md: 3 }, pb: { xs: 3, md: 4 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} sx={{ mb: { xs: 4, md: 5 } }}>
          <Button component={RouterLink} to="/articles/" startIcon={<ArrowBackRoundedIcon />} sx={{ color: "#32545b", textTransform: "none", fontWeight: 700, minHeight: 44 }}>All articles</Button>
          <Typography sx={{ fontSize: 14, color: "#52635f", whiteSpace: "nowrap" }}>{chapter.readingTime} read</Typography>
        </Stack>
        <Typography sx={{ color: accent, fontSize: 14, fontWeight: 800, mb: 1.5 }}>Computers, Devices, and Cables / {section}</Typography>
        <Typography component="h1" sx={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: { xs: 40, sm: 56, md: 72 }, lineHeight: 1.05, maxWidth: 1100, letterSpacing: 0 }}>{chapter.title}</Typography>
        <Typography sx={{ mt: 2, maxWidth: 760, fontSize: { xs: 18, md: 21 }, lineHeight: 1.7, color: "#3f4f4b" }}>{chapter.dek}</Typography>
        <Box sx={{ mt: { xs: 3, md: 4 } }}>{children}</Box>
      </Container>
    </Box>
  );
}
