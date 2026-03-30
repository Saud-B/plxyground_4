const API_BASE_URL = window.__APP_CONFIG__?.API_BASE_URL || 'http://localhost:3011';

const state = {
  token: localStorage.getItem('plxy_token') || '',
  user: JSON.parse(localStorage.getItem('plxy_user') || 'null'),
  tab: 'feed',
  feed: [],
  creators: [],
  myProfile: null,
  accessibility: readAccessibilitySettings(),
};

const ui = {
  landing: document.getElementById('landing-screen'),
  auth: document.getElementById('auth-screen'),
  app: document.getElementById('app-screen'),
  terms: document.getElementById('terms-screen'),
  privacy: document.getElementById('privacy-screen'),
  help: document.getElementById('help-screen'),
  tabContent: document.getElementById('tab-content'),
  menuButton: document.getElementById('menu-btn'),
  menuPanel: document.getElementById('dashboard-menu'),
  title: document.getElementById('app-title'),
  banner: document.getElementById('banner'),
  modal: document.getElementById('modal'),
  modalTitle: document.getElementById('modal-title'),
  modalText: document.getElementById('modal-text'),
  modalConfirm: document.getElementById('modal-confirm'),
  modalCancel: document.getElementById('modal-cancel'),
};

function readAccessibilitySettings() {
  const defaults = { fontSize: 'normal', highContrast: false, reduceMotion: false, darkMode: false, mobilePreview: false };
  try {
    const raw = localStorage.getItem('plxy_accessibility');
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      fontSize: parsed.fontSize === 'large' ? 'large' : 'normal',
      highContrast: Boolean(parsed.highContrast),
      reduceMotion: Boolean(parsed.reduceMotion),
      darkMode: Boolean(parsed.darkMode),
      mobilePreview: Boolean(parsed.mobilePreview),
    };
  } catch (error) {
    return defaults;
  }
}

function applyAccessibilitySettings() {
  const body = document.body;
  body.classList.toggle('a11y-font-large', state.accessibility.fontSize === 'large');
  body.classList.toggle('a11y-dark-mode', state.accessibility.darkMode);
  body.classList.toggle('a11y-high-contrast', state.accessibility.highContrast);
  body.classList.toggle('a11y-reduce-motion', state.accessibility.reduceMotion);
  body.classList.toggle('mobile-preview', state.accessibility.mobilePreview);
}

function persistAccessibilitySettings(nextSettings) {
  state.accessibility = {
    ...state.accessibility,
    ...nextSettings,
  };
  localStorage.setItem('plxy_accessibility', JSON.stringify(state.accessibility));
  applyAccessibilitySettings();
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function showBanner(type, text) {
  ui.banner.className = `banner ${type}`;
  ui.banner.textContent = text;
  ui.banner.classList.remove('hidden');
  setTimeout(() => ui.banner.classList.add('hidden'), 3000);
}

function showModal({ title, text, onConfirm }) {
  ui.modalTitle.textContent = title;
  ui.modalText.textContent = text;
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
    const message = json.message || json.error || `Request failed: ${response.status}`;
    throw new Error(message);
  }
  return json;
}

async function uploadMediaFile(file) {
  const form = new FormData();
  form.append('media', file);
  const response = await fetch(`${API_BASE_URL}/api/uploads`, {
    method: 'POST',
    headers: {
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
    },
    body: form,
  });
  const text = await response.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch (e) { json = {}; }
  if (!response.ok) {
    const message = json.message || json.error || `Upload failed: ${response.status}`;
    throw new Error(message);
  }
  return json;
}

function setAuth(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem('plxy_token', token);
  localStorage.setItem('plxy_user', JSON.stringify(user));
}

function clearAuth() {
  state.token = '';
  state.user = null;
  localStorage.removeItem('plxy_token');
  localStorage.removeItem('plxy_user');
}

function showScreen(name) {
  for (const screen of [ui.landing, ui.auth, ui.app, ui.terms, ui.privacy, ui.help]) {
    screen.classList.add('hidden');
  }
  ui[name].classList.remove('hidden');
}

