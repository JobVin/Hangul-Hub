/**
 * Multiple Choice option builder test.
 * Imports the REAL App object from js/main.js (no copied logic) and checks every item in every
 * quiz dataset: 4 options, exactly 1 correct, no duplicate normalized answers, and distractors
 * matching the correct answer's length wherever the dataset allows it.
 *
 * Run: node tests/quiz-options.test.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const rootDir = path.resolve(__dirname, '..');
const { App } = require(path.join(rootDir, 'js', 'main.js'));

const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(rootDir, rel), 'utf-8'));
App.data.jamo = readJson('data/jamo/part1-jamo.json');
App.data.syllables = readJson('data/syllables/part2-practice.json');
App.data.vocabulary = readJson('data/vocabulary/part3-vocabulary.json');

const VARIANTS = [
  'jamo-hangul-to-rom',
  'jamo-rom-to-hangul',
  'syl-hangul-to-rom',
  'syl-rom-to-hangul',
  'vocab-hangul-to-rom',
  'vocab-rom-to-hangul',
  'vocab-hangul-to-eng'
];

// Each item is built several times because distractor choice and option order are random.
const RUNS_PER_ITEM = 25;

// Count length-fallback warnings instead of printing hundreds of them
const originalWarn = console.warn;
let warnCount = 0;
console.warn = () => { warnCount++; };

let failures = 0;
let checks = 0;
const report = [];

for (const variant of VARIANTS) {
  const pool = App.getMcPool(variant);
  const fallbackItems = [];

  for (const item of pool) {
    const { prompt, expected } = App.getQuizPromptAnswer(item, variant);
    const normExpected = App.normalizeMcAnswer(expected);
    const targetUnits = App.getMcLengthUnits(item, variant);
    const sameLengthAvailable = App.getMcCandidates(item, variant, pool)
      .filter(c => c.units === targetUnits).length;
    let itemUsedFallback = false;

    for (let run = 0; run < RUNS_PER_ITEM; run++) {
      checks++;
      try {
        const { options, usedLengthFallback } = App.buildMcOptions(item, variant, pool);

        assert.strictEqual(options.length, 4, `expected 4 options, got ${options.length}`);

        const flagged = options.filter(o => o.isCorrect);
        assert.strictEqual(flagged.length, 1, 'expected exactly 1 option flagged correct');

        const matchingExpected = options.filter(o => App.normalizeMcAnswer(o.text) === normExpected);
        assert.strictEqual(matchingExpected.length, 1, 'expected exactly 1 option equal to the correct answer');
        assert.strictEqual(App.normalizeMcAnswer(flagged[0].text), normExpected, 'flagged option is not the correct answer');

        const norms = options.map(o => App.normalizeMcAnswer(o.text));
        assert.strictEqual(new Set(norms).size, 4, `duplicate normalized options: ${norms.join(' | ')}`);
        assert.ok(norms.every(n => n.length > 0), 'empty option text');

        // Length matching: when 3+ same-length candidates exist, every distractor must match;
        // a fallback is only allowed when the dataset genuinely lacks them.
        if (sameLengthAvailable >= 3) {
          assert.strictEqual(usedLengthFallback, false, `length fallback used although ${sameLengthAvailable} same-length candidates exist`);
        } else {
          assert.strictEqual(usedLengthFallback, true, 'expected a length fallback (fewer than 3 same-length candidates)');
          itemUsedFallback = true;
        }
      } catch (err) {
        failures++;
        if (failures <= 20) {
          originalWarn(`FAIL [${variant}] "${prompt}": ${err.message}`);
        }
      }
    }

    if (itemUsedFallback) fallbackItems.push(prompt);
  }

  report.push({ variant, items: pool.length, fallbackItems });
}

console.warn = originalWarn;

console.log('Multiple Choice option builder test (real App.buildMcOptions from js/main.js)\n');
for (const r of report) {
  const fb = r.fallbackItems.length
    ? `${r.fallbackItems.length} needed length fallback: ${r.fallbackItems.join(', ')}`
    : '0 needed length fallback';
  console.log(`  ${r.variant.padEnd(22)} ${String(r.items).padStart(3)} items  |  ${fb}`);
}

const totalItems = report.reduce((n, r) => n + r.items, 0);
const totalFallback = report.reduce((n, r) => n + r.fallbackItems.length, 0);
console.log(`\nItems checked: ${totalItems} (x${RUNS_PER_ITEM} runs = ${checks} builds)`);
console.log(`Items needing length fallback: ${totalFallback}`);
console.log(`Length-fallback console warnings emitted: ${warnCount}`);
console.log(`Result: ${failures === 0 ? 'PASS' : `FAIL (${failures} failed builds)`}`);

process.exit(failures === 0 ? 0 : 1);
