/* eslint-disable no-console */
const BASE = process.env.API_BASE_URL || 'http://localhost:3011';

async function req(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch (error) {
    json = { raw: text };
  }
  return { status: response.status, json };
}

async function assertStep(label, fn) {
  try {
    await fn();
    console.log(`PASS ${label}`);
  } catch (error) {
    console.error(`FAIL ${label}: ${error.message}`);
    process.exitCode = 1;
  }
}

async function run() {
  let creatorToken;
  let adminToken;
  let createdContentId;
  let userId;

  await assertStep('health 200', async () => {
    const response = await req('/healthz');
    if (response.status !== 200) {
      throw new Error(`expected 200 got ${response.status}`);
    }
  });

  await assertStep('creator login works', async () => {
    const response = await req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'sarahjohnson@plxyground.local', password: 'Password1!' }),
    });
    if (response.status !== 200 || !response.json.token) {
      throw new Error(`unexpected creator login response ${response.status}`);
    }
    creatorToken = response.json.token;
  });

  await assertStep('create post requires media_url', async () => {
    const response = await req('/api/content', {
      method: 'POST',
      headers: { Authorization: `Bearer ${creatorToken}` },
      body: JSON.stringify({ title: 'No media', body: 'This should fail', content_type: 'article' }),
    });
    if (response.status !== 400) {
      throw new Error(`expected 400 got ${response.status}`);
    }
  });

  await assertStep('create post with media works', async () => {
    const response = await req('/api/content', {
      method: 'POST',
      headers: { Authorization: `Bearer ${creatorToken}` },
      body: JSON.stringify({
        title: 'Smoke test content',
        body: 'Full body text from smoke test',
        media_url: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=80',
        content_type: 'article',
      }),
    });
    if (response.status !== 201 || !response.json.id) {
      throw new Error(`expected 201 with id, got ${response.status}`);
    }
    createdContentId = response.json.id;
  });

  await assertStep('admin login works', async () => {
    const response = await req('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@plxyground.local', password: 'Internet2026@' }),
    });
    if (response.status !== 200 || !response.json.token) {
      throw new Error(`unexpected admin login response ${response.status}`);
    }
    adminToken = response.json.token;
  });

  await assertStep('admin approve queue item', async () => {
    const queueResponse = await req('/api/admin/queue', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const target = (queueResponse.json || []).find((item) => Number(item.entity_id) === Number(createdContentId) && item.status === 'PENDING');
    if (!target) {
      throw new Error('pending queue item not found');
    }
    const actionResponse = await req('/api/admin/queue/bulk-action', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ action: 'APPROVE', ids: [target.id] }),
    });
    if (actionResponse.status !== 200) {
      throw new Error(`approve failed ${actionResponse.status}`);
    }
  });

  await assertStep('approved content visible on feed', async () => {
    const feedResponse = await req('/api/content?limit=50');
    const found = (feedResponse.json || []).find((item) => Number(item.id) === Number(createdContentId));
    if (!found) {
      throw new Error('approved content missing from feed');
    }
    if (!found.body || !found.media_url) {
      throw new Error('feed item missing full body/media');
    }
  });

  await assertStep('suspend user blocks login with suspended message', async () => {
    const usersResponse = await req('/api/admin/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const users = usersResponse.json.users || [];
    const target = users.find((item) => item.email === 'sarahjohnson@plxyground.local');
    if (!target) {
      throw new Error('target user not found');
    }
    userId = target.user_id;

    const suspendResponse = await req(`/api/admin/users/${userId}/suspend`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ suspend: true }),
    });
    if (suspendResponse.status !== 200) {
      throw new Error('suspend failed');
    }

    const loginBlocked = await req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'sarahjohnson@plxyground.local', password: 'Password1!' }),
    });
    if (loginBlocked.status !== 403 || loginBlocked.json.error !== 'ACCOUNT_SUSPENDED') {
      throw new Error('suspended account login was not blocked correctly');
    }

    await req(`/api/admin/users/${userId}/suspend`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ suspend: false }),
    });
  });

  await assertStep('live alerts endpoint returns new users and content', async () => {
    const response = await req('/api/admin/alerts', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (response.status !== 200 || !Array.isArray(response.json.new_content) || !Array.isArray(response.json.new_users)) {
      throw new Error('alerts payload invalid');
    }
  });
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
