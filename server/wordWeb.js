const {
  STUDENT_POLICY, STUDENT_SOURCE, isSafeText, isSafeWord, isApprovedEntry,
} = require("../src/WordWeb/studentSafety");

const normalize = word => word.trim().toLowerCase().replace(/’/g, "'").replace(/\s+/g, " ");
const headword = value => typeof value === "string" ? normalize(value.replace(/\*/g, "").replace(/:\d+$/, "")) : "";
const uniqueWords = list => [...new Set(list.filter(value => typeof value === "string").map(headword).filter(isSafeWord))];

// Dictionary markup is rendered as plain text; links never become HTML or outbound navigation.
function dictionaryText(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\{(?:sx|d_link|a_link|dxt|mat|et_link|i_link)\|([^|}]+)[^}]*\}/g, "$1")
    .replace(/\{bc\}/g, ": ").replace(/\{ldquo\}|\{rdquo\}/g, '"')
    .replace(/\{lsquo\}|\{rsquo\}/g, "'").replace(/\{[^{}]*\}/g, "")
    .replace(/^\s*:\s*/, "").replace(/\s+/g, " ").trim();
}

function unsafeLabels(value) {
  return ["lbs", "sls", "sgram", "fl", "wsls"].some(key => {
    const labels = value?.[key];
    return labels !== undefined && !isSafeText(typeof labels === "object" ? JSON.stringify(labels) : String(labels));
  });
}

function parseStudentDictionary(data, requestedWord) {
  if (!Array.isArray(data)) return null;
  const candidates = data.filter(raw => raw && typeof raw === "object" &&
    raw.meta?.offensive === false && raw.meta?.src === "sd2" && !unsafeLabels(raw) &&
    isSafeWord(headword(raw.hwi?.hw || raw.meta.id)));
  const exact = candidates.find(raw => headword(raw.hwi?.hw || raw.meta.id) === requestedWord);
  const matched = exact || candidates.find(raw => uniqueWords([...(raw.meta.stems || []), ...(raw.ins || []).map(item => item.if)]).includes(requestedWord));
  if (!matched) return null;
  const word = headword(matched.hwi?.hw || matched.meta.id);
  const meanings = [], synonyms = [], antonyms = [], forms = [];
  let phonetic = "";
  const related = (groups, destination) => {
    if (!Array.isArray(groups)) return;
    groups.forEach(group => {
      if (Array.isArray(group)) related(group, destination);
      else if (group && !unsafeLabels(group) && typeof group.wd === "string") destination.push(dictionaryText(group.wd));
    });
  };
  candidates.filter(raw => headword(raw.hwi?.hw || raw.meta.id) === word).forEach(raw => {
    if (!phonetic) {
      const pronunciation = raw.hwi?.prs?.find(item => typeof item.mw === "string")?.mw || "";
      if (isSafeText(pronunciation)) phonetic = pronunciation;
    }
    forms.push(...(raw.ins || []).map(item => item.if));
    // Stems can include derived words. Only explicit inflections and common
    // inflections also confirmed by the provider become aliases of this headword.
    const commonForms = new Set([`${word}s`, `${word}es`, `${word}ed`, `${word}ing`,
      `${word.replace(/y$/, "i")}es`, `${word.replace(/e$/, "")}ing`, `${word}r`, `${word}st`]);
    forms.push(...(raw.meta.stems || []).filter(form => commonForms.has(headword(form))));
    const before = meanings.length;
    const visit = value => {
      if (Array.isArray(value)) { value.forEach(visit); return; }
      if (!value || typeof value !== "object" || unsafeLabels(value)) return;
      if (Array.isArray(value.dt)) {
        const definition = value.dt.filter(item => Array.isArray(item) && item[0] === "text")
          .map(item => dictionaryText(item[1])).filter(Boolean).join(" ");
        const examples = value.dt.filter(item => Array.isArray(item) && item[0] === "vis")
          .flatMap(item => Array.isArray(item[1]) ? item[1] : [])
          .map(item => dictionaryText(item?.t)).filter(text => text && isSafeText(text));
        if (definition && isSafeText(definition)) meanings.push({ partOfSpeech: raw.fl || "word", definition, ...(examples[0] ? { example: examples[0] } : {}) });
        related(value.syn_list, synonyms);
        related(value.ant_list, antonyms);
      }
      // Definition sequences contain sense, subsense, binding-substitute and
      // parallel-sequence containers. Other sections (history, quotes, etc.) stay out.
      ["sseq", "sense", "sen", "bs", "pseq", "sdsense"].forEach(key => { if (value[key]) visit(value[key]); });
    };
    visit(raw.def);
    // Student dictionaries provide synonym discussion paragraphs rather than a
    // separate thesaurus. Small-cap terms in those paragraphs name the synonyms.
    if (meanings.length > before && Array.isArray(raw.syns)) raw.syns.forEach(section => {
      if (unsafeLabels(section) || !Array.isArray(section.pt)) return;
      section.pt.forEach(part => {
        if (!Array.isArray(part) || part[0] !== "text" || typeof part[1] !== "string") return;
        if (!isSafeText(dictionaryText(part[1]))) return;
        for (const match of part[1].matchAll(/\{sc\}([^{}]+)\{\/sc\}/g)) synonyms.push(match[1]);
      });
    });
    // shortdef is only a fallback when no full definition sequence is present;
    // do not reintroduce senses excluded by safety labels.
    if (!raw.def?.length && meanings.length === before && Array.isArray(raw.shortdef)) raw.shortdef.forEach(value => {
      const definition = dictionaryText(value);
      if (definition && isSafeText(definition)) meanings.push({ partOfSpeech: raw.fl || "word", definition });
    });
  });
  if (!meanings.length) return null;
  const entry = {
    word, phonetic, meanings: meanings.slice(0, 100),
    synonyms: uniqueWords(synonyms).filter(term => term !== word),
    antonyms: uniqueWords(antonyms).filter(term => term !== word),
    forms: uniqueWords(forms).filter(term => term !== word),
    sourceName: STUDENT_SOURCE, sourceUrl: "https://dictionaryapi.com/products/api-elementary-dictionary",
    license: { name: "© Merriam-Webster, Incorporated", url: "https://dictionaryapi.com/info/terms-of-service" },
    studentPolicy: STUDENT_POLICY,
  };
  return isApprovedEntry(entry) ? entry : null;
}

