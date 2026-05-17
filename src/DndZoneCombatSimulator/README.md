# DND Zone Combat Drop-in Files

Copy these folders/files into your app's `src` folder:

```txt
DndZoneCombatSimulator.tsx
components/
engine/
```

Then import the component wherever your app router expects a page/component:

```tsx
import DndZoneCombatSimulator from './DndZoneCombatSimulator';
```

This version assumes your existing app already has React, TypeScript, and MUI installed:

```bash
npm install @mui/material @emotion/react @emotion/styled
```

No Vite files, package.json, or `src` wrapper are included.

Important combat rules included:
- Attack types start in their correct initial body areas.
- `slashMid` cannot initially start in the head area.
- Logs include the weapon damage multiplier.
- Step-through combat markers show initial, evaded, and final placements.
