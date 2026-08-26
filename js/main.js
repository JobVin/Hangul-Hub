/**
 * Hangul Hub — Main Application Logic, View Routing & Quiz Engine
 * Note: Quiz scores and session progress are deliberately kept in-memory without localStorage 
 * persistence per current zero-dependency scope.
 */

const App = {
  data: {
    jamo: null,
    blockRules: null,
    syllables: null
  },

  state: {
    currentView: 'home',

    // Jamo Flashcard Deck State
    jamoDeck: [],
    jamoIndex: 0,
    jamoFlipped: false,
    jamoCategoryFilter: 'all',

    // Syllable Flashcard Deck State
    syllableDeck: [],
    syllableIndex: 0,
    syllableFlipped: false,
    syllableCategoryFilter: 'all',

    // Quiz Engine State
    activeQuizVariant: null,   // 'jamo-hangul-to-rom' | 'jamo-rom-to-hangul' | 'syl-hangul-to-rom' | 'syl-rom-to-hangul'
    quizItems: [],             // Array of current round item objects
    quizIndex: 0,
    quizScore: 0,
    quizSubmitted: false,
    quizMissedItems: [],       // Array of { item, prompt, expected, userAnswer }
    isRetryRound: false
  },

  async init() {
    this.bindEvents();
    this.initScrollListeners();
    
    try {
      // Async data loading via DataLoader
      const [jamo, blockRules, syllables] = await Promise.all([
        DataLoader.loadJamoData(),
        DataLoader.loadBlockRules(),
        DataLoader.loadSyllablePractice()
      ]);

      this.data.jamo = jamo;
      this.data.blockRules = blockRules;
      this.data.syllables = syllables;

      // Initialize default flashcard decks
      this.initJamoDeck('all');
      this.initSyllableDeck('all');

      console.log('Hangul Hub initialized successfully.');
    } catch (err) {
      console.error('App initialization failed due to data loading error:', err);
    }
  },

  // Fisher-Yates Shuffle Algorithm for randomizing quiz item order
  shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  // Flatten all 4 jamo categories into a single ordered array of 40 entries
  getJamoFlatList() {
    if (!this.data.jamo) return [];
    return [
      ...this.data.jamo.basic_consonants,
      ...this.data.jamo.basic_vowels,
      ...this.data.jamo.double_tense_consonants,
      ...this.data.jamo.compound_vowels
    ];
  },

  bindEvents() {
    // Brand & Header Nav Links
    document.getElementById('nav-brand').addEventListener('click', () => this.navigateTo('home'));
    document.getElementById('nav-practice-hub').addEventListener('click', () => this.navigateTo('home'));
    document.getElementById('nav-learning-hub').addEventListener('click', () => this.navigateTo('learning-hub'));

    // Top Hub Switcher Tabs
    const tabPractice1 = document.getElementById('tab-practice-hub-1');
    const tabLearning1 = document.getElementById('tab-learning-hub-1');
    const tabPractice2 = document.getElementById('tab-practice-hub-2');
    const tabLearning2 = document.getElementById('tab-learning-hub-2');

    if (tabPractice1) tabPractice1.addEventListener('click', () => this.navigateTo('home'));
    if (tabLearning1) tabLearning1.addEventListener('click', () => this.navigateTo('learning-hub'));
    if (tabPractice2) tabPractice2.addEventListener('click', () => this.navigateTo('home'));
    if (tabLearning2) tabLearning2.addEventListener('click', () => this.navigateTo('learning-hub'));

    // Practice Hub Cards
    const quizCard = document.getElementById('card-quiz-mode');
    const writingCard = document.getElementById('card-writing-mode');
    if (quizCard) quizCard.addEventListener('click', () => this.navigateTo('quiz-select'));
    if (writingCard) writingCard.addEventListener('click', () => this.navigateTo('coming-soon', 'Assembly & Writing Mode'));

    // Quiz Variant Selection Cards
    const qvJamo1 = document.getElementById('quiz-variant-jamo-hangul-to-rom');
    const qvJamo2 = document.getElementById('quiz-variant-jamo-rom-to-hangul');
    const qvSyl1 = document.getElementById('quiz-variant-syl-hangul-to-rom');
    const qvSyl2 = document.getElementById('quiz-variant-syl-rom-to-hangul');

    if (qvJamo1) qvJamo1.addEventListener('click', () => this.startQuizVariant('jamo-hangul-to-rom'));
    if (qvJamo2) qvJamo2.addEventListener('click', () => this.startQuizVariant('jamo-rom-to-hangul'));
    if (qvSyl1) qvSyl1.addEventListener('click', () => this.startQuizVariant('syl-hangul-to-rom'));
    if (qvSyl2) qvSyl2.addEventListener('click', () => this.startQuizVariant('syl-rom-to-hangul'));

    // Learning Hub Cards
    const lJamoList = document.getElementById('card-learning-jamo-list');
    const lJamoCard = document.getElementById('card-learning-jamo-flashcard');
    const lSylList = document.getElementById('card-learning-syllable-list');
    const lSylCard = document.getElementById('card-learning-syllable-flashcard');

    if (lJamoList) lJamoList.addEventListener('click', () => this.navigateTo('jamo-list'));
    if (lJamoCard) lJamoCard.addEventListener('click', () => this.navigateTo('jamo-flashcard'));
    if (lSylList) lSylList.addEventListener('click', () => this.navigateTo('syllable-list'));
    if (lSylCard) lSylCard.addEventListener('click', () => this.navigateTo('syllable-flashcard'));

    // Jamo List Category Filters
    const jamoFilterNav = document.getElementById('jamo-list-filters');
    if (jamoFilterNav) {
      jamoFilterNav.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
          jamoFilterNav.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
          e.target.classList.add('active');
          this.renderJamoList(e.target.dataset.category);
        }
      });
    }

    // Syllable List Category Filters
    const syllableFilterNav = document.getElementById('syllable-list-filters');
    if (syllableFilterNav) {
      syllableFilterNav.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
          syllableFilterNav.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
          e.target.classList.add('active');
          this.renderSyllableList(e.target.dataset.category);
        }
      });
    }

    // Jamo Flashcard Controls
    const jamoCardWrapper = document.getElementById('jamo-card-wrapper');
    if (jamoCardWrapper) {
      jamoCardWrapper.addEventListener('click', () => this.toggleJamoFlip());
    }
    document.getElementById('btn-jamo-flip').addEventListener('click', () => this.toggleJamoFlip());
    document.getElementById('btn-jamo-prev').addEventListener('click', () => this.prevJamoCard());
    document.getElementById('btn-jamo-next').addEventListener('click', () => this.nextJamoCard());
    document.getElementById('jamo-deck-filter').addEventListener('change', (e) => {
      this.initJamoDeck(e.target.value);
    });

    // Syllable Flashcard Controls
    const syllableCardWrapper = document.getElementById('syllable-card-wrapper');
    if (syllableCardWrapper) {
      syllableCardWrapper.addEventListener('click', () => this.toggleSyllableFlip());
    }
    document.getElementById('btn-syllable-flip').addEventListener('click', () => this.toggleSyllableFlip());
    document.getElementById('btn-syllable-prev').addEventListener('click', () => this.prevSyllableCard());
    document.getElementById('btn-syllable-next').addEventListener('click', () => this.nextSyllableCard());
    document.getElementById('syllable-deck-filter').addEventListener('change', (e) => {
      this.initSyllableDeck(e.target.value);
    });

    // Global Keyboard Navigation
    document.addEventListener('keydown', (e) => {
      if (this.state.currentView === 'jamo-flashcard') {
        if (e.key === 'ArrowLeft') this.prevJamoCard();
        else if (e.key === 'ArrowRight') this.nextJamoCard();
        else if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          this.toggleJamoFlip();
        }
      } else if (this.state.currentView === 'syllable-flashcard') {
        if (e.key === 'ArrowLeft') this.prevSyllableCard();
        else if (e.key === 'ArrowRight') this.nextSyllableCard();
        else if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          this.toggleSyllableFlip();
        }
      } else if (this.state.currentView === 'quiz-active') {
        if (e.key === 'Enter' && this.state.quizSubmitted) {
          e.preventDefault();
          this.nextQuizQuestion();
        }
      }
    });
  },

  /* Scroll Listener for Sticky Navigation & Scroll-to-Top */
  initScrollListeners() {
    const btnScrollTop = document.getElementById('btn-scroll-top');
    const stickySubnav = document.getElementById('sticky-subnav-bar');

    if (btnScrollTop) {
      btnScrollTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    window.addEventListener('scroll', () => {
      const scrollPos = window.scrollY || document.documentElement.scrollTop;
      const isLongPage = this.state.currentView === 'jamo-list' || this.state.currentView === 'syllable-list' || this.state.currentView === 'quiz-results';

      if (btnScrollTop) {
        if (scrollPos > 300) {
          btnScrollTop.style.display = 'flex';
        } else {
          btnScrollTop.style.display = 'none';
        }
      }

      if (stickySubnav) {
        if (isLongPage && scrollPos > 400) {
          stickySubnav.style.display = 'flex';
        } else {
          stickySubnav.style.display = 'none';
        }
      }
    });
  },

  navigateTo(viewId, extraParam = null) {
    this.state.currentView = viewId;

    // Hide sticky navigation when switching views
    const stickySubnav = document.getElementById('sticky-subnav-bar');
    if (stickySubnav) stickySubnav.style.display = 'none';
    const btnScrollTop = document.getElementById('btn-scroll-top');
    if (btnScrollTop) btnScrollTop.style.display = 'none';

    // Update View visibility
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    const targetView = document.getElementById(`view-${viewId}`);
    if (targetView) targetView.classList.add('active');

    // Update Header Active State
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    if (viewId === 'home' || viewId.startsWith('quiz')) {
      document.getElementById('nav-practice-hub').classList.add('active');
    } else if (viewId === 'learning-hub' || viewId.startsWith('jamo') || viewId.startsWith('syllable')) {
      document.getElementById('nav-learning-hub').classList.add('active');
    }

    // Scroll to top on navigation
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Render View Content
    if (viewId === 'jamo-list') {
      this.renderJamoList('all');
    } else if (viewId === 'syllable-list') {
      this.renderSyllableList('all');
    } else if (viewId === 'jamo-flashcard') {
      this.renderJamoCard();
    } else if (viewId === 'syllable-flashcard') {
      this.renderSyllableCard();
    } else if (viewId === 'coming-soon' && extraParam) {
      document.getElementById('coming-soon-title').textContent = `${extraParam} — Coming Soon`;
    }
  },

  /* ==========================================================================
     QUIZ ENGINE LOGIC
     ========================================================================== */
  
  startQuizVariant(variant) {
    this.state.activeQuizVariant = variant;
    this.state.isRetryRound = false;

    let baseItems = [];
    if (variant.startsWith('jamo')) {
      baseItems = this.getJamoFlatList();
    } else if (variant.startsWith('syl')) {
      baseItems = this.data.syllables ? (this.data.syllables.practice_items || []) : [];
    }

    // Shuffle item order per quiz session
    this.state.quizItems = this.shuffleArray(baseItems);
    this.state.quizIndex = 0;
    this.state.quizScore = 0;
    this.state.quizMissedItems = [];

    this.navigateTo('quiz-active');
    this.renderQuizQuestion();
  },

  startRetryRound() {
    if (this.state.quizMissedItems.length === 0) return;

    this.state.isRetryRound = true;
    const retryBase = this.state.quizMissedItems.map(m => m.item);
    this.state.quizItems = this.shuffleArray(retryBase);
    this.state.quizIndex = 0;
    this.state.quizScore = 0;
    this.state.quizMissedItems = [];

    this.navigateTo('quiz-active');
    this.renderQuizQuestion();
  },

  confirmQuitQuiz() {
    if (confirm('Are you sure you want to quit this quiz? Your current session progress will be lost.')) {
      this.navigateTo('quiz-select');
    }
  },

  getQuizItemDetails(item, variant) {
    let prompt = '';
    let expected = '';
    let isDirection2 = false; // Direction 2 = Romanization -> Hangul (requires Korean IME)

    if (variant === 'jamo-hangul-to-rom') {
      prompt = item.jamo;
      expected = item.type === 'consonant' ? (item.romanization_initial || '') : item.romanization_initial;
      isDirection2 = false;
    } else if (variant === 'jamo-rom-to-hangul') {
      prompt = item.type === 'consonant' ? (item.romanization_initial || '(silent initial)') : item.romanization_initial;
      expected = item.jamo;
      isDirection2 = true;
    } else if (variant === 'syl-hangul-to-rom') {
      prompt = item.composed;
      expected = item.expected_romanization;
      isDirection2 = false;
    } else if (variant === 'syl-rom-to-hangul') {
      prompt = item.expected_romanization;
      expected = item.composed;
      isDirection2 = true;
    }

    return { prompt, expected, isDirection2 };
  },

  renderQuizQuestion() {
    const item = this.state.quizItems[this.state.quizIndex];
    if (!item) {
      this.renderQuizResults();
      return;
    }

    this.state.quizSubmitted = false;
    const variant = this.state.activeQuizVariant;
    const { prompt, expected, isDirection2 } = this.getQuizItemDetails(item, variant);

    const variantTitles = {
      'jamo-hangul-to-rom': 'Jamo: Hangul → Romanization',
      'jamo-rom-to-hangul': 'Jamo: Romanization → Hangul',
      'syl-hangul-to-rom': 'Syllables: Hangul → Romanization',
      'syl-rom-to-hangul': 'Syllables: Romanization → Hangul'
    };

    document.getElementById('quiz-active-title').textContent = `${variantTitles[variant]} ${this.state.isRetryRound ? '(Retry Round)' : ''}`;
    
    const currentNum = this.state.quizIndex + 1;
    const totalNum = this.state.quizItems.length;
    document.getElementById('quiz-active-subtitle').textContent = `Question ${currentNum} of ${totalNum}`;
    document.getElementById('quiz-active-progress-text').textContent = `Question ${currentNum} of ${totalNum}`;
    document.getElementById('quiz-active-score-text').textContent = `Score: ${this.state.quizScore}`;

    const pct = (currentNum / totalNum) * 100;
    document.getElementById('quiz-active-progress-fill').style.width = `${pct}%`;

    // Prompt Box
    document.getElementById('quiz-prompt-label').textContent = isDirection2 
      ? 'Type the corresponding Korean Hangul character:'
      : 'Type the English romanization:';
    document.getElementById('quiz-prompt-display').textContent = prompt;

    // Keyboard Hint Box for Direction 2
    const kbHint = document.getElementById('quiz-keyboard-hint');
    if (kbHint) {
      kbHint.style.display = isDirection2 ? 'block' : 'none';
    }

    // Input & Feedback Reset
    const inputElem = document.getElementById('quiz-answer-input');
    const submitBtn = document.getElementById('btn-quiz-submit');
    const feedbackBox = document.getElementById('quiz-feedback-box');

    inputElem.value = '';
    inputElem.disabled = false;
    submitBtn.disabled = false;
    feedbackBox.style.display = 'none';

    setTimeout(() => {
      inputElem.focus();
    }, 50);
  },

  handleQuizSubmit() {
    if (this.state.quizSubmitted) return;

    const item = this.state.quizItems[this.state.quizIndex];
    if (!item) return;

    const variant = this.state.activeQuizVariant;
    const { prompt, expected, isDirection2 } = this.getQuizItemDetails(item, variant);

    const inputElem = document.getElementById('quiz-answer-input');
    const submitBtn = document.getElementById('btn-quiz-submit');
    const rawInput = inputElem.value;

    let isCorrect = false;

    if (isDirection2) {
      // Direction 2 (Romanization -> Hangul): CRITICAL Unicode NFC Normalization Comparison
      const normInput = rawInput.normalize('NFC').trim();
      const normExpected = expected.normalize('NFC').trim();
      isCorrect = (normInput === normExpected);
    } else {
      // Direction 1 (Hangul -> Romanization): Lowercase & Trim Exact String Comparison
      const normInput = rawInput.toLowerCase().trim();
      const normExpected = expected.toLowerCase().trim();
      isCorrect = (normInput === normExpected);
    }

    this.state.quizSubmitted = true;
    inputElem.disabled = true;
    submitBtn.disabled = true;

    if (isCorrect) {
      this.state.quizScore++;
    } else {
      this.state.quizMissedItems.push({
        item: item,
        prompt: prompt,
        expected: expected,
        userAnswer: rawInput.trim() || '(empty)'
      });
    }

    // Update Header Score Display
    document.getElementById('quiz-active-score-text').textContent = `Score: ${this.state.quizScore}`;

    // Feedback Box
    const feedbackBox = document.getElementById('quiz-feedback-box');
    const feedbackContent = document.getElementById('quiz-feedback-content');
    feedbackBox.style.display = 'block';

    if (isCorrect) {
      feedbackBox.className = 'quiz-feedback-box feedback-correct';
      feedbackContent.innerHTML = `
        <div class="feedback-title">✓ Correct!</div>
        <div class="feedback-detail">Prompt: <strong>${prompt}</strong> &bull; Correct Answer: <strong>${expected}</strong></div>
      `;
    } else {
      feedbackBox.className = 'quiz-feedback-box feedback-incorrect';
      feedbackContent.innerHTML = `
        <div class="feedback-title">✗ Incorrect</div>
        <div class="feedback-detail">Prompt: <strong>${prompt}</strong></div>
        <div class="feedback-detail" style="margin-top: 0.25rem;">Your Answer: <span style="text-decoration: line-through;">"${rawInput.trim() || '(empty)'}"</span> &bull; Correct Answer: <strong>"${expected}"</strong></div>
      `;
    }

    // Focus Next button
    const nextBtn = document.getElementById('btn-quiz-next');
    if (nextBtn) {
      setTimeout(() => nextBtn.focus(), 50);
    }
  },

  nextQuizQuestion() {
    this.state.quizIndex++;
    if (this.state.quizIndex < this.state.quizItems.length) {
      this.renderQuizQuestion();
    } else {
      this.renderQuizResults();
    }
  },

  renderQuizResults() {
    this.navigateTo('quiz-results');

    const total = this.state.quizItems.length;
    const score = this.state.quizScore;
    const pct = Math.round((score / total) * 100);

    const variantTitles = {
      'jamo-hangul-to-rom': 'Jamo: Hangul → Romanization',
      'jamo-rom-to-hangul': 'Jamo: Romanization → Hangul',
      'syl-hangul-to-rom': 'Syllables: Hangul → Romanization',
      'syl-rom-to-hangul': 'Syllables: Romanization → Hangul'
    };

    document.getElementById('quiz-results-variant-title').textContent = `${variantTitles[this.state.activeQuizVariant]} ${this.state.isRetryRound ? '(Retry Round)' : ''}`;
    document.getElementById('quiz-score-circle').textContent = `${pct}%`;
    document.getElementById('quiz-score-heading').textContent = (pct === 100) ? '🎉 Perfect Score!' : 'Quiz Completed!';
    document.getElementById('quiz-score-detail').textContent = `You scored ${score} out of ${total} correct.`;

    // Missed Items Section
    const missedSection = document.getElementById('quiz-missed-section');
    const missedGrid = document.getElementById('quiz-missed-items-grid');
    const retryBtn = document.getElementById('btn-quiz-retry-missed');

    if (this.state.quizMissedItems.length > 0) {
      missedSection.style.display = 'block';
      retryBtn.style.display = 'inline-flex';

      let html = '';
      this.state.quizMissedItems.forEach(m => {
        html += `
          <div class="jamo-card" style="border-color: var(--rose); text-align: left; align-items: flex-start;">
            <div style="font-size: 0.8rem; font-weight: 700; color: var(--rose-text); text-transform: uppercase;">Prompt</div>
            <div style="font-family: var(--font-hangul); font-size: 2.4rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.4rem;">${m.prompt}</div>
            <div style="font-size: 0.9rem; color: var(--rose-text); margin-bottom: 0.2rem;">Your Answer: <span style="text-decoration: line-through;">"${m.userAnswer}"</span></div>
            <div style="font-size: 0.95rem; font-weight: 800; color: var(--teal-text);">Correct Answer: "${m.expected}"</div>
          </div>
        `;
      });
      missedGrid.innerHTML = html;
    } else {
      missedSection.style.display = 'none';
      retryBtn.style.display = 'none';
    }
  },

  /* ==========================================================================
     Jamo List View Rendering
     ========================================================================== */
  renderJamoList(filterCategory = 'all') {
    const container = document.getElementById('jamo-list-content');
    if (!container || !this.data.jamo) return;

    const categoryTitles = {
      basic_consonants: 'Basic Consonants (기초 자음 - 14)',
      basic_vowels: 'Basic Vowels (기초 모음 - 10)',
      double_tense_consonants: 'Double / Tense Consonants (쌍자음 - 5)',
      compound_vowels: 'Compound Vowels (복합 모음 - 11)'
    };

    let html = '';
    const categoriesToRender = filterCategory === 'all' 
      ? ['basic_consonants', 'basic_vowels', 'double_tense_consonants', 'compound_vowels']
      : [filterCategory];

    categoriesToRender.forEach(catKey => {
      const items = this.data.jamo[catKey] || [];
      if (items.length === 0) return;

      html += `
        <div class="list-section-header">
          <h3>${categoryTitles[catKey] || catKey}</h3>
        </div>
        <div class="jamo-grid">
      `;

      items.forEach(item => {
        let romDisplay = '';
        if (item.type === 'consonant') {
          const initStr = item.romanization_initial ? item.romanization_initial : '(silent)';
          const finStr = item.romanization_final ? item.romanization_final : 'N/A';
          romDisplay = `Initial: <strong>${initStr}</strong> | Final: <strong>${finStr}</strong>`;
        } else {
          romDisplay = `Romanization: <strong>${item.romanization_initial}</strong>`;
        }

        const nameStr = item.name_korean ? `${item.name_korean} (${item.name_romanized})` : '';

        html += `
          <div class="jamo-card">
            <div class="jamo-char">${item.jamo}</div>
            ${nameStr ? `<div class="jamo-name">${nameStr}</div>` : ''}
            <div class="jamo-rom">${romDisplay}</div>
            <div class="jamo-note">${item.pronunciation_note}</div>
          </div>
        `;
      });

      html += `</div>`;
    });

    container.innerHTML = html;
  },

  /* ==========================================================================
     Syllable List View Rendering
     ========================================================================== */
  renderSyllableList(filterCategory = 'all') {
    const container = document.getElementById('syllable-list-content');
    const batchimBox = document.getElementById('batchim-rule-intro');
    if (!container || !this.data.syllables || !this.data.blockRules) return;

    // Render Batchim Rule Banner
    const bRule = this.data.blockRules.batchim_rule;
    if (batchimBox && bRule) {
      batchimBox.innerHTML = `
        <h4>Batchim Placement Rule</h4>
        <p><strong>${bRule.description}</strong></p>
        <p style="font-size: 0.9rem; margin-top: 0.25rem; color: var(--teal-text);">
          Example Syllable: <strong>${bRule.example_syllable}</strong> — ${bRule.example_breakdown}
        </p>
      `;
    }

    const categories = this.data.blockRules.positioning_categories || [];
    const practiceItems = this.data.syllables.practice_items || [];

    let html = '';
    const categoriesToRender = filterCategory === 'all'
      ? categories
      : categories.filter(c => c.category === filterCategory);

    categoriesToRender.forEach(cat => {
      const items = practiceItems.filter(p => p.vowel_category === cat.category);
      if (items.length === 0) return;

      html += `
        <div class="list-section-header">
          <h3>Category: ${cat.category.replace('_', ' ').toUpperCase()} (${items.length} Syllables)</h3>
          <p>${cat.description}</p>
        </div>
        <div class="syllable-grid">
      `;

      items.forEach(item => {
        const finalDisplay = item.final ? item.final : 'None';
        html += `
          <div class="syllable-card">
            <div class="syllable-char">${item.composed}</div>
            <div class="syllable-breakdown">
              <div class="breakdown-pill">
                <label>Init</label>
                <span>${item.initial}</span>
              </div>
              <div class="breakdown-pill">
                <label>Medial</label>
                <span>${item.medial}</span>
              </div>
              <div class="breakdown-pill">
                <label>Final</label>
                <span>${finalDisplay}</span>
              </div>
            </div>
            <div class="category-tag">${cat.category}</div>
          </div>
        `;
      });

      html += `</div>`;
    });

    container.innerHTML = html;
  },

  /* ==========================================================================
     Jamo Flashcard Logic
     ========================================================================== */
  initJamoDeck(filterCategory = 'all') {
    this.state.jamoCategoryFilter = filterCategory;
    const flatList = this.getJamoFlatList();

    if (filterCategory === 'all') {
      this.state.jamoDeck = flatList;
    } else {
      this.state.jamoDeck = this.data.jamo ? (this.data.jamo[filterCategory] || []) : [];
    }

    this.state.jamoIndex = 0;
    this.state.jamoFlipped = false;
    this.renderJamoCard();
  },

  toggleJamoFlip() {
    this.state.jamoFlipped = !this.state.jamoFlipped;
    const wrapper = document.getElementById('jamo-card-wrapper');
    if (wrapper) {
      if (this.state.jamoFlipped) wrapper.classList.add('flipped');
      else wrapper.classList.remove('flipped');
    }
  },

  nextJamoCard() {
    if (this.state.jamoDeck.length === 0) return;
    this.state.jamoIndex = (this.state.jamoIndex + 1) % this.state.jamoDeck.length;
    this.state.jamoFlipped = false;
    this.renderJamoCard();
  },

  prevJamoCard() {
    if (this.state.jamoDeck.length === 0) return;
    this.state.jamoIndex = (this.state.jamoIndex - 1 + this.state.jamoDeck.length) % this.state.jamoDeck.length;
    this.state.jamoFlipped = false;
    this.renderJamoCard();
  },

  renderJamoCard() {
    const card = this.state.jamoDeck[this.state.jamoIndex];
    if (!card) return;

    // Reset flip state
    const wrapper = document.getElementById('jamo-card-wrapper');
    if (wrapper) wrapper.classList.remove('flipped');
    this.state.jamoFlipped = false;

    // Front
    document.getElementById('jamo-card-front-char').textContent = card.jamo;

    // Back
    let romDisplay = '';
    if (card.type === 'consonant') {
      const initStr = card.romanization_initial ? card.romanization_initial : '(silent)';
      const finStr = card.romanization_final ? card.romanization_final : 'N/A';
      romDisplay = `Initial: <strong>${initStr}</strong> | Final: <strong>${finStr}</strong>`;
    } else {
      romDisplay = `Romanization: <strong>${card.romanization_initial}</strong>`;
    }

    const nameStr = card.name_korean ? `${card.name_korean} (${card.name_romanized})` : '';

    const backContent = `
      <div class="card-back-header-char">${card.jamo}</div>
      ${nameStr ? `<div style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.4rem;">${nameStr}</div>` : ''}
      <div style="font-size: 1rem; color: var(--primary-text); font-weight: 700; margin-bottom: 0.75rem;">${romDisplay}</div>
      <div class="jamo-note">${card.pronunciation_note}</div>
      <div style="margin-top: 0.75rem;"><span class="category-tag">${card.type} &bull; ${card.category}</span></div>
    `;

    document.getElementById('jamo-card-back-content').innerHTML = backContent;

    // Progress Bar & Count
    const current = this.state.jamoIndex + 1;
    const total = this.state.jamoDeck.length;
    document.getElementById('jamo-card-count').textContent = `Card ${current} of ${total}`;
    const pct = (current / total) * 100;
    document.getElementById('jamo-progress-fill').style.width = `${pct}%`;
  },

  /* ==========================================================================
     Syllable Flashcard Logic
     ========================================================================== */
  initSyllableDeck(filterCategory = 'all') {
    this.state.syllableCategoryFilter = filterCategory;
    const items = this.data.syllables ? (this.data.syllables.practice_items || []) : [];

    if (filterCategory === 'all') {
      this.state.syllableDeck = items;
    } else {
      this.state.syllableDeck = items.filter(item => item.vowel_category === filterCategory);
    }

    this.state.syllableIndex = 0;
    this.state.syllableFlipped = false;
    this.renderSyllableCard();
  },

  toggleSyllableFlip() {
    this.state.syllableFlipped = !this.state.syllableFlipped;
    const wrapper = document.getElementById('syllable-card-wrapper');
    if (wrapper) {
      if (this.state.syllableFlipped) wrapper.classList.add('flipped');
      else wrapper.classList.remove('flipped');
    }
  },

  nextSyllableCard() {
    if (this.state.syllableDeck.length === 0) return;
    this.state.syllableIndex = (this.state.syllableIndex + 1) % this.state.syllableDeck.length;
    this.state.syllableFlipped = false;
    this.renderSyllableCard();
  },

  prevSyllableCard() {
    if (this.state.syllableDeck.length === 0) return;
    this.state.syllableIndex = (this.state.syllableIndex - 1 + this.state.syllableDeck.length) % this.state.syllableDeck.length;
    this.state.syllableFlipped = false;
    this.renderSyllableCard();
  },

  renderSyllableCard() {
    const card = this.state.syllableDeck[this.state.syllableIndex];
    if (!card) return;

    // Reset flip state
    const wrapper = document.getElementById('syllable-card-wrapper');
    if (wrapper) wrapper.classList.remove('flipped');
    this.state.syllableFlipped = false;

    // Front
    document.getElementById('syllable-card-front-char').textContent = card.composed;

    // Get positioning category description from block rules
    let catDesc = '';
    if (this.data.blockRules && this.data.blockRules.positioning_categories) {
      const match = this.data.blockRules.positioning_categories.find(c => c.category === card.vowel_category);
      if (match) catDesc = match.description;
    }

    const finalDisplay = card.final ? card.final : 'None';

    // Back
    const backContent = `
      <div class="card-back-header-char">${card.composed}</div>
      <div class="syllable-breakdown" style="justify-content: center; margin-bottom: 1rem;">
        <div class="breakdown-pill">
          <label>Initial</label>
          <span>${card.initial}</span>
        </div>
        <div class="breakdown-pill">
          <label>Medial</label>
          <span>${card.medial}</span>
        </div>
        <div class="breakdown-pill">
          <label>Final (Batchim)</label>
          <span>${finalDisplay}</span>
        </div>
      </div>
      <div style="margin-bottom: 0.5rem;"><span class="category-tag">Layout: ${card.vowel_category}</span></div>
      <div class="jamo-note" style="font-size: 0.85rem;">${catDesc}</div>
    `;

    document.getElementById('syllable-card-back-content').innerHTML = backContent;

    // Progress Bar & Count
    const current = this.state.syllableIndex + 1;
    const total = this.state.syllableDeck.length;
    document.getElementById('syllable-card-count').textContent = `Card ${current} of ${total}`;
    const pct = (current / total) * 100;
    document.getElementById('syllable-progress-fill').style.width = `${pct}%`;
  }
};

// Initialize App when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
