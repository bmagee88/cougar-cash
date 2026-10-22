import { normalize, tokenize } from "./words";
import { mergeReferences, mergeWordForms, uniqueForms, wordVariants } from "./wordForms";
export { normalize, tokenize } from "./words";

export type Relation = "definition" | "synonym" | "antonym";

export interface Meaning {
  partOfSpeech: string;
  definition: string;
  example?: string;
}

export interface DictionaryEntry {
  studentPolicy?: string;
  word: string;
  phonetic: string;
  meanings: Meaning[];
  synonyms: string[];
  antonyms: string[];
  sourceUrl: string;
  sourceName: string;
  license?: { name: string; url: string };
  forms?: string[];
  formReferences?: Record<Relation, string[]>;
  needsLookup?: boolean;
}

export interface WordNode {
  id: string;
  entry: DictionaryEntry;
  parent: string | null;
  x: number;
  y: number;
}

export interface WordEdge {
  id: string;
  from: string;
  to: string;
  kind: Relation;
  traversed: boolean;
}

export interface WebSnapshot {
  version: 1;
  root: string;
  focus: string;
  nodes: WordNode[];
  edges: WordEdge[];
  walk: string[];
  /** Exact relationships in the active trail; absent in older saved webs. */
  trailEdges?: string[];
}

export const RELATIONS: Relation[] = ["definition", "synonym", "antonym"];
const phrase = (text: string) => ` ${tokenize(text).join(" ")} `;
const contains = (text: string, term: string) => phrase(text).includes(phrase(term));

class TrieNode {
  children = new Map<string, TrieNode>();
  values = new Set<string>();
}

/** Token trie. Terminal postings support exact references; match scans find known phrases. */
export class WordTrie {
  private root = new TrieNode();

  insert(term: string, value: string) {
    let node = this.root;
    for (const token of tokenize(term)) {
      if (!node.children.has(token)) node.children.set(token, new TrieNode());
      node = node.children.get(token)!;
    }
    node.values.add(value);
  }

  get(term: string): Set<string> {
    let node = this.root;
    for (const token of tokenize(term)) {
      const next = node.children.get(token);
      if (!next) return new Set();
      node = next;
    }
    return node.values;
  }

  matches(text: string): Set<string> {
    const tokens = tokenize(text);
    const found = new Set<string>();
    for (let start = 0; start < tokens.length; start += 1) {
      let node = this.root;
      for (let end = start; end < tokens.length; end += 1) {
        const next = node.children.get(tokens[end]);
        if (!next) break;
        node = next;
        node.values.forEach(value => found.add(value));
      }
    }
    return found;
  }
}

function relationText(entry: DictionaryEntry, kind: Relation): string[] {
  const primary = kind === "definition" ? entry.meanings.map(meaning => meaning.definition) : kind === "synonym" ? entry.synonyms : entry.antonyms;
  return [...primary, ...(entry.formReferences?.[kind] || [])];
}

export function entryContains(entry: DictionaryEntry, term: string, kind: Relation): boolean {
  return relationText(entry, kind).some(text => contains(text, term));
}

/** Parent pointers form a discovery forest; semantic links can reconnect its islands. */
export class VocabularyGraph {
  private nodes = new Map<string, WordNode>();
  private edges = new Map<string, WordEdge>();
  private adjacent = new Map<string, Set<string>>();
  private terms = new WordTrie();
  private aliases = new Map<string, string>();
  private references: Record<Relation, WordTrie> = {
    definition: new WordTrie(), synonym: new WordTrie(), antonym: new WordTrie(),
  };
  private root: string;
  private focus: string;
  private walk: string[];
  private trailEdges: string[] = [];
  private trailPositions = new Map<string, number>();

  constructor(entry?: DictionaryEntry) {
    if (!entry) { this.root = ""; this.focus = ""; this.walk = []; return; }
    const id = normalize(entry.word);
    this.root = id;
    this.focus = id;
    this.walk = [id];
    this.trailPositions.set(id, 0);
    this.index({ id, entry, parent: null, x: 0, y: 0 });
  }

