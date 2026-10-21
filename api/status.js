// Lichte controle voor open pagina's: zijn er nieuwe gegevens, een nieuwe versie, of staat de site in onderhoud?
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { json, readSession, isAdmin, getMaintenance } from '../lib/core.js';

export async function GET(request) {
  let updated = null;
  try { updated = JSON.parse(await readFile(path.join(process.cwd(), 'data', 'tenders.json'), 'utf8')).updated; } catch {}
  let m = null; try { m = await getMaintenance(); } catch {}
  const admin = isAdmin(readSession(request));
  return json({ updated, build: process.env.VERCEL_GIT_COMMIT_SHA || '', maintenance: m && m.on ? { message: m.message || '', admin } : null },
    200, { 'Cache-Control': 'no-store' });
}
