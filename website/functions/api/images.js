// GET /api/images — photos already in the site, for the editor's image library.
import { cfg, json, github, encodePath, repoPath } from '../../cloud/github.js';

export async function onRequestGet({ env }) {
  const c = cfg(env);
  const api = github(env);
  const images = [];
  for (const dir of ['assets/images', 'assets/uploads']) {
    try {
      const list = await api('/contents/' + encodePath(repoPath(c, dir)) + '?ref=' + encodeURIComponent(c.branch));
      for (const f of list || []) if (f.type === 'file' && /\.(jpe?g|png|gif|webp|svg|avif)$/i.test(f.name) && !/\.w\d+\.webp$/i.test(f.name)) images.push(dir + '/' + f.name);
    } catch (e) { /* folder may not exist yet */ }
  }
  return json({ images });
}
