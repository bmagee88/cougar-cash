import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

type Trait = "aceInTheHole" | "proficient" | "normal" | "struggle" | "weakness";
type Effectiveness = "Super Effective" | "Effective" | "Not Effective";
type BattlePhase = "idle" | "menu" | "fight" | "switch" | "item" | "ended";

type HiddenSkill = {
  current: number;
  maxReached: number;
  growthPotential: number;
  trait: Trait;
};

type Move = {
  id: string;
  name: string;
  type: string;
  emoji: string;
  basePower: number;
  skillUsed: string;
  resistedBy: string;
  effects: string[];
};

type Creature = {
  id: string;
  name: string;
  emoji: string;
  type: string;
  hp: number;
  maxHp: number;
  level: string;
  hiddenSkills: Record<string, HiddenSkill>;
  moves: Move[];
};

type RollResult = {
  roll: number;
  rolls: number[];
  note: string;
  isImmune: boolean;
  isWeakness: boolean;
};

type RollBandData = {
  title: string;
  skillName: string;
  skillValue: number;
  trait: Trait;
  roll: number;
  note: string;
  effectiveness: Effectiveness;
};

type BattleMessage = {
  id: string;
  text: string;
  rollBar?: RollBandData;
};

type BattleLogEntry = BattleMessage;

const SIMULATION_ROUNDS = 50;

const DAMAGE_TYPES = [
  { type: "fire", emoji: "🔥", names: ["Cinderhorn Drake", "Ash Pup", "Ember Imp"] },
  { type: "cold", emoji: "❄️", names: ["Frostveil Lynx", "Snowcap Sprite", "Icehorn Cub"] },
  { type: "lightning", emoji: "⚡", names: ["Stormcoil Kirin", "Spark Hare", "Thunder Finch"] },
  { type: "poison", emoji: "☠️", names: ["Venomglade Asp", "Toxic Toad", "Bilewing Moth"] },
  { type: "acid", emoji: "🧪", names: ["Caustic Miremaw", "Slimejaw", "Sourbelly Newt"] },
  { type: "psychic", emoji: "🧠", names: ["Dreamglass Moth", "Mindmurmur", "Echo-Eye Fox"] },
  { type: "radiant", emoji: "☀️", names: ["Dawnmane Hart", "Glowtail", "Sunwisp Fawn"] },
  { type: "necrotic", emoji: "🌑", names: ["Gravesap Willow", "Bonecap", "Witherling"] },
  { type: "bludgeoning", emoji: "🪨", names: ["Granite Knuckleback", "Pebble Ox", "Hammerhorn"] },
  { type: "slashing", emoji: "🗡️", names: ["Razorvine Panther", "Bladeclaw", "Briar Fang"] },
  { type: "piercing", emoji: "🏹", names: ["Needlebeak Raptor", "Spine Imp", "Thornfin"] },
  { type: "thunder", emoji: "🔊", names: ["Boomshell Toad", "Echo Ram", "Sonic Beetle"] },
  { type: "force", emoji: "💥", names: ["Aether Bulwark", "Pulse Ray", "Kinetic Wisp"] },
] as const;

const DND_DAMAGE_TYPES = DAMAGE_TYPES.map((item) => item.type);
const UTILITY_SKILLS = ["bindingResist", "bodyControl", "focus", "recovery"];

function safeRandomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function chooseOne<T>(items: readonly T[]): T {
  return items[randomInt(0, items.length - 1)];
}

function chooseWeighted<T>(choices: Array<{ value: T; weight: number }>): T {
  const totalWeight = choices.reduce((sum, choice) => sum + choice.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const choice of choices) {
    roll -= choice.weight;
    if (roll <= 0) return choice.value;
  }
  return choices[choices.length - 1].value;
}

function makeDamageStatNames(type: string) {
  return { attack: `${type}Attack`, defense: `${type}Defense` };
}

function chooseGeneratedTrait(options: { isPrimaryType: boolean; statRole: "attack" | "defense" | "utility" }): Trait {
  const { isPrimaryType, statRole } = options;

  if (statRole === "attack") {
    return chooseWeighted<Trait>(
      isPrimaryType
        ? [
            { value: "proficient", weight: 22 },
            { value: "normal", weight: 73 },
            { value: "struggle", weight: 4 },
            { value: "weakness", weight: 1 },
          ]
        : [
            { value: "proficient", weight: 6 },
            { value: "normal", weight: 84 },
            { value: "struggle", weight: 8 },
            { value: "weakness", weight: 2 },
          ]
    );
  }

  if (statRole === "defense") {
    return chooseWeighted<Trait>(
      isPrimaryType
        ? [
            { value: "aceInTheHole", weight: 3 },
            { value: "proficient", weight: 18 },
            { value: "normal", weight: 73 },
            { value: "struggle", weight: 5 },
            { value: "weakness", weight: 1 },
          ]
        : [
            { value: "aceInTheHole", weight: 1 },
            { value: "proficient", weight: 8 },
            { value: "normal", weight: 82 },
            { value: "struggle", weight: 7 },
            { value: "weakness", weight: 2 },
          ]
    );
  }

  return chooseWeighted<Trait>([
    { value: "aceInTheHole", weight: 1 },
    { value: "proficient", weight: 10 },
    { value: "normal", weight: 78 },
    { value: "struggle", weight: 9 },
    { value: "weakness", weight: 2 },
  ]);
}

