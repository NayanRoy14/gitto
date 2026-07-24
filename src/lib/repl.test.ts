import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { LineReader } from "./lineReader.js";

const mockLogin = vi.fn();
const mockIsLoggedIn = vi.fn();
vi.mock("./auth.js", () => ({
  login: (...args: unknown[]) => mockLogin(...args),
  isLoggedIn: () => mockIsLoggedIn(),
}));

const mockConfigExists = vi.fn();
const mockClearConfig = vi.fn();
vi.mock("./config.js", () => ({
  configExists: () => mockConfigExists(),
  clearConfig: () => mockClearConfig(),
}));

const mockIsGitRepo = vi.fn();
const mockInitRepo = vi.fn();
const mockGetRepoState = vi.fn();
const mockGetStatus = vi.fn();
const mockFindTrackedSecrets = vi.fn();
const mockSave = vi.fn();
const mockGetSavePreflight = vi.fn();
const mockGetInProgressOperation = vi.fn();
const mockSync = vi.fn();
const mockUpload = vi.fn();
const mockGetRemoteUrl = vi.fn();
const mockAddRemote = vi.fn();
const mockDownload = vi.fn();
const mockListBranches = vi.fn();
const mockCreateBranch = vi.fn();
const mockSwitchBranch = vi.fn();
const mockMergeBranch = vi.fn();
const mockRebaseBranch = vi.fn();
const mockPickCommit = vi.fn();
const mockGetBranchHistory = vi.fn();
const mockDeleteBranch = vi.fn();
const mockHasStash = vi.fn();
const mockStashChanges = vi.fn();
const mockRestoreStash = vi.fn();
const mockGetHistory = vi.fn();
const mockUndoLastSave = vi.fn();
const mockCreateTag = vi.fn();
const mockPushTag = vi.fn();

vi.mock("./git.js", async () => {
  const actual = await vi.importActual<typeof import("./git.js")>("./git.js");
  return {
    ...actual,
    isGitRepo: () => mockIsGitRepo(),
    initRepo: () => mockInitRepo(),
    getRepoState: () => mockGetRepoState(),
    getStatus: () => mockGetStatus(),
    findTrackedSecrets: () => mockFindTrackedSecrets(),
    save: (...args: unknown[]) => mockSave(...args),
    getSavePreflight: (...args: unknown[]) => mockGetSavePreflight(...args),
    getInProgressOperation: () => mockGetInProgressOperation(),
    sync: () => mockSync(),
    upload: () => mockUpload(),
    getRemoteUrl: () => mockGetRemoteUrl(),
    addRemote: (...args: unknown[]) => mockAddRemote(...args),
    download: (...args: unknown[]) => mockDownload(...args),
    listBranches: () => mockListBranches(),
    createBranch: (...args: unknown[]) => mockCreateBranch(...args),
    switchBranch: (...args: unknown[]) => mockSwitchBranch(...args),
    mergeBranch: (...args: unknown[]) => mockMergeBranch(...args),
    rebaseBranch: (...args: unknown[]) => mockRebaseBranch(...args),
    pickCommit: (...args: unknown[]) => mockPickCommit(...args),
    getBranchHistory: (...args: unknown[]) => mockGetBranchHistory(...args),
    deleteBranch: (...args: unknown[]) => mockDeleteBranch(...args),
    hasStash: () => mockHasStash(),
    stashChanges: () => mockStashChanges(),
    restoreStash: () => mockRestoreStash(),
    getHistory: () => mockGetHistory(),
    undoLastSave: () => mockUndoLastSave(),
    createTag: (...args: unknown[]) => mockCreateTag(...args),
    pushTag: (...args: unknown[]) => mockPushTag(...args),
  };
});

