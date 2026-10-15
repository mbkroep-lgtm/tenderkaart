// Stap 1: e-mailadres invullen. Heeft iemand toegang, dan krijgt hij een code.
// Zo niet, dan maken we een Stripe-betaalpagina aan.
import { json, normEmail, validEmail, hasAccess, sendCode, stripe, siteUrl, env, readJson, requireLogin, fail } from '../lib/core.js';

export async function POST(request) {
  try {
    const email = normEmail((await readJson(request)).email);
    if (!validEmail(email)) return json({ error: 'Vul een geldig e-mailadres in.' }, 400);

    if (await hasAccess(email)) {
      const r = await sendCode(email);
      return json({ status: 'code_sent', email, recent: r === 'wait' });
    }

    // Openbare kaart: inloggen is alleen voor beheer, er wordt niet betaald.
    if (!requireLogin()) return json({ error: 'Inloggen is alleen nodig voor beheer. Dit e-mailadres heeft geen beheerrechten.' }, 403);

    const base = siteUrl(request);
    const session = await stripe('checkout/sessions', {
      mode: 'payment',
      customer_email: email,
      'metadata[email]': email,
      'line_items[0][price_data][currency]': 'eur',
      'line_items[0][price_data][unit_amount]': env('PRICE_CENTS') || '1000',
      'line_items[0][price_data][product_data][name]': (env('SITE_NAME') || 'TenderMap') + ' – toegang',
      'line_items[0][quantity]': '1',
      locale: 'auto',
      success_url: `${base}/?betaald={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/?geannuleerd=1`
    });
    return json({ status: 'pay', url: session.url });
  } catch (e) { return fail(e); }
}
