# Required Visit History Implementation Plan

**Goal:** Require a meaningful visit history after Insurance in the existing Front Door.
**Architecture:** Existing section save pipeline, shared pure validation and structured history; derive existing hpi and visitReasons fields for downstream compatibility.
**Tech Stack:** Vanilla JavaScript, Google Apps Script, Node tests.
**Spec:** docs/superpowers/specs/2026-11-12-required-visit-design.md

## Global constraints
Existing design and save recovery stay intact. No default clinical answers. Medical history stays optional. No PHI in source or fixtures.

## Review focus
Other descriptions; conditional toe/border requirements; stale drafts cannot gain completion; additional medical saves cannot overwrite history; old generic booking labels cannot satisfy new requirements.

### Task 1: Visit section and persistence
- [ ] Add failing behavior tests for validation, summary, section placement and readiness.
- [ ] Add visit-history.js with pure validate/summary functions and matching existing section UI.
- [ ] Integrate visit key into form collection, readiness and save validation; preserve old text.
- [ ] Update live-source gateway fields, submission validation and completion checks.
- [ ] Run all Node tests and fictional DOM integration checks.

### Task 2: Release
- [ ] Review diff and compare live source to captured baseline.
- [ ] Save gateway via existing Apps Script editor and update existing deployment.
- [ ] Publish website changes and verify fictional preview and deployed assets.
