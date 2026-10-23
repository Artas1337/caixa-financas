import { brl, pctChange } from '../format';

interface Props {
  label: string;
  value: number;
  previous?: number;
  /** Se subir é bom (receita) ou ruim (despesa) — define a cor da variação. */
  upIsGood?: boolean;
  /** Saldo pode ser negativo, então percentual não faz sentido: mostra a diferença em R$. */
  deltaAs?: 'pct' | 'abs';
  hero?: boolean;
}

export function StatTile({ label, value, previous, upIsGood = true, deltaAs = 'pct', hero }: Props) {
  let delta: { up: boolean; text: string } | null = null;
  if (previous !== undefined) {
    if (deltaAs === 'abs' && value !== previous) {
      delta = { up: value > previous, text: brl(Math.abs(value - previous)) };
    }
    const pct = pctChange(value, previous);
    if (deltaAs === 'pct' && pct !== null && Math.abs(pct) >= 0.5) {
      delta = { up: pct > 0, text: `${Math.abs(pct).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%` };
    }
  }
  const good = delta !== null && delta.up === upIsGood;

  return (
    <div className={`stat ${hero ? 'stat--hero' : ''}`}>
      <span className="stat__label">{label}</span>
      <span className={`stat__value ${hero && value < 0 ? 'is-negative' : ''}`}>{brl(value)}</span>
      {delta && (
        <span className={`stat__delta ${good ? 'status--good' : 'status--critical'}`}>
          {delta.up ? '▲' : '▼'} {delta.text}
          <span className="muted"> vs. mês anterior</span>
        </span>
      )}
    </div>
  );
}
