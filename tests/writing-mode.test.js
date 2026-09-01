/**
 * Automated Verification Script for Writing Mode
 * Tests DOM structure, event binding, sub-category pools, pointer drawing simulation, clear, and item navigation.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

// 1. Verify files exist
const htmlContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8');
const mainJsContent = fs.readFileSync(path.join(rootDir, 'js', 'main.js'), 'utf-8');
const jamoData = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'jamo', 'part1-jamo.json'), 'utf-8'));
const blockRulesData = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'syllables', 'block-rules.json'), 'utf-8'));
const syllableData = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'syllables', 'part2-practice.json'), 'utf-8'));

console.log('=== STEP 1: Verifying HTML DOM Structure for Writing Mode ===');
const requiredIds = [
  'card-writing-mode',
  'view-writing-select',
  'jamo-writing-filters',
  'jamo-writing-filter-all',
  'jamo-writing-filter-bc',
  'jamo-writing-filter-bv',
  'jamo-writing-filter-dc',
  'jamo-writing-filter-cv',
  'writing-track-jamo',
  'syllable-writing-filters',
  'syllable-writing-filter-all',
  'syllable-writing-filter-vr',
  'syllable-writing-filter-hb',
  'syllable-writing-filter-dw',
  'syllable-writing-filter-ui',
  'writing-track-syllable',
  'view-writing-active',
  'writing-active-title',
  'writing-active-subtitle',
  'writing-active-progress-text',
  'writing-active-progress-fill',
  'writing-active-category-tag',
  'writing-model-char',
  'writing-model-type-badge',
  'writing-model-details',
  'writing-model-name',
  'writing-model-rom',
  'writing-model-note',
  'writing-canvas',
  'btn-writing-prev',
  'btn-writing-clear',
  'btn-writing-next'
];

let missingIds = [];
for (const id of requiredIds) {
  if (!htmlContent.includes(`id="${id}"`)) {
    missingIds.push(id);
  }
}
if (missingIds.length === 0) {
  console.log('[PASS] All 31 required Writing Mode DOM element IDs exist in index.html.');
} else {
  console.error('[FAIL] Missing DOM element IDs:', missingIds);
  process.exit(1);
}

console.log('\n=== STEP 2: Verifying Jamo and Syllable Writing Pools & Filter Counts ===');

// Setup mock App environment
const elements = {};

function createMockElement(id) {
  const el = {
    id,
    textContent: '',
    innerHTML: '',
    style: {},
    classList: {
      _classes: new Set(),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      contains(c) { return this._classes.has(c); }
    },
    dataset: {},
    addEventListener(evt, cb) {
      if (!this._listeners) this._listeners = {};
      if (!this._listeners[evt]) this._listeners[evt] = [];
      this._listeners[evt].push(cb);
    },
    dispatchEvent(evt, data) {
      if (this._listeners && this._listeners[evt]) {
        for (const cb of this._listeners[evt]) {
          cb(data);
        }
      }
    },
    querySelectorAll(sel) {
      return Object.values(elements).filter(e => e.classList && e.classList.contains(sel.replace('.', '')));
    }
  };
  elements[id] = el;
  return el;
}

// Register all required elements
requiredIds.forEach(id => createMockElement(id));
['nav-brand', 'nav-practice-hub', 'nav-learning-hub', 'card-quiz-mode', 'btn-scroll-top', 'sticky-subnav-bar', 'coming-soon-title', 'jamo-card-count', 'jamo-progress-fill', 'jamo-card-front-char', 'jamo-card-back-content', 'jamo-card-wrapper', 'btn-jamo-flip', 'btn-jamo-prev', 'btn-jamo-next', 'jamo-deck-filter', 'syllable-card-count', 'syllable-progress-fill', 'syllable-card-front-char', 'syllable-card-back-content', 'syllable-card-wrapper', 'btn-syllable-flip', 'btn-syllable-prev', 'btn-syllable-next', 'syllable-deck-filter', 'quiz-active-title', 'quiz-active-subtitle', 'quiz-active-progress-text', 'quiz-active-progress-fill', 'quiz-active-score-text', 'quiz-prompt-label', 'quiz-prompt-display', 'quiz-keyboard-hint', 'quiz-answer-input', 'btn-quiz-submit', 'quiz-feedback-box', 'quiz-feedback-content', 'quiz-results-variant-title', 'quiz-score-circle', 'quiz-score-heading', 'quiz-score-detail', 'quiz-missed-section', 'quiz-missed-items-grid', 'btn-quiz-retry-missed'].forEach(id => createMockElement(id));

// Setup canvas mock context
const canvasContextLog = [];
const mockCanvasContext = {
  lineWidth: 1,
  strokeStyle: '',
  fillStyle: '',
  lineCap: '',
  lineJoin: '',
  clearRect(x, y, w, h) { canvasContextLog.push({ type: 'clearRect', x, y, w, h }); },
  beginPath() { canvasContextLog.push({ type: 'beginPath' }); },
  closePath() { canvasContextLog.push({ type: 'closePath' }); },
  moveTo(x, y) { canvasContextLog.push({ type: 'moveTo', x, y }); },
  lineTo(x, y) { canvasContextLog.push({ type: 'lineTo', x, y }); },
  stroke() { canvasContextLog.push({ type: 'stroke', strokeStyle: this.strokeStyle, lineWidth: this.lineWidth }); },
  fill() { canvasContextLog.push({ type: 'fill', fillStyle: this.fillStyle }); },
  arc(x, y, r, sa, ea) { canvasContextLog.push({ type: 'arc', x, y, r }); },
  save() { canvasContextLog.push({ type: 'save' }); },
  restore() { canvasContextLog.push({ type: 'restore' }); },
  setLineDash(d) { canvasContextLog.push({ type: 'setLineDash', d }); }
};

const canvasEl = elements['writing-canvas'];
canvasEl.width = 400;
canvasEl.height = 400;
canvasEl.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 400 });
canvasEl.getContext = (type) => mockCanvasContext;
canvasEl.setPointerCapture = () => {};
canvasEl.releasePointerCapture = () => {};

global.document = {
  getElementById(id) { return elements[id] || null; },
  querySelectorAll(sel) { return Object.values(elements); },
  addEventListener() {}
};
global.window = {
  scrollTo() {},
  addEventListener() {},
  scrollY: 0
};
global.DataLoader = {
  loadJamoData: async () => jamoData,
  loadBlockRules: async () => blockRulesData,
  loadSyllablePractice: async () => syllableData
};

const vm = require('vm');
vm.runInThisContext(mainJsContent);

// Test App initialization and pool counts
App.data.jamo = jamoData;
App.data.blockRules = blockRulesData;
App.data.syllables = syllableData;

App.updateWritingFilterCounts();

console.log('Jamo Writing Counts:');
console.log(' - All Jamo:', App.getJamoWritingList('all').length, '=> UI:', elements['jamo-writing-filter-all'].textContent);
console.log(' - Basic Consonants:', App.getJamoWritingList('basic_consonants').length, '=> UI:', elements['jamo-writing-filter-bc'].textContent);
console.log(' - Basic Vowels:', App.getJamoWritingList('basic_vowels').length, '=> UI:', elements['jamo-writing-filter-bv'].textContent);
console.log(' - Double Consonants:', App.getJamoWritingList('double_tense_consonants').length, '=> UI:', elements['jamo-writing-filter-dc'].textContent);
console.log(' - Compound Vowels:', App.getJamoWritingList('compound_vowels').length, '=> UI:', elements['jamo-writing-filter-cv'].textContent);

console.log('\nSyllables Writing Counts:');
console.log(' - All Syllables:', App.getSyllableWritingList('all').length, '=> UI:', elements['syllable-writing-filter-all'].textContent);
console.log(' - Vertical Right:', App.getSyllableWritingList('vertical_right').length, '=> UI:', elements['syllable-writing-filter-vr'].textContent);
console.log(' - Horizontal Below:', App.getSyllableWritingList('horizontal_below').length, '=> UI:', elements['syllable-writing-filter-hb'].textContent);
console.log(' - Diphthong Wrap:', App.getSyllableWritingList('diphthong_wrap').length, '=> UI:', elements['syllable-writing-filter-dw'].textContent);
console.log(' - UI Special Case:', App.getSyllableWritingList('ui_special_case').length, '=> UI:', elements['syllable-writing-filter-ui'].textContent);

// Verify exact numbers
if (App.getJamoWritingList('all').length !== 40) throw new Error('Expected 40 jamo in writing mode');
if (App.getJamoWritingList('basic_consonants').length !== 14) throw new Error('Expected 14 basic consonants (including ㅇ) in writing mode');
if (App.getSyllableWritingList('all').length !== 28) throw new Error('Expected 28 syllables in writing mode');

console.log('\n=== STEP 3: Testing Jamo Writing Session & Navigation ===');
App.state.activeJamoWritingCategory = 'basic_consonants';
App.startWritingSession('jamo');

console.log('Item 1 Model Char:', elements['writing-model-char'].textContent);
console.log('Item 1 Details:', elements['writing-model-details'].innerHTML.trim());
console.log('Item 1 Progress Text:', elements['writing-active-progress-text'].textContent);

if (elements['writing-model-char'].textContent !== 'ㄱ') throw new Error('Item 1 should be ㄱ');
if (!elements['writing-active-progress-text'].textContent.includes('1 of 14')) throw new Error('Progress should say 1 of 14');

console.log('\n=== STEP 4: Testing Canvas Pointer Event Drawing Simulation ===');
canvasContextLog.length = 0; // reset log

App.initWritingCanvas();

// Simulate Pointer Events
const pointerDownListener = canvasEl._listeners['pointerdown'][0];
const pointerMoveListener = canvasEl._listeners['pointermove'][0];
const pointerUpListener = canvasEl._listeners['pointerup'][0];

// 1. Pointer down at (50, 50)
pointerDownListener({ clientX: 50, clientY: 50, preventDefault() {}, pointerId: 1 });
// 2. Pointer move to (250, 50)
pointerMoveListener({ clientX: 250, clientY: 50, preventDefault() {}, pointerId: 1 });
// 3. Pointer move to (250, 250)
pointerMoveListener({ clientX: 250, clientY: 250, preventDefault() {}, pointerId: 1 });
// 4. Pointer up
pointerUpListener({ preventDefault() {}, pointerId: 1 });

console.log('Drawing stroke event logs recorded:', canvasContextLog.length, 'canvas operations.');
const lineTos = canvasContextLog.filter(x => x.type === 'lineTo');
console.log('LineTo operations:', lineTos);

if (lineTos.length !== 2 || lineTos[0].x !== 250 || lineTos[0].y !== 50 || lineTos[1].x !== 250 || lineTos[1].y !== 250) {
  throw new Error('Canvas stroke coordinate interpolation failed');
}
console.log('[PASS] Canvas pointer drawing simulated accurately.');

console.log('\n=== STEP 5: Testing Clear Canvas Button ===');
canvasContextLog.length = 0;
App.clearWritingCanvas();
const clearOps = canvasContextLog.filter(x => x.type === 'clearRect');
const guideDashes = canvasContextLog.filter(x => x.type === 'setLineDash');
console.log('Clear operations executed:', clearOps.length, '| Guideline dashes drawn:', guideDashes.length);
if (clearOps.length === 0 || guideDashes.length === 0) throw new Error('clearWritingCanvas did not clear and draw guides');
console.log('[PASS] Canvas cleared and guide quadrants redrawn.');

console.log('\n=== STEP 6: Testing Next / Prev Item Navigation ===');
App.nextWritingItem();
console.log('Advanced to Item 2 Model Char:', elements['writing-model-char'].textContent);
console.log('Item 2 Progress Text:', elements['writing-active-progress-text'].textContent);
if (elements['writing-model-char'].textContent !== 'ㄴ') throw new Error('Item 2 should be ㄴ');
if (!elements['writing-active-progress-text'].textContent.includes('2 of 14')) throw new Error('Progress should say 2 of 14');

App.prevWritingItem();
console.log('Returned to Item 1 Model Char:', elements['writing-model-char'].textContent);
if (elements['writing-model-char'].textContent !== 'ㄱ') throw new Error('Item 1 should be ㄱ');
console.log('[PASS] Item navigation forwards and backwards verified.');

console.log('\n=== STEP 7: Testing Syllables Writing Session ===');
App.state.activeSyllableWritingCategory = 'diphthong_wrap';
App.startWritingSession('syllable');

console.log('Syllables Pool (Diphthong Wrap) Item 1 Char:', elements['writing-model-char'].textContent);
console.log('Item 1 Progress Text:', elements['writing-active-progress-text'].textContent);
console.log('Item 1 Details:', elements['writing-model-details'].innerHTML.trim());

if (elements['writing-model-char'].textContent !== '와') throw new Error('Item 1 should be 와');
if (!elements['writing-active-progress-text'].textContent.includes('1 of 8')) throw new Error('Progress should say 1 of 8');

App.nextWritingItem();
console.log('Advanced to Syllable Item 2 Char:', elements['writing-model-char'].textContent);
if (elements['writing-model-char'].textContent !== '과') throw new Error('Item 2 should be 과');
console.log('[PASS] Syllable Writing Mode verified successfully.');

console.log('\n=============================================');
console.log('ALL WRITING MODE VERIFICATION TESTS PASSED!');
console.log('=============================================');
