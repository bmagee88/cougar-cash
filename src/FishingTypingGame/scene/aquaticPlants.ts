// Aquatic plants now share the seeded species lifecycle, fixed spring roots
// and five-slot structure. There are no weather/day-dependent patch rerolls.
export {waterPerspective} from './plantVisuals';
export {plantLocation as shorePlantLocation} from '../engine/plantSpecies';
export const FLOATING_LAYERS=['outer','middle','near'] as const;
export const FLOATING_CAPACITY=[2,3,3] as const;
