import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { simpleGit } from "simple-git";

// Local git operations don't need a token, and we don't want tests reading
// the real user's ~/.gitto/config.json.
vi.mock("./config.js", () => ({
  getToken: () => undefined,
  getLogin: () => undefined,
}));

import {
  isGitRepo,
  initRepo,
  getStatus,
  save,
  getSavePreflight,
  getHistory,
  listBranches,
  createBranch,
  switchBranch,
  mergeBranch,
  rebaseBranch,
  undoLastSave,
  stashChanges,
  restoreStash,
  hasStash,
  deleteBranch,
  getRepoState,
  ConflictError,
  SensitiveFilesError,
  UnmergedBranchError,
} from "./git.js";

let dir: string;

async function setupRepo(): Promise<void> {
  await initRepo(dir);
  const raw = simpleGit(dir);
  await raw.addConfig("user.email", "test@example.com");
  await raw.addConfig("user.name", "Gitto Test");
}

function writeFile(name: string, content: string): void {
  fs.writeFileSync(path.join(dir, name), content, "utf8");
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "gitto-repo-"));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("initRepo / isGitRepo", () => {
  it("is false before init, true after", async () => {
    expect(await isGitRepo(dir)).toBe(false);
    await initRepo(dir);
    expect(await isGitRepo(dir)).toBe(true);
  });
});

describe("save", () => {
  it("commits changed files and reports how many", async () => {
    await setupRepo();
    writeFile("a.txt", "hello");
    writeFile("b.txt", "world");
    const result = await save("initial commit", dir);
    expect(result).toBe("Saved 2 files.");

    const history = await getHistory(10, dir);
    expect(history).toHaveLength(1);
    expect(history[0].message).toBe("initial commit");
  });

  it("reports nothing to save when there are no changes", async () => {
    await setupRepo();
    writeFile("a.txt", "hello");
    await save("first", dir);
    const result = await save("second", dir);
    expect(result).toBe("Nothing to save — no changes since your last save.");
  });

  it("refuses to save hard-blocked files", async () => {
    await setupRepo();
    writeFile("id_rsa", "-----BEGIN PRIVATE KEY-----");
    await expect(save("oops", dir)).rejects.toThrow(SensitiveFilesError);
  });

  it("excludes given paths via .gitignore and skips committing them", async () => {
    await setupRepo();
    writeFile("keep.txt", "keep me");
    writeFile(".env", "SECRET=1");
    const result = await save("first", dir, [".env"]);
    expect(result).toBe("Saved 1 file.");

    const gitignore = fs.readFileSync(path.join(dir, ".gitignore"), "utf8");
    expect(gitignore).toContain(".env");

    const history = await getHistory(10, dir);
    expect(history).toHaveLength(1);
  });

  it("only saves paths matching onlyPaths when given", async () => {
    await setupRepo();
    fs.mkdirSync(path.join(dir, "sub"));
    writeFile("root.txt", "root");
    writeFile("sub/nested.txt", "nested");
    const result = await save("scoped", dir, [], ["sub"]);
    expect(result).toBe("Saved 1 file.");

    const status = await getStatus(dir);
    expect(status.changedFiles).toBe(1); // root.txt is still uncommitted
  });
});

describe("getSavePreflight", () => {
  it("flags hard-blocked and soft-excluded files separately", async () => {
    await setupRepo();
    writeFile("id_rsa", "secret");
    writeFile(".env", "SECRET=1");
    writeFile("normal.txt", "fine");
    const preflight = await getSavePreflight(dir);
    expect(preflight.hardBlocked).toContain("id_rsa");
    expect(preflight.flagged).toContain(".env");
    expect(preflight.hasChanges).toBe(true);
  });
});

describe("getStatus", () => {
  it("reflects pending changes and disconnected remote", async () => {
    await setupRepo();
    writeFile("a.txt", "hi");
    const status = await getStatus(dir);
    expect(status.changedFiles).toBe(1);
    expect(status.connectedToGitHub).toBe(false);
  });
});

