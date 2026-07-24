# @nayanroy/gitto

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
