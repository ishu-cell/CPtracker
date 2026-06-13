// js/pages/dashboard.js — Dashboard page logic
// Extracted from inline <script> in index.html. Manages problem CRUD, cards, filters, and stats.

let problems = [];
let activeFilter = 'all';
let searchQuery  = '';

/* Toast */
let toastTimer;
const toast = (msg, error = false) => {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'show' + (error ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 2800);
};

window.toast = toast;

/* Stats */
const updateStats = () => {
  document.getElementById('stat-total').textContent  = problems.length;
  document.getElementById('stat-solved').textContent = problems.filter(p => p.status === 'solved').length;
  document.getElementById('stat-cm').textContent     = problems.filter(p => (p.rating||0) >= 1900).length;
};

/* Helpers */
const platformClass = p => ({ Codeforces:'cf', LeetCode:'lc', AtCoder:'ac' }[p] || 'ot');
const escHtml = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const getId   = p => p._id || p.id;

/* Build card */
const buildCard = prob => {
  const isCM     = (prob.rating||0) >= 1900;
  const isSolved = prob.status === 'solved';
  const platform = prob.platform || 'Other';

  const card = document.createElement('article');
  card.className    = `card${isCM ? ' cm-tier' : ''}`;
  card.dataset.id   = getId(prob);
  card.dataset.platform = platform;

  card.innerHTML = `
    <div class="card-header">
      <h3 class="card-title title-edit" title="Click to edit title">
        ${escHtml(prob.title)}
        <span class="edit-hint">✎</span>
      </h3>
      <div class="card-actions">
        <button class="btn-icon btn-draw" title="Open Whiteboard">🖍️</button>
        <button class="btn-icon btn-delete" title="Delete" aria-label="Delete problem">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="card-meta">
      <span class="badge badge-platform-${platformClass(platform)} platform-edit" title="Click to edit platform">${escHtml(platform)}</span>
      ${prob.rating
        ? `<span class="badge-rating rating-edit${isCM?' cm':''}" title="Click to edit rating">⚡ ${prob.rating}</span>`
        : `<span class="badge-rating rating-edit" style="opacity:.55" title="Click to add rating">+ rating</span>`}
      ${isCM ? `<span class="cm-badge">★ CM</span>` : ''}
    </div>

    <div class="card-footer">
      <div class="status-row">
        <div class="status-dot ${isSolved?'solved':'attempted'}"></div>
        <span class="status-text">${isSolved ? 'Solved' : 'Attempted'}</span>
      </div>
      <button class="btn-toggle ${isSolved?'solved':'attempted'}" data-action="toggle">
        ${isSolved ? '✓ Attempted' : '→ Solved'}
      </button>
    </div>
  `;

  card.querySelector('.btn-delete').addEventListener('click', () => handleDelete(prob, card));
  card.querySelector('[data-action="toggle"]').addEventListener('click', () => handleToggle(prob, card));
  card.querySelector('.rating-edit').addEventListener('click', () => handleField(prob, 'rating'));
  card.querySelector('.title-edit').addEventListener('click', () => handleField(prob, 'title'));
  card.querySelector('.platform-edit').addEventListener('click', () => handleField(prob, 'platform'));

  card.querySelector('.btn-draw').addEventListener('click', () => {
    if(window.openWhiteboard) window.openWhiteboard(prob);
  });

  return card;
};

/* Render */
const render = () => {
  const grid = document.getElementById('problems-grid');
  grid.innerHTML = '';
  const q = searchQuery.toLowerCase();

  const visible = problems.filter(p => {
    const mf = activeFilter === 'all' ? true
             : activeFilter === 'cm'  ? (p.rating||0) >= 1900
             : p.status === activeFilter;
    const ms = !q || p.title.toLowerCase().includes(q) || (p.platform||'').toLowerCase().includes(q);
    return mf && ms;
  });

  if (!visible.length) {
    grid.innerHTML = `<div class="empty-state">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
        <path d="M9 2H5a2 2 0 00-2 2v16a2 2 0 002 2h14a2 2 0 002-2V7l-5-5z"/>
        <path d="M9 2v5h10"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
      </svg>
      <p>No problems found — add one above!</p>
    </div>`;
    return;
  }

  visible.forEach((prob, i) => {
    const card = buildCard(prob);
    card.style.animationDelay = `${i * 35}ms`;
    grid.appendChild(card);
  });
};

