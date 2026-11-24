# Flare design system

Live reference with rendered previews: https://claude.ai/artifact/BAP5H784cdLRXfbrNi4Exv (private until shared by its owner).

| Path | What |
| --- | --- |
| `tokens.json` | Source of truth: colors (dark and light), type, spacing, radius, shadow, sizes |
| `tokens.css` | CSS custom properties generated from `tokens.json`. Dark on `:root`, light under `[data-theme="light"]` |
| `components/bundle.css` | The `fl-` component classes. Load after `tokens.css` |
| `components/<Name>/README.md` | Usage rules and the markup each component expects |
| `components/<Name>/preview.html` | Example markup. Renders with `tokens.css` and `bundle.css` loaded |
| `logos/` | Lockup, mark and app icon as SVG, light and reverse |

Not yet wired into the app. To use it, import `design-system/tokens.css` and `design-system/components/bundle.css` from `src/app/globals.css`.

---

Flare is a small AI GTM engine. A founder describes their product in plain language, and Flare infers the ICP, finds leads with cited evidence, drafts outreach for a human to approve, and tracks the pipeline. The interface is a working tool used by founders and RevOps leads. It is calm and dark by default, with one orange signal that marks what needs a decision. Each screen has two parts: an editorial header that says what Flare found, and a dense, spreadsheet-style grid below it where the work happens.

## Five principles

Every rule below comes from one of these five. When a screen feels wrong, check them in order.

1. **Hierarchy: one thing first.** Each screen has one primary action and one title. Use one `display-lg` title per page, `title` for cards, and `body` for everything else. Give each view one `fl-btn--primary` and make the other buttons secondary or ghost.
2. **Contrast: the orange is a signal.** `flare` marks only what needs attention now: the primary action, the current pipeline step, and the logo disc. Never use it for decoration, large backgrounds or headings. Everything else is `ink` and `ink-muted` on `surface-0`, `surface-1` and `surface-2`.
3. **Alignment: one edge, one grid.** All spacing uses the 4px steps, `space-1` to `space-16`. Left-align text and controls to a shared edge. Center only empty states. Numbers in columns use `data` with tabular numerals and align right.
4. **White space: group by distance.** Related items sit `space-2` to `space-3` apart, cards sit `space-6` apart, and sections sit `space-12` apart. Separate with space first and a `line` hairline second. Never box something that space already groups. The one exception is the data grid: there, density wins, and hairlines replace space.
5. **Consistency: tokens or nothing.** Use only the tokens and the `fl-` classes, never raw hex values or one-off sizes. A status always uses the same color and word: verified is `positive`, awaiting approval is `caution`.

## Logo

- **Lockup** (`flare-lockup.svg`, `flare-lockup-reverse.svg`): the wordmark "Flare" in Geist SemiBold with the signal disc at its top right. Use it in headers, docs and anywhere the name is not already shown. Minimum width is 72px.
- **Mark** (`flare-mark.svg`, `flare-mark-reverse.svg`): an F made from a narrowing funnel (stem, long bar, short bar), with the disc as the lead that comes out. Use it for favicons, avatars and tight spaces. Minimum size is 16px.
- **App icon** (`flare-app-icon.svg`): the reverse mark on a `surface-0` tile with a 7/32 corner radius.
- Use the reverse files on `surface-0` in dark and the standard files on light grounds.
- Leave clear space equal to the disc's diameter on all sides.
- The disc is always `flare`. Never recolor it, never set the logo on an orange ground, and never add effects or outlines.

## Color

- Dark is the default theme, matching `globals.css` (`color-scheme: dark`, neutral-950 ground). Light is a full second theme with the same token names.
- Pages sit on `surface-0`. Cards, panels and inputs use `surface-1` with a `line` border. Hover rows and badge grounds use `surface-2`.
- Text: `ink` for primary text, `ink-muted` for metadata and source domains, and `ink-faint` only for placeholders and steps not yet reached.
- Orange: `flare` fills with `on-flare` text. `flare-strong` is the hover state. `flare-text` is for orange text such as citation numbers and links. `flare-wash` tints the selected row.
- Status colors always appear with a word, never color alone:
  - `positive`: verified email, approved draft.
  - `info`: email guessed from a pattern, outreach sent.
  - `caution`: awaiting your approval, risky email.
  - `negative`: bounced email, rejected draft, error.
- `negative` is pink-red so it never reads as `flare`.
- Every text pair meets 4.5:1 in both themes. The one exception: `flare` against light `surface-0` is 2.99:1, so it is never used as text.

## Type

- **Display**: `display-xl`, `display-lg`, `display-md` in Newsreader. It continues the serif h1 in `page.tsx`. Use it for page and section titles only, never in controls.
- **Text**: `title`, `heading`, `body`, `body-sm` in Geist. Use it for all UI and running text.
- **Utility**: `label` and `data` in Geist Mono.
  - `label` is set uppercase with 0.1em tracking, like the "Flare" eyebrow in `page.tsx`.
  - `data` is for scores, credits and counts.
