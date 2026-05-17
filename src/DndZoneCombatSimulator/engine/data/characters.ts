import type { ArmorPiece, Combatant, RowIndex, Stats, Team, Weapon } from "../types/combat";
import { randomInt, roll3d6, uid } from "../utils/random";
import { armorPool, cap, fullHelm, breastplate, shoulderGuards, greaves, heavyAxe, ironSword, longSpear, dagger, weaponPool } from "./equipment";

export function baseStats(overrides: Partial<Stats> = {}): Stats {
  return {
    physicalStrength: 12,
    dexterity: 10,
    balance: 10,
    magicka: 8,
    willpower: 10,
    intellect: 10,
    charisma: 10,
    guts: 11,
    toughness: 11,
    ...overrides,
  };
}

const heroNames = ["Aria", "Borin", "Cora", "Dain", "Elra", "Finn", "Galen", "Mira", "Nox", "Tessa"];
const enemyNames = ["Goblin Cutter", "Orc Brute", "Ash Gnoll", "Mud Imp", "Bone Raider", "Fangling", "Cave Wretch", "Rust Hob"];

export function copyWeapon(w: Weapon): Weapon {
  return { ...w, id: `${w.id}-${Math.floor(Math.random() * 10000)}` };
}

export function copyArmor(a: ArmorPiece): ArmorPiece {
  return { ...a, id: `${a.id}-${Math.floor(Math.random() * 10000)}` };
}

export function randomStats(): Stats {
  return {
    physicalStrength: roll3d6(),
    dexterity: roll3d6(),
    balance: roll3d6(),
    magicka: roll3d6(),
    willpower: roll3d6(),
    intellect: roll3d6(),
    charisma: roll3d6(),
    guts: roll3d6(),
    toughness: roll3d6(),
  };
}

export function randomCombatant(team: Team): Combatant {
  const weapon = copyWeapon(weaponPool[randomInt(0, weaponPool.length - 1)]);
  const armorCount = randomInt(1, 4);
  const armor = Array.from({ length: armorCount }, () => copyArmor(armorPool[randomInt(0, armorPool.length - 1)]));
  const stats = randomStats();
  const fight = team === "heroes" ? 55 + stats.guts + stats.toughness + randomInt(5, 25) : 45 + stats.guts + stats.toughness + randomInt(0, 20);
  const name = team === "heroes" ? heroNames[randomInt(0, heroNames.length - 1)] : enemyNames[randomInt(0, enemyNames.length - 1)];
  const id = uid(team === "heroes" ? "hero" : "enemy");
  const trainingLevel = randomInt(0, 3) as 0 | 1 | 2 | 3;

  return {
    id,
    name: `${name} ${randomInt(1, 99)}`,
    team,
    row: team === "heroes" ? 1 : 2,
    stats,
    fight,
    maxFight: fight,
    blood: stats.guts,
    maxBlood: stats.guts,
    concussion: stats.willpower,
    maxConcussion: stats.willpower,
    weapons: [weapon],
    armor,
    weaponTraining: { [weapon.weaponType]: trainingLevel },
    weaponAttunement: { [weapon.id]: { xp: randomInt(0, 8), level: randomInt(0, 2) as 0 | 1 | 2 } },
    statuses: [],
  };
}

export function createInitialCombatants(): Record<string, Combatant> {
  const aria: Combatant = {
    id: "aria",
    name: "Aria",
    team: "heroes",
    row: 1,
    stats: baseStats({ physicalStrength: 13, dexterity: 12, balance: 12 }),
    fight: 80,
    maxFight: 80,
    blood: 11,
    maxBlood: 11,
    concussion: 10,
    maxConcussion: 10,
    weapons: [ironSword],
    armor: [cap, breastplate],
    weaponTraining: { sword: 1 },
    weaponAttunement: { "iron-sword": { xp: 0, level: 0 } },
    statuses: [],
  };

  const borin: Combatant = {
    id: "borin",
    name: "Borin",
    team: "heroes",
    row: 0,
    stats: baseStats({ physicalStrength: 15, dexterity: 9, balance: 9 }),
    fight: 95,
    maxFight: 95,
    blood: 13,
    maxBlood: 13,
    concussion: 9,
    maxConcussion: 9,
    weapons: [longSpear],
    armor: [fullHelm, shoulderGuards, greaves],
    weaponTraining: { spear: 2 },
    weaponAttunement: { "long-spear": { xp: 0, level: 0 } },
    statuses: [],
  };

  const goblinWeapon = copyWeapon(dagger);
  const goblin: Combatant = {
    id: "goblin",
    name: "Goblin Cutter",
    team: "monsters",
    row: 2,
    stats: baseStats({ physicalStrength: 9, dexterity: 13, balance: 13, guts: 8, toughness: 8 }),
    fight: 55,
    maxFight: 55,
    blood: 8,
    maxBlood: 8,
    concussion: 8,
    maxConcussion: 8,
    weapons: [goblinWeapon],
    armor: [cap],
    weaponTraining: { dagger: 1 },
    weaponAttunement: { [goblinWeapon.id]: { xp: 0, level: 0 } },
    statuses: [],
  };

  const brute: Combatant = {
    id: "brute",
    name: "Orc Brute",
    team: "monsters",
    row: 3,
    stats: baseStats({ physicalStrength: 16, dexterity: 8, balance: 8, guts: 14, toughness: 14 }),
    fight: 100,
    maxFight: 100,
    blood: 14,
    maxBlood: 14,
    concussion: 9,
    maxConcussion: 9,
    weapons: [heavyAxe],
    armor: [fullHelm, shoulderGuards, breastplate],
    weaponTraining: { axe: 1 },
    weaponAttunement: { "heavy-axe": { xp: 0, level: 0 } },
    statuses: [],
  };

  return { aria, borin, goblin, brute };
}