/* Handlers */
const handleDelete = async (prob, cardEl) => {
  cardEl.style.transition = 'transform 0.22s ease, opacity 0.22s ease';
  cardEl.style.transform  = 'scale(0.93)';
  cardEl.style.opacity    = '0';
  try {
    await window.apiProblems.remove(getId(prob));
    problems = problems.filter(p => getId(p) !== getId(prob));
    setTimeout(() => { render(); updateStats(); }, 220);
    toast('Problem deleted.');
  } catch(e) {
    cardEl.style.transform = ''; cardEl.style.opacity = '';
    toast('Delete failed: ' + e.message, true);
  }
};

const handleToggle = async (prob, cardEl) => {
  const btn = cardEl.querySelector('[data-action="toggle"]');
  btn.disabled = true;
  const newStatus = prob.status === 'solved' ? 'attempted' : 'solved';
  try {
    const res   = await window.apiProblems.update(getId(prob), { ...prob, status: newStatus });
    const saved = res?.problem || { ...prob, status: newStatus };
    const idx   = problems.findIndex(p => getId(p) === getId(prob));
    if (idx !== -1) problems[idx] = saved;
    render(); updateStats();
    toast(`Marked as ${newStatus}.`);
  } catch(e) {
    btn.disabled = false;
    toast('Update failed: ' + e.message, true);
  }
};

const handleField = async (prob, field) => {
  const labels   = { rating:'New rating:', title:'New title:', platform:'New platform (Codeforces / LeetCode / AtCoder / Other):' };
  const raw      = prompt(labels[field], prob[field] ?? '');
  if (raw === null || raw.trim() === '') return;

  let val = raw.trim();
  if (field === 'rating') {
    val = Number(val);
    if (isNaN(val)) { toast('Rating must be a number.', true); return; }
  }

  try {
    const res   = await window.apiProblems.update(getId(prob), { ...prob, [field]: val });
    const saved = res?.problem || { ...prob, [field]: val };
    const idx   = problems.findIndex(p => getId(p) === getId(prob));
    if (idx !== -1) problems[idx] = saved;
    render(); if (field === 'rating') updateStats();
    toast(`${field.charAt(0).toUpperCase()+field.slice(1)} updated.`);
  } catch(e) {
    toast('Update failed: ' + e.message, true);
  }
};

/* Form submit */
document.getElementById('add-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('btn-submit');
  const payload = {
    title:    document.getElementById('f-title').value.trim(),
    platform: document.getElementById('f-platform').value,
    rating:   Number(document.getElementById('f-rating').value) || null,
    status:   document.getElementById('f-status').value,
  };
  if (!payload.title) { toast('Title is required.', true); return; }
  btn.disabled = true; btn.textContent = 'Adding…';
  try {
    const created = await window.apiProblems.create(payload);
    problems.unshift(created);
    render(); updateStats();
    e.target.reset();
    document.getElementById('f-platform').value = 'Codeforces';
    document.getElementById('f-status').value   = 'attempted';
    toast('Problem added! ✓');
  } catch(err) {
    toast('Error: ' + err.message, true);
  } finally {
    btn.disabled = false; btn.textContent = '+ Add Problem';
  }
});

/* Filters */
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    render();
  });
});

document.getElementById('search-input').addEventListener('input', e => {
  searchQuery = e.target.value;
  render();
});

/* Sync Codeforces problemset */
document.getElementById('sync-btn').addEventListener('click', async () => {
  const btn = document.getElementById('sync-btn');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ Syncing...';
  
  try {
    const response = await fetch('/api/codeforces/sync', { method: 'POST' });
    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status}`);
    }
    toast('✅ Codeforces problemset synced successfully!');
  } catch (err) {
    toast('Sync error: ' + err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
});

/* Init — called by Clerk after authentication */
const init = async () => {
  const grid = document.getElementById('problems-grid');
  grid.innerHTML = [1,2,3].map(() => `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px;display:flex;flex-direction:column;gap:12px;">
      <div class="skeleton" style="height:16px;width:68%"></div>
      <div class="skeleton" style="height:12px;width:38%"></div>
      <div class="skeleton" style="height:28px;width:100%"></div>
    </div>`).join('');
  try {
    problems = await window.apiProblems.getAll();
    render(); updateStats();
  } catch {
    grid.innerHTML = `<div class="empty-state"><p>⚠ Could not reach /api/problems — is your server running?</p></div>`;
  }
};

// Expose init globally so Clerk script can call it after auth
window.dashboardInit = init;
