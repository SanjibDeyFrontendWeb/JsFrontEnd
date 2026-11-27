// Main file: keeps the app's state, handles user actions and switches screens.

// ---------- State ----------
let topCoins = [];
let searchResults = null;   // null means "not searching right now"
let searchQuery = '';
let activeFilter = 'all';   // 'all' | 'gainers' | 'losers'
let lastUpdated = null;
let latestSearchId = 0;     // used to ignore old search responses
let watchlistCoins = [];
let currentCoinId = null;
let hasNavigated = false;

// ---------- Elements ----------
const homeView = document.getElementById('home-view');
const detailView = document.getElementById('detail-view');
const watchlistView = document.getElementById('watchlist-view');

const coinList = document.getElementById('coin-list');
const listTitle = document.getElementById('list-title');
const listSubtitle = document.getElementById('list-subtitle');
const marketSummary = document.getElementById('market-summary');
const lastUpdatedText = document.getElementById('last-updated');
const searchInput = document.getElementById('search-input');
const searchHint = document.getElementById('search-hint');
const filterChips = document.getElementById('filter-chips');
const sortSelect = document.getElementById('sort-select');
const refreshBtn = document.getElementById('refresh-btn');

const coinDetail = document.getElementById('coin-detail');
const backBtn = document.getElementById('back-btn');

const watchlistList = document.getElementById('watchlist-list');
const watchlistHead = document.getElementById('watchlist-head');
const watchlistSubtitle = document.getElementById('watchlist-subtitle');
const watchlistRefreshBtn = document.getElementById('watchlist-refresh-btn');
const watchlistActions = document.getElementById('watchlist-actions');
const clearWatchlistBtn = document.getElementById('clear-watchlist-btn');
const watchlistCount = document.getElementById('watchlist-count');
const themeToggle = document.getElementById('theme-toggle');

// ---------- Small helpers ----------

function setLoading(button, isLoading) {
  button.disabled = isLoading;
  button.classList.toggle('is-loading', isLoading);
}

function updateLastUpdated() {
  lastUpdatedText.textContent = lastUpdated ? 'Updated ' + timeAgo(lastUpdated) : '';
}

// The Watchlist link is always in the menu.
// The little number badge next to it only shows when something is saved.
function updateWatchlistNav() {
  const count = getWatchlist().length;
  watchlistCount.textContent = count;
  watchlistCount.classList.toggle('hidden', count === 0);
}

// ---------- Home: sort + filter ----------

const sorters = {
  market_cap_desc: (a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0),
  market_cap_asc: (a, b) => (a.market_cap ?? 0) - (b.market_cap ?? 0),
  price_desc: (a, b) => (b.current_price ?? 0) - (a.current_price ?? 0),
  price_asc: (a, b) => (a.current_price ?? 0) - (b.current_price ?? 0),
  change_desc: (a, b) => (get24hChange(b) ?? -Infinity) - (get24hChange(a) ?? -Infinity),
  change_asc: (a, b) => (get24hChange(a) ?? Infinity) - (get24hChange(b) ?? Infinity),
};

function getVisibleCoins() {
  const coins = searchResults ?? topCoins;

  const filtered = coins.filter((coin) => {
    if (activeFilter === 'gainers') return get24hChange(coin) > 0;
    if (activeFilter === 'losers') return get24hChange(coin) < 0;
    return true;
  });

  // sort() changes the array in place, so sort a copy
  return [...filtered].sort(sorters[sortSelect.value]);
}

function updateSummary() {
  const coins = searchResults ?? topCoins;
  const up = coins.filter((coin) => get24hChange(coin) > 0).length;
  const down = coins.filter((coin) => get24hChange(coin) < 0).length;
  marketSummary.textContent = coins.length ? `${up} up · ${down} down in the last 24 hours` : '';
}

function renderHomeList() {
  const coins = getVisibleCoins();
  updateSummary();
  updateLastUpdated();

  if (searchResults) {
    listTitle.textContent = `Results for "${searchQuery}"`;
    listSubtitle.textContent = `${searchResults.length} ${searchResults.length === 1 ? 'coin' : 'coins'} found. Press Esc to go back to the top 20.`;
  } else {
    listTitle.textContent = "Today's top 20 coins";
    listSubtitle.textContent = 'Prices in Indian Rupees, live from CoinGecko.';
  }

  if (coins.length > 0) {
    renderCoinList(coinList, coins);
    return;
  }

  // Nothing to show. Explain why, depending on what the user did.
  if (searchResults && searchResults.length === 0) {
    renderMessage(coinList, {
      type: 'empty',
      title: `No coins match "${searchQuery}"`,
      text: 'Check the spelling, or try the symbol instead, like BTC or ETH.',
      buttonText: 'Clear search',
      onButton: clearSearch,
    });
  } else {
    renderMessage(coinList, {
      type: 'empty',
      icon: activeFilter === 'gainers' ? '📉' : '📈',
      title: activeFilter === 'gainers' ? 'No gainers here right now' : 'No losers here right now',
      text: 'Every coin in this list is moving the other way today.',
      buttonText: 'Show all coins',
      onButton: () => setFilter('all'),
    });
  }
}

