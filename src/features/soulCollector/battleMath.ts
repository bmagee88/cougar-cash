import {
  TRAIT_LABELS,
  type Creature,
  type Effectiveness,
  type HiddenSkill,
  type RollResult,
  type Trait,
} from "./types";
import { randomInt } from "./random";
import { calculateCreatureLevel, growthChance } from "./creatureGeneration";

export function rollForTrait(trait: Trait): RollResult {
  const first = randomInt(1, 1000);
  if (trait === "normal") {
    return {
      roll: first,
      rolls: [first],
      note: `Normal trait: rolled ${first}.`,
      isWeakness: false,
    };
  }

  const second = randomInt(1, 1000);
  if (trait === "proficient") {
    const lower = Math.min(first, second);
    return {
      roll: lower,
      rolls: [first, second],
      note: `Proficient trait: rolled ${first} and ${second}, then took the lower roll: ${lower}.`,
      isWeakness: false,
    };
  }

  if (trait === "struggle") {
    const higher = Math.max(first, second);
    return {
      roll: higher,
      rolls: [first, second],
      note: `Struggle trait: rolled ${first} and ${second}, then took the higher roll: ${higher}.`,
      isWeakness: false,
    };
  }

  const third = randomInt(1, 1000);
  if (trait === "weakness") {
    const highest = Math.max(first, second, third);
    return {
      roll: highest,
      rolls: [first, second, third],
      note: `Weakness trait: rolled ${first}, ${second}, and ${third}, then took the highest roll: ${highest}.`,
      isWeakness: true,
    };
  }

  const lowest = Math.min(first, second, third);
  return {
    roll: lowest,
    rolls: [first, second, third],
    note: `${TRAIT_LABELS[trait]} trait: rolled ${first}, ${second}, and ${third}, then took the lowest roll: ${lowest}.`,
    isWeakness: false,
  };
}

export function getEffectiveness(skillValue: number, roll: number): Effectiveness {
  const superThreshold = Math.floor(skillValue / 2);
  const effectiveThreshold = Math.min(1000, superThreshold + 500);
  if (roll <= superThreshold) return "Super Effective";
  if (roll <= effectiveThreshold) return "Effective";
  return "Not Effective";
}

export function getAttackMultiplier(effectiveness: Effectiveness) {
  if (effectiveness === "Super Effective") return 1.5;
  if (effectiveness === "Effective") return 1;
  return 0.75;
}

export function getDefenseReduction(effectiveness: Effectiveness) {
  if (effectiveness === "Super Effective") return 0.5;
  if (effectiveness === "Effective") return 0.75;
  return 1;
}

export function getBandThresholds(skillValue: number) {
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

export function describeBand(skillValue: number) {
  const bands = getBandThresholds(skillValue);
  return `Super Effective: ${bands.superStart}-${bands.superEnd}; Effective: ${bands.effectiveStart}-${bands.effectiveEnd}; Not Effective: ${bands.notEffectiveStart <= 1000 ? `${bands.notEffectiveStart}-1000` : "none"}.`;
}

export function rollGrowth(skill: HiddenSkill) {
  return Math.random() < growthChance(skill);
}

export function applySkillUse(
  creature: Creature,
  usedSkillName: string,
  didGrowUsedSkill: boolean,
  growthAmount = 1
) {
  const totalSkills = Object.keys(creature.hiddenSkills).length || 1;
  const decayAmount = (1 / totalSkills) * 8;
  const updatedSkills: Record<string, HiddenSkill> = {};

  Object.entries(creature.hiddenSkills).forEach(([skillName, skill]) => {
    let current = skill.current;
    let maxReached = skill.maxReached;

    if (skillName === usedSkillName && didGrowUsedSkill) {
      if (current < maxReached) {
        const catchUpStrength = 4;
        const catchUpMultiplier = 1 + (maxReached / 1000) * catchUpStrength;
        current = Math.min(1000, current + growthAmount * catchUpMultiplier);
      } else {
        current = Math.min(1000, current + growthAmount);
      }

      maxReached = Math.max(maxReached, current);
    }

    if (skillName !== usedSkillName) {
      current = Math.max(0, current - decayAmount);
    }

    updatedSkills[skillName] = {
      ...skill,
      current,
      maxReached,
    };
  });

  return {
    ...creature,
    hiddenSkills: updatedSkills,
    level: calculateCreatureLevel(updatedSkills),
  };
}