function setMenuOpen(isOpen) {
  ui.menuPanel.classList.toggle('open', isOpen);
  ui.menuButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

function renderStatic() {
  ui.terms.innerHTML = `
    <article class="card static-page">
      <h2>Terms of Service</h2>
      <p>By using PLXYGROUND you agree to lawful use, respectful conduct, and moderation compliance.</p>
      <p>Media must be owned or licensed. Violations may lead to suspension.</p>
      <button data-view="landing" class="btn-ghost">Back</button>
    </article>
  `;
  ui.privacy.innerHTML = `
    <article class="card static-page">
      <h2>Privacy Policy</h2>
      <p>We store account data, profile content, and audit actions to run the platform securely.</p>
      <p>We do not sell personal data. Contact support for deletion requests in development environments.</p>
      <button data-view="landing" class="btn-ghost">Back</button>
    </article>
  `;
  ui.help.innerHTML = `
    <article class="card static-page">
      <h2>Help Center</h2>
      <p>Need support? Email support@plxyground.local for account and moderation help.</p>
      <button data-view="landing" class="btn-ghost">Back</button>
    </article>
  `;
}

function renderAuth(mode = 'creator-login') {
  const isSignup = mode.includes('signup');
  const isBusiness = mode.startsWith('business');
  ui.auth.innerHTML = `
    <section class="auth-shell">
      <article class="card auth-card">
        <h2>${isBusiness ? 'Business' : 'Creator'} ${isSignup ? 'Signup' : 'Login'}</h2>
        <form id="auth-form">
          ${isSignup ? '<input name="name" placeholder="Name" required />' : ''}
          <input type="email" name="email" placeholder="Email" required />
          <input type="password" name="password" placeholder="Password" required />
          ${isSignup ? '<input name="slug" placeholder="Profile Slug" />' : ''}
          ${isSignup ? '<label class="checkbox-field"><input type="checkbox" name="agree" required /> <span>I agree to <button class="inline-link-btn" type="button" data-view="terms">Terms</button> and <button class="inline-link-btn" type="button" data-view="privacy">Privacy</button>.</span></label>' : ''}
          <div class="row">
            <button class="btn-primary" type="submit">${isSignup ? 'Create account' : 'Login'}</button>
            <button class="btn-ghost" type="button" data-view="landing">Back</button>
          </div>
        </form>
        <div class="row auth-switches">
          <button class="btn-ghost" data-mode="${isBusiness ? 'creator' : 'business'}-${isSignup ? 'signup' : 'login'}">Switch to ${isBusiness ? 'Creator' : 'Business'} ${isSignup ? 'Signup' : 'Login'}</button>
          <button class="btn-ghost" data-mode="${isBusiness ? 'business' : 'creator'}-${isSignup ? 'login' : 'signup'}">${isSignup ? 'Have an account? Login' : 'Need account? Signup'}</button>
          ${!isSignup ? `<button class="btn-ghost" data-forgot-mode="${isBusiness ? 'business' : 'creator'}">Forgot password?</button>` : ''}
        </div>
      </article>
    </section>
  `;

  const form = document.getElementById('auth-form');
  form.onsubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      if (isSignup) {
        await api(isBusiness ? '/api/business/auth/signup' : '/api/auth/signup', {
          method: 'POST',
          body: { name: data.name, email: data.email, password: data.password, slug: data.slug },
        });
        showBanner('success', 'Signup complete. Please login.');
        return renderAuth(`${isBusiness ? 'business' : 'creator'}-login`);
      }

      const response = await api(isBusiness ? '/api/business/auth/login' : '/api/auth/login', {
        method: 'POST',
        body: { email: data.email, password: data.password },
      });
      setAuth(response.token, response.user);
      showBanner('success', 'Login successful');
      await enterApp();
    } catch (error) {
      const suspended = error.message.includes('ACCOUNT_SUSPENDED');
      showBanner('error', suspended ? 'Account suspended. Contact support.' : error.message);
    }
  };
}

