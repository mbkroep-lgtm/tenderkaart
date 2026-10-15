// Optioneel vangnet: Stripe meldt hier elke geslaagde betaling, ook als de klant
// na het betalen de pagina sluit voordat hij terugkomt op de site.
import { json, normEmail, markPaid, verifyStripeSignature, env } from '../lib/core.js';

export async function POST(request) {
  const secret = env('STRIPE_WEBHOOK_SECRET');
  if (!secret) return json({ error: 'Webhook niet ingesteld.' }, 404);
  const raw = await request.text();
  if (!verifyStripeSignature(raw, request.headers.get('stripe-signature'), secret)) return json({ error: 'Ongeldige handtekening.' }, 400);
  const event = JSON.parse(raw);
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const s = event.data.object;
    if (s.payment_status === 'paid') {
      const email = normEmail(s.metadata?.email || s.customer_details?.email);
      if (email) await markPaid(email, s.id);
    }
  }
  return json({ received: true });
}
