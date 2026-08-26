/**
 * Data Loader Module for Hangul Hub
 * Handles asynchronous fetching and parsing of decoupled JSON data files.
 * 
 * Note: Fetching JSON on page load without client-side caching (localStorage/ServiceWorker) 
 * is a deliberate simplicity choice aligned with the project's zero-build-tool scope.
 */

async function fetchJSON(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText} while fetching ${url}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Failed to load data from ${url}:`, error);
    showDataLoadError(url, error.message);
    throw error;
  }
}

function showDataLoadError(url, message) {
  const container = document.getElementById('global-error-container') || createErrorContainer();
  container.style.display = 'block';
  container.innerHTML = `
    <div class="error-banner">
      <div class="error-banner-header">
        <span class="error-icon">⚠️</span>
        <strong>Error Loading Project Data</strong>
      </div>
      <p>Could not load data file: <code>${url}</code></p>
      <p class="error-detail">${message}</p>
      <p class="error-hint">If viewing via <code>file://</code> URL, please run a local web server (e.g. <code>python -m http.server 8000</code> or <code>npx serve</code>) because browsers block local <code>fetch()</code> requests.</p>
      <button class="retry-btn" onclick="location.reload()">Retry Loading</button>
    </div>
  `;
}

function createErrorContainer() {
  const container = document.createElement('div');
  container.id = 'global-error-container';
  document.body.prepend(container);
  return container;
}

/**
 * Loads Part 1 Jamo Reference Data
 * @returns {Promise<Object>}
 */
async function loadJamoData() {
  return await fetchJSON('data/jamo/part1-jamo.json');
}

/**
 * Loads Syllable Positioning Block Rules
 * @returns {Promise<Object>}
 */
async function loadBlockRules() {
  return await fetchJSON('data/syllables/block-rules.json');
}

/**
 * Loads Part 2 Syllable Practice Items
 * @returns {Promise<Object>}
 */
async function loadSyllablePractice() {
  return await fetchJSON('data/syllables/part2-practice.json');
}

// Expose on global window object for browser script consumption
window.DataLoader = {
  loadJamoData,
  loadBlockRules,
  loadSyllablePractice
};
