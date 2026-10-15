// Stap 2: terug van Stripe. We controleren bij Stripe of er echt betaald is,
// zetten de toegang aan en sturen de inlogcode.
import { json, normEmail, markPaid, sendCode, stripe, fail } from '../lib/core.js';

export async function GET(request) {
  try {
    const id = new URL(request.url).searchParams.get('session_id') || '';
    if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return json({ error: 'Ongeldige betaling.' }, 400);
    const s = await stripe(`checkout/sessions/${id}`, null, 'GET');
    if (s.payment_status !== 'paid') return json({ error: 'De betaling is nog niet afgerond.' }, 402);
    const email = normEmail(s.metadata?.email || s.customer_details?.email);
    await markPaid(email, id);
    const r = await sendCode(email);
    return json({ status: 'code_sent', email, recent: r === 'wait' });
  } catch (e) { return fail(e); }
}
