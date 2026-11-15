/*
 * Shared helpers for the online editor's API (Cloudflare Pages Functions in ../functions/api).
 * The editor saves by committing content.json (and any new photos) to GitHub;
 * Cloudflare then rebuilds and republishes the site automatically.
 *
 * Environment variables (Cloudflare Pages → Settings → Variables and Secrets):
 *   EDITOR_PASSWORD  (secret)  password for /editor
 *   GITHUB_TOKEN     (secret)  fine-grained token with "Contents: read and write" on the repo
 *   GITHUB_REPO      optional, default "fsssolutions/FSS-website"
 *   GITHUB_BRANCH    optional, default "main" (must be the branch Cloudflare publishes)
 *   SITE_DIR         optional, default "website" (folder of the site inside the repo)
 */
const API = 'https://api.github.com';

export function cfg(env) {
  return {
    repo: env.GITHUB_REPO || 'fsssolutions/FSS-website',
    branch: env.GITHUB_BRANCH || 'main',
    dir: (env.SITE_DIR == null ? 'website' : env.SITE_DIR).replace(/^\/+|\/+$/g, ''),
    token: env.GITHUB_TOKEN || '',
    password: env.EDITOR_PASSWORD || ''
  };
}

export function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

async function sha256(s) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
}

// Constant-time password check; a wrong password is answered slowly to discourage guessing.
export async function checkPassword(request, env) {
  const c = cfg(env);
  const given = request.headers.get('X-Editor-Password') || '';
  if (!c.password || !given) return false;
  const a = await sha256(given), b = await sha256(c.password);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff) { await new Promise(r => setTimeout(r, 1000)); return false; }
  return true;
}

export const encodePath = p => p.split('/').map(encodeURIComponent).join('/');
export const repoPath = (c, p) => (c.dir ? c.dir + '/' : '') + p;
export const UPLOAD_RE = /^assets\/uploads\/[a-z0-9][a-z0-9-]{0,80}\.(jpe?g|png|webp|gif)$/;

// Small GitHub REST client.
export function github(env) {
  const c = cfg(env);
  return async function api(path, opts) {
    opts = opts || {};
    const headers = {
      Authorization: 'Bearer ' + c.token,
      Accept: opts.accept || 'application/vnd.github+json',
      'User-Agent': 'fss-site-editor',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (opts.body) headers['Content-Type'] = 'application/json';
    const res = await fetch(API + '/repos/' + c.repo + path, {
      method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    const text = await res.text();
    if (!res.ok) {
      let msg = text;
      try { msg = JSON.parse(text).message || text; } catch (e) { /* not JSON */ }
      const err = new Error('GitHub ' + res.status + ': ' + msg);
      err.status = res.status;
      throw err;
    }
    if (opts.raw) return text;
    return text ? JSON.parse(text) : null;
  };
}

// Commits content.json plus new uploaded files in a single commit. Retries if the branch moved.
export async function commitSite(env, content, files, message) {
  const c = cfg(env);
  const api = github(env);
  const entries = [];
  for (const f of files) {
    const blob = await api('/git/blobs', { method: 'POST', body: { content: f.data, encoding: 'base64' } });
    entries.push({ path: repoPath(c, f.path), mode: '100644', type: 'blob', sha: blob.sha });
  }
  const cblob = await api('/git/blobs', { method: 'POST', body: { content: JSON.stringify(content, null, 2) + '\n', encoding: 'utf-8' } });
  entries.push({ path: repoPath(c, 'content.json'), mode: '100644', type: 'blob', sha: cblob.sha });
  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = await api('/git/ref/heads/' + encodePath(c.branch));
    const head = ref.object.sha;
    const parent = await api('/git/commits/' + head);
    const tree = await api('/git/trees', { method: 'POST', body: { base_tree: parent.tree.sha, tree: entries } });
    const commit = await api('/git/commits', { method: 'POST', body: { message, tree: tree.sha, parents: [head] } });
    try {
      await api('/git/refs/heads/' + encodePath(c.branch), { method: 'PATCH', body: { sha: commit.sha } });
      return commit.sha;
    } catch (e) {
      if (e.status !== 422 && e.status !== 409) throw e; // branch moved: try again on top of it
    }
  }
  const err = new Error('The site changed while saving. Please press Publish again.');
  err.status = 409;
  throw err;
}
