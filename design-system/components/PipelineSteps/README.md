PipelineSteps shows where a product is in Flare's five-stage flow: Intake, ICP, Leads, Outreach, Pipeline.

- Markup: `ol.fl-steps` of `li.fl-step`, each with `data-state="done"`, `"current"` or nothing (not reached). Add `aria-current="step"` to the current one.
- You provide: the five stage names in this order and which one is current. Numbers and checkmarks are drawn by CSS.
- Exactly one step is current; it is the only orange on the bar.
- Place it under the page title, above the content, left-aligned with it.
- Don't: rename or reorder stages, or make steps clickable unless that stage's data exists.
