// Fills Filenest with realistic demo data through the same API the app uses.
//   npm run seed                         demo account + two other accounts
//   npm run seed -- --with you@email.com also give your own account the demo drive
// Needs the API running (npm run server). Safe to re-run: existing folders, files,
// stars and links are reused. Only timestamps (spread over the last 30 days) and link
// view counts are set directly in the database, so the demo looks lived-in.
import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { sql } from '../config/db.js';
import { download, makePdf, makeWav, makeZip, photo } from './sample-files.mjs';

const API = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`;
const ORIGIN = (process.env.ORIGINS || 'http://localhost:5173').split(',')[0].trim();
const DEMO_EMAIL = process.env.DEMO_EMAIL?.toLowerCase().trim();
const DEMO_PASSWORD = process.env.DEMO_PASSWORD;
const SEED_PASSWORD = process.env.SEED_PASSWORD;
const withIndex = process.argv.indexOf('--with');
const WITH_EMAIL = withIndex > -1 ? process.argv[withIndex + 1]?.toLowerCase().trim() : null;

if (!DEMO_EMAIL || !DEMO_PASSWORD || !SEED_PASSWORD) {
    console.error('Set DEMO_EMAIL, DEMO_PASSWORD and SEED_PASSWORD in server/.env first (see server/.env.example).');
    process.exit(1);
}

const HOUR = 3600 * 1000;
const hashOf = (s) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 997, 0);
const DAY = 24 * HOUR;
const ago = (ms) => new Date(Date.now() - ms);
// A time on a given day ago, at a plausible hour (9:00 to 21:00), never in the future
const dayAgo = (days, seed = '', hour = 9 + ((Math.round(days) * 7 + hashOf(seed)) % 12), minute = (days * 13 + hashOf(seed) * 7) % 60) => {
    const d = new Date(Date.now() - days * DAY);
    d.setHours(hour, minute, 0, 0);
    return d > new Date() ? ago(20 * 60 * 1000) : d;
};

// ---------------------------------------------------------------- API client
const client = (cookie = '') => {
    const call = async (method, path, body, { form = false } = {}) => {
        const headers = { Origin: ORIGIN };
        if (cookie) headers.Cookie = cookie;
        if (body && !form) headers['Content-Type'] = 'application/json';
        const res = await fetch(API + path, { method, headers, body: form ? body : body ? JSON.stringify(body) : undefined });
        const setCookie = res.headers.get('set-cookie');
        if (setCookie) cookie = setCookie.split(';')[0];
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = new Error(`${method} ${path} → ${res.status} ${data.error || ''}`);
            err.status = res.status;
            throw err;
        }
        return data;
    };
    return { call };
};

// Sign in, creating the account the first time
const account = async ({ name, email, password }) => {
    const c = client();
    try {
        await c.call('POST', '/api/auth/register', { name, email, password });
        console.log(`  + account ${email}`);
    } catch (err) {
        if (err.status !== 400) throw err;
        await c.call('POST', '/api/auth/login', { email, password });
        console.log(`  = account ${email}`);
    }
    return c;
};

// Act as an existing user without their password (for --with)
const actAs = async (email) => {
    const [user] = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (!user) throw new Error(`No Filenest account with the email ${email}. Sign up in the app first.`);
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h', algorithm: 'HS256' });
    return client(`token=${token}`);
};

// ---------------------------------------------------------------- content
const text = (s) => Buffer.from(s.replace(/^\n/, ''));

const files = {
    gettingStarted: () => makePdf({
        title: 'Getting started with Filenest',
        subtitle: 'Your files, safely nested',
        lines: [
            '# Upload',
            'Drag files anywhere onto the page, or use New > Upload files.',
            'Each upload shows its own progress, and you can keep working meanwhile.',
            '# Organise',
            'Create folders, move things around and star what you use most.',
            'Recent shows what you uploaded, changed or opened lately.',
            '# Share',
            'Create a public link for any file or folder. Make it view-only,',
            'set an expiry date, and revoke it whenever you like.',
            '# Recover',
            'Deleted items wait in the Trash until you restore them or empty it.',
        ],
    }),
    roadmap: () => makePdf({
        title: 'Q3 Product Roadmap',
        subtitle: 'Platform team · July to September 2026',
        color: [0.2, 0.25, 0.33],
        lines: [
            '# Themes',
            '1. Faster onboarding: cut time-to-first-upload below 60 seconds',
            '2. Sharing: expiring links, view-only mode, link analytics',
            '3. Reliability: 99.95% API uptime, resumable uploads',
            '# Milestones',
            'Jul 15  Expiring links beta to 10% of users',
            'Aug 05  New preview viewer (PDF, audio, video, text)',
            'Aug 26  Storage insights in Settings',
            'Sep 20  Public launch and blog post',
            '# Owners',
            'Riya (PM), Arjun (backend), Sara (design), Kabir (QA)',
        ],
    }),
    invoice: (month, amount) => makePdf({
        title: `Invoice ${month}`,
        subtitle: 'Riya Sharma Consulting · Bengaluru',
        color: [0.06, 0.45, 0.4],
        lines: [
            `Invoice no: RS-${month.replace('-', '')}`,
            'Billed to: Northwind Labs Pvt Ltd',
            '',
            '# Services',
            `Product strategy workshops (4 sessions)       INR ${(amount * 0.6).toLocaleString('en-IN')}`,
            `Roadmap and research synthesis                INR ${(amount * 0.4).toLocaleString('en-IN')}`,
            '',
            `Total due: INR ${amount.toLocaleString('en-IN')}`,
            'Payment terms: 15 days, bank transfer',
        ],
    }),
    resume: () => makePdf({
        title: 'Riya Sharma',
        subtitle: 'Product Manager · riya.sharma@example.com',
        color: [0.27, 0.32, 0.9],
        lines: [
            '# Experience',
            'Senior PM, Northwind Labs (2023 to now)',
            '  Led sharing and storage features used by 2M people',
            'Product Manager, Brightpath (2020 to 2023)',
            '  Launched mobile app, grew weekly actives 3x',
            '# Skills',
            'Discovery, roadmapping, SQL, experimentation, design systems',
            '# Education',
            'B.Tech Computer Science, VIT Vellore',
        ],
    }),
    rent: () => makePdf({
        title: 'Rental Agreement 2026',
        subtitle: 'Flat 4B, Indiranagar, Bengaluru',
        color: [0.55, 0.35, 0.1],
        lines: ['Term: 11 months from 1 Feb 2026', 'Monthly rent: INR 38,000', 'Deposit: INR 1,50,000', 'Notice period: 2 months'],
    }),
    oldResume: () => makePdf({ title: 'Riya Sharma (2024)', subtitle: 'Old version', lines: ['Superseded by the 2026 resume.'] }),
    okr: () => text(`
