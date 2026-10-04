# Booking bubble path

Owner approved the interactive bubble-path mockup October 3, 2026 (Eastern). Initial page should present only the first-visit/returning-patient question. Visit mode follows; selected choices form a winding, editable bubble path. Identity/details and available times unfold on the same page without Next buttons. Hide empty cards and the final booking action until a valid slot is selected. Simplify booking header to logo and office phone.

Frontend only: preserve existing registered-email confirmation, browser-bound session, identity-edit revocation, booking idempotency and Charm handoff. Draft edits do not write. No changes to Charm email/SMS settings or Apps Script deployment214. Branded appointment email/reschedule work remains next, after owner reviews this UI.

Validation: extended booking-flow test checks initial visibility, bubble progression, verification gate, identity edits, back-navigation preserving draft/slot, and duplicate submission; passes. Slot-response race test and syntax check pass. Independent review found no material issues. Publication and live browser verification follow merge; no real patient test message or appointment sent.
