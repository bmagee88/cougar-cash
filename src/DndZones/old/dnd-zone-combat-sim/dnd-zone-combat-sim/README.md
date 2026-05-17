# DND Zone Combat Simulator

A React + TypeScript + MUI starter project for a zone-based tactical RPG combat simulator.

## What is included

- Abstract battlefield groups instead of a normal battle grid
- Four internal rows per group:
  - Row 0: hero back row
  - Row 1: hero front row
  - Row 2: enemy front row
  - Row 3: enemy back row
- Melee row restrictions with reach and double reach
- True ranged weapons that can target across groups
- Fight instead of HP
- Blood and concussion secondary bars in the data model
- Weapon slots and weapon attunement XP
- Weapon type proficiency: not trained, trained, expert, master
- Exact body-range attack marker system from 0 to 150
- Miss gaps
- Defender evasion shifts the marker toward the best defensive result
- Attacker skill shifts the marker toward the best offensive result
- Armor coverage as exact subranges
- Overlapping armor mitigation
- Flesh hits always crit
- Starter MUI simulator UI

## Run it

```bash
npm install
npm run dev
```

## Suggested next steps

1. Add manual defender and attacker marker-shift choices.
2. Add reaction tracking and reaction-to-extra-action conversion.
3. Add movement between groups through the UI.
4. Add wound thresholds by body part.
5. Add close-range penalties for true ranged weapons used inside a contested group.
6. Add save/load for custom combatants, weapons, and armor.
