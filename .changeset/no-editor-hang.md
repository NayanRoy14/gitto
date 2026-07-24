---
"@nayanroy/gitto": patch
---

Fix `save` hanging (or failing) when finishing a rebase or cherry-pick: git tried to open an interactive editor for the commit message, which gitto can't show. The prepared message is now used as-is.
