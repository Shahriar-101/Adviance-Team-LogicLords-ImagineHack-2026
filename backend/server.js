import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import stateRouter from './routes/state.js';
import clientsRouter from './routes/clients.js';
import aiRouter from './routes/ai.js';
import authRouter from './routes/auth.js';
import { AppError } from './lib/errors.js';
import { createRateLimiter } from './lib/rateLimit.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new AppError(403, 'CORS_DENIED', 'This origin is not allowed to call the Adviance backend.'));
  },
  methods: ['GET', 'POST', 'PUT'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  const configured = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'replace_with_your_gemini_key');
  res.json({ ok: true, service: 'Adviance backend', aiConfigured: configured, model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' });
});

app.use('/api/auth', authRouter);
app.use('/api/state', stateRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/ai', createRateLimiter({ windowMs: 60_000, max: 20 }), aiRouter);

app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Route not found.')));

app.use((error, _req, res, _next) => {
  const status = Number(error.status) || 500;
  if (status >= 500) console.error('[Adviance backend]', error);
  res.status(status).json({
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: status >= 500 && !error.message ? 'Unexpected server error.' : error.message,
      details: error.details || undefined,
    },
  });
});

app.listen(port, () => {
  console.log(`Adviance backend running on http://localhost:${port}`);
  console.log(`Gemini configured: ${Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'replace_with_your_gemini_key')}`);
});
