import {promotionLevel,promotionDamageMultiplier,PromotionActor} from './promotionRules';
const KEY='typingBossDevicePromotion:v1';
export {promotionLevel,promotionDamageMultiplier} from './promotionRules';
export const promotionContributions=(players:readonly PromotionActor[])=>players.reduce((sum,p)=>sum+promotionDamageMultiplier(p),0);
export const promotionVisualClass=(actor:PromotionActor)=>promotionLevel(actor)===2?'promoted-character double-promoted-character':promotionLevel(actor)===1?'promoted-character':'';
export const promotionLabel=(actor:PromotionActor)=>['Normal','Promoted','Double Promoted'][promotionLevel(actor)];
const validGrant=(token:string)=>/^v1\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(token) || /^v2\.[012]\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(token);
export function readDevicePromotion():string {
  try {const token=localStorage.getItem(KEY) || '';return validGrant(token)?token:'';}catch{return '';}
}
export function saveDevicePromotion(token:string):boolean {
  if(!validGrant(token))return false;
  try{localStorage.setItem(KEY,token);return localStorage.getItem(KEY)===token;}catch{return false;}
}
