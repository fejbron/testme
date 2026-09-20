# Remaining Pages Unified Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign TestMe's landing page, complete authentication flow, and instructor student-detail workspace as one responsive, accessible visual system without changing backend behavior.

**Architecture:** Establish a chosen visual direction, then introduce narrowly scoped presentation primitives for public/auth pages while keeping authentication requests inside the existing form components. Recompose instructor detail data into section components under the existing `StudentDetail` fetch/mutation owner, with pure helpers extracted for test-first development.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, CSS Modules, Motion 13, Phosphor Icons, Supabase Auth, Vitest, Playwright CLI.

**Spec:** `docs/superpowers/specs/2026-09-20-remaining-pages-redesign.md`

## Global Constraints

- Preserve all existing Supabase calls, role-aware redirects, API routes, reset modes, score adjustment behavior, and campaign copy.
- Use the existing near-black/graphite palette, signal-green active state, red destructive state, mono/sans typography pairing, Phosphor icons, and `motion` dependency.
- Add no gradients, new API endpoints, database changes, authorization changes, campaign content changes, or grading changes.
- Core workflows must fit a 390 px viewport without persistent horizontal scrolling.
- Respect `prefers-reduced-motion` through the existing global rule and restrained Motion transitions.
- Commit as `fejbron <fejbroni@umat.edu.gh>` without co-author trailers.

## Review Focus

- Password mismatch and passwords shorter than eight characters must remain local validation failures; pin this in Task 2 helper tests.
- A missing password-recovery session must remain an explanatory waiting state; pin this in Task 2 browser checks.
- Instructor records with empty stages, submissions, notes, findings, evidence, or timeline must render useful empty states; pin this in Task 4 helper/component fixture tests.
- Score adjustments must reject non-integer deltas and blank reasons before calling the API; pin this in Task 4 helper tests.
- Reset stage must reject an empty stage selection and all reset modes must retain confirmation; pin this in Task 4 helper and browser checks.

---

### Task 1: Select the Unified Visual Direction

**Files:**
- Read: `docs/design-qa/admin-workspace-desktop.png`
- Read: `docs/design-qa/instructor-watchtower-desktop.png`
- Read: `docs/design-qa/mission-control-desktop.png`
- Read: `docs/design-qa/stage-workspace-desktop.png`
- Produce outside repository: three ImageGen mockups

**Interfaces:**
- Consumes: approved specification and the four existing visual references.
- Produces: one explicitly selected ImageGen result used as the source of truth by Tasks 2–5.

- [ ] **Step 1: Generate three independent unified directions**

Each 1440 × 1024 direction must show enough of the landing hero, auth shell, and instructor case-file language to establish shared typography, navigation, fields, panels, section navigation, motion cues, and responsive intent. Attach the four reference screenshots to every generation.

- [ ] **Step 2: Present the three generated images exactly once**

Ask the user to choose `1`, `2`, or `3`; do not edit production code before selection.

- [ ] **Step 3: Record the selected source path**

Add the exact generated-image path to the working notes used by final `design-qa.md`.

### Task 2: Build Shared Authentication Presentation and Validation

**Files:**
- Create: `src/app/auth/auth-ui.ts`
- Create: `src/app/auth/auth-ui.test.ts`
- Create: `src/app/auth/AuthShell.tsx`
- Create: `src/app/auth/auth.module.css`
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/login/LoginForm.tsx`
- Modify: `src/app/signup/page.tsx`
- Modify: `src/app/signup/SignupForm.tsx`
- Modify: `src/app/forgot/page.tsx`
- Modify: `src/app/forgot/ForgotForm.tsx`
- Modify: `src/app/auth/reset/page.tsx`
- Modify: `src/app/auth/reset/ResetForm.tsx`

**Interfaces:**
- Produces: `validatePasswordPair(password: string, confirm: string): string | null`; `AuthShell({ eyebrow, title, description, children, footer })`; shared classes for fields, password reveal, submit, notice, and links.
- Consumes: existing Supabase browser client and Next router behavior.

- [ ] **Step 1: Write failing validation tests**

```ts
import { describe, expect, it } from "vitest";
import { validatePasswordPair } from "./auth-ui";

