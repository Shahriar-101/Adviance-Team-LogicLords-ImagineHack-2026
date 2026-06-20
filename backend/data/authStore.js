import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppError } from '../lib/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authPath = path.join(__dirname, 'auth.json');
const clone = (value) => JSON.parse(JSON.stringify(value));

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, stored) {
  const candidate = crypto.scryptSync(password, stored.salt, 64);
  const expected = Buffer.from(stored.hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

async function ensureAuthStore() {
  try {
    await fs.access(authPath);
  } catch {
    const demo = hashPassword('adviance2026');
    const initial = {
      users: [{
        id: 'advisor_demo',
        name: 'Ahmad Rahman',
        email: 'ahmad@adviance.demo',
        password: demo,
        createdAt: '2026-06-20T00:00:00.000Z',
      }],
      sessions: [],
    };
    await fs.writeFile(authPath, JSON.stringify(initial, null, 2), 'utf8');
  }
}

async function readAuth() {
  await ensureAuthStore();
  return JSON.parse(await fs.readFile(authPath, 'utf8'));
}

async function saveAuth(next) {
  const temp = `${authPath}.tmp`;
  await fs.writeFile(temp, JSON.stringify(next, null, 2), 'utf8');
  await fs.rename(temp, authPath);
}

function createSession(state, user) {
  const token = crypto.randomBytes(32).toString('hex');
  state.sessions = Array.isArray(state.sessions) ? state.sessions : [];
  state.sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() });
  if (state.sessions.length > 40) state.sessions = state.sessions.slice(-40);
  return { token, user: { id: user.id, name: user.name, email: user.email } };
}

export async function registerAdvisor({ name, email, password }) {
  const state = await readAuth();
  if (state.users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
    throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists. Please sign in instead.');
  }
  const user = {
    id: `advisor_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    name,
    email,
    password: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  state.users.push(user);
  const session = createSession(state, user);
  await saveAuth(state);
  return clone(session);
}

export async function loginAdvisor({ email, password }) {
  const state = await readAuth();
  const user = state.users.find((item) => item.email.toLowerCase() === email.toLowerCase());
  if (!user || !verifyPassword(password, user.password)) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }
  const session = createSession(state, user);
  await saveAuth(state);
  return clone(session);
}

export async function logoutAdvisor(token) {
  const state = await readAuth();
  state.sessions = (state.sessions || []).filter((session) => session.token !== token);
  await saveAuth(state);
}
