# Single-page website booking — 2026-10-04

The owner approved a compact dynamic screen: visit type/mode, identity, available times, then Book. New patients supply contact details. Follow-ups supply first/last name and DOB only; Confirm identity sends a one-use link exclusively to the registered Charm email from office@lexingtonpodiatry.nyc. Explicit confirmation on the link page unlocks the original browser. Editing identity revokes the local session. Link tokens are removed before third-party assets/analytics execute.

Existing Apps Script/Sheets, Gmail alias, booking idempotency and Charm handoff are reused; no new paid infrastructure. Draft fields remain in memory. Charm SMS settings are unchanged; the owner will disable Charm email separately. Front Door registration card redesign is a separate, unimplemented mockup.

Backend matching fails closed for failed/truncated/ambiguous searches. Legacy name/DOB/email-only booking-match authorization is disabled. Email delivery requires the office sender alias; no fallback sender. Existing rate limits, durable send receipts, ten-minute links, single-use approval, and browser-bound polling remain.

Validation: focused backend magic-email tests, integrated single-page controller tests, slot-response race test and 10 family identity regression tests pass. Review caught and corrected a late configuration response overwriting the lock/confirmation label. No real patient email or booking is sent by these tests.

Deployment: pending browser upload and explicit versioned deployment, followed by website publication. Never push GitHub source directly to Google. Sender configuration and live page are verified separately; real inbox delivery and Charm SMS delivery require a real authorized booking test.
