import {
  exact, compact, niceTicks, scaleLinear, scaleLog, logTicks, labelStep, squarify, waffle as waffleCells,
  stack, zoomDomain, panDomain, easeOut,
} from './lib.js';

const NS = 'http://www.w3.org/2000/svg';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export const el = (tag, attrs = {}, ...kids) => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== null && v !== undefined && v !== false) node.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid !== null && kid !== undefined && kid !== false) node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return node;
};

const html = (tag, props = {}, ...kids) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid !== null && kid !== undefined && kid !== false) node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return node;
};

const tipNode = () => document.getElementById('tip');

const clearMarks = () => {
  document.querySelectorAll('.chart .sel').forEach((n) => n.classList.remove('sel'));
  document.querySelectorAll('.chart .cross').forEach((c) => c.setAttribute('visibility', 'hidden'));
};

const place = (node, pageX, pageY) => {
  const w = node.offsetWidth;
  const h = node.offsetHeight;
  const vw = document.documentElement.clientWidth;
  const minX = window.scrollX + 8;
  const maxX = window.scrollX + vw - w - 8;
  const maxY = window.scrollY + window.innerHeight - h - 8;
  let left = pageX + 14;
  if (left > maxX) left = pageX - w - 14;
  let top = pageY + 14;
  if (top > maxY) top = pageY - h - 14;
  node.style.left = `${Math.max(minX, Math.min(left, maxX))}px`;
  node.style.top = `${Math.max(window.scrollY + 8, top)}px`;
};

export const tip = {
  show(lines, pageX, pageY, pinned = false) {
    const node = tipNode();
    const close = pinned ? html('button', { type: 'button', class: 'tip-close', 'aria-label': 'Close' }, '×') : null;
    close?.addEventListener('click', () => tip.hide());
    node.replaceChildren(...lines, close);
    node.hidden = false;
    node.dataset.pinned = String(pinned);
    place(node, pageX, pageY);
  },
  hide() {
    const node = tipNode();
    node.hidden = true;
    node.dataset.pinned = 'false';
    clearMarks();
  },
  get pinned() {
    const node = tipNode();
    return !node.hidden && node.dataset.pinned === 'true';
  },
};

const installGlobal = () => {
  if (document.body.dataset.tipReady) return;
  document.body.dataset.tipReady = '1';
  document.addEventListener('click', (event) => {
    if (tip.pinned && !event.target.closest('#tip')) tip.hide();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') tip.hide();
  });
};

const tipLink = (href, text) => html('a', { href, target: '_blank', rel: 'noopener' }, `${text ?? 'Open the source'} ↗`);

export const tipLines = (value, label, ...extra) => [
  html('b', {}, value),
  html('span', {}, label),
  ...extra.filter(Boolean).map((e) => {
    if (e.nodeType) return e;
    if (e.href) return tipLink(e.href, e.text);
    return html('span', {}, e);
  }),
];

export const nearestMark = (root, cx, cy, axis) => {
  let best = null;
  let bestD = Infinity;
  for (const m of root.querySelectorAll('[data-k]')) {
    if (m.classList.contains('hit')) continue;
    const r = m.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    const d = axis === 'x'
      ? Math.abs(r.left + r.width / 2 - cx)
      : Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy);
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return bestD <= (axis === 'x' ? 40 : 36) ? best : null;
};

const hover = (root, lookup, { axis } = {}) => {
  installGlobal();
  const resolve = (event) => {
    const direct = event.target.closest?.('[data-k]');
    if (direct && root.contains(direct)) return direct;
    return Number.isFinite(event.clientX) ? nearestMark(root, event.clientX, event.clientY, axis) : null;
  };
  const select = (mark) => {
    clearMarks();
    mark.classList.add('sel');
  };
  root.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || tip.pinned) return;
    const mark = resolve(event);
    if (!mark) {
      tip.hide();
      return;
    }
    tip.show(lookup(mark.dataset.k, event, mark), event.pageX, event.pageY);
  });
  root.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse' && !tip.pinned) tip.hide();
  });
  root.addEventListener('click', (event) => {
    if (root.dataset.dragged === '1') {
      root.dataset.dragged = '';
      return;
    }
    const mark = resolve(event);
    if (!mark) return;
    event.stopPropagation();
    event.preventDefault();
    select(mark);
    tip.show(lookup(mark.dataset.k, event, mark), event.pageX, event.pageY, true);
  });
  root.addEventListener('focusin', (event) => {
    const mark = event.target.closest('[data-k]');
    if (!mark || tip.pinned) return;
    const r = mark.getBoundingClientRect();
    tip.show(lookup(mark.dataset.k, event, mark), r.right + window.scrollX, r.top + window.scrollY);
  });
  root.addEventListener('keydown', (event) => {
    const mark = event.target.closest('[data-k]');
    if (!mark || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    const r = mark.getBoundingClientRect();
    select(mark);
    tip.show(lookup(mark.dataset.k, event, mark), r.right + window.scrollX, r.top + window.scrollY, true);
  });
  root.addEventListener('focusout', () => {
    if (!tip.pinned) tip.hide();
  });
};

