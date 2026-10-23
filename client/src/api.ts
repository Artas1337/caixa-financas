import type { Category, Summary, Transaction, TxInput, TxType, User } from './types';

const TOKEN_KEY = 'caixa.token';

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* armazenamento indisponível: sessão dura só até recarregar */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* idem */
    }
  },
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const LOGOUT_EVENT = 'caixa:logout';

async function send(method: string, path: string, body?: unknown): Promise<Response> {
  const token = tokenStore.get();
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && !path.startsWith('/auth/login')) {
      tokenStore.clear();
      window.dispatchEvent(new Event(LOGOUT_EVENT));
    }
    throw new ApiError(res.status, data.error ?? 'Algo deu errado. Tente novamente.');
  }
  return res;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await send(method, path, body);
  return res.status === 204 ? (undefined as T) : res.json();
}

const qs = (params: Record<string, string | number | undefined>) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return entries.length ? '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString() : '';
};

export interface TxFilters {
  month?: string;
  type?: TxType;
  categoryId?: number;
  q?: string;
}

interface AuthResponse {
  token: string;
  user: User;
}

export const api = {
  register: (name: string, email: string, password: string) =>
    request<AuthResponse>('POST', '/auth/register', { name, email, password }),
  login: (email: string, password: string) => request<AuthResponse>('POST', '/auth/login', { email, password }),
  me: () => request<{ user: User }>('GET', '/auth/me'),

  summary: (month: string) => request<Summary>('GET', `/summary${qs({ month })}`),

  listTransactions: (f: TxFilters) => request<Transaction[]>('GET', `/transactions${qs({ ...f })}`),
  createTransaction: (data: TxInput) => request<Transaction>('POST', '/transactions', data),
  updateTransaction: (id: number, data: TxInput) => request<Transaction>('PATCH', `/transactions/${id}`, data),
  deleteTransaction: (id: number) => request<void>('DELETE', `/transactions/${id}`),

  /** Baixa o CSV (precisa do token, então não dá pra ser um link simples). */
  async exportCsv(f: TxFilters) {
    const res = await send('GET', `/transactions/export.csv${qs({ ...f })}`);
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement('a'), { href: url, download: `lancamentos-${f.month ?? 'todos'}.csv` });
    document.body.append(a);
    a.click();
    a.remove();
    // revogar na hora pode cancelar o download em alguns navegadores
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  listCategories: () => request<Category[]>('GET', '/categories'),
  createCategory: (name: string, type: TxType) => request<Category>('POST', '/categories', { name, type }),
  updateCategory: (id: number, data: { name?: string; budgetCents?: number | null }) =>
    request<Category>('PATCH', `/categories/${id}`, data),
  deleteCategory: (id: number) => request<void>('DELETE', `/categories/${id}`),
};
