# gitto

[![CI](https://github.com/NayanRoy14/gitto/actions/workflows/ci.yml/badge.svg)](https://github.com/NayanRoy14/gitto/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@nayanroy/gitto)](https://www.npmjs.com/package/@nayanroy/gitto)
[![license](https://img.shields.io/npm/l/@nayanroy/gitto)](LICENSE)

Plain-language Git & GitHub — no jargon required.

`gitto` replaces `git add`/`commit`/`push`/`pull`/`branch`/`merge`/`rebase`
with words like `save`, `upload`, `sync`, `branch`, `combine`, and `replay` —
and every git or GitHub error is translated into a sentence you can act on,
never raw command output.

![gitto's `/` command palette: a context-aware menu, saving a change, and the result](demo.svg)

## Example

The image above is the interactive `/` palette. gitto also has a plain-text
mode — used automatically in any terminal without arrow-key support (some CI
runners, very old terminals) or when input is piped/scripted — that asks the
exact same questions as typed commands instead. A first run in a brand-new
project looks like this:

```
$ gitto
gitto
Your terminal doesn't support arrow-key navigation, so gitto is using typed commands instead.
Type a command and press Enter. Type "help" to see everything, "exit" to quit.

Welcome to gitto. Plain-language Git and GitHub — no jargon required.

You're not connected to GitHub yet. Log in now? [Y/n] y
Go to https://github.com/login/device and enter this code: ABCD-1234
Waiting for you to approve in the browser...
✓ Logged in as yourname.

This folder isn't a git project yet. Set one up? [Y/n] y
✓ Set up.

gitto> save
Save everything, or just some files/folders? (leave blank for everything)
What did you change? initial commit
✓ Saved 3 files.

gitto> exit
```

Every command also works directly as an argument (`gitto save`, `gitto
upload`, ...) without opening either the palette or the `gitto>` prompt.

## Commands

`login`, `logout`, `upload`, `download <url> [destination]`, `status`, `sync`,
`save`, `branch` (alias `new-line`), `switch`, `combine`, `history`, `undo`,
`trash`, `stash`, `request`, `issue`, `fork`, `collab`, `rebase`, `pick`, `tag`.

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
  raw API errors ever reach the user. This includes network trouble: a stalled
  connection times out with a clear message instead of hanging forever, and
  GitHub rate limits are reported as what they are, not mistaken for a login
  problem.
- `save` asks which files or folders to save before asking what changed — leave
  it blank to save everything, or list specific paths to save just those.
- `upload` creates the GitHub repo for you (asking public or private) the first
  time you upload a project that isn't connected to one yet.
- Works the same piped or scripted (no arrow-key terminal? no problem) — every
  command has a plain-text fallback that asks the same questions with typed
  answers instead of an interactive menu.

## Install

Requires **Node.js 20 or newer** — check with `node --version`. Install it
from [nodejs.org](https://nodejs.org) or a version manager such as
[nvm](https://github.com/nvm-sh/nvm) (macOS/Linux) or
[Volta](https://volta.sh) (all platforms, including Windows).

```
npm install -g @nayanroy/gitto
```

- **Windows** — works out of the box in PowerShell, Command Prompt, or Windows
  Terminal with the official Node.js installer or a version manager.
- **macOS/Linux** — if Node came from your system package manager rather than
  a version manager, a global install sometimes needs
  `sudo npm install -g @nayanroy/gitto`. Switching to nvm/Volta avoids needing
  `sudo` for npm at all.
- Any terminal without arrow-key support (some CI runners, very old
  terminals) automatically gets the plain-text fallback instead of the
  interactive menu — no configuration needed.

This gives you the `gitto` command. `login` ships with gitto's own GitHub
OAuth App (Device Flow enabled) — no setup required. To use your own OAuth App
instead, set `GITTO_GITHUB_CLIENT_ID`.

## Development

Working on gitto itself, from a clone of this repo:

```
npm install
npm run build
npm link   # or: node dist/cli.js <command>
npm run dev -- status   # runs src/cli.tsx directly via tsx, no build step
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for testing, linting, and PR guidelines,
and the [Code of Conduct](CODE_OF_CONDUCT.md) for how we expect people to treat
each other here.

## Architecture

- `src/lib/config.ts` — token storage at `~/.gitto/config.json` (mode 0600,
  written atomically so a crash mid-write can't corrupt it)
- `src/lib/auth.ts` — device-flow login (scopes: `repo`, `read:user`,
  `workflow` — the last is required to push changes under `.github/workflows/`),
  Octokit client with its own logging silenced (gitto translates every error itself)
- `src/lib/git.ts` — simple-git wrapper; injects the stored GitHub token as a
  Basic-auth `Authorization` header for `push`/`clone` (via simple-git's
  per-command `config` option, never written into repo config — GitHub rejects
  a `bearer` scheme for these tokens over git's HTTP transport); detects
  in-progress merge/rebase/cherry-pick state; times out a stalled network
  operation instead of hanging forever; translates git errors to plain language
- `src/lib/github.ts` — Octokit-backed GitHub actions (repo creation, PR/issue/
  fork/collaborator), deriving owner/repo from the `origin` remote; distinguishes
  GitHub rate limiting from a rejected-credentials error
- `src/lib/repl.ts` — plain-text fallback for every command, used whenever
  stdin isn't a TTY (piped/scripted input, or a terminal without arrow-key
  support): mirrors the Ink flows one-for-one with `rl.question()`-driven
  prompts instead of interactive components
- `src/lib/lineReader.ts` — readline replacement used by `repl.ts`; Node's
  built-in readline drops lines on piped stdin when a second `question()` is
  issued after the first resolves, so this queues arrived-but-unasked-for
  lines itself
- `src/lib/menu.ts` — builds the `/` palette's command list from live repo
  state (`buildMenu()`), shared by both `Palette.tsx` and `repl.ts`'s `help`
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
- `scripts/record-demo.cjs` — regenerates `demo.svg` above; see the comment
  at the top of the file for how to run it

Every file above has test coverage — see [CONTRIBUTING.md](CONTRIBUTING.md#tests)
for how the Ink UI, the plain-text fallback, and the underlying git/GitHub
logic are each tested. Tested on Linux, Windows, and macOS in CI.

###### with ❤️ from Nayan