const mockCreateRequest = vi.fn();
const mockCreateIssue = vi.fn();
const mockForkRepo = vi.fn();
const mockAddCollaborator = vi.fn();
const mockCreateRepo = vi.fn();
const mockSuggestRepoName = vi.fn();
vi.mock("./github.js", () => ({
  createRequest: (...args: unknown[]) => mockCreateRequest(...args),
  createIssue: (...args: unknown[]) => mockCreateIssue(...args),
  forkRepo: () => mockForkRepo(),
  addCollaborator: (...args: unknown[]) => mockAddCollaborator(...args),
  createRepo: (...args: unknown[]) => mockCreateRepo(...args),
  suggestRepoName: () => mockSuggestRepoName(),
}));

const mockCreateLineReader = vi.fn();
vi.mock("./lineReader.js", () => ({
  createLineReader: () => mockCreateLineReader(),
}));

const { ensureRepoSetup, repl, runRepl } = await import("./repl.js");
const { UnmergedBranchError } = await import("./git.js");

class FakeLineReader implements LineReader {
  private answers: string[];
  private ended = false;

  constructor(answers: string[] = []) {
    this.answers = [...answers];
  }

  async question(_query: string): Promise<string> {
    if (this.answers.length === 0) {
      this.ended = true;
      return "";
    }
    return this.answers.shift() as string;
  }

  hasEnded(): boolean {
    return this.ended;
  }

  close(): void {}
}

let logs: string[];

beforeEach(() => {
  vi.clearAllMocks();
  logs = [];
  vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
    logs.push(String(msg));
  });
  mockSuggestRepoName.mockReturnValue("my-project");
});

afterEach(() => {
  vi.restoreAllMocks();
});

function output(): string {
  return logs.join("\n");
}

describe("ensureRepoSetup", () => {
  it("returns true without asking when already a repo", async () => {
    mockIsGitRepo.mockResolvedValue(true);
    const result = await ensureRepoSetup(new FakeLineReader());
    expect(result).toBe(true);
    expect(mockInitRepo).not.toHaveBeenCalled();
  });

  it("initializes a repo when the user agrees", async () => {
    mockIsGitRepo.mockResolvedValue(false);
    mockInitRepo.mockResolvedValue(undefined);
    const result = await ensureRepoSetup(new FakeLineReader([""]));
    expect(result).toBe(true);
    expect(mockInitRepo).toHaveBeenCalled();
    expect(output()).toContain("Set up.");
  });

  it("cancels when the user declines", async () => {
    mockIsGitRepo.mockResolvedValue(false);
    const result = await ensureRepoSetup(new FakeLineReader(["n"]));
    expect(result).toBe(false);
    expect(mockInitRepo).not.toHaveBeenCalled();
    expect(output()).toContain("Cancelled.");
  });
});

describe("repl.login", () => {
  it("reports success", async () => {
    mockLogin.mockImplementation(async (onVerification: (v: unknown) => void) => {
      onVerification({ userCode: "ABCD-1234", verificationUri: "https://github.com/login/device" });
      return { login: "nayan" };
    });
    await repl.login();
    expect(output()).toContain(
      "Go to https://github.com/login/device and enter this code: ABCD-1234",
    );
    expect(output()).toContain("Logged in as nayan.");
  });

  it("reports failure", async () => {
    mockLogin.mockRejectedValue(new Error("network down"));
    await repl.login();
    expect(output()).toContain("✗ network down");
  });
});

describe("repl.logout", () => {
  it("says when not logged in", async () => {
    mockIsLoggedIn.mockReturnValue(false);
    await repl.logout(new FakeLineReader());
    expect(output()).toContain("You're not logged in.");
    expect(mockClearConfig).not.toHaveBeenCalled();
  });

  it("logs out when confirmed", async () => {
    mockIsLoggedIn.mockReturnValue(true);
    await repl.logout(new FakeLineReader([""]));
    expect(mockClearConfig).toHaveBeenCalled();
    expect(output()).toContain("Logged out.");
  });

  it("cancels when declined", async () => {
    mockIsLoggedIn.mockReturnValue(true);
    await repl.logout(new FakeLineReader(["n"]));
    expect(mockClearConfig).not.toHaveBeenCalled();
    expect(output()).toContain("Cancelled.");
  });
});

