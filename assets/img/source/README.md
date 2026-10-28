# Local icon sources

`alert-*.svg` are exact exports from Secretary O-02 frame 261:17340 / content
4077:96487 in GaTDGoek1jzWbcOh9dz4f2. They supply shared Alerts rows and
filters at native 20/24/40 px sizes, scaled in responsive slots.

The `lucide-*.svg` files are local copies of the canonical Lucide icons from
https://github.com/lucide-icons/lucide/tree/main/icons, distributed under
`Lucide-LICENSE.txt`. The `imgLucide*` files are original Figma exports.

The shared sprite uses the canonical `lucide-circle-check.svg` instead of the
white, partially transparent Figma status-state export. Its circle and check
inherit `currentColor`, so both remain visible on light surfaces and buttons.

`menu`, `layout-dashboard`, and `clipboard-check` are available through
`Icons.svg(name)` for the official shell. `Icons.disaster(type)` returns the
sprite name for the canonical disaster enum, with `triangle-alert` as fallback.

Secretary Dashboard uses the exact Figma exports `secretary-maximize.svg`,
`secretary-location.svg`, `secretary-marker-count.svg`, and
`secretary-section-arrow.svg` from frame 3743:90916 in file
GaTDGoek1jzWbcOh9dz4f2. They retain their native SVG dimensions and colors;
page-local assets avoid altering white shared sprite icons used elsewhere.

Notification assets `notification-{waves,shield,alert,mountain,cloud,more,
trash-blue,trash-red,trash-white,close}.svg` are exact exports from notification
panel 2084:40090 and confirmation 3639:87698 in that same Figma file. All retain
their native 24 px dimensions and colors. `notification-mail.svg` uses the
canonical Lucide mail geometry, under the included Lucide license, for the
Mark as unread menu action.

`resident-notification-*.svg` exports come from the approved Resident R-13
frames 250:18436 (desktop) and 2017:33343 (mobile). They supply the original
rounded-tile glyphs, 16 px state dots, neutral trash and dismiss icon. Desktop
bell/megaphone exports have native 42.6667 px canvases, displayed through a
0.75 transform in their 32 px design slots; mobile uses separate native 24 px
exports. SVG files and root dimensions are preserved.

Captain metric assets are exact exports from editable Captain frames in
APP-DEV-Final (GaTDGoek1jzWbcOh9dz4f2): `captain-dashboard-*` from 4794:99739,
`captain-personnel-*` from 4794:99996, and `captain-reports-*` from
4794:100256. Personnel user/users/hardhat/shield corrections use nodes
4799:100378, 4799:100393, 4799:100409 and 4799:100422. SVG root dimensions
remain unchanged (16 px chevrons, 24/30 px metric glyphs). The dashboard also
reuses the existing Secretary location, section arrow, map and maximize assets.

Facilities controls: `facility-menu.svg` and `facility-plus.svg` are exported from APP-DEV-Final node 261:23680; `facility-active.svg` and `facility-inactive.svg` from 3469:77790, via the Figma MCP asset URLs on 2026-10-28. The existing local Sampaguita map and icon sprite are reused.
