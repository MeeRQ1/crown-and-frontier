// Number and label formatting shared by the interface.

export function fmt(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return '∞';
  const abs = Math.abs(n);
  if (abs >= 100000) return `${(n / 1000).toFixed(0)}k`;
  if (abs >= 10000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function signed(n: number, digits = 1): string {
  const v = Number(n.toFixed(digits));
  if (v === 0) return '±0';
  return `${v > 0 ? '+' : '−'}${fmt(Math.abs(v), digits)}`;
}

export function men(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(Math.round(n));
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function weeks(n: number): string {
  if (n < 8) return plural(n, 'week');
  const m = Math.round(n / 4);
  return plural(m, 'month');
}
