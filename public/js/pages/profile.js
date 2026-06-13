// js/pages/profile.js — Codeforces Profile Connection Page
// Handles CF handle connection, profile display, sync status, and disconnect.

(function () {
  const page = document.getElementById('page-profile');
  let profileData = null;
  let pollTimer = null;

  // Rating tier colors (matches Codeforces)
  const RANK_COLORS = {
    'newbie':                    '#808080',
    'pupil':                    '#008000',
    'specialist':               '#03a89e',
    'expert':                   '#0000ff',
    'candidate master':         '#aa00aa',
    'master':                   '#ff8c00',
    'international master':     '#ff8c00',
    'grandmaster':              '#ff0000',
    'international grandmaster':'#ff0000',
    'legendary grandmaster':    '#aa0000',
  };

  function getRankColor(rank) {
    return RANK_COLORS[(rank || '').toLowerCase()] || '#808080';
  }

  // ── Render: Not Connected ──
  function renderConnectForm() {
    page.querySelector('.page').innerHTML = `
      <header style="padding: 32px 0 26px; border-bottom: 1px solid var(--border); margin-bottom: 40px;">
        <div>
          <h1 style="font-family: var(--font-sans); font-size: 24px; font-weight: 800; color: var(--text-1);">Codeforces Profile</h1>
          <p style="font-family: var(--font-mono); font-size: 12px; color: var(--text-3); margin-top: 4px;">Connect your handle to unlock analytics, weakness detection, and coaching</p>
        </div>
      </header>

      <div class="form-panel" style="max-width: 520px;">
        <div class="section-label"><span>// connect your handle</span></div>
        <form id="cf-connect-form" autocomplete="off" style="margin-top: 14px;">
          <div class="field" style="margin-bottom: 16px;">
            <label for="cf-handle-input">Codeforces Handle</label>
            <input id="cf-handle-input" type="text" placeholder="e.g. tourist" required 
                   style="font-size: 15px; padding: 12px 16px;" />
          </div>
          <p style="font-family: var(--font-mono); font-size: 11px; color: var(--text-3); margin-bottom: 18px; line-height: 1.6;">
            We'll fetch your rating, contest history, and submission data from the Codeforces API.<br/>
            Your data is synced automatically every 30 minutes.
          </p>
          <button class="btn-add" type="submit" id="cf-connect-btn" style="width: 100%; text-align: center;">
            🔗 Connect Codeforces Handle
          </button>
        </form>
        <div id="cf-connect-error" style="display: none; margin-top: 12px; font-family: var(--font-mono); font-size: 12px; color: var(--rose); padding: 10px; background: rgba(225,29,72,0.08); border-radius: 8px;"></div>
      </div>
    `;

    document.getElementById('cf-connect-form').addEventListener('submit', handleConnect);
  }

  // ── Render: Connected Profile ──
  function renderProfile(data) {
    const p = data.profile;
    const rankColor = getRankColor(p.cf_rank);
    const syncTime = p.last_synced_at ? new Date(p.last_synced_at).toLocaleString() : 'Never';
    const isSyncing = p.sync_status === 'syncing';

    page.querySelector('.page').innerHTML = `
      <header style="padding: 32px 0 26px; border-bottom: 1px solid var(--border); margin-bottom: 40px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1 style="font-family: var(--font-sans); font-size: 24px; font-weight: 800; color: var(--text-1);">Codeforces Profile</h1>
          <p style="font-family: var(--font-mono); font-size: 12px; color: var(--text-3); margin-top: 4px;">Linked to <strong style="color: ${rankColor};">${escH(p.cf_handle)}</strong></p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn-add" id="cf-sync-btn" ${isSyncing ? 'disabled' : ''} style="font-size: 11px; padding: 8px 16px;">
            ${isSyncing ? '⏳ Syncing…' : '🔄 Sync Now'}
          </button>
          <button class="btn-add" id="cf-disconnect-btn" style="font-size: 11px; padding: 8px 16px; background: var(--rose); box-shadow: 0 2px 8px rgba(225,29,72,0.3);">
            Disconnect
          </button>
        </div>
      </header>

      <!-- Profile Card -->
      <div style="display: grid; grid-template-columns: auto 1fr; gap: 28px; margin-bottom: 36px;">
        <div style="width: 100px; height: 100px; border-radius: 16px; overflow: hidden; border: 3px solid ${rankColor}; box-shadow: 0 4px 16px rgba(0,0,0,0.1);">
          ${p.cf_avatar
            ? `<img src="${escH(p.cf_avatar)}" alt="${escH(p.cf_handle)}" style="width: 100%; height: 100%; object-fit: cover;" />`
            : `<div style="width:100%;height:100%;background:var(--bg-input);display:grid;place-items:center;font-size:32px;">👤</div>`
          }
        </div>
        <div>
          <h2 style="font-family: var(--font-sans); font-size: 22px; font-weight: 800; color: ${rankColor}; margin-bottom: 4px;">
            ${escH(p.cf_handle)}
          </h2>
          <p style="font-family: var(--font-mono); font-size: 13px; color: var(--text-2); text-transform: capitalize; margin-bottom: 12px;">
            ${escH(p.cf_rank || 'newbie')} ${p.cf_max_rank !== p.cf_rank ? `(max: ${escH(p.cf_max_rank)})` : ''}
          </p>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${statChip('Rating', p.cf_rating, rankColor)}
            ${statChip('Max Rating', p.cf_max_rating, '#ca8a04')}
            ${statChip('Contribution', p.cf_contribution >= 0 ? '+' + p.cf_contribution : p.cf_contribution, p.cf_contribution >= 0 ? 'var(--green)' : 'var(--rose)')}
          </div>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="section-label"><span>// sync statistics</span></div>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-bottom: 28px;">
        ${bigStat('📝', 'Submissions Synced', p.total_submissions_synced)}
        ${bigStat('✅', 'Problems Solved', p.problems_solved)}
        ${bigStat('🔄', 'Problems Attempted', p.problems_attempted)}
        ${bigStat('📊', 'Total Tracked', p.total_problems)}
      </div>

      <!-- Sync Status -->
      <div class="section-label"><span>// sync status</span></div>
      <div class="form-panel" style="display: flex; align-items: center; gap: 16px; padding: 18px 22px;">
        <div style="width: 10px; height: 10px; border-radius: 50; flex-shrink: 0;
                    background: ${isSyncing ? '#facc15' : p.sync_status === 'error' ? '#ef4444' : '#22c55e'};
                    ${isSyncing ? 'animation: pulse 1.5s ease infinite;' : ''}
                    border-radius: 50%;"></div>
        <div>
          <div style="font-family: var(--font-mono); font-size: 12px; font-weight: 700; color: var(--text-1);">
            ${isSyncing ? 'Syncing in progress…' : p.sync_status === 'error' ? 'Sync Error' : 'Last sync successful'}
          </div>
          <div style="font-family: var(--font-mono); font-size: 10px; color: var(--text-3); margin-top: 2px;">
            ${p.sync_status === 'error' ? escH(p.sync_error_message || 'Unknown error') : `Last synced: ${syncTime}`}
          </div>
        </div>
      </div>
    `;

    document.getElementById('cf-sync-btn').addEventListener('click', handleSync);
    document.getElementById('cf-disconnect-btn').addEventListener('click', handleDisconnect);

    // If syncing, poll for status updates
    if (isSyncing) {
      startPolling();
    } else {
      stopPolling();
    }

    // Update sidebar sync indicator
    updateSidebarSync(isSyncing);
  }

  function statChip(label, value, color) {
    return `
      <div class="stat-chip" style="padding: 8px 14px; min-width: 0;">
        <span class="stat-val" style="color: ${color}; font-size: 18px;">${value ?? '—'}</span>
        <span class="stat-lbl">${escH(label)}</span>
      </div>
    `;
  }

  function bigStat(icon, label, value) {
    return `
      <div class="form-panel" style="padding: 16px 18px; margin-bottom: 0; display: flex; align-items: center; gap: 14px;">
        <span style="font-size: 24px;">${icon}</span>
        <div>
          <div style="font-family: var(--font-mono); font-size: 20px; font-weight: 700; color: var(--text-1);">${value ?? 0}</div>
          <div style="font-family: var(--font-mono); font-size: 9px; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.1em;">${escH(label)}</div>
        </div>
      </div>
    `;
  }

  function escH(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Handlers ──
  async function handleConnect(e) {
    e.preventDefault();
    const btn = document.getElementById('cf-connect-btn');
    const errorEl = document.getElementById('cf-connect-error');
    const handle = document.getElementById('cf-handle-input').value.trim();

    btn.disabled = true;
    btn.textContent = '⏳ Connecting…';
    errorEl.style.display = 'none';

    try {
      const result = await window.apiCodeforces.connect(handle);
      profileData = { connected: true, profile: result.profile };
      toast('✅ Codeforces profile connected! Syncing data…');
      renderProfile(profileData);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = '🔗 Connect Codeforces Handle';
    }
  }

  async function handleSync() {
    const btn = document.getElementById('cf-sync-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Syncing…';

    try {
      await window.apiCodeforces.sync();
      toast('Sync started!');
      startPolling();
      updateSidebarSync(true);
    } catch (err) {
      toast(err.message, true);
      btn.disabled = false;
      btn.textContent = '🔄 Sync Now';
    }
  }

  async function handleDisconnect() {
    if (!confirm('Are you sure? This will delete all synced Codeforces data.')) return;

    try {
      await window.apiCodeforces.disconnect();
      profileData = null;
      stopPolling();
      toast('Codeforces profile disconnected.');
      renderConnectForm();
      updateSidebarSync(false);
    } catch (err) {
      toast('Disconnect failed: ' + err.message, true);
    }
  }

  // ── Polling for sync status ──
  function startPolling() {
    stopPolling();
    pollTimer = setInterval(async () => {
      try {
        const data = await window.apiCodeforces.getProfile();
        if (data.connected && data.profile.sync_status !== 'syncing') {
          profileData = data;
          renderProfile(data);
          stopPolling();
        }
      } catch { /* ignore polling errors */ }
    }, 3000);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function updateSidebarSync(syncing) {
    const el = document.getElementById('sync-status');
    if (!el) return;
    const dot = el.querySelector('.sync-dot');
    const text = el.querySelector('span:last-child');
    if (dot) dot.className = syncing ? 'sync-dot syncing' : 'sync-dot';
    if (text) text.textContent = syncing ? 'Syncing…' : 'System ready';
  }

  // ── Page Lifecycle ──
  async function loadProfile() {
    try {
      const data = await window.apiCodeforces.getProfile();
      profileData = data;
      if (data.connected) {
        renderProfile(data);
      } else {
        renderConnectForm();
      }
    } catch {
      renderConnectForm();
    }
  }

  // Listen for navigation to this page
  window.addEventListener('page:change', (e) => {
    if (e.detail.page === 'profile') {
      loadProfile();
    } else {
      stopPolling();
    }
  });
})();