function renderForgotPassword(accountType = 'creator') {
  const isBusiness = accountType === 'business';
  ui.auth.innerHTML = `
    <section class="auth-shell">
      <article class="card auth-card">
        <h2>${isBusiness ? 'Business' : 'Creator'} Forgot Password</h2>
        <form id="forgot-form">
          <input type="email" name="email" placeholder="Account email" required />
          <div class="row">
            <button class="btn-ghost" type="button" id="send-code-btn">Send verification code</button>
          </div>
          <input type="text" name="code" placeholder="6-digit verification code" required />
          <input type="password" name="newPassword" placeholder="New password (8+ chars)" required />
          <input type="password" name="confirmPassword" placeholder="Confirm new password" required />
          <div class="row">
            <button class="btn-primary" type="submit">Verify code and reset</button>
            <button class="btn-ghost" type="button" data-mode="${isBusiness ? 'business' : 'creator'}-login">Back to login</button>
          </div>
        </form>
      </article>
    </section>
  `;
  document.getElementById('send-code-btn').onclick = async () => {
    const form = document.getElementById('forgot-form');
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.email) {
      return showBanner('error', 'Enter your email first.');
    }
    try {
      const route = isBusiness ? '/api/business/auth/forgot-password/request-code' : '/api/auth/forgot-password/request-code';
      await api(route, {
        method: 'POST',
        body: { email: data.email },
      });
      showBanner('success', 'Verification code sent to your email.');
    } catch (error) {
      showBanner('error', error.message);
    }
  };
  document.getElementById('forgot-form').onsubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    if (String(data.newPassword || '').length < 8) {
      return showBanner('error', 'New password must be at least 8 characters.');
    }
    if (data.newPassword !== data.confirmPassword) {
      return showBanner('error', 'New password and confirmation must match.');
    }
    try {
      const route = isBusiness ? '/api/business/auth/forgot-password/verify-code' : '/api/auth/forgot-password/verify-code';
      await api(route, {
        method: 'POST',
        body: { email: data.email, code: data.code, newPassword: data.newPassword },
      });
      showBanner('success', 'Password reset complete. Please login.');
      renderAuth(`${isBusiness ? 'business' : 'creator'}-login`);
    } catch (error) {
      showBanner('error', error.message);
    }
  };
}

async function enterApp() {
  showScreen('app');
  state.tab = 'feed';
  setMenuOpen(false);
  await renderTab();
}

async function loadFeed(query = '') {
  state.feed = await api(`/api/content?limit=50&q=${encodeURIComponent(query)}`);
}

function contentCard(item, own = false) {
  return `
    <article class="card">
      <img src="${escapeHtml(item.media_url)}" alt="${escapeHtml(item.title)} media" onerror="this.src='https://via.placeholder.com/800x500?text=Media+Unavailable'" />
      <h3>${escapeHtml(item.title)}</h3>
      <div><span class="pill">${escapeHtml(item.content_type)}</span><span class="pill">${item.is_published ? 'Published' : 'Pending'}</span></div>
      <p>${escapeHtml(item.body)}</p>
      <p class="muted">${escapeHtml(item.creator_name || '')} - ${new Date(item.created_at).toLocaleString()}</p>
      ${own ? `<div class="row"><button data-edit-content="${item.id}" class="btn-ghost">Edit</button><button data-delete-content="${item.id}" class="btn-ghost">Delete</button></div>` : ''}
    </article>
  `;
}

async function renderDiscoveryCreatorProfile(creatorId) {
  const results = document.getElementById('discovery-results');
  if (!results) return;
  results.innerHTML = '<p>Loading profile...</p>';
  try {
    const creator = await api(`/api/creators/${encodeURIComponent(creatorId)}`);
    const publishedPosts = (creator.posts || []).filter((item) => Number(item.is_published) === 1);
    const pendingPosts = (creator.posts || []).filter((item) => Number(item.is_published) !== 1);
    results.innerHTML = `
      <div class="row"><button class="btn-ghost" data-discovery-back="1">Back to discovery</button></div>
      <div class="card">
        <h4>${escapeHtml(creator.name)} <span class="pill">${escapeHtml(creator.role)}</span></h4>
        <p>${escapeHtml(creator.bio || 'No bio yet.')}</p>
        <p class="muted">${escapeHtml(creator.location || '')}</p>
      </div>
      <h4>Published content</h4>
      ${publishedPosts.length ? publishedPosts.map((item) => contentCard(item)).join('') : '<p>No published content yet.</p>'}
      <h4>Pending review</h4>
      ${pendingPosts.length ? pendingPosts.map((item) => contentCard(item)).join('') : '<p>No pending content.</p>'}
    `;
  } catch (error) {
    results.innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
  }
}

