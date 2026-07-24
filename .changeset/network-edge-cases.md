---
"@nayanroy/gitto": patch
---

Fix three network/storage edge cases:

- `~/.gitto/config.json` is now written atomically (write-to-temp-then-rename), so a crash or Ctrl+C mid-write can no longer leave it truncated and silently log you out.
- Git operations that touch GitHub (`upload`, `sync`, `download`) now time out with "GitHub took too long to respond" after 30 seconds of a genuinely stalled connection, instead of hanging forever — a slow-but-working transfer isn't affected, since `--progress` output keeps resetting the timer.
- GitHub rate-limit responses (403 with no remaining quota, or 429) now say so plainly instead of the misleading "GitHub didn't accept your credentials" — re-logging in wouldn't have helped with a rate limit anyway.