const json = (statusCode, data) => ({ statusCode,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  body: JSON.stringify(data),
});

function createDictionaryHandler({ fetchImpl = (...args) => fetch(...args), getKey = () => process.env.MERRIAM_WEBSTER_STUDENT_API_KEY, now = Date.now } = {}) {
  const cache = new Map(), inFlight = new Map();
  const filtered = () => json(404, { code: "filtered", message: "Choose another word for your student word web." });
  return async event => {
    if (event.httpMethod !== "GET") return { ...json(405, { code: "method", message: "Use a dictionary lookup." }), headers: { ...json(405, {}).headers, Allow: "GET" } };
    const input = event.queryStringParameters?.word;
    if (typeof input !== "string" || input.length > 100) return json(400, { code: "invalid", message: "Enter an English word or phrase." });
    const word = normalize(input);
    if (!/^[a-z]+(?:[' -][a-z]+)*$/.test(word)) return json(400, { code: "invalid", message: "Enter an English word or phrase." });
    if (!isSafeWord(word)) return filtered();
    const key = getKey()?.trim();
    if (!key) return json(503, { code: "configuration", message: "The student dictionary is not set up yet." });
    const cached = cache.get(word);
    if (cached && cached.expires > now()) return cached.result;
    if (inFlight.has(word)) return inFlight.get(word);
    const lookup = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetchImpl(`https://www.dictionaryapi.com/api/v3/references/sd2/json/${encodeURIComponent(word)}?key=${encodeURIComponent(key)}`, { signal: controller.signal });
        if ([401, 403].includes(response.status)) return json(503, { code: "configuration", message: "The student dictionary needs a teacher's help." });
        if (!response.ok) return json(503, { code: "unavailable", message: "The student dictionary is busy. Try again soon." });
        const data = await response.json();
        if (!Array.isArray(data)) return json(503, { code: "unavailable", message: "The student dictionary is unavailable. Try again soon." });
        // Spelling suggestions are unreviewed strings; never return them to students.
        const entry = parseStudentDictionary(data, word);
        const result = entry ? json(200, { entry }) : data.some(item => item && typeof item === "object") ? filtered()
          : json(404, { code: "missing", message: "Try another word in the student dictionary." });
        if (cache.size >= 1000) cache.delete(cache.keys().next().value);
        cache.set(word, { result, expires: now() + 60 * 60 * 1000 });
        return result;
      } catch {
        // Upstream errors and URLs may contain the key; never send or log them.
        return json(503, { code: "unavailable", message: "The student dictionary could not be reached. Try again soon." });
      } finally { clearTimeout(timeout); }
    };
    const promise = lookup();
    inFlight.set(word, promise);
    try { return await promise; }
    finally { inFlight.delete(word); }
  };
}

const handleDictionaryLookup = createDictionaryHandler();
module.exports = { dictionaryText, parseStudentDictionary, createDictionaryHandler, handleDictionaryLookup };
