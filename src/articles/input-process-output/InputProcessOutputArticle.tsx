import { Box, Button, Container, Stack, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { Link as RouterLink } from "react-router-dom";
import ScrollyArticle from "../components/ScrollyArticle";
import { inputProcessOutputChapter } from "./inputProcessOutputChapter";
import { ChipIllustration, Keyboard } from "./ComputingDiagram";

export default function InputProcessOutputArticle() {
  return <ScrollyArticle chapter={inputProcessOutputChapter} hero={<ComputingHero />} />;
}

function ComputingHero() {
  return (
    <Box component="header" sx={{ borderBottom: "1px solid #ccd9dc", backgroundColor: "#edf3f4", overflow: "hidden" }}>
      <Container maxWidth="lg" sx={{ pt: { xs: 2, md: 3 }, pb: { xs: 3, md: 4 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} sx={{ mb: { xs: 4, md: 5 } }}>
          <Button component={RouterLink} to="/articles/" startIcon={<ArrowBackRoundedIcon />} sx={{ color: "#32545b", textTransform: "none", fontWeight: 700, minHeight: 44 }}>All articles</Button>
          <Typography sx={{ fontSize: 14, color: "#52635f", whiteSpace: "nowrap" }}>7 min read</Typography>
        </Stack>
        <Typography sx={{ color: "#007078", fontSize: 14, fontWeight: 800, mb: 1.5 }}>Computers, Devices, and Cables / 1.5</Typography>
        <Typography component="h1" sx={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: { xs: 40, sm: 56, md: 72 }, lineHeight: 1.05, maxWidth: 1000, letterSpacing: 0 }}>Input, Process, Output</Typography>
        <Typography sx={{ mt: 2, maxWidth: 760, fontSize: { xs: 18, md: 21 }, lineHeight: 1.7, color: "#3f4f4b" }}>{inputProcessOutputChapter.dek}</Typography>
        <Box component="svg" viewBox="0 0 900 230" role="img" aria-label="A keyboard supplies input, a processor follows instructions, and a screen displays output." sx={{ width: "100%", display: "block", mt: { xs: 3, md: 4 }, maxHeight: 230 }}>
          <Keyboard x={47} y={77} />
          <path d="M 260 120 H 403 M 498 120 H 640" stroke="#91abb2" strokeWidth="3" fill="none" />
          <path d="M 390 111 L 403 120 L 390 129 M 627 111 L 640 120 L 627 129" stroke="#91abb2" strokeWidth="3" fill="none" />
          <ChipIllustration x={414} y={84} />
          <rect x="657" y="51" width="189" height="119" fill="#263a40" rx="6" />
          <rect x="668" y="62" width="167" height="97" fill="#e0e8f8" rx="2" />
          <text x="751" y="126" textAnchor="middle" fill="#365596" fontSize="42" fontWeight="800">8</text>
          <path d="M 751 170 V 187 M 720 188 H 783" stroke="#263a40" strokeWidth="7" />
          <text x="146" y="213" textAnchor="middle" fill="#007078" fontSize="20" fontWeight="800">INPUT</text>
          <text x="450" y="213" textAnchor="middle" fill="#8c2e50" fontSize="20" fontWeight="800">PROCESS</text>
          <text x="751" y="213" textAnchor="middle" fill="#365596" fontSize="20" fontWeight="800">OUTPUT</text>
          <text x="329" y="101" textAnchor="middle" fill="#007078" fontSize="24" fontWeight="800">4</text>
          <text x="568" y="100" textAnchor="middle" fill="#8c2e50" fontSize="18" fontWeight="700">Double</text>
        </Box>
      </Container>
    </Box>
  );
}
