// GET /api/content — the latest saved content.json, read straight from GitHub
// (so the editor never shows an older copy while the site is rebuilding).
import { cfg, json, github, encodePath, repoPath } from '../../cloud/github.js';

export async function onRequestGet({ env }) {
  const c = cfg(env);
  if (!c.token) return json({ error: 'GITHUB_TOKEN is not set in Cloudflare' }, 500);
  try {
    const text = await github(env)('/contents/' + encodePath(repoPath(c, 'content.json')) + '?ref=' + encodeURIComponent(c.branch),
      { accept: 'application/vnd.github.raw+json', raw: true });
    return new Response(text, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
  } catch (e) {
    return json({ error: e.message }, 502);
  }
}
