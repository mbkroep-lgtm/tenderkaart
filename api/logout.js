import { json, clearCookie } from '../lib/core.js';

export async function POST() {
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie() });
}
