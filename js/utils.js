// Small helpers used all over the app: number formatting, debounce, time-ago.

const rupeeFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

// Full price, e.g. ₹56,04,012.50
// Tiny coins (less than ₹1) need more decimals or they'd all show as ₹0.00
function formatPrice(value) {
  if (value === null || value === undefined) return '—';

  if (value < 1) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumSignificantDigits: 4,
    }).format(value);
  }

  return rupeeFormatter.format(value);
}

// Short version for big numbers, the Indian way:
// 1 lakh = 1,00,000   1 crore = 1,00,00,000   1 lakh crore = 1,00,000 crore
function formatBigRupees(value) {
  if (value === null || value === undefined) return '—';

  const LAKH = 1e5;
  const CRORE = 1e7;
  const LAKH_CRORE = 1e12;

  if (value >= LAKH_CRORE) return '₹' + (value / LAKH_CRORE).toFixed(2) + ' L Cr';
  if (value >= CRORE) return '₹' + Math.round(value / CRORE).toLocaleString('en-IN') + ' Cr';
  if (value >= LAKH) return '₹' + (value / LAKH).toFixed(2) + ' L';
  return formatPrice(value);
}

// Plain number with Indian commas, used for coin supply
function formatNumber(value) {
  if (value === null || value === undefined) return '—';
  return Math.round(value).toLocaleString('en-IN');
}

// +2.35% / -0.80%
function formatPercent(value) {
  if (value === null || value === undefined) return '—';
  const sign = value > 0 ? '+' : '';
  return sign + value.toFixed(2) + '%';
}

// Tailwind classes for the green / red colour logic
function changeColor(value) {
  if (value > 0) return 'text-emerald-600 dark:text-emerald-400';
  if (value < 0) return 'text-rose-600 dark:text-rose-400';
  return 'text-slate-500 dark:text-slate-400';
}

function changeArrow(value) {
  if (value > 0) return '▲';
  if (value < 0) return '▼';
  return '';
}

// "just now", "3 min ago", "2 h ago"
function timeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes + ' min ago';
  return Math.round(minutes / 60) + ' h ago';
}

function formatDate(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Waits until the user stops calling fn for `delay` ms, then runs it once.
// Used on the search box so we don't hit the API on every keystroke.
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
