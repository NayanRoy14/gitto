import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { Text } from "ink";
import { render } from "ink-testing-library";
import { pressKey, settle } from "../testSupport/ink.js";

const mockConfigExists = vi.fn();
vi.mock("../lib/config.js", () => ({
  configExists: () => mockConfigExists(),
}));

const mockIsLoggedIn = vi.fn();
vi.mock("../lib/auth.js", () => ({
  isLoggedIn: () => mockIsLoggedIn(),
}));

const mockGetRepoState = vi.fn();
const mockInitRepo = vi.fn();
vi.mock("../lib/git.js", () => ({
  getRepoState: () => mockGetRepoState(),
  initRepo: () => mockInitRepo(),
}));

function stub(name: string) {
  const Stub = (props: { onDone?: (ok: boolean) => void }) => (
    <Text>{`STUB:${name}${props.onDone ? ":embedded" : ""}`}</Text>
  );
  Stub.displayName = `Stub(${name})`;
  return Stub;
}

vi.mock("./Login.js", () => ({ Login: stub("Login") }));
vi.mock("./Logout.js", () => ({ Logout: stub("Logout") }));
vi.mock("./Upload.js", () => ({ Upload: stub("Upload") }));
vi.mock("./DownloadFlow.js", () => ({ DownloadFlow: stub("DownloadFlow") }));
vi.mock("./Sync.js", () => ({ Sync: stub("Sync") }));
vi.mock("./Save.js", () => ({ Save: stub("Save") }));
vi.mock("./Status.js", () => ({ Status: stub("Status") }));
vi.mock("./Branch.js", () => ({ Branch: stub("Branch") }));
vi.mock("./Switch.js", () => ({ Switch: stub("Switch") }));
vi.mock("./Combine.js", () => ({ Combine: stub("Combine") }));
vi.mock("./History.js", () => ({ History: stub("History") }));
vi.mock("./Undo.js", () => ({ Undo: stub("Undo") }));
vi.mock("./Trash.js", () => ({ Trash: stub("Trash") }));
vi.mock("./Stash.js", () => ({ Stash: stub("Stash") }));
vi.mock("./Request.js", () => ({ Request: stub("Request") }));
vi.mock("./Issue.js", () => ({ Issue: stub("Issue") }));
vi.mock("./Fork.js", () => ({ Fork: stub("Fork") }));
vi.mock("./Collab.js", () => ({ Collab: stub("Collab") }));
vi.mock("./Rebase.js", () => ({ Rebase: stub("Rebase") }));
vi.mock("./Pick.js", () => ({ Pick: stub("Pick") }));
vi.mock("./Tag.js", () => ({ Tag: stub("Tag") }));

import { Palette } from "./Palette.js";

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Palette", () => {
  it("greets first-time users, then shows the menu once logged in", async () => {
    mockConfigExists.mockReturnValue(false);
    mockIsLoggedIn.mockReturnValue(true);
    mockGetRepoState.mockResolvedValue(repoState());

    const { lastFrame } = render(<Palette />);

    expect(lastFrame()).toContain("Welcome to gitto.");

    await vi.waitFor(
      () => {
        expect(lastFrame()).toContain("What would you like to do?");
      },
      { timeout: 2000 },
    );
  }, 10000);

  it("goes to login (not the menu) when greeted and not logged in", async () => {
    mockConfigExists.mockReturnValue(false);
    mockIsLoggedIn.mockReturnValue(false);

    const { lastFrame } = render(<Palette />);

    await vi.waitFor(
      () => {
        expect(lastFrame()).toContain("STUB:Login");
      },
      { timeout: 2000 },
    );
  }, 10000);

  it("shows a 'login' menu item (not a forced login step) for a returning but logged-out user", async () => {
    mockConfigExists.mockReturnValue(true);
    mockIsLoggedIn.mockReturnValue(false);
    mockGetRepoState.mockResolvedValue(repoState());

    const { lastFrame } = render(<Palette />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("What would you like to do?");
    });
    expect(lastFrame()).toContain("login");
  });

  it("offers to set up a repo when this folder isn't one yet", async () => {
    mockConfigExists.mockReturnValue(true);
    mockIsLoggedIn.mockReturnValue(true);
    mockGetRepoState.mockResolvedValue(repoState({ isRepo: false }));
    mockInitRepo.mockResolvedValue(undefined);

    const { lastFrame, stdin } = render(<Palette />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("This folder isn't a git project yet. Set one up?");
    });
    await settle();
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(mockInitRepo).toHaveBeenCalled();
    });
  });

  it("dispatches to the command selected from the menu", async () => {
    mockConfigExists.mockReturnValue(true);
    mockIsLoggedIn.mockReturnValue(true);
    mockGetRepoState.mockResolvedValue(repoState());

    const { lastFrame, stdin } = render(<Palette />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("What would you like to do?");
    });
    // First item in the menu built from a bare repo state is "download".
    await settle();
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("STUB:DownloadFlow:embedded");
    });
  });

  it("exits when 'quit' is selected", async () => {
    mockConfigExists.mockReturnValue(true);
    mockIsLoggedIn.mockReturnValue(true);
    mockGetRepoState.mockResolvedValue(repoState());

    const { lastFrame, unmount } = render(<Palette />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("What would you like to do?");
    });

    const frameBeforeQuit = lastFrame();
    unmount();
    expect(frameBeforeQuit).toContain("quit");
  });
});