async function renderTab() {
  ui.title.textContent = state.tab[0].toUpperCase() + state.tab.slice(1);
  document.querySelectorAll('.tab-nav [data-tab]').forEach((button) => {
    const isActive = button.getAttribute('data-tab') === state.tab;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
  if (state.tab === 'feed') {
    await loadFeed();
    ui.tabContent.innerHTML = `
      <div class="row">
        <input id="feed-search" placeholder="Search title, creator, body" />
        <button id="feed-refresh" class="btn-ghost">Refresh</button>
      </div>
      <div id="feed-list">${state.feed.length ? state.feed.map((item) => contentCard(item)).join('') : '<p>No published content yet.</p>'}</div>
    `;
    document.getElementById('feed-refresh').onclick = async () => {
      await loadFeed(document.getElementById('feed-search').value.trim());
      await renderTab();
    };
    let timer;
    document.getElementById('feed-search').oninput = (event) => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        await loadFeed(event.target.value.trim());
        document.getElementById('feed-list').innerHTML = state.feed.map((item) => contentCard(item)).join('') || '<p>No results.</p>';
      }, 300);
    };
    return;
  }

  if (state.tab === 'create') {
    ui.tabContent.innerHTML = `
      <form id="post-form">
        <h3>Create Post</h3>
        <input name="title" placeholder="Title" required />
        <textarea name="body" rows="6" placeholder="Full body" required></textarea>
        <input name="media_url" placeholder="Media URL (optional if uploading file)" />
        <label for="media-file">Attach image/video</label>
        <input id="media-file" name="media_file" type="file" accept="image/*,video/*" />
        <p class="muted">You can provide a URL, upload a file, or both (upload takes priority).</p>
        <select name="content_type">
          <option value="article">article</option>
          <option value="video_embed">video_embed</option>
          <option value="image_story">image_story</option>
        </select>
        <button class="btn-primary" type="submit">Submit for moderation</button>
      </form>
    `;
    document.getElementById('post-form').onsubmit = async (event) => {
      event.preventDefault();
      const formData = new FormData(event.target);
      const data = Object.fromEntries(formData.entries());
      const mediaFile = formData.get('media_file');
      let mediaUrl = String(data.media_url || '').trim();
      if (mediaFile && mediaFile.size > 0) {
        try {
          showBanner('success', 'Uploading media...');
          const uploaded = await uploadMediaFile(mediaFile);
          mediaUrl = uploaded.media_url;
          if ((uploaded.mime_type || '').startsWith('video/')) {
            data.content_type = 'video_embed';
          } else if ((uploaded.mime_type || '').startsWith('image/')) {
            data.content_type = 'image_story';
          }
        } catch (error) {
          return showBanner('error', error.message);
        }
      }
      if (!mediaUrl) {
        return showBanner('error', 'Add a media URL or upload a file.');
      }
      try {
        await api('/api/content', { method: 'POST', body: { ...data, media_url: mediaUrl } });
        showBanner('success', 'Post submitted to moderation queue.');
        state.tab = 'feed';
        await renderTab();
      } catch (error) {
        showBanner('error', error.message);
      }
    };
    return;
  }

  if (state.tab === 'profile') {
    const profile = await api(`/api/creators/${state.user.id}`);
    state.myProfile = profile;
    ui.tabContent.innerHTML = `
      <div class="card">
        <h3>${escapeHtml(profile.name)}</h3>
        <p>${escapeHtml(profile.bio || 'No bio')}</p>
        <p class="muted">${escapeHtml(profile.location || '')}</p>
      </div>
      <form id="profile-form">
        <h4>Edit Profile</h4>
        <textarea name="bio" rows="3" placeholder="Bio">${escapeHtml(profile.bio || '')}</textarea>
        <input name="location" placeholder="Location" value="${escapeHtml(profile.location || '')}" />
        <input name="instagram" placeholder="Instagram URL" value="${escapeHtml(profile.social_links?.instagram || '')}" />
        <button class="btn-primary" type="submit">Save profile</button>
      </form>
      <h4>Your Posts</h4>
      ${(profile.posts || []).map((item) => contentCard(item, true)).join('') || '<p>No posts.</p>'}
    `;
    document.getElementById('profile-form').onsubmit = async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.target).entries());
      try {
        await api(`/api/creators/${state.user.id}`, {
          method: 'PUT',
          body: { bio: data.bio, location: data.location, social_links: { instagram: data.instagram } },
        });
        showBanner('success', 'Profile updated');
        await renderTab();
      } catch (error) {
        showBanner('error', error.message);
      }
    };
    return;
  }

  if (state.tab === 'analytics') {
    ui.tabContent.innerHTML = `
      <div class="row">
        <button id="analytics-refresh" class="btn-ghost">Refresh analytics</button>
      </div>
      <section id="analytics-stats" class="stats-grid"></section>
      <div class="card">
        <header class="card-header">
          <div>
            <h4>Content by type</h4>
            <p class="card-subtitle">Share of total published posts</p>
          </div>
          <span class="badge">Bar chart</span>
        </header>
        <div id="analytics-content-mix" class="chart-bars"></div>
        <p class="chart-legend small">Each bar shows the percentage of all published posts that fall into that content type.</p>
      </div>
      <div class="card">
        <header class="card-header">
          <div>
            <h4>Publishing trend (last 14 days)</h4>
            <p class="card-subtitle">Posts per day over the last two weeks</p>
          </div>
          <span class="badge">Line chart</span>
        </header>
        <div id="analytics-trend"></div>
        <p class="chart-legend small">Horizontal axis shows day of month; vertical axis shows total posts published per day.</p>
      </div>
      <div id="analytics-extra" class="card">Loading analytics...</div>
    `;

    const barRow = (label, value, total) => {
      const pct = total > 0 ? Math.round((value / total) * 100) : 0;
      return `
        <div class="chart-row">
          <div class="chart-label">${escapeHtml(label)} (${value})</div>
          <div class="chart-track"><div class="chart-fill" style="width:${pct}%;"></div></div>
          <div class="chart-pct">${pct}%</div>
        </div>
      `;
    };

    const trendSvg = (points, width = 760, height = 200) => {
      if (!points.length) {
        return '<p class="muted">No trend data yet.</p>';
      }
      const maxY = Math.max(1, ...points.map((p) => p.value));
      const stepX = points.length > 1 ? width / (points.length - 1) : width;
      const coords = points.map((p, i) => {
        const x = i * stepX;
        const y = height - ((p.value / maxY) * (height - 20)) - 10;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
      const labels = points.map((p, i) => {
        const x = i * stepX;
        return `<text x="${x.toFixed(1)}" y="${height - 2}" text-anchor="middle" class="chart-axis">${escapeHtml(p.label.slice(5))}</text>`;
      }).join('');
      return `
        <svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="Daily publishing trend chart">
          <text x="8" y="14" class="chart-axis">Posts per day</text>
          <polyline points="${coords}" fill="none" stroke="var(--primary)" stroke-width="3" />
          ${labels}
        </svg>
      `;
    };

    const renderAnalytics = async () => {
      try {
        const [content, creators] = await Promise.all([
          api('/api/content?limit=100'),
          api('/api/creators?limit=100'),
        ]);
        const creatorCount = (creators || []).filter((c) => c.role === 'CREATOR').length;
        const businessCount = (creators || []).filter((c) => c.role === 'BUSINESS').length;
        const totalAccounts = creatorCount + businessCount;
        const publishedCount = (content || []).length;
        const videos = (content || []).filter((c) => c.content_type === 'video_embed').length;
        const images = (content || []).filter((c) => c.content_type === 'image_story').length;
        const articles = (content || []).filter((c) => c.content_type === 'article').length;
        const mediaTotal = videos + images + articles;
        const avgPerCreator = totalAccounts ? (publishedCount / totalAccounts) : 0;

        document.getElementById('analytics-stats').innerHTML = [
          {
            label: 'Total published posts',
            value: publishedCount.toLocaleString(),
            sub: mediaTotal ? `${Math.round((videos / mediaTotal) * 100)}% video · ${Math.round((images / mediaTotal) * 100)}% image · ${Math.round((articles / mediaTotal) * 100)}% article` : 'No content yet',
          },
          {
            label: 'Active accounts',
            value: (totalAccounts).toLocaleString(),
            sub: `${creatorCount.toLocaleString()} creators · ${businessCount.toLocaleString()} businesses`,
          },
          {
            label: 'Avg posts per account',
            value: avgPerCreator.toFixed(1),
            sub: totalAccounts ? 'Total posts ÷ total accounts' : 'No accounts yet',
          },
        ].map((stat) => `
          <article class="stat-card">
            <p class="stat-label">${escapeHtml(stat.label)}</p>
            <p class="stat-value">${escapeHtml(stat.value)}</p>
            <p class="stat-sub">${escapeHtml(stat.sub)}</p>
          </article>
        `).join('');

        document.getElementById('analytics-content-mix').innerHTML = [
          barRow('Videos', videos, mediaTotal),
          barRow('Images', images, mediaTotal),
          barRow('Articles', articles, mediaTotal),
        ].join('');

        const byDay = {};
        const now = new Date();
        for (let i = 13; i >= 0; i -= 1) {
          const d = new Date(now);
          d.setDate(now.getDate() - i);
          const key = d.toISOString().slice(0, 10);
          byDay[key] = 0;
        }
        for (const row of (content || [])) {
          const key = new Date(row.created_at).toISOString().slice(0, 10);
          if (Object.prototype.hasOwnProperty.call(byDay, key)) {
            byDay[key] += 1;
          }
        }
        const trendPoints = Object.keys(byDay).map((key) => ({ label: key, value: byDay[key] }));
        document.getElementById('analytics-trend').innerHTML = trendSvg(trendPoints);

        const latest = (content || []).slice(0, 8).map((item) => `<p>${escapeHtml(item.title)} by ${escapeHtml(item.creator_name || 'Unknown')}</p>`).join('');
        document.getElementById('analytics-extra').innerHTML = `
          <h4>Latest published posts</h4>
          ${latest || '<p>No data yet.</p>'}
        `;
      } catch (error) {
        document.getElementById('analytics-extra').innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
      }
    };

    await renderAnalytics();
    document.getElementById('analytics-refresh').onclick = renderAnalytics;
    return;
  }

  if (state.tab === 'discovery') {
    ui.tabContent.innerHTML = `
      <div class="row"><input id="discovery-q" placeholder="Search creators and content" /></div>
      <div id="discovery-results" class="card">Loading creators...</div>
    `;
    const renderDiscoveryResults = (creators, content, hasQuery) => {
      document.getElementById('discovery-results').innerHTML = `
        <h4>${hasQuery ? 'Creators' : 'Featured creators'}</h4>
        ${(creators || []).map((creator) => `
          <div class="row">
            <button class="btn-ghost discovery-creator-btn" data-discovery-creator="${creator.id}">${escapeHtml(creator.name)}</button>
            <span class="pill">${escapeHtml(creator.role)}</span>
          </div>
        `).join('') || '<p>No creators found.</p>'}
        <h4>${hasQuery ? 'Content' : 'Recent content'}</h4>
        ${(content || []).map((item) => `<p>${escapeHtml(item.title)} by ${escapeHtml(item.creator_name)}</p>`).join('') || '<p>No content found.</p>'}
      `;
    };

    try {
      const [initialCreators, initialContent] = await Promise.all([
        api('/api/creators?limit=12'),
        api('/api/content?limit=12'),
      ]);
      renderDiscoveryResults(initialCreators, initialContent, false);
    } catch (error) {
      document.getElementById('discovery-results').innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
    }

    let timer;
    document.getElementById('discovery-q').oninput = (event) => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const q = event.target.value.trim();
        if (!q) {
          try {
            const [initialCreators, initialContent] = await Promise.all([
              api('/api/creators?limit=12'),
              api('/api/content?limit=12'),
            ]);
            renderDiscoveryResults(initialCreators, initialContent, false);
            return;
          } catch (error) {
            document.getElementById('discovery-results').innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
            return;
          }
        }
        const [creators, content] = await Promise.all([
          api(`/api/creators?q=${encodeURIComponent(q)}&limit=20`),
          api(`/api/content?q=${encodeURIComponent(q)}&limit=20`),
        ]);
        renderDiscoveryResults(creators, content, true);
      }, 300);
    };
    return;
  }

  ui.tabContent.innerHTML = `
    <div class="card">
      <p>Email: ${escapeHtml(state.user?.email || '')}</p>
      <p>Role: ${escapeHtml(state.user?.role || '')}</p>
      <form id="email-form">
        <h4>Change email</h4>
        <input type="email" name="newEmail" placeholder="New email address" required />
        <input type="password" name="password" placeholder="Current password" required />
        <button class="btn-primary" type="submit">Update email</button>
      </form>
      <form id="password-form">
        <h4>Password reset</h4>
        <input type="password" name="currentPassword" placeholder="Current password" required />
        <input type="password" name="newPassword" placeholder="New password (8+ chars)" required />
        <input type="password" name="confirmPassword" placeholder="Confirm new password" required />
        <button class="btn-primary" type="submit">Update password</button>
      </form>
      <div class="row">
        <button data-view="help" class="btn-ghost">Help</button>
        <button data-view="terms" class="btn-ghost">Terms</button>
        <button data-view="privacy" class="btn-ghost">Privacy</button>
      </div>
    </div>
    <div class="card">
      <h4>Accessibility settings</h4>
      <label for="a11y-font-size">Text size</label>
      <select id="a11y-font-size">
        <option value="normal" ${state.accessibility.fontSize === 'normal' ? 'selected' : ''}>Normal</option>
        <option value="large" ${state.accessibility.fontSize === 'large' ? 'selected' : ''}>Large</option>
      </select>
      <label class="checkbox-field"><input type="checkbox" id="a11y-high-contrast" ${state.accessibility.highContrast ? 'checked' : ''} /> <span>High contrast mode</span></label>
      <label class="checkbox-field"><input type="checkbox" id="a11y-dark-mode" ${state.accessibility.darkMode ? 'checked' : ''} /> <span>Dark mode</span></label>
      <label class="checkbox-field"><input type="checkbox" id="a11y-reduce-motion" ${state.accessibility.reduceMotion ? 'checked' : ''} /> <span>Reduce motion</span></label>
      <label class="checkbox-field"><input type="checkbox" id="a11y-mobile-preview" ${state.accessibility.mobilePreview ? 'checked' : ''} /> <span>Mobile app preview mode</span></label>
    </div>
  `;

  document.getElementById('password-form').onsubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    if (String(data.newPassword || '').length < 8) {
      return showBanner('error', 'New password must be at least 8 characters.');
    }
    if (data.newPassword !== data.confirmPassword) {
      return showBanner('error', 'New password and confirmation must match.');
    }
    try {
      const route = state.user?.role === 'BUSINESS' ? '/api/business/auth/change-password' : '/api/auth/change-password';
      await api(route, {
        method: 'POST',
        body: {
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        },
      });
      event.target.reset();
      showBanner('success', 'Password updated successfully.');
    } catch (error) {
      showBanner('error', error.message);
    }
  };

  document.getElementById('email-form').onsubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    try {
      const route = state.user?.role === 'BUSINESS' ? '/api/business/auth/change-email' : '/api/auth/change-email';
      const result = await api(route, {
        method: 'POST',
        body: {
          newEmail: data.newEmail,
          password: data.password,
        },
      });
      const updatedUser = { ...(state.user || {}), email: result.email || data.newEmail };
      state.user = updatedUser;
      localStorage.setItem('plxy_user', JSON.stringify(updatedUser));
      showBanner('success', 'Email updated successfully.');
      await renderTab();
    } catch (error) {
      showBanner('error', error.message);
    }
  };

  document.getElementById('a11y-font-size').onchange = (event) => {
    persistAccessibilitySettings({ fontSize: event.target.value === 'large' ? 'large' : 'normal' });
  };
  document.getElementById('a11y-high-contrast').onchange = (event) => {
    persistAccessibilitySettings({ highContrast: Boolean(event.target.checked) });
  };
  document.getElementById('a11y-dark-mode').onchange = (event) => {
    persistAccessibilitySettings({ darkMode: Boolean(event.target.checked) });
  };
  document.getElementById('a11y-reduce-motion').onchange = (event) => {
    persistAccessibilitySettings({ reduceMotion: Boolean(event.target.checked) });
  };
  document.getElementById('a11y-mobile-preview').onchange = (event) => {
    persistAccessibilitySettings({ mobilePreview: Boolean(event.target.checked) });
  };
}

