// Wie is er ingelogd, is dat een beheerder, en moet je inloggen om de kaart te zien?
import { json, readSession, hasAccess, isAdmin, requireLogin } from '../lib/core.js';

export async function GET(request) {
  const need = requireLogin();
  try {
    const email = readSession(request);
    if (email && (isAdmin(email) || await hasAccess(email))) return json({ loggedIn: true, email, admin: isAdmin(email), requireLogin: need });
  } catch (e) { console.error(e); }
  return json({ loggedIn: false, requireLogin: need }, need ? 401 : 200);
}