describe("repl.status", () => {
  it("summarizes clean, connected status", async () => {
    mockGetStatus.mockResolvedValue({
      branch: "main",
      changedFiles: 0,
      readyToUpload: 0,
      upToDate: true,
      connectedToGitHub: true,
    });
    mockFindTrackedSecrets.mockResolvedValue([]);
    await repl.status();
    expect(output()).toContain('On "main".');
    expect(output()).toContain("Everything is up to date");
  });

  it("warns about tracked secrets", async () => {
    mockGetStatus.mockResolvedValue({
      branch: "main",
      changedFiles: 0,
      readyToUpload: 0,
      upToDate: true,
      connectedToGitHub: true,
    });
    mockFindTrackedSecrets.mockResolvedValue([".env"]);
    await repl.status();
    expect(output()).toContain("look like secrets");
    expect(output()).toContain(".env");
  });

  it("reports errors", async () => {
    mockGetStatus.mockRejectedValue(new Error("boom"));
    await repl.status();
    expect(output()).toContain("✗ boom");
  });
});

describe("repl.save", () => {
  it("continues a rebase without asking anything", async () => {
    mockGetInProgressOperation.mockResolvedValue("rebase");
    mockSave.mockResolvedValue("Finished replaying all your changes.");
    await repl.save(new FakeLineReader());
    expect(mockSave).toHaveBeenCalledWith("");
    expect(output()).toContain("Finished replaying all your changes.");
  });

  it("asks for a merge message when finishing a merge", async () => {
    mockGetInProgressOperation.mockResolvedValue("merge");
    mockSave.mockResolvedValue("Finished combining.");
    await repl.save(new FakeLineReader(["fixed conflict"]));
    expect(mockSave).toHaveBeenCalledWith("fixed conflict");
    expect(output()).toContain("Finished combining.");
  });

  it("saves everything with a typed message", async () => {
    mockGetInProgressOperation.mockResolvedValue(null);
    mockGetSavePreflight.mockResolvedValue({ hardBlocked: [], flagged: [], hasChanges: true });
    mockSave.mockResolvedValue("Saved 2 files.");
    await repl.save(new FakeLineReader(["", "fix the bug"]));
    expect(mockGetSavePreflight).toHaveBeenCalledWith(undefined, []);
    expect(mockSave).toHaveBeenCalledWith("fix the bug", undefined, [], []);
    expect(output()).toContain("Saved 2 files.");
  });

  it("scopes the save to typed paths", async () => {
    mockGetInProgressOperation.mockResolvedValue(null);
    mockGetSavePreflight.mockResolvedValue({ hardBlocked: [], flagged: [], hasChanges: true });
    mockSave.mockResolvedValue("Saved 1 file.");
    await repl.save(new FakeLineReader(["src/lib", ""]));
    expect(mockGetSavePreflight).toHaveBeenCalledWith(undefined, ["src/lib"]);
    expect(mockSave).toHaveBeenCalledWith("Update", undefined, [], ["src/lib"]);
  });

  it("refuses to save hard-blocked files", async () => {
    mockGetInProgressOperation.mockResolvedValue(null);
    mockGetSavePreflight.mockResolvedValue({
      hardBlocked: ["id_rsa"],
      flagged: [],
      hasChanges: true,
    });
    await repl.save(new FakeLineReader([""]));
    expect(mockSave).not.toHaveBeenCalled();
    expect(output()).toContain("id_rsa");
  });

  it("excludes flagged files when the user agrees", async () => {
    mockGetInProgressOperation.mockResolvedValue(null);
    mockGetSavePreflight.mockResolvedValue({
      hardBlocked: [],
      flagged: [".env"],
      hasChanges: true,
    });
    mockSave.mockResolvedValue("Saved 1 file.");
    await repl.save(new FakeLineReader(["", "", "message"]));
    expect(mockSave).toHaveBeenCalledWith("message", undefined, [".env"], []);
  });

  it("saves flagged files anyway when the user insists", async () => {
    mockGetInProgressOperation.mockResolvedValue(null);
    mockGetSavePreflight.mockResolvedValue({
      hardBlocked: [],
      flagged: [".env"],
      hasChanges: true,
    });
    mockSave.mockResolvedValue("Saved 1 file.");
    await repl.save(new FakeLineReader(["", "n", "y", "message"]));
    expect(mockSave).toHaveBeenCalledWith("message", undefined, [], []);
  });

  it("cancels when the user declines both exclude and save-anyway", async () => {
    mockGetInProgressOperation.mockResolvedValue(null);
    mockGetSavePreflight.mockResolvedValue({
      hardBlocked: [],
      flagged: [".env"],
      hasChanges: true,
    });
    await repl.save(new FakeLineReader(["", "n", "n"]));
    expect(mockSave).not.toHaveBeenCalled();
    expect(output()).toContain("Save cancelled. Nothing was changed.");
  });
});

