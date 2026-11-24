Badge shows the state of an email, draft or lead as a colored dot plus a word.

- Markup: `<span class="fl-badge fl-badge--positive">Verified</span>`. Variants: `--positive`, `--info`, `--caution`, `--negative`; no variant = neutral.
- You provide: one or two words. The word carries the meaning; the color only speeds scanning.
- Fixed mapping: Verified and Approved → `positive`; Pattern and Sent → `info`; Awaiting approval and Risky → `caution`; Bounced, Rejected and Failed → `negative`; Draft → neutral.
- Email status without a Hunter key is always Pattern, never Verified.
- Don't: use a badge as a button, or put a flare-colored badge anywhere.
