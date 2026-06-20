import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(__dirname, 'seed.json');
const databasePath = path.join(__dirname, 'database.json');

const clone = (value) => JSON.parse(JSON.stringify(value));

async function ensureDatabase() {
  try {
    await fs.access(databasePath);
  } catch {
    const seed = await fs.readFile(seedPath, 'utf8');
    await fs.writeFile(databasePath, seed, 'utf8');
  }
}

function assertState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('Application state must be an object.');
  const requiredArrays = ['clients', 'meetings', 'followups', 'expenses', 'courses', 'partners', 'referrals'];
  for (const key of requiredArrays) {
    if (!Array.isArray(state[key])) throw new Error(`Application state is missing the ${key} list.`);
  }
  if (!state.user || typeof state.user !== 'object') throw new Error('Application state is missing the user profile.');
}

export async function getState() {
  await ensureDatabase();
  const content = await fs.readFile(databasePath, 'utf8');
  const state = JSON.parse(content);
  assertState(state);
  return clone(state);
}

export async function replaceState(nextState) {
  assertState(nextState);
  const tempPath = `${databasePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(nextState, null, 2), 'utf8');
  await fs.rename(tempPath, databasePath);
  return clone(nextState);
}

export async function resetState() {
  const seed = JSON.parse(await fs.readFile(seedPath, 'utf8'));
  return replaceState(seed);
}

export async function findClient(clientId) {
  const state = await getState();
  const client = state.clients.find((item) => item.id === clientId);
  return client ? clone(client) : null;
}

export async function appendClientNote(clientId, note) {
  const state = await getState();
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) return null;
  client.notes = Array.isArray(client.notes) ? client.notes : [];
  client.notes.push(note);
  client.lastContact = note.date;
  await replaceState(state);
  return clone(note);
}