describe("repl.sync", () => {
  it("reports the result", async () => {
    mockSync.mockResolvedValue("Brought down 3 changed files.");
    await repl.sync();
    expect(output()).toContain("Brought down 3 changed files.");
  });
});

describe("repl.upload", () => {
  it("uploads directly when already connected", async () => {
    mockGetRemoteUrl.mockResolvedValue("https://github.com/nayan/gitto.git");
    mockUpload.mockResolvedValue({ pushed: true, message: "Uploaded to GitHub." });
    await repl.upload(new FakeLineReader());
    expect(mockCreateRepo).not.toHaveBeenCalled();
    expect(output()).toContain("Uploaded to GitHub.");
  });

  it("creates a repo first when not yet connected", async () => {
    mockGetRemoteUrl.mockResolvedValue(null);
    mockSuggestRepoName.mockReturnValue("my-project");
    mockCreateRepo.mockResolvedValue({
      url: "https://github.com/nayan/my-project.git",
      htmlUrl: "x",
    });
    mockUpload.mockResolvedValue({ pushed: true, message: "Uploaded to GitHub." });
    await repl.upload(new FakeLineReader([""]));
    expect(mockCreateRepo).toHaveBeenCalledWith({ name: "my-project", private: true });
    expect(mockAddRemote).toHaveBeenCalledWith("https://github.com/nayan/my-project.git");
    expect(output()).toContain("Uploaded to GitHub.");
  });

  it("reports repo-creation failures without attempting to push", async () => {
    mockGetRemoteUrl.mockResolvedValue(null);
    mockCreateRepo.mockRejectedValue(new Error("name already exists"));
    await repl.upload(new FakeLineReader([""]));
    expect(mockUpload).not.toHaveBeenCalled();
    expect(output()).toContain("name already exists");
  });
});

describe("repl.downloadArgs", () => {
  it("reports where the project was downloaded", async () => {
    mockDownload.mockResolvedValue({ path: "./gitto" });
    await repl.downloadArgs("https://github.com/nayan/gitto.git");
    expect(mockDownload).toHaveBeenCalledWith("https://github.com/nayan/gitto.git", undefined);
    expect(output()).toContain("Downloaded into ./gitto.");
  });
});

describe("repl.branch", () => {
  it("creates a branch with the typed name", async () => {
    mockCreateBranch.mockResolvedValue('Created and switched to a new line: "feature".');
    await repl.branch(new FakeLineReader(["feature"]));
    expect(mockCreateBranch).toHaveBeenCalledWith("feature");
  });

  it("refuses an empty name", async () => {
    await repl.branch(new FakeLineReader([""]));
    expect(mockCreateBranch).not.toHaveBeenCalled();
    expect(output()).toContain("Name can't be empty.");
  });
});