describe("validatePasswordPair", () => {
  it("rejects a password shorter than eight characters", () => {
    expect(validatePasswordPair("short", "short")).toBe("Password must be at least 8 characters.");
  });
  it("rejects mismatched passwords", () => {
    expect(validatePasswordPair("password1", "password2")).toBe("Passwords do not match.");
  });
  it("accepts a matching valid password", () => {
    expect(validatePasswordPair("password1", "password1")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/app/auth/auth-ui.test.ts`
Expected: FAIL because `auth-ui` does not exist.

- [ ] **Step 3: Implement the pure validation helper**

```ts
export function validatePasswordPair(password: string, confirm: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password !== confirm) return "Passwords do not match.";
  return null;
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- src/app/auth/auth-ui.test.ts`
Expected: 3 tests pass.

- [ ] **Step 5: Implement the selected auth shell and CSS Module**

Create semantic `<main>`, `<section>`, and `<aside>` regions; keep product context separate from form content. Use Phosphor icons for brand/security/visibility controls, Motion for notice and form entrance, visible labels, `aria-live` for feedback, and password reveal buttons with accessible names.

- [ ] **Step 6: Refactor all four route pages into `AuthShell`**

Pass route-specific eyebrow, title, description, form, and footer links. Remove inline page layout styles while preserving server redirects on login/signup.

- [ ] **Step 7: Refactor forms without changing request behavior**

Replace duplicated password validation with `validatePasswordPair`, preserve entered values after errors, retain existing Supabase method arguments, and retain current post-success redirects/notices.

- [ ] **Step 8: Verify authentication code**

Run: `npm test -- src/app/auth/auth-ui.test.ts && npm run typecheck`
Expected: tests and typecheck pass.

- [ ] **Step 9: Commit authentication work**

```bash
git add src/app/auth src/app/login src/app/signup src/app/forgot
git commit -m "feat: redesign authentication flow"
```

### Task 3: Rebuild the Public Landing Experience

**Files:**
- Create: `src/app/marketing-data.ts`
- Create: `src/app/marketing-data.test.ts`
- Create: `src/app/marketing.module.css`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Produces: `campaignPaths` in canonical order and a responsive static landing page.
- Consumes: selected visual direction, existing campaign descriptions/tags, `/signup`, and `/login`.

- [ ] **Step 1: Write the failing campaign-order test**

```ts
import { describe, expect, it } from "vitest";
import { campaignPaths } from "./marketing-data";

describe("campaignPaths", () => {
  it("keeps the learning path in beginner-to-expert order", () => {
    expect(campaignPaths.map((path) => path.title)).toEqual([
      "Boot Camp", "Field Work", "Project Janus", "The Gauntlet",
    ]);
  });
  it("keeps at least one skill tag on every campaign", () => {
    expect(campaignPaths.every((path) => path.tags.length > 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/app/marketing-data.test.ts`
Expected: FAIL because `marketing-data` does not exist.

- [ ] **Step 3: Extract the current copy into `marketing-data.ts`**

Export the existing stats and four campaigns verbatim with typed fields `{ kind, title, desc, tags }`; do not rewrite facts or campaign claims.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- src/app/marketing-data.test.ts`
Expected: 2 tests pass.

- [ ] **Step 5: Implement the selected landing composition**

Build `MarketingHeader`, `InvestigationHero`, `TerminalDemo`, `CampaignPath`, and `MarketingFooter` as local components in `page.tsx`. Use actual Phosphor icons instead of glyphs or CSS drawings. Keep the page server-rendered; isolate any Motion sequence in the smallest necessary client component.

- [ ] **Step 6: Verify landing code**

Run: `npm test -- src/app/marketing-data.test.ts && npm run typecheck`
Expected: tests and typecheck pass.

- [ ] **Step 7: Commit landing work**

```bash
git add src/app/page.tsx src/app/marketing-data.ts src/app/marketing-data.test.ts src/app/marketing.module.css
git commit -m "feat: redesign public landing page"
```

### Task 4: Rebuild Instructor Student Detail as a Case File

**Files:**
- Create: `src/app/instructor/students/[instanceId]/student-detail-ui.ts`
- Create: `src/app/instructor/students/[instanceId]/student-detail-ui.test.ts`
- Create: `src/app/instructor/students/[instanceId]/student-detail.module.css`
- Modify: `src/app/instructor/students/[instanceId]/StudentDetail.tsx`

**Interfaces:**
- Produces: `validateScoreAdjustment(delta: string, reason: string): { delta: number } | { error: string }`; `validateReset(mode, stageSlug): string | null`; section id type `"overview" | "stages" | "submissions" | "notes" | "timeline"`.
- Consumes: unchanged `StudentDetailView` and existing instructor API routes.

- [ ] **Step 1: Write failing helper tests**

```ts
import { describe, expect, it } from "vitest";
import { validateReset, validateScoreAdjustment } from "./student-detail-ui";

describe("student detail action validation", () => {
  it("rejects a non-integer score delta", () => {
    expect(validateScoreAdjustment("1.5", "manual review")).toEqual({ error: "Delta must be an integer." });
  });
  it("rejects a blank score reason", () => {
    expect(validateScoreAdjustment("2", " ")).toEqual({ error: "Reason is required." });
  });
  it("accepts an integer delta with a reason", () => {
    expect(validateScoreAdjustment("-2", "duplicate submission")).toEqual({ delta: -2 });
  });
  it("requires a stage for stage reset", () => {
    expect(validateReset("stage", "")).toBe("Select a stage first.");
    expect(validateReset("progress", "")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- "src/app/instructor/students/[instanceId]/student-detail-ui.test.ts"`
Expected: FAIL because `student-detail-ui` does not exist.

- [ ] **Step 3: Implement action validators**

```ts
export function validateScoreAdjustment(delta: string, reason: string) {
  const value = Number(delta);
  if (!Number.isInteger(value)) return { error: "Delta must be an integer." } as const;
  if (!reason.trim()) return { error: "Reason is required." } as const;
  return { delta: value } as const;
}

export function validateReset(mode: "environment" | "stage" | "progress", stageSlug: string) {
  return mode === "stage" && !stageSlug ? "Select a stage first." : null;
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- "src/app/instructor/students/[instanceId]/student-detail-ui.test.ts"`
Expected: 4 tests pass.

- [ ] **Step 5: Implement the case-file layout**

Keep `StudentDetail` as fetch/refresh owner. Add an accessible section-navigation state, summary header, overview/environment/category region, stage list, submission list with local score controls, notes/findings/evidence region, timeline, and isolated reset danger area. Provide explicit empty states for every collection.

- [ ] **Step 6: Wire validation helpers into mutations**

Validate before API calls, retain `window.confirm` for every reset mode, preserve endpoint paths/bodies, reload after success, and add dismissible Motion success notices.

- [ ] **Step 7: Verify instructor detail code**

Run: `npm test -- "src/app/instructor/students/[instanceId]/student-detail-ui.test.ts" && npm run typecheck`
Expected: helper tests and typecheck pass.

- [ ] **Step 8: Commit instructor case-file work**

```bash
git add "src/app/instructor/students/[instanceId]"
git commit -m "feat: redesign instructor student case file"
```

### Task 5: Browser Interaction and Responsive Design QA

**Files:**
- Modify: `design-qa.md`
- Create: `docs/design-qa/remaining-pages-landing-desktop.png`
- Create: `docs/design-qa/remaining-pages-auth-desktop.png`
- Create: `docs/design-qa/remaining-pages-student-detail-desktop.png`
- Create: `docs/design-qa/remaining-pages-mobile.png`
- Temporary only: preview routes and Playwright spec; remove before commit.

**Interfaces:**
- Consumes: selected ImageGen source and Tasks 2–4.
- Produces: browser evidence and `design-qa.md` ending exactly `final result: passed`.

- [ ] **Step 1: Create deterministic temporary preview fixtures**

Use realistic local fixture props or request interception for protected/auth-dependent states. Do not expose preview routes in the final commit.

- [ ] **Step 2: Browser-test primary flows**

Verify landing signup/sign-in links; login labels/loading/error; signup validation; forgot success; reset waiting state; instructor section navigation; score-adjust expansion/validation; reset stage selection/confirmation boundary; and browser console errors.

- [ ] **Step 3: Capture equal-density desktop and mobile evidence**

Capture at 1440 × 1024 and 390 × 844 with device scale factor 1. Wait for entrance animations to settle before capture.

- [ ] **Step 4: Compare source and implementation together**

Record fonts, spacing, colors, assets/icons, copy, interaction states, responsiveness, and every P0/P1/P2 finding in `design-qa.md`. Fix each blocking issue and recapture until no actionable P0/P1/P2 remains.

- [ ] **Step 5: Remove temporary QA code and verify report**

Run: `rg -n "final result: passed" design-qa.md`
Expected: one matching final result; `git status --short` contains no temporary preview/spec files.

- [ ] **Step 6: Commit QA evidence**

```bash
git add design-qa.md docs/design-qa
git commit -m "test: verify remaining page redesigns"
```

### Task 6: Final Regression, Authorship, and Push

**Files:**
- Verify only: entire repository

**Interfaces:**
- Consumes: all earlier task commits.
- Produces: a clean, tested `main` pushed to origin without a co-author trailer.

- [ ] **Step 1: Run complete automated verification**

Run: `npm test`
Expected: every Vitest file passes with zero test failures.

- [ ] **Step 2: Run type and production verification**

Run: `npm run typecheck`
Expected: exit 0.

Run: `npm run build`
Expected: Next.js production build exits 0 and lists all scoped routes.

- [ ] **Step 3: Check repository hygiene**

Run: `git diff --check && git status --short`
Expected: no whitespace errors and only intended tracked changes, if any.

- [ ] **Step 4: Verify commit authorship and messages**

Run: `git log -5 --format="%h %an <%ae>%n%B"`
Expected: new commits use `fejbron <fejbroni@umat.edu.gh>` and contain no co-author trailers.

- [ ] **Step 5: Push main**

Run: `git push`
Expected: origin `main` advances to the final verified commit.

- [ ] **Step 6: Confirm production deployment**

Run: `vercel inspect https://testme.bronsoft.com`
Expected: production alias is Ready and points to the deployment built from the final commit.
