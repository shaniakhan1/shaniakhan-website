# Website inquiry backend

Review-only implementation for consult, mastermind application, and mastermind waitlist. No credentials are in these files. No automatic replies or marketing subscription updates occur.

## Deployment contract

- Project: `nuxkwgbguvpaoigrzqqa`.
- Function: `website-inquiry`, explicitly `verify_jwt = true`.
- Uses existing injected `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, and existing `RESEND_API_KEY`. Do not rotate, create, or configure credentials for this implementation.
- The frontend sends its existing legacy public anon JWT in `Authorization: Bearer …` and `apikey`. The handler additionally compares it to the standard injected anon value. Public anon is not a spam secret.
- Non-secret public config is in the adjacent diagnostic directory; it remains disabled until migration and function deployment are approved and verified.
- Only `https://shaniakhan.com` is allowed. `www.shaniakhan.com/consult/` was verified to redirect 301 to the apex on November 7, 2026.
- Request: `{id: <v4 UUID>, type: 'consult'|'mastermind-application'|'mastermind-waitlist', fields: {...}, website: ''}`.
- Keep the same ID and unchanged normalized data on a retry. Generate a new ID only for changed data, not for a failed/uncertain network result.
- Response success is only `{success: true, id}` after provider acceptance ID is persisted. This means accepted for email delivery, not proof of inbox delivery.
- Failure: `{success: false, code, retryable}`. Retryable responses suggest at least 30 seconds before another attempt. Never automatically replace an ID after a failure.
- Client timeout should be 25 seconds. Maximum individual upstream waits are 3 seconds (claim), 8 seconds (Resend), 3 seconds (finish); timers cover response JSON. Inbound body read is capped at 5 seconds and 24,000 bytes.

## Persistence and privileges

Review SQL is outside the repository in `intake-diagnostic/website-inquiry-proposed.sql`. Create a migration with the installed CLI's current `migration new --help` workflow only after review; do not invent its timestamp.

`website_intake` is a private schema and must NOT be exposed in the Data API. Both tables have RLS enabled and no anon/authenticated grants or policies. Public-schema RPCs are SECURITY INVOKER, explicitly revoked from PUBLIC/anon/authenticated and granted only to existing service_role. Runtime can invoke only the two fixed RPC names. No SQL or table name comes from visitors.

Each inquiry stores its UUID, canonical payload hash, HMAC email identity, form type, original rendered plain-text email, necessary timestamps/state, provider ID, and lease token. The original email includes the submitted fields and avoids storing a second copy. No raw IP, user agent, or submitted values are logged. Only short-lived attempt metadata expires (25 hours). Inquiry contents are business records and are preserved; no automatic deletion is configured. The owner can inspect `website_intake.submissions` through the authenticated Supabase Dashboard SQL Editor (or table editor with the private schema selected); there is no public read endpoint. Existing service-role credentials remain broad platform credentials, so code review is the protection against misuse; these files do not expand their permissions over existing resources.

## Reliability and abuse controls

One transaction serializes claims with a fixed advisory transaction lock. Quotas: three submissions per HMAC email identity per 24h; 30 new submissions/hour; 150/day; 100 dispatch attempts/hour; 500/day; 12 dispatch attempts per inquiry. Different UUIDs with the same canonical payload are suppressed for 24h. Each dispatch gets a 30-second lease. Only its lease token can finalize acceptance.

Resend receives a stable `website-inquiry/<uuid>` idempotency key and the stored original JSON, even after a code release changes templates. Failed and uncertain sends remain pending/retryable. After 23h from the first attempt, automatic dispatch stops with `review_required`, safely inside Resend's documented 24h idempotency lifetime. Staff must reconcile these pending records against Resend before any new send. There is no background retry worker or periodic monitor in this change. Browser retries or a reviewed operator action are needed.

CORS, the public JWT, and honeypots are not sufficient bot prevention alone; database quotas bound sending/storage abuse. A determined attacker can exhaust the small global allowance, causing temporary denial of service. Adding CAPTCHA would require a separate reviewed integration. No promise of spam-free operation or exactly-once inbox delivery is made.

## Verification

Run `node --test core.test.mjs` in this directory. Tests mock DB/provider actions except one localhost HTTP test that confirms abort while reading a stalled JSON response.

SQL semantics were tested in isolated `@electric-sql/pglite@0.5.15` with anon/authenticated/service_role roles. The executable test lives in `intake-diagnostic/website-inquiry-sql.test.mjs` and imports PGlite; install that exact package in an isolated test folder. PGlite proves SQL/privilege/lease behavior but is not a multi-instance production concurrency stress test.

Before enabling frontend, verify deployed JWT behavior with a rejected invalid-body request (no database write), inspect the migration's permissions, and send only expressly authorized labeled diagnostic data to the fixed FLP inbox. Verify provider acceptance and inbox arrival separately. Do not send applicant autoresponses.

## References checked

- https://supabase.com/changelog.md (November 7, 2026; CLI v3 hosted-change confirmation and TLS cipher changes noted; no CLI invoked)
- https://supabase.com/docs/guides/functions/auth-headers
- https://supabase.com/docs/guides/functions/secrets
- https://supabase.com/docs/guides/api/api-keys (new publishable keys are not JWTs; this implementation deliberately retains enabled legacy JWT compatibility)
- https://resend.com/docs/dashboard/emails/idempotency-keys (24-hour retention)
