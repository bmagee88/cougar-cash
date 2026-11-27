export type WyrmKind='wyrmBite'|'slam'|'overrun'|'burrow'|'consume'|'spitOut';
export const WYRM_ACTIONS:Record<WyrmKind,{row:number;duration:number;impact:number;label:string}>;
export const CONSUME_MS:number;
export const CONSUME_TICK_MS:number;
