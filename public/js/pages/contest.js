// js/pages/contest.js — Contest Coach Page (Phase 7 placeholder with upcoming contests)
(function () {
  const page = document.getElementById('page-contest');

  async function loadContestPage() {
    try {
      const profile = await window.apiCodeforces.getProfile();
      if (!profile.connected) {
        page.querySelector('.page').innerHTML = `
          <div class="coming-soon"><div class="coming-soon-icon">🏆</div><h2>Contest Coach</h2>
          <p>Connect your Codeforces handle first.</p>
          <a href="#/profile" class="btn-add" style="text-decoration:none;margin-top:8px;">Connect Handle</a></div>`;
        return;
      }

      // Fetch upcoming contests directly from CF API
      let contests = [];
      try {
        const res = await fetch('https://codeforces.com/api/contest.list?gym=false');
        const data = await res.json();
        if (data.status === 'OK') {
          contests = data.result.filter(c => c.phase === 'BEFORE').slice(0, 8);
        }
      } catch { /* CF API might be slow */ }

      page.querySelector('.page').innerHTML = `
        <header style="padding:32px 0 26px;border-bottom:1px solid var(--border);margin-bottom:30px;">
          <h1 style="font-family:var(--font-sans);font-size:24px;font-weight:800;color:var(--text-1);">🏆 Contest Coach</h1>
          <p style="font-family:var(--font-mono);font-size:12px;color:var(--text-3);margin-top:4px;">Upcoming contests & preparation tools</p>
        </header>

        <div class="section-label"><span>// upcoming contests</span></div>
        ${contests.length ? `
          <div style="display:grid;gap:8px;margin-bottom:28px;">
            ${contests.map(c => {
              const start = new Date(c.startTimeSeconds * 1000);
              const duration = Math.round(c.durationSeconds / 3600);
              const timeUntil = Math.round((c.startTimeSeconds * 1000 - Date.now()) / (1000 * 60 * 60));
              const daysUntil = Math.round(timeUntil / 24);
              return `
                <div class="form-panel" style="padding:14px 18px;margin-bottom:0;display:flex;justify-content:space-between;align-items:center;">
                  <div>
                    <div style="font-family:var(--font-sans);font-size:14px;font-weight:700;color:var(--text-1);">${c.name}</div>
                    <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-3);margin-top:4px;">
                      ${start.toLocaleDateString('en-US', {weekday:'short',month:'short',day:'numeric'})} at ${start.toLocaleTimeString('en-US', {hour:'2-digit',minute:'2-digit'})}
                      · ${duration}h duration
                    </div>
                  </div>
                  <div style="text-align:right;">
                    <div style="font-family:var(--font-mono);font-size:14px;font-weight:700;color:${daysUntil <= 1 ? 'var(--rose)' : 'var(--sigma-mid)'};">
                      ${daysUntil > 0 ? `${daysUntil}d` : `${timeUntil}h`}
                    </div>
                    <div style="font-family:var(--font-mono);font-size:8px;color:var(--text-3);text-transform:uppercase;">until start</div>
                  </div>
                </div>`;
            }).join('')}
          </div>
        ` : '<div class="form-panel" style="padding:18px;color:var(--text-3);font-family:var(--font-mono);font-size:12px;">No upcoming contests found.</div>'}

        <div class="section-label"><span>// contest tools (coming soon)</span></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="form-panel" style="padding:20px;text-align:center;">
            <div style="font-size:32px;margin-bottom:8px;">🏃</div>
            <div style="font-family:var(--font-sans);font-size:14px;font-weight:700;color:var(--text-1);margin-bottom:4px;">Pre-Contest Warmup</div>
            <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-3);">Practice problems similar to what you'll face</div>
            <span style="display:inline-block;margin-top:8px;font-family:var(--font-mono);font-size:8px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--sigma-glow);color:var(--sigma-mid);text-transform:uppercase;">Phase 7</span>
          </div>
          <div class="form-panel" style="padding:20px;text-align:center;">
            <div style="font-size:32px;margin-bottom:8px;">📝</div>
            <div style="font-family:var(--font-sans);font-size:14px;font-weight:700;color:var(--text-1);margin-bottom:4px;">Post-Contest Upsolve</div>
            <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-3);">Solve problems you missed during the contest</div>
            <span style="display:inline-block;margin-top:8px;font-family:var(--font-mono);font-size:8px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--sigma-glow);color:var(--sigma-mid);text-transform:uppercase;">Phase 7</span>
          </div>
        </div>
      `;
    } catch {
      page.querySelector('.page').innerHTML = '<div class="coming-soon"><div class="coming-soon-icon">🏆</div><h2>Contest Coach</h2><p>Something went wrong.</p></div>';
    }
  }

  window.addEventListener('page:change', e => {
    if (e.detail.page === 'contest') loadContestPage();
  });
})();
