const brlFormat = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 123456 → "R$ 1.234,56" */
export const brl = (cents: number) => brlFormat.format(cents / 100);

/** Rótulo curto para eixos: 0 / R$ 500 / R$ 2 mil / R$ 1,5 mi */
export function brlCompact(cents: number): string {
  const v = cents / 100;
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return v === 0 ? '0' : `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}

/** "1.234,56" | "1234.56" | "R$ 50" → centavos (ou null se inválido) */
export function parseMoney(input: string): number | null {
  let s = input.replace(/R\$|\s/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(Number(s) * 100);
  return cents > 0 ? cents : null;
}

/** centavos → "1234,56" para preencher campo de edição */
export const centsToInput = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

const monthDate = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
};

/** "2026-10" → "outubro de 2026" */
export const monthLong = (month: string) =>
  monthDate(month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** "2026-10" → "out" */
export const monthShort = (month: string) =>
  monthDate(month).toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '');

export function shiftMonth(month: string, delta: number) {
  const d = monthDate(month);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 7);
}

export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/** Mês atual no fuso local ("2026-10"). */
export const currentMonth = () => todayISO().slice(0, 7);

/** "2026-10-05" → "05/10" */
export const dayMonth = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Variação percentual; null quando não há base de comparação. */
export const pctChange = (now: number, before: number) => (before === 0 ? null : ((now - before) / before) * 100);