function randomGrowthPotential(isPrimaryType: boolean) {
  const roll = Math.random();
  if (isPrimaryType) {
    if (roll < 0.1) return Number((7 + Math.random()).toFixed(2));
    if (roll < 0.65) return Number((8 + Math.random()).toFixed(2));
    return Number((9 + Math.random()).toFixed(2));
  }
  if (roll < 0.05) return Number((3 + Math.random() * 2).toFixed(2));
  if (roll < 0.45) return Number((5 + Math.random() * 2).toFixed(2));
  if (roll < 0.85) return Number((7 + Math.random()).toFixed(2));
  return Number((8 + Math.random() * 2).toFixed(2));
}

function makeEmptySkill(growthPotential: number, trait: Trait): HiddenSkill {
  return { current: 0, maxReached: 0, growthPotential, trait };
}

function growthChance(skill: HiddenSkill) {
  const current = Math.floor(skill.current);
  const growthModifier = Math.max(0.05, 1 - Math.log10(1 + current) / Math.log10(1001));
  return (skill.growthPotential / 10) * growthModifier;
}

function growthPotentialMutationChance(skill: HiddenSkill) {
  const distanceFromCap = Math.max(0, 10 - skill.growthPotential);
  const currentPressure = Math.min(1, skill.current / 1000);
  return 0.0025 * (distanceFromCap / 10) * (0.5 + currentPressure);
}

function mutateGrowthPotential(growthPotential: number) {
  const improvement = 0.01 + Math.random() * 0.04;
  return Number(Math.min(10, growthPotential + improvement).toFixed(2));
}

function simulateInitialGrowth(hiddenSkills: Record<string, HiddenSkill>, checks = SIMULATION_ROUNDS) {
  const updatedSkills: Record<string, HiddenSkill> = { ...hiddenSkills };
  for (let i = 0; i < checks; i += 1) {
    Object.entries(updatedSkills).forEach(([skillName, skill]) => {
      let nextSkill = skill;
      if (Math.random() < growthChance(nextSkill)) {
        const current = Math.min(1000, nextSkill.current + 1);
        nextSkill = { ...nextSkill, current, maxReached: Math.max(nextSkill.maxReached, current) };
      }
      if (Math.random() < growthPotentialMutationChance(nextSkill)) {
        nextSkill = { ...nextSkill, growthPotential: mutateGrowthPotential(nextSkill.growthPotential) };
      }
      updatedSkills[skillName] = nextSkill;
    });
  }
  return updatedSkills;
}

function calculateCreatureLevel(hiddenSkills: Record<string, HiddenSkill>) {
  const values = Object.values(hiddenSkills).map((skill) => Math.floor(skill.current));
  if (values.length === 0) return "0:0:0";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = Math.floor(values.reduce((sum, value) => sum + value, 0) / values.length);
  return `${min}:${avg}:${max}`;
}

function makeMoves(type: string, emoji: string): Move[] {
  const attackSkill = `${type}Attack`;
  const defenseSkill = `${type}Defense`;
  return [
    { id: `${type}-jab`, name: `${emoji} Quick Strike`, type, emoji, basePower: 14, skillUsed: attackSkill, resistedBy: defenseSkill, effects: ["Fast damage", "Small chance to weaken the next defense"] },
    { id: `${type}-snare`, name: `${emoji} Binding Snare`, type, emoji, basePower: 10, skillUsed: attackSkill, resistedBy: "bindingResist", effects: ["Damage", "Short status pressure"] },
    { id: `${type}-guard-break`, name: `${emoji} Guard Break`, type, emoji, basePower: 18, skillUsed: attackSkill, resistedBy: defenseSkill, effects: ["Damage", "Temporarily lowers resistance"] },
    { id: `${type}-overload`, name: `${emoji} Overload`, type, emoji, basePower: 26, skillUsed: attackSkill, resistedBy: defenseSkill, effects: ["Heavy damage", "User risks self strain"] },
  ];
}

function generateCreature(): Creature {
  const config = chooseOne(DAMAGE_TYPES);
  const hp = randomInt(75, 125);
  let hiddenSkills: Record<string, HiddenSkill> = {};

  DND_DAMAGE_TYPES.forEach((type) => {
    const stats = makeDamageStatNames(type);
    const isPrimaryType = type === config.type;
    hiddenSkills[stats.attack] = makeEmptySkill(randomGrowthPotential(isPrimaryType), chooseGeneratedTrait({ isPrimaryType, statRole: "attack" }));
    hiddenSkills[stats.defense] = makeEmptySkill(randomGrowthPotential(isPrimaryType), chooseGeneratedTrait({ isPrimaryType, statRole: "defense" }));
  });

  UTILITY_SKILLS.forEach((skillName) => {
    hiddenSkills[skillName] = makeEmptySkill(randomGrowthPotential(false), chooseGeneratedTrait({ isPrimaryType: false, statRole: "utility" }));
  });

  hiddenSkills = simulateInitialGrowth(hiddenSkills, SIMULATION_ROUNDS);

  return {
    id: safeRandomId(),
    name: chooseOne(config.names),
    emoji: config.emoji,
    type: config.type,
    hp,
    maxHp: hp,
    level: calculateCreatureLevel(hiddenSkills),
    hiddenSkills,
    moves: makeMoves(config.type, config.emoji),
  };
}

