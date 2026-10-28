import { brl, dayMonth } from '../format';
import type { Transaction } from '../types';

interface Props {
  rows: Transaction[];
  onRepeat?: (tx: Transaction) => void;
  onEdit?: (tx: Transaction) => void;
  onDelete?: (tx: Transaction) => void;
}

export function TxTable({ rows, onRepeat, onEdit, onDelete }: Props) {
  if (rows.length === 0) return <p className="empty">Nenhum lançamento encontrado.</p>;
  const actions = onEdit || onDelete;

  return (
    <table className="tx-table">
      <thead>
        <tr>
          <th>Data</th>
          <th>Descrição</th>
          <th>Categoria</th>
          <th className="num">Valor</th>
          {actions && <th aria-label="Ações" />}
        </tr>
      </thead>
      <tbody>
        {rows.map((tx) => (
          <tr key={tx.id}>
            <td className="muted num">{dayMonth(tx.date)}</td>
            <td>{tx.description}</td>
            <td><span className={`tag tag--${tx.type}`}>{tx.category_name}</span></td>
            <td className={`num amount amount--${tx.type}`}>
              {tx.type === 'income' ? '+ ' : '− '}
              {brl(tx.amount_cents)}
            </td>
            {actions && (
              <td className="row-actions">
                {onRepeat && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    title="Cria uma cópia no mês seguinte"
                    onClick={() => onRepeat(tx)}
                  >
                    Repetir ↻
                  </button>
                )}
                {onEdit && <button type="button" className="btn btn--ghost btn--sm" onClick={() => onEdit(tx)}>Editar</button>}
                {onDelete && (
                  <button type="button" className="icon-btn" aria-label={`Excluir ${tx.description}`} onClick={() => onDelete(tx)}>×</button>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
