ScoreTier pairs the composite fit-and-intent score (0–100) with a tier, so a founder can sort by number and triage by letter.

- Markup: `<span class="fl-score"><span class="fl-score__num">88</span><span class="fl-tier fl-tier--a">Tier A</span></span>`. Add `.fl-score__split` ("fit 91 · intent 84") where there is room: cards, detail panels, tooltips.
- Tiers: A = 80–100 (act now), B = 60–79 (nurture), C = 0–59 (hold). Tier strength is shown by form: A is a solid `ink` chip, B is outlined, C is dashed.
- You provide: the composite score, the tier, and the fit and intent parts. Scoring code owns the formula; this component only displays it.
- Fit = match to the inferred ICP. Intent = recent buying signals. Both 0–100, integers.
- In a grid, put the composite in the Score column and the two parts in their own `.is-num` columns.
- Don't: color tiers orange, red or green, show a tier without its number, or show decimals.
