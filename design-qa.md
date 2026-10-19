# ARKEM Web V4.5 — Design QA

- Accepted visual reference: `Adsız(20260814-110913).jpg`
- Accepted logo master: `Adsız2(1).jpg`
- Rendered implementation: Browser/IAB capture at the native 1363 × 936 preview viewport
- Preview under test: Sites development preview

## Above-the-fold comparison

- Reference: the H1 entered the project-media column. Implementation: the copy and media share one bounded editorial grid; the H1 ends at 581.33 px and the media starts at 629.33 px in the native comparison viewport.
- Reference: the project frame dominated the hierarchy. Implementation: a 44/55 copy-media ratio and 48–72 px controlled gutter make the brand message primary and project evidence secondary.
- Reference: the project frame carried stage tabs and technical-looking controls. Implementation: only CMS-backed project identity, structural system, building type and one project CTA remain.
- Reference: the project rail was split into four database-like cells. Implementation: it is a 70/30 editorial metadata and action rail.
- Reference: ARKEMX carried a small inline `13` badge in the primary header. Implementation: the badge is removed; the complete `13 Proje Mühendisliği Modülü` label remains in navigation depth.

## Registry and interaction verification

- Hero selection is controlled by `heroFeatured` and `heroPriority`; P-002 code, location, system, media and route come from the project record.
- The first hero frame is the real structural-system record, followed by the completed-building record on a nine-second editorial transition.
- ARKEMX module 01 exposes 12 real connected-module nodes from `connectedModules`; the same 12 records are highlighted in the matrix.
- Opening connected module 05 produced the `Prefabrik Betonarme` detail, `DOĞRULANIYOR` status and `05 / 13` pagination.
- Mobile menu opens as a full-screen dialog, locks document scrolling, closes correctly and exposes all six navigation groups.
- The ARKEMX mobile group exposes all 13 direct module links plus Platform, 13 Modül, Doğrulama and Gelişim Günlüğü entries.

## Measured breakpoint acceptance

- 1920 × 1080: H1 right 840.50 px; media left 912.50 px; no overlap or horizontal overflow.
- 1600 × 900: H1 right 684.05 px; media left 748.05 px; no overlap or horizontal overflow.
- 1440 × 900: H1 right 613.06 px; media left 670.66 px; no overlap or horizontal overflow.
- 1366 × 768: H1 right 582.66 px; media left 630.66 px; no overlap or horizontal overflow.
- 1024 × 768: H1 right 435.11 px; media left 471.11 px; no overlap or horizontal overflow.
- 430 × 932, 390 × 844 and 375 × 812: H1 remains fully inside the client viewport, mobile header/menu is visible and document scroll width equals client width.
- Application console: no application-origin error detected; only the browser extension metadata warning appeared.

## Intentional deviation

- No verified local hero video file exists in the project archive. The implementation therefore uses a slow, accessible transition between two real P-002 project-media records instead of inventing or embedding an unverified video.

final result: passed
