import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';
import { useMonth } from '../month';
import { monthLong, shiftMonth } from '../format';
import { Logo } from './Logo';
import { TxModal } from './TxModal';

const NAV = [
  { to: '/', label: 'Painel', end: true },
  { to: '/lancamentos', label: 'Lançamentos' },
  { to: '/categorias', label: 'Categorias' },
];

const TITLES: Record<string, string> = {
  '/': 'Painel',
  '/lancamentos': 'Lançamentos',
  '/categorias': 'Categorias',
};

export function Shell() {
  const { user, logout } = useAuth();
  const { month, setMonth, bump } = useMonth();
  const { pathname } = useLocation();
  const [creating, setCreating] = useState(false);
  const showMonth = pathname !== '/categorias';

  return (
    <div className="shell">
      <aside className="sidebar">
        <Logo />
        <nav className="nav">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="nav__link">
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__user">
          <div>
            <strong>{user?.name}</strong>
            <span className="muted">{user?.email}</span>
          </div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={logout}>Sair</button>
        </div>
      </aside>

      <div className="main">
        <header className="page-head">
          <h1>{TITLES[pathname] ?? 'Caixa'}</h1>
          {showMonth && (
            <div className="month-picker" role="group" aria-label="Mês">
              <button type="button" className="icon-btn" aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
              <span>{monthLong(month)}</span>
              <button type="button" className="icon-btn" aria-label="Próximo mês" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
            </div>
          )}
          <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
            + Novo lançamento
          </button>
        </header>

        <Outlet />
      </div>

      {creating && (
        <TxModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            bump();
          }}
        />
      )}
    </div>
  );
}