const widthOf = (mount) => Math.round(Math.min(Math.max(mount.clientWidth || 800, 280), 1120));

const measureLines = (svg) => {
  for (const path of svg.querySelectorAll('.line')) {
    const len = Math.ceil(path.getTotalLength ? path.getTotalLength() : 2000);
    path.style.setProperty('--len', `${len}`);
  }
};

const mountSvg = (mount, svg, ...before) => {
  mount.replaceChildren(...before, svg);
  measureLines(svg);
  return svg;
};

const barPath = (x, y, w, h) => {
  const r = Math.min(3, w / 2, h);
  const b = y + h;
  return `M${x},${b}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${b}Z`;
};

export const columns = ({
  mount, rows, key, value, overlay, attr = 'year', label = (r) => key(r), highlight = () => false,
  annotations = [], aria, describe, height = 250, yFormat = compact,
}) => {
  const W = widthOf(mount);
  const T = annotations.length ? 22 + annotations.length * 18 : 12;
  const L = 46;
  const B = 24;
  const H = height + T;
  const ticks = niceTicks(Math.max(...rows.map(value)), 4);
  const top = ticks.at(-1) || 1;
  const band = (W - L) / rows.length;
  const bw = Math.max(1, Math.min(band - 2, 26));
  const y = scaleLinear([0, top], [H - B, T]);
  const xAt = (i) => L + i * band + (band - bw) / 2;
  const widest = Math.max(...rows.map((r) => String(label(r)).length));
  const step = labelStep(rows.length, W - L, Math.max(34, widest * 6.6 + 12));
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': aria },
    ticks.map((t) => el('g', {},
      el('line', { class: t === 0 ? 'base' : 'grid', x1: L, x2: W, y1: y(t), y2: y(t) }),
      el('text', { x: L - 8, y: y(t) + 4, 'text-anchor': 'end' }, yFormat(t)))),
    rows.map((r, i) => el('path', {
      class: `bar${highlight(r) ? ' hi' : ''}${r.partial ? ' part' : ''}`,
      d: barPath(xAt(i), y(value(r)), bw, Math.max(0, H - B - y(value(r)))),
      [`data-${attr}`]: key(r),
      'data-k': i,
      style: `--i:${i}`,
    })),
    overlay ? rows.map((r, i) => el('path', {
      class: 'bar2',
      d: barPath(xAt(i) + bw * 0.22, y(overlay(r)), bw * 0.56, Math.max(0, H - B - y(overlay(r)))),
    })) : null,
    rows.map((r, i) => (i % step === 0 ? el('text', {
      x: xAt(i) + bw / 2, y: H - 6, 'text-anchor': 'middle',
    }, label(r)) : null)),
    annotations.map((a, n) => {
      const i = rows.findIndex((r) => key(r) === a.key);
      if (i < 0) return null;
      const cx = xAt(i) + bw / 2;
      const ty = 14 + n * 18;
      const right = cx > W * 0.62;
      return el('g', {},
        el('path', { class: 'note-line', d: `M${cx},${ty + 4}V${y(value(rows[i])) - 5}` }),
        el('text', { class: 'note', x: right ? cx - 6 : cx + 6, y: ty + 4, 'text-anchor': right ? 'end' : 'start' }, a.text));
    }));
  hover(svg, (k) => describe(rows[Number(k)], rows[Number(k) - 1]), { axis: 'x' });
  return mountSvg(mount, svg);
};

