import type { Creature, HiddenSkill, Move, Trait } from "./types";
import {
  DAMAGE_TYPES,
  DND_DAMAGE_TYPES,
  SIMULATION_ROUNDS,
  UTILITY_SKILLS,
} from "./data";
import { chooseOne, chooseWeighted, randomInt, safeRandomId } from "./random";

export function makeDamageStatNames(type: string) {
  return { attack: `${type}Attack`, defense: `${type}Defense` };
}

export function chooseGeneratedTrait(options: {
  isPrimaryType: boolean;
  statRole: "attack" | "defense" | "utility";
}): Trait {
  const { isPrimaryType, statRole } = options;

  if (statRole === "attack") {
    return chooseWeighted<Trait>(
      isPrimaryType
        ? [
            { value: "adept", weight: 7 },
            { value: "proficient", weight: 22 },
            { value: "normal", weight: 61 },
            { value: "struggle", weight: 7 },
            { value: "weakness", weight: 3 },
          ]
        : [
            { value: "adept", weight: 3 },
            { value: "proficient", weight: 10 },
            { value: "normal", weight: 74 },
            { value: "struggle", weight: 9 },
            { value: "weakness", weight: 4 },
          ],
    );
  }

  if (statRole === "defense") {
    return chooseWeighted<Trait>(
      isPrimaryType
        ? [
            { value: "resistance", weight: 7 },
            { value: "proficient", weight: 22 },
            { value: "normal", weight: 61 },
            { value: "struggle", weight: 7 },
            { value: "weakness", weight: 3 },
          ]
        : [
            { value: "resistance", weight: 3 },
            { value: "proficient", weight: 10 },
            { value: "normal", weight: 74 },
            { value: "struggle", weight: 9 },
            { value: "weakness", weight: 4 },
          ],
    );
  }

  return chooseWeighted<Trait>([
    { value: "mastery", weight: 4 },
    { value: "proficient", weight: 19 },
    { value: "normal", weight: 69 },
    { value: "struggle", weight: 6 },
    { value: "weakness", weight: 2 },
  ]);
}

export function randomGrowthPotential(isPrimaryType: boolean) {
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

export function makeEmptySkill(
  growthPotential: number,
  trait: Trait,
): HiddenSkill {
  return { current: 0, maxReached: 0, growthPotential, trait };
}

export function growthChance(skill: HiddenSkill) {
  const current = Math.floor(skill.current);
  const normalizedSkill = current / 1000;

  const curvePower = 4;
  const logStrength = 100;
  const minimumModifier = 0.03;

  const logDrop =
    Math.log10(1 + logStrength * Math.pow(normalizedSkill, curvePower)) /
    Math.log10(1 + logStrength);

  const growthModifier = Math.max(
    minimumModifier,
    1 - logDrop
  );

  return (skill.growthPotential / 10) * growthModifier;
}

export function growthPotentialMutationChance(skill: HiddenSkill) {
  const distanceFromCap = Math.max(0, 10 - skill.growthPotential);
  const currentPressure = Math.min(1, skill.current / 1000);
  return 0.0025 * (distanceFromCap / 10) * (0.5 + currentPressure);
}

export function mutateGrowthPotential(growthPotential: number) {
  const improvement = 0.01 + Math.random() * 0.04;
  return Number(Math.min(10, growthPotential + improvement).toFixed(2));
}

export function simulateInitialGrowth(
  hiddenSkills: Record<string, HiddenSkill>,
  checks = SIMULATION_ROUNDS,
) {
  const updatedSkills: Record<string, HiddenSkill> = { ...hiddenSkills };
  for (let i = 0; i < checks; i += 1) {
    Object.entries(updatedSkills).forEach(([skillName, skill]) => {
      let nextSkill = skill;
      if (Math.random() < growthChance(nextSkill)) {
        const current = Math.min(1000, nextSkill.current + 1);
        nextSkill = {
          ...nextSkill,
          current,
          maxReached: Math.max(nextSkill.maxReached, current),
        };
      }
      if (Math.random() < growthPotentialMutationChance(nextSkill)) {
        nextSkill = {
          ...nextSkill,
          growthPotential: mutateGrowthPotential(nextSkill.growthPotential),
        };
      }
      updatedSkills[skillName] = nextSkill;
    });
  }
  return updatedSkills;
}

export function calculateCreatureLevel(
  hiddenSkills: Record<string, HiddenSkill>,
) {
  const values = Object.values(hiddenSkills).map((skill) =>
    Math.floor(skill.current),
  );
  if (values.length === 0) return "0:0:0";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = Math.floor(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
  return `${min}:${avg}:${max}`;
}

export function makeMoves(): Move[] {
  return DAMAGE_TYPES.flatMap(({ type, emoji }) => {
    const attackSkill = `${type}Attack`;
    const defenseSkill = `${type}Defense`;

    return [
      {
        id: `${type}-jab`,
        name: `${emoji} Quick Strike`,
        type,
        emoji,
        basePower: 14,
        skillUsed: attackSkill,
        resistedBy: defenseSkill,
        effects: ["Fast damage", "Small chance to weaken the next defense"],
      },
      {
        id: `${type}-snare`,
        name: `${emoji} Binding Snare`,
        type,
        emoji,
        basePower: 10,
        skillUsed: attackSkill,
        resistedBy: "bindingResist",
        effects: ["Damage", "Short status pressure"],
      },
      {
        id: `${type}-guard-break`,
        name: `${emoji} Guard Break`,
        type,
        emoji,
        basePower: 18,
        skillUsed: attackSkill,
        resistedBy: defenseSkill,
        effects: ["Damage", "Temporarily lowers resistance"],
      },
      {
        id: `${type}-overload`,
        name: `${emoji} Overload`,
        type,
        emoji,
        basePower: 26,
        skillUsed: attackSkill,
        resistedBy: defenseSkill,
        effects: ["Heavy damage", "User risks self strain"],
      },
    ];
  });
}

export function generateCreature(): Creature {
  const config = chooseOne(DAMAGE_TYPES);
  const hp = randomInt(75, 125);
  let hiddenSkills: Record<string, HiddenSkill> = {};

  DND_DAMAGE_TYPES.forEach((type) => {
    const stats = makeDamageStatNames(type);
    const isPrimaryType = type === config.type;
    hiddenSkills[stats.attack] = makeEmptySkill(
      randomGrowthPotential(isPrimaryType),
      chooseGeneratedTrait({ isPrimaryType, statRole: "attack" }),
    );
    hiddenSkills[stats.defense] = makeEmptySkill(
      randomGrowthPotential(isPrimaryType),
      chooseGeneratedTrait({ isPrimaryType, statRole: "defense" }),
    );
  });

  UTILITY_SKILLS.forEach((skillName) => {
    hiddenSkills[skillName] = makeEmptySkill(
      randomGrowthPotential(false),
      chooseGeneratedTrait({ isPrimaryType: false, statRole: "utility" }),
    );
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
moves: makeMoves(),  };
}
