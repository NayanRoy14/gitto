import fs from "node:fs";
import path from "node:path";
import { simpleGit, type SimpleGit, ResetMode } from "simple-git";
import { getToken, getLogin } from "./config.js";

export class GittoGitError extends Error {}
export class ConflictError extends GittoGitError {
  constructor(action: string, public readonly files: string[]) {
    super(
      `${action} hit a conflict in ${files.length} file${files.length === 1 ? "" : "s"}: ${files.join(", ")}. Open ${files.length === 1 ? "it" : "them"}, fix the conflict markers, then run \`gitto save\` to continue (or \`gitto undo\` to cancel).`
    );
  }
}
export class SensitiveFilesError extends GittoGitError {
  constructor(public readonly files: string[]) {
    super(
      `Saving stopped — ${files.length === 1 ? "this looks like a secret" : "these look like secrets"}, so gitto won't save ${files.length === 1 ? "it" : "them"}: ${files.join(", ")}. If this is really meant to be shared, remove it from gitto's protection manually; otherwise keep it out of this project entirely.`
    );
  }
}

/** Files gitto never saves, no exceptions, no asking — real credentials. */
const HARD_BLOCK_PATTERNS: RegExp[] = [
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /(^|\/)credentials\.json$/i,
  /(^|\/)id_rsa(\.pub)?$/i,
  /(^|\/)secrets?\.(json|ya?ml)$/i,
];

/** Files gitto excludes by default, but will save anyway if the user explicitly says so. */
const SOFT_EXCLUDE_PATTERNS: RegExp[] = [
  /(^|\/)node_modules(\/|$)/i,
  /(^|\/)\.env(\..+)?$/i,
];

export function isHardBlocked(filePath: string): boolean {
  return HARD_BLOCK_PATTERNS.some((pattern) => pattern.test(filePath));
}

export function isSoftExcluded(filePath: string): boolean {
  if (/\.env\.example$/i.test(filePath)) return false;
  return SOFT_EXCLUDE_PATTERNS.some((pattern) => pattern.test(filePath));
}

export function isSensitivePath(filePath: string): boolean {
  return isHardBlocked(filePath) || isSoftExcluded(filePath);
}

function toGitignorePattern(excludedPath: string): string {
  if (/(^|\/)node_modules(\/|$)/i.test(excludedPath)) return "node_modules/";
  return excludedPath;
}

function appendToGitignore(cwd: string, patterns: string[]): void {
  const gitignorePath = path.join(cwd, ".gitignore");
  const existing = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, "utf8") : "";
  const existingLines = new Set(existing.split("\n").map((l) => l.trim()));
  const normalized = Array.from(new Set(patterns.map(toGitignorePattern)));
  const toAdd = normalized.filter((p) => !existingLines.has(p));
  if (toAdd.length === 0) return;

  const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  fs.writeFileSync(
    gitignorePath,
    existing + separator + "\n# Added by gitto after you chose to exclude these:\n" + toAdd.join("\n") + "\n",
    "utf8"
  );
}

function authConfig(): string[] {
  const token = getToken();
  if (!token) return [];
  // GitHub rejects the `bearer` scheme for device-flow user tokens over git's
  // smart HTTP transport ("remote: invalid credentials"); Basic auth with the
  // token as the password is what it actually accepts.
  const basic = Buffer.from(`${getLogin() ?? "x-access-token"}:${token}`).toString("base64");
  return [`http.extraheader=AUTHORIZATION: basic ${basic}`];
}

function git(cwd: string = process.cwd()): SimpleGit {
  return simpleGit(cwd, { config: authConfig() });
}

export type InProgressOperation = "merge" | "rebase" | "cherry-pick" | null;

export async function getInProgressOperation(
  cwd: string = process.cwd()
): Promise<InProgressOperation> {
  const repo = git(cwd);
  let gitDir: string;
  try {
    gitDir = (await repo.revparse(["--git-dir"])).trim();
  } catch {
    return null;
  }
  const resolved = path.isAbsolute(gitDir) ? gitDir : path.resolve(cwd, gitDir);

  if (fs.existsSync(path.join(resolved, "MERGE_HEAD"))) return "merge";
  if (
    fs.existsSync(path.join(resolved, "rebase-merge")) ||
    fs.existsSync(path.join(resolved, "rebase-apply"))
  ) {
    return "rebase";
  }
  if (fs.existsSync(path.join(resolved, "CHERRY_PICK_HEAD"))) return "cherry-pick";
  return null;
}

