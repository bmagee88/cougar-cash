import { Box, Button, Container, Stack } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { Link as RouterLink } from "react-router-dom";
import ScrollyArticle from "../components/ScrollyArticle";
import { ChapterHero } from "../components/ChapterHero";
import { completeSystemsChapter } from "./completeSystemsChapter";
import { Headphones, Laptop, Microphone } from "./SystemDiagram";

export default function CompleteSystemsArticle() {
  return (
    <>
      <ScrollyArticle
        chapter={completeSystemsChapter}
        hero={
          <ChapterHero chapter={completeSystemsChapter} section="1.6" accent="#8c2e50">
            <Box component="svg" viewBox="0 0 900 190" role="img" aria-label="A USB microphone, Chromebook, and headphones form a connected recording system." sx={{ width: "100%", display: "block", maxHeight: 220, fontFamily: "inherit" }}>
              <Microphone x={140} y={40} />
              <Laptop x={376} y={32} />
              <Headphones x={704} y={55} />
              <path d="M 199 76 H 355 M 552 76 H 686" stroke="#91abb2" strokeWidth="3" fill="none" />
              <path d="M 342 67 L 355 76 L 342 85 M 673 67 L 686 76 L 673 85" stroke="#91abb2" strokeWidth="3" fill="none" />
              <text x="160" y="163" textAnchor="middle" fill="#007078" fontSize="20" fontWeight="700">MICROPHONE</text>
              <text x="454" y="163" textAnchor="middle" fill="#8c2e50" fontSize="20" fontWeight="700">CHROMEBOOK + APP</text>
              <text x="734" y="163" textAnchor="middle" fill="#365596" fontSize="20" fontWeight="700">HEADPHONES</text>
            </Box>
          </ChapterHero>
        }
      />
      <Box component="footer" sx={{ py: 3, bgcolor: "#edf3f4", borderTop: "1px solid #ccd9dc" }}>
        <Container maxWidth="lg">
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button component={RouterLink} to="/articles/input-process-output" startIcon={<ArrowBackRoundedIcon />} sx={{ textTransform: "none", minHeight: 44 }}>1.5 / Input, Process, Output</Button>
            <Button component={RouterLink} to="/articles/" sx={{ textTransform: "none", minHeight: 44 }}>All articles</Button>
          </Stack>
        </Container>
      </Box>
    </>
  );
}