describe("repl.switch", () => {
  it("says there's nothing to switch to with only one branch", async () => {
    mockListBranches.mockResolvedValue({ current: "main", others: [] });
    await repl.switch(new FakeLineReader());
    expect(output()).toContain("nothing to switch to");
  });

  it("switches to the branch picked by number", async () => {
    mockListBranches.mockResolvedValue({ current: "main", others: ["feature", "other"] });
    mockSwitchBranch.mockResolvedValue('Switched to "feature".');
    await repl.switch(new FakeLineReader(["1"]));
    expect(mockSwitchBranch).toHaveBeenCalledWith("feature");
  });

  it("switches to the branch typed by name", async () => {
    mockListBranches.mockResolvedValue({ current: "main", others: ["feature"] });
    mockSwitchBranch.mockResolvedValue('Switched to "feature".');
    await repl.switch(new FakeLineReader(["feature"]));
    expect(mockSwitchBranch).toHaveBeenCalledWith("feature");
  });

  it("cancels on a blank answer", async () => {
    mockListBranches.mockResolvedValue({ current: "main", others: ["feature"] });
    await repl.switch(new FakeLineReader([""]));
    expect(mockSwitchBranch).not.toHaveBeenCalled();
    expect(output()).toContain("Cancelled.");
  });
});

describe("repl.combine", () => {
  it("merges the picked branch", async () => {
    mockListBranches.mockResolvedValue({ current: "main", others: ["feature"] });
    mockMergeBranch.mockResolvedValue('Combined "feature" into your current line.');
    await repl.combine(new FakeLineReader(["1"]));
    expect(mockMergeBranch).toHaveBeenCalledWith("feature");
  });
});

describe("repl.rebase", () => {
  it("rebases onto the picked branch", async () => {
    mockListBranches.mockResolvedValue({ current: "feature", others: ["main"] });
    mockRebaseBranch.mockResolvedValue('Replayed your changes on top of "main".');
    await repl.rebase(new FakeLineReader(["1"]));
    expect(mockRebaseBranch).toHaveBeenCalledWith("main");
  });
});

describe("repl.pick", () => {
  it("cherry-picks the chosen commit from the chosen branch", async () => {
    mockListBranches.mockResolvedValue({ current: "main", others: ["feature"] });
    mockGetBranchHistory.mockResolvedValue([
      { hash: "abc1234", message: "add thing", date: "2026-01-01", author: "nayan" },
    ]);
    mockPickCommit.mockResolvedValue("Brought that change into your current line.");
    await repl.pick(new FakeLineReader(["1", "1"]));
    expect(mockGetBranchHistory).toHaveBeenCalledWith("feature");
    expect(mockPickCommit).toHaveBeenCalledWith("abc1234");
  });

  it("says there's nothing to pick when the source branch has no history", async () => {
    mockListBranches.mockResolvedValue({ current: "main", others: ["feature"] });
    mockGetBranchHistory.mockResolvedValue([]);
    await repl.pick(new FakeLineReader(["1"]));
    expect(mockPickCommit).not.toHaveBeenCalled();
    expect(output()).toContain("nothing saved to pick from");
  });
});

describe("repl.trash", () => {
  it("deletes a merged branch after confirmation", async () => {
    mockListBranches.mockResolvedValue({ current: "main", others: ["feature"] });
    mockDeleteBranch.mockResolvedValue('Trashed "feature".');
    await repl.trash(new FakeLineReader(["1", "y"]));
    expect(mockDeleteBranch).toHaveBeenCalledWith("feature");
    expect(output()).toContain('Trashed "feature".');
  });

  it("cancels when the user declines the delete confirmation", async () => {
    mockListBranches.mockResolvedValue({ current: "main", others: ["feature"] });
    await repl.trash(new FakeLineReader(["1", "n"]));
    expect(mockDeleteBranch).not.toHaveBeenCalled();
    expect(output()).toContain("Cancelled.");
  });

  it("offers to force-delete an unmerged branch", async () => {
    mockListBranches.mockResolvedValue({ current: "main", others: ["feature"] });
    mockDeleteBranch.mockRejectedValueOnce(new UnmergedBranchError("feature"));
    mockDeleteBranch.mockResolvedValueOnce('Trashed "feature".');
    await repl.trash(new FakeLineReader(["1", "y", "y"]));
    expect(mockDeleteBranch).toHaveBeenNthCalledWith(1, "feature");
    expect(mockDeleteBranch).toHaveBeenNthCalledWith(2, "feature", true);
  });
});