const truncate = (text, px) => {
  const max = Math.max(4, Math.floor(px / 6.6));
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

export const dotplot = ({
  mount, rows, attr = 'row', scale = 'log', format = exact, describe, rowH = 24, href, linkText, labelShare = 0.34, aria,
}) => {
  const W = widthOf(mount);
  const labelW = Math.min(240, Math.max(96, W * labelShare));
  const L = labelW + 10;
  const R = 70;
  const T = 22;
  const H = T + rows.length * rowH + 6;
  const values = rows.map((r) => r.value).filter((v) => v > 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const lo = scale === 'log' ? 10 ** Math.floor(Math.log10(min)) : 0;
  const hi = scale === 'log' ? 10 ** Math.ceil(Math.log10(max)) : niceTicks(max, 4).at(-1);
  const x = scale === 'log' ? scaleLog([lo, hi], [L, W - R]) : scaleLinear([0, hi], [L, W - R]);
  const spaced = (list) => list.reduce((kept, t) => {
    if (!kept.length || x(t) - x(kept.at(-1)) >= 40) kept.push(t);
    return kept;
  }, []);
  const ticks = spaced(scale === 'log' ? logTicks(lo, hi) : niceTicks(max, 4));
  const at = (v) => (v > 0 ? x(v) : L);
  const rowsG = el('g', { class: 'rows' }, rows.map((r, i) => {
    const content = [
      el('rect', { class: 'row-hit', x: 0, y: -rowH / 2, width: W, height: rowH }),
      el('text', { class: 'lab', x: 0, y: 4 }, truncate(r.label, labelW)),
      el('line', { class: 'stem', x1: L, x2: at(r.value), y1: 0, y2: 0, style: `--i:${i}` }),
      el('circle', { class: `dot${r.hi ? ' hi' : ''}`, cx: at(r.value), cy: 0, r: 4.5, style: `--i:${i}` }),
      el('text', { x: at(r.value) + 9, y: 4 }, format(r.value)),
    ];
    return el('g', {
      [`data-${attr}`]: r.key,
      'data-row': attr === 'row' ? r.key : null,
      'data-k': i,
      'data-rank': i,
      tabindex: 0,
      transform: `translate(0 ${T + i * rowH + rowH / 2})`,
    }, content);
  }));
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': aria },
    ticks.map((t) => el('g', {},
      el('line', { class: 'grid', x1: x(t), x2: x(t), y1: T - 6, y2: H }),
      el('text', { x: x(t), y: 10, 'text-anchor': 'middle' }, compact(t)))),
    rowsG);
  hover(svg, (k) => {
    const r = rows[Number(k)];
    const out = describe(r);
    return href ? [...out, tipLink(href(r), linkText?.(r))] : out;
  });
  mountSvg(mount, svg);
  const groups = [...rowsG.children];
  return {
    order(keys) {
      keys.forEach((key, rank) => {
        const g = groups.find((n) => n.getAttribute(`data-${attr}`) === String(key));
        g.setAttribute('transform', `translate(0 ${T + rank * rowH + rowH / 2})`);
        g.style.transform = `translate(0px, ${T + rank * rowH + rowH / 2}px)`;
        g.dataset.rank = rank;
      });
    },
  };
};

export const stackedArea = ({ mount, years, series, aria, format = exact }) => {
  const W = widthOf(mount);
  const L = 46;
  const R = 12;
  const T = 12;
  const B = 24;
  const H = 280;
  const rows = years.map((year, i) => Object.fromEntries([['year', year], ...series.map((s) => [s.key, s.values[i]])]));
  const layers = stack(rows, series.map((s) => s.key));
  const totals = rows.map((r) => series.reduce((n, s) => n + r[s.key], 0));
  const ticks = niceTicks(Math.max(...totals), 4);
  const x = scaleLinear([years[0], years.at(-1)], [L, W - R]);
  const y = scaleLinear([0, ticks.at(-1)], [H - B, T]);
  const area = (points) => {
    const upper = points.map(([, y1], i) => `${x(years[i]).toFixed(1)},${y(y1).toFixed(1)}`);
    const lower = points.map(([y0], i) => `${x(years[i]).toFixed(1)},${y(y0).toFixed(1)}`).reverse();
    return `M${upper.join('L')}L${lower.join('L')}Z`;
  };
  const step = labelStep(years.length, W - L, 40);
  const cross = el('line', { class: 'cross', y1: T, y2: H - B, x1: 0, x2: 0, visibility: 'hidden' });
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': aria },
    ticks.map((t) => el('g', {},
      el('line', { class: t === 0 ? 'base' : 'grid', x1: L, x2: W - R, y1: y(t), y2: y(t) }),
      el('text', { x: L - 8, y: y(t) + 4, 'text-anchor': 'end' }, compact(t)))),
    layers.map((layer, i) => el('path', {
      class: 'area', 'data-key': layer.key, d: area(layer.points), style: `fill:${series[i].color};--i:${i * 8}`,
    })),
    years.map((yr) => (yr % step === 0 ? el('text', { x: x(yr), y: H - 6, 'text-anchor': 'middle' }, yr) : null)),
    cross,
    el('rect', { class: 'hit', 'data-k': 0, x: L, y: T, width: W - L - R, height: H - T - B }));
  const legend = html('ul', { class: 'legend' }, series.map((s) => html('li', {}, html('i', { style: `background:${s.color}` }), s.label)));
  hover(svg, (k, event) => {
    const box = svg.getBoundingClientRect();
    const px = ((event.clientX ?? box.left + box.width / 2) - box.left) * (W / box.width);
    const i = Math.max(0, Math.min(years.length - 1, Math.round(((px - L) / (W - L - R)) * (years.length - 1))));
    cross.setAttribute('x1', x(years[i]));
    cross.setAttribute('x2', x(years[i]));
    cross.setAttribute('visibility', 'visible');
    return [
      html('b', {}, `${years[i]}: ${format(totals[i])}`),
      ...[...series].reverse().map((s) => html('span', {}, html('i', { style: `background:${s.color}` }), `${s.label} ${format(rows[i][s.key])}`)),
    ];
  });
  return mountSvg(mount, svg, legend);
};