export async function isGitRepo(cwd: string = process.cwd()): Promise<boolean> {
  try {
    return await git(cwd).checkIsRepo();
  } catch {
    return false;
  }
}

export async function initRepo(cwd: string = process.cwd()): Promise<void> {
  await git(cwd).init();
}

function translateError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);

  if (/could not resolve host|network|ENOTFOUND|ETIMEDOUT/i.test(message)) {
    return "Couldn't reach GitHub. Check your internet connection and try again.";
  }
  if (/authentication failed|403|permission denied|could not read username/i.test(message)) {
    return "GitHub didn't accept your credentials. Try `gitto login` again.";
  }
  if (/does not appear to be a git repository|not a git repository/i.test(message)) {
    return "This folder isn't connected to a GitHub project.";
  }
  if (/non-fast-forward|fetch first|rejected/i.test(message)) {
    return "Someone else has newer changes on GitHub. Update your local copy before uploading again.";
  }
  if (/no configured push destination|no such remote|origin/i.test(message) && /remote/i.test(message)) {
    return "This project isn't connected to a GitHub repository yet.";
  }
  if (/local changes.*would be overwritten|overwritten by checkout|overwritten by merge/i.test(message)) {
    return "You have unsaved changes that would be lost. Save or stash them first.";
  }
  if (/branch .* not found|did not match any/i.test(message)) {
    return "That branch doesn't exist.";
  }
  if (/is not fully merged|not fully merged/i.test(message)) {
    return "That branch has changes that haven't been combined anywhere else yet. Trash it anyway only if you're sure.";
  }
  if (/cannot delete.*checked out|checked out at/i.test(message)) {
    return "You can't trash the branch you're currently on. Switch to another branch first.";
  }
  if (/no stash entries|no stash found/i.test(message)) {
    return "There's nothing stashed away right now.";
  }
  if (/does not have any commits yet|bad default revision|unknown revision/i.test(message)) {
    return "There's nothing saved yet.";
  }
  return "Something went wrong. Please try again.";
}

export interface PushResult {
  pushed: boolean;
  message: string;
}

export async function upload(cwd: string = process.cwd()): Promise<PushResult> {
  const repo = git(cwd);

  let status;
  try {
    status = await repo.status();
  } catch (err) {
    throw new GittoGitError(translateError(err));
  }

  if (!status.tracking) {
    try {
      await repo.push(["-u", "origin", status.current ?? "HEAD"]);
      return { pushed: true, message: "Uploaded to GitHub." };
    } catch (err) {
      throw new GittoGitError(translateError(err));
    }
  }

  if (status.ahead === 0) {
    return { pushed: false, message: "Nothing new to upload — you're already up to date." };
  }

  try {
    await repo.push();
    return { pushed: true, message: "Uploaded to GitHub." };
  } catch (err) {
    throw new GittoGitError(translateError(err));
  }
}

export interface CloneResult {
  path: string;
}

export async function download(url: string, destination?: string): Promise<CloneResult> {
  try {
    await simpleGit({ config: authConfig() }).clone(url, destination ?? ".");
  } catch (err) {
    throw new GittoGitError(translateError(err));
  }
  return { path: destination ?? "." };
}

export interface PlainStatus {
  branch: string;
  changedFiles: number;
  readyToUpload: number;
  upToDate: boolean;
  connectedToGitHub: boolean;
}

export async function getStatus(cwd: string = process.cwd()): Promise<PlainStatus> {
  const repo = git(cwd);
  let status;
  try {
    status = await repo.status();
  } catch (err) {
    throw new GittoGitError(translateError(err));
  }

  return {
    branch: status.current ?? "unknown",
    changedFiles: status.files.length,
    readyToUpload: status.ahead,
    upToDate: status.ahead === 0 && status.behind === 0 && status.files.length === 0,
    connectedToGitHub: Boolean(status.tracking),
  };
}

