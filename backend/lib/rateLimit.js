import { AppError } from './errors.js';

export function createRateLimiter({ windowMs = 60_000, max = 20 } = {}) {
  const hits = new Map();
  return (req, _res, next) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = hits.get(key) || { startedAt: now, count: 0 };
    if (now - entry.startedAt > windowMs) {
      entry.startedAt = now;
      entry.count = 0;
    }
    entry.count += 1;
    hits.set(key, entry);
    if (entry.count > max) return next(new AppError(429, 'RATE_LIMITED', 'Too many AI requests. Please wait a minute and try again.'));
    next();
  };
}
