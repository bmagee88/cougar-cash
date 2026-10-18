// Compatibility entry point. The former daily v2 garden generator is retired;
// its saved layouts/assets remain untouched. All live plants use generation v1.
export {GARDEN_READY_EVENT} from './gardenEvents';
export {plantSnapshot as gardenSnapshot} from '../engine/plantLifecycle';
export {plantDepthScale,spritePoint} from './plantVisuals';
export type {PlantPoint,PlantArt} from './plantVisuals';