/** Normalizes a user-typed path (Windows separators, trailing slash) for comparison against git's paths. */
function normalizeGivenPath(p: string): string {
  return p.trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

/** True if `filePath` (a git-relative path) is one of `onlyPaths`, or lives inside one of them. */
function matchesOnlyPaths(filePath: string, onlyPaths: string[]): boolean {
  return onlyPaths.some((raw) => {
    const target = normalizeGivenPath(raw);
    return target.length > 0 && (filePath === target || filePath.startsWith(`${target}/`));
  });
}

function scopeToOnlyPaths(paths: string[], onlyPaths: string[]): string[] {
  return onlyPaths.length === 0 ? paths : paths.filter((p) => matchesOnlyPaths(p, onlyPaths));
}

export interface SavePreflight {
  hardBlocked: string[];
  flagged: string[];
  hasChanges: boolean;
}

export async function getSavePreflight(
  cwd: string = process.cwd(),
  onlyPaths: string[] = []
): Promise<SavePreflight> {
  const repo = git(cwd);
  let status;
  try {
    status = await repo.status();
  } catch (err) {
    throw new GittoGitError(translateError(err));
  }
  const paths = scopeToOnlyPaths(
    status.files.map((f) => f.path),
    onlyPaths
  );
  return {
    hardBlocked: paths.filter(isHardBlocked),
    flagged: paths.filter(isSoftExcluded),
    hasChanges: paths.length > 0,
  };
}

export async function findTrackedSecrets(cwd: string = process.cwd()): Promise<string[]> {
  try {
    const repo = git(cwd);
    const tracked = await repo.raw(["ls-files"]);
    return tracked
      .split("\n")
      .map((f) => f.trim())
      .filter((f) => f.length > 0 && isSensitivePath(f));
  } catch {
    return [];
  }
}

function hasConflictMarkers(cwd: string, filePath: string): boolean {
  try {
    const content = fs.readFileSync(path.join(cwd, filePath), "utf8");
    return /^<{7}(\s|$)/m.test(content) || /^={7}$/m.test(content) || /^>{7}(\s|$)/m.test(content);
  } catch {
    return false;
  }
}

export async function save(
  message: string,
  cwd: string = process.cwd(),
  excludePaths: string[] = [],
  onlyPaths: string[] = []
): Promise<string> {
  const repo = git(cwd);
  const op = await getInProgressOperation(cwd);

  if (op === "rebase" || op === "cherry-pick") {
    try {
      await repo.add(["-A"]);
      await repo.raw([op, "--continue"]);
    } catch (err) {
      const status = await repo.status().catch(() => null);
      if (status && status.conflicted.length > 0) {
        throw new ConflictError(op === "rebase" ? "Replaying" : "Cherry-picking", status.conflicted);
      }
      throw new GittoGitError(translateError(err));
    }
    const stillGoing = await getInProgressOperation(cwd);
    if (stillGoing) {
      return "Combined that change. Keep going — fix the next conflict and save again.";
    }
    return op === "rebase" ? "Finished replaying all your changes." : "Finished cherry-picking.";
  }

  try {
    const status = await repo.status();

    if (op === "merge") {
      // status.conflicted reflects git's index (stage 1/2/3 entries), which only
      // clears via `git add` — it stays stale even after the user fixes the file's
      // content, so check the actual file for leftover conflict markers instead.
      const stillConflicted = status.conflicted.filter((f) => hasConflictMarkers(cwd, f));
      if (stillConflicted.length > 0) {
        throw new ConflictError("Combining", stillConflicted);
      }
      await repo.add(["-A"]);
      await repo.commit(message || "Merge");
      return "Finished combining.";
    }

    const scopedPaths = scopeToOnlyPaths(
      status.files.map((f) => f.path),
      onlyPaths
    );
    if (scopedPaths.length === 0) {
      return onlyPaths.length > 0
        ? "Nothing to save — no changes found in the files or folders you gave."
        : "Nothing to save — no changes since your last save.";
    }

    const hardBlocked = scopedPaths.filter(isHardBlocked);
    if (hardBlocked.length > 0) {
      throw new SensitiveFilesError(hardBlocked);
    }

    if (excludePaths.length > 0) {
      appendToGitignore(cwd, excludePaths);
    }

    const pathsToAdd = scopedPaths.filter((p) => !excludePaths.includes(p));
    if (pathsToAdd.length === 0) {
      return "Nothing to save — everything changed is excluded.";
    }

    await repo.add(pathsToAdd);
    if (excludePaths.length > 0) await repo.add([".gitignore"]);
    await repo.commit(message);
    return `Saved ${pathsToAdd.length} file${pathsToAdd.length === 1 ? "" : "s"}.`;
  } catch (err) {
    if (err instanceof GittoGitError) throw err;
    throw new GittoGitError(translateError(err));
  }
}

export async function sync(cwd: string = process.cwd()): Promise<string> {
  const repo = git(cwd);
  try {
    const before = await repo.status();
    if (!before.tracking) {
      return "This project isn't connected to GitHub yet.";
    }
    const result = await repo.pull();
    if (result.files.length === 0 && result.summary.changes === 0) {
      return "Nothing new to bring down — already up to date.";
    }
    return `Brought down ${result.files.length} changed file${result.files.length === 1 ? "" : "s"}.`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/conflict/i.test(message)) {
      return "Sync stopped because of a conflict. Open the conflicting files, fix them, then save again.";
    }
    throw new GittoGitError(translateError(err));
  }
}

