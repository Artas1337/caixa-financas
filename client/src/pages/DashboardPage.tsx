import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useMonth } from '../month';
import { monthLong } from '../format';
import { StatTile } from '../components/StatTile';
import { HistoryChart } from '../components/HistoryChart';
import { CategoryBars } from '../components/CategoryBars';
import { TxTable } from '../components/TxTable';
import type { Summary, Transaction } from '../types';

export function DashboardPage() {
  const { month, version } = useMonth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recent, setRecent] = useState<Transaction[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    Promise.all([api.summary(month), api.listTransactions({ month })])
      .then(([s, txs]) => {
        if (!alive) return;
        setSummary(s);
        setRecent(txs.slice(0, 6));
        setError('');
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [month, version]);

  if (error) return <p className="form-error">{error}</p>;
  if (!summary) return <div className="splash">Carregando…</div>;

  const prevBalance = summary.previous.income - summary.previous.expense;

  return (
    <div className="dashboard">
      <section className="stats">
        <StatTile hero label="Saldo do mês" value={summary.balance} previous={prevBalance} deltaAs="abs" />
        <StatTile label="Receitas" value={summary.income} previous={summary.previous.income} />
        <StatTile label="Despesas" value={summary.expense} previous={summary.previous.expense} upIsGood={false} />
      </section>

      <section className="panel panel--wide">
        <header className="panel__head">
          <h2>Últimos 6 meses</h2>
          <p className="muted">Toque ou passe o mouse sobre um mês para ver os valores</p>
        </header>
        <HistoryChart data={summary.history} current={month} />
      </section>

      <section className="panel">
        <header className="panel__head">
          <h2>Despesas por categoria</h2>
          <p className="muted">{monthLong(month)} · <Link to="/categorias" className="link">definir orçamentos</Link></p>
        </header>
        <CategoryBars data={summary.byCategory} />
      </section>

      <section className="panel">
        <header className="panel__head">
          <h2>Últimos lançamentos</h2>
          <Link to="/lancamentos" className="link">Ver todos →</Link>
        </header>
        <TxTable rows={recent} />
      </section>
    </div>
  );
}
