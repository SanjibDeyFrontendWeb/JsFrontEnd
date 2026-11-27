// Everything we keep in LocalStorage lives here.
// The watchlist is just an array of CoinGecko ids, e.g. ["bitcoin", "solana"].

const WATCHLIST_KEY = 'coinwatch-watchlist';
const THEME_KEY = 'coinwatch-theme';

function getWatchlist() {
  try {
    const saved = JSON.parse(localStorage.getItem(WATCHLIST_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    // Someone edited the value by hand and broke the JSON. Start fresh.
    return [];
  }
}

function saveWatchlist(ids) {
  // An empty watchlist removes the key completely, so the Application tab stays clean
  if (ids.length === 0) {
    localStorage.removeItem(WATCHLIST_KEY);
  } else {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(ids));
  }
}

function isInWatchlist(id) {
  return getWatchlist().includes(id);
}

// Adds the coin if it's not there, removes it if it is.
// Returns true when the coin ends up in the watchlist.
function toggleWatchlist(id) {
  const list = getWatchlist();

  if (list.includes(id)) {
    saveWatchlist(list.filter((coinId) => coinId !== id));
    return false;
  }

  saveWatchlist([...list, id]);
  return true;
}

// The theme is read by the small script in index.html's <head>,
// so the page gets the right colours before it paints.
function saveTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
}
