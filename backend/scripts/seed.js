require('dotenv').config();
const bcrypt = require('bcrypt');
const { supabaseAdmin } = require('../src/lib/supabaseClient');

const MEDIA = [
  'https://images.unsplash.com/photo-1504450758481-7338eba7524a?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?auto=format&fit=crop&w=1200&q=80',
];

const CREATOR_SEEDS = [
  ['Sarah Johnson', 'sarahjohnson@plxyground.local', 'sarah-johnson'],
  ['Mike Lee', 'mikelee@plxyground.local', 'mike-lee'],
  ['Ana Gomez', 'anagomez@plxyground.local', 'ana-gomez'],
  ['Tom Brown', 'tombrown@plxyground.local', 'tom-brown'],
  ['Lily Chen', 'lilychen@plxyground.local', 'lily-chen'],
  ['Jordan Blake', 'jordanblake@plxyground.local', 'jordan-blake'],
  ['Priya Patel', 'priyapatel@plxyground.local', 'priya-patel'],
  ['Darius Hall', 'dariushall@plxyground.local', 'darius-hall'],
  ['Emily Ross', 'emilyross@plxyground.local', 'emily-ross'],
  ['Noah Kim', 'noahkim@plxyground.local', 'noah-kim'],
];

const BUSINESS_SEEDS = [
  ['Nike', 'nike@plxyground.local', 'nike'],
  ['Adidas', 'adidas@plxyground.local', 'adidas'],
  ['Puma', 'puma@plxyground.local', 'puma'],
];

async function upsertAdmin() {
  const email = 'admin@plxyground.local';
  const passwordHash = await bcrypt.hash('Internet2026@', 10);
  const { data: existing } = await supabaseAdmin
    .from('admins')
    .select('id')
    .eq('email', email)
    .single();
  
  if (existing) {
    await supabaseAdmin
      .from('admins')
      .update({ password_hash: passwordHash, role: 'ADMIN', is_active: true })
      .eq('id', existing.id);
    return existing.id;
  }
  
  const { data: newAdmin, error } = await supabaseAdmin
    .from('admins')
    .insert([{ email, password_hash: passwordHash, role: 'ADMIN', is_active: true }])
    .select();
  if (error) throw error;
  return newAdmin[0].id;
}

async function upsertUser({ role, name, email, slug, password }) {
  let creator = null;
  const { data: existingCreator } = await supabaseAdmin
    .from('creators')
    .select('id')
    .eq('profile_slug', slug)
    .single();
  
  if (!existingCreator) {
    const { data: newCreator, error } = await supabaseAdmin
      .from('creators')
      .insert([{
        name,
        role,
        profile_slug: slug,
        bio: `${name} bio`,
        location: 'London',
        social_links: { instagram: 'https://instagram.com/plxyground' },
        is_active: true,
      }])
      .select();
    if (error) throw error;
    creator = newCreator[0];
  } else {
    const { error } = await supabaseAdmin
      .from('creators')
      .update({ name, role })
      .eq('id', existingCreator.id);
    if (error) throw error;
    creator = existingCreator;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const { data: existingAccount } = await supabaseAdmin
    .from('creator_accounts')
    .select('id, creator_id')
    .eq('creator_id', creator.id)
    .single();
  
  if (existingAccount) {
    const { error } = await supabaseAdmin
      .from('creator_accounts')
      .update({
        email,
        password_hash: passwordHash,
        is_suspended: false,
        is_email_verified: true,
      })
      .eq('id', existingAccount.id);
    if (error) throw error;
  } else {
    const { error } = await supabaseAdmin
      .from('creator_accounts')
      .insert([{
        creator_id: creator.id,
        email,
        password_hash: passwordHash,
        is_approved: true,
        is_email_verified: true,
        is_suspended: false,
      }]);
    if (error) throw error;
  }
  return creator.id;
}

function contentTypeFor(index) {
  const types = ['article', 'video_embed', 'image_story'];
  return types[index % types.length];
}

function bodyFor(name, index) {
  return [
    `${name} training diary #${index + 1}.`,
    'Today covered match preparation, on-court timing, and campaign planning.',
    'Detailed notes: cadence, creative direction, and partner readiness for sports brands.',
  ].join(' ');
}

async function seedContent(creatorId, creatorName, count) {
  for (let i = 0; i < count; i += 1) {
    const title = `${creatorName} performance update ${i + 1}`;
    const { data: existing } = await supabaseAdmin
      .from('content')
      .select('id')
      .eq('creator_id', creatorId)
      .eq('title', title)
      .single();
    
    const isPublished = i % 4 !== 0 ? true : false;
    const mediaUrl = MEDIA[i % MEDIA.length];
    const contentType = contentTypeFor(i);
    const body = bodyFor(creatorName, i);
    const now = new Date();
    const createdAt = new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString();
    
    if (existing) {
      const { error } = await supabaseAdmin
        .from('content')
        .update({
          body,
          media_url: mediaUrl,
          content_type: contentType,
          is_published: isPublished,
          published_at: isPublished ? (existing.published_at || new Date().toISOString()) : null,
        })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { data: newContent, error } = await supabaseAdmin
        .from('content')
        .insert([{
          creator_id: creatorId,
          content_type: contentType,
          title,
          body,
          media_url: mediaUrl,
          is_published: isPublished,
          published_at: isPublished ? new Date().toISOString() : null,
          feed_rank_at: new Date().toISOString(),
          created_at: createdAt,
        }])
        .select();
      if (error) throw error;
      
      if (!isPublished && newContent && newContent[0]) {
        const { error: queueError } = await supabaseAdmin
          .from('moderation_queue')
          .insert([{
            type: 'content',
            status: 'PENDING',
            title_or_name: title,
            submitted_by: creatorId,
            entity_id: newContent[0].id,
            report_count: 0,
          }]);
        if (queueError) throw queueError;
      }
    }
  }
}
        [creatorId, contentType, title, body, mediaUrl, isPublished, isPublished, `-${i} day`, `-${i} day`]
      );
      if (!isPublished) {
        await run(
          `INSERT INTO moderation_queue (type, status, title_or_name, submitted_by, entity_id, report_count)
           VALUES ('content', 'PENDING', ?, ?, ?, 0)`,
          [title, creatorId, result.lastID]
        );
      }
    }
  }
}

