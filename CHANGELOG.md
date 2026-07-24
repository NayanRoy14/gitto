# @nayanroy/gitto

## 0.2.3

### Patch Changes

- 7560786: Fix three network/storage edge cases:

  - `~/.gitto/config.json` is now written atomically (write-to-temp-then-rename), so a crash or Ctrl+C mid-write can no longer leave it truncated and silently log you out.
  - Git operations that touch GitHub (`upload`, `sync`, `download`) now time out with "GitHub took too long to respond" after 30 seconds of a genuinely stalled connection, instead of hanging forever — a slow-but-working transfer isn't affected, since `--progress` output keeps resetting the timer.
  - GitHub rate-limit responses (403 with no remaining quota, or 429) now say so plainly instead of the misleading "GitHub didn't accept your credentials" — re-logging in wouldn't have helped with a rate limit anyway.

## 0.2.2

### Patch Changes

- 7d19df9: Fix `gitto tag`'s message prompt starting pre-filled with whatever was just typed for the tag name. Both prompts rendered at the same position with no distinguishing key, so React reused the text input's internal state across them instead of resetting it.

## 0.2.1

### Patch Changes

- b4eb35d: Fix `gitto --version` reporting a stale hardcoded version instead of the installed package's actual version.

## 0.2.0

### Minor Changes

- 531740d: Require Node 20 or newer (Node 18 is end-of-life and no longer supported by gitto's toolchain)

### Patch Changes

- ae43e46: Fix `save` hanging (or failing) when finishing a rebase or cherry-pick: git tried to open an interactive editor for the commit message, which gitto can't show. The prepared message is now used as-is.
