// js/pages/analytics.js — Analytics Dashboard Page
// Rating graph, tag distribution, difficulty buckets, heatmap, verdicts.

(function () {
  const page = document.getElementById('page-analytics');
  let charts = {};  // Track Chart.js instances to destroy on re-render

  // CF rank color zones for the rating chart
  const RANK_ZONES = [
    { min: 0,    max: 1199, color: 'rgba(128,128,128,0.08)', border: '#808080', label: 'Newbie' },
    { min: 1200, max: 1399, color: 'rgba(0,128,0,0.08)',     border: '#008000', label: 'Pupil' },
    { min: 1400, max: 1599, color: 'rgba(3,168,158,0.08)',   border: '#03a89e', label: 'Specialist' },
    { min: 1600, max: 1899, color: 'rgba(0,0,255,0.08)',     border: '#0000ff', label: 'Expert' },
    { min: 1900, max: 2099, color: 'rgba(170,0,170,0.08)',   border: '#aa00aa', label: 'CM' },
    { min: 2100, max: 2399, color: 'rgba(255,140,0,0.08)',   border: '#ff8c00', label: 'Master' },
    { min: 2400, max: 4000, color: 'rgba(255,0,0,0.08)',     border: '#ff0000', label: 'GM+' },
  ];

  function getRatingColor(rating) {
    if (rating >= 2400) return '#ff0000';
    if (rating >= 2100) return '#ff8c00';
    if (rating >= 1900) return '#aa00aa';
    if (rating >= 1600) return '#0000ff';
    if (rating >= 1400) return '#03a89e';
    if (rating >= 1200) return '#008000';
    return '#808080';
  }

  // ── Main Render ──
  function renderLayout() {
    page.querySelector('.page').innerHTML = `
      <header style="padding: 32px 0 26px; border-bottom: 1px solid var(--border); margin-bottom: 30px;">
        <h1 style="font-family: var(--font-sans); font-size: 24px; font-weight: 800; color: var(--text-1);">Rating Analytics</h1>
        <p style="font-family: var(--font-mono); font-size: 12px; color: var(--text-3); margin-top: 4px;">Track your Codeforces growth trajectory</p>
      </header>

      <!-- Stats Cards -->
      <div id="stats-cards" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-bottom: 28px;"></div>

      <!-- Rating Chart -->
      <div class="section-label"><span>// rating over time</span></div>
      <div class="form-panel" style="padding: 20px; margin-bottom: 28px;">
        <canvas id="chart-rating" height="280"></canvas>
      </div>

      <!-- Two-column grid -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 28px;">
        <div>
          <div class="section-label"><span>// problems by tag</span></div>
          <div class="form-panel" style="padding: 20px; min-height: 320px;">
            <canvas id="chart-tags"></canvas>
          </div>
        </div>
        <div>
          <div class="section-label"><span>// difficulty distribution</span></div>
          <div class="form-panel" style="padding: 20px; min-height: 320px;">
            <canvas id="chart-difficulty"></canvas>
          </div>
        </div>
      </div>

      <!-- Verdict + Heatmap row -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 28px;">
        <div>
          <div class="section-label"><span>// verdicts</span></div>
          <div class="form-panel" style="padding: 20px; min-height: 260px;">
            <canvas id="chart-verdicts"></canvas>
          </div>
        </div>
        <div>
          <div class="section-label"><span>// weekly activity</span></div>
          <div class="form-panel" style="padding: 20px; min-height: 260px;">
            <div id="weekly-summary"></div>
          </div>
        </div>
      </div>
    `;
  }

  function renderNoProfile() {
    page.querySelector('.page').innerHTML = `
      <div class="coming-soon">
        <div class="coming-soon-icon">📊</div>
        <h2>Analytics Unavailable</h2>
        <p>Connect your Codeforces handle first to see your rating analytics.</p>
        <a href="#/profile" class="btn-add" style="text-decoration: none; margin-top: 8px;">Connect Codeforces Handle</a>
      </div>
    `;
  }

  // ── Data Loading ──
  async function loadAnalytics() {
    try {
      const profileRes = await window.apiCodeforces.getProfile();
      if (!profileRes.connected) {
        renderNoProfile();
        return;
      }

      renderLayout();

      // Load all data in parallel
      const [ratingRes, tagRes, diffRes, verdictRes, weeklyRes] = await Promise.all([
        window.apiAnalytics.ratingHistory().catch(() => null),
        window.apiAnalytics.tagDistribution().catch(() => null),
        window.apiAnalytics.ratingDistribution().catch(() => null),
        window.apiFetch('/api/analytics/verdicts').catch(() => null),
        window.apiFetch('/api/analytics/weekly-summary').catch(() => null),
      ]);

      if (ratingRes) renderStatsCards(ratingRes.stats, profileRes.profile);
      if (ratingRes) renderRatingChart(ratingRes.history, ratingRes.stats);
      if (tagRes) renderTagChart(tagRes.tags);
      if (diffRes) renderDifficultyChart(diffRes.buckets);
      if (verdictRes) renderVerdictChart(verdictRes.verdicts);
      if (weeklyRes) renderWeeklySummary(weeklyRes.weeks);
    } catch (err) {
      renderNoProfile();
    }
  }

  // ── Stats Cards ──
  function renderStatsCards(stats, profile) {
    const cards = document.getElementById('stats-cards');
    if (!cards) return;

    const items = [
      { label: 'Current', value: profile.cf_rating || stats.current_rating, color: getRatingColor(profile.cf_rating) },
      { label: 'Max Rating', value: stats.max_rating, color: '#ca8a04' },
      { label: 'Contests', value: stats.total_contests, color: 'var(--blue)' },
      { label: 'Avg Δ', value: (stats.avg_rating_change >= 0 ? '+' : '') + stats.avg_rating_change, color: stats.avg_rating_change >= 0 ? 'var(--green)' : 'var(--rose)' },
      { label: 'Win Rate', value: stats.win_rate_percent + '%', color: 'var(--sigma-mid)' },
      { label: 'Best Δ', value: stats.best_contest ? '+' + stats.best_contest.change : '—', color: 'var(--green)' },
    ];

    cards.innerHTML = items.map(item => `
      <div class="stat-chip" style="padding: 12px 16px; min-width: 0;">
        <span class="stat-val" style="color: ${item.color}; font-size: 20px;">${item.value ?? '—'}</span>
        <span class="stat-lbl">${item.label}</span>
      </div>
    `).join('');
  }

  // ── Rating Line Chart ──
  function renderRatingChart(history, stats) {
    destroyChart('rating');
    const canvas = document.getElementById('chart-rating');
    if (!canvas || !history.length) return;

    const labels = history.map(h => {
      const d = new Date(h.contest_time * 1000);
      return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    });
    const ratings = history.map(h => h.new_rating);
    const pointColors = ratings.map(r => getRatingColor(r));

    charts.rating = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Rating',
          data: ratings,
          borderColor: '#7c3aed',
          backgroundColor: 'rgba(124, 58, 237, 0.08)',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: pointColors,
          pointBorderColor: pointColors,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (ctx) => {
                const i = ctx[0].dataIndex;
                return history[i].contest_name || `Contest #${history[i].contest_id}`;
              },
              label: (ctx) => {
                const i = ctx.dataIndex;
                const h = history[i];
                const delta = h.rating_change;
                return `Rating: ${h.new_rating} (${delta >= 0 ? '+' : ''}${delta})`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#8896a5', maxRotation: 45 },
            grid: { display: false },
          },
          y: {
            ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#8896a5' },
            grid: { color: 'rgba(228,233,240,0.5)' },
          },
        },
      },
    });
  }

  // ── Tag Horizontal Bar Chart ──
  function renderTagChart(tags) {
    destroyChart('tags');
    const canvas = document.getElementById('chart-tags');
    if (!canvas || !tags.length) return;

    const top15 = tags.slice(0, 15);
    const bgColors = top15.map(t => {
      const rate = t.success_rate || 0;
      if (rate >= 70) return 'rgba(5,150,105,0.7)';
      if (rate >= 50) return 'rgba(202,138,4,0.7)';
      return 'rgba(225,29,72,0.7)';
    });

    charts.tags = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: top15.map(t => t.tag),
        datasets: [{
          label: 'Solved',
          data: top15.map(t => t.solved || 0),
          backgroundColor: bgColors,
          borderRadius: 4,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const t = top15[ctx.dataIndex];
                return `Solved: ${t.solved}/${t.total} (${t.success_rate}%)`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#8896a5' },
            grid: { color: 'rgba(228,233,240,0.3)' },
          },
          y: {
            ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#4a5568' },
            grid: { display: false },
          },
        },
      },
    });
  }

  // ── Difficulty Distribution Bar Chart ──
  function renderDifficultyChart(buckets) {
    destroyChart('difficulty');
    const canvas = document.getElementById('chart-difficulty');
    if (!canvas || !buckets.length) return;

    charts.difficulty = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: buckets.map(b => b.range_label),
        datasets: [
          {
            label: 'Solved',
            data: buckets.map(b => b.solved || 0),
            backgroundColor: 'rgba(5,150,105,0.7)',
            borderRadius: 4,
          },
          {
            label: 'Attempted',
            data: buckets.map(b => (b.attempted || 0)),
            backgroundColor: 'rgba(217,119,6,0.5)',
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { font: { family: 'JetBrains Mono', size: 10 }, color: '#4a5568' },
          },
        },
        scales: {
          x: {
            ticks: { font: { family: 'JetBrains Mono', size: 9 }, color: '#8896a5', maxRotation: 45 },
            grid: { display: false },
          },
          y: {
            ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#8896a5' },
            grid: { color: 'rgba(228,233,240,0.3)' },
          },
        },
      },
    });
  }

  // ── Verdict Doughnut Chart ──
  function renderVerdictChart(verdicts) {
    destroyChart('verdicts');
    const canvas = document.getElementById('chart-verdicts');
    if (!canvas || !verdicts.length) return;

    const verdictColors = {
      'OK':                   '#059669',
      'WRONG_ANSWER':         '#e11d48',
      'TIME_LIMIT_EXCEEDED':  '#d97706',
      'RUNTIME_ERROR':        '#7c3aed',
      'COMPILATION_ERROR':    '#6366f1',
      'MEMORY_LIMIT_EXCEEDED':'#0284c7',
    };

    charts.verdicts = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: verdicts.map(v => v.verdict.replace(/_/g, ' ')),
        datasets: [{
          data: verdicts.map(v => v.count),
          backgroundColor: verdicts.map(v => verdictColors[v.verdict] || '#94a3b8'),
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '55%',
        plugins: {
          legend: {
            position: 'right',
            labels: { font: { family: 'JetBrains Mono', size: 9 }, color: '#4a5568', padding: 8 },
          },
        },
      },
    });
  }

  // ── Weekly Summary Table ──
  function renderWeeklySummary(weeks) {
    const container = document.getElementById('weekly-summary');
    if (!container) return;

    if (!weeks || !weeks.length) {
      container.innerHTML = '<p style="font-family: var(--font-mono); font-size: 12px; color: var(--text-3);">No recent activity data.</p>';
      return;
    }

    container.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; font-family: var(--font-mono); font-size: 11px;">
        <thead>
          <tr style="color: var(--text-3); text-transform: uppercase; font-size: 9px; letter-spacing: 0.1em;">
            <th style="text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--border);">Week</th>
            <th style="text-align: right; padding: 6px 8px; border-bottom: 1px solid var(--border);">Problems</th>
            <th style="text-align: right; padding: 6px 8px; border-bottom: 1px solid var(--border);">Accepted</th>
            <th style="text-align: right; padding: 6px 8px; border-bottom: 1px solid var(--border);">Avg Diff</th>
          </tr>
        </thead>
        <tbody>
          ${weeks.map(w => `
            <tr>
              <td style="padding: 8px; color: var(--text-2);">${new Date(w.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
              <td style="padding: 8px; text-align: right; color: var(--text-1); font-weight: 700;">${w.unique_problems}</td>
              <td style="padding: 8px; text-align: right; color: var(--green); font-weight: 700;">${w.accepted}</td>
              <td style="padding: 8px; text-align: right; color: var(--sigma-mid);">${w.avg_difficulty || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // ── Chart Lifecycle ──
  function destroyChart(name) {
    if (charts[name]) {
      charts[name].destroy();
      delete charts[name];
    }
  }

  function destroyAllCharts() {
    Object.keys(charts).forEach(destroyChart);
  }

  // ── Page Lifecycle ──
  window.addEventListener('page:change', (e) => {
    if (e.detail.page === 'analytics') {
      loadAnalytics();
    } else {
      destroyAllCharts();
    }
  });
})();
