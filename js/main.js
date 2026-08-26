/**
 * Hangul Hub — Main Application Logic & View Routing
 * UI Redesign: Clean Light Theme, Stacked Progression Track Cards, Tab Switchers.
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
    syllableCategoryFilter: 'all'
  },

  async init() {
    this.bindEvents();
    
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
      console.log(`Loaded ${this.getJamoFlatList().length} Jamo entries and ${syllables.practice_items.length} syllable practice items.`);
    } catch (err) {
      console.error('App initialization failed due to data loading error:', err);
    }
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

    // Stacked Track Cards in Practice Hub
    document.getElementById('card-jamo-list').addEventListener('click', () => this.navigateTo('jamo-list'));
    document.getElementById('card-jamo-flashcard').addEventListener('click', () => this.navigateTo('jamo-flashcard'));
    document.getElementById('card-syllable-list').addEventListener('click', () => this.navigateTo('syllable-list'));
    document.getElementById('card-syllable-flashcard').addEventListener('click', () => this.navigateTo('syllable-flashcard'));
    document.getElementById('card-quiz-mode').addEventListener('click', () => this.navigateTo('coming-soon', 'Quiz Mode'));
    document.getElementById('card-writing-mode').addEventListener('click', () => this.navigateTo('coming-soon', 'Assembly & Writing Mode'));

    // Stacked Track Cards in Learning Hub
    document.getElementById('card-learning-jamo-list').addEventListener('click', () => this.navigateTo('jamo-list'));
    document.getElementById('card-learning-jamo-flashcard').addEventListener('click', () => this.navigateTo('jamo-flashcard'));
    document.getElementById('card-learning-syllable-list').addEventListener('click', () => this.navigateTo('syllable-list'));
    document.getElementById('card-learning-syllable-flashcard').addEventListener('click', () => this.navigateTo('syllable-flashcard'));

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

    // Global Keyboard Navigation for Flashcards
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
      }
    });
  },

  navigateTo(viewId, extraParam = null) {
    this.state.currentView = viewId;

    // Update View visibility
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    const targetView = document.getElementById(`view-${viewId}`);
    if (targetView) targetView.classList.add('active');

    // Update Header Active State
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    if (viewId === 'home') {
      document.getElementById('nav-practice-hub').classList.add('active');
    } else if (viewId === 'learning-hub') {
      document.getElementById('nav-learning-hub').classList.add('active');
    } else if (viewId.startsWith('jamo') || viewId.startsWith('syllable')) {
      document.getElementById('nav-learning-hub').classList.add('active');
    } else if (viewId === 'coming-soon') {
      document.getElementById('nav-practice-hub').classList.add('active');
    }

    // Scroll to top
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
        <p style="font-size: 0.85rem; margin-top: 0.25rem; color: var(--teal-text);">
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
      <div style="font-size: 2rem; font-weight: 800; color: var(--teal); font-family: var(--font-hangul); margin-bottom: 0.25rem;">${card.jamo}</div>
      ${nameStr ? `<div style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.4rem;">${nameStr}</div>` : ''}
      <div style="font-size: 0.95rem; color: var(--primary-text); font-weight: 600; margin-bottom: 0.75rem;">${romDisplay}</div>
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
      <div style="font-size: 2.2rem; font-weight: 800; color: var(--text-main); font-family: var(--font-hangul); margin-bottom: 0.5rem;">${card.composed}</div>
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
      <div class="jamo-note" style="font-size: 0.8rem;">${catDesc}</div>
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
