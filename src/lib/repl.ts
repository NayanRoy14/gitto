import { createLineReader, type LineReader } from "./lineReader.js";
import { login, isLoggedIn } from "./auth.js";
import { configExists, clearConfig } from "./config.js";
import {
  isGitRepo,
  initRepo,
  getRepoState,
  getStatus,
  findTrackedSecrets,
  save,
  getSavePreflight,
  SensitiveFilesError,
  getInProgressOperation,
  sync,
  upload,
  getRemoteUrl,
  addRemote,
  download,
  listBranches,
  createBranch,
  switchBranch,
  mergeBranch,
  rebaseBranch,
  pickCommit,
  getBranchHistory,
  deleteBranch,
  UnmergedBranchError,
  hasStash,
  stashChanges,
  restoreStash,
  getHistory,
  undoLastSave,
  createTag,
  pushTag,
} from "./git.js";
import { createRequest, createIssue, forkRepo, addCollaborator, createRepo, suggestRepoName } from "./github.js";
import { buildMenu } from "./menu.js";

type RL = LineReader;

function say(message: string): void {
  console.log(message);
}

function ok(message: string): void {
  console.log(`✓ ${message}`);
}

function fail(err: unknown): void {
  console.log(`✗ ${err instanceof Error ? err.message : String(err)}`);
}

async function safely(fn: () => Promise<string>): Promise<void> {
  try {
    ok(await fn());
  } catch (err) {
    fail(err);
  }
}

async function confirmYes(rl: RL, message: string, defaultYes = true): Promise<boolean> {
  const suffix = defaultYes ? "[Y/n]" : "[y/N]";
  const answer = (await rl.question(`${message} ${suffix} `)).trim().toLowerCase();
  if (answer === "") return defaultYes;
  return answer === "y" || answer === "yes";
}

async function pickFromList(rl: RL, items: string[], prompt: string): Promise<string | null> {
  items.forEach((item, i) => say(`  ${i + 1}. ${item}`));
  const answer = (await rl.question(prompt)).trim();
  if (!answer) return null;
  const index = Number(answer);
  if (Number.isInteger(index) && index >= 1 && index <= items.length) {
    return items[index - 1];
  }
  return answer;
}

/** Mirrors App.tsx's "repo-prompt" step for commands run non-interactively (piped/scripted). */
export async function ensureRepoSetup(rl: RL): Promise<boolean> {
  if (await isGitRepo()) return true;
  if (!(await confirmYes(rl, "This folder isn't a git project yet. Set one up?"))) {
    say("Cancelled.");
    return false;
  }
  await initRepo();
  ok("Set up.");
  return true;
}

async function replLogin(): Promise<void> {
  try {
    const { login: username } = await login((info) => {
      say(`\nGo to ${info.verificationUri} and enter this code: ${info.userCode}`);
      say("Waiting for you to approve in the browser...");
    });
    ok(`Logged in as ${username}.`);
  } catch (err) {
    fail(err);
  }
}

async function replLogout(rl: RL): Promise<void> {
  if (!isLoggedIn()) {
    say("You're not logged in.");
    return;
  }
  if (await confirmYes(rl, "Disconnect your GitHub account?")) {
    clearConfig();
    ok("Logged out.");
  } else {
    say("Cancelled.");
  }
}

async function replStatus(): Promise<void> {
  try {
    const [status, secrets] = await Promise.all([getStatus(), findTrackedSecrets()]);
    const parts = [`On "${status.branch}".`];
    if (status.changedFiles > 0) {
      parts.push(`${status.changedFiles} file${status.changedFiles === 1 ? "" : "s"} changed and not yet saved.`);
    }
    if (!status.connectedToGitHub) {
      parts.push("This project isn't connected to GitHub yet.");
    } else if (status.readyToUpload > 0) {
      parts.push(`${status.readyToUpload} commit${status.readyToUpload === 1 ? "" : "s"} ready to upload.`);
    } else if (status.changedFiles === 0) {
      parts.push("Everything is up to date — nothing new to upload.");
    }
    ok(parts.join(" "));
    if (secrets.length > 0) {
      say(`⚠ These look like secrets and are already saved to this project's history: ${secrets.join(", ")}.`);
    }
  } catch (err) {
    fail(err);
  }
}

