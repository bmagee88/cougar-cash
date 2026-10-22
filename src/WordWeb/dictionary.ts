import type { DictionaryEntry } from "./graph";
import { normalize } from "./words";
import { STARTER_ENTRIES } from "./starterEntries";
import { isApprovedEntry, isSafeWord } from "./studentSafety";
import { uniqueForms, wordVariants } from "./wordForms";

const cache = new Map<string, DictionaryEntry>();
const aliases = new Map<string, string>();
const inFlight = new Map<string, Promise<DictionaryEntry>>();

export class LookupError extends Error {
  constructor(message: string, public reason: "missing" | "network" | "invalid" | "configuration" | "filtered") {
    super(message);
    this.name = "LookupError";
  }
}

export function rememberEntries(entries: DictionaryEntry[]) {
  entries.forEach(entry => {
    if (!isApprovedEntry(entry) || entry.needsLookup) return;
    const previous = cache.get(entry.word);
    // Bundled demo text must never replace a live student dictionary entry.
    if (previous && previous.sourceName !== entry.sourceName && entry.sourceUrl === "/word-web") return;
    const merged = { ...entry, forms: uniqueForms([...(previous?.forms || []), ...(entry.forms || [])]).filter(form => form !== entry.word) };
    cache.set(entry.word, merged);
    wordVariants(merged).forEach(form => { if (!cache.has(form) || form === entry.word) aliases.set(form, entry.word); });
  });
}
rememberEntries(STARTER_ENTRIES);

async function fetchEntry(word: string): Promise<DictionaryEntry> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`/api/word-web/dictionary?word=${encodeURIComponent(word)}`, { signal: controller.signal });
    if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("Unexpected response");
    const data = await response.json();
    if (!response.ok) {
      const reason = data?.code === "configuration" ? "configuration"
        : data?.code === "filtered" ? "filtered" : response.status === 404 ? "missing" : "network";
      const message = reason === "configuration" ? "The student dictionary is not set up yet. Ask your teacher for help, or explore the starter words."
        : reason === "filtered" ? "Choose another word for your student word web."
        : reason === "missing" ? "That word is not in our student dictionary. Try another word."
        : "The student dictionary could not be reached. Try again in a moment. Your web is saved.";
      throw new LookupError(message, reason);
    }
    if (!isApprovedEntry(data.entry)) throw new LookupError("Choose another word for your student word web.", "filtered");
    rememberEntries([data.entry]);
    return cache.get(data.entry.word)!;
  } catch (error) {
    if (error instanceof LookupError) throw error;
    throw new LookupError("The student dictionary could not be reached. Try again in a moment. Your web is saved.", "network");
  } finally { clearTimeout(timeout); }
}

export async function lookupWord(input: string): Promise<DictionaryEntry> {
  const word = normalize(input);
  if (!/^[a-z]+(?:[' -][a-z]+)*$/.test(word) || word.length > 100)
    throw new LookupError("Enter an English word or phrase using letters, spaces, apostrophes, or hyphens.", "invalid");
  if (!isSafeWord(word)) throw new LookupError("Choose another word for your student word web.", "filtered");
  const canonical = aliases.get(word) || word;
  if (cache.has(canonical)) return cache.get(canonical)!;
  if (inFlight.has(word)) return inFlight.get(word)!;
  const promise = fetchEntry(word);
  inFlight.set(word, promise);
  try { return await promise; }
  finally { inFlight.delete(word); }
}
