# Automatic first visit / follow-up — backend work (2026-11-28)

**Status (2026-11-28):** OS2 router (@242) and gateway v0.27.0 (@39) deployed; website not yet merged. OS2 router: wfarooqidpm/lexington-practice-os2
branch `website-patient-match`. Gateway v0.27.0: `releases/2026-11-28-patient-match/`.
For website bookings, Sex now fills the existing Front Door `Sex` column, which OS2
already sends to Charm.

The website branch `booking-patient-match` removes the "Have you visited us before?"
choice. Everyone fills in one form (first name, last name, date of birth, sex, phone,
email). The page then asks the gateway whether those details belong to an existing
patient. **The website must not be merged until the gateway and private router below
are deployed**: until then the check returns an error and patients are told to call.

## 1. New bridge action `patient-match` (gateway → private router)

Browser request through the existing booking bridge (`call271`):

```
{ action: 'patient-match', firstName, lastName, dob: 'YYYY-MM-DD',
  sex: 'female' | 'male', phone: '+1…' (E.164), email (lower-case) }
```

The gateway forwards it, signed, to the private router (`fdg160PrivateRouterCall_('patient-match', …)`).
The router searches Charm and answers only:

- matched: `{ success: true, matched: true, session: <64 hex>, expiresAt: <ISO> }`
- not matched: `{ success: true, matched: false }`
- failure: `{ success: false, error: '<patient-safe message>' }`

No chart data goes back to the browser. The `session` must be the same kind the email
link issues today, so the existing gates (`slots` with `patientType=returning`, and
`website-book`, which takes name/DOB/phone/email from Charm, not from the browser)
keep working unchanged.

## 2. Matching rules (Dr. Farooqi, 2026-11-28)

Normalize names (trim, lower-case, strip accents, collapse spaces) and phones (last 10 digits).

1. **Date of birth** must match exactly. This is the key.
2. **At least one name** must match exactly, first or last (hyphenated or changed last names).
3. **Phone and email** must both match the chart.
4. Exactly one chart must pass. Zero or several charts → `matched: false` (first visit).

Suggested safeguards for review:
- When DOB and a name match but phone or email does not, still answer `matched: false`
  but flag the booking for the office (likely duplicate chart).
- Rate-limit by identity and overall (as `fdg163RequireWebsiteBookingRateLimit_` does),
  because the answer reveals whether someone is a patient.

## 3. Follow-up length: 15 minutes plus a 15-minute gap

In `fdg111IsOfferedSlot_`, a returning slot needs `start … start + 30` free, and booking
holds the following 15 minutes as a buffer (or books a 30-minute calendar block with a
15-minute Charm appointment). The progressive :15/:45 release for follow-ups no longer
applies once every follow-up carries a gap. Orthotics pickup stays 15 minutes.

## 4. Sex (for insurance)

- `website-book`: store `booking.sex` in a new Front Door column `Sex` and pass it to Charm
  demographics (new patients). The gateway already accepts the extra field and ignores it until then.
- Registration (`frontdoor.html`, About you): add a Sex field once `FD230_FIELDS.personal`
  includes `sex` and the router writes it to Charm. Adding the field before that would look
  saved but be dropped.

## Deployment order

Private router → gateway (browser upload, read back, as before) → merge website branch.
