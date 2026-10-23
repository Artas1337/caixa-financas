/**
 * Popula o banco com um usuário de demonstração e 6 meses de lançamentos.
 * Uso: npm run seed   →   login: demo@caixa.test / demo123
 */
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import bcrypt from 'bcryptjs';
import { openDatabase, transaction } from './db.js';
import { seedCategories } from './categories.js';
import { shiftMonth } from './transactions.js';

const DB_FILE = process.env.DB_FILE ?? 'data/caixa.db';
const EMAIL = 'demo@caixa.test';

mkdirSync(dirname(DB_FILE), { recursive: true });
const db = openDatabase(DB_FILE);

// Gerador pseudoaleatório determinístico: o seed gera sempre os mesmos dados.
let state = 42;
const rand = () => ((state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const vary = (base: number, pct: number) => Math.round(base * (1 + (rand() * 2 - 1) * pct));

transaction(db, () => {
  db.prepare('DELETE FROM users WHERE email = ?').run(EMAIL);
  const { lastInsertRowid } = db
    .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
    .run('Demo', EMAIL, bcrypt.hashSync('demo123', 10));
  const userId = Number(lastInsertRowid);
  seedCategories(db, userId);

  const cat = (name: string) =>
    (db.prepare('SELECT id FROM categories WHERE user_id = ? AND name = ?').get(userId, name) as { id: number }).id;
  db.prepare('UPDATE categories SET budget_cents = ? WHERE id = ?').run(90000, cat('Alimentação'));
  db.prepare('UPDATE categories SET budget_cents = ? WHERE id = ?').run(25000, cat('Lazer'));
  db.prepare('UPDATE categories SET budget_cents = ? WHERE id = ?').run(30000, cat('Transporte'));

  const insert = db.prepare(
    'INSERT INTO transactions (user_id, category_id, description, amount_cents, date) VALUES (?, ?, ?, ?, ?)',
  );
  const add = (month: string, day: number, desc: string, category: string, cents: number) =>
    insert.run(userId, cat(category), desc, cents, `${month}-${String(day).padStart(2, '0')}`);

  const now = new Date().toISOString().slice(0, 7);
  for (let i = 5; i >= 0; i--) {
    const m = shiftMonth(now, -i);
    add(m, 5, 'Bolsa de estágio', 'Salário', 220000);
    if (rand() > 0.4) add(m, 18, 'Projeto freelance', 'Freelance', vary(60000, 0.5));
    add(m, 10, 'Aluguel (dividido)', 'Moradia', 70000);
    add(m, 12, 'Internet', 'Moradia', 9990);
    for (let w = 0; w < 4; w++) add(m, 3 + w * 7, 'Mercado', 'Alimentação', vary(19000, 0.3));
    add(m, 15, 'Restaurante', 'Alimentação', vary(6500, 0.4));
    add(m, 2, 'Recarga do cartão de transporte', 'Transporte', 22000);
    if (rand() > 0.5) add(m, 21, 'Uber', 'Transporte', vary(4500, 0.5));
    add(m, 8, 'Curso online', 'Educação', 4990);
    add(m, 20, 'Cinema e lanche', 'Lazer', vary(12000, 0.6));
    if (rand() > 0.6) add(m, 25, 'Farmácia', 'Saúde', vary(8000, 0.5));
  }
});

console.log(`Seed concluído em ${DB_FILE} — login: ${EMAIL} / demo123`);
