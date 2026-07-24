#!/usr/bin/env node
/**
 * Regenerates demo.svg — the `/` palette recording shown in README.md.
 *
 * Not part of gitto itself; run this by hand when the palette's look changes
 * enough to be worth re-recording. Needs two packages this project
 * deliberately doesn't carry as devDependencies (node-pty needs a native
 * build/prebuilt binary on every `npm install`, which isn't worth it for an
 * asset regenerated a few times a year):
 *
 *   npm install --no-save node-pty svg-term-cli
 *   node scripts/record-demo.js
 *
 * This builds its own scratch git repo under the OS temp dir (never touches
 * this checkout), drives the real built CLI (dist/cli.js — run `npm run
 * build` first) through node-pty for a genuine ANSI-color recording, and
 * pipes the result through svg-term-cli to produce demo.svg at the repo
 * root.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

let pty;
try {
  pty = require("node-pty");
} catch {
  console.error("Missing node-pty. Run: npm install --no-save node-pty svg-term-cli");
  process.exit(1);
}

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli.js");
if (!fs.existsSync(cliPath)) {
  console.error(`${cliPath} doesn't exist — run \`npm run build\` first.`);
  process.exit(1);
}

const demoRepo = fs.mkdtempSync(path.join(os.tmpdir(), "gitto-demo-"));
execFileSync("git", ["init", "-q"], { cwd: demoRepo });
execFileSync("git", ["config", "user.email", "demo@example.com"], { cwd: demoRepo });
execFileSync("git", ["config", "user.name", "Demo"], { cwd: demoRepo });
fs.writeFileSync(path.join(demoRepo, "README.md"), "# gitto demo\n");

const cols = 100;
const rows = 28;
// On Windows, node-pty needs the fully-resolved node executable — a bare
// "node" fails with ENOENT because CreateProcess doesn't do PATH search the
// way POSIX exec does.
const nodeExe = process.platform === "win32" ? process.execPath : "node";

// node-pty prints an "AttachConsole failed" trace from its own internal
// console-list helper on some Windows console configurations. It's benign —
// unrelated to the actual pty session — and safe to ignore if you see it.

const term = pty.spawn(nodeExe, [cliPath], {
  name: "xterm-256color",
  cols,
  rows,
  cwd: demoRepo,
  env: { ...process.env, TERM: "xterm-256color", FORCE_COLOR: "1" },
});

const events = [];
const start = Date.now();
term.onData((data) => events.push([(Date.now() - start) / 1000, "o", data]));

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function type(text) {
  for (const ch of text) {
    term.write(ch);
    await wait(40);
  }
}

async function run() {
  await wait(1500);
  term.write("\x1b[B"); // down to "save" in the context-aware menu
  await wait(800);
  term.write("\r");
  await wait(2000);
  term.write("\r"); // blank = save everything
  await wait(2000);
  await type("first commit");
  await wait(500);
  term.write("\r");
  await wait(3000);

  term.kill();

  const castPath = path.join(demoRepo, "demo.cast");
  fs.writeFileSync(
    castPath,
    JSON.stringify({
      version: 2,
      width: cols,
      height: rows,
      timestamp: Math.floor(start / 1000),
      env: { TERM: "xterm-256color", SHELL: "bash" },
    }) +
      "\n" +
      events.map((e) => JSON.stringify(e)).join("\n") +
      "\n",
  );

  const svgPath = path.join(repoRoot, "demo.svg");
  const quote = (s) => `"${s}"`;
  // shell:true (needed so Windows can resolve npx.cmd) plus an args array is
  // deprecated by Node — pass a single pre-quoted command string instead.
  execFileSync(
    [
      "npx",
      "svg-term",
      "--in",
      quote(castPath),
      "--out",
      quote(svgPath),
      "--window",
      "--width",
      cols,
      "--height",
      rows,
    ].join(" "),
    { stdio: "inherit", shell: true },
  );

  fs.rmSync(demoRepo, { recursive: true, force: true });
  console.log(`Wrote ${svgPath}`);
}

run();
