const KEY='typingBossDevicePromotion:v1';
export const promotionContributions=(players:readonly {promoted?:boolean}[])=>players.reduce((sum,p)=>sum+(p.promoted?2:1),0);
export function readDevicePromotion():string {
  try {const token=localStorage.getItem(KEY) || '';return /^v1\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(token)?token:'';}catch{return '';}
}
export function saveDevicePromotion(token:string):boolean {
  if(!/^v1\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(token))return false;
  try{localStorage.setItem(KEY,token);return localStorage.getItem(KEY)===token;}catch{return false;}
}