export const miniArea = ({ years, values, color = 'var(--ink)', describe }) => {
  const W = 260;
  const H = 74;
  const max = Math.max(...values, 1);
  const x = scaleLinear([0, values.length - 1], [2, W - 2]);
  const y = scaleLinear([0, max], [H - 14, 6]);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const cross = el('line', { class: 'cross', y1: 4, y2: H - 14, x1: 0, x2: 0, visibility: 'hidden' });
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true', preserveAspectRatio: 'none' },
    el('line', { class: 'base', x1: 0, x2: W, y1: H - 14, y2: H - 14 }),
    el('path', { class: 'wash', d: `M${x(0)},${H - 14}L${pts.join('L')}L${x(values.length - 1)},${H - 14}Z` }),
    el('path', { class: 'line', d: `M${pts.join('L')}`, style: `stroke:${color}` }),
    el('text', { x: 2, y: H - 2 }, years[0]),
    el('text', { x: W - 2, y: H - 2, 'text-anchor': 'end' }, years.at(-1)),
    cross,
    el('rect', { class: 'hit', 'data-k': 0, x: 0, y: 0, width: W, height: H - 12 }));
  hover(svg, (k, event) => {
    const box = svg.getBoundingClientRect();
    const i = Math.max(0, Math.min(values.length - 1, Math.round((((event.clientX ?? box.right) - box.left) / box.width) * (values.length - 1))));
    cross.setAttribute('x1', x(i));
    cross.setAttribute('x2', x(i));
    cross.setAttribute('visibility', 'visible');
    return describe(years[i], values[i]);
  });
  return html('div', { class: 'chart mini' }, svg);
};

