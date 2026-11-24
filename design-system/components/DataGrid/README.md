DataGrid is Flare's operating surface: a dense, spreadsheet-style table of accounts and contacts. It sits under an editorial masthead to form the hybrid layout.

- Markup: `.fl-masthead` (eyebrow `.fl-masthead__eyebrow`, title `.fl-masthead__title`, one-sentence `.fl-masthead__lede`), then `div.fl-grid-wrap > table.fl-grid` with `thead` and `tbody`. Wrap grid and ActivityFeed in `.fl-ops` to put the feed beside the grid at 1200px and wider.
- You provide: the rows, the column set, the sort, and `aria-selected="true"` on the row open in the detail panel.
- Column order: Account (with stage in `.is-sub`), Contact, Email, Enrichment, Score, Fit, Intent, Status. Put numbers in `.is-num` cells (mono, right-aligned).
- Row height is `grid-row` (32px); add `fl-grid--compact` (28px) above 50 rows. The header stays sticky.
- The masthead title states the result in numbers ("24 accounts match your ICP"), not the page name.
- Don't: pad cells beyond `space-3`, wrap cell text, put cards inside cells, or use orange anywhere in the grid except a selected row's `flare-wash`.