objective,key_result,owner,target,current,status
Faster onboarding,Time to first upload under 60s,Riya,60,74,at risk
Faster onboarding,Sign-up conversion above 45%,Sara,45,47,on track
Sharing,Weekly links created above 12k,Arjun,12000,10450,on track
Sharing,Link views per link above 6,Arjun,6,6.8,done
Reliability,API uptime 99.95%,Kabir,99.95,99.97,done
`),
    kickoff: () => text(`
# Q3 kickoff notes

**Date:** 1 July 2026 · **Attendees:** Riya, Arjun, Sara, Kabir

## Decisions
- Expiring links ship first, behind a flag for 10% of users
- Preview viewer covers PDF, images, video, audio and plain text
- No new storage tiers this quarter

## Action items
- [x] Arjun: share-link API with expiry and permissions
- [ ] Sara: empty states and upload panel designs
- [ ] Kabir: load test uploads at 200 rps
`),
    budget: () => text(`
month,rent,groceries,travel,subscriptions,savings
Jan,38000,9200,2500,1800,25000
Feb,38000,8800,6400,1800,22000
Mar,38000,9500,1800,1800,26000
Apr,38000,9100,3200,2100,24000
May,38000,8700,12500,2100,15000
Jun,38000,9400,2200,2100,25000
Jul,38000,9800,2900,2100,24000
Aug,38000,9300,4100,2100,23000
Sep,38000,9100,3600,2100,24000
Oct,38000,9600,18900,2100,12000
`),
    meetingNotes: () => text(`
Weekly sync, 20 Oct 2026