export const waffle = ({ mount, parts, aria, format = exact }) => {
  const total = parts.reduce((n, p) => n + p.value, 0);
  const cells = waffleCells(parts.map((p, i) => ({ key: i, value: p.value })));
  const side = Math.min(widthOf(mount), 300) / 10;
  const gap = 2;
  const svg = el('svg', { class: `w${parts.length}`, viewBox: `0 0 ${side * 10} ${side * 10}`, role: 'img', 'aria-label': aria, style: `max-width:${side * 10}px` },
    cells.map((k, n) => el('rect', {
      class: `cell k${k}`,
      x: (n % 10) * side,
      y: Math.floor(n / 10) * side,
      width: side - gap,
      height: side - gap,
      'data-k': k,
      style: `--i:${n}`,
    })));
  hover(svg, (k) => {
    const p = parts[Number(k)];
    return tipLines(`${((p.value / total) * 100).toFixed(1)}%`, p.label, format(p.value));
  });
  const legend = html('ul', { class: 'legend' }, parts.map((p, i) => html('li', {},
    html('i', { class: `sw k${i}` }),
    `${p.label} ${((p.value / total) * 100).toFixed(1)}%`)));
  mount.replaceChildren(svg, legend);
  for (const [i, sw] of [...legend.querySelectorAll('.sw')].entries()) {
    sw.style.background = getComputedStyle(svg.querySelector(`.k${i}`) ?? svg).fill;
  }
  return svg;
};

export const treemap = ({ mount, items, height, aria, describe }) => {
  const W = widthOf(mount);
  const H = height ?? Math.round(Math.min(460, Math.max(260, W * 0.5)));
  const rects = squarify(items, W, H);
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': aria },
    rects.map((r, i) => el('g', {
      'data-ic': r.key, 'data-k': items.indexOf(items.find((it) => it.key === r.key)), class: r.hi ? 'me' : null, tabindex: 0,
    },
    el('rect', { class: `tile${r.hi ? ' hi' : ''}`, x: r.x, y: r.y, width: Math.max(0, r.w), height: Math.max(0, r.h), style: `--i:${i * 3}` }),
    r.w > 46 && r.h > 22 ? el('text', { class: 'tile-lab', x: r.x + 7, y: r.y + 17 }, r.label) : null,
    r.w > 74 && r.h > 40 ? el('text', { class: 'tile-sub', x: r.x + 7, y: r.y + 33 }, r.sub) : null)));
  hover(svg, (k) => describe(items[Number(k)]));
  return mountSvg(mount, svg);
};

export const lines = ({
  mount, series, aria, describe, annotations = [], scale = 'log', yFormat = compact, height = 300, labelW = 92,
}) => {
  const W = widthOf(mount);
  const L = 46;
  const R = labelW;
  const T = 16 + annotations.length * 18;
  const B = 24;
  const H = height;
  const xs = [...new Set(series.flatMap((s) => s.rows.map((r) => r.x)))].sort((a, b) => a - b);
  const ys = series.flatMap((s) => s.rows.map((r) => r.y)).filter((v) => v > 0);
  const log = scale === 'log';
  const lo = log ? 10 ** Math.floor(Math.log10(Math.min(...ys))) : 0;
  const hi = log ? 10 ** Math.ceil(Math.log10(Math.max(...ys))) : niceTicks(Math.max(...ys), 4).at(-1);
  const x = scaleLinear([xs[0], xs.at(-1)], [L, W - R]);
  const y = log ? scaleLog([lo, hi], [H - B, T]) : scaleLinear([0, hi], [H - B, T]);
  const ticks = log ? logTicks(lo, hi).filter((t) => Math.round(Math.log10(t)) % 3 === 0) : niceTicks(Math.max(...ys), 4);
  const step = labelStep(xs.length, W - L - R, 40);
  const cross = el('line', { class: 'cross', y1: T, y2: H - B, x1: 0, x2: 0, visibility: 'hidden' });
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': aria },
    ticks.map((t) => el('g', {},
      el('line', { class: 'grid', x1: L, x2: W - R, y1: y(t), y2: y(t) }),
      el('text', { x: L - 8, y: y(t) + 4, 'text-anchor': 'end' }, yFormat(t)))),
    el('line', { class: 'base', x1: L, x2: W - R, y1: H - B, y2: H - B }),
    xs.map((v) => (v % step === 0 ? el('text', { x: x(v), y: H - 6, 'text-anchor': 'middle' }, v) : null)),
    series.map((s) => {
      const last = s.rows.at(-1);
      return el('g', {},
        el('path', { class: `line${s.alt ? ' alt' : ''}${s.cls ? ` ${s.cls}` : ''}`, d: `M${s.rows.filter((r) => !log || r.y > 0).map((r) => `${x(r.x).toFixed(1)},${y(r.y).toFixed(1)}`).join('L')}` }),
        el('text', { class: 'lab', x: x(last.x) + 8, y: y(last.y) + 4 }, s.label));
    }),
    annotations.map((a, n) => {
      const s = series[a.series ?? 0];
      const r = s.rows.find((p) => p.x === a.x);
      if (!r) return null;
      const ty = 14 + n * 18;
      return el('g', {},
        el('path', { class: 'note-line', d: `M${x(r.x)},${ty + 4}V${y(r.y) - 6}` }),
        el('text', { class: 'note', x: x(r.x) + 6, y: ty + 4 }, a.text));
    }),
    cross,
    el('rect', { class: 'hit', 'data-k': 0, x: L, y: T, width: W - L - R, height: H - T - B }));
  hover(svg, (k, event) => {
    const box = svg.getBoundingClientRect();
    const px = ((event.clientX ?? box.left + box.width / 2) - box.left) * (W / box.width);
    const i = Math.max(0, Math.min(xs.length - 1, Math.round(((px - L) / (W - L - R)) * (xs.length - 1))));
    cross.setAttribute('x1', x(xs[i]));
    cross.setAttribute('x2', x(xs[i]));
    cross.setAttribute('visibility', 'visible');
    return describe(xs[i]);
  });
  return mountSvg(mount, svg);
};

