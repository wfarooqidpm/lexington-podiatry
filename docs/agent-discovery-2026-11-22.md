# AI-agent discovery and direct booking — staged release

Owner goal: make Lexington Podiatry findable by any compatible future AI booking agent, then eventually allow direct appointments via a restricted public MCP/REST gateway. Discovery and booking are distinct problems.

## This branch
- Adds a visible guide for AI assistants and human patients: `/ai-booking`.
- Adds a unique, location-focused public page: `/podiatrist-near-grand-central`.
- Adds `/agent-booking.json` as an **informational site-specific manifest**, not a standardized agent-registration format and not an API credential.
- Adds experimental voluntary `/llms.txt` overview, `robots.txt`, `sitemap.xml`.
- Adds link(s) from home/booking page into the new guide (if present in the same PR).
- Uses current first-party booking URL as fallback. **The future external MCP/REST API is marked unavailable** until independently verified.

## Important distinctions
- XML sitemap, internal links and visible truthful structured data support indexing. Search rankings, AI citations and automatic MCP connector adoption are not guaranteed.
- `llms.txt` is a proposal/voluntary convention, not a universal guaranteed discovery protocol.
- Publishing a standard client MCP server requires real endpoint discovery plus auth metadata and platform-specific connector onboarding. Do not put a speculative URL in production metadata.
- A public web page can help an agent recommend a practice, but it cannot authorize private Charm access. The patient-facing page remains the existing booking flow until a proper OAuth/consent and Charm write/readback path is verified.
- Avoid generating near-duplicate SEO pages or false claims of insurer participation, instant availability, or special platform endorsement.
- Existing clinic pages, OS2 Apps Script scheduling, PodBridge permissions and patient data are untouched.

## Release checklist
1. Review content, office details, disclaimers, and canonical paths against current live site.
2. Merge and verify routes (including canonical extensionless URLs) on GitHub Pages; ensure HTTP 200 and no redirects to unrelated pages.
3. Validate JSON and XML, Schema.org JSON-LD, crawler access and sitemap.
4. Submit the site sitemap via the existing Google Search Console verified property and request indexing where appropriate.
5. Inspect Search Console indexing and query performance before more content changes.
6. Once external booking API is genuinely deployed and tested, update public site manifest and API documentation to expose verified endpoint and authorization details.
