# Starlink Tenderkaart (TenderMap)

Kaart van Europa met aanbestedingen voor Starlink en satellietinternet uit TED (Tenders Electronic Daily).

- `public/` – de website (kaart, filters, inlogscherm)
- `api/` – server-functies op Vercel: inloggen met code, betalen via Stripe, afgeschermde tenders
- `scripts/fetch-ted.mjs` + `.github/workflows/update.yml` – haalt elke werkdag de tenders op bij TED en zet ze in `data/tenders.json` (niet openbaar, alleen via `/api/tenders` na inloggen)

## Instellingen in Vercel (Settings → Environment Variables)

| Naam | Waarvoor |
|---|---|
| `STRIPE_SECRET_KEY` | Geheime sleutel van Stripe (`sk_live_…` of `sk_test_…`) |
| `RESEND_API_KEY` | Sleutel van Resend voor het versturen van inlogcodes |
| `MAIL_FROM` | Afzender, bv. `TenderMap <noreply@tendermap.eu>` (domein eerst verifiëren bij Resend) |
| `SESSION_SECRET` | Lange willekeurige tekst (minstens 32 tekens) |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Database (Upstash Redis via Vercel → Storage); worden automatisch gezet |
| `FREE_DOMAINS` | Domeinen met gratis toegang, bv. `broadbandeu.com` |
| `FREE_EMAILS` | Losse adressen met gratis toegang (komma's ertussen) |
| `PRICE_CENTS` | Prijs in centen, standaard `1000` (= € 10) |
| `ACCESS_DAYS` | Hoe lang toegang geldig is; `0` of leeg = voor altijd |
| `SITE_NAME` | Naam in e-mails en op Stripe, standaard `TenderMap` |
| `ADMIN_EMAILS` | Beheerders (komma's ertussen): zien de knop Beheer en /admin.html |
| `GITHUB_TOKEN` | Optioneel: fijnmazige GitHub-token met Actions: Read and write op deze repository, voor de knop Nu verversen |
| `STRIPE_WEBHOOK_SECRET` | Optioneel vangnet voor betalingen (`whsec_…`), endpoint `/api/stripe-webhook` |

Handmatig tenders verversen: tabblad **Actions** → **Tenders ophalen bij TED** → **Run workflow**.

Made by Merijn · BroadbandEU
