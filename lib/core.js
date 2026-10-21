// Gedeelde hulpfuncties voor inloggen, betalen en de afgeschermde tenders.
// Geen externe pakketten: alles via fetch en node:crypto.
import crypto from 'node:crypto';

export const env = k => (process.env[k] || '').trim();

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
  });
}

export const normEmail = e => String(e || '').trim().toLowerCase();
export const validEmail = e => e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

const sha = s => crypto.createHash('sha256').update(s).digest('hex');
function safeEq(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// ---------- Database (Upstash Redis via REST) ----------
export async function redis(...cmd) {
  const url = env('KV_REST_API_URL') || env('UPSTASH_REDIS_REST_URL');
  const token = env('KV_REST_API_TOKEN') || env('UPSTASH_REDIS_REST_TOKEN');
  if (!url || !token) throw new Error('De database is nog niet ingesteld.');
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd)
  });
  const d = await r.json();
  if (d.error) throw new Error('Database: ' + d.error);
  return d.result;
}

// ---------- Toegang ----------
const list = k => env(k).toLowerCase().split(',').map(s => s.trim()).filter(Boolean);

// Alleen medewerkers: e-mailadressen op deze domeinen mogen altijd inloggen (aan te passen met ALLOWED_DOMAINS)
export const allowedDomains = () => (env('ALLOWED_DOMAINS') ? list('ALLOWED_DOMAINS') : ['broadbandeu.com', 'broadbandnl.com']);
export const isStaff = email => !!email && allowedDomains().includes(email.split('@')[1]);
export function isFree(email) {
  return isStaff(email) || list('FREE_DOMAINS').includes(email.split('@')[1]) || list('FREE_EMAILS').includes(email) || isAdmin(email);
}
export const isAdmin = email => !!email && list('ADMIN_EMAILS').includes(email);

// gratis toegang die via de adminpagina is gegeven (naast FREE_DOMAINS/FREE_EMAILS)
export async function isFreeByAdmin(email) {
  const [e, d] = await Promise.all([
    redis('SISMEMBER', 'free:emails', email),
    redis('SISMEMBER', 'free:domains', email.split('@')[1] || '')
  ]);
  return e === 1 || d === 1;
}

export async function hasAccess(email) {
  if (isFree(email)) return true;
  if (await isFreeByAdmin(email)) return true;
  const v = await redis('GET', `paid:${email}`);
  if (!v) return false;
  const days = Number(env('ACCESS_DAYS') || 0); // 0 = voor altijd
  if (!days) return true;
  const at = Date.parse(JSON.parse(v).at);
  return Date.now() - at < days * 864e5;
}

export async function markPaid(email, sessionId) {
  await redis('SET', `paid:${email}`, JSON.stringify({ at: new Date().toISOString(), session: sessionId }));
}

// ---------- Inlogcodes ----------
export async function sendCode(email) {
  // hooguit één code per 45 seconden per adres
  const fresh = await redis('SET', `sent:${email}`, '1', 'EX', 45, 'NX');
  if (fresh === null) return 'wait';
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await redis('SET', `code:${email}`, sha(code + email), 'EX', 600);
  await redis('DEL', `tries:${email}`);
  await sendMail(email, code);
  return 'sent';
}

export async function checkCode(email, code) {
  const tries = await redis('INCR', `tries:${email}`);
  if (tries === 1) await redis('EXPIRE', `tries:${email}`, 600);
  if (tries > 5) return 'locked';
  const stored = await redis('GET', `code:${email}`);
  if (!stored) return 'expired';
  if (!safeEq(stored, sha(String(code).replace(/\D/g, '') + email))) return 'wrong';
  await redis('DEL', `code:${email}`, `tries:${email}`);
  return 'ok';
}