async function replSave(rl: RL): Promise<void> {
  const op = await getInProgressOperation();
  if (op === "rebase" || op === "cherry-pick") {
    await safely(() => save(""));
    return;
  }
  if (op === "merge") {
    const message = (await rl.question("What did you change? ")).trim() || "Merge";
    await safely(() => save(message));
    return;
  }

  const filesInput = (
    await rl.question("Save everything, or just some files/folders? (leave blank for everything) ")
  ).trim();
  const onlyPaths = filesInput ? filesInput.split(/\s+/) : [];

  let preflight;
  try {
    preflight = await getSavePreflight(undefined, onlyPaths);
  } catch (err) {
    fail(err);
    return;
  }

  if (preflight.hardBlocked.length > 0) {
    fail(new SensitiveFilesError(preflight.hardBlocked));
    return;
  }

  let exclude: string[] = [];
  if (preflight.flagged.length > 0) {
    say("\nThese usually shouldn't be saved:");
    preflight.flagged.forEach((f) => say(`  • ${f}`));
    if (await confirmYes(rl, "Exclude them and save everything else?")) {
      exclude = preflight.flagged;
    } else if (!(await confirmYes(rl, "Are you sure you want to save them anyway?", false))) {
      say("Save cancelled. Nothing was changed.");
      return;
    }
  }

  const message = (await rl.question("What did you change? ")).trim() || "Update";
  await safely(() => save(message, undefined, exclude, onlyPaths));
}

async function replSync(): Promise<void> {
  await safely(() => sync());
}

async function replUpload(rl: RL): Promise<void> {
  const remoteUrl = await getRemoteUrl();
  if (!remoteUrl) {
    const name = suggestRepoName();
    const makePrivate = await confirmYes(
      rl,
      `This project isn't on GitHub yet. Create "${name}" as a private repo?`
    );
    try {
      const { url } = await createRepo({ name, private: makePrivate });
      await addRemote(url);
    } catch (err) {
      fail(err);
      return;
    }
  }
  await safely(async () => (await upload()).message);
}

async function replDownload(rl: RL): Promise<void> {
  const url = (await rl.question("What's the GitHub URL to copy? ")).trim();
  if (!url) {
    say("URL can't be empty.");
    return;
  }
  await safely(async () => `Downloaded into ${(await download(url)).path}.`);
}

async function replDownloadArgs(url: string, destination?: string): Promise<void> {
  await safely(async () => `Downloaded into ${(await download(url, destination)).path}.`);
}

async function replBranch(rl: RL): Promise<void> {
  const name = (await rl.question("Name for the new line: ")).trim();
  if (!name) {
    say("Name can't be empty.");
    return;
  }
  await safely(() => createBranch(name));
}

async function replSwitch(rl: RL): Promise<void> {
  const info = await listBranches();
  if (info.others.length === 0) {
    say("There's only one line here — nothing to switch to.");
    return;
  }
  say("\nSwitch to which line?");
  const target = await pickFromList(rl, info.others, "Line: ");
  if (!target) {
    say("Cancelled.");
    return;
  }
  await safely(() => switchBranch(target));
}

async function replCombine(rl: RL): Promise<void> {
  const info = await listBranches();
  if (info.others.length === 0) {
    say("There's only one line here — nothing to combine.");
    return;
  }
  say("\nCombine which line into your current one?");
  const target = await pickFromList(rl, info.others, "Line: ");
  if (!target) {
    say("Cancelled.");
    return;
  }
  await safely(() => mergeBranch(target));
}

