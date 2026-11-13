// GET /api/ping — tells the editor it is online and whether the password is right.
import { cfg, json, checkPassword } from '../../cloud/github.js';

export async function onRequestGet({ request, env }) {
  const c = cfg(env);
  return json({
    ok: true,
    mode: 'cloud',
    passwordRequired: true,
    configured: !!(c.token && c.password),
    authorized: request.headers.get('X-Editor-Password') ? await checkPassword(request, env) : false
  });
}
