# CoinWatch ₹: how it was built, step by step

This guide explains the whole project from the first idea to the last function: where the data comes from, how the JSON is read, how each file and function works, and what happens when you search, heart a coin or lose your internet. Read it alongside the code.

---

## Contents

1. [How to open the project (no server needed)](#1-how-to-open-the-project-no-server-needed)
2. [The big picture](#2-the-big-picture)
3. [The free API: where it comes from and how to try it by hand](#3-the-free-api-where-it-comes-from-and-how-to-try-it-by-hand)
4. [Reading the JSON: destructuring and friends](#4-reading-the-json-destructuring-and-friends)
5. [Design decisions (the UI/UX side)](#5-design-decisions-the-uiux-side)
6. [The HTML skeleton](#6-the-html-skeleton)
7. [The CSS](#7-the-css)
8. [Every JS file and function explained](#8-every-js-file-and-function-explained)
9. [What happens when… (step-by-step flows)](#9-what-happens-when-step-by-step-flows)
10. [Rebuilding it yourself, in order](#10-rebuilding-it-yourself-in-order)
11. [Testing checklist + presentation demo](#11-testing-checklist--presentation-demo)
12. [Likely Q&A questions and answers](#12-likely-qa-questions-and-answers)

---

## 1. How to open the project (no server needed)

**Just double-click `index.html`.** It opens in your browser as `file:///D:/.../index.html`, and everything works: prices, search, details and the watchlist. I tested it this way in Chrome.

### Why it works without Live Server or npm

| Concern | Why it's fine |
|---|---|
| **JavaScript files** | They're loaded with plain `<script src="..." defer>`. With `type="module"`, browsers block them on `file://`. Plain scripts are allowed. |
| **Calling the API** | CoinGecko replies with the header `Access-Control-Allow-Origin: *`, meaning "any website may read this", and that includes a file opened from disk. |
| **Tailwind** | Comes from a CDN `<script>` tag. It needs internet, but no install. |
| **LocalStorage** | Works on `file://` too. The browser keeps one storage area for local files, so the watchlist survives a reload. |

> Note: LocalStorage is stored **per address**. Coins saved while using `file:///…/index.html` won't show up when you open the same project through Live Server (`http://127.0.0.1:5500`), and the other way round. They're two different "websites" to the browser. The same thing happens on Vercel: the live site has its own empty watchlist.

### What changed: the Watchlist link

You first asked for the watchlist to *disappear when LocalStorage is empty*, so the link was hidden until you saved a coin. That's why you didn't see it. Now:

- The **Watchlist** link is **always in the menu**.
- A small rose **number badge** next to it shows how many coins are saved, and hides when there are none.
- Opening the watchlist with nothing saved shows the friendly "Your watchlist is empty" screen.

The change lives in `updateWatchlistNav()` in `js/app.js` and the `watchlist-count` badge in `index.html`.

---

## 2. The big picture

```
                    ┌──────────────────────────────┐
  user clicks/types │          index.html          │  header, 3 screens, footer
 ─────────────────► │  (#home-view, #detail-view,  │
                    │   #watchlist-view)           │
                    └──────────────┬───────────────┘
                                   │ events
                                   ▼
                    ┌──────────────────────────────┐
                    │           app.js             │  state + event listeners + router
                    └───┬──────────┬───────────┬───┘
                        │          │           │
              asks for  ▼          ▼ saves     ▼ draws with
                    ┌────────┐ ┌──────────┐ ┌───────────┐
                    │ api.js │ │storage.js│ │ render.js │
                    └───┬────┘ └────┬─────┘ └─────┬─────┘
                        │           │             │ uses
                        ▼           ▼             ▼
                  CoinGecko    LocalStorage   utils.js (₹ format, debounce…)
```

- **`api.js`** only *gets* data.
- **`storage.js`** only *remembers* things.
- **`render.js`** only *draws* things.
- **`app.js`** is the boss: it decides *when* to fetch, *what* to draw, and reacts to clicks.

Keeping these jobs separate is what "clean code structure" in the rubric means. Each file has one job.

**Script order matters.** `index.html` loads `utils.js → storage.js → api.js → render.js → app.js`. All of them use `defer`, so they run in that order after the HTML is ready. A file can use functions from files loaded *before* it. `app.js` comes last because it uses everything.

---

## 3. The free API: where it comes from and how to try it by hand

### Where to find it

- **Website:** https://www.coingecko.com/en/api
- **Docs (all endpoints):** https://docs.coingecko.com/reference/introduction
- **Base URL:** `https://api.coingecko.com/api/v3`
- **Cost / key:** the public endpoints are free and need **no API key and no sign-up**. CoinGecko also offers a free "Demo" key with higher limits, but this project doesn't need it.
- **Limit:** roughly **30 requests per minute** on the keyless plan. Go over it and you get HTTP **429 Too Many Requests**. The app shows a clear message when that happens.

### Try it yourself: paste these into your browser's address bar

You'll see raw JSON. Firefox shows it as a neat tree; in Chrome, tick "Pretty-print".

1. **Top 20 coins in rupees**
   ```
   https://api.coingecko.com/api/v3/coins/markets?vs_currency=inr&order=market_cap_desc&per_page=20&page=1&sparkline=true&price_change_percentage=24h,7d
   ```
2. **Search by name**
   ```
   https://api.coingecko.com/api/v3/search?query=solana
   ```
3. **Prices for specific coins**
   ```
   https://api.coingecko.com/api/v3/coins/markets?vs_currency=inr&ids=bitcoin,solana
   ```
4. **Everything about one coin**
   ```
   https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=true
   ```

### What each query parameter means

| Parameter | Meaning |
|---|---|
| `vs_currency=inr` | Prices in Indian Rupees (try `usd` to compare) |
| `order=market_cap_desc` | Biggest coins first |
| `per_page=20&page=1` | Only the first 20 |
| `sparkline=true` | Include ~168 hourly prices for the last 7 days, used for the mini charts |
| `price_change_percentage=24h,7d` | Add 24h and 7d % change fields |
| `ids=bitcoin,solana` | Only these coins (uses CoinGecko **ids**, not symbols) |
| `localization=false` etc. | Leave out big chunks of data we don't use, so the response is smaller and faster |

### Try it in the browser console (F12 → Console)

```js
const res = await fetch('https://api.coingecko.com/api/v3/search?query=doge');
const data = await res.json();
console.log(data.coins[0]);   // { id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE', ... }
```

This is exactly what `api.js` does, just wrapped in functions.

### What the responses look like (trimmed)

**`/coins/markets`** returns an **array** of coin objects:

```json
[
  {
    "id": "bitcoin",
    "symbol": "btc",
    "name": "Bitcoin",
    "image": "https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png",
    "current_price": 5612669,
    "market_cap": 112910000000000,
    "market_cap_rank": 1,
    "total_volume": 3340871999304,
    "high_24h": 5674963,
    "low_24h": 5401120,
    "price_change_percentage_24h": 3.57,
    "price_change_percentage_24h_in_currency": 3.57,
    "price_change_percentage_7d_in_currency": -4.84,
    "sparkline_in_7d": { "price": [ 5890000.1, 5875000.4, "…168 numbers…" ] }
  }
]
```

**`/search`** returns an **object** with a `coins` array. It has **no prices**:

```json
{
  "coins": [
    { "id": "solana", "name": "Solana", "symbol": "SOL", "market_cap_rank": 7, "thumb": "…" }
  ],
  "exchanges": [], "categories": [], "nfts": []
}
```

**`/coins/{id}`** returns one big **object**. The prices are nested by currency:

```json
{
  "id": "solana",
  "name": "Solana",
  "symbol": "sol",
  "market_cap_rank": 7,
  "image": { "thumb": "…", "small": "…", "large": "…" },
  "description": { "en": "Solana is a high-performance … <a href=\"…\">…</a>" },
  "links": { "homepage": ["https://solana.com/", "", ""] },
  "market_data": {
    "current_price": { "inr": 6548.4, "usd": 72.1 },
    "market_cap":    { "inr": 3880000000000 },
    "ath":           { "inr": 25396 },
    "ath_date":      { "inr": "2025-01-19T…" },
    "price_change_percentage_24h_in_currency": { "inr": 4.75 },
    "circulating_supply": 592183224,
    "max_supply": null,
    "sparkline_7d": { "price": [ … ] }
  }
}
```

---

## 4. Reading the JSON: destructuring and friends

Destructuring means "take these fields out of an object and put them in variables" in one line.

### Basic object destructuring

```js
const coin = { id: 'bitcoin', name: 'Bitcoin', current_price: 5612669 };

// Without destructuring
const id = coin.id;
const name = coin.name;

// With destructuring, same result
const { id, name } = coin;
```

### Renaming while destructuring

API names use `snake_case`; JavaScript usually uses `camelCase`. Rename with a colon:

```js
const { current_price: price, market_cap: marketCap } = coin;
// price = coin.current_price, marketCap = coin.market_cap
```

This is exactly what `createCoinRow()` in `render.js` does:

```js
const {
  id,
  name,
  symbol,
  image,
  current_price: price,
  market_cap: marketCap,
  market_cap_rank: rank,
  price_change_percentage_7d_in_currency: change7d,
  sparkline_in_7d: sparkline,
} = coin;
```

### Default values

```js
const { max_supply = 'No limit' } = coin.market_data;
// used only when the value is undefined (careful: NOT when it's null)
```

### Nested destructuring

```js
const { market_data: { current_price: { inr } } } = coinDetail;
// inr = coinDetail.market_data.current_price.inr
```

It works, but deep nesting gets hard to read. In `renderCoinDetail()` I used a small helper instead:

```js
const data = coin.market_data;
const inr = (field) => data[field]?.inr;   // inr('current_price'), inr('market_cap')…
```

### Destructuring in function parameters

`renderMessage()` takes one object and destructures it right in the brackets, so a call reads like labelled settings:

```js
function renderMessage(container, { type, icon, title, text, buttonText, onButton }) { … }

renderMessage(coinList, {
  type: 'error',
  title: "Couldn't load prices",
  text: error.message,
  buttonText: 'Try again',
  onButton: loadTopCoins,
});
```

### Array destructuring (for reference)

```js
const [first, second] = data.coins;   // first two search results
```

### Optional chaining `?.` and nullish `??`

APIs don't always send every field. Two operators keep the app from crashing:

```js
coin.sparkline_in_7d?.price          // undefined instead of an error if sparkline_in_7d is missing
coin.market_cap_rank ?? '—'          // use '—' only when the value is null/undefined (0 stays 0)
```

### Turning the response into what the screen needs (array methods)

```js
// search → ids → prices, then put them back in best-match order
const ids = result.coins.slice(0, 10).map((coin) => coin.id);         // map: object → id
const coins = await fetchCoinsByIds(ids);
return ids
  .map((id) => coins.find((coin) => coin.id === id))                  // find: id → full coin
  .filter(Boolean);                                                   // filter: drop missing ones
```

---

## 5. Design decisions (the UI/UX side)

These are the choices made before writing code, and the reasons for them.

| Decision | Why |
|---|---|
| **One page, three screens** (Markets, Coin detail, Watchlist) switched by the URL hash | Feels like an app, the back button works, and you can share `#/coin/bitcoin`. No server routing needed. |
| **Table on desktop, compact list on phone** | Finance data is easiest to scan in columns. On a phone only name, price and % fit, so the 24h change moves under the price. |
| **Green ▲ / red ▼** | The brief requires the colours. The arrows help colour-blind users. |
| **Indian number format** (`₹56,12,669`, `₹11.27 L Cr`) | The audience is Indian; lakh/crore reads naturally. The full value shows on hover. |
| **Skeleton rows while loading** | The page keeps its shape, so nothing jumps when data arrives. It also looks more polished than "Loading…" (a stretch goal). |
| **Red error box + Try again** | The user always knows what went wrong and has one obvious next step. |
| **Friendly empty states** ("No coins match…", "Your watchlist is empty") | A blank area looks broken. A message plus a button tells people what to do next. |
| **Toast with Undo** | Removing by accident is easy; Undo is kinder than an "Are you sure?" popup. |
| **"Updated 2 min ago"** | Prices go stale; this tells you how fresh they are. |
| **Debounced search (400 ms)** | Saves API calls (rate limit) and stops the results flickering while you type. |
| **Keyboard shortcuts** `/` and `Esc` | Small touch that power users like. |
| **Dark mode, remembered** | Common expectation; stretch goal. |
| **Neutral slate + one amber accent** | Calm background so the green and red numbers stand out. |

---

## 6. The HTML skeleton

`index.html` holds the **fixed** parts of the page. Anything that comes from the API is created by JavaScript. The brief says "no hardcoded HTML results".

```
<head>
  tiny inline script → adds class="dark" before paint (no white flash)
  Tailwind CDN + config { darkMode: 'class' }
  style.css
  5 JS files with defer
<body>
  <header>   logo · Markets · Watchlist [badge] · theme button
  <main>
    <section id="home-view">       title · search · filter chips · sort · Refresh
                                   summary + "updated" line
                                   table header row
                                   <div id="coin-list">   ← rows are inserted here
    <section id="detail-view">     Back button
                                   <div id="coin-detail"> ← detail is inserted here
    <section id="watchlist-view">  title · Refresh · header row
                                   <div id="watchlist-list"> ← rows inserted here
  <footer>   CoinGecko credit
  <div id="toast-area">            ← toasts inserted here
```

Each empty `<div id="…">` is a container that JavaScript fills. Only one `<section>` is visible at a time; the others have the `hidden` class.

---

## 7. The CSS

Tailwind handles about 95% of the styling directly in class names. `style.css` holds the few things that are easier in plain CSS:

- **`.coin-grid`**: the responsive table. It's a CSS Grid whose column count changes with screen width:
  - phone: `heart | coin | price` (3 columns; the watchlist adds a 4th for Remove)
  - ≥640px: `heart | # | coin | price | 24h | market cap` (6)
  - ≥1024px: adds `7d` and the mini chart (8)

  The trick: cells hidden with Tailwind's `hidden sm:block` have `display: none`, and **hidden elements don't take a grid column**. So the same row HTML fits every screen size.
- **`.skeleton`** + `@keyframes shimmer`: the moving grey loading bars.
- **`.heart-btn`, `.saved`, `.heart-btn-large`**: the heart, which fills in rose (with a little pop) when saved.
- **`.with-remove .coin-grid`**: the watchlist table gets one extra column for the **Remove** button.
- **`.remove-btn`**: the trash-can Remove button (just the icon on phones, icon + "Remove" on bigger screens).
- **`.is-loading .refresh-icon`**: spins the refresh icon while fetching.
- **`.chip-active`, `.nav-link.active`**: the selected filter and the current page.
- **`prefers-reduced-motion`**: turns animations off for people who've asked their OS to reduce motion.

---

## 8. Every JS file and function explained

### `js/utils.js`: small helpers, no DOM, no API

| Function | What it does | Example |
|---|---|---|
| `formatPrice(value)` | Full ₹ price with Indian commas. Coins under ₹1 get 4 significant digits instead of 2 decimals. | `5612669 → "₹56,12,669.00"`, `0.004213 → "₹0.004213"` |
| `formatBigRupees(value)` | Short form for big numbers using lakh / crore / lakh crore | `112910000000000 → "₹112.91 L Cr"` |
| `formatNumber(value)` | Whole number with Indian commas (supply) | `592183224 → "59,21,83,224"` |
| `formatPercent(value)` | Adds `+` for positives, 2 decimals, `%` | `3.567 → "+3.57%"` |
| `changeColor(value)` | Returns Tailwind classes: green if >0, red if <0, grey if 0 | |
| `changeArrow(value)` | `▲`, `▼` or nothing | |
| `timeAgo(date)` | "just now", "3 min ago", "2 h ago" | |
| `formatDate(iso)` | `"2025-01-19T…" → "19 Jan 2025"` | |
| `debounce(fn, delay)` | Returns a new function that waits until calls stop for `delay` ms, then runs `fn` once | |

**How `debounce` works:**

```js
function debounce(fn, delay) {
  let timer;                         // remembered between calls (closure)
  return function (...args) {
    clearTimeout(timer);             // cancel the previous wait
    timer = setTimeout(() => fn(...args), delay);   // start a new wait
  };
}
```

Typing "s", "o", "l" quickly cancels the first two timers, so only one search runs, 400 ms after the last key.

### `js/storage.js`: LocalStorage only

LocalStorage stores **strings only**, so arrays go through `JSON.stringify` on the way in and `JSON.parse` on the way out.

| Function | What it does |
|---|---|
| `getWatchlist()` | Reads `coinwatch-watchlist`, parses it, and returns an array. If the value is missing or broken JSON, it returns `[]` (the `try/catch` protects against someone editing it by hand). |
| `saveWatchlist(ids)` | Saves the array. If it's empty, it **removes the key** so the Application tab stays clean. |
| `isInWatchlist(id)` | `true`/`false` using `includes` |
| `toggleWatchlist(id)` | Removes the coin if present (with `filter`), otherwise adds it (with spread `[...list, id]`). Returns whether it's now saved. |
| `saveTheme(theme)` | Saves `"dark"` or `"light"`. The `<head>` script reads it on the next load. |

What's in LocalStorage (DevTools → Application → Local Storage):

```
coinwatch-watchlist   ["bitcoin","solana"]
coinwatch-theme       dark
```

### `js/api.js`: every network call

| Function | Endpoint | Returns |
|---|---|---|
| `getJSON(path)` | any | Parsed JSON, or throws an `Error` with a **human-readable** message |
| `fetchTopCoins()` | `/coins/markets?…per_page=20` | array of 20 coins |
| `fetchCoinsByIds(ids)` | `/coins/markets?ids=…` | array of those coins (returns `[]` straight away for an empty list, with no request) |
| `searchCoins(query)` | `/search` then `/coins/markets?ids=` | up to 10 coins **with prices**, best match first |
| `fetchCoinDetail(id)` | `/coins/{id}` | one big coin object |

**How `getJSON` turns failures into readable messages:**

```js
async function getJSON(path) {
  let response;
  try {
    response = await fetch(API_BASE + path);   // throws only if there was NO answer at all
  } catch {
    if (!navigator.onLine) throw new Error("You're offline…");
    throw new Error("Couldn't reach CoinGecko…");
  }
  if (response.status === 429) throw new Error('Too many requests…');
  if (response.status === 404) throw new Error("We couldn't find that coin.");
  if (!response.ok)            throw new Error(`CoinGecko had a problem (error ${response.status})…`);
  return response.json();
}
```

Important detail: `fetch` does **not** throw on 404 or 500. Those still count as "answers", so we check `response.ok` and `response.status` ourselves.

`encodeURIComponent()` is used on anything the user typed, so spaces and symbols can't break the URL.

### `js/render.js`: builds the page with DOM methods

| Function | What it builds |
|---|---|
| `el(tag, className, text)` | Shortcut for `createElement` + class + `textContent`. Using `textContent` (not `innerHTML`) means text from the API can never inject HTML. |
| `get24hChange(coin)` | The 24h % change, which comes under two names depending on the endpoint |
| `createHeartButton(coin)` | The ♡ button with `data-action="heart"`, `data-heart-id`, `data-name` |
| `updateHeartButton(button, saved)` | Fills/unfills the heart, updates `aria-pressed`, tooltip and the text label on the big button |
| `createPriceChart(prices, w, h, withFill)` | An SVG line chart built with `createElementNS`. It finds min/max, turns each price into an `x,y` point, and colours it green or red depending on whether the last price ≥ the first |
| `createChangeCell(value, classes)` | `▲ 3.57%` in green or `▼ 4.84%` in red |
| `createCoinRow(coin, showRemove)` | One full row: heart, rank, logo+name+symbol, price, 24h, 7d, market cap, mini chart, plus a Remove button when `showRemove` is true (uses destructuring, see §4) |
| `renderCoinList(container, coins, showRemove)` | `coins.map(coin => createCoinRow(coin, showRemove))` then `replaceChildren(...)`, which swaps all rows in one go |
| `renderSkeletonRows(container, count)` | Grey placeholder rows with the same grid as real rows |
| `renderMessage(container, {...})` | The empty state (grey, 🔍/⭐) **or** error state (red, ⚠️), with an optional button |
| `renderDetailSkeleton(container)` | Placeholder version of the detail page |
| `createStat(label, value, class, hint)` | One line in the "Market stats" card |
| `getDescriptionParagraphs(html)` | CoinGecko's description contains HTML links. `DOMParser` turns it into **plain text** (safe), then it's split into paragraphs. |
| `renderCoinDetail(container, coin)` | The full detail page: header, price, heart button, 7-day chart, About (with Read more), Market stats, website link |
| `showToast(message, actionText, onAction)` | Bottom message with an optional Undo button; disappears after 4 s |

**How the chart maths works** (`createPriceChart`):

```
x = (i / (number of prices - 1)) * width               → spreads points left to right
y = height - ((price - min) / (max - min)) * height    → lowest price at the bottom, highest at the top
```

The points become `"x,y x,y x,y…"` for an SVG `<polyline>`. With `withFill`, a `<polygon>` closes the shape down to the bottom edge for the light shaded area.

### `js/app.js`: state, events, router

**State variables** (top of the file):

| Variable | Holds |
|---|---|
| `topCoins` | the 20 coins from the last load |
| `searchResults` | `null` when not searching, otherwise the result array |
| `searchQuery` | the current search text |
| `activeFilter` | `'all'`, `'gainers'` or `'losers'` |
| `lastUpdated` | a `Date`, for "Updated 2 min ago" |
| `latestSearchId` | counter that stops old search responses from overwriting newer ones |
| `watchlistCoins` | coins currently shown on the Watchlist screen |
| `currentCoinId` | which coin the detail page should be showing |
| `hasNavigated` | whether the Back button can safely use `history.back()` |

**Functions:**

| Function | Job |
|---|---|
| `setLoading(button, bool)` | Disables the button and spins its icon |
| `updateLastUpdated()` | Writes "Updated …" text |
| `updateWatchlistNav()` | Updates the number badge; hides it at 0 |
| `sorters` (object) | One compare function per sort option, e.g. `price_desc: (a, b) => b.current_price - a.current_price` |
| `getVisibleCoins()` | Takes search results or top coins → `filter` by chip → `sort` a **copy** (`[...filtered]`) |
| `updateSummary()` | "16 up · 3 down in the last 24 hours" (two `filter`s + `.length`) |
| `renderHomeList()` | Sets the title, then draws rows **or** the right empty message |
| `setFilter(filter)` | Highlights the chip, then redraws |
| `loadTopCoins()` | skeleton → `fetchTopCoins()` → draw, or show the error box (`try/catch/finally`) |
| `runSearch(query)` | Same pattern for search, plus the out-of-order protection |
| `clearSearch()` | Back to the top 20 without refetching (refetches only if the first load had failed) |
| `debouncedSearch` | `debounce(...)` around the search logic; needs at least 2 letters |
| `loadWatchlist()` | Reads saved ids → fetches their prices → draws, or shows the empty/error state |
| `renderWatchlist()` | Draws watchlist rows or "Your watchlist is empty" |
| `onHeartClick(id, name)` | Toggles storage, updates every heart for that coin on the page, updates the badge, updates the watchlist screen, shows the toast with Undo. The watchlist's **Remove** button calls this too, since the coin is always saved there. |
| `clearWatchlist()` | **Clear all**: remembers the saved ids, empties storage (`saveWatchlist([])`), shows the empty state, and offers Undo, which saves the old ids back and reloads |
| `handleListClick(event)` | **Event delegation**: one listener per list works out what was clicked |
| `loadCoinDetail(id)` | skeleton → `fetchCoinDetail` → draw, or show the error box; ignores the answer if you've already moved on |
| `showView(view)` | Shows one `<section>`, hides the others |
| `setActiveNav(name)` | Highlights Markets or Watchlist in the header |
| `router()` | Reads `location.hash` and decides which screen to show and what to load |

**Event delegation, the code the trainer will ask about:**

```js
function handleListClick(event) {
  const heartButton = event.target.closest('[data-action="heart"]');
  if (heartButton) {                                 // clicked the heart (or the svg inside it)
    onHeartClick(heartButton.dataset.heartId, heartButton.dataset.name);
    return;
  }
  const removeButton = event.target.closest('[data-action="remove"]');
  if (removeButton) {                                // Remove button on the watchlist screen
    onHeartClick(removeButton.dataset.coinId, removeButton.dataset.name);
    return;
  }
  if (event.target.closest('a')) return;             // the coin name link navigates by itself
  const row = event.target.closest('.coin-row');
  if (row) location.hash = '#/coin/' + row.dataset.id;   // anywhere else on the row opens the coin
}

coinList.addEventListener('click', handleListClick);       // ONE listener for all 20 rows
watchlistList.addEventListener('click', handleListClick);
coinDetail.addEventListener('click', handleListClick);
```

The rows are destroyed and rebuilt on every sort, filter and refresh. A listener on each row would have to be re-added every time. The listener on the **parent** stays put and works for any row, old or new. `closest()` walks up from the exact thing clicked (maybe the `<path>` inside the heart icon) to find the element we care about.

**The router:**

```js
function router() {
  const hash = location.hash || '#/';
  if (hash.startsWith('#/coin/'))  → show detail, loadCoinDetail(id)
  else if (hash === '#/watchlist') → show watchlist, loadWatchlist()
  else                             → show home (fetch only the first time)
}
window.addEventListener('hashchange', router);
```

Clicking a link like `href="#/watchlist"` changes the hash. The browser fires `hashchange`, the router runs, and the page never reloads.

---

## 9. What happens when… (step-by-step flows)

### You open `index.html`

1. The `<head>` script checks LocalStorage/OS for dark mode and adds `class="dark"` straight away.
2. Tailwind CDN loads and styles the page.
3. The five scripts run in order. `app.js` finds the elements, attaches listeners, then calls:
4. `updateWatchlistNav()`: the badge shows the saved count (or hides).
5. `router()`: the hash is empty, so it shows home. `topCoins` is empty, so it calls `loadTopCoins()`.
6. `loadTopCoins()` → `setLoading` (spinner) → `renderSkeletonRows(10)` → `await fetchTopCoins()`.
7. The data arrives: `topCoins = data`, `lastUpdated = now`, `renderHomeList()` → `getVisibleCoins()` (filter + sort) → `renderCoinList()` → 20 × `createCoinRow()`.
8. `finally` stops the spinner. Every 30 s, `setInterval` updates "Updated … ago".

### You type "sol" in search

1. Each key fires `input` → `debouncedSearch()`. The timer restarts on each key.
2. 400 ms after the last key: `query = "sol"` (2+ letters) → `runSearch("sol")`.
3. `searchId = ++latestSearchId` (say, 3). The title becomes `Searching for "sol"…` and 5 skeleton rows appear.
4. `searchCoins("sol")`:
   - `GET /search?query=sol` → `result.coins` → first 10 → `.map(c => c.id)`
   - `GET /coins/markets?ids=solana,solstice,…` → prices
   - `.map(id => coins.find(...))` puts them back in best-match order; `.filter(Boolean)` drops coins with no market data.
5. Back in `runSearch`: is `searchId` still 3? If you typed more in the meantime, it's now 4 → **return and draw nothing** (the newer search will draw).
6. `searchResults = results` → `renderHomeList()` → `Results for "sol"`, 10 rows (the sort and filter still apply).
7. Nothing found → `No coins match "sol"` + Clear search. Network failed → red error box + Try again.
8. Press `Esc` or empty the box → `clearSearch()` → back to the top 20 instantly (no new request).

### You click ♡ on Bitcoin

1. The click lands on the `<path>` inside the heart's SVG and **bubbles up** to `#coin-list`.
2. `handleListClick` → `closest('[data-action="heart"]')` finds the button → `onHeartClick("bitcoin", "Bitcoin")`.
3. `toggleWatchlist("bitcoin")` → `getWatchlist()` → `["bitcoin"]` → `JSON.stringify` → LocalStorage.
4. `updateWatchlistNav()` → the badge shows **1**.
5. `querySelectorAll('[data-heart-id="bitcoin"]')` → every Bitcoin heart on the page fills in rose.
6. The toast says "Bitcoin added to your watchlist · Undo". Undo simply calls `onHeartClick` again, which toggles it back.

### You open the Watchlist

1. The link sets the hash to `#/watchlist` → `router()` → `showView(watchlistView)` → `loadWatchlist()`.
2. No saved ids → `renderWatchlist()` → "Your watchlist is empty" + Browse coins.
3. Ids saved → skeleton → `fetchCoinsByIds(["bitcoin","solana"])` → rows.
4. Click **Remove** (or the heart) on a coin here → it's removed from storage **and** from `watchlistCoins` (`filter`), the list redraws, and if it was the last one the empty state shows.
5. Click **Clear all** → `clearWatchlist()` empties everything at once → the toast says "Removed 3 coins… · Undo". Undo puts all of them back.

### You click a coin

1. The row click → `location.hash = '#/coin/solana'` → `router()` → `currentCoinId = 'solana'` → `loadCoinDetail('solana')`.
2. Detail skeleton → `fetchCoinDetail` → `renderCoinDetail` (with a check that `currentCoinId` is still `'solana'`).
3. Back: if you came from inside the app, `history.back()` returns to the exact list you were on; otherwise it goes home.

### You press Refresh

- Searching? → `runSearch(searchQuery)` again. Otherwise → `loadTopCoins()`. Either way it's a real new fetch with no page reload, and "Updated just now" resets.

### Your internet is off

1. `fetch` throws → `getJSON` sees `navigator.onLine === false` → `throw new Error("You're offline…")`.
2. `loadTopCoins`'s `catch` → `renderMessage({ type: 'error', … })` → red box with the message and **Try again**.
3. Turn the internet back on → Try again → data loads.

---

## 10. Rebuilding it yourself, in order

If you want to type it out yourself (the best way to own it for Q&A), go in this order. Each step is a sensible commit; your git and Vercel steps are up to you.

| # | Build | Check it works by… |
|---|---|---|
| 1 | `index.html` shell: header, three empty sections, Tailwind CDN | page opens, header looks right |
| 2 | `utils.js`: the formatters + debounce | console: `formatPrice(5612669)` |
| 3 | `api.js`: `getJSON` + `fetchTopCoins` | console: `await fetchTopCoins()` |
| 4 | `render.js`: `el`, `createCoinRow`, `renderCoinList` | 20 rows appear |
| 5 | Skeleton, error and empty states (`renderSkeletonRows`, `renderMessage`) | turn Wi-Fi off and reload |
| 6 | Sort dropdown + filter chips (`sorters`, `getVisibleCoins`, `setFilter`) | change each option |
| 7 | Refresh button + "Updated … ago" | click it with DevTools → Network open |
| 8 | Search: `searchCoins`, `debounce`, `runSearch`, out-of-order guard, `clearSearch` | type fast and watch Network: only one request |
| 9 | `storage.js` + heart button + event delegation + toast | heart a coin, check the Application tab, reload |
| 10 | Watchlist screen + router | `#/watchlist` shows your coins |
| 11 | Detail page + chart + description | click any coin |
| 12 | Dark mode, mobile pass, README | phone size in DevTools (Ctrl+Shift+M) |

---

## 11. Testing checklist + presentation demo

**Before submitting:**

- [ ] Open `index.html` by double-clicking: 20 coins load
- [ ] Search "eth", "doge" and a nonsense word (empty state)
- [ ] Each sort option and each filter chip
- [ ] Heart 2–3 coins → badge count → Watchlist screen → reload the page → still there
- [ ] Remove one → it disappears from the list **and** from the Application tab → Undo brings it back
- [ ] Open a coin → Read more → Back
- [ ] DevTools → Network → **Offline** → Refresh → red error box → Online → Try again
- [ ] DevTools phone view (Ctrl+Shift+M) at 375px wide
- [ ] Dark mode toggle → reload → still dark
- [ ] Console has no red errors

**7-minute demo order (from the brief):**

1. **30 s:** "CoinWatch ₹, Option A Market Tracker, live crypto prices in rupees from CoinGecko."
2. **3 min:** search → filter Gainers → sort by price → heart two coins → Refresh → open the Watchlist → click Remove on one (show Undo) → Clear all → Undo → open a coin.
3. **1.5 min:** DevTools → Network → Offline → Refresh → error box → Online → Try again.
4. **1.5 min:** open `app.js`, explain `handleListClick` (delegation) or `runSearch` (debounce + out-of-order guard).
5. **30 s:** hardest bug (see below).

**A "hardest bug" topic you can talk about:** with plain async search, fast typing can show **old results**. If the request for "bi" happens to answer after the one for "bitcoin", it overwrites the correct results. The code prevents this with a request counter (`latestSearchId`): each search remembers its number and only draws if it's still the newest. To see the problem for real, remove the `if (searchId !== latestSearchId) return;` line, set DevTools → Network to "Slow 4G" and type quickly. Pick whichever bug you actually ran into while building, though, because the trainer will ask follow-up questions.

---

## 12. Likely Q&A questions and answers

**"What happens if two async calls resolve out of order?"**
Without protection, the slower old response would overwrite the newer one. In `runSearch`, every call takes `searchId = ++latestSearchId`. After `await`, it checks `if (searchId !== latestSearchId) return;`, so only the latest search draws. The detail page does the same with `currentCoinId`.

**"Why async/await instead of `.then()`?"**
It reads top to bottom like normal code, and one `try/catch/finally` handles errors and cleanup (like stopping the spinner). `.then().catch()` chains get nested and harder to follow when there are two requests in a row, as in `searchCoins`.

**"Show me event delegation and why you used it."**
`handleListClick` in `app.js`: one listener on `#coin-list` instead of 40+ (a heart and a row for each coin). The rows are rebuilt on every sort, filter and refresh, and the parent listener keeps working for new rows without re-attaching anything. `event.target.closest()` finds which heart, Remove button or row was clicked.

**"What's in LocalStorage right now?"**
DevTools → Application → Local Storage → `coinwatch-watchlist` (a JSON array of coin ids) and `coinwatch-theme`. Only ids are saved, not prices, because prices go stale; they're fetched fresh when you open the watchlist.

**"Why do you check `response.ok`? Doesn't try/catch catch errors?"**
`fetch` only throws when there's no response at all (offline, DNS failure). A 404 or 429 is still a response, so it has to be checked manually.

**"Why `textContent` and not `innerHTML`?"**
API text could contain HTML. `textContent` always shows it as plain text, so nothing can be injected. The only `innerHTML` used is for our own fixed heart and trash SVG icons.

**"Why sort a copy (`[...filtered].sort()`)?"**
`sort()` changes the original array. Sorting a copy keeps `topCoins` in its original market-cap order, so switching sort options back and forth always starts from clean data.

**"Why debounce the search?"**
Without it, typing "bitcoin" sends 7 requests and could hit the 30-per-minute limit. With it, one request goes out 400 ms after you stop typing.
