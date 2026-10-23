import { brl } from '../format';
import type { CategorySpend } from '../types';

/**
 * Barras horizontais de gasto por categoria. Uma só cor (a identidade vem do rótulo);
 * o orçamento aparece como marcador vertical e o estouro como status (ícone + texto).
 */
export function CategoryBars({ data }: { data: CategorySpend[] }) {
  if (data.length === 0) return <p className="empty">Nenhuma despesa neste mês.</p>;
  const max = Math.max(...data.map((c) => Math.max(c.total, c.budget ?? 0)));

  return (
    <ul className="cat-bars">
      {data.map((c) => {
        const over = c.budget !== null && c.total > c.budget;
        const pct = (v: number) => `${(v / max) * 100}%`;
        return (
          <li key={c.id} className="cat-bars__row">
            <span className="cat-bars__name">{c.name}</span>
            <span className="cat-bars__track">
              <span className="cat-bars__fill" style={{ width: pct(c.total) }} />
              {c.budget !== null && (
                <span className="cat-bars__budget" style={{ left: pct(c.budget) }} title={`Orçamento: ${brl(c.budget)}`} />
              )}
            </span>
            <span className="cat-bars__value">
              {brl(c.total)}
              {c.budget !== null && (
                <small className={over ? 'status status--critical' : 'muted'}>
                  {over ? `▲ ${brl(c.total - c.budget)} acima` : `de ${brl(c.budget)}`}
                </small>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