- Goa photos are in Photos/Goa 2026, link shared with the family group
- Invoice for October sent to Northwind, due 4 Nov
- Book train tickets for Diwali by Friday
- Renew passport before December
`),
    chai: () => text(`
# Masala chai (2 cups)

## Ingredients
- 1 cup water, 1 cup milk
- 2 tsp loose black tea (Assam)
- 2 tsp sugar, or to taste
- 3 green cardamom, 1 small piece of ginger, 2 cloves, a pinch of black pepper

## Method
1. Crush the cardamom, cloves and ginger.
2. Boil the water with the spices for 2 minutes.
3. Add tea and sugar, simmer for 1 minute.
4. Pour in the milk and bring to a rolling boil twice.
5. Strain into cups and serve hot.
`),
    paneer: () => text(`
# Paneer tikka

Marinate 400 g paneer cubes, peppers and onion in:
- 1 cup thick curd, 1 tbsp ginger-garlic paste
- 1 tsp each: chilli powder, garam masala, kasuri methi, salt
- 1 tbsp mustard oil, juice of half a lemon

Rest 2 hours. Skewer and grill at 230°C for 12 to 15 minutes, turning once.
Finish with chaat masala and serve with mint chutney.
`),
    tokens: () => text(JSON.stringify({
        name: 'Northwind brand tokens',
        color: { primary: '#0ea5e9', ink: '#0b1422', surface: '#f3f6fa', success: '#10b981' },
        radius: { sm: 12, md: 16, lg: 22 },
        font: { sans: 'Geist', mono: 'Geist Mono' },
    }, null, 2)),
    references: () => text(`
# References

