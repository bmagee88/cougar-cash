import type { Creature, Effectiveness, HiddenSkill, RollResult, Trait } from "./types";
import { randomInt } from "./random";
import { calculateCreatureLevel, growthChance } from "./creatureGeneration";

export function rollForTrait(trait: Trait): RollResult {
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
  didGrowUsedSkill: boolean
) {
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
      }

      // Important: after any growth, check whether current passed the old max.
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
