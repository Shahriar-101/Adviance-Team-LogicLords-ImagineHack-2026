import express from 'express';
import { asyncRoute, AppError } from '../lib/errors.js';
import { loginAdvisor, logoutAdvisor, registerAdvisor } from '../data/authStore.js';

const router = express.Router();

function requireText(value, label, min = 1) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length < min) throw new AppError(400, 'VALIDATION_ERROR', `${label} is required.`);
  return text;
}

router.post('/register', asyncRoute(async (req, res) => {
  const name = requireText(req.body?.name, 'Full name', 2);
  const email = requireText(req.body?.email, 'Email').toLowerCase();
  const password = requireText(req.body?.password, 'Password', 8);
  if (!email.includes('@')) throw new AppError(400, 'VALIDATION_ERROR', 'Enter a valid email address.');

  const session = await registerAdvisor({ name, email, password });
  res.status(201).json(session);
}));

router.post('/login', asyncRoute(async (req, res) => {
  const email = requireText(req.body?.email, 'Email').toLowerCase();
  const password = requireText(req.body?.password, 'Password');
  const session = await loginAdvisor({ email, password });
  res.json(session);
}));

router.post('/logout', asyncRoute(async (req, res) => {
  const token = typeof req.headers.authorization === 'string'
    ? req.headers.authorization.replace(/^Bearer\s+/i, '').trim()
    : '';
  if (token) await logoutAdvisor(token);
  res.json({ ok: true });
}));

export default router;
