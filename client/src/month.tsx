import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface MonthContextValue {
  month: string;
  setMonth: (m: string) => void;
  /** Muda sempre que um lançamento é criado/editado — as páginas recarregam ao observar isso. */
  version: number;
  bump: () => void;
}

const MonthContext = createContext<MonthContextValue | null>(null);

export function MonthProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const value = useMemo(() => ({ month, setMonth, version, bump }), [month, version, bump]);
  return <MonthContext.Provider value={value}>{children}</MonthContext.Provider>;
}

export function useMonth() {
  const ctx = useContext(MonthContext);
  if (!ctx) throw new Error('useMonth precisa estar dentro de <MonthProvider>');
  return ctx;
}