function setFilter(filter) {
  activeFilter = filter;
  filterChips.querySelectorAll('[data-filter]').forEach((chip) => {
    const isActive = chip.dataset.filter === filter;
    chip.classList.toggle('chip-active', isActive);
    chip.setAttribute('aria-pressed', isActive);
  });
  renderHomeList();
}

// ---------- Home: loading data ----------

async function loadTopCoins() {
  setLoading(refreshBtn, true);
  renderSkeletonRows(coinList, 10);

  try {
    topCoins = await fetchTopCoins();
    lastUpdated = new Date();
    renderHomeList();
  } catch (error) {
    marketSummary.textContent = '';
    lastUpdatedText.textContent = '';
    renderMessage(coinList, {
      type: 'error',
      title: "Couldn't load prices",
      text: error.message,
      buttonText: 'Try again',
      onButton: loadTopCoins,
    });
  } finally {
    setLoading(refreshBtn, false);
  }
}

async function runSearch(query) {
  // Every search gets a number. If the user types again before this one
  // finishes, a newer number exists and this response gets ignored.
  // That stops slow old results from replacing newer ones.
  const searchId = ++latestSearchId;
  searchQuery = query;

  listTitle.textContent = `Searching for "${query}"…`;
  listSubtitle.textContent = '';
  marketSummary.textContent = '';
  lastUpdatedText.textContent = '';
  setLoading(refreshBtn, true);
  renderSkeletonRows(coinList, 5);

  try {
    const results = await searchCoins(query);
    if (searchId !== latestSearchId) return;

    searchResults = results;
    lastUpdated = new Date();
    renderHomeList();
  } catch (error) {
    if (searchId !== latestSearchId) return;

    listTitle.textContent = `Results for "${query}"`;
    lastUpdatedText.textContent = '';
    renderMessage(coinList, {
      type: 'error',
      title: 'Search failed',
      text: error.message,
      buttonText: 'Try again',
      onButton: () => runSearch(query),
    });
  } finally {
    if (searchId === latestSearchId) setLoading(refreshBtn, false);
  }
}

function clearSearch() {
  latestSearchId++; // cancels any search still on its way
  searchQuery = '';
  searchResults = null;
  searchInput.value = '';
  searchHint.classList.remove('invisible');
  setLoading(refreshBtn, false);

  // If the first load failed there's nothing to go back to, so fetch again
  if (topCoins.length === 0) {
    loadTopCoins();
  } else {
    renderHomeList();
  }
}

const debouncedSearch = debounce(() => {
  const query = searchInput.value.trim();
  if (query.length === 0) clearSearch();
  else if (query.length >= 2) runSearch(query);
}, 400);

// ---------- Watchlist ----------

async function loadWatchlist() {
  const ids = getWatchlist();

  if (ids.length === 0) {
    watchlistCoins = [];
    renderWatchlist();
    return;
  }

  watchlistHead.classList.remove('hidden');
  watchlistActions.classList.remove('hidden');
  setLoading(watchlistRefreshBtn, true);
  renderSkeletonRows(watchlistList, Math.min(ids.length, 8));

  try {
    watchlistCoins = await fetchCoinsByIds(ids);
    renderWatchlist();
  } catch (error) {
    renderMessage(watchlistList, {
      type: 'error',
      title: "Couldn't load your watchlist",
      text: error.message + ' Your saved coins are safe, they just need fresh prices.',
      buttonText: 'Try again',
      onButton: loadWatchlist,
    });
  } finally {
    setLoading(watchlistRefreshBtn, false);
  }
}

function renderWatchlist() {
  const count = watchlistCoins.length;
  watchlistHead.classList.toggle('hidden', count === 0);
  watchlistActions.classList.toggle('hidden', count === 0);

  if (count === 0) {
    watchlistSubtitle.textContent = 'Coins you save will show up here.';
    renderMessage(watchlistList, {
      type: 'empty',
      icon: '🤍',
      title: 'Your watchlist is empty',
      text: 'Tap the heart next to any coin to keep an eye on it here. It stays saved even after you close the browser.',
      buttonText: 'Browse coins',
      onButton: () => { location.hash = '#/'; },
    });
    return;
  }

  watchlistSubtitle.textContent = `${count} ${count === 1 ? 'coin' : 'coins'} · saved in this browser`;
  renderCoinList(watchlistList, watchlistCoins, true);
}

// Empties the whole watchlist in one go. Undo puts every coin back.
function clearWatchlist() {
  const savedIds = getWatchlist();
  if (savedIds.length === 0) return;

  saveWatchlist([]);
  updateWatchlistNav();
  watchlistCoins = [];
  renderWatchlist();

  showToast(`Removed ${savedIds.length} ${savedIds.length === 1 ? 'coin' : 'coins'} from your watchlist`, 'Undo', () => {
    saveWatchlist(savedIds);
    updateWatchlistNav();
    if (location.hash === '#/watchlist') loadWatchlist();
  });
}

