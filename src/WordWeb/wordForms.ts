import type { DictionaryEntry, Meaning, Relation, WebSnapshot, WordEdge, WordNode } from "./graph";
import { normalize } from "./words";

export const uniqueForms = (words: string[]): string[] => Array.from(new Set(words.map(normalize).filter(Boolean)));
export const wordVariants = (entry: DictionaryEntry): string[] => uniqueForms([entry.word, ...(entry.forms || [])]);
const INFLECTION_GRAMMAR = new Set("first second third first-person second-person third-person person singular plural simple past present tense indicative participle gerund comparative superlative inflection form forms and".split(" "));

/** Follow explicit dictionary inflections; never guess by stripping word endings. */
export function inflectionBase(definition: string): string | null {
  const text = definition.trim().replace(/^(?:\([^)]*\)\s*)+/, "");
  const match = text.match(/^(.+?)\s+of\s+(.+?)\.?$/i);
  if (!match) return null;
  const grammar = normalize(match[1]);
  if (!grammar.split(" ").every(word => INFLECTION_GRAMMAR.has(word)) || !/\b(plural|singular|past|present|participle|gerund|comparative|superlative|inflection)\b/.test(grammar)) return null;
  const base = normalize(match[2].replace(/\s*\([^)]*\)\s*$/, "").replace(/^(?:the\s+)?(?:verb|noun|adjective|word)\s+/i, "").replace(/^["'“‘`*]+|["'”’`*.]+$/g, ""));
  return /^[a-z]+(?:[' -][a-z]+)*$/.test(base) ? base : null;
}

export function baseWordForEntry(entry: DictionaryEntry): string {
  const lexicalParts = new Set(entry.meanings.filter(meaning => !inflectionBase(meaning.definition) && !/^from .+:$/i.test(meaning.definition))
    .map(meaning => meaning.partOfSpeech));
  for (const meaning of entry.meanings) {
    const base = inflectionBase(meaning.definition);
    // A real verb headword such as "run" or "saw" must not be redirected by an
    // additional, less common inflection sense from another entry.
    if (base && !lexicalParts.has(meaning.partOfSpeech)) return base;
  }
  return normalize(entry.word);
}

export function dictionaryForms(forms: unknown): string[] {
  if (!Array.isArray(forms)) return [];
  return uniqueForms(forms.filter(form => typeof form?.word === "string" && Array.isArray(form.tags) &&
    form.tags.some((tag: string) => ["plural", "past", "present", "participle", "comparative", "superlative"].includes(tag)) &&
    !form.tags.some((tag: string) => ["alternative", "archaic", "obsolete", "dialectal", "table-tags", "inflection-template"].includes(tag)) &&
    /^[a-z]+(?:[' -][a-z]+)*$/i.test(form.word)).map(form => form.word));
}

const kinds: Relation[] = ["definition", "synonym", "antonym"];
export function mergeReferences(entries: DictionaryEntry[], retainMeanings: boolean): DictionaryEntry["formReferences"] {
  const result = { definition: [] as string[], synonym: [] as string[], antonym: [] as string[] };
  entries.forEach(entry => {
    if (retainMeanings) {
      result.definition.push(...entry.meanings.map(meaning => meaning.definition));
      result.synonym.push(...entry.synonyms); result.antonym.push(...entry.antonyms);
    }
    kinds.forEach(kind => result[kind].push(...(entry.formReferences?.[kind] || [])));
  });
  kinds.forEach(kind => { result[kind] = Array.from(new Set(result[kind])); });
  return result;
}

/** Contract duplicate forms in saved graphs, keeping every surviving world coordinate. */
export function mergeWordForms(data: WebSnapshot): WebSnapshot {
  const bases = new Map(data.nodes.map(node => [node.id, baseWordForEntry(node.entry)]));
  const resolve = (word: string): string => {
    let current = word;
    const seen = new Set<string>();
    while (bases.has(current) && bases.get(current) !== current && !seen.has(current)) {
      seen.add(current); current = bases.get(current)!;
    }
    return seen.has(current) ? word : current;
  };
  const ids = new Map(data.nodes.map(node => [node.id, resolve(node.id)]));
  if (data.nodes.every(node => ids.get(node.id) === node.id)) return data;
  const groups = new Map<string, WordNode[]>();
  data.nodes.forEach(node => {
    const id = ids.get(node.id)!;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(node);
  });
  const nodes: WordNode[] = [];
  groups.forEach((members, id) => {
    const preferred = members.find(node => node.id === id) || members[0];
    const discarded = members.filter(node => node !== preferred).map(node => node.entry);
    const references = mergeReferences([...(discarded), { ...preferred.entry, meanings: [] as Meaning[], synonyms: [], antonyms: [] }], true)!;
    const forms = uniqueForms(members.flatMap(node => [node.id, ...wordVariants(node.entry)]).filter(word => word !== id));
    nodes.push({ ...preferred, id, entry: { ...preferred.entry, word: id, forms, formReferences: references,
      needsLookup: preferred.id !== id || preferred.entry.needsLookup || undefined }, parent: null });
  });
  const edges = new Map<string, WordEdge>();
  data.edges.forEach(edge => {
    const pair = [ids.get(edge.from)!, ids.get(edge.to)!].sort();
    if (pair[0] === pair[1]) return;
    const id = JSON.stringify([...pair, edge.kind]);
    edges.set(id, { id, from: pair[0], to: pair[1], kind: edge.kind, traversed: edge.traversed || Boolean(edges.get(id)?.traversed) });
  });
  const root = ids.get(data.root)!;
  const discovery = new Map(nodes.map(node => [node.id, new Set<string>()]));
  data.nodes.forEach(node => {
    if (node.parent === null) return;
    const id = ids.get(node.id)!, parent = ids.get(node.parent)!;
    if (id !== parent) { discovery.get(id)!.add(parent); discovery.get(parent)!.add(id); }
  });
  const byId = new Map(nodes.map(node => [node.id, node]));
  const forestRoots = data.nodes.filter(node => node.parent === null).map(node => ids.get(node.id)!);
  const queue = Array.from(new Set([root, ...forestRoots])), visited = new Set(queue);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const parent = byId.get(queue[cursor])!;
    discovery.get(parent.id)!.forEach(id => {
      if (visited.has(id)) return;
      visited.add(id); queue.push(id);
      const node = byId.get(id)!; node.parent = parent.id;
    });
  }
  const walk = data.walk.map(id => ids.get(id)!).filter((id, index, list) => index === 0 || id !== list[index - 1]);
  return { version: 1, root, focus: ids.get(data.focus)!, nodes, edges: Array.from(edges.values()), walk };
}
