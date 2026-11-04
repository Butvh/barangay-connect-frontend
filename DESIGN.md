---
version: alpha
name: Barangay Connect
description: A calm, legible barangay emergency and administration workspace.
colors:
  primary: "#1E5AA8"
  primary-hover: "#164785"
  selected: "#D6E6F7"
  background: "#F4F6F9"
  surface: "#FFFFFF"
  text: "#172033"
  secondary: "#475467"
  muted: "#667085"
  border: "#D5DBE3"
  danger: "#C62828"
  success: "#1B7F4B"
  warning: "#8A5300"
typography:
  sans:
    fontFamily: "Inter, system-ui, sans-serif"
rounded:
  DEFAULT: "8px"
  card: "12px"
  dialog: "16px"
  pill: "999px"
spacing:
  unit: "4px"
  field-gap: "16px"
  section-gap: "24px"
components:
  button: {}
  field: {}
  dialog: {}
  table: {}
---

# Barangay Connect design context

## Overview

Residents and barangay officials need clear incident status and trustworthy administrative records. This is an English product interface for Philippine barangays, using Asia/Manila dates. The illustrated barangay map and blue navigation identify the system; administration forms use the existing quiet card layout. Preserve the established design during backend integration. Do not add a marketing treatment, new palette or ornamental dashboard elements.

Runtime tokens in `assets/css/tokens.css` are canonical. The frontmatter documents existing values; it does not generate a second theme. Additional semantic/map colors, typography sizes, spacing and shadows remain defined in that file. Shared controls are in `assets/css/components.css`, `assets/js/core/ui.js` and the existing official/resident shared page modules. No runtime token changes are part of mandatory administration integration.

## Colors

Primary blue identifies actions and navigation. Red marks destructive actions, green confirms success, and amber indicates pending/caution. Status words and icons always accompany color. White surfaces sit on the neutral background with existing borders.

## Typography

Use the bundled Inter variable font with the existing system fallback, type scale and 400/500/600 weights. Keep labels visible. Preserve sentence-case actions and established alert/verification vocabulary. Dates use the shared formatter, never browser-dependent ad hoc formatting.

## Layout

Retain the existing sidebar, icon rail and mobile drawer behavior. Use existing 4px spacing tokens, responsive tables/card lists and natural document scrolling. Backend failures must preserve form drafts and control positions. No page-level viewport/overflow changes are authorized by this integration.

## Elevation & Depth

Reuse existing small card shadows and dialog overlay tokens. Do not introduce decorative gradients, new elevations or background imagery.

## Shapes

Buttons/inputs use8px, cards12px, dialogs16px and badges pill radii through runtime variables. Reuse the established icon set.

## Components

See `UX-CONTRACT.md` for canonical owners. Existing forms, dialogs, toasts, validation and file pickers remain. Real private downloads replace fictional placeholders only in explicitly selected administration test builds. Demo mode retains its truthful filename-only behavior.

## Do's and Don'ts

Preserve the current style, accessible labels, keyboard focus and mobile touch targets. Distinguish confirmed server success from unavailable or failed integration. Never display credential values or private storage paths. Do not redesign working screens while connecting the backend.