1. Norman, D. *The Design of Everyday Things*. 2013.
2. Krug, S. *Don't Make Me Think*. 2014.
3. Nielsen, J. "10 Usability Heuristics for User Interface Design". 1994.
`),
};

const melody1 = [['E4', .35], ['G4', .35], ['A4', .5], ['G4', .35], ['E4', .35], ['D4', .7], ['E4', .35], ['G4', .35], ['C5', .5], ['B4', .35], ['A4', .9]];
const melody2 = [['C4', .5], ['E4', .5], ['G4', .5], ['C5', .8], ['B4', .4], ['A4', .4], ['G4', .8], ['F4', .4], ['E4', .4], ['D4', .4], ['C4', 1.2]];

// Folder tree for a demo drive. days = uploaded N days ago, openedH = opened N hours ago.
const demoDrive = [
    { file: 'Getting started with Filenest.pdf', mime: 'application/pdf', make: files.gettingStarted, days: 30 },
    { file: 'monthly-budget-2026.csv', mime: 'text/csv', make: files.budget, days: 3, openedH: 2 },
    { file: 'meeting-notes.txt', mime: 'text/plain', make: files.meetingNotes, days: 1, openedH: 5 },
    { file: 'IMG_20261019_183012.jpg', mime: 'image/jpeg', make: () => photo('latest', 1600, 1200), days: 0.2 },
    {
        folder: 'Work', days: 28, children: [
            {
                folder: 'Q3 Planning', days: 25, children: [
                    { file: 'Q3-roadmap.pdf', mime: 'application/pdf', make: files.roadmap, days: 24, openedH: 1, star: true, share: { permission: 'download', views: 23 } },
                    { file: 'okr-tracker.csv', mime: 'text/csv', make: files.okr, days: 9, openedH: 26 },
                    { file: 'kickoff-notes.md', mime: 'text/markdown', make: files.kickoff, days: 22, share: { permission: 'view', expired: true, views: 8 } },
                ],
            },
            {
                folder: 'Design', days: 20, children: [
                    { file: 'moodboard-01.jpg', mime: 'image/jpeg', make: () => photo('mood-1'), days: 13 },
                    { file: 'moodboard-02.jpg', mime: 'image/jpeg', make: () => photo('mood-2'), days: 13 },
                    { file: 'moodboard-03.jpg', mime: 'image/jpeg', make: () => photo('mood-3'), days: 12 },
                    { file: 'brand-tokens.json', mime: 'application/json', make: files.tokens, days: 11 },
                    { file: 'brand-assets.zip', mime: 'application/zip', make: () => makeZip([{ name: 'brand-tokens.json', data: files.tokens() }, { name: 'README.txt', data: 'Northwind brand assets, v2.' }]), days: 11 },
                ],
            },
            {
                folder: 'Invoices', days: 70, children: [
                    { file: 'invoice-2026-08.pdf', mime: 'application/pdf', make: () => files.invoice('2026-08', 180000), days: 52 },
                    { file: 'invoice-2026-09.pdf', mime: 'application/pdf', make: () => files.invoice('2026-09', 165000), days: 21 },
                    { file: 'invoice-2026-10.pdf', mime: 'application/pdf', make: () => files.invoice('2026-10', 172500), days: 2, openedH: 30, share: { permission: 'download', expiresInDays: 30, views: 3 } },
                ],
            },
        ],
    },
    {
        folder: 'Photos', days: 27, star: true, children: [
            {
                folder: 'Goa 2026', days: 6, star: true, share: { permission: 'view', expiresInDays: 7, views: 14 }, children: [
                    { file: 'IMG_20261012_064211.jpg', mime: 'image/jpeg', make: () => photo('goa-1'), days: 6, openedH: 4 },
                    { file: 'IMG_20261012_071530.jpg', mime: 'image/jpeg', make: () => photo('goa-2'), days: 6 },
                    { file: 'IMG_20261013_174802.jpg', mime: 'image/jpeg', make: () => photo('goa-3'), days: 6 },
                    { file: 'IMG_20261013_181455.jpg', mime: 'image/jpeg', make: () => photo('goa-4'), days: 5 },
                    { file: 'IMG_20261014_102937.jpg', mime: 'image/jpeg', make: () => photo('goa-5'), days: 5 },
                    { file: 'IMG_20261014_190244.jpg', mime: 'image/jpeg', make: () => photo('goa-6'), days: 5 },
                ],
            },
            {
                folder: 'Family', days: 26, children: [
                    { file: 'diwali-2025.jpg', mime: 'image/jpeg', make: () => photo('family-1'), days: 26 },
                    { file: 'nani-birthday.jpg', mime: 'image/jpeg', make: () => photo('family-2'), days: 16 },
                    { file: 'sunday-lunch.jpg', mime: 'image/jpeg', make: () => photo('family-3'), days: 8 },
                ],
            },
        ],
    },
    {
        folder: 'Personal', days: 29, children: [
            {
                folder: 'Documents', days: 29, children: [
                    { file: 'resume-riya-sharma-2026.pdf', mime: 'application/pdf', make: files.resume, days: 18, star: true },
                    { file: 'rental-agreement-2026.pdf', mime: 'application/pdf', make: files.rent, days: 29 },
                ],
            },
            {
                folder: 'Recipes', days: 15, children: [
                    { file: 'masala-chai.md', mime: 'text/markdown', make: files.chai, days: 15, share: { permission: 'view', views: 41 } },
                    { file: 'paneer-tikka.md', mime: 'text/markdown', make: files.paneer, days: 10 },
                ],
            },
        ],
    },
    {
        folder: 'Music', days: 19, children: [
            { file: 'melody-sketch.wav', mime: 'audio/wav', make: () => makeWav(melody1), days: 7, openedH: 50 },
            { file: 'morning-raga-idea.wav', mime: 'audio/wav', make: () => makeWav(melody2), days: 19 },
        ],
    },
    {
        folder: 'Videos', days: 14, children: [
            // Big Buck Bunny (c) Blender Foundation, CC BY 3.0
            { file: 'big-buck-bunny-clip.mp4', mime: 'video/mp4', make: () => download('https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4'), days: 4 },
        ],
    },
];

// Created, then moved to the Trash (trashedDays ago)
const demoTrash = [
    { file: 'old-resume-2024.pdf', mime: 'application/pdf', make: files.oldResume, days: 40, trashedDays: 3 },
    { file: 'screenshot_2026-09-12.jpg', mime: 'image/jpeg', make: () => photo('screenshot', 1280, 800), days: 39, trashedDays: 6 },
    {
        folder: 'Drafts', days: 35, trashedDays: 1, children: [
            { file: 'blog-draft-v1.md', mime: 'text/markdown', make: () => text('# Why we built expiring links\n\nDraft, do not share.\n'), days: 35 },
            { file: 'blog-draft-v2.md', mime: 'text/markdown', make: () => text('# Links that clean up after themselves\n\nSecond draft.\n'), days: 33 },
        ],
    },
];

// ---------------------------------------------------------------- seeding
const stamps = []; // [table, id, createdAt, openedAt]
const trashStamps = []; // [table, id, trashedAt]

const listFolder = async (c, folderId) => {
    const parent = folderId || 'null';
    const [{ folders }, { files: list }] = await Promise.all([
        c.call('GET', `/api/folders?parent_id=${parent}`),
        c.call('GET', `/api/files?folder_id=${parent}&limit=100`),
    ]);
    return { folders, files: list };
};

const ensureFolder = async (c, name, parentId, existing) => {
    const found = existing.folders.find((f) => f.name === name);
    if (found) return found;
    const { folder } = await c.call('POST', '/api/folders', { name, parent_id: parentId });
    return folder;
};

const ensureFile = async (c, spec, folderId, existing) => {
    const found = existing.files.find((f) => f.name === spec.file);
    if (found) return found;
    const data = await spec.make();
    if (!data) {
        console.log(`  ! skipped ${spec.file} (could not download it)`);
        return null;
    }
    const fd = new FormData();
    fd.append('files', new Blob([data], { type: spec.mime }), spec.file);
    if (folderId) fd.append('folder_id', folderId);
    const { files: created } = await c.call('POST', '/api/files/upload', fd, { form: true });
    process.stdout.write('.');
    return created[0];
};

const share = async (c, type, item, opts) => {
    const expires_at = opts.expiresInDays ? new Date(Date.now() + opts.expiresInDays * DAY).toISOString() : null;
    const { share_link: link } = await c.call('POST', '/api/shares', { resource_type: type, resource_id: item.id, permission: opts.permission, expires_at });
    await sql`UPDATE share_links SET access_count = GREATEST(access_count, ${opts.views || 0}) WHERE id = ${link.id}`;
    if (opts.expired) await sql`UPDATE share_links SET expires_at = NOW() - interval '2 days', created_at = NOW() - interval '20 days' WHERE id = ${link.id}`;
};

const seedTree = async (c, nodes, parentId = null) => {
    const existing = await listFolder(c, parentId);
    for (const node of nodes) {
        if (node.folder) {
            const folder = await ensureFolder(c, node.folder, parentId, existing);
            stamps.push(['folders', folder.id, dayAgo(node.days, node.folder)]);
            if (node.star) await c.call('PATCH', `/api/folders/${folder.id}/star`, { starred: true });
            if (node.share) await share(c, 'folder', folder, node.share);
            await seedTree(c, node.children || [], folder.id);
        } else {
            const file = await ensureFile(c, node, parentId, existing);
            if (!file) continue;
            const created = node.days < 1 ? ago(node.days * DAY) : dayAgo(node.days, node.file);
            stamps.push(['files', file.id, created, node.openedH ? ago(node.openedH * HOUR) : null]);
            if (node.star) await c.call('PATCH', `/api/files/${file.id}/star`, { starred: true });
            if (node.share) await share(c, 'file', file, node.share);
        }
    }
};

const seedTrash = async (c, nodes) => {
    const trash = await c.call('GET', '/api/trash');
    const trashed = new Map([
        ...trash.files.map((f) => [f.name, ['files', f.id]]),
        ...trash.folders.map((f) => [f.name, ['folders', f.id]]),
    ]);
    const root = await listFolder(c, null);
    for (const node of nodes) {
        const already = trashed.get(node.folder || node.file);
        if (already) {
            trashStamps.push([...already, dayAgo(node.trashedDays, node.folder || node.file)]);
            continue;
        }
        if (node.folder) {
            const folder = await ensureFolder(c, node.folder, null, root);
            stamps.push(['folders', folder.id, dayAgo(node.days, node.folder)]);
            await seedTree(c, node.children, folder.id);
            await c.call('DELETE', `/api/folders/${folder.id}`);
            trashStamps.push(['folders', folder.id, dayAgo(node.trashedDays, node.folder)]);
        } else {
            const file = await ensureFile(c, node, null, root);
            if (!file) continue;
            stamps.push(['files', file.id, dayAgo(node.days, node.file)]);
            await c.call('DELETE', `/api/files/${file.id}`);
            trashStamps.push(['files', file.id, dayAgo(node.trashedDays, node.file)]);
        }
    }
};

// Spread timestamps so Recent, the upload chart and "trashed 3d ago" look real
const applyTimestamps = async () => {
    for (const [table, id, created, opened] of stamps) {
        if (table === 'files') {
            await sql`UPDATE files SET created_at = ${created}, updated_at = ${created}, last_opened_at = ${opened ?? null} WHERE id = ${id}`;
        } else {
            await sql`UPDATE folders SET created_at = ${created}, updated_at = ${created} WHERE id = ${id}`;
        }
    }
    // A trashed folder and its contents share one trashed_at, so move them together
    for (const [table, id, trashedAt] of trashStamps) {
        if (table === 'files') {
            await sql`UPDATE files SET trashed_at = ${trashedAt} WHERE id = ${id} AND is_trashed = true`;
            continue;
        }
        const [row] = await sql`SELECT owner_id, trashed_at FROM folders WHERE id = ${id}`;
        if (!row?.trashed_at) continue;
        await sql`UPDATE files SET trashed_at = ${trashedAt} WHERE owner_id = ${row.owner_id} AND trashed_at = ${row.trashed_at}`;
        await sql`UPDATE folders SET trashed_at = ${trashedAt} WHERE owner_id = ${row.owner_id} AND trashed_at = ${row.trashed_at}`;
    }
};

const seedDemoDrive = async (c, label) => {
    process.stdout.write(`  uploading ${label} drive `);
    await seedTree(c, demoDrive);
    await seedTrash(c, demoTrash);
    console.log(' done');
};

const others = [
    {
        name: 'Arjun Mehta', email: 'arjun@filenest-demo.dev', drive: [
            {
                folder: 'Freelance', days: 12, children: [
                    { file: 'proposal-acme.pdf', mime: 'application/pdf', make: () => makePdf({ title: 'Proposal for Acme', subtitle: 'Arjun Mehta · Backend consulting', lines: ['Scope: API audit and performance plan', 'Timeline: 3 weeks', 'Fee: INR 2,40,000'] }), days: 12, share: { permission: 'download', views: 5 } },
                    { file: 'architecture.jpg', mime: 'image/jpeg', make: () => photo('arjun-1'), days: 9 },
                ],
            },
        ],
    },
    {
        name: 'Sara Ali', email: 'sara@filenest-demo.dev', drive: [
            {
                folder: 'Thesis', days: 20, children: [
                    { file: 'chapter-1-draft.pdf', mime: 'application/pdf', make: () => makePdf({ title: 'Chapter 1: Introduction', subtitle: 'Sara Ali · MDes thesis draft', lines: ['Designing for trust in file sharing tools', 'Draft 3, comments welcome'] }), days: 20, share: { permission: 'view', views: 2 } },
                    { file: 'references.md', mime: 'text/markdown', make: files.references, days: 18 },
                ],
            },
        ],
    },
];

const main = async () => {
    console.log(`Seeding Filenest through ${API}\n`);
    await fetch(API).catch(() => {
        throw new Error(`The API isn't running at ${API}. Start it with: npm run server`);
    });

    if (WITH_EMAIL) {
        console.log(`Adding the demo drive to ${WITH_EMAIL}`);
        await seedDemoDrive(await actAs(WITH_EMAIL), WITH_EMAIL);
    } else {
        console.log('Accounts');
        const demo = await account({ name: 'Riya Sharma', email: DEMO_EMAIL, password: DEMO_PASSWORD });
        await seedDemoDrive(demo, 'demo');
        for (const person of others) {
            const c = await account({ ...person, password: SEED_PASSWORD });
            await seedTree(c, person.drive);
        }
    }

    await applyTimestamps();
    console.log('\nDone.');
    if (!WITH_EMAIL) {
        console.log(`  Demo login: ${DEMO_EMAIL} / (DEMO_PASSWORD from server/.env)`);
        console.log(`  Other accounts (@filenest-demo.dev) use SEED_PASSWORD`);
        console.log(`  Set VITE_DEMO_EMAIL="${DEMO_EMAIL}" in client/.env to show the demo button.`);
    }
};

try {
    await main();
} catch (err) {
    console.error(`\nSeeding failed: ${err.message}`);
    process.exitCode = 1;
} finally {
    await sql.end?.();
}