- Use sentence case everywhere except `label`.
- Load the fonts from Google Fonts. `components/bundle.css` already imports them.

## Hybrid layout

Every working screen pairs a clean editorial top with a dense operating surface below it.

- **Editorial part (top).** Use `.fl-masthead`: a `label` eyebrow in `flare-text` ("Step 3 · Leads"), a `display-lg` title that states the result in numbers ("24 accounts match your ICP"), and one `body` sentence in `ink-muted`, capped at `content-max`. Leave `space-8` below it. This is the only place a display face appears on a working screen.
- **Operating surface (below).** Use DataGrid, full width.
  - Cell text is `cell`, numbers are `data`, and headers are `label`.
  - Rows are `grid-row` (32px), or `grid-row-compact` (28px) above 50 rows.
  - Cells have hairline borders, the header stays sticky, and nothing wraps.
  - Use no cards, no extra padding beyond `space-3`, and no display type.
- **Agent thinking panel.** At 1200px and wider, `.fl-ops` puts ActivityFeed in a `feed-width` (360px) right column. On narrower screens it stacks below the grid.
- **Detail.** Selecting a row tints it `flare-wash` and opens that lead as a LeadCard in the detail panel.

## Scoring and enrichment

- **Score.** Every lead has a composite score from 0 to 100, built from **fit** (match to the inferred ICP) and **intent** (recent buying signals), each also 0 to 100. Always show the number with its tier, using ScoreTier.
- **Tiers.**
  - Tier A: 80–100, act now. A solid `ink` chip.
  - Tier B: 60–79, nurture. An outlined chip.
  - Tier C: 0–59, hold. A dashed chip.
  - Tier strength is shown by form, never by hue, so orange stays free for decisions.
- **Enrichment.** Every enriched field shows how it was checked and how confident Flare is, using EnrichmentCell:
  - Status: `verified`, `pattern`, `risky`, `bounced` or `pending`, each with its own shape and word.
  - Confidence: a 0–100% number with a bar. Below 50% it turns `caution`.
- **Agent thinking.** ActivityFeed logs three kinds of step: `reason`, `graph` (knowledge-graph traversals as node → edge → node) and `validate` (pass or fail). The panel is open while a run is live and collapses to its latest line when the run is done.

## Space, shape and depth

- Reading pages cap at `content-max` (768px) with `space-6` side padding and `space-16` top padding.
- Tool views use the full width with a `space-4` minimum gutter.
- Corners:
  - `radius-md`: buttons and inputs.
  - `radius-lg`: cards.
  - `radius-sm`: citation chips.
  - `radius-full`: status badges.
- Separate surfaces with a `line` border. `shadow-overlay` is only for menus, popovers and dialogs.
- Buttons and inputs are `control-md` (36px) tall. Small table actions are `control-sm` (28px).
- Focus: a 2px `focus` ring with a 2px offset on every interactive element.
- Motion: 120ms ease-out on color and border only. Turn it off under `prefers-reduced-motion`.

## Content

- **Write plainly and specifically.** The repo's own line sets the voice: "Intake → ICP → cited leads → human-approved outreach → pipeline."
- **Address the founder as "you".** Flare's own actions are stated as facts. Write "Found 24 accounts from 9 sources", not "I found…" and not "We've discovered…".
- **Show evidence.** Every claim about a lead carries at least one `fl-cite` chip. If Flare can't cite it, don't say it.
- **Name the human step.** Write "Approve and send", "Reject draft" and "Edit before sending". Never send without an explicit approval control.
- **Use real units.** Write "88 Tier A", "fit 91 · intent 84", "96%" and "1,240 credits". Never vague phrases like "high fit" or "strong intent".
- **Agent thinking entries are short facts.** Write "Hiring signal confirmed by 2 sources." Name sources by their domain. Never use first person, and never filler like "Thinking…".
- Spell out ICP and GTM once per page in onboarding. After that, the abbreviations are fine.
- No emoji, no exclamation marks.

## Iconography

- Use `lucide-react`, which is already a dependency. Size icons at 16px inline and 20px in empty states.
- Keep the default 2px stroke and color icons with `ink-muted`. Pair an icon with a word except in icon buttons, which need an `aria-label`.
- Use these icons consistently:
  - `Check`: approved.
  - `CircleDashed`: pattern email.
  - `Clock`: awaiting approval.
  - `X`: rejected.
  - `Link`: source.
- Never use emoji as icons.

## Components

The components are CSS classes in `components/bundle.css`, ready for Tailwind or plain JSX.

- `fl-btn`: Button.
- `fl-badge`: status Badge.
- `fl-cite`: Citation chip.
- `fl-card`: LeadCard.
- `fl-steps`: PipelineSteps.
- `fl-masthead` with `fl-grid`: DataGrid, the hybrid layout.
- `fl-enrich`: EnrichmentCell.
- `fl-score` with `fl-tier`: ScoreTier.
- `fl-feed`: ActivityFeed, the Agent thinking panel.

Each component's README lists the markup you provide.
