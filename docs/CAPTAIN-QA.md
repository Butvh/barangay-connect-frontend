# Captain workspace verification

The Captain workspace reuses administrative pages and adds Dashboard,
Personnel, and Reports. Existing records, origin storage keys and schema
version are preserved. No seed records are replaced or reset.

## Editable Figma deliverable

APP-DEV-Final: `GaTDGoek1jzWbcOh9dz4f2`, Hi-Fi Prototype page `26:5`.
The Captain frames sit to the right of the existing screens. Inventory:
`captain-figma-frames.json`. Main entry `4794:99739`; Personnel `4794:99996`;
Reports `4794:100256`. Includes desktop, tablet, mobile, six personnel dialogs,
report subviews, role variants and connected shared-page states.

Structural review found 108 editable Captain frames, no missing prototype
destinations, and no inherited Secretary header labels. Shared-page navigation
and nested conditional destinations were corrected to Captain variants;
sign-out retains the existing login and component variant interactions remain
shared. The final resolve confirmation targets Captain `4837:106459`.
Figma uses illustrative existing workflow states; live frontend totals are
computed from the stored records. Screenshots of Dashboard, Personnel,
Reports, Captain Alerts and the mobile personnel form were visually checked.

## Automated review

Run `node scripts/run-tests.mjs` and `node scripts/check.mjs`.
Regression coverage includes Captain/tenant policies, other-role denial,
capacity/stale writes, preserved Tanod membership/history, busy-incident role
changes, operator availability, notifications, report date/unknown-data rules,
CSV formula escaping and activity attribution/deduplication.

The independent review's three findings were fixed with failing-then-passing
regressions: missing operator handoffs, effective versus processing expiry
dates, and duplicate source/audit events. A further regression protects one
assignment notification per newly assigned operator. The reviewed fixes have
no remaining blocking findings.

## Browser checks

Local preview: `127.0.0.1:8787`, existing fictional Roberto Aquino account.

- Captain dashboard, map zoom, announcement composer/cancel and all nine
  navigation destinations; all six shared management pages retain Captain
  identity and navigation. No browser console errors/warnings were observed.
- All six Personnel dialogs, required-field validation and cancellation.
  The user explicitly approved appointing fictional Luis Garcia as Secretary
  and returning him to the Tanod pool. Counts changed and returned correctly;
  both history entries retained actor and timestamps. External-personnel save,
  reassignment, capacity races and role revocation have isolated automated
  coverage; those writes were not repeated in the browser.
- Reports overview, incidents, activity and activity details, operations,
  role-specific performance/details, all reports, and incident details.
  Combined search/type/status filtering selected the expected record. CSV
  download completed and its actual contents were checked. The print control
  and print-only dialog stylesheet are implemented; no physical print was sent.
- Dashboard and Reports page-width checks at 320, 390, 768, 1366 px; Dashboard
  also at 1920 px. No horizontal page overflow. Personnel mobile layout checked
  at 390 px; external form bounds/scrolling checked at 320, 390, 768, 1366 px.

## Deployment boundary

This remains a fictional browser-storage demo. Personnel requirements store
file metadata, not uploaded file bytes. Authentication, authorization, audit,
capacity locks, durable uploads and credentials must move to the server before
production, as described in LARAVEL-MIGRATION.md. Unknown historical metrics
remain unavailable or are explicitly shown as known partial counts.
