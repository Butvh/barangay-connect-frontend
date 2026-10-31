# Official Alert Detail Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for inline implementation. Review the whole branch before merging.

**Goal:** Match the supplied Alert Detail image across Captain, Secretary, Responder and Rescuer without changing dispatch permissions or records.

**Architecture:** Keep the existing shared page/controller and assignment/logging dialogs. A focused presentation module renders the new layout and chooses one authorized header action using existing transition rules. Reuse the Resident progress projection so both views agree about recorded stages. Isolate styling in an Alert Detail stylesheet.

**Tech Stack:** Existing offline HTML, CSS, browser ES modules, demo API and BCMap; no new runtime dependencies.

**Spec:** User's supplied “Redesign the Alert Detail Subpage for All Official Views” request and first screenshot (not available in Figma).

## Global Constraints

- Preserve the official shell, demo data, API, assignment limits (Responder 2, Rescuer 1), dialogs, confirmation steps and role permissions.
- No verification badge in the summary; no invented channel, photo, contact, assignment provenance or stage timestamps.
- All actions remain explicit; displaying an alert never advances it.
- Captain-only reassignment/cancellation stays Captain-only under the current permission model.

## Design

- Existing Inter, navy #172033, blue #1E5AA8, background #F4F6F9, white cards, border #D5DBE3 and 12px radius.
- Left-aligned desktop content: main column about 65%, right rail about 35%, 16px gaps. Header/back link and summary above reporter/description/photo/log cards; right rail begins at the header with timeline, map and personnel.
- Compact 32px page heading, 24px incident title, 18px card headings and 14px values. Keep the existing shell dimensions.
- Match the reference structure; use the app's established status colors and real state where the reference's sample values conflict.
- Stack columns on tablet and logs/summary on mobile; preserve the full 2D map aspect ratio and accessible controls.

## Review Focus

1. Resolved without rescue or missing timestamps must not show invented completed phases.
2. Response and rescue logs remain complete, including notes and response type beyond the compact table columns.
3. Historical/closed assignments must never expose edit actions; operational users cannot see administrative actions/history.
4. A needed manual rescuer assignment must occupy the primary action slot before any later resolution action.
5. Long labels, edge pins, empty records and filenames must fit without overflow or fictitious image previews.

## Task 1: Shared detail presentation and behavior

- [x] Add failing regression checks for one authorized primary action, stage evidence, role-specific assignment controls, missing data, complete escaped log/filename content and navigation.
- [x] Run the focused tests and confirm meaningful failures on the existing page.
- [x] Implement the presentation module, update the existing controller bindings and add scoped responsive CSS.
- [x] Run focused regressions and existing tests.

## Task 2: Visual and integration verification

- [x] Compare desktop against the first screenshot; inspect tablet/mobile overflow, map geometry and buttons.
- [x] Exercise all four roles and five phases, assignment capacity/history, log dialogs and Resident synchronization in an isolated local demo origin.
- [x] Run `node scripts/run-tests.mjs`, `node scripts/check.mjs`, JS syntax and diff checks.
- [x] Obtain fresh read-only whole-diff review; fix material findings and repeat affected checks.
- [ ] Commit, push, pass CI, merge into main, fast-forward the local main checkout and verify deployment.

## Verification record

- Shared presentation regressions: 6 checks cover workflow/ownership, historical assignment controls, stage evidence, truthful missing data and zero victims, complete escaped logs/filenames, and map navigation.
- Existing suite includes Responder capacity 2, Rescuer capacity 1, completion releasing slots, no-rescue resolution, stale revisions and role authorization.
- Browser walkthrough on isolated origin 127.0.0.1:8806: Captain acknowledged A-1042 and selected Carlo; Responder logged response with rescue required; Secretary saw Ramon disabled at 1/1 capacity; Rescuer completed the existing A-1038 operation, releasing capacity; Secretary manually assigned Ramon to A-1042; Rescuer logged rescue at Sampaguita Elementary School; Secretary confirmed resolution. Both logs and closed assignment history remained visible; Resident A-1042 also showed Resolved.
- All four official roles opened the redesigned page. Operational users had their logging action and no administrative controls. Captain retained eligible reassignment/cancellation; Secretary retained the existing assignment authority without expanded access.
- Desktop 1672x941, tablet 768x1024 and mobile 390x844 inspected. Cards stack without page overflow, stage labels remain readable, and map keeps its aspect ratio. Proof screenshots are outside the repository in the workspace deliverables directory.
- Fresh independent whole-diff review identified the map query parameter mismatch. Regression was changed to the destination contract, observed failing, then fixed to `?alert=ID`. Browser verification of non-default A-1038 selected A-1038 on the map.
- Ruling: preserve the existing demo's filename-only photo storage rather than inventing image URLs or modifying the API. Missing reporter contact/channel and legacy assignment provenance use explicit fallbacks.
- Ruling: preserve the official shell dimensions; only the detail content adopts the supplied arrangement.

