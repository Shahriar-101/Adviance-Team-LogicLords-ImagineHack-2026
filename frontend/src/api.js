const configuredBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '');
const API_BASE = configuredBase || '/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Request failed (${response.status}).`);
  }
  return payload;
}

export const api = {
  auth: {
    register: (payload) => request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
    login: (payload) => request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
    logout: (token) => request('/auth/logout', { method: 'POST', body: '{}', headers: token ? { Authorization: `Bearer ${token}` } : {} }),
  },
  health: () => request('/health'),
  getState: async () => (await request('/state')).state,
  saveState: async (state) => (await request('/state', { method: 'PUT', body: JSON.stringify(state) })).state,
  resetState: async () => (await request('/state/reset', { method: 'POST' })).state,
  addClientNote: (clientId, text, date) => request(`/clients/${encodeURIComponent(clientId)}/notes`, { method: 'POST', body: JSON.stringify({ text, date }) }),
  ai: {
    courseRecommendation: () => request('/ai/course-recommendation', { method: 'POST', body: '{}' }),
    partnerMatch: ({ clientId, category }) => request('/ai/partner-match', { method: 'POST', body: JSON.stringify({ clientId, category }) }),
    preMeetingBrief: (clientId) => request('/ai/pre-meeting-brief', { method: 'POST', body: JSON.stringify({ clientId }) }),
    organizeMeetingNotes: ({ clientId, rawNotes }) => request('/ai/organize-meeting-notes', { method: 'POST', body: JSON.stringify({ clientId, rawNotes }) }),
    learningQuestion: (question) => request('/ai/learning-question', { method: 'POST', body: JSON.stringify({ question }) }),
  },
};
