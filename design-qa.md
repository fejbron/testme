# Instructor dashboard design QA

- Source visual truth: `C:\Users\EdBron\.codex\generated_images\01a0bf90-116a-7d33-8fb1-b84ac7cf7e57\exec-57cf281e-84fd-45f9-91d7-231900c11328.png`
- Desktop implementation: `docs/design-qa/instructor-watchtower-desktop.png`
- Mobile implementation: `docs/design-qa/instructor-watchtower-mobile.png`
- Viewports: 1440 × 1024 and 390 × 844 CSS px, device scale factor 1
- Source dimensions: 1440 × 1024 px; desktop implementation: 1440 × 1024 px
- State: all students, Neil Armstrong selected, filters inactive

## Full-view comparison evidence

The implementation matches the selected Watchtower structure: persistent campaign rail, compact heading, dense central progress roster, and selected-student inspector. It uses the same near-black surfaces, signal-green selection, thin dividers, compact mono labels, and isolated reset treatment. Fixture density is eight students rather than the source's twelve, while the primary proportions and scan pattern remain equivalent.

The responsive view collapses secondary roster columns while keeping student identity, progress, score, filters, selection, and the full intervention inspector available without horizontal scrolling.

## Focused region comparison evidence

- Roster: search, campaign scope, attention filter, selected-row treatment, progress fill, environment status, failures, and last-activity data match the source hierarchy.
- Inspector: identity, campaign, stage progression, score, environment, activity signals, open-record action, and reset control appear in the same operational order.
- Navigation: scope rail and campaign counts preserve the source's compact left-hand model and active signal-green indicator.

## Required fidelity surfaces

- Fonts and typography: existing TestMe mono/sans tokens retained with comparable hierarchy, weights, truncation, and line height.
- Spacing and layout rhythm: 180 px rail, fluid roster, 330 px inspector, 61 px rows, and compact 12 px region gaps reproduce the source proportions.
- Colors and visual tokens: black/graphite surfaces, neutral borders, white hierarchy, signal green, and red warning states align with the selected design; no gradients were introduced.
- Image quality and asset fidelity: the source contains no raster imagery. Existing Phosphor icons cover all visible symbols; no placeholder or handcrafted icon assets were added.
- Copy and content: all labels reflect existing instructor data and actions—campaign, progress, score, environment, hints, failures, last activity, student record, and environment reset.

## Interaction verification

- Search filters the roster.
- Selecting a row updates the inspector.
- Campaign scope and attention-only controls work.
- Student record navigation remains connected to the existing detail route.
- Reset environment uses the existing API with confirmation.
- Desktop and mobile layouts rendered successfully.
- Browser console errors checked: none.
- Playwright result: 2 tests passed.

## Comparison history

1. Preview harness loading state prevented initial interaction capture. Fixed by injecting deterministic fixture data into the same production component for QA only; the temporary preview route was removed after capture.
2. Post-fix comparison found no actionable P0, P1, or P2 visual differences.

## Follow-up polish

- P3: On very narrow screens, the inspector could become a slide-up drawer to shorten the page.

final result: passed