async function replRebase(rl: RL): Promise<void> {
  const info = await listBranches();
  if (info.others.length === 0) {
    say("There's only one line here — nothing to replay onto.");
    return;
  }
  say("\nReplay your changes on top of which line?");
  const target = await pickFromList(rl, info.others, "Line: ");
  if (!target) {
    say("Cancelled.");
    return;
  }
  await safely(() => rebaseBranch(target));
}

async function replPick(rl: RL): Promise<void> {
  const info = await listBranches();
  if (info.others.length === 0) {
    say("There's only one line here — nothing to pick from.");
    return;
  }
  say("\nPick a change from which line?");
  const source = await pickFromList(rl, info.others, "Line: ");
  if (!source) {
    say("Cancelled.");
    return;
  }
  const entries = await getBranchHistory(source);
  if (entries.length === 0) {
    say("That line has nothing saved to pick from.");
    return;
  }
  say("\nBring which change into your current line?");
  const labels = entries.map((e) => `${e.hash} ${e.message}`);
  const chosen = await pickFromList(rl, labels, "Change: ");
  if (!chosen) {
    say("Cancelled.");
    return;
  }
  const index = labels.indexOf(chosen);
  const hash = index >= 0 ? entries[index].hash : chosen.split(/\s+/)[0];
  await safely(() => pickCommit(hash));
}

async function replTrash(rl: RL): Promise<void> {
  const info = await listBranches();
  if (info.others.length === 0) {
    say("There's only one line here — nothing to trash.");
    return;
  }
  say("\nTrash which line?");
  const target = await pickFromList(rl, info.others, "Line: ");
  if (!target) {
    say("Cancelled.");
    return;
  }
  if (!(await confirmYes(rl, `Trash "${target}"? This can't be undone.`, false))) {
    say("Cancelled.");
    return;
  }
  try {
    ok(await deleteBranch(target));
  } catch (err) {
    if (err instanceof UnmergedBranchError) {
      if (await confirmYes(rl, `${err.message} Trash it anyway?`, false)) {
        await safely(() => deleteBranch(target, true));
      } else {
        say("Cancelled.");
      }
      return;
    }
    fail(err);
  }
}

async function replStash(): Promise<void> {
  try {
    const status = await getStatus();
    if (status.changedFiles > 0) {
      ok(await stashChanges());
      return;
    }
    if (await hasStash()) {
      ok(await restoreStash());
      return;
    }
    say("Nothing to stash away and nothing stashed to bring back.");
  } catch (err) {
    fail(err);
  }
}

async function replHistory(): Promise<void> {
  try {
    const entries = await getHistory();
    if (entries.length === 0) {
      say("Nothing saved yet.");
      return;
    }
    entries.forEach((e) => say(`${e.hash}  ${e.message}  — ${e.author}, ${new Date(e.date).toLocaleString()}`));
  } catch (err) {
    fail(err);
  }
}

async function replUndo(rl: RL): Promise<void> {
  if (!(await confirmYes(rl, "Undo your last save?"))) {
    say("Cancelled.");
    return;
  }
  await safely(() => undoLastSave());
}

async function replTag(rl: RL): Promise<void> {
  const name = (await rl.question("Name for this tag: ")).trim();
  if (!name) {
    say("Name can't be empty.");
    return;
  }
  const message = (await rl.question("Message for this tag: ")).trim() || name;

  try {
    ok(await createTag(name, message));
  } catch (err) {
    fail(err);
    return;
  }

  const state = await getRepoState();
  if (state.hasRemote && isLoggedIn()) {
    if (await confirmYes(rl, "Upload this tag to GitHub now?")) {
      await safely(() => pushTag(name));
    }
  }
}

async function replRequest(rl: RL): Promise<void> {
  const info = await listBranches();
  if (info.others.length === 0) {
    say("There's only one line here — nothing to request against.");
    return;
  }
  say(`\nRequest that "${info.current}" be combined into which line?`);
  const base = await pickFromList(rl, info.others, "Line: ");
  if (!base) {
    say("Cancelled.");
    return;
  }
  const title = (await rl.question("Title for the request: ")).trim();
  if (!title) {
    say("Title can't be empty.");
    return;
  }
  await safely(() => createRequest({ title, head: info.current, base }));
}

