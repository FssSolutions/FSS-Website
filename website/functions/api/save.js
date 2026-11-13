// POST /api/save — { content, files: [{ path: "assets/uploads/x.jpg", data: <base64> }] }
// Commits the site to GitHub; Cloudflare Pages then rebuilds and publishes it.
import { cfg, json, checkPassword, commitSite, UPLOAD_RE } from '../../cloud/github.js';

export async function onRequestPost({ request, env }) {
  if (!(await checkPassword(request, env))) return json({ error: 'Wrong or missing editor password' }, 401);
  if (!cfg(env).token) return json({ error: 'GITHUB_TOKEN is not set in Cloudflare' }, 500);
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'Invalid request' }, 400); }
  const content = body && body.content;
  if (!content || !Array.isArray(content.pages) || !content.pages.length) return json({ error: 'Content must have at least one page' }, 400);
  const files = Array.isArray(body.files) ? body.files : [];
  for (const f of files) {
    if (!f || !UPLOAD_RE.test(f.path || '') || typeof f.data !== 'string' || f.data.length > 20e6) {
      return json({ error: 'Invalid file: ' + (f && f.path) }, 400);
    }
  }
  try {
    const sha = await commitSite(env, content, files, 'Update website from the site editor');
    return json({ ok: true, commit: sha, savedAt: new Date().toISOString() });
  } catch (e) {
    return json({ error: e.message }, e.status === 409 ? 409 : 502);
  }
}
