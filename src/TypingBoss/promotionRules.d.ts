export type PromotionActor={promoted?:boolean;promotionLevel?:number};
export function validPromotionLevel(level:unknown):level is 0|1|2;
export function promotionLevel(actor?:PromotionActor|null):0|1|2;
export function promotionDamageMultiplier(actor?:PromotionActor|null):1|2;
