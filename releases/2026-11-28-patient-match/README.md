# Gateway v0.27.0 — website patient match — 2026-11-28

Owner request: the booking page stops asking "first visit or returning". The
patient's details decide. Follow-ups are 15 minutes plus a 15-minute gap; first
visits are 30 minutes. Sex (Female/Male) is collected for insurance.

`before/` holds the live gateway source cloned 2026-11-28 (v0.26.9; identical to
`releases/2026-11-17-orthotics-pickup/FrontDoor_Gateway.gs`). The files beside it
are the proposed release.

## Changes
- `FrontDoor_BookingBridge.gs`: new `patient-match` bridge action. Forwards only
  name, DOB, phone and email to the private OS2 router and returns only
  matched / not matched (plus the follow-up session). Off while
  `WEBSITE_FOLLOWUP_VERIFICATION_ENABLED` is off.
- `FrontDoor_Gateway.gs`:
  - `returningGapMinutes` (scheduling setting `RETURNING_GAP_MINUTES`, default 15).
    A follow-up slot needs appointment + gap free; the website calendar hold covers
    both, while `Appointment End` (what OS2 books in Charm) stays 15 minutes.
    Orthotics pickups have no gap. With every follow-up holding a gap, the
    `PROGRESSIVE_RETURNING` :15/:45 release rarely applies; leave it or switch it off.
  - `Sex` column filled from the booking (OS2 already sends it to Charm as gender
    when it creates a new patient; it was always blank from the website before).
  - Version `v0.27.0`; `health` reports `websitePatientMatch: true`.

## Depends on
OS2 `patient-match` action: wfarooqidpm/lexington-practice-os2, branch
`website-patient-match` (`src/FrontDoor_PatientMatch.js`). Deploy that first;
until then this bridge action returns an error and the page asks patients to call.

## Validation
- `tests/patient-match-gateway.cjs`: 5 tests (gap rule, 30-minute hold with
  15-minute appointment, first-visit hold, Sex, bridge input/output whitelist, health).
- Existing orthotics pickup gateway test also passes against this file.
- All 17 website tests pass.

## Deployment (not done)
After the OS2 release: compare live gateway source with `before/` again, upload
both files, then create a new web app deployment version for the existing URL.
Then merge the website PR (wfarooqidpm/lexington-podiatry#55).
