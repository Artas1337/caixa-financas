import { Router } from 'express';
import { z } from 'zod';
import type { DB } from './db.js';
import { HttpError, notFound } from './errors.js';
import { requireAuth } from './auth.js';

export type TxType = 'income' | 'expense';

export interface Category {
  id: number;
  user_id: number;
  name: string;
  type: TxType;
  budget_cents: number | null;
}

const DEFAULTS: [string, TxType][] = [
  ['Salário', 'income'],
  ['Freelance', 'income'],
  ['Outras receitas', 'income'],
  ['Moradia', 'expense'],
  ['Alimentação', 'expense'],
  ['Transporte', 'expense'],
  ['Saúde', 'expense'],
  ['Educação', 'expense'],
  ['Lazer', 'expense'],
  ['Outras despesas', 'expense'],
];

export function seedCategories(db: DB, userId: number) {
  const insert = db.prepare('INSERT INTO categories (user_id, name, type) VALUES (?, ?, ?)');
  for (const [name, type] of DEFAULTS) insert.run(userId, name, type);
}

export function findCategory(db: DB, id: number, userId: number) {
  const row = db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').get(id, userId);
  if (!row) throw notFound('Categoria');
  return row as unknown as Category;
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(40),
  type: z.enum(['income', 'expense']),
  budgetCents: z.number().int().positive().nullable().optional(),
});
const updateSchema = createSchema.omit({ type: true }).partial();

export function categoriesRouter(db: DB) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    const rows = db
      .prepare(
        `SELECT c.*, (SELECT COUNT(*) FROM transactions t WHERE t.category_id = c.id) AS tx_count
         FROM categories c WHERE c.user_id = ? ORDER BY c.type DESC, c.name`,
      )
      .all(req.userId);
    res.json(rows);
  });

  router.post('/', (req, res) => {
    const data = createSchema.parse(req.body);
    try {
      const { lastInsertRowid } = db
        .prepare('INSERT INTO categories (user_id, name, type, budget_cents) VALUES (?, ?, ?, ?)')
        .run(req.userId, data.name, data.type, data.type === 'expense' ? (data.budgetCents ?? null) : null);
      res.status(201).json(findCategory(db, Number(lastInsertRowid), req.userId));
    } catch (err) {
      if (String(err).includes('UNIQUE')) throw new HttpError(409, 'Já existe uma categoria com esse nome');
      throw err;
    }
  });

  router.patch('/:id', (req, res) => {
    const cat = findCategory(db, Number(req.params.id), req.userId);
    const data = updateSchema.parse(req.body);
    const name = data.name ?? cat.name;
    const budget = cat.type === 'expense' && data.budgetCents !== undefined ? data.budgetCents : cat.budget_cents;
    try {
      db.prepare('UPDATE categories SET name = ?, budget_cents = ? WHERE id = ?').run(name, budget, cat.id);
    } catch (err) {
      if (String(err).includes('UNIQUE')) throw new HttpError(409, 'Já existe uma categoria com esse nome');
      throw err;
    }
    res.json(findCategory(db, cat.id, req.userId));
  });

  router.delete('/:id', (req, res) => {
    const cat = findCategory(db, Number(req.params.id), req.userId);
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM transactions WHERE category_id = ?').get(cat.id) as { n: number };
    if (n > 0) throw new HttpError(409, `Categoria possui ${n} lançamento(s). Mova ou exclua-os antes.`);
    db.prepare('DELETE FROM categories WHERE id = ?').run(cat.id);
    res.status(204).end();
  });

  return router;
}
