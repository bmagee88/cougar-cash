// Keep the metadata and string-only views together for every word-bank consumer.
const entriesByLength = require("./homeRowWords.json");
const wordsByLength = Object.fromEntries(Object.entries(entriesByLength)
  .map(([key, entries]) => [key, entries.map(entry => entry.word)]));

const SENTIMENTS = ["positive", "negative", "neutral"];
function filterWordsByLength(gradeMask, sentimentMask) {
  return Object.fromEntries(Object.entries(entriesByLength).map(([key, entries]) => [key,
    entries.filter(entry => (gradeMask === undefined || (entry.gradeLevel !== null && (gradeMask & (1 << entry.gradeLevel)))) &&
      (sentimentMask === undefined || (sentimentMask & (1 << SENTIMENTS.indexOf(entry.sentiment)))))
      .map(entry => entry.word)]));
}
module.exports = { entriesByLength, wordsByLength, SENTIMENTS, filterWordsByLength };
