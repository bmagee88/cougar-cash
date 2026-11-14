import { effectiveDodgeChance, typingWord } from "./proportionalRules";
import { TypingBossTypingState } from "./types";

const clamp = (value: number) => Math.min(1, Math.max(0, value));

export function chargedLetters(state: TypingBossTypingState, typed: string) {
  if(state.balanced && !state.balancedRandomColors) {
    const expected=typingWord(state).text;
    const correct=[...typed].filter((letter,index)=>letter===expected[index]).length;
    return Number(Math.max(0,(state.balancedPower || 0)+correct).toFixed(2));
  }
  if(state.balanced && typingWord(state).color!==null)return Math.max(0,state.characters);
  const expected = `${typingWord(state).text} `;
  const correct=[...typed].filter((letter,index)=>letter===expected[index]).length;
  return Math.max(0,state.characters+correct);
}

export function portraitDefense(state: Partial<TypingBossTypingState>, maxHp: number) {
  const guard = clamp((state.balancedGuard || 0) / (state.balancedGuardMax || maxHp || 100));
  return {
    dodge: clamp(effectiveDodgeChance(state)),
    shield: state.balanced ? clamp(guard + (state.paladinShield || 0) / (maxHp || 100)) : clamp((state.shield || 0) + (state.paladinShield || 0) / (maxHp || 100)),
  };
}

export type WordReward = { id: number; word: string; label: string; color: string; correct: boolean; bonus: boolean };

export function wordReward(before: TypingBossTypingState, after: TypingBossTypingState, word: string, correct: boolean, color: string | null): WordReward {
  const base = { id: before.nextWord, word, correct };
  if (!correct) return { ...base, label: "Entered · no bonus", color: "#94a3b8", bonus: false };
  if (color === "gold") return { ...base, label: "Special charged!", color: "#fde047", bonus: true };
  if (before.balanced) {
    if(!before.balancedRandomColors && (color==='blue' || color==='green')) {
      const gain=color==='blue'?(after.balancedGuard || 0)-(before.balancedGuard || 0):(after.dodgeBank || 0)-(before.dodgeBank || 0);
      return {...base,label:gain>0?`${color==='blue'?'Block':'Dodge'} ready`:'Perfect word',color:color==='blue'?'#7dd3fc':'#86efac',bonus:gain>0};
    }
    if(color==='orange' && before.ability==='cleric') {
      const gain=(after.balancedHealingDeposit || 0)-(before.balancedHealingDeposit || 0);
      return {...base,label:gain>0?`Prayer pool +${Number(gain.toFixed(2))}`:'Perfect word',color:'#facc15',bonus:gain>0};
    }
    if (color === "blue") return { ...base, label: `Block +${Number(((after.balancedGuard || 0)-(before.balancedGuard || 0)).toFixed(2))}`, color: "#7dd3fc", bonus: true };
    if (color === "red" || color === "orange") {
      const gain = color === "red" ? (after.balancedCritBonus || 0) - (before.balancedCritBonus || 0) :
        (after.balancedOrangePower || 0) - (before.balancedOrangePower || 0);
      return { ...base, label: gain > 0 ? `${color === "red" ? "Crit" : "Power"} +${Number((color === "red" ? gain * 100 : gain).toFixed(2))}${color === "red" ? "%" : ""}` : "Perfect word",
        color: color === "red" ? "#fda4af" : "#fdba74", bonus: gain > 0 };
    }
    return { ...base, label: "Perfect word", color: "#86efac", bonus: false };
  }
  if (color === "blue") {
    const gain = Math.round((after.shield - before.shield) * 100);
    return { ...base, label: gain ? `Block +${gain}%` : "Block full", color: "#7dd3fc", bonus: gain > 0 };
  }
  if (color === "orange") return { ...base, label: "Power +10%", color: "#fdba74", bonus: true };
  if (color === "red") {
    const gain = Math.round((after.red - before.red) * 100);
    return { ...base, label: gain ? `Crit +${gain}%` : "Crit full", color: "#fda4af", bonus: gain > 0 };
  }
  if (color === "green") return { ...base, label: "+4% per next perfect word", color: "#86efac", bonus: true };
  const growth = Math.round((after.growth - before.growth) * 100);
  if (growth > 0) return { ...base, label: `Power +${growth}%`, color: "#86efac", bonus: true };
  return { ...base, label: "Perfect word", color: "#86efac", bonus: false };
}