async function replIssue(rl: RL): Promise<void> {
  const title = (await rl.question("What's the issue? ")).trim();
  if (!title) {
    say("Title can't be empty.");
    return;
  }
  await safely(() => createIssue({ title }));
}

async function replFork(): Promise<void> {
  await safely(() => forkRepo());
}

async function replCollab(rl: RL): Promise<void> {
  const username = (await rl.question("Who should be invited? (GitHub username) ")).trim();
  if (!username) {
    say("Username can't be empty.");
    return;
  }
  await safely(() => addCollaborator(username));
}

async function printHelp(): Promise<void> {
  const state = await getRepoState();
  const items = buildMenu(state, isLoggedIn());
  say("\nAvailable commands:");
  items.forEach((item) => say(`  ${item.label.padEnd(10)} ${item.description}`));
}

export async function runRepl(): Promise<void> {
  say("\x1b[36m%s\x1b[0m".replace("%s", "gitto"));
  say(
    "Your terminal doesn't support arrow-key navigation, so gitto is using typed commands instead."
  );
  say('Type a command and press Enter. Type "help" to see everything, "exit" to quit.');

  const rl = createLineReader();

  if (!configExists()) {
    say("\nWelcome to gitto. Plain-language Git and GitHub — no jargon required.");
  }
  if (!isLoggedIn() && (await confirmYes(rl, "\nYou're not connected to GitHub yet. Log in now?"))) {
    await replLogin();
  }
  if (!(await isGitRepo()) && (await confirmYes(rl, "This folder isn't a git project yet. Set one up?"))) {
    await initRepo();
    ok("Set up.");
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const line = (await rl.question("\ngitto> ")).trim();

    if (rl.hasEnded()) {
      rl.close();
      return;
    }
    if (!line) continue;
    if (line === "exit" || line === "quit") {
      rl.close();
      return;
    }
    if (line === "help" || line === "/") {
      await printHelp();
      continue;
    }

    const [cmd] = line.split(/\s+/);

    try {
      switch (cmd) {
        case "login":
          await replLogin();
          break;
        case "status":
          await replStatus();
          break;
        case "upload":
          await replUpload(rl);
          break;
        case "download":
          await replDownload(rl);
          break;
        case "sync":
          await replSync();
          break;
        case "save":
          await replSave(rl);
          break;
        case "branch":
        case "new":
          await replBranch(rl);
          break;
        case "switch":
          await replSwitch(rl);
          break;
        case "combine":
          await replCombine(rl);
          break;
        case "rebase":
          await replRebase(rl);
          break;
        case "pick":
          await replPick(rl);
          break;
        case "trash":
          await replTrash(rl);
          break;
        case "stash":
          await replStash();
          break;
        case "history":
          await replHistory();
          break;
        case "undo":
          await replUndo(rl);
          break;
        case "tag":
          await replTag(rl);
          break;
        case "request":
          await replRequest(rl);
          break;
        case "issue":
          await replIssue(rl);
          break;
        case "fork":
          await replFork();
          break;
        case "collab":
          await replCollab(rl);
          break;
        default:
          say(`Unknown command "${cmd}". Type "help" to see what's available.`);
      }
    } catch (err) {
      fail(err);
    }
  }
}

export const repl = {
  ensureRepoSetup,
  login: replLogin,
  logout: replLogout,
  status: replStatus,
  sync: replSync,
  stash: replStash,
  history: replHistory,
  fork: replFork,
  downloadArgs: replDownloadArgs,
  save: replSave,
  upload: replUpload,
  branch: replBranch,
  switch: replSwitch,
  combine: replCombine,
  rebase: replRebase,
  pick: replPick,
  trash: replTrash,
  tag: replTag,
  collab: replCollab,
  issue: replIssue,
  request: replRequest,
  undo: replUndo,
};
