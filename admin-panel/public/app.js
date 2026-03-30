const API_BASE_URL = window.__ADMIN_CONFIG__?.API_BASE_URL || 'http://localhost:3011';
const ALERTS_REFRESH_MS = Math.max(5000, Number(window.__ADMIN_CONFIG__?.ALERTS_REFRESH_MS || 30000));

const state = {
  token: localStorage.getItem('plxy_admin_token') || '',
  page: 'queue',
  cache: {},
  lastUndoLogId: null,
  alertsTimer: null,
};

const ui = {
  login: document.getElementById('login-screen'),
  panel: document.getElementById('panel-screen'),
  content: document.getElementById('page-content'),
  title: document.getElementById('page-title'),
  quickSearch: document.getElementById('quick-search'),
  banner: document.getElementById('banner'),
  error: document.getElementById('error-banner'),
  modal: document.getElementById('modal'),
  modalTitle: document.getElementById('modal-title'),
  modalBody: document.getElementById('modal-body'),
  modalConfirm: document.getElementById('modal-confirm'),
  modalCancel: document.getElementById('modal-cancel'),
  navButtons: [...document.querySelectorAll('[data-page]')],
};

function setActiveNav(page) {
  (ui.navButtons || []).forEach((btn) => {
    const btnPage = btn.getAttribute('data-page');
    if (btnPage === page) {
      btn.classList.add('active-nav');
    } else {
      btn.classList.remove('active-nav');
    }
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function banner(type, message) {
  ui.banner.className = `banner ${type}`;
  ui.banner.textContent = message;
  ui.banner.classList.remove('hidden');
  setTimeout(() => ui.banner.classList.add('hidden'), 2500);
}

function showError(message) {
  ui.error.textContent = message;
  ui.error.classList.remove('hidden');
}

function clearError() {
  ui.error.classList.add('hidden');
}

function showModal({ title, body, onConfirm }) {
  ui.modalTitle.textContent = title;
  ui.modalBody.textContent = body;
  ui.modal.classList.remove('hidden');
  ui.modalConfirm.onclick = () => {
    ui.modal.classList.add('hidden');
    onConfirm();
  };
  ui.modalCancel.onclick = () => ui.modal.classList.add('hidden');
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch (e) { json = {}; }
  if (!response.ok) {
    throw new Error(json.message || json.error || `Request failed ${response.status}`);
  }
  return json;
}

function renderLogin() {
  ui.login.innerHTML = `
    <div class="card" style="max-width: 420px; margin: 80px auto;">
      <h2>Admin Login</h2>
      <form id="admin-login-form">
        <input type="email" name="email" placeholder="Email" required />
        <input type="password" name="password" placeholder="Password" required />
        <button type="submit" class="btn-primary">Sign in</button>
      </form>
    </div>
  `;
  document.getElementById('admin-login-form').onsubmit = async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.target).entries());
    try {
      const data = await api('/api/admin/auth/login', { method: 'POST', body });
      state.token = data.token;
      localStorage.setItem('plxy_admin_token', state.token);
      ui.login.classList.add('hidden');
      ui.panel.classList.remove('hidden');
      banner('success', 'Logged in');
      await renderPage();
    } catch (error) {
      banner('error', error.message);
    }
  };
}

