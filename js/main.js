/**
 * Hangul Hub — Main Application Logic, View Routing & Quiz Engine
 * Note: Quiz scores and session progress are deliberately kept in-memory without localStorage 
 * persistence per current zero-dependency scope.
 */

const App = {
  data: {
    jamo: null,
    blockRules: null,
    syllables: null,
    vocabulary: null
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

    // Vocabulary Flashcard Deck State
    vocabDeck: [],
    vocabIndex: 0,
    vocabFlipped: false,
    vocabCategoryFilter: 'all',

    // Quiz Engine State
    activeQuizVariant: null,          // 'jamo-hangul-to-rom' | 'jamo-rom-to-hangul' | 'syl-hangul-to-rom' | 'syl-rom-to-hangul' | 'vocab-hangul-to-rom' | 'vocab-rom-to-hangul' | 'vocab-hangul-to-eng'
    activeJamoQuizCategory: 'all',     // 'all' | 'basic_consonants' | 'basic_vowels' | 'double_tense_consonants' | 'compound_vowels'
    activeSyllableQuizCategory: 'all', // 'all' | 'vertical_right' | 'horizontal_below' | 'diphthong_wrap' | 'ui_special_case'
    activeVocabQuizCategory: 'all',    // 'all' | 'greetings_phrases' | 'numbers_sino_korean' | 'numbers_native_korean' | 'family_terms' | 'days_of_week' | 'common_nouns' | 'pronouns_and_verbs'
    quizItems: [],                    // Array of current round item objects
    quizIndex: 0,
    quizScore: 0,
    quizSubmitted: false,
    quizMissedItems: [],              // Array of { item, prompt, expected, userAnswer }
    isRetryRound: false,

    // Writing Mode State (Freehand Canvas, Visual Self-Check Only)
    // Note: No persistence — canvas clears and progress resets on page reload per project spec.
    activeWritingType: null,             // 'jamo' | 'syllable'
    activeJamoWritingCategory: 'all',    // 'all' | 'basic_consonants' | 'basic_vowels' | 'double_tense_consonants' | 'compound_vowels'
    activeSyllableWritingCategory: 'all',// 'all' | 'vertical_right' | 'horizontal_below' | 'diphthong_wrap' | 'ui_special_case'
    writingItems: [],                    // Sequential pool of item objects
    writingIndex: 0,
    isDrawing: false
  },

  async init() {
    this.bindEvents();
    this.initScrollListeners();
    this.initWritingCanvas();
    
    try {
      // Async data loading via DataLoader
      const [jamo, blockRules, syllables, vocabulary] = await Promise.all([
        DataLoader.loadJamoData(),
        DataLoader.loadBlockRules(),
        DataLoader.loadSyllablePractice(),
        DataLoader.loadVocabularyData()
      ]);

      this.data.jamo = jamo;
      this.data.blockRules = blockRules;
      this.data.syllables = syllables;
      this.data.vocabulary = vocabulary;

      // Initialize default flashcard decks, quiz filter counts & writing filter counts
      this.initJamoDeck('all');
      this.initSyllableDeck('all');
      this.initVocabDeck('all');
      this.updateQuizFilterCounts();
      this.updateWritingFilterCounts();

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

  // Flatten all 4 jamo categories into a single ordered array of 40 entries (for Study Mode)
  getJamoFlatList() {
    if (!this.data.jamo) return [];
    return [
      ...this.data.jamo.basic_consonants,
      ...this.data.jamo.basic_vowels,
      ...this.data.jamo.double_tense_consonants,
      ...this.data.jamo.compound_vowels
    ];
  },

  // Get filtered Jamo list for Quiz Mode (EXCLUDES items where romanization_initial is null, e.g. ㅇ)
  getJamoQuizList(subCategory = 'all') {
    if (!this.data.jamo) return [];
    let rawList = [];
    if (subCategory === 'all') {
      rawList = this.getJamoFlatList();
    } else {
      rawList = this.data.jamo[subCategory] || [];
    }
    // Filter out entries with null romanization_initial (e.g. silent initial ㅇ)
    return rawList.filter(item => item.romanization_initial !== null);
  },

  // Get Syllable list for Quiz Mode (supports sub-categories)
  getSyllableQuizList(subCategory = 'all') {
    if (!this.data.syllables) return [];
    const items = this.data.syllables.practice_items || [];
    if (subCategory === 'all') {
      return items;
    }
    return items.filter(item => item.vowel_category === subCategory);
  },

  // Flatten all 7 vocabulary categories into a single ordered array of 60 entries
  getVocabFlatList() {
    if (!this.data.vocabulary) return [];
    return [
      ...(this.data.vocabulary.greetings_phrases || []),
      ...(this.data.vocabulary.numbers_sino_korean || []),
      ...(this.data.vocabulary.numbers_native_korean || []),
      ...(this.data.vocabulary.family_terms || []),
      ...(this.data.vocabulary.days_of_week || []),
      ...(this.data.vocabulary.common_nouns || []),
      ...(this.data.vocabulary.pronouns_and_verbs || [])
    ];
  },

  // Get Vocabulary list for Quiz Mode (supports sub-categories)
  getVocabQuizList(subCategory = 'all') {
    if (!this.data.vocabulary) return [];
    if (subCategory === 'all') {
      return this.getVocabFlatList();
    }
    return this.data.vocabulary[subCategory] || [];
  },

  updateQuizFilterCounts() {
    if (!this.data.jamo || !this.data.syllables) return;

    // Jamo Quiz Counts
    const jamoAll = this.getJamoQuizList('all').length;
    const jamoBC = this.getJamoQuizList('basic_consonants').length;
    const jamoBV = this.getJamoQuizList('basic_vowels').length;
    const jamoDC = this.getJamoQuizList('double_tense_consonants').length;
    const jamoCV = this.getJamoQuizList('compound_vowels').length;

    const btnJamoAll = document.getElementById('jamo-quiz-filter-all');
    const btnJamoBC = document.getElementById('jamo-quiz-filter-bc');
    const btnJamoBV = document.getElementById('jamo-quiz-filter-bv');
    const btnJamoDC = document.getElementById('jamo-quiz-filter-dc');
    const btnJamoCV = document.getElementById('jamo-quiz-filter-cv');

    if (btnJamoAll) btnJamoAll.textContent = `All Jamo (${jamoAll})`;
    if (btnJamoBC) btnJamoBC.textContent = `Basic Consonants (${jamoBC})`;
    if (btnJamoBV) btnJamoBV.textContent = `Basic Vowels (${jamoBV})`;
    if (btnJamoDC) btnJamoDC.textContent = `Double Consonants (${jamoDC})`;
    if (btnJamoCV) btnJamoCV.textContent = `Compound Vowels (${jamoCV})`;

    // Syllable Quiz Counts
    const sylAll = this.getSyllableQuizList('all').length;
    const sylVR = this.getSyllableQuizList('vertical_right').length;
    const sylHB = this.getSyllableQuizList('horizontal_below').length;
    const sylDW = this.getSyllableQuizList('diphthong_wrap').length;
    const sylUI = this.getSyllableQuizList('ui_special_case').length;

    const btnSylAll = document.getElementById('syllable-quiz-filter-all');
    const btnSylVR = document.getElementById('syllable-quiz-filter-vr');
    const btnSylHB = document.getElementById('syllable-quiz-filter-hb');
    const btnSylDW = document.getElementById('syllable-quiz-filter-dw');
    const btnSylUI = document.getElementById('syllable-quiz-filter-ui');

    if (btnSylAll) btnSylAll.textContent = `All Syllables (${sylAll})`;
    if (btnSylVR) btnSylVR.textContent = `Vertical Right (${sylVR})`;
    if (btnSylHB) btnSylHB.textContent = `Horizontal Below (${sylHB})`;
    if (btnSylDW) btnSylDW.textContent = `Diphthong Wrap (${sylDW})`;
    if (btnSylUI) btnSylUI.textContent = `UI Special Case (${sylUI})`;

    // Vocabulary Quiz Counts
    if (this.data.vocabulary) {
      const vocabAll = this.getVocabQuizList('all').length;
      const vocabGP = this.getVocabQuizList('greetings_phrases').length;
      const vocabNSK = this.getVocabQuizList('numbers_sino_korean').length;
      const vocabNNK = this.getVocabQuizList('numbers_native_korean').length;
      const vocabFT = this.getVocabQuizList('family_terms').length;
      const vocabDOW = this.getVocabQuizList('days_of_week').length;
      const vocabCN = this.getVocabQuizList('common_nouns').length;
      const vocabPV = this.getVocabQuizList('pronouns_and_verbs').length;

      const btnVocabAll = document.getElementById('vocab-quiz-filter-all');
      const btnVocabGP = document.getElementById('vocab-quiz-filter-gp');
      const btnVocabNSK = document.getElementById('vocab-quiz-filter-nsk');
      const btnVocabNNK = document.getElementById('vocab-quiz-filter-nnk');
      const btnVocabFT = document.getElementById('vocab-quiz-filter-ft');
      const btnVocabDOW = document.getElementById('vocab-quiz-filter-dow');
      const btnVocabCN = document.getElementById('vocab-quiz-filter-cn');
      const btnVocabPV = document.getElementById('vocab-quiz-filter-pv');

      if (btnVocabAll) btnVocabAll.textContent = `All Vocab (${vocabAll})`;
      if (btnVocabGP) btnVocabGP.textContent = `Greetings & Phrases (${vocabGP})`;
      if (btnVocabNSK) btnVocabNSK.textContent = `Sino-Korean Numbers (${vocabNSK})`;
      if (btnVocabNNK) btnVocabNNK.textContent = `Native Korean Numbers (${vocabNNK})`;
      if (btnVocabFT) btnVocabFT.textContent = `Family Terms (${vocabFT})`;
      if (btnVocabDOW) btnVocabDOW.textContent = `Days of the Week (${vocabDOW})`;
      if (btnVocabCN) btnVocabCN.textContent = `Common Nouns (${vocabCN})`;
      if (btnVocabPV) btnVocabPV.textContent = `Pronouns & Verbs (${vocabPV})`;
    }

    // Section Titles
    const activeJamoCount = this.getJamoQuizList(this.state.activeJamoQuizCategory).length;
    const activeSylCount = this.getSyllableQuizList(this.state.activeSyllableQuizCategory).length;
    const activeVocabCount = this.getVocabQuizList(this.state.activeVocabQuizCategory).length;

    const jamoTitle = document.getElementById('jamo-quiz-section-title');
    const sylTitle = document.getElementById('syllable-quiz-section-title');
    const vocabTitle = document.getElementById('vocab-quiz-section-title');

    if (jamoTitle) jamoTitle.textContent = `Jamo Character Quizzes (${activeJamoCount} Items)`;
    if (sylTitle) sylTitle.textContent = `Syllable Block Quizzes (${activeSylCount} Items)`;
    if (vocabTitle) vocabTitle.textContent = `Vocabulary Quizzes (${activeVocabCount} Items)`;
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
    if (writingCard) writingCard.addEventListener('click', () => this.navigateTo('writing-select'));

    // Quiz Variant Selection Cards
    const qvJamo1 = document.getElementById('quiz-variant-jamo-hangul-to-rom');
    const qvJamo2 = document.getElementById('quiz-variant-jamo-rom-to-hangul');
    const qvSyl1 = document.getElementById('quiz-variant-syl-hangul-to-rom');
    const qvSyl2 = document.getElementById('quiz-variant-syl-rom-to-hangul');

    if (qvJamo1) qvJamo1.addEventListener('click', () => this.startQuizVariant('jamo-hangul-to-rom'));
    if (qvJamo2) qvJamo2.addEventListener('click', () => this.startQuizVariant('jamo-rom-to-hangul'));
    if (qvSyl1) qvSyl1.addEventListener('click', () => this.startQuizVariant('syl-hangul-to-rom'));
    if (qvSyl2) qvSyl2.addEventListener('click', () => this.startQuizVariant('syl-rom-to-hangul'));

    // Vocabulary Quiz Variant Cards
    const qvVocab1 = document.getElementById('quiz-variant-vocab-hangul-to-rom');
    const qvVocab2 = document.getElementById('quiz-variant-vocab-rom-to-hangul');
    const qvVocab3 = document.getElementById('quiz-variant-vocab-hangul-to-eng');
    if (qvVocab1) qvVocab1.addEventListener('click', () => this.startQuizVariant('vocab-hangul-to-rom'));
    if (qvVocab2) qvVocab2.addEventListener('click', () => this.startQuizVariant('vocab-rom-to-hangul'));
    if (qvVocab3) qvVocab3.addEventListener('click', () => this.startQuizVariant('vocab-hangul-to-eng'));

    // Writing Mode Track Selection Cards
    const wtJamo = document.getElementById('writing-track-jamo');
    const wtSyl = document.getElementById('writing-track-syllable');
    if (wtJamo) wtJamo.addEventListener('click', () => this.startWritingSession('jamo'));
    if (wtSyl) wtSyl.addEventListener('click', () => this.startWritingSession('syllable'));

    // Writing View Jamo Category Filters
    const jamoWritingFilterNav = document.getElementById('jamo-writing-filters');
    if (jamoWritingFilterNav) {
      jamoWritingFilterNav.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
          jamoWritingFilterNav.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
          e.target.classList.add('active');
          this.state.activeJamoWritingCategory = e.target.dataset.category;
          this.updateWritingFilterCounts();
        }
      });
    }

    // Writing View Syllable Category Filters
    const syllableWritingFilterNav = document.getElementById('syllable-writing-filters');
    if (syllableWritingFilterNav) {
      syllableWritingFilterNav.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
          syllableWritingFilterNav.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
          e.target.classList.add('active');
          this.state.activeSyllableWritingCategory = e.target.dataset.category;
          this.updateWritingFilterCounts();
        }
      });
    }

    // Quiz View Jamo Category Filters
    const jamoQuizFilterNav = document.getElementById('jamo-quiz-filters');
    if (jamoQuizFilterNav) {
      jamoQuizFilterNav.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
          jamoQuizFilterNav.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
          e.target.classList.add('active');
          this.state.activeJamoQuizCategory = e.target.dataset.category;
          this.updateQuizFilterCounts();
        }
      });
    }

    // Quiz View Syllable Category Filters
    const syllableQuizFilterNav = document.getElementById('syllable-quiz-filters');
    if (syllableQuizFilterNav) {
      syllableQuizFilterNav.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
          syllableQuizFilterNav.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
          e.target.classList.add('active');
          this.state.activeSyllableQuizCategory = e.target.dataset.category;
          this.updateQuizFilterCounts();
        }
      });
    }

    // Quiz View Vocabulary Category Filters
    const vocabQuizFilterNav = document.getElementById('vocab-quiz-filters');
    if (vocabQuizFilterNav) {
      vocabQuizFilterNav.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
          vocabQuizFilterNav.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
          e.target.classList.add('active');
          this.state.activeVocabQuizCategory = e.target.dataset.category;
          this.updateQuizFilterCounts();
        }
      });
    }

    // Learning Hub Cards
    const lJamoList = document.getElementById('card-learning-jamo-list');
    const lJamoCard = document.getElementById('card-learning-jamo-flashcard');
    const lSylList = document.getElementById('card-learning-syllable-list');
    const lSylCard = document.getElementById('card-learning-syllable-flashcard');
    const lVocabList = document.getElementById('card-learning-vocab-list');
    const lVocabCard = document.getElementById('card-learning-vocab-flashcard');

    if (lJamoList) lJamoList.addEventListener('click', () => this.navigateTo('jamo-list'));
    if (lJamoCard) lJamoCard.addEventListener('click', () => this.navigateTo('jamo-flashcard'));
    if (lSylList) lSylList.addEventListener('click', () => this.navigateTo('syllable-list'));
    if (lSylCard) lSylCard.addEventListener('click', () => this.navigateTo('syllable-flashcard'));
    if (lVocabList) lVocabList.addEventListener('click', () => this.navigateTo('vocab-list'));
    if (lVocabCard) lVocabCard.addEventListener('click', () => this.navigateTo('vocab-flashcard'));

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

    // Vocabulary List Category Filters
    const vocabFilterNav = document.getElementById('vocab-list-filters');
    if (vocabFilterNav) {
      vocabFilterNav.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
          vocabFilterNav.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
          e.target.classList.add('active');
          this.renderVocabList(e.target.dataset.category);
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

    // Vocabulary Flashcard Controls
    const vocabCardWrapper = document.getElementById('vocab-card-wrapper');
    if (vocabCardWrapper) {
      vocabCardWrapper.addEventListener('click', () => this.toggleVocabFlip());
    }
    const btnVocabFlip = document.getElementById('btn-vocab-flip');
    if (btnVocabFlip) btnVocabFlip.addEventListener('click', () => this.toggleVocabFlip());
    const btnVocabPrev = document.getElementById('btn-vocab-prev');
    if (btnVocabPrev) btnVocabPrev.addEventListener('click', () => this.prevVocabCard());
    const btnVocabNext = document.getElementById('btn-vocab-next');
    if (btnVocabNext) btnVocabNext.addEventListener('click', () => this.nextVocabCard());
    const vocabDeckFilter = document.getElementById('vocab-deck-filter');
    if (vocabDeckFilter) {
      vocabDeckFilter.addEventListener('change', (e) => {
        this.initVocabDeck(e.target.value);
      });
    }

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
      } else if (this.state.currentView === 'vocab-flashcard') {
        if (e.key === 'ArrowLeft') this.prevVocabCard();
        else if (e.key === 'ArrowRight') this.nextVocabCard();
        else if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          this.toggleVocabFlip();
        }
      } else if (this.state.currentView === 'quiz-active') {
        if (e.key === 'Enter' && this.state.quizSubmitted) {
          e.preventDefault();
          this.nextQuizQuestion();
        } else if (!this.state.quizSubmitted && ['1', '2', '3', '4'].includes(e.key)) {
          const btn = document.querySelector(`.quiz-mc-btn[data-index="${e.key}"]`);
          if (btn && !btn.disabled) {
            btn.click();
          }
        }
      } else if (this.state.currentView === 'writing-active') {
        if (e.key === 'ArrowLeft') this.prevWritingItem();
        else if (e.key === 'ArrowRight') this.nextWritingItem();
        else if (e.key.toLowerCase() === 'c' || e.key === 'Delete') {
          this.clearWritingCanvas();
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
      const isLongPage = this.state.currentView === 'jamo-list' || this.state.currentView === 'syllable-list' || this.state.currentView === 'vocab-list' || this.state.currentView === 'quiz-results';

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
    if (viewId === 'home' || viewId.startsWith('quiz') || viewId.startsWith('writing')) {
      document.getElementById('nav-practice-hub').classList.add('active');
    } else if (viewId === 'learning-hub' || viewId.startsWith('jamo') || viewId.startsWith('syllable') || viewId.startsWith('vocab')) {
      document.getElementById('nav-learning-hub').classList.add('active');
    }

    // Scroll to top on navigation
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Render View Content
    if (viewId === 'jamo-list') {
      this.renderJamoList('all');
    } else if (viewId === 'syllable-list') {
      this.renderSyllableList('all');
    } else if (viewId === 'vocab-list') {
      this.renderVocabList('all');
    } else if (viewId === 'jamo-flashcard') {
      this.renderJamoCard();
    } else if (viewId === 'syllable-flashcard') {
      this.renderSyllableCard();
    } else if (viewId === 'vocab-flashcard') {
      this.renderVocabCard();
    } else if (viewId === 'quiz-select') {
      this.updateQuizFilterCounts();
    } else if (viewId === 'writing-select') {
      this.updateWritingFilterCounts();
    } else if (viewId === 'coming-soon' && extraParam) {
      document.getElementById('coming-soon-title').textContent = `${extraParam} — Coming Soon`;
    }
  },

  /* ==========================================================================
     QUIZ ENGINE LOGIC
     ========================================================================== */
  
  getCategoryNameLabel(catKey) {
    const labels = {
      basic_consonants: 'Basic Consonants',
      basic_vowels: 'Basic Vowels',
      double_tense_consonants: 'Double Consonants',
      compound_vowels: 'Compound Vowels',
      vertical_right: 'Vertical Right',
      horizontal_below: 'Horizontal Below',
      diphthong_wrap: 'Diphthong Wrap',
      ui_special_case: 'UI Special Case',
      greetings_phrases: 'Greetings & Phrases',
      numbers_sino_korean: 'Sino-Korean Numbers',
      numbers_native_korean: 'Native Korean Numbers',
      family_terms: 'Family Terms',
      days_of_week: 'Days of the Week',
      common_nouns: 'Common Nouns',
      pronouns_and_verbs: 'Pronouns & Verbs'
    };
    return labels[catKey] ? ` (${labels[catKey]})` : '';
  },

  startQuizVariant(variant) {
    this.state.activeQuizVariant = variant;
    this.state.isRetryRound = false;

    let baseItems = [];
    if (variant.startsWith('jamo')) {
      baseItems = this.getJamoQuizList(this.state.activeJamoQuizCategory);
    } else if (variant.startsWith('syl')) {
      baseItems = this.getSyllableQuizList(this.state.activeSyllableQuizCategory);
    } else if (variant.startsWith('vocab')) {
      baseItems = this.getVocabQuizList(this.state.activeVocabQuizCategory);
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
    let isMultipleChoice = false;
    let choices = [];

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
    } else if (variant === 'vocab-hangul-to-rom') {
      prompt = item.hangul;
      expected = item.romanization;
      isDirection2 = false;
    } else if (variant === 'vocab-rom-to-hangul') {
      prompt = item.romanization;
      expected = item.hangul;
      isDirection2 = true;
    } else if (variant === 'vocab-hangul-to-eng') {
      prompt = item.hangul;
      expected = item.english;
      isDirection2 = false;
      isMultipleChoice = true;

      // Deduplication check strictly on rendered English string (normalized lowercase trim)
      const normExpected = expected.trim().toLowerCase();
      const seenEnglish = new Set([normExpected]);
      const distractors = [];

      // Step 1: Prefer distractors from the SAME category
      const sameCatItems = (this.data.vocabulary && item.category && this.data.vocabulary[item.category])
        ? this.data.vocabulary[item.category].filter(c => c.id !== item.id)
        : [];
      const shuffledSameCat = this.shuffleArray(sameCatItems);

      for (const candidate of shuffledSameCat) {
        if (!candidate.english) continue;
        const normCand = candidate.english.trim().toLowerCase();
        if (!seenEnglish.has(normCand)) {
          seenEnglish.add(normCand);
          distractors.push(candidate.english);
          if (distractors.length === 3) break;
        }
      }

      // Step 2: Fallback to all other vocabulary entries across all categories if fewer than 3
      if (distractors.length < 3) {
        const allOtherItems = this.getVocabFlatList().filter(c => c.id !== item.id);
        const shuffledAllOther = this.shuffleArray(allOtherItems);

        for (const candidate of shuffledAllOther) {
          if (!candidate.english) continue;
          const normCand = candidate.english.trim().toLowerCase();
          if (!seenEnglish.has(normCand)) {
            seenEnglish.add(normCand);
            distractors.push(candidate.english);
            if (distractors.length === 3) break;
          }
        }
      }

      // Step 3: Combine correct answer with exactly 3 unique distractors, then shuffle
      choices = this.shuffleArray([expected, ...distractors]);
    }

    return { prompt, expected, isDirection2, isMultipleChoice, choices };
  },

  renderQuizQuestion() {
    const item = this.state.quizItems[this.state.quizIndex];
    if (!item) {
      this.renderQuizResults();
      return;
    }

    this.state.quizSubmitted = false;
    const variant = this.state.activeQuizVariant;
    const { prompt, expected, isDirection2, isMultipleChoice, choices } = this.getQuizItemDetails(item, variant);

    const variantTitles = {
      'jamo-hangul-to-rom': 'Jamo: Hangul → Romanization',
      'jamo-rom-to-hangul': 'Jamo: Romanization → Hangul',
      'syl-hangul-to-rom': 'Syllables: Hangul → Romanization',
      'syl-rom-to-hangul': 'Syllables: Romanization → Hangul',
      'vocab-hangul-to-rom': 'Vocabulary: Hangul → Romanization',
      'vocab-rom-to-hangul': 'Vocabulary: Romanization → Hangul',
      'vocab-hangul-to-eng': 'Vocabulary: Hangul → English Meaning'
    };

    let categoryLabel = '';
    if (variant.startsWith('jamo')) {
      categoryLabel = this.getCategoryNameLabel(this.state.activeJamoQuizCategory);
    } else if (variant.startsWith('syl')) {
      categoryLabel = this.getCategoryNameLabel(this.state.activeSyllableQuizCategory);
    } else if (variant.startsWith('vocab')) {
      categoryLabel = this.getCategoryNameLabel(this.state.activeVocabQuizCategory);
    }

    document.getElementById('quiz-active-title').textContent = `${variantTitles[variant]}${categoryLabel} ${this.state.isRetryRound ? '(Retry Round)' : ''}`;
    
    const currentNum = this.state.quizIndex + 1;
    const totalNum = this.state.quizItems.length;
    document.getElementById('quiz-active-subtitle').textContent = `Question ${currentNum} of ${totalNum}`;
    document.getElementById('quiz-active-progress-text').textContent = `Question ${currentNum} of ${totalNum}`;
    document.getElementById('quiz-active-score-text').textContent = `Score: ${this.state.quizScore}`;

    const pct = (currentNum / totalNum) * 100;
    document.getElementById('quiz-active-progress-fill').style.width = `${pct}%`;

    // Prompt Box
    if (isMultipleChoice) {
      document.getElementById('quiz-prompt-label').textContent = 'Choose the correct English meaning:';
    } else if (isDirection2) {
      document.getElementById('quiz-prompt-label').textContent = 'Type the corresponding Korean Hangul character:';
    } else {
      document.getElementById('quiz-prompt-label').textContent = 'Type the English romanization:';
    }

    const promptElem = document.getElementById('quiz-prompt-display');
    promptElem.textContent = prompt;
    if (prompt.length > 5) {
      promptElem.style.fontSize = '3.5rem';
    } else if (prompt.length > 3) {
      promptElem.style.fontSize = '4.2rem';
    } else {
      promptElem.style.fontSize = '5.5rem';
    }

    // Keyboard Hint Box for Direction 2
    const kbHint = document.getElementById('quiz-keyboard-hint');
    if (kbHint) {
      kbHint.style.display = isDirection2 ? 'block' : 'none';
    }

    // Toggle Input Mode: Typed vs. Multiple Choice
    const formElem = document.getElementById('quiz-answer-form');
    const mcContainer = document.getElementById('quiz-mc-container');
    const inputElem = document.getElementById('quiz-answer-input');
    const submitBtn = document.getElementById('btn-quiz-submit');
    const feedbackBox = document.getElementById('quiz-feedback-box');

    feedbackBox.style.display = 'none';

    if (isMultipleChoice) {
      formElem.style.display = 'none';
      mcContainer.style.display = 'block';

      this._currentChoices = choices;
      const optionsGrid = document.getElementById('quiz-mc-options');
      optionsGrid.innerHTML = choices.map((choice, idx) => {
        const escapedChoice = choice.replace(/"/g, '&quot;');
        return `
          <button type="button" class="quiz-mc-btn" data-index="${idx + 1}" data-choice="${escapedChoice}" onclick="App.handleMultipleChoiceSelect(this, ${idx})">
            <span class="quiz-mc-badge">${idx + 1}</span>
            <span class="quiz-mc-text">${choice}</span>
          </button>
        `;
      }).join('');
    } else {
      formElem.style.display = 'block';
      mcContainer.style.display = 'none';

      inputElem.value = '';
      inputElem.disabled = false;
      submitBtn.disabled = false;

      setTimeout(() => {
        inputElem.focus();
      }, 50);
    }
  },

  handleMultipleChoiceSelect(clickedBtn, choiceIdx) {
    if (this.state.quizSubmitted) return;

    const item = this.state.quizItems[this.state.quizIndex];
    if (!item) return;

    const variant = this.state.activeQuizVariant;
    const { prompt, expected } = this.getQuizItemDetails(item, variant);
    const selectedChoice = this._currentChoices[choiceIdx];

    const isCorrect = (selectedChoice.trim().toLowerCase() === expected.trim().toLowerCase());
    this.state.quizSubmitted = true;

    // Disable all choice buttons and mark results
    const allButtons = document.querySelectorAll('.quiz-mc-btn');
    allButtons.forEach(btn => {
      btn.disabled = true;
      const btnChoice = btn.dataset.choice;
      if (btnChoice.trim().toLowerCase() === expected.trim().toLowerCase()) {
        btn.classList.add('selected-correct');
      }
    });

    if (isCorrect) {
      this.state.quizScore++;
      clickedBtn.classList.add('selected-correct');
    } else {
      clickedBtn.classList.add('selected-incorrect');
      this.state.quizMissedItems.push({
        item: item,
        prompt: prompt,
        expected: expected,
        userAnswer: selectedChoice
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
        <div class="feedback-detail">Prompt: <strong>${prompt}</strong> &bull; Correct Meaning: <strong>${expected}</strong></div>
      `;
    } else {
      feedbackBox.className = 'quiz-feedback-box feedback-incorrect';
      feedbackContent.innerHTML = `
        <div class="feedback-title">✗ Incorrect</div>
        <div class="feedback-detail">Prompt: <strong>${prompt}</strong></div>
        <div class="feedback-detail" style="margin-top: 0.25rem;">Your Choice: <span style="text-decoration: line-through;">"${selectedChoice}"</span> &bull; Correct Meaning: <strong>"${expected}"</strong></div>
      `;
    }

    // Focus Next button
    const nextBtn = document.getElementById('btn-quiz-next');
    if (nextBtn) {
      setTimeout(() => nextBtn.focus(), 50);
    }
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
      'syl-rom-to-hangul': 'Syllables: Romanization → Hangul',
      'vocab-hangul-to-rom': 'Vocabulary: Hangul → Romanization',
      'vocab-rom-to-hangul': 'Vocabulary: Romanization → Hangul',
      'vocab-hangul-to-eng': 'Vocabulary: Hangul → English Meaning'
    };

    let categoryLabel = '';
    if (this.state.activeQuizVariant.startsWith('jamo')) {
      categoryLabel = this.getCategoryNameLabel(this.state.activeJamoQuizCategory);
    } else if (this.state.activeQuizVariant.startsWith('syl')) {
      categoryLabel = this.getCategoryNameLabel(this.state.activeSyllableQuizCategory);
    } else if (this.state.activeQuizVariant.startsWith('vocab')) {
      categoryLabel = this.getCategoryNameLabel(this.state.activeVocabQuizCategory);
    }

    document.getElementById('quiz-results-variant-title').textContent = `${variantTitles[this.state.activeQuizVariant]}${categoryLabel} ${this.state.isRetryRound ? '(Retry Round)' : ''}`;
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
  },

  /* ==========================================================================
     Vocabulary List View Rendering
     ========================================================================== */
  renderVocabList(filterCategory = 'all') {
    const container = document.getElementById('vocab-list-content');
    if (!container || !this.data.vocabulary) return;

    const categoryTitles = {
      greetings_phrases: 'Greetings & Phrases (인사말과 표현 - 8)',
      numbers_sino_korean: 'Sino-Korean Numbers (한자어 수사 - 10)',
      numbers_native_korean: 'Native Korean Numbers (고유어 수사 - 10)',
      family_terms: 'Family Terms (가족 호칭 - 8)',
      days_of_week: 'Days of the Week (요일 - 7)',
      common_nouns: 'Common Nouns (기초 명사 - 10)',
      pronouns_and_verbs: 'Pronouns & Verbs (대명사와 동사 - 7)'
    };

    let html = '';
    const allCategories = [
      'greetings_phrases',
      'numbers_sino_korean',
      'numbers_native_korean',
      'family_terms',
      'days_of_week',
      'common_nouns',
      'pronouns_and_verbs'
    ];

    const categoriesToRender = filterCategory === 'all'
      ? allCategories
      : [filterCategory];

    categoriesToRender.forEach(catKey => {
      const items = this.data.vocabulary[catKey] || [];
      if (items.length === 0) return;

      html += `
        <div class="list-section-header">
          <h3>${categoryTitles[catKey] || catKey}</h3>
        </div>
        <div class="jamo-grid">
      `;

      items.forEach(item => {
        let verbHtml = '';
        if (item.verb_stem && item.polite_present_form) {
          verbHtml = `
            <div class="vocab-card-verb-info">
              <div>Stem: <strong>${item.verb_stem}-</strong></div>
              <div>Polite Present: <strong>${item.polite_present_form}</strong></div>
            </div>
          `;
        }

        html += `
          <div class="jamo-card" style="text-align: left; align-items: flex-start;">
            <div class="jamo-char" style="font-size: 2.5rem; margin-bottom: 0.3rem;">${item.hangul}</div>
            <div class="vocab-card-rom">Romanization: <strong>${item.romanization}</strong></div>
            <div class="vocab-card-eng">Meaning: <strong>${item.english}</strong></div>
            <div class="jamo-note" style="margin-top: 0.25rem;">${item.usage_note}</div>
            ${verbHtml}
            <div style="margin-top: 0.75rem;"><span class="category-tag">${catKey.replace(/_/g, ' ')}</span></div>
          </div>
        `;
      });

      html += `</div>`;
    });

    container.innerHTML = html;
  },

  /* ==========================================================================
     Vocabulary Flashcard Logic
     ========================================================================== */
  initVocabDeck(filterCategory = 'all') {
    this.state.vocabCategoryFilter = filterCategory;
    const flatList = this.getVocabFlatList();

    if (filterCategory === 'all') {
      this.state.vocabDeck = flatList;
    } else {
      this.state.vocabDeck = this.data.vocabulary ? (this.data.vocabulary[filterCategory] || []) : [];
    }

    this.state.vocabIndex = 0;
    this.state.vocabFlipped = false;
    this.renderVocabCard();
  },

  toggleVocabFlip() {
    this.state.vocabFlipped = !this.state.vocabFlipped;
    const wrapper = document.getElementById('vocab-card-wrapper');
    if (wrapper) {
      if (this.state.vocabFlipped) wrapper.classList.add('flipped');
      else wrapper.classList.remove('flipped');
    }
  },

  nextVocabCard() {
    if (this.state.vocabDeck.length === 0) return;
    this.state.vocabIndex = (this.state.vocabIndex + 1) % this.state.vocabDeck.length;
    this.state.vocabFlipped = false;
    this.renderVocabCard();
  },

  prevVocabCard() {
    if (this.state.vocabDeck.length === 0) return;
    this.state.vocabIndex = (this.state.vocabIndex - 1 + this.state.vocabDeck.length) % this.state.vocabDeck.length;
    this.state.vocabFlipped = false;
    this.renderVocabCard();
  },

  renderVocabCard() {
    const card = this.state.vocabDeck[this.state.vocabIndex];
    if (!card) return;

    // Reset flip state
    const wrapper = document.getElementById('vocab-card-wrapper');
    if (wrapper) wrapper.classList.remove('flipped');
    this.state.vocabFlipped = false;

    // Front: Hangul (adjust font size for multi-syllable phrases)
    const frontElem = document.getElementById('vocab-card-front-char');
    frontElem.textContent = card.hangul;
    if (card.hangul.length > 5) {
      frontElem.style.fontSize = '3.5rem';
    } else if (card.hangul.length > 3) {
      frontElem.style.fontSize = '4.5rem';
    } else {
      frontElem.style.fontSize = '6rem';
    }

    // Back
    let verbInfo = '';
    if (card.verb_stem && card.polite_present_form) {
      verbInfo = `
        <div class="vocab-card-verb-info" style="margin-bottom: 0.5rem;">
          Stem: <strong>${card.verb_stem}-</strong> &bull; Present: <strong>${card.polite_present_form}</strong>
        </div>
      `;
    }

    const backContent = `
      <div class="card-back-header-char" style="font-size: 2.2rem;">${card.hangul}</div>
      <div style="font-size: 1.15rem; color: var(--primary-text); font-weight: 800; margin-bottom: 0.25rem;">${card.romanization}</div>
      <div style="font-size: 1.1rem; color: var(--text-main); font-weight: 700; margin-bottom: 0.6rem;">${card.english}</div>
      <div class="jamo-note" style="font-size: 0.9rem; max-width: 480px; text-align: center;">${card.usage_note}</div>
      ${verbInfo}
      <div style="margin-top: 0.6rem;"><span class="category-tag">${card.category.replace(/_/g, ' ')}</span></div>
    `;

    document.getElementById('vocab-card-back-content').innerHTML = backContent;

    // Progress Bar & Count
    const current = this.state.vocabIndex + 1;
    const total = this.state.vocabDeck.length;
    document.getElementById('vocab-card-count').textContent = `Card ${current} of ${total}`;
    const pct = total > 0 ? (current / total) * 100 : 0;
    document.getElementById('vocab-progress-fill').style.width = `${pct}%`;
  },

  /* ==========================================================================
     WRITING PRACTICE ENGINE LOGIC (Visual Self-Check Only)
     Note: No persistence — canvas clears and progress resets on page reload per project spec.
     ========================================================================== */

  // Get Jamo pool for Writing Mode (INCLUDES ALL 40 jamo, including ㅇ)
  getJamoWritingList(subCategory = 'all') {
    if (!this.data.jamo) return [];
    if (subCategory === 'all') {
      return this.getJamoFlatList();
    }
    return this.data.jamo[subCategory] || [];
  },

  // Get Syllables pool for Writing Mode (all 28 or by vowel_category)
  getSyllableWritingList(subCategory = 'all') {
    if (!this.data.syllables) return [];
    const items = this.data.syllables.practice_items || [];
    if (subCategory === 'all') {
      return items;
    }
    return items.filter(item => item.vowel_category === subCategory);
  },

  updateWritingFilterCounts() {
    if (!this.data.jamo || !this.data.syllables) return;

    // Jamo Writing Counts (All 40 jamo included)
    const jAll = this.getJamoWritingList('all').length;
    const jBC = this.getJamoWritingList('basic_consonants').length;
    const jBV = this.getJamoWritingList('basic_vowels').length;
    const jDC = this.getJamoWritingList('double_tense_consonants').length;
    const jCV = this.getJamoWritingList('compound_vowels').length;

    const btnJAll = document.getElementById('jamo-writing-filter-all');
    const btnJBC = document.getElementById('jamo-writing-filter-bc');
    const btnJBV = document.getElementById('jamo-writing-filter-bv');
    const btnJDC = document.getElementById('jamo-writing-filter-dc');
    const btnJCV = document.getElementById('jamo-writing-filter-cv');

    if (btnJAll) btnJAll.textContent = `All Jamo (${jAll})`;
    if (btnJBC) btnJBC.textContent = `Basic Consonants (${jBC})`;
    if (btnJBV) btnJBV.textContent = `Basic Vowels (${jBV})`;
    if (btnJDC) btnJDC.textContent = `Double Consonants (${jDC})`;
    if (btnJCV) btnJCV.textContent = `Compound Vowels (${jCV})`;

    // Syllable Writing Counts
    const sAll = this.getSyllableWritingList('all').length;
    const sVR = this.getSyllableWritingList('vertical_right').length;
    const sHB = this.getSyllableWritingList('horizontal_below').length;
    const sDW = this.getSyllableWritingList('diphthong_wrap').length;
    const sUI = this.getSyllableWritingList('ui_special_case').length;

    const btnSAll = document.getElementById('syllable-writing-filter-all');
    const btnSVR = document.getElementById('syllable-writing-filter-vr');
    const btnSHB = document.getElementById('syllable-writing-filter-hb');
    const btnSDW = document.getElementById('syllable-writing-filter-dw');
    const btnSUI = document.getElementById('syllable-writing-filter-ui');

    if (btnSAll) btnSAll.textContent = `All Syllables (${sAll})`;
    if (btnSVR) btnSVR.textContent = `Vertical Right (${sVR})`;
    if (btnSHB) btnSHB.textContent = `Horizontal Below (${sHB})`;
    if (btnSDW) btnSDW.textContent = `Diphthong Wrap (${sDW})`;
    if (btnSUI) btnSUI.textContent = `UI Special Case (${sUI})`;

    const jTitle = document.getElementById('jamo-writing-section-title');
    const sTitle = document.getElementById('syllable-writing-section-title');
    const activeJCount = this.getJamoWritingList(this.state.activeJamoWritingCategory).length;
    const activeSCount = this.getSyllableWritingList(this.state.activeSyllableWritingCategory).length;

    if (jTitle) jTitle.textContent = `Jamo Character Writing (${activeJCount} Items)`;
    if (sTitle) sTitle.textContent = `Syllable Block Writing (${activeSCount} Items)`;
  },

  startWritingSession(type) {
    this.state.activeWritingType = type;
    this.state.writingIndex = 0;

    if (type === 'jamo') {
      this.state.writingItems = this.getJamoWritingList(this.state.activeJamoWritingCategory);
    } else if (type === 'syllable') {
      this.state.writingItems = this.getSyllableWritingList(this.state.activeSyllableWritingCategory);
    }

    if (this.state.writingItems.length === 0) return;

    this.navigateTo('writing-active');
    this.renderWritingItem();
  },

  renderWritingItem() {
    const item = this.state.writingItems[this.state.writingIndex];
    if (!item) return;

    const currentNum = this.state.writingIndex + 1;
    const totalNum = this.state.writingItems.length;
    const pct = (currentNum / totalNum) * 100;

    // Header & Progress
    const typeLabel = this.state.activeWritingType === 'jamo' ? 'Jamo Writing Practice' : 'Syllable Writing Practice';
    const catLabel = this.state.activeWritingType === 'jamo'
      ? this.getCategoryNameLabel(this.state.activeJamoWritingCategory)
      : this.getCategoryNameLabel(this.state.activeSyllableWritingCategory);

    document.getElementById('writing-active-title').textContent = `${typeLabel}${catLabel}`;
    document.getElementById('writing-active-subtitle').textContent = `Item ${currentNum} of ${totalNum}`;
    document.getElementById('writing-active-progress-text').textContent = `Item ${currentNum} of ${totalNum}`;
    document.getElementById('writing-active-progress-fill').style.width = `${pct}%`;
    document.getElementById('writing-active-category-tag').textContent = catLabel ? catLabel.replace(/[() ]/g, '') : 'All';

    // Model Reference rendering
    const charDisplay = document.getElementById('writing-model-char');
    const badgeType = document.getElementById('writing-model-type-badge');
    const detailsContainer = document.getElementById('writing-model-details');
    const noteContainer = document.getElementById('writing-model-note');

    if (this.state.activeWritingType === 'jamo') {
      charDisplay.textContent = item.jamo;
      badgeType.textContent = `${item.type} • ${item.category}`;

      const nameStr = item.name_korean ? `${item.name_korean} (${item.name_romanized})` : '';
      let romStr = '';
      if (item.type === 'consonant') {
        const initStr = item.romanization_initial ? item.romanization_initial : '(silent)';
        const finStr = item.romanization_final ? item.romanization_final : 'N/A';
        romStr = `Initial: <strong>${initStr}</strong> | Final: <strong>${finStr}</strong>`;
      } else {
        romStr = `Romanization: <strong>${item.romanization_initial}</strong>`;
      }

      detailsContainer.innerHTML = `
        ${nameStr ? `<div class="writing-model-name">${nameStr}</div>` : ''}
        <div class="writing-model-rom">${romStr}</div>
      `;
      noteContainer.textContent = item.pronunciation_note || '';
    } else {
      // Syllable block
      charDisplay.textContent = item.composed;
      badgeType.textContent = `Layout: ${item.vowel_category}`;

      let catDesc = '';
      if (this.data.blockRules && this.data.blockRules.positioning_categories) {
        const match = this.data.blockRules.positioning_categories.find(c => c.category === item.vowel_category);
        if (match) catDesc = match.description;
      }

      const finalDisplay = item.final ? item.final : 'None';
      detailsContainer.innerHTML = `
        <div class="syllable-breakdown" style="justify-content: center; margin-bottom: 0.5rem;">
          <div class="breakdown-pill"><label>Initial</label><span>${item.initial}</span></div>
          <div class="breakdown-pill"><label>Medial</label><span>${item.medial}</span></div>
          <div class="breakdown-pill"><label>Final</label><span>${finalDisplay}</span></div>
        </div>
        <div class="writing-model-rom">Romanization: <strong>${item.expected_romanization || ''}</strong></div>
      `;
      noteContainer.textContent = catDesc || '';
    }

    // Clear Canvas for new drawing
    this.clearWritingCanvas();
  },

  nextWritingItem() {
    if (this.state.writingItems.length === 0) return;
    this.state.writingIndex = (this.state.writingIndex + 1) % this.state.writingItems.length;
    this.renderWritingItem();
  },

  prevWritingItem() {
    if (this.state.writingItems.length === 0) return;
    this.state.writingIndex = (this.state.writingIndex - 1 + this.state.writingItems.length) % this.state.writingItems.length;
    this.renderWritingItem();
  },

  initWritingCanvas() {
    const canvas = document.getElementById('writing-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    };

    const startDraw = (e) => {
      e.preventDefault();
      this.state.isDrawing = true;
      if (canvas.setPointerCapture) {
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      }
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      // Draw initial dot in case of single tap/click
      ctx.fillStyle = '#0f172a';
      ctx.arc(pos.x, pos.y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };

    const draw = (e) => {
      if (!this.state.isDrawing) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    };

    const stopDraw = (e) => {
      if (this.state.isDrawing) {
        this.state.isDrawing = false;
        ctx.closePath();
        if (canvas.releasePointerCapture) {
          try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
        }
      }
    };

    canvas.addEventListener('pointerdown', startDraw);
    canvas.addEventListener('pointermove', draw);
    canvas.addEventListener('pointerup', stopDraw);
    canvas.addEventListener('pointercancel', stopDraw);
    canvas.addEventListener('pointerleave', stopDraw);
  },

  clearWritingCanvas() {
    const canvas = document.getElementById('writing-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Clear whole buffer
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw subtle grid quadrant guidelines (dashed center lines)
    ctx.save();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);

    // Horizontal center line
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    // Vertical center line
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();

    ctx.restore();

    // Set brush properties for dark high-contrast drawing
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }
};

// Initialize App when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
