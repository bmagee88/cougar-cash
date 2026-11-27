import {TypingBossId} from './types';

// The square bosses need room above the name and HP rows inside the portrait.
export const bossPortraitWidth=(id:TypingBossId)=>({xs:98,md:id==='kraken'?136:112});
