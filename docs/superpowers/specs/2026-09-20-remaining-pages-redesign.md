# Remaining Pages Unified Redesign

## Objective

Bring every remaining TestMe user-facing page into the established black, graphite, white, and signal-green product system while preserving current authentication, instructor, campaign, grading, and reset behavior.

The redesign must make public discovery, account access, and instructor review feel like one product without forcing every screen into the same layout.

## Scope

### Public landing page

- Route: `/`
- Replace the current inline-styled marketing page with a responsive product story.
- Preserve the existing campaign facts, descriptions, tags, account creation link, and sign-in link.
- Organize the page into a focused investigative hero, working terminal demonstration, campaign progression, platform principles, and final signup action.

### Authentication flow

- Routes: `/login`, `/signup`, `/forgot`, `/auth/reset`
- Components: `LoginForm`, `SignupForm`, `ForgotForm`, `ResetForm`
- Introduce a shared authentication shell and shared form-control treatments.
- Preserve Supabase calls, role-aware redirects, reset-link handling, validation rules, and success messages.
- Add visible field labels, password visibility controls, loading states, clear errors, and responsive layouts.

### Instructor student detail

- Route: `/instructor/students/[instanceId]`
- Component: `StudentDetail`
- Reorganize the record as an operational case file with a compact identity/campaign summary and navigable sections for Overview, Stages, Submissions, Notes & Findings, and Timeline.
- Preserve environment, category scoring, reset modes, score adjustments, stages, submissions, notebook entries, findings, evidence, and timeline data.
- Keep destructive reset actions isolated in a clearly labeled danger area with explicit confirmation.

## Already Redesigned and Out of Scope

- Student campaign list (`/dashboard`)
- Campaign stage workspace (`/dashboard/[instanceId]`)
- Admin workspace (`/admin`)
- Instructor overview (`/instructor`)
- API contracts, database schema, authorization policy, campaign content, grading logic, and deployment configuration

Existing redesigned screens may supply tokens and reusable patterns, but their information architecture will not be changed.

## Design System

Use the established TestMe language:

- Near-black page background and graphite operational surfaces
- Crisp white hierarchy and restrained signal-green active states
- Red reserved for destructive or failed states
- Existing mono and sans typography pairing
- Phosphor icons for interface symbols
- Thin dividers, small radii, minimal elevation, and no gradients
- Spacing, alignment, and typography before additional borders or nested cards
- Motion from the existing `motion` dependency with reduced-motion support

Before production implementation, produce exactly three independent unified visual directions grounded in the existing admin, instructor, mission-control, and campaign-stage screenshots. Each direction must demonstrate the landing page, authentication shell, and student case-file language sufficiently to choose one coherent target. The chosen direction becomes the source of truth for implementation and design QA.

## Component Boundaries

### Public experience

- `MarketingHeader`: brand, sign-in action, create-account action
- `InvestigationHero`: product promise and primary action
- `TerminalDemo`: deterministic presentation-only terminal sequence
- `CampaignPath`: ordered campaign progression using existing campaign copy
- `MarketingFooter`: final account action and product links

These components may remain local to the landing feature unless reuse becomes concrete.

### Authentication experience

- `AuthShell`: shared responsive page structure and brand/product context
- `AuthField`: label, input, optional password visibility control, help/error text
- `AuthNotice`: loading, error, and success feedback
- Existing form components retain ownership of Supabase requests and redirects.

The shell must not know authentication-provider details. Forms must not duplicate page layout.

### Instructor case file

- `StudentDetail` owns loading and refresh behavior.
- `StudentHeader` summarizes identity, campaign, status, score, and environment.
- `StudentSectionNav` controls the active record section.
- Section components render stages, submissions, notes/findings, and timeline.
- `ScoreAdjustForm` remains attached to a submission and preserves integer/reason validation.
- `ResetControls` owns stage selection, confirmation, busy/error states, and existing reset API calls.

No new API endpoints are required.

## Data Flow

### Authentication

1. Page renders the shared shell and route-specific form.
2. Form validates local constraints.
3. Form calls the existing Supabase browser client.
4. Error or success feedback is shown in the form.
5. Successful sessions follow existing role-aware destinations.

### Instructor detail

1. Route authorization remains server-side.
2. `StudentDetail` fetches the existing instance-detail endpoint.
3. The response populates all sections without additional waterfalls.
4. Score adjustment or reset operations call existing endpoints.
5. Successful mutations refresh the same student record and show a compact success notice.

## Interaction Requirements

- Landing motion: staged hero entrance, terminal playback, campaign hover/selection, and progress-line transitions.
- Authentication: labeled controls, keyboard navigation, password reveal, disabled/loading submit, and animated notices.
- Instructor detail: keyboard-accessible section navigation, visible selected state, local score-adjust form expansion, and explicit reset confirmations.
- Primary actions remain visible on 390 px mobile layouts.
- No persistent horizontal scrolling for core workflows.
- Respect `prefers-reduced-motion` through the existing global rule and motion-library settings.

## Loading, Empty, Error, and Success States

- Landing content is static and must render without client-side loading.
- Authentication errors stay near the form and do not erase entered values.
- Forgot-password success replaces the form with a clear inbox instruction and a return path.
- Reset-password waiting state explains the missing recovery session.
- Instructor detail exposes full-page loading/error states and section-specific empty states.
- Mutation failures stay beside the action that caused them.
- Successful score/reset operations produce dismissible confirmation notices.

## Accessibility

- Visible labels for every form field
- Semantic headings and landmarks
- Accessible names for icon-only controls
- Strong focus-visible treatment using the signal color
- Status meaning communicated by text and icon, not color alone
- Destructive actions clearly named and confirmed
- Controls and text meet practical contrast and touch-target requirements

## Testing and Verification

- Add tests first for any extracted validation, filtering, formatting, or state helpers.
- Preserve existing route and service tests.
- Run the complete Vitest suite and TypeScript checks.
- Run a production Next.js build.
- Create temporary, non-production preview fixtures for browser QA when authentication blocks local capture; remove those fixtures before committing.
- Browser-test landing navigation, each authentication form state, instructor section navigation, score-adjust expansion, reset confirmation boundary, and responsive behavior.
- Check browser console errors.
- Capture desktop and mobile implementation screenshots.
- Compare each implemented surface with the chosen visual target and record evidence in `design-qa.md`.
- Do not commit or push until design QA reports `final result: passed` and the repository is clean apart from intended changes.

## Delivery Sequence

1. Generate and select one unified visual direction.
2. Establish shared public/auth tokens and primitives.
3. Implement the landing page.
4. Implement the authentication shell and all four auth routes.
5. Implement the instructor student case file.
6. Run responsive interaction and visual QA across the full scope.
7. Commit under `fejbron <fejbroni@umat.edu.gh>` without co-author trailers and push to `main`.

## Success Criteria

- Every scoped page visibly belongs to the same TestMe system as the redesigned dashboards.
- Existing user journeys and backend behavior remain intact.
- Core workflows are usable at desktop and mobile widths.
- Loading, error, empty, success, and destructive states are intentional and accessible.
- Automated tests, production build, browser checks, and design QA pass before push.
