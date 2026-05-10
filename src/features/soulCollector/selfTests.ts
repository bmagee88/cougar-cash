import { calculateCreatureLevel } from "./creatureGeneration";
import { getAttackMultiplier, getBandThresholds, getDefenseReduction, rollForTrait } from "./battleMath";

export function runSelfTests() {
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
