/* ============================================================
   MERIDIAN V2 · shared.js — icon system, device chrome, QR
   ============================================================ */

const ICONS = {
  home: '<path d="M4 10.5 12 3l8 7.5"/><path d="M6.5 9.5V20h11V9.5"/>',
  card: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  bell: '<path d="M6 9.5a6 6 0 0 1 12 0c0 4.5 1.5 5.5 1.5 5.5h-15S6 14 6 9.5"/><path d="M10.3 18.5a2 2 0 0 0 3.4 0"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20c1.2-3.5 4-5 7.5-5s6.3 1.5 7.5 5"/>',
  qr: '<rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.5"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1.5"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.5"/><path d="M14 14h3v3h-3z" fill="currentColor" stroke="none"/><path d="M20 14v6.5h-6.5"/>',
  scan: '<path d="M3.5 8V5.5a2 2 0 0 1 2-2H8"/><path d="M16 3.5h2.5a2 2 0 0 1 2 2V8"/><path d="M20.5 16v2.5a2 2 0 0 1-2 2H16"/><path d="M8 20.5H5.5a2 2 0 0 1-2-2V16"/><path d="M7 12h10"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  checkc: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.5l2.5 2.5 5-5"/>',
  warn: '<path d="M12 4 2.8 19.5h18.4L12 4z"/><path d="M12 10v4"/><circle cx="12" cy="16.8" r=".4" fill="currentColor"/>',
  alertc: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V13"/><circle cx="12" cy="16.2" r=".4" fill="currentColor"/>',
  xc: '<circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6M15 9l-6 6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="M14.5 5 8 11.5l6.5 6.5"/>',
  chev: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
  chevd: '<path d="M6 9.5l6 6 6-6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 20 20"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M15.5 4.5 19.5 8.5 8.5 19.5H4.5v-4L15.5 4.5z"/>',
  cal: '<rect x="4" y="5.5" width="16" height="15" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M3 19.5c1-3 3.2-4.5 6-4.5s5 1.5 6 4.5"/><path d="M15.5 5.4a3.5 3.5 0 0 1 0 6.2"/><path d="M17.5 15.3c2 .7 3.2 2 3.7 4.2"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  send: '<path d="M20 4 10.5 13.5"/><path d="M20 4l-5.5 16-4-6.5L4 9.5 20 4z"/>',
  pause: '<rect x="7" y="5" width="3.5" height="14" rx="1.2"/><rect x="13.5" y="5" width="3.5" height="14" rx="1.2"/>',
  receipt: '<path d="M5.5 3.5h13V21l-2.5-1.6-2.5 1.6L11 19.4 8.5 21 6 19.4 5.5 21z"/><path d="M9 8.5h6M9 12h6"/>',
  phoneic: '<path d="M7 3.5h3l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 5 5.7 2 2 0 0 1 7 3.5z"/>',
  wifi: '<path d="M3.5 9.5a13 13 0 0 1 17 0"/><path d="M6.5 13a8.5 8.5 0 0 1 11 0"/><path d="M9.5 16.3a4 4 0 0 1 5 0"/><circle cx="12" cy="19.3" r="1" fill="currentColor" stroke="none"/>',
  wifioff: '<path d="M3.5 9.5a13 13 0 0 1 6-3.4"/><path d="M20.5 9.5a13 13 0 0 0-5-2.9"/><path d="M6.5 13a8.5 8.5 0 0 1 3-1.8"/><path d="M17.5 13a8.5 8.5 0 0 0-1.6-1"/><circle cx="12" cy="19.3" r="1" fill="currentColor" stroke="none"/><path d="M4 4l16 16"/>',
  copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>',
  key: '<circle cx="8" cy="14" r="4.5"/><path d="M11.5 10.5 20 2M15.5 6.5l2.5 2.5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  logout: '<path d="M14 3.5H6.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2H14"/><path d="M10 12h10.5"/><path d="M17 8.5l3.5 3.5-3.5 3.5"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18.5 15l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z"/>',
  shield: '<path d="M12 2.5 19.5 5.5v6c0 5-3.2 8.4-7.5 10-4.3-1.6-7.5-5-7.5-10v-6L12 2.5z"/><path d="M9 11.5l2.2 2.2 4-4"/>',
  megaphone: '<path d="M3.5 10.5v3a1.5 1.5 0 0 0 1.5 1.5H8l9 4.5v-15L8 9H5a1.5 1.5 0 0 0-1.5 1.5z"/><path d="M8 15.5V19a1.5 1.5 0 0 0 1.5 1.5H10"/>',
  listic: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="5" cy="6" r=".6" fill="currentColor"/><circle cx="5" cy="12" r=".6" fill="currentColor"/><circle cx="5" cy="18" r=".6" fill="currentColor"/>',
  activity: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
  filter: '<path d="M4 5.5h16l-6.5 7.5v5L10.5 20v-7L4 5.5z"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4v4.5H15"/>',
  download: '<path d="M12 3.5v12"/><path d="M7 11.5l5 5 5-5"/><path d="M4.5 20.5h15"/>',
  map: '<path d="M9 4 3.5 6.5v13L9 17l6 2.5 5.5-2.5v-13L15 6.5 9 4z"/><path d="M9 4v13M15 6.5v13"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5a13.5 13.5 0 0 1 0 17 13.5 13.5 0 0 1 0-17z"/>',
};

