// Shared by the server and browser so imports and cached entries use the same policy.
const STUDENT_POLICY = "word-web-student-v1";
const STUDENT_SOURCE = "Merriam-Webster Elementary Dictionary";
const STARTER_SOURCE = "Word Web starter vocabulary";
const UNSUITABLE = /\b(?:fuck\w*|shit\w*|bullshit|bitch\w*|bastard\w*|asshole\w*|cunt\w*|cock|dick|piss\w*|damn\w*|hell|whore\w*|slut\w*|nigg\w*|fagg\w*|retard\w*|porn\w*|sex|sexual\w*|sexy|nude\w*|nudity|naked|erotic\w*|orgasm\w*|masturbat\w*|genital\w*|penis|vagina\w*|testicle\w*|breast\w*|prostitut\w*|rape\w*|rapist\w*|molest\w*|incest\w*|suicid\w*|self[ -]?harm\w*|overdose\w*|cocaine|heroin|methamphetamine|marijuana|cannabis|tobacco|cigarette\w*|vaping|alcohol\w*|drunk\w*|intoxicat\w*|drug\w*|murder\w*|kill\w*|slaughter\w*|tortur\w*|gory|gore|bloody|bloodshed|weapon\w*|gun\w*|firearm\w*|ammunition|terroris\w*|homicid\w*|racist\w*|slur\w*|vulgar\w*|obscene\w*|offensive|derogatory|profan\w*)\b/i;

function isSafeText(value) {
  if (typeof value !== "string" || value.length > 12000) return false;
  const text = value.normalize("NFKD").replace(/[\u0300-\u036f\u200b-\u200f\ufeff]/g, "");
  return !UNSUITABLE.test(text) && !/[<>]/.test(text);
}

function isSafeWord(value) {
  return typeof value === "string" && value.length <= 100 &&
    /^[a-z]+(?:[' -][a-z]+)*$/.test(value) && isSafeText(value);
}

function isApprovedEntry(entry) {
  if (!entry || entry.studentPolicy !== STUDENT_POLICY || !isSafeWord(entry.word)) return false;
  if (entry.sourceName !== STUDENT_SOURCE && entry.sourceName !== STARTER_SOURCE) return false;
  const expectedUrl = entry.sourceName === STUDENT_SOURCE
    ? "https://dictionaryapi.com/products/api-elementary-dictionary" : "/word-web";
  if (entry.sourceUrl !== expectedUrl || !isSafeText(entry.phonetic)) return false;
  if (!Array.isArray(entry.meanings) || !entry.meanings.length || entry.meanings.length > 100) return false;
  if (!entry.meanings.every(meaning => meaning && isSafeText(meaning.partOfSpeech) &&
    typeof meaning.definition === "string" && meaning.definition.trim() && isSafeText(meaning.definition) &&
    (meaning.example === undefined || isSafeText(meaning.example)))) return false;
  if (![entry.synonyms, entry.antonyms, entry.forms || []].every(list =>
    Array.isArray(list) && list.length <= 500 && list.every(isSafeWord))) return false;
  if (entry.formReferences && !["definition", "synonym", "antonym"].every(kind =>
    Array.isArray(entry.formReferences[kind]) && entry.formReferences[kind].every(isSafeText))) return false;
  return !entry.license || (isSafeText(entry.license.name) && entry.license.url === "https://dictionaryapi.com/info/terms-of-service");
}

module.exports = { STUDENT_POLICY, STUDENT_SOURCE, STARTER_SOURCE, isSafeText, isSafeWord, isApprovedEntry };
