import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import { useMonth } from '../month';
import { centsToInput, parseMoney, todayISO } from '../format';
import type { Category, Transaction, TxType } from '../types';

interface Props {
  tx?: Transaction;
  onClose: () => void;
  onSaved: () => void;
}

/** Cria ou edita um lançamento. */
export function TxModal({ tx, onClose, onSaved }: Props) {
  const { month } = useMonth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [type, setType] = useState<TxType>(tx?.type ?? 'expense');
  const [description, setDescription] = useState(tx?.description ?? '');
  const [amount, setAmount] = useState(tx ? centsToInput(tx.amount_cents) : '');
  const [date, setDate] = useState(() => tx?.date ?? (todayISO().startsWith(month) ? todayISO() : `${month}-01`));
  const [categoryId, setCategoryId] = useState<number | ''>(tx?.category_id ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listCategories().then(setCategories).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const options = categories.filter((c) => c.type === type);
  // Ao trocar o tipo, a categoria escolhida pode deixar de valer.
  const selected = options.some((c) => c.id === categoryId) ? categoryId : '';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const amountCents = parseMoney(amount);
    if (!amountCents) return setError('Informe um valor válido, ex.: 49,90');
    if (!selected) return setError('Escolha uma categoria');
    setBusy(true);
    setError('');
    try {
      const data = { description: description.trim(), amountCents, date, categoryId: selected };
      if (tx) await api.updateTransaction(tx.id, data);
      else await api.createTransaction(data);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" role="dialog" aria-modal="true" aria-label={tx ? 'Editar lançamento' : 'Novo lançamento'} onSubmit={handleSubmit}>
        <header className="modal__head">
          <h2>{tx ? 'Editar lançamento' : 'Novo lançamento'}</h2>
          <button type="button" className="icon-btn" aria-label="Fechar" onClick={onClose}>×</button>
        </header>

        <div className="segmented" role="radiogroup" aria-label="Tipo">
          {(['expense', 'income'] as TxType[]).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              className={`segmented__opt segmented__opt--${t} ${type === t ? 'is-active' : ''}`}
              onClick={() => setType(t)}
            >
              {t === 'expense' ? 'Despesa' : 'Receita'}
            </button>
          ))}
        </div>

        <label className="field">
          Valor
          <div className="money-input">
            <span>R$</span>
            <input
              inputMode="decimal"
              autoFocus
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
        </label>

        <label className="field">
          Descrição
          <input value={description} maxLength={80} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Mercado do mês" required />
        </label>

        <div className="field-row">
          <label className="field">
            Data
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label className="field">
            Categoria
            <select value={selected} onChange={(e) => setCategoryId(Number(e.target.value))} required>
              <option value="" disabled>Escolha…</option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}

        <footer className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn--primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
        </footer>
      </form>
    </div>
  );
}