function iconSVG(name, size = 20, cls = '') {
  const d = ICONS[name] || '';
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}

/* Meridian mark — horizon arc */
function logoSVG(size = 28, cls = '') {
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" aria-label="Meridian" role="img"><circle cx="24" cy="24" r="19" stroke="currentColor" stroke-width="3"/><path d="M5 24 H43" stroke="currentColor" stroke-width="3"/><circle cx="35.4" cy="24" r="5.6" fill="currentColor"/></svg>`;
}

/* Status bar — iOS chrome */
function statusbarSVG() {
  return `<div class="sb-r"><svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor" aria-hidden="true"><rect x="0" y="7" width="3" height="5" rx="1"/><rect x="5" y="5" width="3" height="7" rx="1"/><rect x="10" y="2.5" width="3" height="9.5" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg><svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M1.5 4.5a10 10 0 0 1 13 0"/><path d="M4 7.5a6.5 6.5 0 0 1 8 0"/><circle cx="8" cy="10.4" r="1.1" fill="currentColor" stroke="none"/></svg><svg width="25" height="12" viewBox="0 0 25 12" fill="none" aria-hidden="true"><rect x=".8" y=".8" width="19.4" height="10.4" rx="3" stroke="currentColor" opacity=".4"/><rect x="2.6" y="2.6" width="13" height="6.8" rx="1.6" fill="currentColor"/><path d="M22.4 4v4a2.1 2.1 0 0 0 0-4z" fill="currentColor" opacity=".4"/></svg></div>`;
}

function stampStatusbar(el) {
  if (el.querySelector('.statusbar')) return;
  const time = el.dataset.time || '9:41';
  const sb = document.createElement('div');
  sb.className = 'statusbar';
  sb.innerHTML = `<span>${time}</span>${statusbarSVG()}`;
  el.querySelector('.screen, .tscreen')?.prepend(sb);
}

function stampHomeIndicator(el) {
  if (el.classList.contains('phone') && !el.querySelector('.home-ind')) {
    const hi = document.createElement('div');
    hi.className = 'home-ind';
    el.appendChild(hi);
  }
}

/* QR — real scannable codes via vendored qrcode-generator */
function qrSVG(text, size, dark = '#10131A', light = '#FFFFFF') {
  try {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    const cell = size / (n + 8);
    const off = cell * 4;
    let paths = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) paths += `M${(c * cell + off).toFixed(2)} ${(r * cell + off).toFixed(2)}h${cell.toFixed(2)}v${cell.toFixed(2)}h-${cell.toFixed(2)}z`;
    }
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="QR code"><rect width="${size}" height="${size}" fill="${light}"/><path d="${paths}" fill="${dark}"/></svg>`;
  } catch (e) {
    return fallbackQR(text, size, dark, light);
  }
}

/* Deterministic fallback pattern (never shown in practice) */
function fallbackQR(text, size, dark, light) {
  let seed = 0;
  for (const ch of text) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rand = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
  const n = 25, cell = size / n;
  let paths = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (rand() > 0.52) paths += `M${(c * cell).toFixed(2)} ${(r * cell).toFixed(2)}h${cell.toFixed(2)}v${cell.toFixed(2)}h-${cell.toFixed(2)}z`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${light}"/><path d="${paths}" fill="${dark}"/></svg>`;
}

function stampQR(el) {
  const text = el.dataset.qr;
  const size = parseInt(el.dataset.size || '164', 10);
  el.innerHTML = qrSVG(text, size);
}

function stampAll(root = document) {
  root.querySelectorAll('i[data-ic]').forEach(el => {
    el.outerHTML = iconSVG(el.dataset.ic, el.dataset.size || 20, el.dataset.cls || '');
  });
  root.querySelectorAll('.logo[data-logo]').forEach(el => {
    el.outerHTML = logoSVG(parseInt(el.dataset.logo, 10) || 28);
  });
  root.querySelectorAll('.qr[data-qr]').forEach(stampQR);
  root.querySelectorAll('.phone, .tablet').forEach(el => {
    stampStatusbar(el);
    stampHomeIndicator(el);
  });
}

document.addEventListener('DOMContentLoaded', () => stampAll());
