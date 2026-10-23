import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { MonthProvider } from './month';
import { Shell } from './components/Shell';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { CategoriesPage } from './pages/CategoriesPage';

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="splash">Carregando…</div>;
  return user ? children : <Navigate to="/login" replace />;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="splash">Carregando…</div>;
  return user ? <Navigate to="/" replace /> : children;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<GuestOnly><AuthPage /></GuestOnly>} />
          <Route
            element={
              <Protected>
                <MonthProvider>
                  <Shell />
                </MonthProvider>
              </Protected>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="lancamentos" element={<TransactionsPage />} />
            <Route path="categorias" element={<CategoriesPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
