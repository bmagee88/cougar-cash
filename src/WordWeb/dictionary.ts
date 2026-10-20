import { DictionaryEntry, Meaning, normalize } from "./graph";
import { STARTER_ENTRIES } from "./starterEntries";
import { baseWordForEntry, dictionaryForms, uniqueForms, wordVariants } from "./wordForms";

const cache = new Map<string, DictionaryEntry>(STARTER_ENTRIES.map(entry => [entry.word, entry]));
const inFlight = new Map<string, Promise<DictionaryEntry>>();
const aliases = new Map<string, string>();
const pendingRedirects = new Map<string, string>();

const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter(item => typeof item === "string") : [];
const unique = (values: string[]) => Array.from(new Set(values.map(normalize).filter(Boolean)));

export function parseWiktionary(data: any, word: string): DictionaryEntry | null {
  if (!data || !Array.isArray(data.entries)) return null;
  const meanings: Meaning[] = [];
  const synonyms: string[] = [];
  const antonyms: string[] = [];
  const forms: string[] = [];
  let phonetic = "";
  data.entries.forEach((entry: any) => {
    if (entry.language?.code && entry.language.code !== "en") return;
    if (!phonetic && Array.isArray(entry.pronunciations)) {
      phonetic = entry.pronunciations.find((item: any) => item.type === "ipa" && typeof item.text === "string")?.text || "";
    }
    synonyms.push(...strings(entry.synonyms));
    antonyms.push(...strings(entry.antonyms));
    forms.push(...dictionaryForms(entry.forms));
    const visit = (senses: any[]) => {
      if (!Array.isArray(senses)) return;
      senses.forEach(sense => {
        if (typeof sense.definition === "string" && sense.definition.trim()) {
          meanings.push({ partOfSpeech: entry.partOfSpeech || "word", definition: sense.definition, example: strings(sense.examples)[0] });
        }
        synonyms.push(...strings(sense.synonyms));
        antonyms.push(...strings(sense.antonyms));
        visit(sense.subsenses);
      });
    };
    visit(entry.senses);
  });
  if (!meanings.length) return null;
  return {
    word: normalize(word), phonetic, meanings,
    forms: uniqueForms(forms).filter(form => form !== normalize(word)),
    synonyms: unique(synonyms).filter(term => term !== normalize(word)),
    antonyms: unique(antonyms).filter(term => term !== normalize(word)),
    sourceUrl: `https://en.wiktionary.org/wiki/${encodeURIComponent(normalize(word))}`,
    sourceName: "Wiktionary via FreeDictionaryAPI",
    license: { name: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/" },
  };
}

export function parseDictionaryApi(data: any, word: string): DictionaryEntry | null {
  if (!Array.isArray(data)) return null;
  const meanings: Meaning[] = [];
  const synonyms: string[] = [];
  const antonyms: string[] = [];
  let phonetic = "";
  data.forEach(entry => {
    if (!phonetic) phonetic = entry.phonetic || entry.phonetics?.find((item: any) => item.text)?.text || "";
    if (!Array.isArray(entry.meanings)) return;
    entry.meanings.forEach((meaning: any) => {
      synonyms.push(...strings(meaning.synonyms));
      antonyms.push(...strings(meaning.antonyms));
      if (!Array.isArray(meaning.definitions)) return;
      meaning.definitions.forEach((sense: any) => {
        if (typeof sense.definition === "string" && sense.definition.trim()) {
          meanings.push({ partOfSpeech: meaning.partOfSpeech || "word", definition: sense.definition, example: sense.example });
        }
        synonyms.push(...strings(sense.synonyms));
        antonyms.push(...strings(sense.antonyms));
      });
    });
  });
  if (!meanings.length) return null;
  const headword = typeof data[0]?.word === "string" ? normalize(data[0].word) : normalize(word);
  return {
    word: headword, phonetic, meanings,
    forms: headword !== normalize(word) ? [normalize(word)] : [],
    synonyms: unique(synonyms).filter(term => term !== normalize(word)),
    antonyms: unique(antonyms).filter(term => term !== normalize(word)),
    sourceUrl: `https://en.wiktionary.org/wiki/${encodeURIComponent(headword)}`,
    sourceName: "Free Dictionary API",
    license: { name: "CC BY-SA 3.0", url: "https://creativecommons.org/licenses/by-sa/3.0/" },
  };
}

export class LookupError extends Error {
  constructor(message: string, public reason: "missing" | "network" | "invalid") {
    super(message);
    this.name = "LookupError";
  }
}

export function rememberEntries(entries: DictionaryEntry[]) {
  entries.forEach(entry => {
    if (entry.needsLookup || baseWordForEntry(entry) !== normalize(entry.word)) return;
    const id = normalize(entry.word);
    const previous = cache.get(id);
    const merged = { ...entry, forms: uniqueForms([...(previous?.forms || []), ...(entry.forms || [])]).filter(form => form !== id) };
    cache.set(id, merged);
    wordVariants(merged).forEach(form => {
      if (!cache.has(form) || form === id) aliases.set(form, id);
    });
  });
}

rememberEntries(STARTER_ENTRIES);

function validateWord(word: string) {
  if (!/^[a-z]+(?:[' -][a-z]+)*$/.test(word) || word.length > 100) {
    throw new LookupError("Enter an English word or phrase using letters, spaces, apostrophes, or hyphens.", "invalid");
  }
}

async function fetchEntry(word: string): Promise<DictionaryEntry> {
    let missing = false;
    let unavailable = false;
    const providers = [
      { url: `https://freedictionaryapi.com/api/v1/entries/en/${encodeURIComponent(word)}`, parse: parseWiktionary },
      { url: `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, parse: parseDictionaryApi },
    ];
    for (const provider of providers) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(provider.url, { signal: controller.signal });
        if (response.status === 404 && response.headers.get("content-type")?.includes("json")) { missing = true; continue; }
        if (!response.ok) { unavailable = true; continue; }
        const entry = provider.parse(await response.json(), word);
        if (!entry) { missing = true; continue; }
        return entry;
      } catch {
        unavailable = true;
      } finally {
        clearTimeout(timeout);
      }
    }
    if (missing && !unavailable) throw new LookupError(`No English definition found for “${word}”. Try another word.`, "missing");
    if (missing) throw new LookupError(`No definition for “${word}” was available. One dictionary could not be reached; try again or choose another word.`, "missing");
    throw new LookupError("The dictionaries could not be reached. Check your connection and try again. Your web is saved.", "network");
}

async function resolveEntry(word: string, ancestors: Set<string>): Promise<DictionaryEntry> {
  validateWord(word);
  if (ancestors.has(word) || ancestors.size >= 8) throw new LookupError(`The dictionary returned a circular base-word reference for “${word}”. Try another word.`, "missing");
  const canonical = aliases.get(word) || word;
  if (cache.has(canonical)) return cache.get(canonical)!;
  if (inFlight.has(word)) return inFlight.get(word)!;
  const resolve = async () => {
    const parsed = await fetchEntry(word);
    const base = baseWordForEntry(parsed);
    if (base !== normalize(parsed.word)) {
      pendingRedirects.set(word, base);
      const seen = new Set([word]);
      let next = base;
      while (pendingRedirects.has(next)) {
        if (seen.has(next)) throw new LookupError(`The dictionary returned a circular base-word reference for “${word}”. Try another word.`, "missing");
        seen.add(next); next = pendingRedirects.get(next)!;
      }
    }
    const entry = base !== normalize(parsed.word)
      ? await resolveEntry(base, new Set([...Array.from(ancestors), word]))
      : parsed;
    const result = { ...entry, forms: uniqueForms([...wordVariants(entry), ...wordVariants(parsed), word]).filter(form => form !== entry.word) };
    rememberEntries([result]);
    return cache.get(result.word)!;
  };
  const promise = resolve();
  inFlight.set(word, promise);
  try { return await promise; }
  finally { inFlight.delete(word); pendingRedirects.delete(word); }
}

export async function lookupWord(input: string): Promise<DictionaryEntry> {
  return resolveEntry(normalize(input), new Set());
}
