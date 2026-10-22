import { VocabularyGraph } from "./graph";
import { isApprovedEntry, isSafeWord } from "./studentSafety";

/** Reject unrestricted exports before any of their text reaches the screen or cache. */
export function restoreStudentWeb(data: unknown): VocabularyGraph {
  const snapshot = data as any;
  if (!snapshot || !Array.isArray(snapshot.nodes) || snapshot.nodes.length > 10000 ||
    !snapshot.nodes.every((node: any) => node && isSafeWord(node.id) && node.id === node.entry?.word &&
      isApprovedEntry(node.entry))) throw new Error("Only student Word Web files can be opened here.");
  return VocabularyGraph.restore(snapshot);
}
