import { useEffect, useState } from 'react';
import { api, type TxFilters } from '../api';
import { useMonth } from '../month';
import { brl } from '../format';
import { TxTable } from '../components/TxTable';
import { TxModal } from '../components/TxModal';
import type { Category, Transaction, TxType } from '../types';

export function TransactionsPage() {
  const { month, version, bump } = useMonth();
  const [rows, setRows] = useState<Transaction[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [type, setType] = useState<TxType | ''>('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [error, setError] = useState('');

  const filters: TxFilters = { month, type: type || undefined, categoryId: categoryId || undefined, q: q.trim() || undefined };

  useEffect(() => {
    api.listCategories().then(setCategories).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    let alive = true;
    // pequeno atraso para não disparar uma requisição a cada tecla da busca
    const t = setTimeout(() => {
      api
        .listTransactions(filters)
        .then((r) => {
          if (!alive) return;
          setRows(r);
          setError('');
        })
        .catch((e) => setError(e.message));
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, version, type, categoryId, q]);

  const remove = async (tx: Transaction) => {
    if (!confirm(`Excluir "${tx.description}"?`)) return;
    try {
      await api.deleteTransaction(tx.id);
      bump();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    }
  };

  const income = rows?.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount_cents, 0) ?? 0;
  const expense = rows?.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount_cents, 0) ?? 0;
  const visibleCategories = categories.filter((c) => !type || c.type === type);

  return (
    <div className="panel">
      <div className="filters">
        <div className="segmented segmented--sm" role="radiogroup" aria-label="Tipo">
          {([['', 'Todos'], ['income', 'Receitas'], ['expense', 'Despesas']] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={type === value}
              className={`segmented__opt ${type === value ? 'is-active' : ''}`}
              onClick={() => {
                setType(value);
                setCategoryId('');
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')} aria-label="Categoria">
          <option value="">Todas as categorias</option>
          {visibleCategories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input type="search" placeholder="Buscar descrição…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="btn btn--ghost" onClick={() => api.exportCsv(filters).catch((e) => setError(e.message))}>
          Exportar CSV
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      {rows && (
        <p className="totals">
          <span>{rows.length} lançamento(s)</span>
          <span>Receitas <strong>{brl(income)}</strong></span>
          <span>Despesas <strong>{brl(expense)}</strong></span>
          <span>Saldo <strong>{brl(income - expense)}</strong></span>
        </p>
      )}

      {rows ? <TxTable rows={rows} onEdit={setEditing} onDelete={remove} /> : <div className="splash">Carregando…</div>}

      {editing && (
        <TxModal
          tx={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            bump();
          }}
        />
      )}
    </div>
  );
}
