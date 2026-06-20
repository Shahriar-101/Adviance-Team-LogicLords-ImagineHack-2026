import express from 'express';
import { getState, replaceState, resetState } from '../data/store.js';
import { asyncRoute, AppError } from '../lib/errors.js';

const router = express.Router();

router.get('/', asyncRoute(async (_req, res) => {
  res.json({ state: await getState() });
}));

router.put('/', asyncRoute(async (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'A complete application state object is required.');
  }
  const state = await replaceState(req.body);
  res.json({ state });
}));

router.post('/reset', asyncRoute(async (_req, res) => {
  res.json({ state: await resetState() });
}));

export default router;
