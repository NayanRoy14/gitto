---
"@nayanroy/gitto": patch
---

Fix `gitto tag`'s message prompt starting pre-filled with whatever was just typed for the tag name. Both prompts rendered at the same position with no distinguishing key, so React reused the text input's internal state across them instead of resetting it.