function onHeartClick(id, name) {
  const added = toggleWatchlist(id);
  updateWatchlistNav();

  // The same coin can have a heart in more than one place, so update them all
  document.querySelectorAll(`[data-heart-id="${CSS.escape(id)}"]`).forEach((button) => {
    updateHeartButton(button, added);
  });

  if (location.hash === '#/watchlist') {
    if (added) {
      loadWatchlist(); // came back through Undo, so fetch its price again
    } else {
      watchlistCoins = watchlistCoins.filter((coin) => coin.id !== id);
      renderWatchlist();
    }
  }

  showToast(
    added ? `${name} added to your watchlist` : `${name} removed from your watchlist`,
    'Undo',
    () => onHeartClick(id, name)
  );
}

// ---------- Event delegation ----------
// One listener on each list instead of one per row.
// Rows get rebuilt all the time (sort, filter, refresh) and this keeps working
// without adding new listeners every time.

function handleListClick(event) {
  const heartButton = event.target.closest('[data-action="heart"]');
  if (heartButton) {
    onHeartClick(heartButton.dataset.heartId, heartButton.dataset.name);
    return;
  }

  // "Remove" button on the watchlist screen. The coin is always saved here,
  // so toggling it takes it out (and gives the same Undo toast as the heart).
  const removeButton = event.target.closest('[data-action="remove"]');
  if (removeButton) {
    onHeartClick(removeButton.dataset.coinId, removeButton.dataset.name);
    return;
  }

  // The coin name is already a link, let it do its job
  if (event.target.closest('a')) return;

  const row = event.target.closest('.coin-row');
  if (row) location.hash = '#/coin/' + row.dataset.id;
}

coinList.addEventListener('click', handleListClick);
watchlistList.addEventListener('click', handleListClick);
coinDetail.addEventListener('click', handleListClick);

filterChips.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-filter]');
  if (chip) setFilter(chip.dataset.filter);
});

// ---------- Coin detail ----------

async function loadCoinDetail(id) {
  renderDetailSkeleton(coinDetail);

  try {
    const coin = await fetchCoinDetail(id);
    if (currentCoinId !== id) return; // user already opened something else

    renderCoinDetail(coinDetail, coin);
    document.title = `${coin.name} price in INR — CoinWatch ₹`;
  } catch (error) {
    if (currentCoinId !== id) return;

    renderMessage(coinDetail, {
      type: 'error',
      title: "Couldn't load this coin",
      text: error.message,
      buttonText: 'Try again',
      onButton: () => loadCoinDetail(id),
    });
  }
}

// ---------- Simple hash router ----------
// #/            -> home
// #/coin/<id>   -> coin detail
// #/watchlist   -> watchlist

function showView(view) {
  [homeView, detailView, watchlistView].forEach((section) => {
    section.classList.toggle('hidden', section !== view);
  });
}

function setActiveNav(name) {
  document.querySelectorAll('[data-nav]').forEach((link) => {
    link.classList.toggle('active', link.dataset.nav === name);
  });
}

function router() {
  const hash = location.hash || '#/';
  currentCoinId = null;

  if (hash.startsWith('#/coin/')) {
    currentCoinId = decodeURIComponent(hash.slice('#/coin/'.length));
    showView(detailView);
    setActiveNav('');
    loadCoinDetail(currentCoinId);
  } else if (hash === '#/watchlist') {
    showView(watchlistView);
    setActiveNav('watchlist');
    document.title = 'My watchlist — CoinWatch ₹';
    loadWatchlist();
  } else {
    showView(homeView);
    setActiveNav('home');
    document.title = 'CoinWatch ₹ — Live crypto prices in rupees';

    // Only fetch the first time. After that, just redraw so hearts are up to date.
    if (topCoins.length === 0 && !searchResults) {
      loadTopCoins();
    } else {
      renderHomeList();
    }
  }

  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => {
  hasNavigated = true;
  router();
});

// ---------- Other events ----------

searchInput.addEventListener('input', () => {
  // Hide the "/" hint once there's text, it overlaps the clear button
  searchHint.classList.toggle('invisible', searchInput.value !== '');
  debouncedSearch();
});

searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    clearSearch();
    searchInput.blur();
  }
});

// Press "/" anywhere on the home screen to jump to the search box
document.addEventListener('keydown', (event) => {
  const typing = ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName);
  if (event.key === '/' && !typing && !homeView.classList.contains('hidden')) {
    event.preventDefault();
    searchInput.focus();
  }
});

sortSelect.addEventListener('change', renderHomeList);

refreshBtn.addEventListener('click', () => {
  if (searchQuery) runSearch(searchQuery);
  else loadTopCoins();
});

watchlistRefreshBtn.addEventListener('click', loadWatchlist);
clearWatchlistBtn.addEventListener('click', clearWatchlist);

backBtn.addEventListener('click', () => {
  // If the user landed straight on a coin page there's no "back" inside the app
  if (hasNavigated) history.back();
  else location.hash = '#/';
});

themeToggle.addEventListener('click', () => {
  const isDark = document.documentElement.classList.toggle('dark');
  saveTheme(isDark ? 'dark' : 'light');
});

// Keep "Updated 3 min ago" fresh without reloading anything
setInterval(updateLastUpdated, 30000);

// ---------- Start ----------
updateWatchlistNav();
router();