function rollForTrait(trait: Trait): RollResult {
  if (trait === "aceInTheHole") return { roll: 1, rolls: [], note: "Ace in the Hole: immunity. No roll was needed.", isImmune: true, isWeakness: false };
  if (trait === "weakness") return { roll: 1000, rolls: [], note: "Weakness: automatic failure. No roll was needed.", isImmune: false, isWeakness: true };

  const first = randomInt(1, 1000);
  if (trait === "normal") return { roll: first, rolls: [first], note: `Normal trait: rolled ${first}.`, isImmune: false, isWeakness: false };

  const second = randomInt(1, 1000);
  if (trait === "proficient") {
    const lower = Math.min(first, second);
    return { roll: lower, rolls: [first, second], note: `Proficient trait: rolled ${first} and ${second}, then took the lower roll: ${lower}.`, isImmune: false, isWeakness: false };
  }

  const higher = Math.max(first, second);
  return { roll: higher, rolls: [first, second], note: `Struggle trait: rolled ${first} and ${second}, then took the higher roll: ${higher}.`, isImmune: false, isWeakness: false };
}

function getEffectiveness(skillValue: number, roll: number): Effectiveness {
  const superThreshold = Math.floor(skillValue / 2);
  const effectiveThreshold = Math.min(1000, superThreshold + 500);
  if (roll <= superThreshold) return "Super Effective";
  if (roll <= effectiveThreshold) return "Effective";
  return "Not Effective";
}

function getAttackMultiplier(effectiveness: Effectiveness) {
  if (effectiveness === "Super Effective") return 1.5;
  if (effectiveness === "Effective") return 1;
  return 0.75;
}

function getDefenseReduction(effectiveness: Effectiveness) {
  if (effectiveness === "Super Effective") return 0.5;
  if (effectiveness === "Effective") return 0.75;
  return 1;
}

function getBandThresholds(skillValue: number) {
  const superEnd = Math.floor(skillValue / 2);
  const effectiveEnd = Math.min(1000, superEnd + 500);
  return {
    superStart: 1,
    superEnd,
    effectiveStart: superEnd + 1,
    effectiveEnd,
    notEffectiveStart: effectiveEnd + 1,
    notEffectiveEnd: 1000,
  };
}

function describeBand(skillValue: number) {
  const bands = getBandThresholds(skillValue);
  return `Super Effective: ${bands.superStart}-${bands.superEnd}; Effective: ${bands.effectiveStart}-${bands.effectiveEnd}; Not Effective: ${bands.notEffectiveStart <= 1000 ? `${bands.notEffectiveStart}-1000` : "none"}.`;
}

function rollGrowth(skill: HiddenSkill) {
  return Math.random() < growthChance(skill);
}

function applySkillUse(creature: Creature, usedSkillName: string, didGrowUsedSkill: boolean) {
  const totalSkills = Object.keys(creature.hiddenSkills).length || 1;
  const decayAmount = 1 / totalSkills;
  const updatedSkills: Record<string, HiddenSkill> = {};

  Object.entries(creature.hiddenSkills).forEach(([skillName, skill]) => {
    let current = skill.current;
    let maxReached = skill.maxReached;

    if (skillName === usedSkillName && didGrowUsedSkill) {
      if (current < maxReached) {
        const catchUpStrength = 4;
        const catchUpMultiplier = 1 + (maxReached / 1000) * catchUpStrength;
        current = Math.min(1000, current + catchUpMultiplier);
      } else {
        current = Math.min(1000, current + 1);
        maxReached = Math.max(maxReached, current);
      }
    }

    if (skillName !== usedSkillName) current = Math.max(0, current - decayAmount);
    updatedSkills[skillName] = { ...skill, current, maxReached };
  });

  return { ...creature, hiddenSkills: updatedSkills, level: calculateCreatureLevel(updatedSkills) };
}

function getTraitSx(trait: Trait) {
  if (trait === "proficient") return { color: "success.main", fontWeight: 800 };
  if (trait === "struggle") return { color: "error.main", fontWeight: 800 };
  if (trait === "aceInTheHole") return { color: "info.main", fontWeight: 800 };
  if (trait === "weakness") return { color: "error.dark", fontWeight: 800 };
  return { color: "text.primary" };
}

function StyledBattleText({ text }: { text: string }) {
  const parts = text.split(/(Super Effective|Not Effective|Effective)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (part === "Super Effective") return <Box key={index} component="span" sx={{ fontWeight: 900 }}>{part}</Box>;
        if (part === "Not Effective") return <Box key={index} component="span" sx={{ fontStyle: "italic" }}>{part}</Box>;
        if (part === "Effective") return <Box key={index} component="span" sx={{ textDecoration: "underline" }}>{part}</Box>;
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </>
  );
}

