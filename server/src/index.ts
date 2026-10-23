import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createApp } from './app.js';
import { openDatabase } from './db.js';

const PORT = Number(process.env.API_PORT ?? 3334);
const DB_FILE = process.env.DB_FILE ?? 'data/caixa.db';

if (DB_FILE !== ':memory:') mkdirSync(dirname(DB_FILE), { recursive: true });

const app = createApp(openDatabase(DB_FILE));
app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});
