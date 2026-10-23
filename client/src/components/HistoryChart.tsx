import { useLayoutEffect, useRef, useState } from 'react';
import { brl, brlCompact, monthLong, monthShort } from '../format';
import type { MonthTotals } from '../types';

const HEIGHT = 240;
const PAD = { top: 12, right: 8, bottom: 28, left: 64 };
const BAR_MAX = 24;
const GAP = 2; // espaço em cor de superfície entre as barras do mesmo mês
const TIP_HALF = 100; // metade da largura do tooltip, para ele não sair pelas bordas

/** Escala com divisões "redondas" (1, 2, 2.5, 5 × 10^n). */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

/** Barra com topo arredondado (4px) e base reta. */
function barPath(x: number, y: number, w: number, h: number) {
  if (h <= 0) return '';
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(600);
  useLayoutEffect(() => {
    if (!ref.current) return;
    setWidth(ref.current.clientWidth); // mede já no primeiro render, sem esperar o observer
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Colunas agrupadas: receitas × despesas nos últimos 6 meses (um único eixo em R$). */
export function HistoryChart({ data, current }: { data: MonthTotals[]; current: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const ticks = niceTicks(Math.max(...data.flatMap((d) => [d.income, d.expense])));
  const yMax = ticks.at(-1)!;
  const plotW = Math.max(width - PAD.left - PAD.right, 100);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const band = plotW / data.length;
  const barW = Math.min(BAR_MAX, (band - 16) / 2 - GAP);
  const y = (v: number) => PAD.top + plotH - (v / yMax) * plotH;

  const hovered = hover !== null ? data[hover] : null;

  return (
    <div className="chart" ref={ref}>
      <ul className="legend">
        <li><i className="swatch swatch--income" />Receitas</li>
        <li><i className="swatch swatch--expense" />Despesas</li>
      </ul>

      <svg width={width} height={HEIGHT} role="img" aria-label="Receitas e despesas dos últimos 6 meses">
        {ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 ? 'axis' : 'grid'} x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)} />
            <text className="tick" x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end">{brlCompact(t)}</text>
          </g>
        ))}

        {data.map((d, i) => {
          const cx = PAD.left + band * i + band / 2;
          return (
            <g key={d.month}>
              {hover === i && <rect className="band-hover" x={cx - band / 2 + 4} y={PAD.top} width={band - 8} height={plotH} rx={6} />}
              <path className="bar bar--income" d={barPath(cx - GAP / 2 - barW, y(d.income), barW, y(0) - y(d.income))} />
              <path className="bar bar--expense" d={barPath(cx + GAP / 2, y(d.expense), barW, y(0) - y(d.expense))} />
              <text className={`tick ${d.month === current ? 'tick--current' : ''}`} x={cx} y={HEIGHT - 8} textAnchor="middle">
                {monthShort(d.month)}
              </text>
              {/* alvo de hover maior que as barras; também responde a toque e teclado (Tab) */}
              <rect
                className="hit"
                x={cx - band / 2}
                y={PAD.top}
                width={band}
                height={plotH}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`${monthLong(d.month)}: receitas ${brl(d.income)}, despesas ${brl(d.expense)}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              />
            </g>
          );
        })}
      </svg>

      {hovered && hover !== null && (
        <div
          className="tooltip"
          style={{ left: Math.max(TIP_HALF, Math.min(PAD.left + band * hover + band / 2, width - TIP_HALF)), top: Math.max(y(Math.max(hovered.income, hovered.expense)) - 8, 40) }}
        >
          <strong>{monthLong(hovered.month)}</strong>
          <span><i className="swatch swatch--income" />Receitas <b>{brl(hovered.income)}</b></span>
          <span><i className="swatch swatch--expense" />Despesas <b>{brl(hovered.expense)}</b></span>
          <span className="tooltip__total">Saldo <b>{brl(hovered.income - hovered.expense)}</b></span>
        </div>
      )}
    </div>
  );
}