describe("branches", () => {
  it("creates, lists, and switches between branches", async () => {
    await setupRepo();
    writeFile("a.txt", "hi");
    await save("initial", dir);

    const before = await listBranches(dir);
    const original = before.current;

    await createBranch("feature", dir);
    let branches = await listBranches(dir);
    expect(branches.current).toBe("feature");
    expect(branches.others).toContain(original);

    await switchBranch(original, dir);
    branches = await listBranches(dir);
    expect(branches.current).toBe(original);
    expect(branches.others).toContain("feature");
  });
});

describe("merge conflicts", () => {
  it("throws ConflictError on a conflicting merge, then finishes after resolution via save()", async () => {
    await setupRepo();
    writeFile("shared.txt", "base\n");
    await save("base", dir);

    const raw = simpleGit(dir);
    const base = (await raw.branchLocal()).current;

    await createBranch("feature", dir);
    writeFile("shared.txt", "feature change\n");
    await save("feature change", dir);

    await switchBranch(base, dir);
    writeFile("shared.txt", "main change\n");
    await save("main change", dir);

    await expect(mergeBranch("feature", dir)).rejects.toThrow(ConflictError);

    writeFile("shared.txt", "resolved\n");
    const result = await save("merge commit", dir);
    expect(result).toBe("Finished combining.");
  });
});

describe("rebase conflicts", () => {
  it("throws ConflictError on a conflicting rebase, then finishes after resolution via save()", async () => {
    await setupRepo();
    writeFile("shared.txt", "base\n");
    await save("base", dir);

    const raw = simpleGit(dir);
    const base = (await raw.branchLocal()).current;

    await createBranch("feature", dir);
    writeFile("shared.txt", "feature change\n");
    await save("feature change", dir);

    await switchBranch(base, dir);
    writeFile("shared.txt", "main change\n");
    await save("main change", dir);

    await switchBranch("feature", dir);
    await expect(rebaseBranch(base, dir)).rejects.toThrow(ConflictError);

    writeFile("shared.txt", "resolved\n");
    const result = await save("continue rebase", dir);
    expect(result).toBe("Finished replaying all your changes.");
  });
});

describe("undoLastSave", () => {
  it("soft-resets an unpushed commit, keeping the changes on disk", async () => {
    await setupRepo();
    writeFile("a.txt", "v1");
    await save("first", dir);
    writeFile("a.txt", "v2");
    await save("second", dir);

    const result = await undoLastSave(dir);
    expect(result).toContain("Undid your last save");

    const history = await getHistory(10, dir);
    expect(history).toHaveLength(1);
    expect(fs.readFileSync(path.join(dir, "a.txt"), "utf8")).toBe("v2");
  });
});

describe("stash", () => {
  it("stashes and restores changes", async () => {
    await setupRepo();
    writeFile("a.txt", "v1");
    await save("first", dir);
    writeFile("a.txt", "v2");

    expect(await hasStash(dir)).toBe(false);
    await stashChanges(dir);
    expect(await hasStash(dir)).toBe(true);
    expect(fs.readFileSync(path.join(dir, "a.txt"), "utf8")).toBe("v1");

    await restoreStash(dir);
    expect(await hasStash(dir)).toBe(false);
    expect(fs.readFileSync(path.join(dir, "a.txt"), "utf8")).toBe("v2");
  });
});

describe("deleteBranch", () => {
  it("refuses to delete an unmerged branch without force, but allows it with force", async () => {
    await setupRepo();
    writeFile("a.txt", "v1");
    await save("first", dir);
    const raw = simpleGit(dir);
    const base = (await raw.branchLocal()).current;

    await createBranch("feature", dir);
    writeFile("b.txt", "new");
    await save("feature work", dir);
    await switchBranch(base, dir);

    await expect(deleteBranch("feature", false, dir)).rejects.toThrow(UnmergedBranchError);
    const result = await deleteBranch("feature", true, dir);
    expect(result).toBe('Trashed "feature".');
  });
});

describe("getRepoState", () => {
  it("reports isRepo false for a non-repo directory", async () => {
    const state = await getRepoState(dir);
    expect(state.isRepo).toBe(false);
  });

  it("reports full state for an initialized repo with commits", async () => {
    await setupRepo();
    writeFile("a.txt", "v1");
    await save("first", dir);

    const state = await getRepoState(dir);
    expect(state.isRepo).toBe(true);
    expect(state.hasCommits).toBe(true);
    expect(state.hasChanges).toBe(false);
    expect(state.hasRemote).toBe(false);
  });
});