async function renderQueue() {
  const rows = await api('/api/admin/queue');
  state.cache.queue = rows;
  ui.content.innerHTML = `
    <div class="row">
      <button class="btn-primary" data-queue-action="APPROVE">Bulk approve</button>
      <button class="btn-ghost" data-queue-action="REJECT">Bulk reject</button>
      <button class="btn-ghost" data-queue-action="DELETE">Bulk delete</button>
      <button class="btn-ghost" id="queue-undo">Undo Last</button>
    </div>
    <div class="card">
      <table class="table">
        <thead><tr><th></th><th>Type</th><th>Status</th><th>Title/Name</th><th>Submitted By</th><th>Reports</th><th>Assigned</th><th>Created</th></tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td><input type="checkbox" data-queue-id="${row.id}" /></td>
              <td>${escapeHtml(row.type)}</td>
              <td><span class="pill">${escapeHtml(row.status)}</span></td>
              <td>${escapeHtml(row.title_or_name)}</td>
              <td>${escapeHtml(row.submitted_by)}</td>
              <td>${escapeHtml(row.report_count)}</td>
              <td>${escapeHtml(row.assigned_admin || '-')}</td>
              <td>${new Date(row.created_at).toLocaleString()}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
  document.getElementById('queue-undo').onclick = async () => {
    if (!state.lastUndoLogId) return banner('error', 'No undo log available');
    try {
      await api('/api/admin/queue/bulk-action/undo', { method: 'POST', body: { log_id: state.lastUndoLogId } });
      banner('success', 'Undo successful');
      await renderQueue();
    } catch (error) {
      banner('error', error.message);
    }
  };
}

async function renderContent() {
  const rows = await api('/api/admin/content?limit=2000');
  state.cache.content = rows;
  ui.content.innerHTML = rows.map((row) => `
    <article class="card">
      <h4>${escapeHtml(row.title)} <span class="pill">${escapeHtml(row.content_type)}</span></h4>
      <p class="pill">${row.is_published ? 'Published' : 'Pending'}</p>
      <p><strong>Creator:</strong> ${escapeHtml(row.creator_name)}</p>
      <pre>${escapeHtml(row.body)}</pre>
      <p><a href="${escapeHtml(row.media_url)}" target="_blank" rel="noreferrer">Media link</a></p>
      <div class="row">
        <button data-publish="${row.id}" data-next="${row.is_published ? 0 : 1}" class="btn-primary">${row.is_published ? 'Unpublish' : 'Approve & Publish'}</button>
        <button data-delete-content="${row.id}" class="btn-ghost">Delete</button>
      </div>
    </article>
  `).join('') || '<div class="card">No content rows.</div>';
}

async function renderUsers() {
  const q = ui.quickSearch.value.trim();
  const data = await api(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  state.cache.users = data.users;
  ui.content.innerHTML = `
    <div class="card">
      <p>Active Admin Count: <strong>${data.active_admin_count}</strong> (single-admin policy enforced)</p>
      <table class="table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Suspended</th><th>Verified</th><th>Actions</th></tr></thead>
        <tbody>
          ${data.users.map((user) => `
            <tr>
              <td>${escapeHtml(user.name)}</td>
              <td>${escapeHtml(user.email)}</td>
              <td>${escapeHtml(user.role)}</td>
              <td>${user.is_suspended ? 'Yes' : 'No'}</td>
              <td>${user.is_email_verified ? 'Yes' : 'No'}</td>
              <td>
                <div class="row">
                  <button data-suspend="${user.user_id}" data-next="${user.is_suspended ? 0 : 1}">${user.is_suspended ? 'Reactivate' : 'Suspend'}</button>
                  <button data-verify="${user.user_id}" data-next="${user.is_email_verified ? 0 : 1}">${user.is_email_verified ? 'Unverify' : 'Verify'}</button>
                  <button data-role="${user.user_id}" data-next="${user.role === 'CREATOR' ? 'BUSINESS' : 'CREATOR'}">Role ${user.role === 'CREATOR' ? 'BUSINESS' : 'CREATOR'}</button>
                  <button data-reset="${user.user_id}">Force Reset PW</button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function renderAudit() {
  const rows = await api('/api/admin/audit?limit=2000');
  state.cache.audit = rows;
  ui.content.innerHTML = `
    <div class="row"><a class="btn-ghost" href="${API_BASE_URL}/api/admin/audit/export" target="_blank" rel="noreferrer">Export Audit</a></div>
    <div class="card">
      ${rows.map((row) => `
        <article>
          <p><strong>${escapeHtml(row.action_type)}</strong> by ${escapeHtml(row.actor)} on ${escapeHtml(row.target)} at ${new Date(row.created_at).toLocaleString()}</p>
          <pre>${escapeHtml(row.before_snapshot || '')}</pre>
          <pre>${escapeHtml(row.after_snapshot || '')}</pre>
          <hr />
        </article>
      `).join('')}
    </div>
  `;
}

async function renderAnalytics() {
  const data = await api('/api/admin/analytics');
  state.cache.analytics = data;
  ui.content.innerHTML = `
    <div class="card">
      <h4>Analytics ${data.mock ? '<span class="pill">Mock</span>' : ''}</h4>
      <p>Creators: ${data.kpis.creators}</p>
      <p>Businesses: ${data.kpis.businesses}</p>
      <p>Total content: ${data.kpis.total_content}</p>
      <p>Published: ${data.kpis.published_content}</p>
      <p>Pending: ${data.kpis.pending_content}</p>
      <p>Last 7 days: ${data.kpis.last_7_days_content}</p>
      <div>${data.trend.map((row) => `<p>${row.day}: ${row.count}</p>`).join('')}</div>
      <button id="refresh-analytics" class="btn-ghost">Refresh</button>
    </div>
  `;
  document.getElementById('refresh-analytics').onclick = renderAnalytics;
}

async function renderAlerts() {
  const data = await api('/api/admin/alerts');
  state.cache.alerts = data;
  ui.content.innerHTML = `
    <div class="card">
      <h4>Live Alerts ${data.mock ? '<span class="pill">Mock</span>' : ''}</h4>
      <h5>New Content</h5>
      ${data.new_content.map((row) => `<p>${escapeHtml(row.title)} (${new Date(row.created_at).toLocaleString()})</p>`).join('') || '<p>None</p>'}
      <h5>New Users</h5>
      ${data.new_users.map((row) => `<p>${escapeHtml(row.name)} (${escapeHtml(row.role)})</p>`).join('') || '<p>None</p>'}
    </div>
  `;
  clearInterval(state.alertsTimer);
  state.alertsTimer = setInterval(renderAlerts, ALERTS_REFRESH_MS);
}

function renderSecurity() {
  ui.content.innerHTML = `
    <form id="security-form" class="card">
      <h4>Change Admin Password</h4>
      <input type="password" name="currentPassword" placeholder="Current password" required />
      <input type="password" name="newPassword" placeholder="New password" required />
      <button class="btn-primary" type="submit">Change password</button>
    </form>
  `;
  document.getElementById('security-form').onsubmit = async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.target).entries());
    try {
      await api('/api/admin/auth/change-password', { method: 'POST', body });
      banner('success', 'Admin password updated');
    } catch (error) {
      banner('error', error.message);
    }
  };
}

async function renderPage() {
  ui.title.textContent = state.page === 'alerts' ? 'Live Alerts' : state.page[0].toUpperCase() + state.page.slice(1);
  setActiveNav(state.page);
  clearError();
  try {
    if (state.page === 'queue') return renderQueue();
    if (state.page === 'content') return renderContent();
    if (state.page === 'users') return renderUsers();
    if (state.page === 'audit') return renderAudit();
    if (state.page === 'analytics') return renderAnalytics();
    if (state.page === 'alerts') return renderAlerts();
    return renderSecurity();
  } catch (error) {
    showError(`${error.message}. Showing last available data.`);
    ui.content.innerHTML = `<pre class="card">${escapeHtml(JSON.stringify(state.cache[state.page] || {}, null, 2))}</pre>`;
  }
}

document.body.addEventListener('click', async (event) => {
  const page = event.target.getAttribute('data-page');
  if (page) {
    state.page = page;
    setActiveNav(page);
    if (page !== 'alerts') {
      clearInterval(state.alertsTimer);
    }
    return renderPage();
  }

  const action = event.target.getAttribute('data-queue-action');
  if (action) {
    const ids = [...document.querySelectorAll('[data-queue-id]:checked')].map((el) => Number(el.getAttribute('data-queue-id')));
    if (!ids.length) return banner('error', 'Select at least one queue item');
    try {
      const data = await api('/api/admin/queue/bulk-action', { method: 'POST', body: { action, ids } });
      state.lastUndoLogId = data.undo_log_id;
      banner('success', `Queue ${action.toLowerCase()} successful`);
      await renderQueue();
    } catch (error) {
      banner('error', error.message);
    }
  }

  const publishId = event.target.getAttribute('data-publish');
  if (publishId) {
    const next = Number(event.target.getAttribute('data-next')) === 1;
    const row = (state.cache.content || []).find((item) => Number(item.id) === Number(publishId));
    try {
      await api(`/api/admin/content/${publishId}`, {
        method: 'PUT',
        body: {
          title: row.title,
          body: row.body,
          media_url: row.media_url,
          content_type: row.content_type,
          is_published: next,
        },
      });
      banner('success', next ? 'Content published' : 'Content unpublished');
      await renderContent();
    } catch (error) {
      banner('error', error.message);
    }
  }

  const deleteId = event.target.getAttribute('data-delete-content');
  if (deleteId) {
    showModal({
      title: 'Delete content',
      body: 'Delete this content item?',
      onConfirm: async () => {
        try {
          await api(`/api/admin/content/${deleteId}`, { method: 'DELETE' });
          banner('success', 'Content deleted');
          await renderContent();
        } catch (error) {
          banner('error', error.message);
        }
      },
    });
  }

  const suspend = event.target.getAttribute('data-suspend');
  if (suspend) {
    const next = Number(event.target.getAttribute('data-next')) === 1;
    await api(`/api/admin/users/${suspend}/suspend`, { method: 'POST', body: { suspend: next } });
    banner('success', next ? 'User suspended' : 'User reactivated');
    return renderUsers();
  }

  const verify = event.target.getAttribute('data-verify');
  if (verify) {
    const next = Number(event.target.getAttribute('data-next')) === 1;
    await api(`/api/admin/users/${verify}/email-verify`, { method: 'PUT', body: { verified: next } });
    banner('success', next ? 'Email verified' : 'Email unverified');
    return renderUsers();
  }

  const role = event.target.getAttribute('data-role');
  if (role) {
    const nextRole = event.target.getAttribute('data-next');
    await api(`/api/admin/users/${role}/role`, { method: 'PUT', body: { role: nextRole } });
    banner('success', `Role changed to ${nextRole}`);
    return renderUsers();
  }

  const reset = event.target.getAttribute('data-reset');
  if (reset) {
    showModal({
      title: 'Reset Password',
      body: 'Force reset to Password1!?',
      onConfirm: async () => {
        await api('/api/admin/users/reset-password', { method: 'POST', body: { userId: Number(reset), newPassword: 'Password1!' } });
        banner('success', 'Password reset');
      },
    });
  }
});

ui.quickSearch.oninput = () => {
  if (state.page === 'users') {
    renderUsers();
  }
};

document.getElementById('signout-btn').onclick = () => {
  clearInterval(state.alertsTimer);
  api('/api/admin/auth/logout', { method: 'POST' }).catch(() => {});
  localStorage.removeItem('plxy_admin_token');
  state.token = '';
  ui.panel.classList.add('hidden');
  ui.login.classList.remove('hidden');
  renderLogin();
};

if (state.token) {
  ui.login.classList.add('hidden');
  ui.panel.classList.remove('hidden');
  renderPage();
} else {
  renderLogin();
}