const fractionalYear = (date) => {
  const [yy, mm = '1', dd = '1'] = date.split('-');
  return Number(yy) + (Number(mm) - 1) / 12 + (Number(dd) - 1) / 365;
};

export const timeline = ({ mount, events, people, projects, limits, onSelect, onRange }) => {
  let domain = [...limits];
  let selected = null;
  const lanes = { nlm: 46, ncbi: 78, dirNlm: 122, dirNcbi: 148, launch: 194 };
  const H = 228;
  const draw = () => {
    const W = widthOf(mount);
    const L = 8;
    const R = 8;
    const x = scaleLinear(domain, [L, W - R]);
    const span = domain[1] - domain[0];
    const tickStep = [1, 2, 5, 10, 20, 25, 50, 100].find((s) => (span / s) * 56 <= W) ?? 100;
    const ticks = [];
    for (let t = Math.ceil(domain[0] / tickStep) * tickStep; t <= domain[1]; t += tickStep) ticks.push(t);
    const visible = (v) => v >= domain[0] - 1 && v <= domain[1] + 1;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Timeline ${Math.round(domain[0])} to ${Math.round(domain[1])}` },
      ticks.map((t) => el('g', {},
        el('line', { class: 'grid', x1: x(t), x2: x(t), y1: 26, y2: H - 8 }),
        el('text', { x: x(t), y: 14, 'text-anchor': 'middle' }, t))),
      el('text', { class: 'lane-lab', x: L, y: lanes.nlm - 12 }, 'NLM events'),
      el('text', { class: 'lane-lab', x: L, y: lanes.ncbi - 12 }, 'NCBI events'),
      el('text', { class: 'lane-lab', x: L, y: lanes.dirNlm - 10 }, 'Directors'),
      el('text', { class: 'lane-lab', x: L, y: lanes.launch - 12 }, 'Launches'),
      events.map((e, i) => {
        const v = fractionalYear(e.date);
        const on = selected?.type === 'event' && selected.i === i;
        return el('circle', {
          class: `ev${e.org === 'NCBI' ? ' ncbi' : ''}${on ? ' on' : ''}`,
          'data-event': i,
          'data-k': `event:${i}`,
          cx: x(v),
          cy: e.org === 'NCBI' ? lanes.ncbi : lanes.nlm,
          r: on ? 7 : 5,
          style: `--i:${i}`,
          visibility: visible(v) ? 'visible' : 'hidden',
        });
      }),
      people.map((p, i) => {
        const x0 = x(Math.max(p.from, domain[0]));
        const x1 = x(Math.min(p.to ?? limits[1], domain[1]));
        const on = selected?.type === 'person' && selected.i === i;
        return el('rect', {
          class: `tenure${p.org === 'NCBI' ? ' ncbi' : ''}${on ? ' on' : ''}`,
          'data-person': i,
          'data-k': `person:${i}`,
          x: Math.min(x0, x1),
          y: (p.org === 'NCBI' ? lanes.dirNcbi : lanes.dirNlm) - 7,
          width: Math.max(2, Math.abs(x1 - x0) - 2),
          height: 14,
          style: `--i:${i * 4}`,
          visibility: p.to !== null && p.to < domain[0] ? 'hidden' : 'visible',
        });
      }),
      projects.map((p, i) => {
        const cx = x(p.since + 0.5);
        const cy = lanes.launch;
        const on = selected?.type === 'project' && selected.i === i;
        return el('g', { visibility: visible(p.since) ? 'visible' : 'hidden' },
          el('path', {
            class: `launch${on ? ' on' : ''}`,
            'data-project': i,
            'data-k': `project:${i}`,
            d: `M${cx},${cy - 7}L${cx + 7},${cy}L${cx},${cy + 7}L${cx - 7},${cy}Z`,
            style: `--i:${i * 4}`,
          }),
          span <= 70 ? el('text', { class: 'tl-lab', x: cx, y: cy + 22, 'text-anchor': 'middle' }, p.name) : null);
      }),
      el('rect', { class: 'drag', x: 0, y: 0, width: W, height: H, fill: 'transparent', style: 'pointer-events:none' }));
    mount.replaceChildren(svg);
    hover(svg, (k) => {
      const [type, i] = k.split(':');
      if (type === 'event') return tipLines(events[i].date, events[i].text);
      if (type === 'person') return tipLines(people[i].name, `${people[i].role}, ${people[i].org}, ${people[i].from}–${people[i].to ?? 'now'}`);
      return tipLines(String(projects[i].since), `${projects[i].name} (${projects[i].org})`);
    });
    let drag = null;
    svg.addEventListener('pointerdown', (event) => {
      drag = { x: event.clientX, d: [...domain], moved: false };
      svg.setPointerCapture(event.pointerId);
    });
    svg.addEventListener('pointermove', (event) => {
      if (!drag) return;
      const dx = event.clientX - drag.x;
      if (Math.abs(dx) > 6) drag.moved = true;
      if (!drag.moved) return;
      svg.dataset.dragged = '1';
      const perPx = (drag.d[1] - drag.d[0]) / svg.getBoundingClientRect().width;
      domain = panDomain(drag.d, -dx * perPx, limits);
      tip.hide();
      redraw();
    });
    svg.addEventListener('pointerup', (event) => {
      const moved = drag?.moved;
      drag = null;
      if (moved) return;
      const hit = nearestMark(svg, event.clientX, event.clientY);
      if (!hit) return;
      const [type, i] = hit.dataset.k.split(':');
      selected = { type, i: Number(i) };
      onSelect(type, Number(i));
      redraw();
    });
    svg.addEventListener('wheel', (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const box = svg.getBoundingClientRect();
      const center = domain[0] + ((event.clientX - box.left) / box.width) * (domain[1] - domain[0]);
      domain = zoomDomain(domain, center, event.deltaY > 0 ? 1.25 : 0.8, limits, 4);
      redraw();
    }, { passive: false });
    onRange(domain);
  };
  let frame = 0;
  const redraw = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  };
  draw();
  const animateTo = (target) => {
    const from = [...domain];
    if (reduced()) {
      domain = target;
      draw();
      return;
    }
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / 450);
      const e = easeOut(t);
      domain = [from[0] + (target[0] - from[0]) * e, from[1] + (target[1] - from[1]) * e];
      draw();
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  return {
    zoom(factor) {
      const mid = (domain[0] + domain[1]) / 2;
      const target = zoomDomain(domain, mid, factor, limits, 4);
      domain = target;
      draw();
    },
    set(range) {
      animateTo(range);
    },
    focus(year, type, i) {
      selected = { type, i };
      domain = zoomDomain([year - 15, year + 15], year, 1, limits, 4);
      draw();
    },
    reset() {
      selected = null;
      domain = [...limits];
      draw();
    },
    redraw: draw,
  };
};

export const observeFigures = () => {
  const figs = [...document.querySelectorAll('.fig')];
  if (reduced() || !('IntersectionObserver' in window)) {
    figs.forEach((f) => f.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    }
  }, { threshold: 0.15 });
  figs.forEach((f) => io.observe(f));
};

export const countUp = (node, value, format = exact) => {
  if (reduced() || !('IntersectionObserver' in window)) {
    node.textContent = format(value);
    return;
  }
  node.textContent = format(0);
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / 1500);
      node.textContent = format(Math.round(value * easeOut(t)));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  io.observe(node);
};

export const tileMap = ({ mount, tiles, values, describe, aria }) => {
  const W = widthOf(mount);
  const size = Math.floor(Math.min(W / 12, 72));
  const gap = 3;
  const present = Object.values(values).filter((v) => v > 0);
  const lo = Math.log10(Math.max(1, Math.min(...present)));
  const hi = Math.log10(Math.max(...present));
  const share = (v) => (v > 0 && hi > lo ? (Math.log10(v) - lo) / (hi - lo) : 0);
  const codes = Object.keys(tiles);
  const svg = el('svg', { viewBox: `0 0 ${size * 12} ${size * 8}`, role: 'img', 'aria-label': aria, style: `max-width:${size * 12}px` },
    codes.map((code, i) => {
      const t = tiles[code];
      const v = values[code] ?? 0;
      const p = share(v);
      return el('g', { 'data-state': code, 'data-k': i, tabindex: 0 },
        el('rect', {
          class: 'tile state', x: t.col * size, y: t.row * size, width: size - gap, height: size - gap,
          style: `fill:color-mix(in srgb, var(--accent) ${Math.round(8 + p * 92)}%, var(--paper-2));--i:${i}`,
        }),
        el('text', { class: `tile-code${p > 0.55 ? ' on' : ''}`, x: t.col * size + (size - gap) / 2, y: t.row * size + (size - gap) / 2 + 4, 'text-anchor': 'middle' }, code));
    }));
  hover(svg, (k) => describe(codes[Number(k)], values[codes[Number(k)]] ?? 0));
  const legend = html('p', { class: 'scale-key' }, html('span', {}, 'Fewer dollars'), html('i', {}), html('span', {}, 'More, log scale'));
  mount.replaceChildren(svg, legend);
  return svg;
};

export const dumbbell = ({ mount, rows, years, describe, aria, format = compact }) => {
  const W = widthOf(mount);
  const labelW = Math.min(170, Math.max(96, W * 0.3));
  const L = labelW + 10;
  const R = 60;
  const T = 22;
  const rowH = 24;
  const H = T + rows.length * rowH + 6;
  const values = rows.flatMap((r) => [r.a, r.b]).filter((v) => v > 0);
  const lo = 10 ** Math.floor(Math.log10(Math.min(...values)));
  const hi = 10 ** Math.ceil(Math.log10(Math.max(...values)));
  const x = scaleLog([lo, hi], [L, W - R]);
  const ticks = logTicks(lo, hi);
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': aria },
    ticks.map((t) => el('g', {},
      el('line', { class: 'grid', x1: x(t), x2: x(t), y1: T - 6, y2: H }),
      el('text', { x: x(t), y: 10, 'text-anchor': 'middle' }, compact(t)))),
    rows.map((r, i) => {
      const y = T + i * rowH + rowH / 2;
      return el('g', { 'data-row': r.key, 'data-k': i, tabindex: 0 },
        el('rect', { class: 'row-hit', x: 0, y: y - rowH / 2, width: W, height: rowH }),
        el('text', { class: 'lab', x: 0, y: y + 4 }, truncate(r.label, labelW)),
        el('line', { class: 'stem', x1: x(r.a), x2: x(r.b), y1: y, y2: y, style: `--i:${i}` }),
        el('circle', { class: 'dot then', cx: x(r.a), cy: y, r: 4, style: `--i:${i}` }),
        el('circle', { class: 'dot hi', cx: x(r.b), cy: y, r: 4.5, style: `--i:${i}` }),
        el('text', { x: Math.max(x(r.a), x(r.b)) + 9, y: y + 4 }, format(r.b)));
    }));
  hover(svg, (k) => describe(rows[Number(k)]));
  const legend = html('ul', { class: 'legend' },
    html('li', {}, html('i', { class: 'dot-key then' }), String(years[0])),
    html('li', {}, html('i', { class: 'dot-key now' }), String(years[1])));
  mountSvg(mount, svg, legend);
  return svg;
};
