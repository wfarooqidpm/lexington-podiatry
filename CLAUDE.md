# Lexington Podiatry website — working notes

Static site for **Lexington Podiatry**, a solo practice run by **Dr. Wiqar Farooqi, DPM**.
353 Lexington Ave, Rm 1502, New York, NY 10016 (two blocks from Grand Central) · (212) 510-8665
Live at https://lexingtonpodiatry.nyc (the main address; `www.` 301-redirects to it).

Dr. Farooqi describes outcomes; do the work and explain decisions in plain language.

## Publishing
- GitHub Pages, repo `wfarooqidpm/lexington-podiatry`, served from `main` at `/`. **Pushing to `main` publishes the live site.**
- Work on a branch, show a local preview (`python3 -m http.server` from the repo root), and merge only after Dr. Farooqi approves.
- `CNAME` must stay `lexingtonpodiatry.nyc`. DNS: apex A records → GitHub Pages IPs; `www` CNAME → `wfarooqidpm.github.io`. Already correct as of 2026-11-27.

## Booking — do not change behavior
- `booking.html` (served as `/booking`), `booking-single-page.js`, `booking-agent.js`, `booking-options.json`, `booking-api.json`, `frontdoor*.{html,js}`, `visit-history.js`, `appointments/`, and `releases/*.gs` connect to Charm through the practice's scheduling gateway (Google Apps Script).
- Don't change booking behavior. Flag anything near it before touching it, and run `for t in tests/*.cjs; do node $t; done` after any change to those files.
- Booking page goals: simple, clearly labeled, no pop-ups, so people and AI booking agents can complete it.

## Content rules
- Every page must be genuinely useful on its own. No thin, templated, keyword-stuffed or hidden search-only pages.
- All medical content is a **draft for Dr. Farooqi's review**. Never publish clinical claims he hasn't approved. Show him as the reviewing physician.
- No made-up reviews, testimonials or statistics. Rating claims must match the source (Zocdoc: 4.94 from 142 reviews; Google: 5.0 from 19 reviews (both checked 2026-11-27); re-check before changing).
- Insurance: focus on in-network care, no surprises. Name only the specific in-network plans (currently Medicare, Aetna, Anthem BCBS, Cigna, 1199SEIU, TRICARE); never "most PPO plans" or "most major insurers". UnitedHealthcare is out of network and must be described that way.
- No self-serving review-star markup (`aggregateRating`/`review`) in structured data.

## SEO conventions
- Main address only (`https://lexingtonpodiatry.nyc/...`) in canonicals, sitemap and JSON-LD; never `www.`.
- Every condition/service page needs a unique title, meta description, self-referencing canonical, a sitemap entry, and a link from the homepage "Conditions we treat" section.
- Pages embed images as base64 data URIs, so HTML files are large (index.html ≈ 1 MB). Search with scripts that strip `data:` URIs.
