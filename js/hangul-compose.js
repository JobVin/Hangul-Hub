/**
 * Hangul Syllable Composition & Decomposition Utility
 * Standard Unicode Hangul Syllables algorithm (U+AC00 to U+D7A3)
 */

// 19 Initial Consonants (Choseong) in canonical Unicode order
const INITIALS = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

// 21 Medial Vowels (Jungseong) in canonical Unicode order
const MEDIALS = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
  'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'
];

// 28 Final Consonants (Jongseong) in canonical Unicode order (index 0 = no final)
const FINALS = [
  null, 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ',
  'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

/**
 * Composes an initial consonant, medial vowel, and optional final consonant into a single Hangul syllable.
 * @param {string} initial 
 * @param {string} medial 
 * @param {string|null} [final=null] 
 * @returns {string|null} Composed syllable character, or null if input jamo are invalid
 */
function composeHangul(initial, medial, final = null) {
  const iIdx = INITIALS.indexOf(initial);
  const mIdx = MEDIALS.indexOf(medial);
  const fIdx = final ? FINALS.indexOf(final) : 0;

  if (iIdx === -1 || mIdx === -1 || fIdx === -1) {
    return null;
  }

  const codePoint = 0xAC00 + (iIdx * 588) + (mIdx * 28) + fIdx;
  return String.fromCharCode(codePoint);
}

/**
 * Decomposes a composed Hangul syllable into its constituent jamo.
 * @param {string} syllable Single Hangul syllable character
 * @returns {{ initial: string, medial: string, final: string|null }|null}
 */
function decomposeHangul(syllable) {
  if (!syllable || typeof syllable !== 'string' || syllable.length === 0) {
    return null;
  }

  const codePoint = syllable.charCodeAt(0);
  if (codePoint < 0xAC00 || codePoint > 0xD7A3) {
    return null;
  }

  const delta = codePoint - 0xAC00;
  const iIdx = Math.floor(delta / 588);
  const mIdx = Math.floor((delta % 588) / 28);
  const fIdx = delta % 28;

  return {
    initial: INITIALS[iIdx],
    medial: MEDIALS[mIdx],
    final: FINALS[fIdx]
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    composeHangul,
    decomposeHangul,
    INITIALS,
    MEDIALS,
    FINALS
  };
}
