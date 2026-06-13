// js/api.js — Centralized API client
// All API calls go through this module. Provides consistent error handling
// and headers. Exposes functions globally for use by dashboard.js and whiteboard.js.

// Get API base URL (works for both same-domain and separate deployments)
const API_BASE = (() => {
  if (typeof process !== 'undefined' && process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  // Default to current origin if on same domain, otherwise use production URL
  return window.location.origin;
})();

const apiFetch = async (url, options = {}) => {
  // If url starts with '/', prepend API_BASE
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
  
  const res = await fetch(fullUrl, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    throw new Error(
      (await res.text().catch(() => res.statusText)) || `HTTP ${res.status}`
    );
  }
  if (res.status === 204) return null;
  return res.json();
};

// ── Problems API ──
const PROBLEMS_BASE = '/api/problems';

const apiProblems = {
  getAll:         ()         => apiFetch(PROBLEMS_BASE),
  create:         (body)     => apiFetch(PROBLEMS_BASE,             { method: 'POST',   body: JSON.stringify(body) }),
  update:         (id, body) => apiFetch(`${PROBLEMS_BASE}/${id}`,  { method: 'PUT',    body: JSON.stringify(body) }),
  remove:         (id)       => apiFetch(`${PROBLEMS_BASE}/${id}`,  { method: 'DELETE' }),
};

// ── Codeforces API (Phase 1) ──
const CF_BASE = '/api/codeforces';

const apiCodeforces = {
  getProfile:     ()         => apiFetch(CF_BASE + '/profile'),
  connect:        (handle)   => apiFetch(CF_BASE + '/connect',      { method: 'POST',   body: JSON.stringify({ handle }) }),
  sync:           ()         => apiFetch(CF_BASE + '/sync',         { method: 'POST' }),
  disconnect:     ()         => apiFetch(CF_BASE + '/disconnect',   { method: 'DELETE' }),
};

// ── Analytics API (Phase 2) ──
const ANALYTICS_BASE = '/api/analytics';

const apiAnalytics = {
  ratingHistory:  ()         => apiFetch(ANALYTICS_BASE + '/rating-history'),
  tagDistribution:()         => apiFetch(ANALYTICS_BASE + '/tag-distribution'),
  ratingDistribution:()      => apiFetch(ANALYTICS_BASE + '/rating-distribution'),
  heatmap:        (year)     => apiFetch(ANALYTICS_BASE + `/heatmap${year ? `?year=${year}` : ''}`),
  weeklySummary:  ()         => apiFetch(ANALYTICS_BASE + '/weekly-summary'),
};

// ── Weakness API (Phase 3) ──
const apiWeaknesses = {
  get:            ()         => apiFetch('/api/weaknesses'),
};

// ── Recommendations API (Phase 4) ──
const apiRecommendations = {
  get:            (params)   => apiFetch(`/api/recommendations?${new URLSearchParams(params).toString()}`),
};

// ── Training API (Phase 5) ──
const TRAINING_BASE = '/api/training';

const apiTraining = {
  today:          ()         => apiFetch(TRAINING_BASE + '/today'),
  complete:       ()         => apiFetch(TRAINING_BASE + '/today/complete', { method: 'POST' }),
  calendar:       (month)    => apiFetch(TRAINING_BASE + `/calendar?month=${month}`),
};

// ── Expose globally for classic scripts (dashboard.js, whiteboard.js) ──
window.apiFetch    = apiFetch;
window.apiProblems = apiProblems;
window.apiCodeforces = apiCodeforces;
window.apiAnalytics = apiAnalytics;
window.apiWeaknesses = apiWeaknesses;
window.apiRecommendations = apiRecommendations;
window.apiTraining = apiTraining;

// Legacy compatibility (whiteboard.js uses window.apiPut)
window.apiPut = apiProblems.update;
