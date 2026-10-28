import { Router } from 'express';
import { z } from 'zod';
import type { DB } from './db.js';
import { notFound } from './errors.js';
import { requireAuth } from './auth.js';
import { findCategory } from './categories.js';

// ---------- Utilitários de mês ("2026-10") ----------

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use o formato AAAA-MM');

/** "2026-01-31" + 1 mês → "2026-02-28" (ajusta para o último dia quando o mês é mais curto). */
export function nextMonthSameDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return `${shiftMonth(date.slice(0, 7), 1)}-${String(Math.min(d, lastDay)).padStart(2, '0')}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

/** Intervalo [início, fim) em datas ISO, para usar o índice em `date`. */
const monthRange = (month: string) => [`${month}-01`, `${shiftMonth(month, 1)}-01`] as const;

/** Data de hoje no fuso local ("2026-10-22"); toISOString() usaria UTC e viraria o dia às 21h no Brasil. */
export function todayLocal(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const currentMonth = () => todayLocal().slice(0, 7);

// ---------- Schemas ----------

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().startsWith(s), 'Data inválida');

const txSchema = z.object({
  description: z.string().trim().min(1).max(80),
  amountCents: z.number().int().positive().max(1_000_000_000_00),
  date: isoDate,
  categoryId: z.number().int().positive(),
});

const listQuery = z.object({
  month: monthSchema.optional(),
  type: z.enum(['income', 'expense']).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(80).optional(),
});

interface TxRow {
  id: number;
  description: string;
  amount_cents: number;
  date: string;
  category_id: number;
  category_name: string;
  type: 'income' | 'expense';
}

const SELECT_TX = `
  SELECT t.id, t.description, t.amount_cents, t.date, t.category_id,
         c.name AS category_name, c.type
  FROM transactions t JOIN categories c ON c.id = t.category_id`;

export function transactionsRouter(db: DB) {
  const router = Router();
  router.use(requireAuth);

  const findTx = (id: number, userId: number) => {
    const row = db.prepare(`${SELECT_TX} WHERE t.id = ? AND t.user_id = ?`).get(id, userId);
    if (!row) throw notFound('Lançamento');
    return row as unknown as TxRow;
  };

  const listTx = (userId: number, query: z.infer<typeof listQuery>) => {
    const where = ['t.user_id = ?'];
    const params: (string | number)[] = [userId];
    if (query.month) {
      where.push('t.date >= ? AND t.date < ?');
      params.push(...monthRange(query.month));
    }
    if (query.type) {
      where.push('c.type = ?');
      params.push(query.type);
    }
    if (query.categoryId) {
      where.push('t.category_id = ?');
      params.push(query.categoryId);
    }
    if (query.q) {
      where.push('t.description LIKE ?');
      params.push(`%${query.q}%`);
    }
    return db
      .prepare(`${SELECT_TX} WHERE ${where.join(' AND ')} ORDER BY t.date DESC, t.id DESC`)
      .all(...params) as unknown as TxRow[];
  };

  router.get('/transactions', (req, res) => {
    res.json(listTx(req.userId, listQuery.parse(req.query)));
  });

  router.get('/transactions/export.csv', (req, res) => {
    const query = listQuery.parse(req.query);
    const rows = listTx(req.userId, query);
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = [
      'data;descricao;categoria;tipo;valor',
      ...rows.map((r) =>
        [
          r.date,
          esc(r.description),
          esc(r.category_name),
          r.type === 'income' ? 'receita' : 'despesa',
          ((r.type === 'income' ? 1 : -1) * r.amount_cents / 100).toFixed(2).replace('.', ','),
        ].join(';'),
      ),
    ];
    res
      .type('text/csv; charset=utf-8')
      .attachment(`lancamentos-${query.month ?? 'todos'}.csv`)
      .send('﻿' + lines.join('\r\n')); // BOM: Excel abre acentos corretamente
  });

  router.post('/transactions', (req, res) => {
    const data = txSchema.parse(req.body);
    findCategory(db, data.categoryId, req.userId);
    const { lastInsertRowid } = db
      .prepare('INSERT INTO transactions (user_id, category_id, description, amount_cents, date) VALUES (?, ?, ?, ?, ?)')
      .run(req.userId, data.categoryId, data.description, data.amountCents, data.date);
    res.status(201).json(findTx(Number(lastInsertRowid), req.userId));
  });

  router.patch('/transactions/:id', (req, res) => {
    const tx = findTx(Number(req.params.id), req.userId);
    const data = txSchema.partial().parse(req.body);
    if (data.categoryId) findCategory(db, data.categoryId, req.userId);
    db.prepare('UPDATE transactions SET description = ?, amount_cents = ?, date = ?, category_id = ? WHERE id = ?').run(
      data.description ?? tx.description,
      data.amountCents ?? tx.amount_cents,
      data.date ?? tx.date,
      data.categoryId ?? tx.category_id,
      tx.id,
    );
    res.json(findTx(tx.id, req.userId));
  });

  /** Repete o lançamento no mês seguinte — útil para contas fixas (aluguel, assinaturas). */
  router.post('/transactions/:id/repeat', (req, res) => {
    const tx = findTx(Number(req.params.id), req.userId);
    const { lastInsertRowid } = db
      .prepare('INSERT INTO transactions (user_id, category_id, description, amount_cents, date) VALUES (?, ?, ?, ?, ?)')
      .run(req.userId, tx.category_id, tx.description, tx.amount_cents, nextMonthSameDay(tx.date));
    res.status(201).json(findTx(Number(lastInsertRowid), req.userId));
  });

  router.delete('/transactions/:id', (req, res) => {
    const tx = findTx(Number(req.params.id), req.userId);
    db.prepare('DELETE FROM transactions WHERE id = ?').run(tx.id);
    res.status(204).end();
  });

  // ---------- Resumo do mês para o painel ----------

  router.get('/summary', (req, res) => {
    const month = monthSchema.optional().parse(req.query.month) ?? currentMonth();

    const totals = (m: string) => {
      const row = db
        .prepare(
          `SELECT
             COALESCE(SUM(CASE WHEN c.type = 'income'  THEN t.amount_cents END), 0) AS income,
             COALESCE(SUM(CASE WHEN c.type = 'expense' THEN t.amount_cents END), 0) AS expense
           FROM transactions t JOIN categories c ON c.id = t.category_id
           WHERE t.user_id = ? AND t.date >= ? AND t.date < ?`,
        )
        .get(req.userId, ...monthRange(m)) as { income: number; expense: number };
      return { month: m, income: row.income, expense: row.expense };
    };

    const current = totals(month);
    const previous = totals(shiftMonth(month, -1));
    const history = Array.from({ length: 6 }, (_, i) => totals(shiftMonth(month, i - 5)));

    // Despesas por categoria no mês (inclui categorias com orçamento mesmo sem gasto).
    const byCategory = db
      .prepare(
        `SELECT c.id, c.name, c.budget_cents AS budget,
                COALESCE(SUM(t.amount_cents), 0) AS total
         FROM categories c
         LEFT JOIN transactions t ON t.category_id = c.id AND t.date >= ? AND t.date < ?
         WHERE c.user_id = ? AND c.type = 'expense'
         GROUP BY c.id
         HAVING total > 0 OR c.budget_cents IS NOT NULL
         ORDER BY total DESC, c.name`,
      )
      .all(...monthRange(month), req.userId);

    res.json({
      month,
      income: current.income,
      expense: current.expense,
      balance: current.income - current.expense,
      previous: { income: previous.income, expense: previous.expense },
      byCategory,
      history,
    });
  });

  return router;
}
