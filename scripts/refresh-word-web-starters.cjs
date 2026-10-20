// Refresh the small, attributed starter cache from the same live source as the app.
const fs = require("fs");
const path = require("path");
const words = ["curiosity", "inquisitiveness", "ignorance", "learn", "interest", "tendency", "ask"];

async function main() {
  const entries = await Promise.all(words.map(async word => {
    const response = await fetch(`https://freedictionaryapi.com/api/v1/entries/en/${word}`, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`${word}: HTTP ${response.status}`);
    const data = await response.json();
    const meanings = [], synonyms = [], antonyms = [];
    let phonetic = "";
    for (const entry of data.entries) {
      phonetic ||= entry.pronunciations?.find(item => item.type === "ipa")?.text || "";
      synonyms.push(...(entry.synonyms || []));
      antonyms.push(...(entry.antonyms || []));
      const visit = senses => {
        for (const sense of senses || []) {
          if (sense.definition) meanings.push({ partOfSpeech: entry.partOfSpeech, definition: sense.definition, ...(sense.examples?.[0] ? { example: sense.examples[0] } : {}) });
          synonyms.push(...(sense.synonyms || []));
          antonyms.push(...(sense.antonyms || []));
          visit(sense.subsenses);
        }
      };
      visit(entry.senses);
    }
    if (!meanings.length) throw new Error(`${word}: no definitions`);
    return {
      word, phonetic, meanings,
      synonyms: [...new Set(synonyms.map(item => item.toLowerCase()))].filter(item => item !== word),
      antonyms: [...new Set(antonyms.map(item => item.toLowerCase()))].filter(item => item !== word),
      sourceUrl: `https://en.wiktionary.org/wiki/${word}`,
      sourceName: "Wiktionary via FreeDictionaryAPI",
      license: { name: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/" },
    };
  }));
  const target = path.join(__dirname, "../src/WordWeb/starterEntries.ts");
  fs.writeFileSync(target, `// Cached from FreeDictionaryAPI / Wiktionary. See each entry's source and license.\nimport { DictionaryEntry } from "./graph";\n\nexport const STARTER_ENTRIES: DictionaryEntry[] = ${JSON.stringify(entries, null, 2)};\n`);
  console.log(`Cached ${entries.length} dictionary entries in src/WordWeb/starterEntries.ts`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
