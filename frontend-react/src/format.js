/** Small display helpers shared by pages. */
export function fmtDateTime(v) {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function fmtDate(v) {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function km(meters) {
  return meters == null ? '-' : (Number(meters) / 1000).toFixed(1);
}

export function minutes(seconds) {
  return seconds == null ? '-' : String(Math.round(Number(seconds) / 60));
}

export function todayIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function humanize(s) {
  if (s == null || s === '') return '-';
  return String(s).replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function asList(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') return v.split(/[,;]\s*/).filter(Boolean);
  return [v];
}

export const OPERATE_URL = 'http://localhost:8080/operate/processes';
