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

## Deployment
Deployed 2026-11-28 (owner approved in session), after OS2 router @242:
- Fresh clone of live "Front Door" project matched `before/` exactly; manifest unchanged.
- `clasp push` of these two files; read-back matched exactly.
- Existing public endpoint `AKfycbxSHMx…HpF` moved from @38 to @39
  ("Website patient match, follow-up gap, Sex · v0.27.0"). Rollback: redeploy @38
  and push the `before/` files.
- Live checks: `health` reports v0.27.0 and `websitePatientMatch: true`;
  `booking-config` reports `returningGapMinutes: 15` (PROGRESSIVE_RETURNING is on;
  with the gap it rarely releases :15/:45 follow-ups); new-patient slots load (30 min).
- End-to-end from https://lexingtonpodiatry.nyc through the bridge to OS2 with
  synthetic, non-matching details: `{success:true, matched:false}` in about 9 s.
  This made one read-only Charm search and one "NO VERIFIED MATCH" verification row.
- Not yet verified: a real matched follow-up and a booking with the gap hold
  (happens with the first real patient after the website PR merges).

Next: merge the website PR (wfarooqidpm/lexington-podiatry#55), which publishes the new booking page.
