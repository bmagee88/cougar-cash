import type { Combatant } from "../types/character";
import { sampleArmor } from "./sampleArmor";
import { sampleWeapons } from "./sampleWeapons";

const sword = sampleWeapons.find((weapon) => weapon.id === "iron-sword")!;
const spear = sampleWeapons.find((weapon) => weapon.id === "long-spear")!;
const hammer = sampleWeapons.find((weapon) => weapon.id === "warhammer")!;
const bow = sampleWeapons.find((weapon) => weapon.id === "short-bow")!;

const helm = sampleArmor.find((armor) => armor.id === "iron-helm")!;
const cap = sampleArmor.find((armor) => armor.id === "leather-cap")!;
const chain = sampleArmor.find((armor) => armor.id === "chain-shirt")!;
const pauldrons = sampleArmor.find((armor) => armor.id === "pauldrons")!;
const boots = sampleArmor.find((armor) => armor.id === "leather-boots")!;

export const sampleCombatants: Record<string, Combatant> = {
  hero1: {
    id: "hero1",
    name: "Arlen",
    team: "heroes",
    stats: { physicalStrength: 14, dexterity: 12, balance: 11, magicka: 8, willpower: 10, intellect: 11, charisma: 9, guts: 12, toughness: 13 },
    health: { fight: 80, maxFight: 80, blood: 12, maxBlood: 12, concussion: 10, maxConcussion: 10 },
    equipment: { weapons: [sword], armor: [helm, chain, boots] },
    progression: { weaponAttunements: { "iron-sword": { weaponId: "iron-sword", xp: 3, level: 0 } }, weaponProficiencies: { sword: 1 } },
    statuses: [],
  },
  hero2: {
    id: "hero2",
    name: "Mira",
    team: "heroes",
    stats: { physicalStrength: 10, dexterity: 15, balance: 14, magicka: 9, willpower: 12, intellect: 13, charisma: 11, guts: 9, toughness: 10 },
    health: { fight: 58, maxFight: 58, blood: 9, maxBlood: 9, concussion: 12, maxConcussion: 12 },
    equipment: { weapons: [spear], armor: [cap, boots] },
    progression: { weaponAttunements: { "long-spear": { weaponId: "long-spear", xp: 12, level: 2 } }, weaponProficiencies: { spear: 2 } },
    statuses: [],
  },
  enemy1: {
    id: "enemy1",
    name: "Brute",
    team: "enemies",
    stats: { physicalStrength: 16, dexterity: 8, balance: 8, magicka: 5, willpower: 8, intellect: 7, charisma: 6, guts: 14, toughness: 15 },
    health: { fight: 95, maxFight: 95, blood: 14, maxBlood: 14, concussion: 8, maxConcussion: 8 },
    equipment: { weapons: [hammer], armor: [chain, pauldrons, boots] },
    progression: { weaponAttunements: { warhammer: { weaponId: "warhammer", xp: 8, level: 1 } }, weaponProficiencies: { mace: 1 } },
    statuses: [],
  },
  enemy2: {
    id: "enemy2",
    name: "Raider",
    team: "enemies",
    stats: { physicalStrength: 11, dexterity: 13, balance: 12, magicka: 6, willpower: 9, intellect: 8, charisma: 8, guts: 10, toughness: 10 },
    health: { fight: 64, maxFight: 64, blood: 10, maxBlood: 10, concussion: 9, maxConcussion: 9 },
    equipment: { weapons: [bow], armor: [cap, boots] },
    progression: { weaponAttunements: { "short-bow": { weaponId: "short-bow", xp: 0, level: 0 } }, weaponProficiencies: { bow: 1 } },
    statuses: [],
  },
};