async function sendMail(to, code) {
  const key = env('RESEND_API_KEY');
  if (!key) throw new Error('Het versturen van e-mail is nog niet ingesteld.');
  const name = env('SITE_NAME') || 'TenderMap';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env('MAIL_FROM') || `${name} <onboarding@resend.dev>`,
      to: [to],
      subject: `Je inlogcode voor ${name}: ${code}`,
      text: `Je inlogcode voor ${name} is: ${code}\n\nDe code is 10 minuten geldig. Heb je niet geprobeerd in te loggen? Dan kun je deze e-mail negeren.`,
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#111">
        <p>Je inlogcode voor ${name} is:</p>
        <p style="font-size:30px;font-weight:bold;letter-spacing:6px;margin:16px 0">${code}</p>
        <p>De code is 10 minuten geldig. Heb je niet geprobeerd in te loggen? Dan kun je deze e-mail negeren.</p></div>`
    })
  });
  if (!r.ok) throw new Error('E-mail versturen mislukt: ' + (await r.text()).slice(0, 300));
}

// ---------- Sessie (ondertekende cookie) ----------
const COOKIE = 'tm_session';
function secret() {
  const s = env('SESSION_SECRET');
  if (s.length < 32) throw new Error('SESSION_SECRET ontbreekt of is te kort.');
  return s;
}
const sign = p => crypto.createHmac('sha256', secret()).update(p).digest('base64url');

export function sessionCookie(email, days = 60) {
  const payload = Buffer.from(JSON.stringify({ e: email, x: Date.now() + days * 864e5 })).toString('base64url');
  return `${COOKIE}=${payload}.${sign(payload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${days * 86400}`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

// Moet iedereen inloggen (en betalen)? Standaard niet: de kaart is openbaar, inloggen is dan alleen voor beheer.
export const requireLogin = () => env('REQUIRE_LOGIN').toLowerCase() === 'true';

export function readSession(request) {
  if (env('SESSION_SECRET').length < 32) return null;
  const m = (request.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return null;
  const [payload, sig] = m[1].split('.');
  if (!payload || !sig || !safeEq(sig, sign(payload))) return null;
  try {
    const d = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return d.x > Date.now() ? d.e : null;
  } catch { return null; }
}

// ---------- Stripe ----------
export async function stripe(path, params, method = 'POST') {
  const key = env('STRIPE_SECRET_KEY');
  if (!key) throw new Error('Betalen is nog niet ingesteld.');
  const r = await fetch('https://api.stripe.com/v1/' + path, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params ? new URLSearchParams(params).toString() : undefined
  });
  const d = await r.json();
  if (!r.ok) throw new Error('Stripe: ' + (d.error?.message || r.status));
  return d;
}

export function siteUrl(request) {
  return env('SITE_URL') || new URL(request.url).origin;
}

export function verifyStripeSignature(raw, header, secretKey) {
  const parts = Object.fromEntries(String(header || '').split(',').map(p => p.split('=')).filter(p => p.length === 2).map(([k, v]) => [k, v]));
  const sigs = String(header || '').split(',').filter(p => p.startsWith('v1=')).map(p => p.slice(3));
  const t = parts.t;
  if (!t || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = crypto.createHmac('sha256', secretKey).update(`${t}.${raw}`).digest('hex');
  return sigs.some(s => safeEq(s, expected));
}

export async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}

export function fail(e) {
  console.error(e);
  return json({ error: e.message || 'Er ging iets mis. Probeer het later opnieuw.' }, 500);
}

// ---------- Beheer: verborgen tenders en uitsluitwoorden ----------
export async function getHidden() { return (await redis('SMEMBERS', 'hidden')) || []; }
export async function getWords() {
  try { const v = await redis('GET', 'exclude:words'); return v ? JSON.parse(v) : []; } catch { return []; }
}
export function applyAdminFilters(tenders, hidden, words) {
  const h = new Set(hidden);
  const re = words.length ? new RegExp(words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i') : null;
  return tenders.filter(t => !h.has(t.pub) && !(re && re.test(`${t.title} ${t.buyer || ''}`)));
}
