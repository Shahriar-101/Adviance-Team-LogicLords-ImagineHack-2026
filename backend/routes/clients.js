import express from 'express';
import { appendClientNote, findClient } from '../data/store.js';
import { asyncRoute, AppError } from '../lib/errors.js';
import { dateSchema, idSchema, noteBodySchema, parseOrThrow } from '../lib/validation.js';

const router = express.Router();

router.post('/:clientId/notes', asyncRoute(async (req, res) => {
  const clientId = parseOrThrow(idSchema, req.params.clientId);
  const body = parseOrThrow(noteBodySchema, req.body);
  const client = await findClient(clientId);
  if (!client) throw new AppError(404, 'CLIENT_NOT_FOUND', 'The selected client could not be found.');

  const date = body.date || new Date().toISOString().slice(0, 10);
  parseOrThrow(dateSchema, date);
  const note = { date, text: body.text };
  await appendClientNote(clientId, note);
  res.status(201).json({ note });
}));

export default router;
