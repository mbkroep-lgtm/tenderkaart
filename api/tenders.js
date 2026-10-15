// De tenders zelf: alleen voor ingelogde bezoekers met toegang.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { json, readSession, hasAccess, fail } from '../lib/core.js';

export async function GET(request) {
  try {
    const email = readSession(request);
    if (!email || !(await hasAccess(email))) return json({ error: 'Log in om de tenders te bekijken.' }, 401);
    const raw = await readFile(path.join(process.cwd(), 'data', 'tenders.json'), 'utf8');
    return new Response(raw, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store' } });
  } catch (e) { return fail(e); }
}
