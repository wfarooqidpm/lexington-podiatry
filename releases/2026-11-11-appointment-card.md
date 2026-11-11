# Appointment card readiness — 2026-11-11

The required-sections progress UI already accepted current Charm demographics as On file. The appointment-card readiness predicate instead required an explicit personal-section submission timestamp and also required the optional medical section, so saving a signed registration could leave it on the form.

Use the existing trusted office demographic readiness flag or explicit personal submission, retain the actual signed contract and submitted insurance gates, and keep unresolved address review blocked. Optional medical information does not block the appointment card. No consent or submitted timestamps are manufactured. Preserve newer typing entered during a slow save before changing views.

Validation: new failing regressions reproduced both readiness blockers and the newer-typing case, then passed after the fix. Full website test command: `node --test tests/*.cjs` — 23 passed. Live verification pending deployment.
