# Explicit Frontdoor section refresh — 2026-11-11

Owner requested a small refresh arrow per section because automatically preserving a partial demographic draft can prevent later Charm corrections from reaching the form.

Demographics and primary insurance reload the exact-token current Charm snapshot through the existing authenticated load. Medical information reloads the exact saved registration fields; contract refresh only checks persisted signature status. These two controls are labeled accordingly because a clinical history API is not part of this bridge. Refresh does not sign, submit, verify coverage, or write a Charm chart. The user reviews and explicitly saves afterward.

One existing save queue orders refresh behind in-flight work. Later typing rejects a stale refresh. Only the selected section's whitelisted fields are patched; unrelated input, signatures and existing upload receipts remain intact. Unconfirmed prior save outcomes and missing fresh data stay visible without replacement.

Validation: 31 website tests and 3 focused gateway checks pass, inline script syntax and whitespace checks pass, independent review found no important blockers. Current gateway source compared and backed up under before/. Gateway source readback matched and existing deployment version 35 was verified. The website deployment succeeded and live read-only demographic refresh matched the authoritative Charm chart; no Save or signature was performed. A final layout-only correction ensures the rebuilt medical header retains its arrow; final control verification follows publication.