export interface BranchInfo {
  current: string;
  others: string[];
}

export async function listBranches(cwd: string = process.cwd()): Promise<BranchInfo> {
  const repo = git(cwd);
  try {
    const summary = await repo.branchLocal();
    const current = summary.current;
    const others = summary.all.filter((name) => name !== current);
    return { current, others };
  } catch (err) {
    throw new GittoGitError(translateError(err));
  }
}

export async function createBranch(name: string, cwd: string = process.cwd()): Promise<string> {
  const repo = git(cwd);
  try {
    await repo.checkoutLocalBranch(name);
    return `Created and switched to a new line: "${name}".`;
  } catch (err) {
    throw new GittoGitError(translateError(err));
  }
}

export async function switchBranch(name: string, cwd: string = process.cwd()): Promise<string> {
  const repo = git(cwd);
  try {
    await repo.checkout(name);
    return `Switched to "${name}".`;
  } catch (err) {
    throw new GittoGitError(translateError(err));
  }
}

export async function mergeBranch(name: string, cwd: string = process.cwd()): Promise<string> {
  const repo = git(cwd);
  try {
    await repo.merge([name]);
    return `Combined "${name}" into your current line.`;
  } catch (err) {
    const status = await repo.status().catch(() => null);
    if (status && status.conflicted.length > 0) {
      throw new ConflictError("Combining", status.conflicted);
    }
    throw new GittoGitError(translateError(err));
  }
}

export async function rebaseBranch(name: string, cwd: string = process.cwd()): Promise<string> {
  const repo = git(cwd);
  try {
    await repo.rebase([name]);
    return `Replayed your changes on top of "${name}".`;
  } catch (err) {
    const status = await repo.status().catch(() => null);
    if (status && status.conflicted.length > 0) {
      throw new ConflictError("Replaying", status.conflicted);
    }
    throw new GittoGitError(translateError(err));
  }
}

export async function pickCommit(hash: string, cwd: string = process.cwd()): Promise<string> {
  const repo = git(cwd);
  try {
    await repo.raw(["cherry-pick", hash]);
    return "Brought that change into your current line.";
  } catch (err) {
    const status = await repo.status().catch(() => null);
    if (status && status.conflicted.length > 0) {
      throw new ConflictError("Cherry-picking", status.conflicted);
    }
    throw new GittoGitError(translateError(err));
  }
}

export async function getBranchHistory(
  branchName: string,
  limit = 15,
  cwd: string = process.cwd()
): Promise<HistoryEntry[]> {
  const repo = git(cwd);
  try {
    const raw = await repo.raw([
      "log",
      branchName,
      `-n${limit}`,
      "--pretty=format:%H%x1f%s%x1f%ai%x1f%an%x1e",
    ]);
    return raw
      .split("\x1e")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [hash, message, date, author] = line.split("\x1f");
        return { hash: hash.slice(0, 7), message, date, author };
      });
  } catch (err) {
    throw new GittoGitError(translateError(err));
  }
}

export async function createTag(
  name: string,
  message: string,
  cwd: string = process.cwd()
): Promise<string> {
  const repo = git(cwd);
  try {
    await repo.addAnnotatedTag(name, message);
    return `Tagged this point as "${name}".`;
  } catch (err) {
    throw new GittoGitError(translateError(err));
  }
}

export async function pushTag(name: string, cwd: string = process.cwd()): Promise<string> {
  const repo = git(cwd);
  try {
    await repo.push(["origin", name]);
    return `Uploaded tag "${name}" to GitHub.`;
  } catch (err) {
    throw new GittoGitError(translateError(err));
  }
}

export interface HistoryEntry {
  hash: string;
  message: string;
  date: string;
  author: string;
}

export async function getHistory(
  limit = 15,
  cwd: string = process.cwd()
): Promise<HistoryEntry[]> {
  const repo = git(cwd);
  try {
    const log = await repo.log({ maxCount: limit });
    return log.all.map((entry) => ({
      hash: entry.hash.slice(0, 7),
      message: entry.message,
      date: entry.date,
      author: entry.author_name,
    }));
  } catch (err) {
    throw new GittoGitError(translateError(err));
  }
}

