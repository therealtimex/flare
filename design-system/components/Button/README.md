Button runs one action and states it as a verb phrase ("Approve and send", "Find leads").

- Markup: `<button class="fl-btn fl-btn--primary" type="button">Label</button>`. Variants: `--primary`, `--secondary`, `--ghost`. Size: add `--sm` for table rows.
- You provide: the label, an optional 16px lucide icon before it, and `disabled` while a request runs.
- One `--primary` per view: the step the founder should take next. Everything else is `--secondary` or `--ghost`.
- Sending outreach always needs an explicit primary "Approve and send"; never auto-send.
- Icon-only buttons need `aria-label`.
- Don't: two primaries side by side, orange text buttons, or labels like "OK" and "Submit".
