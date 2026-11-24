# ResumeLens — Brand Identity & Product UI Manual

**Version:** 1.0 (proposed identity)  
**Date:** 2026-11-19\
**Status:** Design specification for review; not yet deployed  
**Source of truth for current UI:** [`client/src/styles.css`](https://github.com/molartep/resume-lens/blob/main/client/src/styles.css), [`client/src/main.tsx`](https://github.com/molartep/resume-lens/blob/main/client/src/main.tsx), and [`README.md`](https://github.com/molartep/resume-lens/blob/main/README.md).

> This guide documents a proposed cohesive identity based on the **existing** application's colors, rather than replacing them with the navy/blue/teal colors of the initial concept illustration. Values under **Current** were inspected in the repository on 2026-11-18; values marked **Proposed** are new recommendations. Do not interpret this document as evidence that the logo assets or token system are already in production.

## 1. Brand foundations

**Name:** ResumeLens (one word, capital R and L).  
**Descriptor:** Configurable, evidence-centered resume analysis for human hiring teams.  
**Positioning:** ResumeLens helps recruiters and hiring managers review candidate resumes against explicit, configurable evaluation dimensions, surfacing evidence and model outputs to support more consistent, transparent human decisions.

**Promise:** Clear criteria. Visible evidence. Human judgment.

**Personality:** Precise, calm, trustworthy, practical, approachable, restrained. Visually closer to a reliable analytical workspace than a flashy AI assistant.

**Principles:**
1. **Criteria before conclusions.** Communicate that the reviewer defines what matters.
2. **Evidence before assertions.** Support claims with visible source material.
3. **Interpretability over AI theater.** Prefer understandable results to magical or anthropomorphic imagery.
4. **Human oversight.** The product assists people; it does not substitute for hiring decisions.
5. **Consistency.** Use repeatable patterns, shared tokens, and labeled states.

**Product truthfulness guardrails:** The current README explicitly states that the application has **no overall candidate score, candidate ranking, or automatic employment decision**. The interface explains that model probabilities are not verified facts and that missing evidence does not establish lack of ability. Avoid marketing copy such as “unbiased hiring,” “guaranteed objective,” “100% deterministic AI,” “perfect candidate matching,” or “automatically selects the best applicant.” If describing deterministic aspects, name the specific configured rule, workflow, or interpretation step; do not imply every upstream model output is deterministic.

## 2. Logo concept: R-Lens

### 2.1 Meaning

The mark merges three ideas into one compact symbol:
- **R** = ResumeLens, recognizable at app-icon scale.
- **Lens / circular counter** = examination and focus.
- **Three document lines** = structured evidence, not a generic sparkle or neural-network motif.

A restrained document cue sits *inside* the rounded counter of a custom R. The angled leg keeps the icon recognizable as a letter at larger sizes. The SVGs included alongside this document are **initial vector design assets**, not a finalized trademark-cleared logo.

### 2.2 Construction and geometry

- Canonical icon viewBox: **0 0 100 100**; preserve aspect ratio.
- R silhouette: constructed with rounded outline and diagonal leg; consistent visual weight.
- Interior document lines: exactly three; equal height or stroke rhythm; do not add tiny text, numerals, or extra decorative details.
- Brand mark: solid green `#1D645A` plus white negative-space detail; no gradient or shadow in the canonical version.
- Default horizontal lockup: icon left, **ResumeLens** wordmark right, aligned on optical center.
- Wordmark: Inter SemiBold (600) or a matching custom-outlined treatment when shipping a fixed vector export. Use normal title casing, never `RESUMELENS` as the primary wordmark.
- The supplied SVG lockup uses editable system-font text; for pixel-stable exported artwork, convert the wordmark to vector outlines using a licensed font installed locally.

### 2.3 Variants and hierarchy

| Variant | Intended use | Notes |
|---|---|---|
| Full-color horizontal (`logo-horizontal.svg`) | Header, README, presentations | Preferred whenever width allows |
| Brand-icon (`logo-icon.svg`) | Sidebar, app launcher, social avatar | Use a single glyph without accompanying text at small sizes |
| Reversed (`logo-reversed.svg`) | Dark brand background | White details and text, consistent contrast |
| Monochrome | Printing, embossing, restricted contexts | One ink only; keep negative space readable |
| Favicon | Browser tabs, small surfaces | Use simplified icon; inspect at 16×16 and 32×32 |

**Clear space:** keep a margin of at least **0.2× icon height** around the entire lockup, free of text, borders, and other symbols.  
**Minimum sizes (recommended):** horizontal logo **140 px** wide on digital surfaces; standalone mark **24 px** for routine UI, **32 px** preferred. Tiny favicon exports must be checked by hand.  
**Backgrounds:** white `#FFFFFF`, off-white `#F5F7F7`, or deep evergreen `#173A32`. Avoid photographic noise or low-contrast green-on-green.

**Never:** stretch, rotate, bevel, glow, add AI sparkles, introduce a third accent, recolor individual logo strokes to convey status, or use the logo as a progress indicator. Logo blue from the original concept is **not part of this identity**.

## 3. Color system

### 3.1 Existing palette (observed in `styles.css`)

| Color | Hex | Usage observed |
|---|---|---|
| Brand green | `#1D645A` | `.brand-mark` background |
| Action green | `#226C5C` | `.primary` button |
| Action hover | `#195645` | `.primary:hover` |
| Main ink | `#233D3B` | Global text color |
| App canvas | `#F5F7F7` | Global background |
| White | `#FFFFFF` | Sidebar and card surfaces |
| Selected nav | `#E9F3EF` | Active navigation background |
| Selected nav ink | `#216958` | Active navigation label |
| Card stroke | `#E0E7E4` | Card border |
| Default muted copy | `#667876` | Paragraph text |
| Progress information | `#50738E` | Progress panel text |
| Review warning | `#A03E34` | Manual review notice text |

The codebase currently contains several more sage/green shades for charts, controls, descriptions, tags, and result states. Those should be migrated into semantic tokens as components are touched, rather than globally substituted in a single unreviewed find-and-replace.

### 3.2 Canonical brand colors

| Token | Hex | Role | Status |
|---|---|---|---|
| `brand.primary` | `#1D645A` | Logo and brand recognition | Current |
| `brand.action` | `#226C5C` | Main CTA | Current |
| `brand.actionHover` | `#195645` | CTA hover | Current |
| `brand.ink` | `#233D3B` | Strong UI copy | Current |
| `surface.canvas` | `#F5F7F7` | App canvas | Current |
| `surface.default` | `#FFFFFF` | Cards, sidebar | Current |
| `surface.selected` | `#E9F3EF` | Navigation/selection | Current |
| `border.default` | `#E0E7E4` | Dividers, cards | Current |
| `text.muted` | `#667876` | Supporting copy | Current |
| `brand.deep` | `#173A32` | Reverse-logo field / dark emphasis | Proposed |
| `focus.ring` | `#1D645A` | Keyboard focus indicator | Proposed standardized token |

**Recommended distribution, not a literal quota:** ~75% light neutrals; ~20% deep ink/sage; ~5% saturated green. Keep the green recognizable without tinting every interface element.

### 3.3 Semantic state colors

Preserve the existing idea that warnings, progress, and success are distinct from brand. Suggested state roles:

- **Success:** dark green text + light green field; always add a success label or check symbol.
- **Information / progress:** existing muted blue `#50738E` with an accessible light blue surface; blue is an *information state*, not the primary brand.
- **Warning / manual review:** existing warm red `#A03E34` and pale red field; wording must explain why reviewer action is needed.
- **Error:** distinct error copy and corrective instructions, not red alone.
- **Neutral / unknown:** muted gray/sage text plus `Not established` or `Insufficient evidence`, never a red failure by default.

Never use status color as the sole way to express a result. Probability bars, dimension selections, warnings, and review flags must have labels and quantitative text.

## 4. Typography

**Primary family:** `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` — matches current CSS. Avoid introducing a second brand font without a demonstrated need. Do not distribute font files through this repository unless licensing expressly permits.

| Element | Suggested size / line-height | Weight |
|---|---|---|
| Brand wordmark | 20–28 px / 1.1 | 600–650 |
| Page title | 32–34 px / 1.2 | 600 |
| Section heading | 18–20 px / 1.35 | 600 |
| Card heading | 16–18 px / 1.4 | 600 |
| Main body | 14–16 px / 1.5 | 400 |
| Labels / controls | 13–14 px / 1.4 | 500–600 |
| Supplementary information | 12–13 px / 1.5 | 400–500 |
| Tiny metadata | 11–12 px minimum where practical | 400–600 |

Some current UI labels are 8–10 px; that is a **known improvement opportunity**, not a recommendation to perpetuate those sizes. Avoid uppercase tracking for body copy. Use tabular numerals for probabilities, percentages, timestamps, and scores. Ensure text does not become clipped when zoomed to 200% and at 320 CSS px wide.

## 5. UI design system

### 5.1 Layout & surfaces

Maintain the existing light, calm desktop shell: white sidebar, neutral canvas, discrete white cards, small borders, and green selection. Use an **8 px spacing rhythm** (4, 8, 12, 16, 24, 32, 48) for new work. Recommended corner radii: **6 px** controls, **8–10 px** cards, **12 px** icon container. Prefer border over strong shadow. Maximum text line length: ~65–75 characters for explanatory copy.

### 5.2 Navigation and actions

- Current app sections include candidate review, dimensions, and settings. Make current location obvious with background, readable label and `aria-current` where applicable.
- Primary button: solid `#226C5C`, white text, medium weight; only one visually dominant action per region.
- Secondary button: white with sage border and deep-green text.
- Tertiary button: text-only for low-emphasis actions.
- Dangerous action: separated spatially and explicitly named, never represented by the brand green.
- Hover, focus, disabled, busy, completed, and error states must all be visually distinct.
- Interactive controls should aim for at least **44×44 CSS px** touch target; accessible minimum can depend on platform/standard.

### 5.3 Forms, configuration, and density

- Explicit labels above inputs; do not use placeholder as sole label. Keep at least **8 px** between a label, any supporting help, and its input, text box, or dropdown.
- **Every dropdown must give the arrow breathing room on its right:** inset the arrow **16 px** from the right border, use a **16 px** arrow, and reserve **48 px** of right-side text padding so text cannot touch the arrow. Apply the same rule to settings, model selectors, history, saved resumes, and dimension controls. Use the shared custom `Dropdown` component in `client/src/Dropdown.tsx` for **every** selection control. Native HTML select controls and operating-system option menus are not part of the brand UI.
- Custom dropdown behavior: use a labeled combobox trigger and a custom listbox with 44 px minimum option targets, a checkmark for the selected option, a visible active option and disabled choices. Click or Enter/Space opens and selects; Up/Down navigates enabled options; Home/End jumps to the first/last option; typing searches labels. Escape and outside click dismiss without changing the selection; Tab closes and moves focus normally. Opening alone never saves or changes a value. Keep keyboard focus on the trigger and announce the active option. Render menus in a portal so card/fieldset boundaries cannot clip them; fit them to the viewport, flip upward when needed and scroll long lists. Preserve the same styling in settings, models, dimensions, saved résumés and history.
- Leave at least **16 px** between a control and the following explanatory text or action. Leave **24 px** between field groups and between a section title and its first field. Adjacent components must never touch: for example, the **Admin token** input and **Unlock model settings** button require a visible 16 px gap.
- Keep action rows separated from fields by **24 px**, with at least **12 px** between buttons. Wrap controls and actions on narrow screens instead of compressing these gaps. Use the shared spacing tokens in `client/public/brand/tokens.css`; compact layouts must preserve label and arrow clearance.
- Explain every evaluation dimension, rubric, threshold, and source of configuration in plain language.
- Validate inline, keep prior values on error, and support keyboard-only operation.
- For advanced JSON/configuration editing, offer examples, syntax validation, and escape hatches to restore an earlier valid configuration.
- Avoid tooltips as the only place where critical evaluation or model limitations are described.

### 5.4 Results, probability visualizations, and human review

- Treat a model output as a **signal**, not a verified fact or a hiring recommendation.
- Show full dimension name, source evidence, evaluation rubric, and historical configuration snapshot when relevant.
- Include numeric percentages alongside distribution bars; do not equate the highest probability with certainty.
- Present deterministic experience as a primary score value, e.g. **4.67 years**, using the same font, size, weight and tabular numerals as other results. Put calculation methodology and the as-of date behind an accessible information icon tooltip (hover, focus or tap; Escape dismisses). Keep incomplete-evidence warnings visible outside tooltips. Show employment intervals as individually spaced evidence rows and calculation issues as a separate list.
- When alerts exist, place a warm-red summary immediately above the dimension results with the exact alert count. Each warning states the reason for review without repeating threshold-source or application-interpretation boilerplate. Give the Application interpretation paragraph the full available card width and allow wrapping.
- Clearly distinguish `Model confidence`, `Probability`, `Expected level index`, and `Manual review needed`.
- Never automatically color a high score green and a low score red as if this proved suitability.
- Charts must not depend on hue alone: include explicit labels, values, and preferably selected-state emphasis such as border/weight.
- Represent insufficient evidence neutrally. Keep warnings specific, actionable, and human-readable.
- Preserve the existing disclaimer that parsed evidence and model responses require human interpretation.

### 5.5 Accessibility & responsiveness

Target **WCAG 2.2 AA** for the interface:
- Text contrast: **4.5:1** normal text, **3:1** large text; non-text interactive boundaries and meaningful graphical objects generally **3:1** against adjacent colors.
- Test actual *foreground/background pairs*; a color's presence in the palette does not certify every pairing.
- Visible keyboard focus with ≥2 px outline and enough offset/contrast.
- Semantic headings, native controls, status announcements (`role="status"` or appropriate live regions), meaningful error associations.
- Respect `prefers-reduced-motion` for loading or transition animation; avoid layout shifts.
- Test 320, 375, 768, 1024 and 1440 px widths, 200% zoom, and mobile navigation wrapping.
- SVG logo has a meaningful accessible name when used alone, and is `aria-hidden="true"` when adjacent to visible “ResumeLens” text.

**Implementation audit note:** the existing code has multiple muted 9–11 px labels and pale result colors. Review them for readability and contrast before treating them as compliant.

## 6. Brand voice, language and content

**Voice:** factual, considerate, quietly confident. Prefer direct nouns and verbs over exaggerated AI claims. Mention the reviewer's control and the underlying evidence.

| Instead of | Prefer |
|---|---|
| “AI finds the best candidates” | “Review resumes against the criteria you define” |
| “Unbiased and objective decisions” | “Consistent review criteria with visible supporting evidence” |
| “Candidate rejected” (from missing data) | “Insufficient evidence; human review needed” |
| “AI is certain” | “Model probability: 82%; verify supporting evidence” |
| “Fully automated hiring” | “AI-assisted resume analysis for hiring teams” |

**Preferred tagline:** **Your criteria. Clearer decisions.**  
**More cautious alternate:** **Clear criteria. Visible evidence.**  
**Short description:** “ResumeLens helps hiring teams analyze resumes against configurable evaluation criteria, with evidence and model outputs available for human review.”

Use `ResumeLens` in product UI, title tags, docs headers, and marketing. The repository slug may remain `resume-lens`. Write `resume`, `candidate`, `dimension`, `criterion/criteria`, and `manual review` consistently.

## 7. Application and communications usage

**Sidebar:** Replace the current typographic `R` block with the approved standalone icon in a 39–43 px container, while keeping the existing green identity. Keep visible `ResumeLens` text; the brand mark itself should not be interactive unless the entire lockup navigates home.

**Browser title & favicon:** `ResumeLens — Evidence-centered resume analysis`. Use icon-only favicon derived from the vector artwork; verify at 16/32 px. Provide an SVG favicon with a raster fallback where necessary.

**GitHub README:** horizontal SVG logo at top, linked appropriately; below it, a one-sentence description and screenshot. Avoid adding a giant decorative gradient header that overwhelms technical documentation.

**Screenshots & demos:** prefer real app screens with synthetic candidate data; never expose private resume details. Preserve accurate score/probability labels. Use neutral demo annotations.

**Social avatar:** icon only, centered on brand green or white. **Open Graph preview:** horizontal lockup, a crisp real UI excerpt, and short accurate descriptor.

**Presentation/documents:** white or canvas backgrounds; green reserved for logo and emphasis. Do not introduce unrelated blue and neon palettes. On dark backgrounds use the provided reverse treatment.

## 8. Design tokens — proposed migration

Do **not** immediately rewrite the current stylesheet. First centralize duplicate usages while preserving visual behavior:

```css
:root {
  --rl-brand: #1d645a;
  --rl-action: #226c5c;
  --rl-action-hover: #195645;
  --rl-ink: #233d3b;
  --rl-text-muted: #667876;
  --rl-canvas: #f5f7f7;
  --rl-surface: #ffffff;
  --rl-selected: #e9f3ef;
  --rl-border: #e0e7e4;
  --rl-deep: #173a32;
  --rl-focus: #1d645a;
  --rl-font: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --rl-radius-control: 6px;
  --rl-radius-card: 9px;
}
```

Then progressively migrate `.brand-mark`, `.primary`, `.sidebar`, `.card`, and navigation active state to tokens. The **logo files** are static assets and should not take semantic error/success coloring. Never use `opacity` alone to communicate a disabled control without ensuring labels remain legible.

## 9. Asset structure and handoff

Recommended repository layout:

```text
docs/brand/BRAND.md
client/public/brand/logo-icon.svg
client/public/brand/logo-horizontal.svg
client/public/brand/logo-reversed.svg
```

This handoff package includes the Markdown manual and those SVGs under `assets/`; copy to the above paths if approving the direction. Do not commit generated raster screenshots as the canonical source of the logo. Keep vector SVG as source; export PNGs at requested pixel sizes from SVG. For single-color applications, prepare a separate deliberately designed monochrome source rather than relying on screenshot filters.

**Suggested implementation order:** (1) review icon legibility and wordmark, (2) validate contrast pairs, (3) approve source vectors, (4) add token aliases, (5) update sidebar/favicon/README, (6) visually regress key app views and mobile sizes.

## 10. Review and acceptance checklist

- [ ] At a glance the monogram reads as **R**, not as a search-only icon or letter P.
- [ ] The standalone mark is recognizable at 24, 32 and 48 px; simplified favicon legible at 16 px.
- [ ] Horizontal mark looks balanced next to the exact spelling **ResumeLens**.
- [ ] Assets are vector, have transparent backgrounds where needed, and work on both white and deep evergreen.
- [ ] Real app brand colors remain consistent with `styles.css`; no arbitrary blue rebrand.
- [ ] Screen reader announces brand only once; decorational SVG is hidden where appropriate.
- [ ] Core text and focus/interactive pairs pass WCAG contrast checks.
- [ ] No UI relies only on green/red coloring to express evaluation outcomes.
- [ ] Claims in documentation reflect present functionality and explicitly preserve human oversight.
- [ ] Test screenshot, icon, and wordmark appearance on major browsers and at mobile sizes.
- [ ] Confirm trademark/name conflicts and font licenses before public commercial branding.

---

**Maintainer note:** This manual is a design reference for an evolving product. If the app's functionality or theme changes, update this document in the same pull request and distinguish **observed existing values** from **new proposed standards**.
