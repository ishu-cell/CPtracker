// js/pages/weaknesses.js — Weakness Detection Page
// Visualizes the user's weak, neglected, and strong tags with actionable insights.
// Clicking a tag shows practice problems for that topic.

(function () {
  const page = document.getElementById('page-weaknesses');

  function renderNoProfile() {
    page.querySelector('.page').innerHTML = `
      <div class="coming-soon"><div class="coming-soon-icon">🎯</div><h2>Weakness Detection</h2>
      <p>Connect your Codeforces handle first to analyze your weaknesses.</p>
      <a href="#/profile" class="btn-add" style="text-decoration: none; margin-top: 8px;">Connect Codeforces Handle</a></div>`;
  }

  function weaknessBar(score) {
    const pct = Math.min(100, score * 10);
    let color = 'var(--green)';
    if (score >= 5) color = 'var(--rose)';
    else if (score >= 3) color = '#d97706';
    return `<div style="flex:1; min-width: 80px; max-width: 150px; height: 6px; background: var(--bg-input); border-radius: 3px; overflow: hidden;">
      <div style="width: ${pct}%; height: 100%; background: ${color}; border-radius: 3px; transition: width 0.6s ease;"></div>
    </div>`;
  }

  function escH(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function getRatingColor(r) {
    if (r >= 2400) return '#ff0000'; if (r >= 2100) return '#ff8c00'; if (r >= 1900) return '#aa00aa';
    if (r >= 1600) return '#0000ff'; if (r >= 1400) return '#03a89e'; if (r >= 1200) return '#008000'; return '#808080';
  }

  const categoryBadge = {
    'critical_weakness': { label: 'CRITICAL', color: 'var(--rose)', bg: 'rgba(225,29,72,0.1)' },
    'moderate_weakness': { label: 'MODERATE', color: '#d97706', bg: 'rgba(217,119,6,0.1)' },
    'neglected':         { label: 'NEGLECTED', color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
    'strength':          { label: 'STRONG', color: 'var(--green)', bg: 'rgba(5,150,105,0.08)' },
    'moderate':          { label: 'OK', color: 'var(--text-3)', bg: 'rgba(148,163,184,0.08)' },
    'over_practiced':    { label: 'OVER', color: '#ca8a04', bg: 'rgba(202,138,4,0.1)' },
  };

  function tagCard(item, showScore = true) {
    const badge = categoryBadge[item.category] || categoryBadge.moderate;
    return `
      <div class="form-panel weakness-tag-card" data-tag="${escH(item.tag)}" 
           style="padding: 16px 18px; margin-bottom: 0; display: flex; align-items: center; gap: 14px; cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease;"
           onmouseenter="this.style.transform='translateX(4px)';this.style.boxShadow='0 4px 16px rgba(124,58,237,0.12)'"
           onmouseleave="this.style.transform='';this.style.boxShadow=''">
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span style="font-family: var(--font-sans); font-size: 14px; font-weight: 700; color: var(--text-1);">${escH(item.tag)}</span>
            <span style="font-family: var(--font-mono); font-size: 8px; font-weight: 700; padding: 2px 7px; border-radius: 999px; background: ${badge.bg}; color: ${badge.color}; text-transform: uppercase; letter-spacing: 0.08em;">${badge.label}</span>
          </div>
          <div style="font-family: var(--font-mono); font-size: 10px; color: var(--text-3); line-height: 1.6;">
            ${item.total_solved}/${item.total_attempted} solved (${item.success_rate}%) 
            ${item.avg_rating_solved ? ` · avg ${Math.round(item.avg_rating_solved)}` : ''}
          </div>
          <div style="font-family: var(--font-mono); font-size: 10px; color: var(--sigma-mid); margin-top: 4px;">
            💡 ${escH(item.recommendation)}
          </div>
        </div>
        ${showScore ? `
          <div style="text-align: center; min-width: 60px;">
            <div style="font-family: var(--font-mono); font-size: 18px; font-weight: 700; color: ${badge.color};">${item.weakness_score.toFixed(1)}</div>
            <div style="font-family: var(--font-mono); font-size: 8px; color: var(--text-3); text-transform: uppercase;">score</div>
          </div>
        ` : ''}
        ${showScore ? weaknessBar(item.weakness_score) : ''}
        <div style="color: var(--text-3); font-size: 16px; flex-shrink: 0;">→</div>
      </div>
    `;
  }

  // ── Problem Panel (slides in when tag clicked) ──
  function showProblemPanel(tag) {
    // Remove existing panel
    closeProblemPanel();

    const overlay = document.createElement('div');
    overlay.id = 'tag-problem-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:999;opacity:0;transition:opacity 0.2s ease;';
    overlay.addEventListener('click', closeProblemPanel);

    const panel = document.createElement('div');
    panel.id = 'tag-problem-panel';
    panel.style.cssText = `
      position:fixed;top:0;right:-480px;width:460px;height:100vh;z-index:1000;
      background:var(--bg-card);border-left:1px solid var(--border);
      box-shadow:-8px 0 32px rgba(0,0,0,0.2);overflow-y:auto;
      transition:right 0.3s cubic-bezier(0.4,0,0.2,1);padding:24px;
    `;
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <div>
          <h2 style="font-family:var(--font-sans);font-size:18px;font-weight:800;color:var(--text-1);margin-bottom:4px;">
            Practice: ${escH(tag)}
          </h2>
          <p style="font-family:var(--font-mono);font-size:10px;color:var(--text-3);">Unsolved problems · warmup → target → stretch</p>
        </div>
        <div style="display:flex;gap:6px;">
          <button id="refresh-tag-panel" style="background:var(--bg-input);border:1px solid var(--border);color:var(--text-1);font-size:14px;cursor:pointer;padding:4px 10px;border-radius:6px;transition:background 0.15s;" title="Shuffle problems">🔀</button>
          <button id="close-tag-panel" style="background:none;border:none;color:var(--text-3);font-size:22px;cursor:pointer;padding:4px 8px;">✕</button>
        </div>
      </div>
      <div id="tag-problems-list">
        <div style="display:grid;gap:8px;">
          ${[1,2,3,4,5].map(() => `<div class="form-panel" style="padding:14px;margin-bottom:0;"><div class="skeleton" style="height:40px;"></div></div>`).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    // Animate in
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      panel.style.right = '0';
    });

    document.getElementById('close-tag-panel').addEventListener('click', closeProblemPanel);
    document.getElementById('refresh-tag-panel').addEventListener('click', () => {
      document.getElementById('tag-problems-list').innerHTML = '<div style="display:grid;gap:8px;">' + [1,2,3,4,5].map(() => '<div class="form-panel" style="padding:14px;margin-bottom:0;"><div class="skeleton" style="height:40px;"></div></div>').join('') + '</div>';
      loadTagProblems(tag);
    });

    // Fetch problems
    loadTagProblems(tag);
  }

  function closeProblemPanel() {
    const panel = document.getElementById('tag-problem-panel');
    const overlay = document.getElementById('tag-problem-overlay');
    if (panel) {
      panel.style.right = '-480px';
      setTimeout(() => panel.remove(), 300);
    }
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 200);
    }
  }

  async function loadTagProblems(tag) {
    const container = document.getElementById('tag-problems-list');
    if (!container) return;

    try {
      const data = await window.apiFetch(`/api/recommendations/by-tag?tag=${encodeURIComponent(tag)}&count=12`);

      if (!data.problems.length) {
        container.innerHTML = `<div style="text-align:center;padding:24px;font-family:var(--font-mono);font-size:12px;color:var(--text-3);">
          No unsolved problems found for "${escH(tag)}" in the ${data.range} range.<br/>Try syncing your profile or checking the global problemset.
        </div>`;
        return;
      }

      const tierStyles = {
        warmup:  { label: 'WARMUP',  color: '#059669', bg: 'rgba(5,150,105,0.1)' },
        target:  { label: 'TARGET',  color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
        stretch: { label: 'STRETCH', color: '#e11d48', bg: 'rgba(225,29,72,0.1)' },
      };

      // Group by tier
      let lastTier = '';
      let html = `<div style="font-family:var(--font-mono);font-size:9px;color:var(--text-3);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.1em;">
        ${data.problems.length} problems · Rating ${data.range} · Click 🔀 to shuffle
      </div><div style="display:grid;gap:6px;">`;

      data.problems.forEach((p, i) => {
        const tier = p.tier || 'target';
        const ts = tierStyles[tier];
        if (tier !== lastTier) {
          html += `<div style="font-family:var(--font-mono);font-size:8px;font-weight:700;color:${ts.color};text-transform:uppercase;letter-spacing:0.12em;margin-top:${lastTier ? '12px' : '0'};margin-bottom:2px;padding-left:4px;">
            ${ts.label} zone
          </div>`;
          lastTier = tier;
        }
        html += `
          <a href="${escH(p.url)}" target="_blank" rel="noopener" 
             class="form-panel" style="padding:12px 14px;margin-bottom:0;display:flex;align-items:center;gap:12px;text-decoration:none;transition:transform 0.12s ease;border-left:3px solid ${ts.color};"
             onmouseenter="this.style.transform='translateX(4px)'" onmouseleave="this.style.transform=''">
            <span style="font-family:var(--font-mono);font-size:9px;color:var(--text-3);background:var(--bg-input);padding:2px 6px;border-radius:4px;min-width:22px;text-align:center;">${i + 1}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-family:var(--font-sans);font-size:13px;font-weight:600;color:var(--text-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${escH(p.name)} ↗
              </div>
              <div style="font-family:var(--font-mono);font-size:9px;color:var(--text-3);margin-top:2px;">
                ${p.contest_id}${p.problem_index} · 👥 ${(p.solved_count || 0).toLocaleString()} solved
              </div>
            </div>
            <span style="font-family:var(--font-mono);font-size:12px;font-weight:700;color:${getRatingColor(p.rating)};flex-shrink:0;">
              ⚡${p.rating}
            </span>
          </a>`;
      });
      html += '</div>';
      container.innerHTML = html;
    } catch (e) {
      container.innerHTML = `<div style="padding:16px;color:var(--rose);font-family:var(--font-mono);font-size:11px;">Error: ${escH(e.message)}</div>`;
    }
  }

  // ── Page Load ──
  async function loadWeaknesses() {
    try {
      const profile = await window.apiCodeforces.getProfile();
      if (!profile.connected) { renderNoProfile(); return; }

      page.querySelector('.page').innerHTML = `
        <header style="padding: 32px 0 26px; border-bottom: 1px solid var(--border); margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 style="font-family: var(--font-sans); font-size: 24px; font-weight: 800; color: var(--text-1);">🎯 Weakness Detection</h1>
            <p style="font-family: var(--font-mono); font-size: 12px; color: var(--text-3); margin-top: 4px;">Click any topic to get practice problems · Score 0-10 (higher = weaker)</p>
          </div>
          <button class="btn-add" id="btn-rebuild" style="font-size: 11px; padding: 8px 16px;">🔄 Recalculate</button>
        </header>
        <div id="weakness-content"><div class="skeleton" style="height: 200px;"></div></div>
      `;

      document.getElementById('btn-rebuild').addEventListener('click', async () => {
        const btn = document.getElementById('btn-rebuild');
        btn.disabled = true; btn.textContent = '⏳ Calculating…';
        try {
          await window.apiFetch('/api/weaknesses/rebuild', { method: 'POST' });
          toast('Weakness scores recalculated!');
          await renderWeaknessData();
        } catch (e) { toast(e.message, true); }
        btn.disabled = false; btn.textContent = '🔄 Recalculate';
      });

      await renderWeaknessData();
    } catch { renderNoProfile(); }
  }

  async function renderWeaknessData() {
    const data = await window.apiWeaknesses.get();
    const container = document.getElementById('weakness-content');

    const sections = [];

    if (data.weaknesses.length) {
      sections.push(`
        <div class="section-label"><span>// critical & moderate weaknesses (${data.weaknesses.length})</span></div>
        <div style="display: grid; gap: 8px; margin-bottom: 28px;">
          ${data.weaknesses.map(w => tagCard(w, true)).join('')}
        </div>
      `);
    }

    if (data.neglected.length) {
      sections.push(`
        <div class="section-label"><span>// neglected topics (${data.neglected.length})</span></div>
        <div style="display: grid; gap: 8px; margin-bottom: 28px;">
          ${data.neglected.map(w => tagCard(w, false)).join('')}
        </div>
      `);
    }

    if (data.strengths.length) {
      sections.push(`
        <div class="section-label"><span>// strengths (${data.strengths.length})</span></div>
        <div style="display: grid; gap: 8px; margin-bottom: 28px;">
          ${data.strengths.map(w => tagCard(w, true)).join('')}
        </div>
      `);
    }

    if (data.overPracticed.length) {
      sections.push(`
        <div class="section-label"><span>// over-practiced (${data.overPracticed.length})</span></div>
        <div style="display: grid; gap: 8px; margin-bottom: 28px;">
          ${data.overPracticed.map(w => tagCard(w, true)).join('')}
        </div>
      `);
    }

    if (!sections.length) {
      container.innerHTML = '<div class="coming-soon" style="min-height: 30vh;"><p>No tag data found. Sync your Codeforces submissions first.</p></div>';
    } else {
      container.innerHTML = sections.join('');

      // Attach click listeners to all tag cards
      container.querySelectorAll('.weakness-tag-card').forEach(card => {
        card.addEventListener('click', () => {
          const tag = card.dataset.tag;
          if (tag) showProblemPanel(tag);
        });
      });
    }
  }

  window.addEventListener('page:change', e => {
    if (e.detail.page === 'weaknesses') loadWeaknesses();
    else closeProblemPanel();
  });
})();
