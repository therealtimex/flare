LeadCard shows one person at one account: who they are, why they fit, the evidence, and the human approval step.

- Markup: `article.fl-card` holding `.fl-card__head` (name `.fl-card__name`, role and company `.fl-card__meta`, status Badge), `.fl-card__why` (one or two cited sentences), and `.fl-card__foot` (a ScoreTier with its fit and intent split, and `.fl-card__actions`).
- You provide: name, role, company, status, the reason with Citations, and the composite score, tier, fit and intent.
- Use LeadCard in the detail panel and on narrow screens. In the main view, the same lead is a DataGrid row.
- Set `aria-selected="true"` on the card open in the detail panel; it takes `flare-wash`.
- The footer holds at most two actions: ghost "Reject" and primary "Approve and send" (or "Edit draft" before a draft exists).
- Stack cards with `space-6` between them; keep the reason to two lines.
- Don't: show a tier without its score, or a reason without a citation.
