# Local icon sources

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
