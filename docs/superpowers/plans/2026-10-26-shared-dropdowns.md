# Shared Dropdowns Implementation Plan

> For agentic workers: use superpowers:executing-plans inline, with one fresh whole-branch review before integration.

**Goal:** Reuse the Alerts dropdown design for every existing single-select field across all five roles, including forms and dialogs.

**Architecture:** Extract the Alerts select adapter into core/select.js. Native selects remain the data/validation source. The shared UI module installs one lifecycle observer for current and dynamically inserted controls; the old Alerts export delegates to the same implementation. Preserve existing field classes and page sizing, move exact option styling into components.css, and keep action menus unchanged.

**Tech Stack:** Existing vanilla ES modules, CSS tokens, native forms and top-layer popovers; no packages or backend changes.

**Spec:** User attachment 941286ad-43b4-461d-a906-424bfbe607e8/Pasted text.txt and supplied Alerts screenshot.

## Global constraints / design

- Reuse the white, bordered, rounded Alerts menu with shadow, 14/20 Inter text, 42 px options, blue selected text and pale blue hover/active fill.
- Retain each field's existing dimensions: 58 px desktop Alerts filters, existing 48 px/compact form fields elsewhere. Preserve options, values, names, defaults, validation, events and permissions.
- Open at field width below with a 4 px gap; flip above if needed, constrain to viewport and scroll long menus. Mount inside the owning dialog, then promote to the top layer, so modal inertness and clipping are handled correctly.
- Preserve labels, required/errors, disabled controls/options/optgroups, keyboard/type-ahead, reset, programmatic value updates and dynamically replaced fields/options.
- Skip multiple/listbox selects and retain native functionality if top-layer enhancement is unavailable. No redesigned action menus, pages or Figma screens.

## Tasks

- [x] Add real-browser regression coverage against the existing Alerts adapter; demonstrate failures for disabled options, native form validation, dynamic controls/options and viewport-edge positioning.
- [x] Extract/extend shared select adapter, lifecycle installation and exact shared CSS. Keep compatibility export for Alerts and its existing field sizing.
- [x] Run browser regressions and existing suite; address integration issues. Inventory every select-producing page/module and verify shared coverage.
- [x] Browser-check Resident forms/maps, Secretary filters, operator action dialogs and Captain personnel/reports. Check keyboard, reset, disabled states, modal placement, long lists and desktop/tablet/mobile bounds.
- [ ] Fresh review, final static/syntax/tests, PR CI; merge only green, synchronize XAMPP and verify Pages.

## Verification / review focus

Native FormData/validation must still operate on select elements. Hidden required controls must focus the visible trigger and explain the error. Modal menus must receive clicks without closing the dialog. Synchronize programmatic value/selectedIndex assignments without emitting synthetic changes. Clean up removed controls and pagehide listeners; avoid duplicate enhancement, duplicate events and orphaned popovers. Never introduce role/data mutations for this UI task.

Baseline: 99692ca, clean reused linked checkout, 269 tests passed. Branch codex/standardize-dropdowns.
