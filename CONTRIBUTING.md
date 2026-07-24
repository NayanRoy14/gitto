# Contributing to gitto

Thanks for considering a contribution — gitto is a small project and every
bit of help (bug reports, docs fixes, new commands) is genuinely useful.
Everyone participating is expected to follow the
[Code of Conduct](CODE_OF_CONDUCT.md).

Not sure where to start? Check the [open issues](https://github.com/NayanRoy14/gitto/issues)
— anything not already assigned is fair game. Small, focused PRs (one
command, one bug, one doc fix) are much easier to review than large ones; if
you're planning something bigger, open an issue first to talk it through.

## Setup

```
npm install
npm run build
npm link   # or: node dist/cli.js <command>
npm run dev -- status   # runs src/cli.tsx directly via tsx, no build step
```

## Before opening a PR

```
npm run lint
npm run format:check   # or `npm run format` to fix
npm run build
npm test
```

CI runs all four (lint and format on Node 20; build+test across Node 20/22/24
on Linux, plus Node 22 on Windows and macOS), so it's faster to catch failures
locally first.

## Adding or changing a command

Every command exists in **two parallel forms** — an interactive Ink UI and a
plain-text fallback — and both need to stay in sync:

1. **`src/commands/<Name>.tsx`** — the Ink component, used when stdin is a TTY.
2. **`src/lib/repl.ts`** — a `repl<Name>` function that asks the same questions
   via `rl.question()` and calls the same `lib/git.ts`/`lib/github.ts`
   functions, for piped/scripted input or terminals without arrow-key support.
3. **`src/cli.tsx`** — register the commander command, wiring it to
   `inkOrRepl("name", repl.name)` (see existing entries for the pattern).
4. **`src/lib/menu.ts`** — add the command to `buildMenu()` if it should appear
   in the `/` palette, gated on whatever `RepoState` makes it applicable (e.g.
   `switch` only shows up when `state.otherBranches.length > 0`).
5. **`README.md`** — add it to the command list at the top.

Keep the actual git/GitHub logic in `src/lib/git.ts` or `src/lib/github.ts` —
both UI paths should call the same function so behavior can't drift between
them. See the Architecture section in `README.md` for what lives where.

## Plain language, no raw errors

gitto's whole premise is that no raw git output or raw API error ever reaches
the user. If you add a new failure path, translate it: extend
`translateError()` in `git.ts` (matched against git's stderr) or
`translateGitHubError()` in `github.ts` (matched against Octokit's error
`status`), rather than letting the underlying error surface as-is.

## Tests

Test files are colocated with the code they cover (`foo.ts` → `foo.test.ts`
or `foo.tsx` → `foo.test.tsx`), run via `npm test` (Vitest). Every file in
`src/` has coverage; which style to follow depends on what's under test:

- **Pure logic** (e.g. `src/lib/git.sensitive-paths.test.ts`) — plain unit
  tests, no mocking needed.
- **Git operations** (e.g. `src/lib/git.integration.test.ts`) — run against a
  real temporary git repo created with `simple-git` directly, not mocked. This
  exercises actual git behavior (real conflicts, real merges) instead of
  guessing at simple-git's output shape. `./config.js` is mocked to return no
  token so tests never touch your real `~/.gitto/config.json`. New
  git-affecting logic should follow this pattern rather than mocking
  `simple-git` — it's less brittle and catches real git behavior changes.
- **Config storage** (`src/lib/config.test.ts`) — mocks `node:os`'s
  `homedir()` to a temp directory so tests never read or write your real
  config file.
- **`repl.ts`** (`src/lib/repl.test.ts`) — every `repl.*` function already
  takes a `LineReader` as a parameter, so tests drive them with a small
  `FakeLineReader` (a queued list of canned answers) instead of real stdin.
  `console.log` is spied on to assert what got printed.
- **Ink components** (`src/commands/*.test.tsx`) — rendered with
  `ink-testing-library`. Two timing gotchas that will otherwise produce
  flaky or silently-dropped-input tests, both addressed by the helpers in
  `src/testSupport/ink.ts` (excluded from the build):
  - `settle()` — Ink attaches its raw-mode stdin listener from a `useEffect`,
    which fires a tick after the initial render commit, not during it. Call
    this once after `render()` (and again after any step transition that
    mounts a fresh interactive component) before the first simulated
    keypress, or that keypress is written before anything is listening.
  - `pressKey()` / `typeText()` — `stdin.write()` calls fired back-to-back in
    the same tick get dropped or scrambled by React's batching (each
    keystroke's handler reads a stale value). These add the same settling
    tick _after_ every write.
  - Orchestrator components (`App.tsx`, `Palette.tsx`) are tested by mocking
    every imported sub-command as a trivial stub, so only the routing/
    state-machine logic itself is under test — not each command's internals,
    which already have their own dedicated test file.

## Releasing (maintainer notes)

This repo uses [changesets](https://github.com/changesets/changesets) for
versioning. For any user-facing change, run `npx changeset` and commit the
generated `.changeset/*.md` file alongside your PR — it prompts for a bump
type (patch/minor/major) and a summary that becomes the changelog entry.
Internal-only changes (tests, CI, tooling) don't need one.

Merged changesets accumulate until the "Version Packages" PR (opened
automatically by `.github/workflows/release.yml`) is merged, which publishes
the new version to npm.

That workflow authenticates as a real account via the `RELEASE_PAT` secret
(fine-grained, scoped to just this repo, Contents + Pull requests: read/write)
rather than the default `GITHUB_TOKEN` — PRs authored by `github-actions[bot]`
now need manual approval to run their own CI, even on non-fork branches, which
would defeat the point of automating releases.
