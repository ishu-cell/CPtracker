// js/pages/training.js — Daily Training Page
(function () {
  const page = document.getElementById('page-training');

  function escH(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function getRatingColor(r) {
    if (r >= 2400) return '#ff0000'; if (r >= 2100) return '#ff8c00'; if (r >= 1900) return '#aa00aa';
    if (r >= 1600) return '#0000ff'; if (r >= 1400) return '#03a89e'; if (r >= 1200) return '#008000'; return '#808080';
  }

  function renderNoProfile() {
    page.querySelector('.page').innerHTML = `
      <div class="coming-soon"><div class="coming-soon-icon">🔥</div><h2>Daily Training</h2>
      <p>Connect your Codeforces handle first.</p>
      <a href="#/profile" class="btn-add" style="text-decoration:none;margin-top:8px;">Connect Handle</a></div>`;
  }

  async function loadTraining() {
    try {
      const profile = await window.apiCodeforces.getProfile();
      if (!profile.connected) { renderNoProfile(); return; }

      const data = await window.apiTraining.today();
      renderTraining(data);
    } catch { renderNoProfile(); }
  }

  function renderTraining(data) {
    const c = data.challenge;
    const s = data.streak;

    const tags = c?.problem_tags ? (typeof c.problem_tags === 'string' ? JSON.parse(c.problem_tags) : c.problem_tags) : [];
    const isSolved = c?.status === 'solved';
    const url = c ? `https://codeforces.com/problemset/problem/${c.contest_id}/${c.problem_index}` : '#';

    page.querySelector('.page').innerHTML = `
      <header style="padding:32px 0 26px;border-bottom:1px solid var(--border);margin-bottom:30px;">
        <h1 style="font-family:var(--font-sans);font-size:24px;font-weight:800;color:var(--text-1);">🔥 Daily Training</h1>
        <p style="font-family:var(--font-mono);font-size:12px;color:var(--text-3);margin-top:4px;">One problem a day keeps the rating decay away</p>
      </header>

      <!-- Streak Cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:28px;">
        <div class="stat-chip" style="padding:12px 16px;">
          <span class="stat-val" style="color:var(--rose);font-size:28px;">🔥 ${s.current_streak}</span>
          <span class="stat-lbl">Current Streak</span>
        </div>
        <div class="stat-chip" style="padding:12px 16px;">
          <span class="stat-val" style="color:#ca8a04;font-size:20px;">🏆 ${s.longest_streak}</span>
          <span class="stat-lbl">Best Streak</span>
        </div>
        <div class="stat-chip" style="padding:12px 16px;">
          <span class="stat-val" style="color:var(--green);font-size:20px;">✅ ${s.total_problems_solved}</span>
          <span class="stat-lbl">Total Solved</span>
        </div>
        <div class="stat-chip" style="padding:12px 16px;">
          <span class="stat-val" style="color:var(--blue);font-size:20px;">📅 ${s.total_practice_days}</span>
          <span class="stat-lbl">Practice Days</span>
        </div>
      </div>

      <!-- Today's Challenge -->
      <div class="section-label"><span>// today's challenge</span></div>
      ${c ? `
        <div class="form-panel" style="padding:24px;margin-bottom:28px;position:relative;overflow:hidden;">
          ${isSolved ? '<div style="position:absolute;top:12px;right:16px;font-size:28px;">✅</div>' : ''}
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="font-family:var(--font-mono);font-size:11px;font-weight:700;color:${getRatingColor(c.problem_rating)};background:var(--bg-input);padding:3px 8px;border-radius:4px;">⚡ ${c.problem_rating}</span>
            <span style="font-family:var(--font-mono);font-size:9px;color:var(--text-3);background:rgba(124,58,237,0.1);padding:2px 8px;border-radius:999px;text-transform:uppercase;">${escH(c.difficulty_mode)}</span>
            ${c.target_tag ? `<span style="font-family:var(--font-mono);font-size:9px;color:var(--rose);background:rgba(225,29,72,0.08);padding:2px 8px;border-radius:999px;">🎯 ${escH(c.target_tag)}</span>` : ''}
          </div>
          <h2 style="font-family:var(--font-sans);font-size:20px;font-weight:800;color:var(--text-1);margin-bottom:8px;">
            <a href="${escH(url)}" target="_blank" rel="noopener" style="color:var(--text-1);text-decoration:none;">${escH(c.problem_name)} ↗</a>
          </h2>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:16px;">
            ${tags.map(t => `<span style="font-family:var(--font-mono);font-size:9px;padding:2px 6px;border-radius:4px;background:var(--bg-input);color:var(--text-3);">${t}</span>`).join('')}
          </div>
          ${!isSolved ? `
            <div style="display:flex;gap:8px;">
              <a href="${escH(url)}" target="_blank" rel="noopener" class="btn-add" style="text-decoration:none;text-align:center;flex:1;">
                Open on Codeforces ↗
              </a>
              <button class="btn-add" id="btn-complete" style="background:var(--green);box-shadow:0 2px 8px rgba(5,150,105,0.3);flex:1;">
                ✓ Mark as Solved
              </button>
            </div>
          ` : `<div style="font-family:var(--font-mono);font-size:13px;color:var(--green);font-weight:700;">✅ Challenge completed! Come back tomorrow for a new one.</div>`}
        </div>
      ` : `<div class="form-panel" style="padding:24px;text-align:center;color:var(--text-3);font-family:var(--font-mono);font-size:12px;">
        No challenge available. Make sure you've synced the global problemset.
      </div>`}
    `;

    if (!isSolved && c) {
      document.getElementById('btn-complete')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-complete');
        btn.disabled = true; btn.textContent = '⏳ Marking…';
        try {
          await window.apiTraining.complete();
          toast('🎉 Challenge completed! Streak updated.');
          loadTraining();
        } catch (e) { toast(e.message, true); btn.disabled = false; btn.textContent = '✓ Mark as Solved'; }
      });
    }
  }

  window.addEventListener('page:change', e => {
    if (e.detail.page === 'training') loadTraining();
  });
})();
