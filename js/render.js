// Functions that build pieces of the page with DOM methods.
// They only draw things. Fetching and state live in app.js.

// Shortcut for document.createElement with a class and optional text
function el(tag, className = '', text = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

const HEART_ICON =
  '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">' +
  '<path d="M12 20.5s-7.6-4.6-9.6-9.2C1.1 8.1 3.3 4.5 6.9 4.5c2.1 0 3.7 1.2 5.1 3 1.4-1.8 3-3 5.1-3 3.6 0 5.8 3.6 4.5 6.8-2 4.6-9.6 9.2-9.6 9.2z"/></svg>';

const TRASH_ICON =
  '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';

// 24h change can come under two names depending on the endpoint
function get24hChange(coin) {
  return coin.price_change_percentage_24h_in_currency ?? coin.price_change_percentage_24h;
}

// ---------- Heart (watchlist) button ----------

function createHeartButton(coin) {
  const button = el('button', 'heart-btn');
  button.type = 'button';
  button.innerHTML = HEART_ICON;
  button.dataset.action = 'heart';
  button.dataset.heartId = coin.id;
  button.dataset.name = coin.name;
  updateHeartButton(button, isInWatchlist(coin.id));
  return button;
}

function updateHeartButton(button, saved) {
  const name = button.dataset.name;
  button.classList.toggle('saved', saved);
  button.setAttribute('aria-pressed', saved);
  button.title = saved ? `Remove ${name} from watchlist` : `Add ${name} to watchlist`;
  button.setAttribute('aria-label', button.title);

  // The big button on the detail page also has a text label
  const label = button.querySelector('[data-label]');
  if (label) label.textContent = saved ? 'In your watchlist' : 'Add to watchlist';
}

// ---------- Price chart (plain SVG) ----------

function createPriceChart(prices, width, height, withFill) {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'h-full w-full overflow-visible');
  svg.setAttribute('aria-hidden', 'true');

  if (!prices || prices.length < 2) return svg;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const isUp = prices[prices.length - 1] >= prices[0];
  const color = isUp ? '#10b981' : '#f43f5e';

  // Leave 2px at the top and bottom so the line isn't cut off
  const points = prices.map((price, i) => {
    const x = (i / (prices.length - 1)) * width;
    const y = height - 2 - ((price - min) / range) * (height - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  if (withFill) {
    const area = document.createElementNS(SVG_NS, 'polygon');
    area.setAttribute('points', `0,${height} ${points.join(' ')} ${width},${height}`);
    area.setAttribute('fill', color);
    area.setAttribute('fill-opacity', '0.08');
    svg.append(area);
  }

  const line = document.createElementNS(SVG_NS, 'polyline');
  line.setAttribute('points', points.join(' '));
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', withFill ? '2' : '1.5');
  line.setAttribute('stroke-linejoin', 'round');
  line.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.append(line);

  return svg;
}

// ---------- Coin table ----------

function createChangeCell(value, extraClasses) {
  const cell = el('span', `num text-right text-sm font-medium ${changeColor(value)} ${extraClasses}`);
  cell.textContent = value === null || value === undefined
    ? '—'
    : `${changeArrow(value)} ${formatPercent(Math.abs(value)).replace('+', '')}`;
  return cell;
}

// showRemove adds a "Remove" button at the end of the row (used on the watchlist screen)
function createCoinRow(coin, showRemove = false) {
  // Pull out just the fields this row needs from the API object
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
  const change24h = get24hChange(coin);

  const row = el('div', 'coin-grid coin-row border-b border-slate-100 px-3 py-3 last:border-0 sm:px-4 dark:border-slate-800');
  row.dataset.id = id;

  const rankCell = el('span', 'num hidden text-sm text-slate-400 sm:block', rank ?? '—');

  // Name + symbol
  const coinCell = el('div', 'flex min-w-0 items-center gap-3');
  const logo = el('img', 'h-7 w-7 shrink-0 rounded-full');
  logo.src = image;
  logo.alt = '';
  logo.loading = 'lazy';
  const names = el('div', 'min-w-0');
  const link = el('a', 'block truncate font-semibold hover:text-amber-600 dark:hover:text-amber-400', name);
  link.href = '/coin/' + id;
  names.append(link, el('span', 'text-xs uppercase text-slate-500 dark:text-slate-400', symbol));
  coinCell.append(logo, names);

  // On phones the 24h change sits under the price, since there's no room for its own column
  const priceCell = el('div', 'text-right');
  priceCell.append(
    el('div', 'num text-sm font-semibold', formatPrice(price)),
    createChangeCell(change24h, 'block text-xs sm:hidden')
  );

  const marketCapCell = el('span', 'num hidden text-right text-sm text-slate-600 sm:block dark:text-slate-300', formatBigRupees(marketCap));
  marketCapCell.title = formatPrice(marketCap);

  const chartCell = el('div', 'hidden h-9 lg:block');
  chartCell.append(createPriceChart(sparkline?.price, 120, 36, false));

  row.append(
    createHeartButton(coin),
    rankCell,
    coinCell,
    priceCell,
    createChangeCell(change24h, 'hidden sm:block'),
    createChangeCell(change7d, 'hidden lg:block'),
    marketCapCell,
    chartCell
  );

  if (showRemove) {
    const removeButton = el('button', 'remove-btn');
    removeButton.type = 'button';
    removeButton.innerHTML = TRASH_ICON + '<span class="hidden sm:inline">Remove</span>';
    removeButton.dataset.action = 'remove';
    removeButton.dataset.coinId = id;
    removeButton.dataset.name = name;
    removeButton.title = `Remove ${name} from watchlist`;
    removeButton.setAttribute('aria-label', removeButton.title);
    row.append(removeButton);
  }

  return row;
}

function renderCoinList(container, coins, showRemove = false) {
  container.replaceChildren(...coins.map((coin) => createCoinRow(coin, showRemove)));
  container.removeAttribute('aria-busy');
}

function renderSkeletonRows(container, count) {
  const rows = [];

  for (let i = 0; i < count; i++) {
    const row = el('div', 'coin-grid border-b border-slate-100 px-3 py-3.5 last:border-0 sm:px-4 dark:border-slate-800');
    const coinCell = el('div', 'flex items-center gap-3');
    coinCell.append(el('div', 'skeleton h-7 w-7 shrink-0 rounded-full'), el('div', 'skeleton h-4 w-24'));

    row.append(
      el('div', 'skeleton h-5 w-5 rounded-full'),
      el('div', 'skeleton hidden h-4 w-5 sm:block'),
      coinCell,
      el('div', 'skeleton ml-auto h-4 w-20'),
      el('div', 'skeleton ml-auto hidden h-4 w-14 sm:block'),
      el('div', 'skeleton ml-auto hidden h-4 w-14 lg:block'),
      el('div', 'skeleton ml-auto hidden h-4 w-24 sm:block'),
      el('div', 'skeleton hidden h-8 w-full lg:block')
    );
    rows.push(row);
  }

  container.replaceChildren(...rows);
  container.setAttribute('aria-busy', 'true');
}

// ---------- Empty + error messages ----------

// type is 'empty' or 'error'
function renderMessage(container, { type, icon, title, text, buttonText, onButton }) {
  const isError = type === 'error';

  const box = el('div', isError
    ? 'm-3 flex flex-col items-center rounded-lg border border-rose-200 bg-rose-50 px-6 py-10 text-center dark:border-rose-900/60 dark:bg-rose-950/40'
    : 'flex flex-col items-center px-6 py-14 text-center');
  box.setAttribute('role', isError ? 'alert' : 'status');

  const iconCircle = el('div', isError
    ? 'mb-3 grid h-12 w-12 place-items-center rounded-full bg-rose-100 text-2xl dark:bg-rose-900/50'
    : 'mb-3 grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-2xl dark:bg-slate-800',
    icon || (isError ? '⚠️' : '🔍'));

  box.append(
    iconCircle,
    el('h2', isError ? 'font-semibold text-rose-700 dark:text-rose-300' : 'font-semibold', title),
    el('p', isError
      ? 'mt-1 max-w-md text-sm text-rose-600 dark:text-rose-300/80'
      : 'mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400', text)
  );

  if (buttonText) {
    const button = el('button', isError
      ? 'mt-5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 active:scale-95'
      : 'mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 active:scale-95 dark:bg-amber-500 dark:text-slate-900 dark:hover:bg-amber-400',
      buttonText);
    button.type = 'button';
    button.addEventListener('click', onButton);
    box.append(button);
  }

  container.replaceChildren(box);
  container.removeAttribute('aria-busy');
}

// ---------- Coin detail ----------

function renderDetailSkeleton(container) {
  const wrap = el('div', 'grid gap-6 lg:grid-cols-3');
  const main = el('div', 'space-y-6 lg:col-span-2');
  const top = el('div', 'rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900');
  const heading = el('div', 'flex items-center gap-4');
  heading.append(el('div', 'skeleton h-14 w-14 rounded-full'), el('div', 'skeleton h-7 w-40'));
  top.append(heading, el('div', 'skeleton mt-6 h-10 w-56'), el('div', 'skeleton mt-6 h-48 w-full'));

  const about = el('div', 'space-y-2 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900');
  about.append(el('div', 'skeleton mb-4 h-5 w-32'), el('div', 'skeleton h-4 w-full'), el('div', 'skeleton h-4 w-full'), el('div', 'skeleton h-4 w-2/3'));
  main.append(top, about);

  const side = el('div', 'space-y-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900');
  for (let i = 0; i < 8; i++) side.append(el('div', 'skeleton h-5 w-full'));

  wrap.append(main, side);
  container.replaceChildren(wrap);
  container.setAttribute('aria-busy', 'true');
}

// One label/value line in the stats card
function createStat(label, value, valueClass = '', hint = '') {
  const row = el('div', 'flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-0 dark:border-slate-800');
  const right = el('div', 'text-right');
  right.append(el('div', `num text-sm font-semibold ${valueClass}`, value));
  if (hint) right.append(el('div', 'text-xs text-slate-500 dark:text-slate-400', hint));
  row.append(el('span', 'text-sm text-slate-500 dark:text-slate-400', label), right);
  return row;
}

// CoinGecko sends the description as HTML with links in it.
// We only want the plain text, split into paragraphs.
function getDescriptionParagraphs(html) {
  if (!html) return [];
  const text = new DOMParser().parseFromString(html, 'text/html').body.textContent;
  return text
    .split(/\r?\n\s*\r?\n|\r\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

function renderCoinDetail(container, coin) {
  const data = coin.market_data;
  const inr = (field) => data[field]?.inr;
  const change24h = data.price_change_percentage_24h_in_currency?.inr;

  const wrap = el('div', 'grid gap-6 lg:grid-cols-3');
  const main = el('div', 'space-y-6 lg:col-span-2');

  // --- Top card: name, price, heart, chart ---
  const top = el('div', 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900');

  const header = el('div', 'flex flex-wrap items-start justify-between gap-4');
  const identity = el('div', 'flex items-center gap-4');
  const logo = el('img', 'h-14 w-14 rounded-full');
  logo.src = coin.image.large;
  logo.alt = `${coin.name} logo`;
  const nameBlock = el('div');
  const title = el('h1', 'text-2xl font-bold tracking-tight sm:text-3xl', coin.name);
  const badges = el('div', 'mt-1 flex items-center gap-2');
  badges.append(el('span', 'rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300', coin.symbol));
  if (coin.market_cap_rank) {
    badges.append(el('span', 'rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300', `Rank #${coin.market_cap_rank}`));
  }
  nameBlock.append(title, badges);
  identity.append(logo, nameBlock);

  const heartButton = el('button', 'heart-btn heart-btn-large');
  heartButton.type = 'button';
  heartButton.dataset.action = 'heart';
  heartButton.dataset.heartId = coin.id;
  heartButton.dataset.name = coin.name;
  heartButton.innerHTML = HEART_ICON + '<span data-label></span>';
  updateHeartButton(heartButton, isInWatchlist(coin.id));

  header.append(identity, heartButton);

  const priceLine = el('div', 'mt-6 flex flex-wrap items-baseline gap-3');
  priceLine.append(
    el('span', 'num text-3xl font-bold sm:text-4xl', formatPrice(inr('current_price'))),
    el('span', `num rounded-md px-2 py-1 text-sm font-semibold ${changeColor(change24h)} ${change24h >= 0 ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-rose-50 dark:bg-rose-500/10'}`,
      `${changeArrow(change24h)} ${formatPercent(change24h)} today`)
  );

  // 7-day chart with the low and high written underneath
  const prices = data.sparkline_7d?.price || [];
  const chartBox = el('div', 'mt-6');
  const chartHead = el('div', 'mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400');
  chartHead.append(el('span', 'font-medium', 'Price trend · last 7 days'));
  const change7d = data.price_change_percentage_7d_in_currency?.inr;
  chartHead.append(el('span', `num font-semibold ${changeColor(change7d)}`, formatPercent(change7d)));
  const chart = el('div', 'h-44 sm:h-56');
  chart.append(createPriceChart(prices, 600, 200, true));
  chartBox.append(chartHead, chart);

  top.append(header, priceLine, chartBox);

  // --- About card ---
  const about = el('div', 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900');
  about.append(el('h2', 'mb-3 text-lg font-semibold', `About ${coin.name}`));

  const paragraphs = getDescriptionParagraphs(coin.description?.en);
  const description = el('div', 'description text-sm leading-relaxed text-slate-600 dark:text-slate-300');

  if (paragraphs.length === 0) {
    description.append(el('p', 'italic text-slate-500', "CoinGecko doesn't have a description for this coin yet."));
  } else {
    paragraphs.forEach((text, i) => {
      const p = el('p', i >= 2 ? 'hidden extra-paragraph' : '', text);
      description.append(p);
    });
  }
  about.append(description);

  if (paragraphs.length > 2) {
    const readMore = el('button', 'mt-3 text-sm font-semibold text-amber-600 hover:underline dark:text-amber-400', 'Read more');
    readMore.type = 'button';
    readMore.addEventListener('click', () => {
      const extras = description.querySelectorAll('.extra-paragraph');
      const isHidden = extras[0].classList.contains('hidden');
      extras.forEach((p) => p.classList.toggle('hidden', !isHidden));
      readMore.textContent = isHidden ? 'Show less' : 'Read more';
    });
    about.append(readMore);
  }

  const homepage = coin.links?.homepage?.find((url) => url);
  if (homepage) {
    const site = el('a', 'mt-4 inline-flex items-center gap-1 text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 hover:decoration-amber-500 dark:text-slate-200', 'Official website ↗');
    site.href = homepage;
    site.target = '_blank';
    site.rel = 'noopener noreferrer';
    about.append(el('br'), site);
  }

  main.append(top, about);

  // --- Stats card ---
  const stats = el('div', 'h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900');
  stats.append(el('h2', 'mb-1 text-lg font-semibold', 'Market stats'));

  const athChange = data.ath_change_percentage?.inr;
  const change30d = data.price_change_percentage_30d_in_currency?.inr;
  const change1y = data.price_change_percentage_1y_in_currency?.inr;
  const symbol = coin.symbol.toUpperCase();

  stats.append(
    createStat('Market cap', formatBigRupees(inr('market_cap')), '', formatPrice(inr('market_cap'))),
    createStat('24h trading volume', formatBigRupees(inr('total_volume'))),
    createStat('24h high', formatPrice(inr('high_24h'))),
    createStat('24h low', formatPrice(inr('low_24h'))),
    createStat('All-time high', formatPrice(inr('ath')), '',
      athChange !== undefined ? `${formatPercent(athChange)} from ATH · ${formatDate(data.ath_date?.inr)}` : ''),
    createStat('30 days', formatPercent(change30d), changeColor(change30d)),
    createStat('1 year', formatPercent(change1y), changeColor(change1y)),
    createStat('Circulating supply', `${formatNumber(data.circulating_supply)} ${symbol}`),
    createStat('Max supply', data.max_supply ? `${formatNumber(data.max_supply)} ${symbol}` : 'No limit')
  );

  wrap.append(main, stats);
  container.replaceChildren(wrap);
  container.removeAttribute('aria-busy');
}

// ---------- Toast ----------

function showToast(message, actionText, onAction) {
  const area = document.getElementById('toast-area');
  const toast = el('div', 'toast pointer-events-auto flex items-center gap-4 rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg dark:bg-slate-100 dark:text-slate-900');
  toast.append(el('span', '', message));

  if (actionText) {
    const action = el('button', 'font-semibold text-amber-400 hover:underline dark:text-amber-600', actionText);
    action.type = 'button';
    action.addEventListener('click', () => {
      toast.remove();
      onAction();
    });
    toast.append(action);
  }

  // Only one toast at a time, otherwise fast clicking stacks them up
  area.replaceChildren(toast);
  setTimeout(() => toast.remove(), 4000);
}
