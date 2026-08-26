const assert = require('assert');
const { composeHangul, decomposeHangul } = require('../js/hangul-compose.js');

console.log('Running hangul-compose.js tests...\n');

const testCases = [
  // Composition test vectors
  { type: 'compose', args: ['ㄱ', 'ㅏ', null], expected: '가' },
  { type: 'compose', args: ['ㄱ', 'ㅏ', 'ㄱ'], expected: '각' },
  { type: 'compose', args: ['ㅇ', 'ㅏ', 'ㄴ'], expected: '안' },
  { type: 'compose', args: ['ㅂ', 'ㅏ', 'ㅂ'], expected: '밥' },
  { type: 'compose', args: ['ㅎ', 'ㅣ', null], expected: '히' },
  { type: 'compose', args: ['ㅇ', 'ㅘ', null], expected: '와' },
  { type: 'compose', args: ['ㅇ', 'ㅢ', null], expected: '의' },

  // Decomposition test vectors
  { type: 'decompose', args: ['가'], expected: { initial: 'ㄱ', medial: 'ㅏ', final: null } },
  { type: 'decompose', args: ['각'], expected: { initial: 'ㄱ', medial: 'ㅏ', final: 'ㄱ' } },
  { type: 'decompose', args: ['값'], expected: { initial: 'ㄱ', medial: 'ㅏ', final: 'ㅄ' } }
];

let passedCount = 0;
let failedCount = 0;

testCases.forEach((tc, index) => {
  const caseNum = index + 1;
  try {
    if (tc.type === 'compose') {
      const [initial, medial, final] = tc.args;
      const actual = composeHangul(initial, medial, final);
      assert.strictEqual(actual, tc.expected);
      console.log(`[PASS] Test ${caseNum}: composeHangul('${initial}', '${medial}', ${final === null ? 'null' : `'${final}'`}) => '${actual}'`);
    } else if (tc.type === 'decompose') {
      const [syllable] = tc.args;
      const actual = decomposeHangul(syllable);
      assert.deepStrictEqual(actual, tc.expected);
      console.log(`[PASS] Test ${caseNum}: decomposeHangul('${syllable}') => ${JSON.stringify(actual)}`);
    }
    passedCount++;
  } catch (err) {
    failedCount++;
    console.error(`[FAIL] Test ${caseNum}: ${err.message}`);
  }
});

console.log(`\nTest Summary: ${passedCount} passed, ${failedCount} failed.`);
if (failedCount > 0) {
  process.exit(1);
}
