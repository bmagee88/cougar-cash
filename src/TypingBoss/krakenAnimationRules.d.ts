export type KrakenAction='tentacleStrike'|'tentacleSweep'|'tidalWave'|'special';
export const KRAKEN_ANIMATIONS:Record<KrakenAction,{file:string;frames:number;columns:number;rows:number;duration:number;impact:number;label:string}>;
