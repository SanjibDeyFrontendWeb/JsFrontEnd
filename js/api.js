// All calls to the CoinGecko API go through this file.
// Free plan, no API key needed. Docs: https://docs.coingecko.com/v3.0.1/reference/introduction
//
// These functions throw on failure. The screens in app.js wrap every call
// in try/catch and show the error state.

const API_BASE = 'https://api.coingecko.com/api/v3';

// Fetches a path and returns the JSON, or throws an error whose message
// is safe to show to the user.
async function getJSON(path) {
  let response;

  try {
    response = await fetch(API_BASE + path);
  } catch {
    // fetch only throws when the request never got an answer
    if (!navigator.onLine) {
      throw new Error("You're offline. Check your internet connection and try again.");
    }
    throw new Error("Couldn't reach CoinGecko. If you've refreshed a lot, the free limit may be used up — wait a minute and try again.");
  }

  if (response.status === 429) {
    throw new Error('Too many requests. CoinGecko allows about 30 per minute on the free plan — wait a minute and try again.');
  }
  if (response.status === 404) {
    throw new Error("We couldn't find that coin.");
  }
  if (!response.ok) {
    throw new Error(`CoinGecko had a problem (error ${response.status}). Please try again.`);
  }

  return response.json();
}

// Top 20 coins by market cap, priced in rupees
async function fetchTopCoins() {
  return getJSON(
    '/coins/markets?vs_currency=inr&order=market_cap_desc&per_page=20&page=1' +
    '&sparkline=true&price_change_percentage=24h,7d'
  );
}

// Market data for a specific list of coin ids (used by search and the watchlist)
async function fetchCoinsByIds(ids) {
  if (ids.length === 0) return [];

  return getJSON(
    '/coins/markets?vs_currency=inr&ids=' + encodeURIComponent(ids.join(',')) +
    '&order=market_cap_desc&sparkline=true&price_change_percentage=24h,7d'
  );
}

// Search by name or symbol. The search endpoint doesn't return prices,
// so we take the first 10 matches and ask for their market data.
async function searchCoins(query) {
  const result = await getJSON('/search?query=' + encodeURIComponent(query));
  const ids = result.coins.slice(0, 10).map((coin) => coin.id);
  const coins = await fetchCoinsByIds(ids);

  // /coins/markets sorts by market cap, but for search the best match should come first.
  // Some brand-new coins have no market data yet, so filter(Boolean) drops the gaps.
  return ids
    .map((id) => coins.find((coin) => coin.id === id))
    .filter(Boolean);
}

// Everything about one coin: description, links, stats, 7-day prices
async function fetchCoinDetail(id) {
  return getJSON(
    '/coins/' + encodeURIComponent(id) +
    '?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=true'
  );
}
