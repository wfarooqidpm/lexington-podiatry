# Incomplete returning registration — 2026-11-11

A returning booking previously forced the appointment card to display and hid the form even without completed registration. An appointment is not consent or submitted paperwork.

Show the card only through the existing registration readiness gate. Incomplete new and returning visits retain the full section form, refresh arrows and submission controls. The returning-card decorator also exits before changing incomplete-page content. No signature, submission status or patient data is changed by rendering.

Validation: new regression failed with the unconditional returning shortcut, then passed after removal. Full website suite: 33 tests pass; whitespace checks pass. Independent review found no important blockers. Production verification pending.
