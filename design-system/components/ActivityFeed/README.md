ActivityFeed is the collapsible "Agent thinking" panel. It streams Flare's reasoning steps, knowledge-graph traversals and validation checks while a run is live.

- Markup: `details.fl-feed` > `summary` (`.fl-live` state, the title "Agent thinking", `.fl-feed__latest` with the newest step) + `ol.fl-feed__log` of `li.fl-log`. Each entry has a `time`, a `.fl-log__kind` and a `p`.
- Kinds: `data-kind="reason"` (a decision), `"graph"` (a traversal; use `p.fl-log__path` with `<span>→</span>` between nodes and edges), `"validate"` with `data-result="pass"` or `"fail"`.
- You provide: entries in time order with 24-hour `HH:MM:SS` stamps, and `open` or closed. Keep it open while a run is live; collapse it when the run ends, leaving the summary line.
- `.fl-live` pulses the flare dot while running. Set `data-state="idle"` and the word "Idle" when the run is done.
- Write entries as short facts in present or past tense: "Hiring signal confirmed by 2 sources." Name sources by domain. No first person, no filler like "Thinking…".
- Placement: right column of `.fl-ops` at 1200px and wider (`feed-width`); below the grid on narrower screens. Scroll the log at 320px; pin to the newest entry unless the person has scrolled up.
- Don't: use the feed for errors the person must act on. Those go in the grid row or a banner.