describe("repl.stash", () => {
  it("stashes when there are changes", async () => {
    mockGetStatus.mockResolvedValue({
      branch: "main",
      changedFiles: 2,
      readyToUpload: 0,
      upToDate: false,
      connectedToGitHub: false,
    });
    mockStashChanges.mockResolvedValue("Stashed your changes away for later.");
    await repl.stash();
    expect(mockStashChanges).toHaveBeenCalled();
    expect(mockRestoreStash).not.toHaveBeenCalled();
  });

  it("restores a stash when there are no pending changes", async () => {
    mockGetStatus.mockResolvedValue({
      branch: "main",
      changedFiles: 0,
      readyToUpload: 0,
      upToDate: true,
      connectedToGitHub: false,
    });
    mockHasStash.mockResolvedValue(true);
    mockRestoreStash.mockResolvedValue("Brought back your stashed changes.");
    await repl.stash();
    expect(mockRestoreStash).toHaveBeenCalled();
  });

  it("says there's nothing to do when neither applies", async () => {
    mockGetStatus.mockResolvedValue({
      branch: "main",
      changedFiles: 0,
      readyToUpload: 0,
      upToDate: true,
      connectedToGitHub: false,
    });
    mockHasStash.mockResolvedValue(false);
    await repl.stash();
    expect(output()).toContain("Nothing to stash away and nothing stashed to bring back.");
  });
});

describe("repl.history", () => {
  it("lists saved changes", async () => {
    mockGetHistory.mockResolvedValue([
      { hash: "abc1234", message: "add thing", date: "2026-01-01T00:00:00Z", author: "nayan" },
    ]);
    await repl.history();
    expect(output()).toContain("abc1234");
    expect(output()).toContain("add thing");
  });

  it("says when nothing is saved yet", async () => {
    mockGetHistory.mockResolvedValue([]);
    await repl.history();
    expect(output()).toContain("Nothing saved yet.");
  });
});

describe("repl.undo", () => {
  it("undoes the last save when confirmed", async () => {
    mockUndoLastSave.mockResolvedValue("Undid your last save.");
    await repl.undo(new FakeLineReader([""]));
    expect(mockUndoLastSave).toHaveBeenCalled();
  });

  it("cancels when declined", async () => {
    await repl.undo(new FakeLineReader(["n"]));
    expect(mockUndoLastSave).not.toHaveBeenCalled();
    expect(output()).toContain("Cancelled.");
  });
});

describe("repl.tag", () => {
  it("creates a tag and offers to push it when connected and logged in", async () => {
    mockCreateTag.mockResolvedValue('Tagged this point as "v1.0".');
    mockGetRepoState.mockResolvedValue({
      isRepo: true,
      hasRemote: true,
      currentBranch: "main",
      otherBranches: [],
      hasChanges: false,
      hasUnpushed: false,
      hasUnpulled: false,
      hasStash: false,
      hasCommits: true,
      inProgress: null,
    });
    mockIsLoggedIn.mockReturnValue(true);
    mockPushTag.mockResolvedValue('Uploaded tag "v1.0" to GitHub.');
    await repl.tag(new FakeLineReader(["v1.0", "release notes", ""]));
    expect(mockCreateTag).toHaveBeenCalledWith("v1.0", "release notes");
    expect(mockPushTag).toHaveBeenCalledWith("v1.0");
  });

  it("doesn't offer to push when there's no remote", async () => {
    mockCreateTag.mockResolvedValue('Tagged this point as "v1.0".');
    mockGetRepoState.mockResolvedValue({
      isRepo: true,
      hasRemote: false,
      currentBranch: "main",
      otherBranches: [],
      hasChanges: false,
      hasUnpushed: false,
      hasUnpulled: false,
      hasStash: false,
      hasCommits: true,
      inProgress: null,
    });
    await repl.tag(new FakeLineReader(["v1.0", ""]));
    expect(mockPushTag).not.toHaveBeenCalled();
  });

  it("refuses an empty tag name", async () => {
    await repl.tag(new FakeLineReader([""]));
    expect(mockCreateTag).not.toHaveBeenCalled();
    expect(output()).toContain("Name can't be empty.");
  });
});

