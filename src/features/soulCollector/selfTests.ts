import { calculateCreatureLevel } from "./creatureGeneration";
import { getAttackMultiplier, getBandThresholds, getDefenseReduction, rollForTrait } from "./battleMath";

export function runSelfTests() {
  const adeptRoll = rollForTrait("adept");
  const resistanceRoll = rollForTrait("resistance");
  const masteryRoll = rollForTrait("mastery");
  const weaknessRoll = rollForTrait("weakness");

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
      name: "adept rolls three and takes lowest",
      pass: adeptRoll.rolls.length === 3 && adeptRoll.roll === Math.min(...adeptRoll.rolls),
    },
    {
      name: "resistance and mastery use three-roll low rule",
      pass:
        resistanceRoll.rolls.length === 3 &&
        masteryRoll.rolls.length === 3 &&
        resistanceRoll.roll === Math.min(...resistanceRoll.rolls) &&
        masteryRoll.roll === Math.min(...masteryRoll.rolls),
    },
    {
      name: "weakness rolls three and takes highest",
      pass: weaknessRoll.rolls.length === 3 && weaknessRoll.roll === Math.max(...weaknessRoll.rolls),
    },
  ];
}
