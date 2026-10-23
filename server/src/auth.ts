import { Router, type RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { DB } from './db.js';
import { HttpError } from './errors.js';
import { seedCategories } from './categories.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-caixa-troque-em-producao';
const TOKEN_TTL = '7d';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId: number;
    }
  }
}

interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
}

const registerSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6).max(100),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const signToken = (userId: number) => jwt.sign({ sub: String(userId) }, JWT_SECRET, { expiresIn: TOKEN_TTL });
const publicUser = (u: UserRow) => ({ id: u.id, name: u.name, email: u.email });

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Token ausente');
  try {
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    req.userId = Number(payload.sub);
    next();
  } catch {
    throw new HttpError(401, 'Token inválido ou expirado');
  }
};

export function authRouter(db: DB) {
  const router = Router();

  router.post('/register', (req, res) => {
    const data = registerSchema.parse(req.body);
    const exists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(data.email);
    if (exists) throw new HttpError(409, 'E-mail já cadastrado');

    const hash = bcrypt.hashSync(data.password, 10);
    const { lastInsertRowid } = db
      .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
      .run(data.name, data.email, hash);
    seedCategories(db, Number(lastInsertRowid));
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid) as unknown as UserRow;

    res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
  });

  router.post('/login', (req, res) => {
    const data = loginSchema.parse(req.body);
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(data.email) as unknown as UserRow | undefined;
    if (!user || !bcrypt.compareSync(data.password, user.password_hash)) {
      throw new HttpError(401, 'E-mail ou senha incorretos');
    }
    res.json({ token: signToken(user.id), user: publicUser(user) });
  });

  router.get('/me', requireAuth, (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as unknown as UserRow | undefined;
    if (!user) throw new HttpError(401, 'Usuário não existe mais');
    res.json({ user: publicUser(user) });
  });

  return router;
}
