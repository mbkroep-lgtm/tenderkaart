// Wie is er ingelogd?
import { json, readSession, hasAccess, fail } from '../lib/core.js';

export async function GET(request) {
  try {
    const email = readSession(request);
    if (!email || !(await hasAccess(email))) return json({ loggedIn: false }, 401);
    return json({ loggedIn: true, email });
  } catch (e) { return fail(e); }
}
