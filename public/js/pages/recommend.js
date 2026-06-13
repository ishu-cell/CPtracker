// js/pages/recommend.js — Problem Recommendations Page
// Shows personalized problem recommendations with mode switching.

(function () {
  const page = document.getElementById('page-recommend');
  let currentMode = 'balanced';

  const MODES = {
    balanced:       { label: '⚖️ Balanced', desc: 'Mix of difficulty, weakness coverage, and freshness' },
    weakness_focus: { label: '🎯 Weakness Focus', desc: 'Prioritize your weakest topics' },
    stretch:        { label: '🚀 Stretch', desc: 'Problems above your comfort zone' },
    contest_prep:   { label: '🏆 Contest Prep', desc: 'Popular problems, contest-style distribution' },
  };

  function renderNoProfile() {
    page.querySelector('.page').innerHTML = `
      <div class="coming-soon">
        <div class="coming-soon-icon">💡</div>
        <h2>Recommendations</h2>
        <p>Connect your Codeforces handle first to get personalized problem recommendations.</p>
        <a href="#/profile" class="btn-add" style="text-decoration: none; margin-top: 8px;">Connect Codeforces Handle</a>
      </div>
    `;
  }

  function renderLayout() {
    const modeBtns = Object.entries(MODES).map(([key, m]) =>
      `<button class="filter-btn ${key === currentMode ? 'active' : ''}" data-mode="${key}" title="${m.desc}">${m.label}</button>`
    ).join('');

    page.querySelector('.page').innerHTML = `
      <header style="padding: 32px 0 26px; border-bottom: 1px solid var(--border); margin-bottom: 30px;">
        <h1 style="font-family: var(--font-sans); font-size: 24px; font-weight: 800; color: var(--text-1);">💡 Problem Recommendations</h1>
        <p style="font-family: var(--font-mono); font-size: 12px; color: var(--text-3); margin-top: 4px;">AI-scored problems optimized for your rating growth</p>
      </header>

      <div class="filters" style="margin-bottom: 24px;">
        ${modeBtns}
      </div>

      <div id="rec-meta" style="margin-bottom: 16px;"></div>
      <div id="rec-grid"></div>
    `;

    page.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentMode = btn.dataset.mode;
        page.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === currentMode));
        loadRecommendations();
      });
    });
  }

  function escH(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function getRatingColor(r) {
    if (r >= 2400) return '#ff0000';
    if (r >= 2100) return '#ff8c00';
    if (r >= 1900) return '#aa00aa';
    if (r >= 1600) return '#0000ff';
    if (r >= 1400) return '#03a89e';
    if (r >= 1200) return '#008000';
    return '#808080';
  }

  function problemCard(p, idx) {
    const tagHtml = (p.tags || []).slice(0, 4).map(t => {
      const isWeak = t === p.primary_weak_tag;
      return `<span style="font-family: var(--font-mono); font-size: 9px; padding: 2px 6px; border-radius: 4px;
                     background: ${isWeak ? 'rgba(225,29,72,0.12)' : 'var(--bg-input)'}; 
                     color: ${isWeak ? 'var(--rose)' : 'var(--text-3)'}; font-weight: ${isWeak ? 700 : 400};">${t}</span>`;
    }).join('');

    return `
      <div class="form-panel" style="padding: 16px 18px; margin-bottom: 0;">
        <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 8px;">
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span style="font-family: var(--font-mono); font-size: 10px; color: var(--text-3); background: var(--bg-input); padding: 2px 6px; border-radius: 4px;">#${idx + 1}</span>
              <a href="${escH(p.url)}" target="_blank" rel="noopener" 
                 style="font-family: var(--font-sans); font-size: 14px; font-weight: 700; color: var(--text-1); text-decoration: none;">
                ${escH(p.name)} ↗
              </a>
            </div>
            <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 6px;">
              <span style="font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: ${getRatingColor(p.rating)};">⚡ ${p.rating}</span>
              <span style="font-family: var(--font-mono); font-size: 10px; color: var(--text-3);">·</span>
              <span style="font-family: var(--font-mono); font-size: 10px; color: var(--text-3);">${p.contest_id}${p.problem_index}</span>
              <span style="font-family: var(--font-mono); font-size: 10px; color: var(--text-3);">·</span>
              <span style="font-family: var(--font-mono); font-size: 10px; color: var(--text-3);">👥 ${(p.solved_count || 0).toLocaleString()} solved</span>
            </div>
            <div style="display: flex; gap: 4px; flex-wrap: wrap;">${tagHtml}</div>
          </div>
          <div style="text-align: center; min-width: 50px;">
            <div style="font-family: var(--font-mono); font-size: 16px; font-weight: 700; color: var(--sigma-mid);">${p.score}</div>
            <div style="font-family: var(--font-mono); font-size: 8px; color: var(--text-3); text-transform: uppercase;">score</div>
          </div>
        </div>
        <div style="font-family: var(--font-mono); font-size: 10px; color: var(--green); opacity: 0.9;">
          💡 ${escH(p.recommendation_reason)}
        </div>
      </div>
    `;
  }

  async function loadRecommendations() {
    const grid = document.getElementById('rec-grid');
    const meta = document.getElementById('rec-meta');
    if (!grid) return;

    grid.innerHTML = [1,2,3].map(() => `<div class="form-panel" style="padding: 18px; margin-bottom: 0;"><div class="skeleton" style="height: 60px;"></div></div>`).join('');

    try {
      const data = await window.apiRecommendations.get({ mode: currentMode, count: 15 });

      meta.innerHTML = `
        <div style="display: flex; gap: 12px; flex-wrap: wrap; font-family: var(--font-mono); font-size: 10px; color: var(--text-3);">
          <span>Mode: <strong style="color: var(--sigma-mid);">${MODES[currentMode]?.label || currentMode}</strong></span>
          <span>·</span>
          <span>Your Rating: <strong style="color: var(--text-1);">${data.user_rating}</strong></span>
          <span>·</span>
          <span>Target Range: <strong style="color: var(--text-2);">${data.target_range}</strong></span>
          ${data.primary_weakness ? `<span>· Primary Weakness: <strong style="color: var(--rose);">${escH(data.primary_weakness)}</strong></span>` : ''}
        </div>
      `;

      if (!data.problems.length) {
        grid.innerHTML = `<div class="coming-soon" style="min-height: 20vh;"><p>No recommendations available. Make sure the global problemset has been synced.</p></div>`;
        return;
      }

      grid.innerHTML = `<div style="display: grid; gap: 8px;">${data.problems.map((p, i) => problemCard(p, i)).join('')}</div>`;
    } catch (e) {
      grid.innerHTML = `<div class="form-panel" style="padding: 18px; color: var(--rose); font-family: var(--font-mono); font-size: 12px;">Error: ${escH(e.message)}</div>`;
    }
  }

  async function init() {
    try {
      const profile = await window.apiCodeforces.getProfile();
      if (!profile.connected) { renderNoProfile(); return; }
      renderLayout();
      await loadRecommendations();
    } catch { renderNoProfile(); }
  }

  window.addEventListener('page:change', e => {
    if (e.detail.page === 'recommend') init();
  });
})();
