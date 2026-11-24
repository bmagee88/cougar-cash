const validPromotionLevel=level=>Number.isInteger(level) && level>=0 && level<=2;
function promotionLevel(actor) {
  return validPromotionLevel(actor?.promotionLevel)?actor.promotionLevel:actor?.promoted?1:0;
}
const promotionDamageMultiplier=actor=>promotionLevel(actor)===1?2:1;
module.exports={validPromotionLevel,promotionLevel,promotionDamageMultiplier};