document.body.addEventListener('click', async (event) => {
  const target = event.target;
  const discoveryCreatorId = target.getAttribute('data-discovery-creator');
  if (discoveryCreatorId) {
    await renderDiscoveryCreatorProfile(discoveryCreatorId);
    return;
  }
  const discoveryBack = target.getAttribute('data-discovery-back');
  if (discoveryBack) {
    state.tab = 'discovery';
    await renderTab();
    return;
  }
  const view = target.getAttribute('data-view');
  if (view) {
    if (view === 'login') {
      showScreen('auth');
      renderAuth('creator-login');
      return;
    }
    if (view === 'landing') return showScreen('landing');
    if (view === 'terms') return showScreen('terms');
    if (view === 'privacy') return showScreen('privacy');
    if (view === 'help') return showScreen('help');
  }

  const mode = target.getAttribute('data-mode');
  if (mode) {
    return renderAuth(mode);
  }
  const forgotMode = target.getAttribute('data-forgot-mode');
  if (forgotMode) {
    return renderForgotPassword(forgotMode);
  }

  const tab = target.getAttribute('data-tab');
  if (tab) {
    state.tab = tab;
    setMenuOpen(false);
    return renderTab();
  }

  const editId = target.getAttribute('data-edit-content');
  if (editId) {
    const row = await api(`/api/content/${editId}`);
    ui.tabContent.innerHTML = `
      <form id="edit-form">
        <h3>Edit Post</h3>
        <input name="title" value="${escapeHtml(row.title)}" required />
        <textarea name="body" rows="6" required>${escapeHtml(row.body)}</textarea>
        <input name="media_url" value="${escapeHtml(row.media_url)}" required />
        <select name="content_type">
          <option ${row.content_type === 'article' ? 'selected' : ''} value="article">article</option>
          <option ${row.content_type === 'video_embed' ? 'selected' : ''} value="video_embed">video_embed</option>
          <option ${row.content_type === 'image_story' ? 'selected' : ''} value="image_story">image_story</option>
        </select>
        <button class="btn-primary" type="submit">Save</button>
      </form>
    `;
    document.getElementById('edit-form').onsubmit = async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      if (!data.media_url) {
        return showBanner('error', 'Media URL is required.');
      }
      try {
        await api(`/api/content/${editId}`, { method: 'PUT', body: data });
        showBanner('success', 'Post updated');
        state.tab = 'profile';
        await renderTab();
      } catch (error) {
        showBanner('error', error.message);
      }
    };
  }

  const deleteId = target.getAttribute('data-delete-content');
  if (deleteId) {
    showModal({
      title: 'Delete Post',
      text: 'Delete this post? This cannot be undone.',
      onConfirm: async () => {
        try {
          await api(`/api/content/${deleteId}`, { method: 'DELETE' });
          showBanner('success', 'Post deleted');
          state.tab = 'profile';
          await renderTab();
        } catch (error) {
          showBanner('error', error.message);
        }
      },
    });
  }
});

document.getElementById('logout-btn').onclick = () => {
  const route = state.user?.role === 'BUSINESS' ? '/api/business/auth/logout' : '/api/auth/logout';
  api(route, { method: 'POST' }).catch(() => {});
  clearAuth();
  setMenuOpen(false);
  showScreen('landing');
};
document.getElementById('menu-btn').onclick = () => {
  const isOpen = ui.menuPanel.classList.contains('open');
  setMenuOpen(!isOpen);
};
document.getElementById('cta-signup').onclick = () => { showScreen('auth'); renderAuth('creator-signup'); };
document.getElementById('cta-business').onclick = () => { showScreen('auth'); renderAuth('business-login'); };
document.getElementById('cta-preview').onclick = () => {
  const next = !state.accessibility.mobilePreview;
  persistAccessibilitySettings({ mobilePreview: next });
  showBanner('success', next ? 'Mobile app preview mode enabled.' : 'Mobile app preview mode disabled.');
};

renderStatic();
applyAccessibilitySettings();
if (state.token && state.user) {
  enterApp().catch(() => {
    clearAuth();
    showScreen('landing');
  });
} else {
  showScreen('landing');
}
