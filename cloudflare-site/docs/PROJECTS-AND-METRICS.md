# Projects and public metrics — 21 October 2026

Live Worker version: `77ddd85a-0abe-4845-b023-a9a0cdb253a7`. Previous gate-capable rollback: `ced4956e-b7e7-4985-89b6-c015b353fb41`.

One verified account can own multiple registration-backed projects. Each project has its own Walk, business facts, submission and existing delivery history. Dashboard names derive from the private draft; a new optional business/brand name seeds its own draft atomically with registration and ownership. Retries cannot duplicate a project. Existing records remain unchanged.

Each page pins its selected registration in `X-Solborne-Project`. The Worker validates ownership on every read/write, independently of the shared account's current selection. Unbound authenticated writes fail closed. Older tabs should be refreshed after this release. No D1 schema change was needed. Direct Wrangler D1 management reads returned account authorization error7403 in this session; existing live application reads and project-selection requests succeeded. No attempt was made to bypass the management denial.

Public totals are read from the isolated `solborne_presales` business/payment/delivery ledger through the `solborne-metrics` Edge Function and `/api/public-metrics`. Browser receives only the two integer totals. No client may read or write ledger tables. The Edge connection assumes a restricted role with execute permission only on the aggregate function. KFS tables and its runtime were not modified.

Baseline: KISNO PROPTY LLP is an owner-confirmed helped business. KFS, Avasa and Solborne are three owner-confirmed free deliveries, all labelled house projects. No payment transaction, amount or historical delivery date was invented.

To count another business: create one canonical `businesses` row, then record a verified `payments` row for its UUID with a unique payment reference, `status='paid'`, and actual `confirmed_at`. Multiple payments count the business once. Pending/failed/cancelled/refunded-only businesses are excluded unless separately owner-confirmed. To count a free site: insert/update its unique `website_deliveries` record to `delivery_status='delivered'`, `free_website=true`, with an actual confirmation time. Drafts/reviews are excluded. Corrections automatically change totals. Do not manipulate the baseline confirmation field to simulate a payment.

Payments are recorded by the trusted operator through the database for now. No bank feed, billing webhook, checkout or invoice settlement integration exists. The website is automatic after that recording, not automatic detection of money arriving. Totals refresh on page load and every60seconds while visible. Read failures show unavailable instead of invented/stale fallback numbers.

Database migrations: `solborne_business_payment_delivery_metrics`, `solborne_metrics_readonly_runtime`, `solborne_metrics_connection_role_membership`; source SQL/Edge code in this folder. Supabase's REST schema-cache endpoint returned503, so the production read uses the existing supported direct-Postgres Edge pattern. Existing presales sync function was not replaced.

Verification:231 tests pass; database transaction probes verified pending exclusion, business deduplication, draft exclusion and delivery increment then rolled back all synthetic data. Public endpoint returns1/3. Live homepage/account assets match source. Native Google sign-in, two existing project cards and reopening a submitted Walk verified. Mobile viewport had no horizontal overflow; physical-phone interaction remains untested. Site-link audit:17pages,467links,151assets,0failures.