  private index(node: WordNode) {
    this.nodes.set(node.id, node);
    if (!this.adjacent.has(node.id)) this.adjacent.set(node.id, new Set());
    wordVariants(node.entry).forEach(form => {
      if (!this.nodes.has(form) || form === node.id) this.aliases.set(form, node.id);
      this.terms.insert(form, node.id);
    });
    RELATIONS.forEach(kind => {
      relationText(node.entry, kind).forEach(text => {
        // Token postings include words inside related phrases as well as definitions.
        tokenize(text).forEach(term => this.references[kind].insert(term, node.id));
      });
    });
  }

  resolveWord(word: string): string {
    const normalized = normalize(word);
    return this.nodes.has(normalized) ? normalized : this.aliases.get(normalized) || normalized;
  }

  getEntry(word: string): DictionaryEntry | undefined {
    return this.nodes.get(this.resolveWord(word))?.entry;
  }

  isOnTrail(word: string): boolean {
    return this.trailPositions.has(this.resolveWord(word));
  }

  assertCanExplore(word: string) {
    if (this.isOnTrail(word)) throw new Error("That word is already on your trail. Select it in your trail to backtrack first.");
  }

  private *linkNodeSteps(node: WordNode): Generator<void> {
    for (const kind of RELATIONS) {
      for (const form of wordVariants(node.entry)) {
        for (const other of this.referencing(form, kind)) { this.connect(other, node.id, kind); yield; }
      }
      for (const text of relationText(node.entry, kind)) {
        for (const other of this.terms.matches(text)) { this.connect(node.id, other, kind); yield; }
      }
    }
  }

  private linkNode(node: WordNode) {
    const steps = this.linkNodeSteps(node);
    while (!steps.next().done) { /* Complete synchronously for small operations. */ }
  }

  private *refreshEntrySteps(entry: DictionaryEntry): Generator<void, WebSnapshot> {
    const id = normalize(entry.word), previous = this.nodes.get(id);
    if (!previous) throw new Error("That word is not in this web.");
    const references = mergeReferences([previous.entry, entry], true);
    const merged = { ...entry, forms: uniqueForms([...wordVariants(previous.entry), ...wordVariants(entry)]).filter(form => form !== id), formReferences: references };
    const node = { ...previous, entry: merged };
    this.index(node); yield* this.linkNodeSteps(node);
    return this.snapshot();
  }

  refreshEntry(entry: DictionaryEntry): WebSnapshot {
    const steps = this.refreshEntrySteps(entry);
    let step = steps.next();
    while (!step.done) step = steps.next();
    return step.value;
  }

  private connect(from: string, to: string, kind: Relation) {
    if (from === to) return;
    const pair = [from, to].sort();
    const id = JSON.stringify([...pair, kind]);
    if (!this.edges.has(id)) {
      this.edges.set(id, { id, from: pair[0], to: pair[1], kind, traversed: false });
      this.adjacent.get(from)!.add(id);
      this.adjacent.get(to)!.add(id);
    }
  }

  private referencing(term: string, kind: Relation): string[] {
    const postings = tokenize(term).map(token => this.references[kind].get(token)).sort((a, b) => a.size - b.size);
    if (!postings.length) return [];
    return Array.from(postings[0]).filter(id =>
      postings.every(posting => posting.has(id)) && entryContains(this.nodes.get(id)!.entry, term, kind)
    );
  }

