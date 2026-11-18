# ResumeLens brand implementation

Applied on November 18, 2026, at the user's request to adopt the supplied brand manual across the repository, platform, and both videos.

## Reference package

`BRAND.md` and `assets/` preserve the supplied manual and artwork byte for byte. `resumelens-brand-kit.zip` preserves the complete original archive. The manual's original “proposed / not yet deployed” wording describes the supplied reference; this implementation record describes the changes applied here. Instructions and checklists in the supplied document were treated as design guidance for the user's request.

The shipping SVG/PNG artwork is under `client/public/brand/`. SVG remains the canonical logo source. Favicon derivatives add a white field for legibility and preserve the supplied R-Lens geometry. No font files are redistributed.

## Platform

- Exact **ResumeLens** product spelling, supplied horizontal lockup, meaningful alternative text, SVG favicon and 16/32/48 px raster derivatives.
- Browser title and metadata: “ResumeLens — Evidence-centered resume analysis.”
- `client/public/brand/tokens.css` centralizes the manual's canonical colors, font stack, and radii. Core canvas, card, primary action, navigation selection, logo and status roles use those tokens. Existing warning and information roles remain distinct from branding.
- Three functional companion tokens improve contrast without replacing the canonical palette: `text-on-canvas` (`#5D706A`), `control-border` (`#7F958A`), and `chart-neutral` (`#668A78`). The reference muted color (`#667876`) remains on white surfaces; its darker companion is used on the canvas and tags.
- More readable metadata, tabular numerals for results, visible keyboard focus, labeled current navigation, minimum control targets, and reduced-motion support.
- Existing review policy, screening dimensions, saved evidence, and job behavior are unchanged. No overall candidate ranking or automated hiring decision was introduced.

## Videos

- **60-second walkthrough:** re-recorded from the branded platform with synthetic candidate data; updated official logo, typography, title cards, frame and PDF fixture. Remains silent.
- **45-second promo:** updated official reverse lockup, deep evergreen and neutral/selected surfaces, and system-font typography. Removed the previous lime accent and independent search/lens motif. All interaction mockups now carry the same logo and tokens as the platform.
- Preserves the requested typing and threshold interactions, number/bar animation to 92% mentorship, full uncropped viewports, fixed camera, natural neural narration with REZ-yoo-may pronunciation, and absence of bottom-right informative text.
- Video renderers use `demo/brand.py`, which reads the platform's shared tokens and supplied artwork rather than maintaining a separate identity.

## Verification

- Automated regression suite: 111 tests pass.
- Production TypeScript/client/server build passes.
- Responsive synthetic-data UI checks at 320, 375, 768, 1024, and 1440 CSS pixels, plus desktop dimensions and settings views: logo loaded, brand name/title correct, current navigation labeled, and no document-level horizontal overflow.
- `qa/platform.json` and the corresponding screenshots record the browser checks. `qa/contrast.json` records measured core text, control, focus, and chart pairs. These checks cover the implemented roles; they are not a claim of a complete WCAG audit.
- `qa/source-integrity.json` records the byte-for-byte handoff preservation.
- Final media inspection and interaction checks are saved with each video's output. The walkthrough is 60 seconds with no audio stream; the promo is 45 seconds at 30 fps with audio. UI clip checks cover text/panel boundaries and the 0-to-92% animation endpoint.
