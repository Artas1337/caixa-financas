import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/db.js';
import { shiftMonth } from '../src/transactions.js';

let app: Express;
let auth: Record<string, string>;
let cats: { id: number; name: string; type: string }[];

const catId = (name: string) => cats.find((c) => c.name === name)!.id;

async function signUp(email = 'ana@teste.com') {
  const res = await request(app).post('/api/auth/register').send({ name: 'Ana', email, password: 'segredo123' });
  return { Authorization: `Bearer ${res.body.token}` };
}

const addTx = (description: string, amountCents: number, date: string, category: string, headers = auth) =>
  request(app).post('/api/transactions').set(headers).send({ description, amountCents, date, categoryId: catId(category) });

beforeEach(async () => {
  app = createApp(openDatabase(':memory:'));
  auth = await signUp();
  cats = (await request(app).get('/api/categories').set(auth)).body;
});

describe('utilitários', () => {
  it('desloca meses atravessando o ano', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-10', -5)).toBe('2026-05');
  });
});

describe('categorias', () => {
  it('cria categorias padrão no cadastro', () => {
    expect(cats.filter((c) => c.type === 'income')).toHaveLength(3);
    expect(cats.filter((c) => c.type === 'expense')).toHaveLength(7);
  });

  it('não permite nome duplicado nem excluir categoria em uso', async () => {
    const dup = await request(app).post('/api/categories').set(auth).send({ name: 'Lazer', type: 'expense' });
    expect(dup.status).toBe(409);

    await addTx('Cinema', 4000, '2026-10-03', 'Lazer');
    const del = await request(app).delete(`/api/categories/${catId('Lazer')}`).set(auth);
    expect(del.status).toBe(409);
    expect((await request(app).delete(`/api/categories/${catId('Saúde')}`).set(auth)).status).toBe(204);
  });

  it('define orçamento só para despesas', async () => {
    const res = await request(app).patch(`/api/categories/${catId('Alimentação')}`).set(auth).send({ budgetCents: 80000 });
    expect(res.body.budget_cents).toBe(80000);
    const inc = await request(app).patch(`/api/categories/${catId('Salário')}`).set(auth).send({ budgetCents: 100 });
    expect(inc.body.budget_cents).toBeNull();
  });
});

describe('lançamentos', () => {
  it('valida dados de entrada', async () => {
    const bad = await request(app)
      .post('/api/transactions')
      .set(auth)
      .send({ description: '', amountCents: -5, date: '2026-02-30', categoryId: catId('Lazer') });
    expect(bad.status).toBe(400);
    expect(Object.keys(bad.body.details).sort()).toEqual(['amountCents', 'date', 'description']);
  });

  it('filtra por mês, tipo, categoria e texto', async () => {
    await addTx('Salário outubro', 500000, '2026-10-05', 'Salário');
    await addTx('Mercado', 35000, '2026-10-06', 'Alimentação');
    await addTx('Uber', 2500, '2026-10-31', 'Transporte');
    await addTx('Mercado setembro', 30000, '2026-09-30', 'Alimentação');

    const list = (qs: string) => request(app).get(`/api/transactions?${qs}`).set(auth).then((r) => r.body.map((t: { description: string }) => t.description));

    expect(await list('month=2026-10')).toEqual(['Uber', 'Mercado', 'Salário outubro']);
    expect(await list('month=2026-10&type=expense')).toEqual(['Uber', 'Mercado']);
    expect(await list(`categoryId=${catId('Alimentação')}`)).toEqual(['Mercado', 'Mercado setembro']);
    expect(await list('q=mercado')).toHaveLength(2);
  });

  it('isola dados entre usuários', async () => {
    const tx = (await addTx('Mercado', 35000, '2026-10-06', 'Alimentação')).body;
    const other = await signUp('bia@teste.com');
    expect((await request(app).get('/api/transactions').set(other)).body).toEqual([]);
    expect((await request(app).delete(`/api/transactions/${tx.id}`).set(other)).status).toBe(404);
    // Bia não pode usar categoria da Ana
    expect((await addTx('x', 100, '2026-10-01', 'Lazer', other)).status).toBe(404);
  });

  it('exporta CSV com sinal e vírgula decimal', async () => {
    await addTx('Salário', 500000, '2026-10-05', 'Salário');
    await addTx('Pizza "grande"', 5990, '2026-10-06', 'Alimentação');
    const res = await request(app).get('/api/transactions/export.csv?month=2026-10').set(auth);
    expect(res.headers['content-type']).toContain('text/csv');
    const lines = res.text.replace('﻿', '').split('\r\n');
    expect(lines).toEqual([
      'data;descricao;categoria;tipo;valor',
      '2026-10-06;"Pizza ""grande""";"Alimentação";despesa;-59,90',
      '2026-10-05;"Salário";"Salário";receita;5000,00',
    ]);
  });
});

describe('resumo', () => {
  it('soma o mês, compara com o anterior e monta histórico de 6 meses', async () => {
    await request(app).patch(`/api/categories/${catId('Lazer')}`).set(auth).send({ budgetCents: 20000 });
    await addTx('Salário', 500000, '2026-10-05', 'Salário');
    await addTx('Aluguel', 150000, '2026-10-10', 'Moradia');
    await addTx('Mercado', 40000, '2026-10-12', 'Alimentação');
    await addTx('Salário', 480000, '2026-09-05', 'Salário');
    await addTx('Mercado', 30000, '2026-09-12', 'Alimentação');

    const { body } = await request(app).get('/api/summary?month=2026-10').set(auth);
    expect(body).toMatchObject({ month: '2026-10', income: 500000, expense: 190000, balance: 310000 });
    expect(body.previous).toEqual({ income: 480000, expense: 30000 });
    expect(body.byCategory.map((c: { name: string; total: number }) => [c.name, c.total])).toEqual([
      ['Moradia', 150000],
      ['Alimentação', 40000],
      ['Lazer', 0],
    ]);
    expect(body.history.map((h: { month: string }) => h.month)).toEqual([
      '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10',
    ]);
    expect(body.history[4]).toEqual({ month: '2026-09', income: 480000, expense: 30000 });
  });

  it('rejeita mês inválido', async () => {
    expect((await request(app).get('/api/summary?month=2026-13').set(auth)).status).toBe(400);
  });
});