async function seedOpportunities(businessCreatorId) {
  const rows = [
    ['Nike Weekend Brief', 'BUSINESS', 'Looking for creator-led highlight reels.', '3+ years sports content', 'Paid campaign and event access'],
    ['Adidas Skill Lab', 'BUSINESS', 'Need creators for youth clinic series.', 'Basketball background', 'Stipend + gear package'],
    ['Puma Matchday Stories', 'BUSINESS', 'Seeking short-form creator coverage.', 'Video editing and hosting', 'Monthly retainer'],
  ];
  
  for (const [title, roleType, body, requirements, benefits] of rows) {
    const { data: existing } = await supabaseAdmin
      .from('opportunities')
      .select('id')
      .eq('title', title)
      .single();
    
    if (existing) {
      const { error } = await supabaseAdmin
        .from('opportunities')
        .update({ body, role_type: roleType, requirements, benefits, is_published: true })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from('opportunities')
        .insert([{
          creator_id: businessCreatorId,
          title,
          role_type: roleType,
          body,
          requirements,
          benefits,
          is_published: true,
        }]);
      if (error) throw error;
    }
  }
}
        [businessCreatorId, title, roleType, body, requirements, benefits]
      );
    }
  }
}

async function backfillQueueForPending() {
  const { data: pendingRows, error: fetchError } = await supabaseAdmin
    .from('content')
    .select('id, creator_id, title')
    .eq('is_published', false);
  if (fetchError) throw fetchError;
  
  for (const row of pendingRows || []) {
    const { data: queueRow } = await supabaseAdmin
      .from('moderation_queue')
      .select('id')
      .eq('type', 'content')
      .eq('entity_id', row.id)
      .eq('status', 'PENDING')
      .single();
    
    if (!queueRow) {
      const { error } = await supabaseAdmin
        .from('moderation_queue')
        .insert([{
          type: 'content',
          status: 'PENDING',
          title_or_name: row.title,
          submitted_by: row.creator_id,
          entity_id: row.id,
          report_count: 0,
        }]);
      if (error) throw error;
    }
  }
}

async function main() {
  await upsertAdmin();

  const creatorIds = [];
  for (const [name, email, slug] of CREATOR_SEEDS) {
    const creatorId = await upsertUser({
      role: 'CREATOR',
      name,
      email,
      slug,
      password: 'Password1!',
    });
    creatorIds.push({ id: creatorId, name });
  }

  const businessIds = [];
  for (const [name, email, slug] of BUSINESS_SEEDS) {
    const creatorId = await upsertUser({
      role: 'BUSINESS',
      name,
      email,
      slug,
      password: 'Password1!',
    });
    businessIds.push(creatorId);
  }

  for (const creator of creatorIds) {
    await seedContent(creator.id, creator.name, 10);
  }
  await seedOpportunities(businessIds[0]);
  await backfillQueueForPending();

  console.log('Seed complete');
  console.log('Admin: admin@plxyground.local / Internet2026@');
  console.log('Creator: sarahjohnson@plxyground.local / Password1!');
  console.log('Business: nike@plxyground.local / Password1!');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
