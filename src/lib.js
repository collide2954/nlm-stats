const toNumber = (v) => {
  if (v === null || v === undefined || v === '') return NaN;
  return typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
};

export const exact = (v) => {
  const n = toNumber(v);
  return Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—';
};

const UNITS = [
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
];

export const compact = (v) => {
  const n = toNumber(v);
  if (!Number.isFinite(n)) return '—';
  for (const [size, unit] of UNITS) {
    if (Math.abs(n) >= size) {
      const scaled = Math.round((n / size) * 10) / 10;
      return `${scaled}${unit}`;
    }
  }
  return String(Math.round(n));
};

export const pct = (ratio) => {
  const v = Math.round(ratio * 1000) / 10;
  return `${v}%`;
};
