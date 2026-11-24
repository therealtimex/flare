EnrichmentCell shows, inside a grid cell, whether an enriched field is verified and how confident Flare is in it.

- Markup: `<span class="fl-enrich"><span class="fl-verify" data-status="verified">Verified</span><span class="fl-conf" style="--v:96">96%</span></span>`.
- `data-status`: `verified` (filled disc), `pattern` (dashed ring), `risky` (half disc), `bounced` (struck ring), `pending` (spinning ring). Shape, color and word all change, so status never depends on color alone.
- You provide: the status, its word, and the confidence as an integer 0–100 in both `--v` and the text. Add `data-level="low"` below 50.
- Confidence is how sure Flare is of the value; status is how it was checked. Without a Hunter key, email status is `pattern` and confidence comes from the pattern match.
- While enriching, show `pending` with no confidence.
- Don't: show a confidence bar without its number, or round 49% up to look safe.
