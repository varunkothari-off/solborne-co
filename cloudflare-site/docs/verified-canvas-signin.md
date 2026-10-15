# Verified canvas sign-in

## Journey

Verified sign-in -> free PDF/text canvas -> enquiry -> separate Walk of Fame.
One identity may own multiple business enquiries. The signed-in session selects an
explicitly owned enquiry. Existing unverified enquiries never link by email alone.
Website generation remains disabled and releases still require manual review.

## Boundaries

Supabase Authentication verifies identity; Cloudflare D1 holds short-lived local
sessions and the Solborne-only ownership map. No service-role key is needed.
Browser cookies are opaque, Secure, HttpOnly and SameSite=Lax. Sensitive access
checks the provider's user endpoint and confirmed email. Session access expires
within one hour. Provider tokens never enter browser storage, URLs or analytics.
KFS schema, policies, records and application configuration are unchanged.

## Activation prerequisites

- Apply `drizzle/0005_verified_canvas_auth.sql` only to the Solborne intake D1.
- Configure `SUPABASE_URL` and the enabled Supabase publishable key.
- Keep `AUTH_ENABLED=false` until at least one provider is configured and tested.
- Google needs a separate Solborne Web OAuth client, origin `https://solborne.in`
  and callback `https://jzbbvlmfsatjqgfubhon.supabase.co/auth/v1/callback`.
- Supabase must allow the exact application return URL
  `https://solborne.in/auth/callback`; preserve unrelated existing redirect entries.
- Enable `AUTH_GOOGLE_ENABLED` only after testing the real Google return flow.
- Email codes require production SMTP and code-bearing sign-up/magic-link email
  templates using `{{ .Token }}`. The built-in Supabase sender is not a production
  sender. Keep `AUTH_EMAIL_ENABLED=false` until delivery is tested.
- Never put OAuth client secrets in public config, Git or chat. The Google secret
  belongs only in Supabase's Google provider configuration.
- Complete hosted sign-in, download, enquiry-save, ownership, sign-out and
  presales-sync checks before replacing the production entry point.

## Verification scope

Local tests cover PKCE, cookies, callback replay, CSRF/origin, expiration,
unconfirmed identity, legacy-grant rejection, verified downloads, multiple owned
enquiries, cross-user selection denial and transaction rollback. These do not
prove hosted OAuth configuration, mail delivery or production data sync.