  private *placeSteps(parent: WordNode, word: string): Generator<void, { x: number; y: number }> {
    // Golden-angle expansion fans discoveries around their parent. Collision checks keep
    // labels and the fixed-size focus card apart without moving the established web.
    const siblings = Array.from(this.nodes.values()).filter(node => node.parent === parent.id).length;
    const baseAngle = parent.parent === null ? -0.5 : Math.atan2(parent.y, parent.x);
    const seed = word.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5;
    let position = { x: parent.x, y: parent.y };
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const angle = baseAngle + (siblings + attempt) * 2.399963 + seed * 0.13;
      const radius = 410 + Math.floor(attempt / 12) * 90;
      const candidate = { x: parent.x + Math.cos(angle) * radius, y: parent.y + Math.sin(angle) * radius };
      position = candidate;
      let clear = true, checked = 0;
      for (const node of this.nodes.values()) {
        if (Math.hypot(node.x - candidate.x, node.y - candidate.y) <= 230) { clear = false; break; }
        if (++checked % 128 === 0) yield;
      }
      if (clear) break;
      yield;
    }
    return position;
  }

  private *exploreSteps(entry: DictionaryEntry, kind: Relation, clickedWord?: string, stayOnCurrent = false): Generator<void, WebSnapshot> {
    const id = normalize(entry.word);
    const current = this.nodes.get(this.focus)!;
    const forms = wordVariants(entry);
    const choices = clickedWord ? [normalize(clickedWord)] : forms;
    if (!choices.some(form => forms.includes(form) && entryContains(current.entry, form, kind))) throw new Error("Choose a word in the current definition or its related words.");
    if (id === current.id) return yield* this.refreshEntrySteps(entry);
    this.assertCanExplore(id);
    if (!this.nodes.has(id)) {
      const position = yield* this.placeSteps(current, id);
      this.index({ id, entry, parent: current.id, ...position });
      yield* this.linkNodeSteps(this.nodes.get(id)!);
    } else yield* this.refreshEntrySteps(entry);
    this.connect(current.id, id, kind);
    return stayOnCurrent ? this.snapshot() : this.traverse(id, kind);
  }

  explore(entry: DictionaryEntry, kind: Relation, clickedWord?: string, stayOnCurrent = false): WebSnapshot {
    const steps = this.exploreSteps(entry, kind, clickedWord, stayOnCurrent);
    let step = steps.next();
    while (!step.done) step = steps.next();
    return step.value;
  }

  async exploreResponsive(entry: DictionaryEntry, kind: Relation, clickedWord?: string, stayOnCurrent = false): Promise<WebSnapshot> {
    if (this.nodes.size < 250) return this.explore(entry, kind, clickedWord, stayOnCurrent);
    const steps = this.exploreSteps(entry, kind, clickedWord, stayOnCurrent);
    let start = performance.now(), step = steps.next();
    while (!step.done) {
      if (performance.now() - start >= 8) {
        await new Promise(resolve => setTimeout(resolve, 0));
        start = performance.now();
      }
      step = steps.next();
    }
    return step.value;
  }

  traverse(target: string, kind?: Relation): WebSnapshot {
    target = this.resolveWord(target);
    this.assertCanExplore(target);
    const edges = Array.from(this.adjacent.get(this.focus) || []).map(id => this.edges.get(id)!)
      .filter(edge => (edge.from === target || edge.to === target) && (!kind || edge.kind === kind));
    if (!edges.length) throw new Error("Follow a connection from your current word to get there.");
    // When a pair has more than one relationship, walk only the selected edge.
    const edge = edges.find(candidate => candidate.traversed) || edges[0];
    this.edges.set(edge.id, { ...edge, traversed: true });
    this.focus = target;
    this.trailPositions.set(target, this.walk.length);
    this.walk.push(target);
    this.trailEdges.push(edge.id);
    return this.snapshot();
  }

  backtrack(word?: string): WebSnapshot {
    const position = word === undefined ? Math.max(0, this.walk.length - 2) : this.trailPositions.get(this.resolveWord(word));
    if (position === undefined) throw new Error("Choose a word on your current trail to backtrack.");
    while (this.walk.length > position + 1) {
      this.trailPositions.delete(this.walk.pop()!);
      this.trailEdges.pop();
    }
    this.focus = this.walk[this.walk.length - 1];
    return this.snapshot();
  }

  deleteWord(word: string): WebSnapshot {
    const id = this.resolveWord(word);
    if (!this.nodes.has(id)) throw new Error("That word is not in this web.");
    if (this.nodes.size === 1) { Object.assign(this, new VocabularyGraph()); return this.snapshot(); }
    const position = this.trailPositions.get(id);
    let walk = [...this.walk], trailEdges = [...this.trailEdges];
    if (position === 0) {
      walk = walk.slice(1); trailEdges = trailEdges.slice(1);
    } else if (position !== undefined) {
      walk = walk.slice(0, position); trailEdges = trailEdges.slice(0, position - 1);
    }
    if (!walk.length) walk = [Array.from(this.nodes.keys()).find(key => key !== id)!];
    const root = walk[0];
    const nodes = Array.from(this.nodes.values()).filter(node => node.id !== id)
      .map(node => node.parent === id || node.id === root ? { ...node, parent: null } : node);
    const edges = Array.from(this.edges.values()).filter(edge => edge.from !== id && edge.to !== id);
    // Rebuild every index, including disconnected islands, without retaining deleted aliases.
    const restored = VocabularyGraph.restore({ version: 1, root, focus: walk[walk.length - 1], nodes, edges, walk, trailEdges });
    Object.assign(this, restored);
    return this.snapshot();
  }

  snapshot(): WebSnapshot {
    return {
      version: 1, root: this.root, focus: this.focus,
      nodes: Array.from(this.nodes.values()), edges: Array.from(this.edges.values()), walk: [...this.walk], trailEdges: [...this.trailEdges],
    };
  }

  static restore(data: WebSnapshot): VocabularyGraph {
    if (data?.version !== 1 || !Array.isArray(data.nodes) || !Array.isArray(data.edges) || !Array.isArray(data.walk)) throw new Error("Invalid saved web.");
    if (!data.nodes.length && !data.edges.length && !data.walk.length && data.root === "" && data.focus === "" && (!data.trailEdges || data.trailEdges.length === 0)) return new VocabularyGraph();
    const savedNodes = new Map(data.nodes.map(node => [node.id, node]));
    const root = savedNodes.get(data.root);
    if (!root || !data.nodes.some(node => node.id === data.focus) || !data.walk.length || data.walk[data.walk.length - 1] !== data.focus) throw new Error("Incomplete saved web.");
    if (new Set(data.nodes.map(node => node.id)).size !== data.nodes.length || root.parent !== null || data.walk[0] !== data.root) throw new Error("Invalid discovery tree.");
    const graph = new VocabularyGraph(root.entry);
    graph.nodes.clear();
    const children = new Map<string, string[]>();
    data.nodes.forEach(node => {
      const entry = node.entry;
      if (typeof node.id !== "string" || !node.id || node.id !== normalize(entry.word) || !Array.isArray(entry.meanings) || !entry.meanings.length ||
        !entry.meanings.every(meaning => typeof meaning.definition === "string" && meaning.definition.trim() && typeof meaning.partOfSpeech === "string" && (meaning.example === undefined || typeof meaning.example === "string")) ||
        !Array.isArray(entry.synonyms) || !Array.isArray(entry.antonyms) || ![...entry.synonyms, ...entry.antonyms].every(term => typeof term === "string") ||
        typeof entry.phonetic !== "string" || typeof entry.sourceName !== "string" || typeof entry.sourceUrl !== "string" ||
        !Number.isFinite(node.x) || !Number.isFinite(node.y) || (!/^https:\/\//i.test(entry.sourceUrl) && entry.sourceUrl !== "/word-web") ||
        (entry.license && (typeof entry.license.name !== "string" || typeof entry.license.url !== "string" || !/^https:\/\//i.test(entry.license.url)))) throw new Error("Invalid saved word.");
      const formReferences = entry.formReferences;
      if ((entry.forms !== undefined && (!Array.isArray(entry.forms) || !entry.forms.every(form => typeof form === "string" && form.trim()))) ||
        (formReferences !== undefined && !RELATIONS.every(kind => Array.isArray(formReferences[kind]) && formReferences[kind].every(text => typeof text === "string"))) ||
        (entry.needsLookup !== undefined && typeof entry.needsLookup !== "boolean")) throw new Error("Invalid saved word forms.");
      if (node.parent !== null) {
        const parent = savedNodes.get(node.parent!);
        if (!parent || parent.id === node.id) throw new Error("Invalid discovery tree.");
        if (!children.has(parent.id)) children.set(parent.id, []);
        children.get(parent.id)!.push(node.id);
      }
      // Ignore retired depth fields in older saved webs.
      graph.index({ id: node.id, entry, parent: node.parent, x: node.x, y: node.y });
    });
    const reachable = data.nodes.filter(node => node.parent === null).map(node => node.id);
    for (let index = 0; index < reachable.length; index += 1) reachable.push(...(children.get(reachable[index]) || []));
    if (reachable.length !== data.nodes.length) throw new Error("Invalid discovery tree.");
    data.edges.forEach(edge => {
      if (edge.from === edge.to || !graph.nodes.has(edge.from) || !graph.nodes.has(edge.to) || !RELATIONS.includes(edge.kind) ||
        (!wordVariants(graph.nodes.get(edge.to)!.entry).some(form => entryContains(graph.nodes.get(edge.from)!.entry, form, edge.kind)) &&
          !wordVariants(graph.nodes.get(edge.from)!.entry).some(form => entryContains(graph.nodes.get(edge.to)!.entry, form, edge.kind)))) throw new Error("Invalid saved connection.");
      graph.connect(edge.from, edge.to, edge.kind);
      const id = JSON.stringify([...([edge.from, edge.to].sort()), edge.kind]);
      graph.edges.set(id, { ...graph.edges.get(id)!, traversed: Boolean(edge.traversed) });
    });
    data.nodes.forEach(node => {
      if (node.parent !== null && !Array.from(graph.adjacent.get(node.id)!).some(id => {
        const edge = graph.edges.get(id)!;
        return edge.from === node.parent || edge.to === node.parent;
      })) throw new Error("Missing discovery connection.");
    });
    data.walk.forEach((id, index) => {
      if (!graph.nodes.has(id) || (index > 0 && !Array.from(graph.adjacent.get(id)!).some(edgeId => {
        const edge = graph.edges.get(edgeId)!;
        return edge.traversed && (edge.from === data.walk[index - 1] || edge.to === data.walk[index - 1]);
      }))) throw new Error("Invalid saved trail.");
    });
    if (data.trailEdges !== undefined && (!Array.isArray(data.trailEdges) || data.trailEdges.length !== data.walk.length - 1)) throw new Error("Invalid saved trail connections.");
    // Loop-erasing migration preserves the focus, coordinates, and historical
    // traversal flags while converting old chronological walks into a stack.
    graph.walk = []; graph.trailEdges = []; graph.trailPositions.clear();
    data.walk.forEach((id, index) => {
      let edgeId: string | undefined;
      if (index > 0) {
        const previous = data.walk[index - 1];
        const candidates = Array.from(graph.adjacent.get(id)!).map(key => graph.edges.get(key)!)
          .filter(edge => edge.traversed && (edge.from === previous || edge.to === previous));
        edgeId = data.trailEdges?.[index - 1];
        if (edgeId !== undefined && !candidates.some(edge => edge.id === edgeId)) throw new Error("Invalid saved trail connections.");
        edgeId = edgeId || candidates[0].id;
      }
      const earlier = graph.trailPositions.get(id);
      if (earlier !== undefined) {
        while (graph.walk.length > earlier + 1) graph.trailPositions.delete(graph.walk.pop()!);
        graph.trailEdges.length = earlier;
      } else {
        graph.trailPositions.set(id, graph.walk.length); graph.walk.push(id);
        if (edgeId) graph.trailEdges.push(edgeId);
      }
    });
    graph.focus = graph.walk[graph.walk.length - 1];
    // Older saves may lack relationships now found inside synonym/antonym phrases.
    // Rebuild those discoveries without changing traversal flags or the active trail.
    graph.nodes.forEach(node => graph.linkNode(node));
    const snapshot = graph.snapshot(), merged = mergeWordForms(snapshot);
    if (merged !== snapshot) return VocabularyGraph.restore(merged);
    return graph;
  }
}