function RollBandBar({ data }: { data: RollBandData }) {
  const bands = getBandThresholds(data.skillValue);
  const superWidth = (Math.max(0, bands.superEnd) / 1000) * 100;
  const effectiveWidth = (Math.max(0, bands.effectiveEnd - bands.effectiveStart + 1) / 1000) * 100;
  const notEffectiveWidth = (Math.max(0, 1000 - bands.notEffectiveStart + 1) / 1000) * 100;
  const rollLeft = Math.min(100, Math.max(0, (data.roll / 1000) * 100));

  return (
    <Box sx={{ mt: 1.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
        <Typography variant="caption" fontWeight={800}>{data.title}: {data.skillName}</Typography>
        <Typography variant="caption">Roll {data.roll} | Skill {data.skillValue} | Trait {data.trait}</Typography>
      </Stack>
      <Box sx={{ position: "relative", pt: 2, pb: 0.5 }}>
        <Box sx={{ position: "absolute", left: `${rollLeft}%`, top: 0, transform: "translateX(-50%)", fontSize: 18, lineHeight: 1 }}>▼</Box>
        <Stack direction="row" sx={{ height: 18, borderRadius: 999, overflow: "hidden", border: "1px solid", borderColor: "divider" }}>
          <Box sx={{ width: `${superWidth}%`, bgcolor: "success.light" }} />
          <Box sx={{ width: `${effectiveWidth}%`, bgcolor: "warning.light" }} />
          <Box sx={{ width: `${notEffectiveWidth}%`, bgcolor: "error.light" }} />
        </Stack>
      </Box>
      <Stack direction="row" justifyContent="space-between" gap={1} flexWrap="wrap">
        <Typography variant="caption"><strong>Super Effective</strong>: {bands.superStart}-{bands.superEnd}</Typography>
        <Typography variant="caption"><span style={{ textDecoration: "underline" }}>Effective</span>: {bands.effectiveStart}-{bands.effectiveEnd}</Typography>
        <Typography variant="caption"><em>Not Effective</em>: {bands.notEffectiveStart <= 1000 ? `${bands.notEffectiveStart}-1000` : "none"}</Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary">{data.note}</Typography>
    </Box>
  );
}

function CreatureStatsDialog({ creature, onClose }: { creature: Creature | null; onClose: () => void }) {
  const groupedSkills = creature
    ? {
        "Damage Attack": Object.entries(creature.hiddenSkills).filter(([skillName]) => skillName.endsWith("Attack")),
        "Damage Defense": Object.entries(creature.hiddenSkills).filter(([skillName]) => skillName.endsWith("Defense")),
        Utility: Object.entries(creature.hiddenSkills).filter(([skillName]) => !skillName.endsWith("Attack") && !skillName.endsWith("Defense")),
      }
    : {};

  return (
    <Dialog open={Boolean(creature)} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>{creature ? `${creature.emoji} ${creature.name} Stats` : "Creature Stats"}</DialogTitle>
      <DialogContent>
        {creature && (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Card variant="outlined">
              <CardContent>
                <Stack direction={{ xs: "column", sm: "row" }} gap={1} justifyContent="space-between">
                  <Box>
                    <Typography variant="h5" fontWeight={800}>{creature.emoji} {creature.name}</Typography>
                    <Typography color="text.secondary">Type: {creature.type}</Typography>
                  </Box>
                  <Stack direction="row" gap={1} flexWrap="wrap">
                    <Chip label={`Level ${creature.level}`} />
                    <Chip label={`HP ${creature.hp}/${creature.maxHp}`} />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
            {Object.entries(groupedSkills).map(([groupName, skills]) => (
              <TableContainer key={groupName} component={Paper} variant="outlined">
                <Typography variant="subtitle1" fontWeight={800} sx={{ px: 2, pt: 2 }}>{groupName}</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Skill</TableCell>
                      <TableCell align="right">Current</TableCell>
                      <TableCell align="right">Used Value</TableCell>
                      <TableCell align="right">Max Reached</TableCell>
                      <TableCell align="right">Growth</TableCell>
                      <TableCell>Trait</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {skills.map(([skillName, skill]:[string, HiddenSkill]) => (
                      <TableRow key={skillName}>
                        <TableCell>{skillName}</TableCell>
                        <TableCell align="right" sx={{ minWidth: 150 }}>
                          <Typography variant="caption">{skill.current.toFixed(2)}</Typography>
                          <LinearProgress variant="determinate" value={Math.min(100, (skill.current / 1000) * 100)} sx={{ height: 7, borderRadius: 999, mt: 0.5 }} />
                        </TableCell>
                        <TableCell align="right">{Math.floor(skill.current)}</TableCell>
                        <TableCell align="right">{skill.maxReached.toFixed(2)}</TableCell>
                        <TableCell align="right" sx={{ minWidth: 150 }}>
                          <Typography variant="caption">{skill.growthPotential.toFixed(2)}/10</Typography>
                          <LinearProgress variant="determinate" value={Math.min(100, (skill.growthPotential / 10) * 100)} sx={{ height: 7, borderRadius: 999, mt: 0.5 }} />
                        </TableCell>
                        <TableCell><Typography variant="body2" sx={getTraitSx(skill.trait)}>{skill.trait}</Typography></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ))}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BattleTextBox({ messages, onAdvance, devMode }: { messages: BattleMessage[]; onAdvance: () => void; devMode: boolean }) {
  const [visibleText, setVisibleText] = useState("");
  const currentMessage = messages[0];
  const currentText = currentMessage?.text ?? "";

  useEffect(() => {
    setVisibleText("");
    if (!currentText) return;
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setVisibleText(currentText.slice(0, index));
      if (index >= currentText.length) window.clearInterval(timer);
    }, 1);
    return () => window.clearInterval(timer);
  }, [currentText]);

  if (!currentMessage) return null;
  const isFinishedTyping = visibleText.length >= currentText.length;

  return (
    <Paper
      onClick={() => {
        if (isFinishedTyping) onAdvance();
        else setVisibleText(currentText);
      }}
      sx={{ p: 2, borderRadius: 3, border: "3px solid", borderColor: "text.primary", cursor: "pointer", bgcolor: "background.paper", boxShadow: 6 }}
    >
      <Typography variant="body1" fontWeight={700} sx={{ minHeight: 56 }}><StyledBattleText text={visibleText} /></Typography>
      {devMode && isFinishedTyping && currentMessage.rollBar && <RollBandBar data={currentMessage.rollBar} />}
      <Typography variant="caption" color="text.secondary">{isFinishedTyping ? "Click for next" : "Click to finish text"}</Typography>
    </Paper>
  );
}

function CreatureCard({ creature, title, onViewStats, devMode }: { creature: Creature | null; title: string; onViewStats: (creature: Creature) => void; devMode: boolean }) {
  if (!creature) {
    return (
      <Card variant="outlined" sx={{ minHeight: 190 }}>
        <CardContent>
          <Typography variant="h6">{title}</Typography>
          <Typography color="text.secondary">Empty</Typography>
        </CardContent>
      </Card>
    );
  }

  const hpPercent = Math.max(0, (creature.hp / creature.maxHp) * 100);

  return (
    <Card variant="outlined" sx={{ minHeight: 190 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
          <Typography variant="h6">{title}</Typography>
          <Chip label={creature.level} size="small" />
        </Stack>
        <Typography variant="h3" sx={{ my: 1 }}>{creature.emoji}</Typography>
        <Typography variant="subtitle1" fontWeight={700}>{creature.name}</Typography>
        <Typography variant="body2" color="text.secondary">Type: {creature.type}</Typography>
        {devMode && <Button size="small" sx={{ mt: 1 }} onClick={() => onViewStats(creature)}>View Stats</Button>}
        <Box sx={{ mt: 1 }}>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="caption">HP</Typography>
            <Typography variant="caption">{creature.hp}/{creature.maxHp}</Typography>
          </Stack>
          <LinearProgress variant="determinate" value={hpPercent} sx={{ height: 8, borderRadius: 999 }} />
        </Box>
      </CardContent>
    </Card>
  );
}

function SmallCreatureRow({ creature, actions, onViewStats, devMode }: { creature: Creature; actions: React.ReactNode; onViewStats: (creature: Creature) => void; devMode: boolean }) {
  return (
    <ListItem
      divider
      secondaryAction={
        <Stack direction="row" gap={1} alignItems="center">
          {devMode && <Button size="small" onClick={() => onViewStats(creature)}>Stats</Button>}
          {actions}
        </Stack>
      }
      sx={{ alignItems: "flex-start", pr: 18 }}
    >
      <ListItemText primary={`${creature.emoji} ${creature.name}`} secondary={devMode ? `Type: ${creature.type} | Level: ${creature.level} | HP: ${creature.hp}/${creature.maxHp}` : `Type: ${creature.type} | HP: ${creature.hp}/${creature.maxHp}`} />
    </ListItem>
  );
}

function runSelfTests() {
  return [
    {
      name: "skill 600 creates expected bands",
      pass: JSON.stringify(getBandThresholds(600)) === JSON.stringify({ superStart: 1, superEnd: 300, effectiveStart: 301, effectiveEnd: 800, notEffectiveStart: 801, notEffectiveEnd: 1000 }),
    },
    {
      name: "attack damage is calculated before defense reduction",
      pass: Math.floor(Math.floor(20 * getAttackMultiplier("Super Effective")) * getDefenseReduction("Effective")) === 22,
    },
    {
      name: "level display uses min:average:max",
      pass: calculateCreatureLevel({ a: { current: 100.9, maxReached: 100.9, growthPotential: 5, trait: "normal" }, b: { current: 500.1, maxReached: 500.1, growthPotential: 5, trait: "normal" }, c: { current: 900.8, maxReached: 900.8, growthPotential: 5, trait: "normal" } }) === "100:500:900",
    },
    {
      name: "not effective attack modifier is 0.75",
      pass: getAttackMultiplier("Not Effective") === 0.75,
    },
    {
      name: "ace in the hole is immunity",
      pass: rollForTrait("aceInTheHole").isImmune === true,
    },
  ];
}

export default function SoulCollectorBattlePrototype() {
  const [wildCreatures, setWildCreatures] = useState<Creature[]>([]);
  const [necklace, setNecklace] = useState<Creature[]>([]);
  const [playerCreature, setPlayerCreature] = useState<Creature | null>(null);
  const [opponentCreature, setOpponentCreature] = useState<Creature | null>(null);
  const [phase, setPhase] = useState<BattlePhase>("idle");
  const [battleLog, setBattleLog] = useState<BattleLogEntry[]>([]);
  const [selectedSwitchId, setSelectedSwitchId] = useState("");
  const [statsCreature, setStatsCreature] = useState<Creature | null>(null);
  const [battleMessages, setBattleMessages] = useState<BattleMessage[]>([]);
  const [devMode, setDevMode] = useState(true);

  const necklaceHasSpace = necklace.length < 6;
  const battleReady = Boolean(playerCreature && opponentCreature);
  const selfTests = useMemo(() => runSelfTests(), []);

  const makeBattleMessage = (text: string, rollBar?: RollBandData): BattleMessage => ({ id: safeRandomId(), text, rollBar });

  const addLog = (message: string | BattleMessage) => {
    const entry = typeof message === "string" ? makeBattleMessage(message) : message;
    setBattleLog((prev) => [entry, ...prev].slice(0, 30));
  };

  const addBattleMessages = (messages: Array<string | BattleMessage>) => {
    const normalizedMessages = messages.map((message) => (typeof message === "string" ? makeBattleMessage(message) : message));
    normalizedMessages.forEach(addLog);
    setBattleMessages((prev) => [...prev, ...normalizedMessages]);
  };

  const advanceBattleMessage = () => setBattleMessages((prev) => prev.slice(1));

  const generateWildCreature = () => {
    const creature = generateCreature();
    setWildCreatures((prev) => [creature, ...prev]);
    addLog(`A wild ${creature.emoji} ${creature.name} appeared.`);
  };

  const moveWildToOpponent = (creature: Creature) => {
    setWildCreatures((prev) => prev.filter((item) => item.id !== creature.id));
    setOpponentCreature(creature);
    setPhase(playerCreature ? "menu" : "idle");
    addLog(`${creature.name} moved into the opponent slot.`);
  };

  const moveWildToNecklace = (creature: Creature) => {
    if (!necklaceHasSpace) {
      addLog("The soul necklace is full. Release a soul before collecting another.");
      return;
    }
    setWildCreatures((prev) => prev.filter((item) => item.id !== creature.id));
    setNecklace((prev) => [...prev, creature]);
    addLog(`${creature.name}'s soul was added to the necklace.`);
  };

  const moveNecklaceToPlayerSlot = (creature: Creature) => {
    setNecklace((prev) => prev.filter((item) => item.id !== creature.id));
    if (playerCreature) {
      setNecklace((prev) => [...prev, playerCreature]);
      addLog(`${playerCreature.name} returned to the soul necklace.`);
    }
    setPlayerCreature(creature);
    setPhase(opponentCreature ? "menu" : "idle");
    addLog(`${creature.name} entered your battle slot.`);
  };

  const releaseSoul = (creature: Creature) => {
    setNecklace((prev) => prev.filter((item) => item.id !== creature.id));
    addLog(`${creature.name}'s soul was released.`);
  };

  const runFromBattle = () => {
    if (!playerCreature) return;
    if (necklace.length < 6) {
      setNecklace((prev) => [...prev, playerCreature]);
      addLog(`${playerCreature.name} returned to the necklace. You ran from battle.`);
    } else {
      addLog(`${playerCreature.name} left the battle slot, but the necklace is full. The soul disperses.`);
    }
    setPlayerCreature(null);
    setPhase("idle");
  };

  const performAttack = (attacker: Creature, defender: Creature, move: Move) => {
    const attackSkill = attacker.hiddenSkills[move.skillUsed];
    const defenseSkill = defender.hiddenSkills[move.resistedBy];
    const usableAttackSkill = Math.floor(attackSkill?.current ?? 250);
    const usableDefenseSkill = Math.floor(defenseSkill?.current ?? 250);
    const attackTrait = attackSkill?.trait ?? "normal";
    const defenseTrait = defenseSkill?.trait ?? "normal";

    const attackRoll = rollForTrait(attackTrait);
    const attackEffectiveness = getEffectiveness(usableAttackSkill, attackRoll.roll);
    const attackMultiplier = getAttackMultiplier(attackEffectiveness);
    const defenseRoll = rollForTrait(defenseTrait);
    const defenseEffectiveness = defenseRoll.isImmune ? "Super Effective" : getEffectiveness(usableDefenseSkill, defenseRoll.roll);
    const defenseReduction = defenseRoll.isImmune ? 0 : getDefenseReduction(defenseEffectiveness);
    const rawDamage = Math.max(1, Math.floor(move.basePower * attackMultiplier));
    const damage = Math.max(0, Math.floor(rawDamage * defenseReduction));
    const didAttackSkillGrow = attackSkill ? rollGrowth(attackSkill) : false;
    const defendedSuccessfully = defenseRoll.isImmune || defenseEffectiveness !== "Not Effective";
    const didDefenseSkillGrow = defenseSkill && defendedSuccessfully ? rollGrowth(defenseSkill) : false;
    const updatedAttacker = applySkillUse(attacker, move.skillUsed, didAttackSkillGrow);
    const defenderAfterGrowth = defenseSkill ? applySkillUse(defender, move.resistedBy, Boolean(didDefenseSkillGrow)) : defender;
    const updatedDefender = { ...defenderAfterGrowth, hp: Math.max(0, defenderAfterGrowth.hp - damage) };

    const attackRollBar: RollBandData = { title: "Attack Roll", skillName: move.skillUsed, skillValue: usableAttackSkill, trait: attackTrait, roll: attackRoll.roll, note: attackRoll.note, effectiveness: attackEffectiveness };
    const defenseRollBar: RollBandData = { title: "Defense Roll", skillName: move.resistedBy, skillValue: usableDefenseSkill, trait: defenseTrait, roll: defenseRoll.roll, note: defenseRoll.note, effectiveness: defenseEffectiveness };

    const devMessages: BattleMessage[] = [
      makeBattleMessage(`${attacker.emoji} ${attacker.name} used ${move.name} on ${defender.emoji} ${defender.name}.`),
      makeBattleMessage(`ATTACK: ${move.skillUsed} was ${attackSkill?.current.toFixed(2) ?? "missing"}, so the battle value was ${usableAttackSkill}. ${describeBand(usableAttackSkill)} Trait: ${attackTrait}. Outcome: ${attackEffectiveness}. Base power ${move.basePower} × ${attackMultiplier} = ${rawDamage} raw damage.`, attackRollBar),
      makeBattleMessage(
        defenseRoll.isImmune
          ? `DEFENSE: ${move.resistedBy} was ${defenseSkill?.current.toFixed(2) ?? "missing"}, so the battle value was ${usableDefenseSkill}. Trait: ${defenseTrait}. Ace in the Hole gave immunity, so raw damage ${rawDamage} became 0 final damage.`
          : `DEFENSE: ${move.resistedBy} was ${defenseSkill?.current.toFixed(2) ?? "missing"}, so the battle value was ${usableDefenseSkill}. ${describeBand(usableDefenseSkill)} Trait: ${defenseTrait}. Outcome: ${defenseEffectiveness}. Raw damage ${rawDamage} × defense multiplier ${defenseReduction} = ${damage} final damage.`,
        defenseRollBar
      ),
      makeBattleMessage(`${defender.name} HP: ${defender.hp} -> ${updatedDefender.hp}.`),
      makeBattleMessage(didAttackSkillGrow ? `${attacker.name}'s ${move.skillUsed} improved after the attempt. New level display: ${updatedAttacker.level}.` : `${attacker.name}'s ${move.skillUsed} did not improve this time. New level display after decay: ${updatedAttacker.level}.`),
      makeBattleMessage(
        defendedSuccessfully
          ? didDefenseSkillGrow
            ? `${defender.name} successfully defended, so ${move.resistedBy} was eligible for growth and improved. New level display: ${updatedDefender.level}.`
            : `${defender.name} successfully defended, so ${move.resistedBy} was eligible for growth, but it did not improve. New level display after decay: ${updatedDefender.level}.`
          : `${defender.name} did not successfully defend, so ${move.resistedBy} was not eligible for growth.`
      ),
    ];

    const userMessages: BattleMessage[] = [
      makeBattleMessage(`${attacker.emoji} ${attacker.name} used ${move.name}!`),
      makeBattleMessage(defenseRoll.isImmune ? `${defender.emoji} ${defender.name} was immune!` : `It was ${attackEffectiveness}. ${defender.name} took ${damage} damage.`),
      makeBattleMessage(`${defender.name} HP: ${defender.hp} -> ${updatedDefender.hp}.`),
    ];

    const messages = devMode ? devMessages : userMessages;

    return { updatedAttacker, updatedDefender, messages };
  };

  const handlePlayerMove = (move: Move) => {
    if (!playerCreature || !opponentCreature) return;
    const playerResult = performAttack(playerCreature, opponentCreature, move);
    addBattleMessages(playerResult.messages);

    if (playerResult.updatedDefender.hp <= 0) {
      setPlayerCreature(playerResult.updatedAttacker);
      setOpponentCreature(null);
      setPhase("ended");
      addBattleMessages([`${opponentCreature.name} fainted.`]);
      return;
    }

    const opponentMove = chooseOne(playerResult.updatedDefender.moves);
    const opponentResult = performAttack(playerResult.updatedDefender, playerResult.updatedAttacker, opponentMove);
    addBattleMessages([`${playerResult.updatedDefender.name} chose ${opponentMove.name}.`, ...opponentResult.messages]);

    if (opponentResult.updatedDefender.hp <= 0) {
      addBattleMessages([`${playerCreature.name} fainted.`]);
      if (necklace.length > 0) {
        const nextCreature = necklace[0];
        setNecklace((prev) => prev.slice(1));
        setPlayerCreature(nextCreature);
        setOpponentCreature(opponentResult.updatedAttacker);
        setPhase("menu");
        addBattleMessages([`${nextCreature.name} was pulled from the necklace into battle.`]);
      } else {
        setPlayerCreature(null);
        setOpponentCreature(opponentResult.updatedAttacker);
        setPhase("ended");
        addBattleMessages(["You are out of creatures in your necklace."]);
      }
      return;
    }

    setPlayerCreature(opponentResult.updatedDefender);
    setOpponentCreature(opponentResult.updatedAttacker);
    setPhase("menu");
  };

  const confirmSwitch = () => {
    if (!selectedSwitchId || !playerCreature) return;
    const incoming = necklace.find((creature) => creature.id === selectedSwitchId);
    if (!incoming) return;
    setNecklace((prev) => [...prev.filter((creature) => creature.id !== selectedSwitchId), playerCreature]);
    setPlayerCreature(incoming);
    setSelectedSwitchId("");
    setPhase("menu");
    addLog(`${incoming.name} switched into battle.`);
  };

  const menuDisabled = !battleReady || phase === "ended";
  const battleStatus = useMemo(() => {
    if (!playerCreature && necklace.length === 0) return "You need a soul creature in your necklace or battle slot.";
    if (!playerCreature) return "Choose a creature from your necklace for your battle slot.";
    if (!opponentCreature) return "Choose a wild creature for the opponent slot.";
    if (phase === "ended") return "Battle ended.";
    return "Choose an action.";
  }, [playerCreature, opponentCreature, necklace.length, phase]);

  return (
    <Box sx={{ p: 2, maxWidth: 1300, mx: "auto" }}>
      <Stack spacing={2}>
        <Paper sx={{ p: 2, borderRadius: 3 }}>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2}>
            <Box>
              <Typography variant="h4" fontWeight={800}>Soul Collector Battle Prototype</Typography>
              <Typography color="text.secondary">Generate wild creatures, collect up to 6 soul stones, and battle with detailed hidden-stat rolls.</Typography>
            </Box>
            <Stack direction="row" alignItems="center" gap={2}>
              <FormControlLabel
                control={<Switch checked={devMode} onChange={(event) => setDevMode(event.target.checked)} />}
                label={devMode ? "Dev Mode" : "User Mode"}
              />
              <Button variant="contained" size="large" onClick={generateWildCreature}>Generate Wild Creature</Button>
            </Stack>
          </Stack>
        </Paper>

        {devMode && (
          <Paper sx={{ p: 2, borderRadius: 3 }}>
            <Typography variant="subtitle1" fontWeight={800}>Calculation Check</Typography>
            <Typography variant="body2" color="text.secondary">Damage order: base power × attack effectiveness = raw damage, then raw damage × defense effectiveness = final damage.</Typography>
            <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1 }}>
              {selfTests.map((test) => <Chip key={test.name} color={test.pass ? "success" : "error"} label={`${test.pass ? "PASS" : "FAIL"}: ${test.name}`} />)}
            </Stack>
          </Paper>
        )}

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}><CreatureCard title="Your Battle Slot" creature={playerCreature} onViewStats={setStatsCreature} devMode={devMode} /></Grid>
          <Grid item xs={12} md={6}><CreatureCard title="Opponent Slot" creature={opponentCreature} onViewStats={setStatsCreature} devMode={devMode} /></Grid>
        </Grid>

        <BattleTextBox messages={battleMessages} onAdvance={advanceBattleMessage} devMode={devMode} />

        <Paper sx={{ p: 2, borderRadius: 3 }}>
          <Typography variant="h6" gutterBottom>Battle Menu</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>{battleStatus}</Typography>

          {phase !== "fight" && phase !== "switch" && (
            <Stack direction="row" flexWrap="wrap" gap={1}>
              <Button variant="contained" disabled={menuDisabled} onClick={() => setPhase("fight")}>Fight</Button>
              <Button variant="outlined" disabled={!playerCreature || necklace.length === 0} onClick={() => setPhase("switch")}>Switch</Button>
              <Button variant="outlined" disabled={!playerCreature} onClick={runFromBattle}>Run</Button>
              <Button variant="outlined" disabled={menuDisabled} onClick={() => { setPhase("item"); addLog("Items do nothing yet."); }}>Item</Button>
            </Stack>
          )}

          {phase === "fight" && playerCreature && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>Choose a move</Typography>
              <Grid container spacing={1} sx={{ mt: 1 }}>
                {playerCreature.moves.map((move) => (
                  <Grid item xs={12} sm={6} md={3} key={move.id}>
                    <Button fullWidth variant="contained" onClick={() => handlePlayerMove(move)} sx={{ minHeight: 84, alignItems: "flex-start", justifyContent: "flex-start", textAlign: "left" }}>
                      <Box>
                        <Typography fontWeight={800}>{move.name}</Typography>
                        <Typography variant="caption">Power {move.basePower}</Typography>
                      </Box>
                    </Button>
                  </Grid>
                ))}
              </Grid>
              <Button sx={{ mt: 1 }} onClick={() => setPhase("menu")}>Back</Button>
            </Box>
          )}

          {phase === "switch" && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>Choose a soul to switch in</Typography>
              <Stack direction={{ xs: "column", sm: "row" }} gap={1} sx={{ mt: 1 }}>
                <Select value={selectedSwitchId} displayEmpty onChange={(event) => setSelectedSwitchId(event.target.value)} sx={{ minWidth: 280 }}>
                  <MenuItem value="" disabled>Select creature</MenuItem>
                  {necklace.map((creature) => <MenuItem key={creature.id} value={creature.id}>{creature.emoji} {creature.name} | {creature.level}</MenuItem>)}
                </Select>
                <Button variant="contained" disabled={!selectedSwitchId} onClick={confirmSwitch}>Confirm Switch</Button>
                <Button onClick={() => setPhase("menu")}>Cancel</Button>
              </Stack>
            </Box>
          )}
        </Paper>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, borderRadius: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">Soul Necklace</Typography>
                <Chip label={`${necklace.length}/6 soul stones`} />
              </Stack>
              <Divider sx={{ my: 1 }} />

              {necklace.length === 0 ? (
                <Typography color="text.secondary">No souls collected yet.</Typography>
              ) : (
                <List dense>
                  {necklace.map((creature) => (
                    <SmallCreatureRow
                      key={creature.id}
                      creature={creature}
                      onViewStats={setStatsCreature}
                      devMode={devMode}
                      actions={
                        <>
                          <Button size="small" onClick={() => moveNecklaceToPlayerSlot(creature)}>
                            Use
                          </Button>
                          <Button size="small" color="error" onClick={() => releaseSoul(creature)}>
                            Release
                          </Button>
                        </>
                      }
                    />
                  ))}
                </List>
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, borderRadius: 3 }}>
              <Typography variant="h6">Wild Creatures</Typography>
              <Divider sx={{ my: 1 }} />

              {wildCreatures.length === 0 ? (
                <Typography color="text.secondary">No wild creatures generated.</Typography>
              ) : (
                <List dense>
                  {wildCreatures.map((creature) => (
                    <SmallCreatureRow
                      key={creature.id}
                      creature={creature}
                      onViewStats={setStatsCreature}
                      devMode={devMode}
                      actions={
                        <>
                          <Button size="small" onClick={() => moveWildToOpponent(creature)}>
                            Battle
                          </Button>
                          <Button size="small" disabled={!necklaceHasSpace} onClick={() => moveWildToNecklace(creature)}>
                            Collect
                          </Button>
                        </>
                      }
                    />
                  ))}
                </List>
              )}
            </Paper>
          </Grid>
        </Grid>

        <Paper sx={{ p: 2, borderRadius: 3 }}>
          <Typography variant="h6">Battle Log</Typography>
          <Divider sx={{ my: 1 }} />

          {battleLog.length === 0 ? (
            <Typography color="text.secondary">No events yet.</Typography>
          ) : (
            <Stack spacing={1}>
              {battleLog.map((entry) => (
                <Box key={entry.id} sx={{ borderBottom: "1px solid", borderColor: "divider", pb: 1 }}>
                  <Typography variant="body2">
                    • <StyledBattleText text={entry.text} />
                  </Typography>
                  {entry.rollBar && <RollBandBar data={entry.rollBar} />}
                </Box>
              ))}
            </Stack>
          )}
        </Paper>
      </Stack>

      <CreatureStatsDialog creature={statsCreature} onClose={() => setStatsCreature(null)} />
    </Box>
  );
}