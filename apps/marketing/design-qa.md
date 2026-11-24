# Marketing Page Visual QA

Date: 2026-11-24
Reference: https://vibeisland.app/
Implementation: http://localhost:4101/en and http://localhost:4101/zh
Captured at: desktop 1365x900; mobile 390x844.

## Comparison evidence

- Reference desktop full-page capture: `/tmp/copyfaat-qa/reference-desktop.png`.
- SignalFast desktop full-page capture: `/tmp/copyfaat-qa/local-desktop.png`.
- Desktop first-screen side-by-side: `/tmp/copyfaat-qa/comparison-desktop-final.png`.
- Reference mobile first screen: `/tmp/copyfaat-qa/reference-mobile-first-screen.png`.
- SignalFast mobile first screen: `/tmp/copyfaat-qa/local-mobile-first.png`.
- Mobile side-by-side: `/tmp/copyfaat-qa/comparison-mobile-final.png`.

## Fidelity review

- Typography: the reference Departure Mono WOFF2 is included locally and used for English pixel display type. Chinese uses the system sans stack because this pixel font does not cover Chinese glyphs.
- Layout: narrow fixed navigation, centered two-line hero, wide dark product preview, compact segment control, 3-column feature area, masonry-like reviews, centered accordion FAQ, single pricing card, multi-column footer. The order and spacing track the source closely on desktop and mobile.
- Colors and surfaces: near-black background, subdued gray copy, green accent, low-contrast dark surfaces, subtle dotted hero texture and faint lighting.
- Images: source dot texture and light overlay are local; all product imagery is the existing SignalFast chart UI and locally stored demo video/avatar assets. No broken images after scrolling into lazy-loaded content.
- Copy: source-specific Vibe Island text and reviews were not copied. Marketing copy is SignalFast-specific and available in English and Chinese. Prices come from the existing payments config.
- Interactions: keyboard-accessible overview/market/signal tabs, demo video modal with locale captions, expandable FAQ, yearly/weekly price selection, locale and section links, and checkout links are implemented.
- Responsive/accessibility: mobile viewport remains 390px wide without horizontal overflow; focus outlines, semantic heading/landmarks, ARIA tab state, native details disclosure, and reduced-motion handling are present.

## Findings and resolution

- Initial comparison found the Chinese first headline line wrapped less closely than the source's three-line English headline and a low-contrast top highlight was initially missing. Mobile padding/headline width were adjusted and a subtle source-matched lighting treatment was added. Final captures were regenerated at the same viewports.
- Product image, product terminology and purchase tiers intentionally differ from the reference to represent SignalFast accurately. The reference's source-specific Mac app visuals, client logos and user quotes were not reused.

## Verification

- Marketing production build: passed.
- Workspace `pnpm run type-check`: passed (18 packages).
- Playwright: 5/5 passed (tabs/keyboard, FAQ, billing/checkout link, video dialog/Escape, Chinese mobile overflow/nav).
- Oxlint on changed TSX/TS modules: 0 warnings, 0 errors. Configured project-root oxlint command could not parse the repository's pre-existing `.oxlintrc.json` `options.typeAware` setting; linting the changed files succeeded with the local rule runner where applicable.

final result: passed
