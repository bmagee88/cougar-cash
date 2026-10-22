export const normalize = (word: string) => word.trim().toLowerCase().replace(/’/g, "'").replace(/\s+/g, " ");
export const tokenize = (text: string): string[] => normalize(text).match(/[a-z]+(?:['-][a-z]+)*/g) || [];
