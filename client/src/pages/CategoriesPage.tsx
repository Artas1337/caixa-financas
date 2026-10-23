import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import { centsToInput, parseMoney } from '../format';
import type { Category, TxType } from '../types';

interface BudgetInputProps {
  category: Category;
  onSaved: (c: Category) => void;
  onError: (message: string) => void;
}

function BudgetInput({ category, onSaved, onError }: BudgetInputProps) {
  const initial = category.budget_cents ? centsToInput(category.budget_cents) : '';
  const [value, setValue] = useState(initial);

  const commit = async () => {
    if (value === initial) return;
    const cents = value.trim() === '' ? null : parseMoney(value);
    if (cents === null && value.trim() !== '') {
      setValue(initial);
      return onError('Orçamento inválido. Use um valor como 500 ou 1.250,00');
    }
    try {
      onSaved(await api.updateCategory(category.id, { budgetCents: cents }));
    } catch (err) {
      setValue(initial);
      onError(err instanceof Error ? err.message : 'Erro');
    }
  };

  return (
    <label className="budget-input">
      <span className="muted">Orçamento</span>
      <span className="money-input money-input--sm">
        <span>R$</span>
        <input
          inputMode="decimal"
          placeholder="sem limite"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </span>
    </label>
  );
}

function CategoryList({ type, items, onChange }: { type: TxType; items: Category[]; onChange: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.createCategory(name.trim(), type);
      setName('');
      setError('');
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  };

  const remove = async (c: Category) => {
    if (!confirm(`Excluir a categoria "${c.name}"?`)) return;
    try {
      await api.deleteCategory(c.id);
      setError('');
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  };

  return (
    <section className="panel">
      <header className="panel__head">
        <h2>{type === 'income' ? 'Receitas' : 'Despesas'}</h2>
        <span className="muted">{items.length} categorias</span>
      </header>

      <ul className="cat-list">
        {items.map((c) => (
          <li key={c.id}>
            <div>
              <strong>{c.name}</strong>
              <span className="muted">{c.tx_count} lançamento(s)</span>
            </div>
            {type === 'expense' && (
              <BudgetInput
                category={c}
                onSaved={() => {
                  setError('');
                  onChange();
                }}
                onError={setError}
              />
            )}
            <button
              type="button"
              className="icon-btn"
              aria-label={`Excluir ${c.name}`}
              disabled={c.tx_count > 0}
              title={c.tx_count > 0 ? 'Em uso por lançamentos' : 'Excluir'}
              onClick={() => remove(c)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <form className="cat-add" onSubmit={add}>
        <input value={name} maxLength={40} placeholder="Nova categoria" onChange={(e) => setName(e.target.value)} />
        <button className="btn btn--ghost">Adicionar</button>
      </form>
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [error, setError] = useState('');
  const load = () =>
    api
      .listCategories()
      .then((c) => {
        setCategories(c);
        setError('');
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  if (!categories) return error ? <p className="form-error">{error}</p> : <div className="splash">Carregando…</div>;

  return (
    <div className="categories">
      <CategoryList type="expense" items={categories.filter((c) => c.type === 'expense')} onChange={load} />
      <CategoryList type="income" items={categories.filter((c) => c.type === 'income')} onChange={load} />
    </div>
  );
}
