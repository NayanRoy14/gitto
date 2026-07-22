# gitto

Plain-language Git & GitHub — no jargon required.

## Commands

`login`, `upload`, `download <url> [destination]`, `status`, `sync`, `save`,
`branch` (alias `new-line`), `switch`, `combine`, `history`, `undo`, `trash`,
`stash`, `request`, `issue`, `fork`, `collab`, `rebase`, `pick`, `tag`.

Run `gitto` with no arguments to open the `/` command palette — a context-aware
menu that only shows actions that currently apply (e.g. `save` is hidden until
there's something to save, `combine`/`switch`/`trash` are hidden until there's
another line to work with).

- `login` runs GitHub's device flow: shows a code + URL, then waits for you to
  approve in the browser. No setup needed — see below.
- Commands that touch a repo detect first run (greeting, auto-login if no token,
  offer to `git init` if the folder isn't a repo yet).
- Conflicts (from `combine`, `rebase`, or `pick`) are resolved with the same two
  verbs as everything else: fix the conflicting files, then `save` to continue,
  or `undo` to cancel — no new commands to learn.
- All git/GitHub errors are translated to plain language — no raw git output or
  raw API errors ever reach the user.

## Setup

```
npm install
npm run build
npm link   # or: node dist/cli.js <command>
```

`login` ships with gitto's own GitHub OAuth App (Device Flow enabled) — no setup
required. To use your own OAuth App instead, set `GITTO_GITHUB_CLIENT_ID`.

## Development

```
npm run dev -- status   # runs src/cli.tsx directly via tsx
```

## Architecture

- `src/lib/config.ts` — token storage at `~/.gitto/config.json` (mode 0600)
- `src/lib/auth.ts` — device-flow login, Octokit client
- `src/lib/git.ts` — simple-git wrapper; injects the stored GitHub token as an
  `Authorization` header for `push`/`clone` (via simple-git's per-command `config`
  option, never written into repo config); detects in-progress merge/rebase/
  cherry-pick state; translates git errors to plain language
- `src/lib/github.ts` — Octokit-backed GitHub actions (PR/issue/fork/collaborator),
  deriving owner/repo from the `origin` remote
- `src/commands/*.tsx` — Ink UI per command; each takes an optional
  `onDone?: (ok: boolean) => void` — omitted when run standalone (exits on
  completion), supplied by the palette to pause for acknowledgment and loop
  back to the menu
- `src/commands/App.tsx` — first-run orchestration (greeting → login → repo
  check) for commands run directly from the CLI
- `src/commands/Palette.tsx` — the `/` menu, built from live repo state
  (`getRepoState()` in `lib/git.ts`)
- `src/ui/*.tsx` — reusable prompts (`Select`, `Prompt`, `Confirm`, `Result`,
  `Task`) shared across every command
with ❤️ from Nayan