export type TxType = 'income' | 'expense';

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface Category {
  id: number;
  name: string;
  type: TxType;
  budget_cents: number | null;
  tx_count: number;
}

export interface Transaction {
  id: number;
  description: string;
  amount_cents: number;
  date: string;
  category_id: number;
  category_name: string;
  type: TxType;
}

export interface MonthTotals {
  month: string;
  income: number;
  expense: number;
}

export interface CategorySpend {
  id: number;
  name: string;
  total: number;
  budget: number | null;
}

export interface Summary {
  month: string;
  income: number;
  expense: number;
  balance: number;
  previous: { income: number; expense: number };
  byCategory: CategorySpend[];
  history: MonthTotals[];
}

export interface TxInput {
  description: string;
  amountCents: number;
  date: string;
  categoryId: number;
}
