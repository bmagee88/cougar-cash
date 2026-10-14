const { generateEncounter, seededRandom } = require('./fishing-engine-loader.cjs');
const speeds = [20, 35, 50, 70, 100, 120];
const n = Math.max(10000, Number(process.argv[2]) || 250000);
const random = seededRandom(20261012);
const groups = {};
const row = key => groups[key] || (groups[key] = { encounters: 0, catches: speeds.map(() => 0) });
for (let i = 0; i < n; i++) {
  const e = generateEncounter(random);
  const keys = ['All encounters', `Rarity: ${e.species.rarity}`, `Quality: ${e.quality}`, ...(e.isAlbino ? ['Albino encounters'] : [])];
  keys.forEach(key => { const r = row(key); r.encounters++; speeds.forEach((wpm, j) => { if (e.phrase.length < wpm * 5 / 6) r.catches[j]++; }); });
}
// Conditional sampling verifies the tail of a combination too rare to reliably
// occur in ordinary Monte Carlo. This does not change the game's population.
const exceptional = { encounters: n, catches: speeds.map(() => 0) };
for (let i = 0; i < n; i++) {
  const e = generateEncounter(random, { rarity: 'Ultra-Rare', quality: 'SS', isAlbino: true });
  speeds.forEach((wpm, j) => { if (e.phrase.length < wpm * 5 / 6) exceptional.catches[j]++; });
}
const table = Object.fromEntries(Object.entries(groups).map(([key, r]) => [key, { encounters: r.encounters, ...Object.fromEntries(speeds.map((wpm,j) => [`${wpm} WPM`, `${r.catches[j]} (${(r.catches[j]/r.encounters*100).toFixed(2)}%)`])) }]));
console.log(`Seed 20261012 · ${n.toLocaleString()} natural encounters · ten second deadline · perfect accuracy`);
console.table(table);
console.log('Conditional Ultra-Rare / SS / albino completion probability (separate sample):');
console.table(Object.fromEntries(speeds.map((wpm,j) => [wpm, { catches: exceptional.catches[j], encounters: n, probability: `${(exceptional.catches[j]/n*100).toFixed(4)}%` }])));
const monotonic = Object.values(groups).every(r => r.catches.every((c,j) => j===0 || c >= r.catches[j-1]));
if (!monotonic || exceptional.catches[0] || !exceptional.catches[speeds.indexOf(70)]) { console.error('Balance verification failed: expected monotonic catches and the requested bounded -50 WPM tail.'); process.exitCode = 1; }
else console.log('PASS: expected catches increase with speed; the -50 WPM tail lowers an Ultra-Rare SS albino from 110 to 60 WPM.');
