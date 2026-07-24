# @nayanroy/gitto

## 0.2.1

### Patch Changes

- b4eb35d: Fix `gitto --version` reporting a stale hardcoded version instead of the installed package's actual version.

## 0.2.0

### Minor Changes

- 531740d: Require Node 20 or newer (Node 18 is end-of-life and no longer supported by gitto's toolchain)

### Patch Changes

- ae43e46: Fix `save` hanging (or failing) when finishing a rebase or cherry-pick: git tried to open an interactive editor for the commit message, which gitto can't show. The prepared message is now used as-is.