describe("repl.request", () => {
  it("opens a pull request against the picked branch", async () => {
    mockListBranches.mockResolvedValue({ current: "feature", others: ["main"] });
    mockCreateRequest.mockResolvedValue("Opened request #7: https://github.com/nayan/gitto/pull/7");
    await repl.request(new FakeLineReader(["1", "add feature"]));
    expect(mockCreateRequest).toHaveBeenCalledWith({
      title: "add feature",
      head: "feature",
      base: "main",
    });
  });
});

describe("repl.issue", () => {
  it("opens an issue with the typed title", async () => {
    mockCreateIssue.mockResolvedValue("Opened issue #3: https://github.com/nayan/gitto/issues/3");
    await repl.issue(new FakeLineReader(["found a bug"]));
    expect(mockCreateIssue).toHaveBeenCalledWith({ title: "found a bug" });
  });
});

describe("repl.fork", () => {
  it("forks the current repo", async () => {
    mockForkRepo.mockResolvedValue("Forked to me/gitto: https://github.com/me/gitto");
    await repl.fork();
    expect(output()).toContain("Forked to me/gitto");
  });
});

describe("repl.collab", () => {
  it("invites the typed username", async () => {
    mockAddCollaborator.mockResolvedValue("Invited friend to collaborate on nayan/gitto.");
    await repl.collab(new FakeLineReader(["friend"]));
    expect(mockAddCollaborator).toHaveBeenCalledWith("friend");
  });
});

describe("runRepl", () => {
  function repoState(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      isRepo: true,
      hasRemote: false,
      currentBranch: "main",
      otherBranches: [],
      hasChanges: false,
      hasUnpushed: false,
      hasUnpulled: false,
      hasStash: false,
      hasCommits: true,
      inProgress: null,
      ...overrides,
    };
  }

  it("dispatches a recognized command and exits on 'exit'", async () => {
    mockConfigExists.mockReturnValue(true);
    mockIsLoggedIn.mockReturnValue(true);
    mockIsGitRepo.mockResolvedValue(true);
    mockGetStatus.mockResolvedValue({
      branch: "main",
      changedFiles: 0,
      readyToUpload: 0,
      upToDate: true,
      connectedToGitHub: false,
    });
    mockFindTrackedSecrets.mockResolvedValue([]);
    mockCreateLineReader.mockReturnValue(new FakeLineReader(["status", "exit"]));

    await runRepl();

    expect(output()).toContain('On "main".');
  });

  it("shows help and reports unknown commands", async () => {
    mockConfigExists.mockReturnValue(true);
    mockIsLoggedIn.mockReturnValue(true);
    mockIsGitRepo.mockResolvedValue(true);
    mockGetRepoState.mockResolvedValue(repoState());
    mockCreateLineReader.mockReturnValue(new FakeLineReader(["help", "bogus", "exit"]));

    await runRepl();

    expect(output()).toContain("Available commands:");
    expect(output()).toContain('Unknown command "bogus"');
  });

  it("offers to log in and set up a repo on first run", async () => {
    mockConfigExists.mockReturnValue(false);
    mockIsLoggedIn.mockReturnValue(false);
    mockIsGitRepo.mockResolvedValue(false);
    mockInitRepo.mockResolvedValue(undefined);
    mockCreateLineReader.mockReturnValue(new FakeLineReader(["n", "", "exit"]));

    await runRepl();

    expect(output()).toContain("Welcome to gitto");
    expect(mockLogin).not.toHaveBeenCalled();
    expect(mockInitRepo).toHaveBeenCalled();
    expect(output()).toContain("Set up.");
  });

  it("stops cleanly when piped input runs out without 'exit'", async () => {
    mockConfigExists.mockReturnValue(true);
    mockIsLoggedIn.mockReturnValue(true);
    mockIsGitRepo.mockResolvedValue(true);
    mockCreateLineReader.mockReturnValue(new FakeLineReader([]));

    await expect(runRepl()).resolves.toBeUndefined();
  });
});