export async function undoLastSave(cwd: string = process.cwd()): Promise<string> {
  const repo = git(cwd);
  const op = await getInProgressOperation(cwd);

  if (op) {
    try {
      await repo.raw([op, "--abort"]);
      const verb = op === "merge" ? "combine" : op === "rebase" ? "replay" : "cherry-pick";
      return `Cancelled the ${verb} — back to how things were before.`;
    } catch (err) {
      throw new GittoGitError(translateError(err));
    }
  }

  try {
    const status = await repo.status();
    if (status.ahead > 0 || !status.tracking) {
      await repo.reset(ResetMode.SOFT, ["HEAD~1"]);
      return "Undid your last save. The changes are still there, just not saved anymore.";
    }
    await repo.revert("HEAD", ["--no-edit"]);
    return "Your last save was already uploaded, so we added a new save that undoes it.";
  } catch (err) {
    throw new GittoGitError(translateError(err));
  }
}

export class UnmergedBranchError extends GittoGitError {
  constructor(public readonly branch: string) {
    super(`"${branch}" has changes that haven't been combined anywhere else yet.`);
  }
}

export async function deleteBranch(
  name: string,
  force = false,
  cwd: string = process.cwd()
): Promise<string> {
  const repo = git(cwd);
  try {
    await repo.deleteLocalBranch(name, force);
    return `Trashed "${name}".`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!force && /not fully merged/i.test(message)) {
      throw new UnmergedBranchError(name);
    }
    throw new GittoGitError(translateError(err));
  }
}

export async function hasStash(cwd: string = process.cwd()): Promise<boolean> {
  const repo = git(cwd);
  try {
    const list = await repo.stashList();
    return list.total > 0;
  } catch {
    return false;
  }
}

export async function stashChanges(cwd: string = process.cwd()): Promise<string> {
  const repo = git(cwd);
  try {
    const status = await repo.status();
    if (status.files.length === 0) {
      return "Nothing to stash away — there are no changes right now.";
    }
    await repo.stash();
    return "Stashed your changes away for later.";
  } catch (err) {
    throw new GittoGitError(translateError(err));
  }
}

export async function restoreStash(cwd: string = process.cwd()): Promise<string> {
  const repo = git(cwd);
  try {
    await repo.stash(["pop"]);
    return "Brought back your stashed changes.";
  } catch (err) {
    throw new GittoGitError(translateError(err));
  }
}

export async function getRemoteUrl(cwd: string = process.cwd()): Promise<string | null> {
  const repo = git(cwd);
  try {
    const remotes = await repo.getRemotes(true);
    const origin = remotes.find((r) => r.name === "origin");
    return origin?.refs.fetch ?? null;
  } catch {
    return null;
  }
}

export async function addRemote(url: string, cwd: string = process.cwd()): Promise<void> {
  const repo = git(cwd);
  try {
    await repo.addRemote("origin", url);
  } catch (err) {
    throw new GittoGitError(translateError(err));
  }
}

export interface RepoState {
  isRepo: boolean;
  hasRemote: boolean;
  currentBranch: string;
  otherBranches: string[];
  hasChanges: boolean;
  hasUnpushed: boolean;
  hasUnpulled: boolean;
  hasStash: boolean;
  hasCommits: boolean;
  inProgress: InProgressOperation;
}

export async function getRepoState(cwd: string = process.cwd()): Promise<RepoState> {
  const empty: RepoState = {
    isRepo: false,
    hasRemote: false,
    currentBranch: "",
    otherBranches: [],
    hasChanges: false,
    hasUnpushed: false,
    hasUnpulled: false,
    hasStash: false,
    hasCommits: false,
    inProgress: null,
  };

  if (!(await isGitRepo(cwd))) return empty;

  const repo = git(cwd);
  const [status, branches, stashed, inProgress] = await Promise.all([
    repo.status(),
    listBranches(cwd),
    hasStash(cwd),
    getInProgressOperation(cwd),
  ]);

  let hasCommits = true;
  try {
    await repo.revparse(["HEAD"]);
  } catch {
    hasCommits = false;
  }

  return {
    isRepo: true,
    hasRemote: Boolean(status.tracking) || (await repo.getRemotes()).length > 0,
    currentBranch: branches.current,
    otherBranches: branches.others,
    hasChanges: status.files.length > 0,
    hasUnpushed: status.ahead > 0,
    hasUnpulled: status.behind > 0,
    hasStash: stashed,
    hasCommits,
    inProgress,
  };
}
