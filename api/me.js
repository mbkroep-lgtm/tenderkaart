// Wie is er ingelogd, en is dat een beheerder?
import { json, readSession, hasAccess, isAdmin, fail } from '../lib/core.js';

export async function GET(request) {
  try {
    const email = readSession(request);
    if (!email || !(await hasAccess(email))) return json({ loggedIn: false }, 401);
    return json({ loggedIn: true, email, admin: isAdmin(email) });
  } catch (e) { return fail(e); }
}
