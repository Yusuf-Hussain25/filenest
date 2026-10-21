// Security checks against a running Filenest API (npm run server first).
//   npm run test:security            (API_URL defaults to http://localhost:3000)
// Creates two throwaway users (@filenest-test.dev), checks that each can only reach their own
// data, that logged-out visitors are refused and that public links expose only what they should.
// Everything it creates is deleted at the end.
import 'dotenv/config';
import { sql } from '../config/db.js';
import { deleteMultipleFromStorage } from '../utils/s3Helper.js';

const API = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`;
const ORIGIN = (process.env.ORIGINS || 'http://localhost:5173').split(',')[0].trim();
const run = Date.now().toString(36);

let passed = 0;
let failed = 0;
const check = (name, ok, detail = '') => {
    if (ok) passed++;
    else failed++;
    console.log(`${ok ? '  ✓' : '  ✗'} ${name}${ok || !detail ? '' : `  (${detail})`}`);
};

// Minimal cookie-jar client
const client = () => {
    let cookie = '';
    const call = async (method, path, body, { form = false } = {}) => {
        const headers = { Origin: ORIGIN };
        if (cookie) headers.Cookie = cookie;
        if (body && !form) headers['Content-Type'] = 'application/json';
        const res = await fetch(API + path, { method, headers, body: form ? body : body ? JSON.stringify(body) : undefined });
        const setCookie = res.headers.get('set-cookie');
        if (setCookie) cookie = setCookie.split(';')[0];
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = text; }
        return { status: res.status, data, headers: res.headers };
    };
    return { call, setCookie: (c) => { cookie = c; } };
};

const upload = (c, name, content, folderId) => {
    const fd = new FormData();
    fd.append('files', new Blob([content], { type: 'text/plain' }), name);
    if (folderId) fd.append('folder_id', folderId);
    return c.call('POST', '/api/files/upload', fd, { form: true });
};

// Looks for private fields in a public response (signed URLs are left out: they name the object by design)
const leaks = (data) => /s3_key|owner_id|password|@filenest-test\.dev/.test(
    JSON.stringify(data, (key, value) => (key === 'url' || key === 'download_url' ? undefined : value))
);

const main = async () => {
    console.log(`Filenest security checks against ${API}\n`);
    const a = client();
    const b = client();
    const anon = client();
    const emailA = `alice-${run}@filenest-test.dev`;
    const emailB = `bob-${run}@filenest-test.dev`;

    console.log('Accounts');
    const regA = await a.call('POST', '/api/auth/register', { name: 'Alice Test', email: emailA, password: 'correct-horse-1' });
    check('sign up works', regA.status === 201, regA.status);
    check('login response has no token in the body', !('token' in (regA.data || {})));
    check('auth cookie is httpOnly', /httponly/i.test(regA.headers.get('set-cookie') || ''));
    await b.call('POST', '/api/auth/register', { name: 'Bob Test', email: emailB, password: 'correct-horse-2' });
    check('short password is rejected', (await anon.call('POST', '/api/auth/register', { name: 'X', email: `x-${run}@filenest-test.dev`, password: '123' })).status === 400);
    check('password change needs the current password', (await a.call('PATCH', '/api/auth/password', { current_password: 'nope-nope-nope', new_password: 'another-pass-9' })).status === 400);
    const wrongPw = await anon.call('POST', '/api/auth/login', { email: emailA, password: 'wrong-password' });
    const noUser = await anon.call('POST', '/api/auth/login', { email: `nobody-${run}@filenest-test.dev`, password: 'wrong-password' });
    check('wrong password and unknown email give the same answer', wrongPw.status === 401 && noUser.status === 401 && wrongPw.data.error === noUser.data.error);

    // Alice's data
    const folder = (await a.call('POST', '/api/folders', { name: 'Private' })).data.folder;
    const sub = (await a.call('POST', '/api/folders', { name: 'Inner', parent_id: folder.id })).data.folder;
    const other = (await a.call('POST', '/api/folders', { name: 'Not shared' })).data.folder;
    const file = (await upload(a, 'secret.txt', 'top secret', folder.id)).data.files[0];
    const loose = (await upload(a, 'loose.txt', 'loose file')).data.files[0];
    const bobFolder = (await b.call('POST', '/api/folders', { name: 'Bob stuff' })).data.folder;
    const bobFile = (await upload(b, 'bob.txt', 'bob')).data.files[0];

    console.log('\nLogged-out visitors');
    for (const [method, path] of [['GET', '/api/auth/me'], ['GET', '/api/files'], ['GET', '/api/folders'], ['GET', '/api/trash'], ['GET', '/api/shares'], ['GET', `/api/files/${file.id}/preview`], ['DELETE', `/api/files/${file.id}`]]) {
        check(`${method} ${path.replace(/[0-9a-f-]{36}/, ':id')} → 401`, (await anon.call(method, path)).status === 401);
    }
    check('upload → 401', (await upload(anon, 'x.txt', 'x')).status === 401);
    check('GET /api/files/:id/text → 401', (await anon.call('GET', `/api/files/${file.id}/text`)).status === 401);
    const forged = client();
    forged.setCookie('token=eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMCJ9.c2lnbmF0dXJl');
    check('forged token → 401', (await forged.call('GET', '/api/files')).status === 401);

    console.log("\nOther users can't reach Alice's files");
    check('preview / download URL → 404', (await b.call('GET', `/api/files/${file.id}/preview`)).status === 404);
    check('read its text → 404', (await b.call('GET', `/api/files/${file.id}/text`)).status === 404);
    check('rename → 404', (await b.call('PATCH', `/api/files/${file.id}/rename`, { name: 'hacked.txt' })).status === 404);
    check('move to own folder → 404', (await b.call('PATCH', `/api/files/${file.id}/move`, { target_folder: bobFolder.id })).status === 404);
    check('trash → 404', (await b.call('DELETE', `/api/files/${file.id}`)).status === 404);
    check('delete forever → 404', (await b.call('DELETE', `/api/files/${file.id}/permanent`)).status === 404);
    check('list files of her folder → empty', ((await b.call('GET', `/api/files?folder_id=${folder.id}`)).data.files || []).length === 0);
    check('search does not find her files', ((await b.call('GET', '/api/files?search=secret')).data.files || []).length === 0);
    check('share her file → 404', (await b.call('POST', '/api/shares', { resource_type: 'file', resource_id: file.id })).status === 404);
    check('star her file → 404', (await b.call('PATCH', `/api/files/${file.id}/star`, { starred: true })).status === 404);
    await a.call('PATCH', `/api/files/${file.id}/star`, { starred: true });
    check("her starred files aren't in other users' Starred", ((await b.call('GET', '/api/drive/starred')).data.files || []).length === 0);
    check("her files aren't in other users' Recent", !((await b.call('GET', '/api/drive/recent')).data.files || []).some((f) => f.id === file.id));
    check("drive search doesn't find her files", ((await b.call('GET', '/api/drive/search?q=secret')).data.files || []).length === 0);
    check("her folders aren't in other users' Move picker", !((await b.call('GET', '/api/drive/folders')).data.folders || []).some((f) => f.id === folder.id));
    const statsB = (await b.call('GET', '/api/drive/stats')).data;
    check('storage stats only count your own files', statsB.counts?.files === 1);

    console.log("\nOther users can't reach Alice's folders");
    check('folder details → 404', (await b.call('GET', `/api/folders/${folder.id}`)).status === 404);
    check('create a folder inside it → 404', (await b.call('POST', '/api/folders', { name: 'Intruder', parent_id: folder.id })).status === 404);
    check('upload into it → 404', (await upload(b, 'intruder.txt', 'x', folder.id)).status === 404);
    check('move own file into it → 404', (await b.call('PATCH', `/api/files/${bobFile.id}/move`, { target_folder: folder.id })).status === 404);
    check('move own folder into it → 404', (await b.call('PATCH', `/api/folders/${bobFolder.id}/move`, { target_parent: folder.id })).status === 404);
    check('rename → 404', (await b.call('PATCH', `/api/folders/${folder.id}/rename`, { name: 'Hacked' })).status === 404);
    check('star → 404', (await b.call('PATCH', `/api/folders/${folder.id}/star`, { starred: true })).status === 404);
    check('trash → 404', (await b.call('DELETE', `/api/folders/${folder.id}`)).status === 404);

    const ownText = await a.call('GET', `/api/files/${file.id}/text`);
    check('owner can read the text of her file', ownText.status === 200 && ownText.data.content === 'top secret');

    console.log('\nInput handling');
    const badId = await a.call('GET', '/api/files/not-a-uuid/preview');
    check('malformed id → 404, not a server error', badId.status === 404);
    check('malformed folder filter → 404', (await a.call('GET', '/api/files?folder_id=abc')).status === 404);
    check('255+ character name → 400', (await a.call('PATCH', `/api/files/${file.id}/rename`, { name: 'x'.repeat(300) })).status === 400);
    check('name with a slash → 400', (await a.call('POST', '/api/folders', { name: 'a/b' })).status === 400);
    check('duplicate folder name → 400', (await a.call('POST', '/api/folders', { name: 'private' })).status === 400);
    check('% in search is literal text', ((await a.call('GET', '/api/files?search=%25')).data.files || []).length === 0);
    check('move a folder into its own subfolder → 400', (await a.call('PATCH', `/api/folders/${folder.id}/move`, { target_parent: sub.id })).status === 400);

    console.log('\nDirect uploads');
    const ticket = (await a.call('POST', '/api/files/uploads', { name: 'direct.txt', size: 6, type: 'text/plain', folder_id: other.id })).data;
    check('owner gets a presigned upload URL', Boolean(ticket.url && ticket.upload_id));
    check('upload URL into her folder for others → 404', (await b.call('POST', '/api/files/uploads', { name: 'x.txt', size: 1, type: 'text/plain', folder_id: folder.id })).status === 404);
    check('others can\'t complete her upload → 404', (await b.call('POST', `/api/files/uploads/${ticket.upload_id}/complete`)).status === 404);
    check('others can\'t cancel her upload → 404', (await b.call('DELETE', `/api/files/uploads/${ticket.upload_id}`)).status === 404);
    check('logged out → 401', (await anon.call('POST', '/api/files/uploads', { name: 'x.txt', size: 1, type: 'text/plain' })).status === 401);
    const oversize = await fetch(ticket.url, { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: 'more than six bytes' });
    check('storage refuses a bigger file than announced', !oversize.ok);
    await fetch(ticket.url, { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: 'sixsix' });
    const finished = await a.call('POST', `/api/files/uploads/${ticket.upload_id}/complete`);
    check('owner completes the upload into her folder', finished.status === 201 && finished.data.file.folder_id === other.id);
    check('a completed upload can\'t be completed twice', (await a.call('POST', `/api/files/uploads/${ticket.upload_id}/complete`)).status === 404);

    console.log('\nStorage quota');
    await sql`UPDATE users SET storage_limit = storage_used + 5 WHERE email = ${emailB}`;
    const before = (await b.call('GET', '/api/auth/me')).data.user.storage_used;
    check('upload over the quota → 400', (await upload(b, 'big.txt', 'more than five bytes')).status === 400);
    check('rejected upload does not use space', (await b.call('GET', '/api/auth/me')).data.user.storage_used === before);
    check('direct upload over the quota → 400', (await b.call('POST', '/api/files/uploads', { name: 'big.bin', size: 1000, type: 'application/octet-stream' })).status === 400);

    console.log('\nPublic links');
    const folderLink = (await a.call('POST', '/api/shares', { resource_type: 'folder', resource_id: folder.id, permission: 'view' })).data.share_link;
    const fileLink = (await a.call('POST', '/api/shares', { resource_type: 'file', resource_id: loose.id })).data.share_link;
    check('expiry in the past → 400', (await a.call('POST', '/api/shares', { resource_type: 'file', resource_id: file.id, expires_at: '2001-01-01' })).status === 400);
    check('unknown permission → 400', (await a.call('POST', '/api/shares', { resource_type: 'file', resource_id: file.id, permission: 'admin' })).status === 400);
    check("other users can't revoke her link → 404", (await b.call('DELETE', `/api/shares/${fileLink.id}`)).status === 404);
    check("other users can't change her link → 404", (await b.call('PATCH', `/api/shares/${fileLink.id}`, { permission: 'view' })).status === 404);
    check("other users don't see her links", !((await b.call('GET', '/api/shares')).data.share_links || []).some((l) => l.id === fileLink.id));

    const pubFile = await anon.call('GET', `/api/shares/access/${fileLink.token}`);
    check('file link opens logged out', pubFile.status === 200 && Boolean(pubFile.data.file?.url));
    check('file link allows download', Boolean(pubFile.data.file?.download_url));
    check('no owner email, ids or storage keys in the response', !leaks(pubFile.data), JSON.stringify(pubFile.data).slice(0, 120));
    const signed = await fetch(pubFile.data.file.url);
    check('signed URL serves the file', signed.ok && (await signed.text()) === 'loose file');

    const pubFolder = await anon.call('GET', `/api/shares/access/${folderLink.token}`);
    check('folder link lists its files', pubFolder.status === 200 && pubFolder.data.files?.length === 1);
    check('view-only link has no download URL', pubFolder.data.files?.[0]?.download_url === null);
    check('no owner email, ids or storage keys in the folder response', !leaks(pubFolder.data));
    check('subfolder inside the share opens', (await anon.call('GET', `/api/shares/access/${folderLink.token}?folder=${sub.id}`)).status === 200);
    check("a folder outside the share doesn't", (await anon.call('GET', `/api/shares/access/${folderLink.token}?folder=${other.id}`)).status === 404);
    check("another user's folder doesn't", (await anon.call('GET', `/api/shares/access/${folderLink.token}?folder=${bobFolder.id}`)).status === 404);
    const textInShare = await anon.call('GET', `/api/shares/access/${folderLink.token}/text?file=${file.id}`);
    check('text of a file inside the shared folder opens', textInShare.status === 200 && textInShare.data.content === 'top secret');
    check("text of a file outside the share doesn't", (await anon.call('GET', `/api/shares/access/${folderLink.token}/text?file=${loose.id}`)).status === 404);
    check("text of another user's file doesn't", (await anon.call('GET', `/api/shares/access/${folderLink.token}/text?file=${bobFile.id}`)).status === 404);
    check('unknown token → 404', (await anon.call('GET', `/api/shares/access/${'0'.repeat(32)}`)).status === 404);

    await sql`UPDATE share_links SET expires_at = NOW() - interval '1 minute' WHERE id = ${folderLink.id}`;
    check('expired link → 410', (await anon.call('GET', `/api/shares/access/${folderLink.token}`)).status === 410);
    await a.call('DELETE', `/api/files/${loose.id}`);
    check('link to a trashed file stops working', (await anon.call('GET', `/api/shares/access/${fileLink.token}`)).status === 404);

    console.log('\nTrash');
    await a.call('DELETE', `/api/files/${file.id}`);
    await a.call('DELETE', `/api/folders/${folder.id}`);
    const trashA = (await a.call('GET', '/api/trash')).data;
    check('trashed folder is listed once with its contents counted', trashA.folders.length === 1 && trashA.folders[0].file_count === 0 && trashA.files.length === 2);
    check("other users don't see her trash", ((await b.call('GET', '/api/trash')).data.files || []).length === 0);
    const restored = await a.call('POST', `/api/files/${file.id}/restore`);
    check('file restored from a trashed folder goes back to My Files', restored.status === 200 && restored.data.folder_id === null);
    check("other users can't empty her trash", (await b.call('POST', '/api/trash/empty')).status === 200 && (await a.call('GET', '/api/trash')).data.folders.length === 1);

    console.log(`\n${passed} passed, ${failed} failed`);
};

try {
    await main();
} catch (err) {
    failed++;
    console.error('\nTest run crashed:', err);
} finally {
    // Clean up the throwaway accounts and their stored objects
    const files = await sql`SELECT f.s3_key FROM files f JOIN users u ON u.id = f.owner_id WHERE u.email LIKE ${`%-${run}@filenest-test.dev`}`;
    await deleteMultipleFromStorage(files.map((f) => f.s3_key)).catch(() => {});
    await sql`DELETE FROM users WHERE email LIKE ${`%-${run}@filenest-test.dev`}`;
    await sql.end?.();
    process.exitCode = failed ? 1 : 0;
}
