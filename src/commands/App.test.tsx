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

const mockIsGitRepo = vi.fn();
const mockInitRepo = vi.fn();
vi.mock("../lib/git.js", () => ({
  isGitRepo: () => mockIsGitRepo(),
  initRepo: () => mockInitRepo(),
}));

function stub(name: string) {
  const Stub = () => <Text>{`STUB:${name}`}</Text>;
  Stub.displayName = `Stub(${name})`;
  return Stub;
}

vi.mock("./Login.js", () => ({ Login: stub("Login") }));
vi.mock("./Upload.js", () => ({ Upload: stub("Upload") }));
vi.mock("./Download.js", () => ({
  Download: ({ url, destination }: { url: string; destination?: string }) => (
    <Text>{`STUB:Download:${url}:${destination ?? ""}`}</Text>
  ),
}));
vi.mock("./Status.js", () => ({ Status: stub("Status") }));
vi.mock("./Sync.js", () => ({ Sync: stub("Sync") }));
vi.mock("./Save.js", () => ({ Save: stub("Save") }));
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

import { App } from "./App.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("App", () => {
  it("greets first-time users, then goes to login when not logged in", async () => {
    mockConfigExists.mockReturnValue(false);
    mockIsLoggedIn.mockReturnValue(false);

    const { lastFrame } = render(<App command="status" />);

    expect(lastFrame()).toContain("Welcome to gitto.");

    await vi.waitFor(
      () => {
        expect(lastFrame()).toContain("STUB:Login");
      },
      { timeout: 2000 },
    );
  }, 10000);

  it("skips the repo check for commands that don't need one (download)", async () => {
    mockConfigExists.mockReturnValue(true);
    mockIsLoggedIn.mockReturnValue(true);

    const { lastFrame } = render(
      <App command="download" url="https://github.com/nayan/gitto.git" destination="./here" />,
    );

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("STUB:Download:https://github.com/nayan/gitto.git:./here");
    });
    expect(mockIsGitRepo).not.toHaveBeenCalled();
  });

  it("dispatches to the right command once the repo check passes", async () => {
    mockConfigExists.mockReturnValue(true);
    mockIsLoggedIn.mockReturnValue(true);
    mockIsGitRepo.mockResolvedValue(true);

    const { lastFrame } = render(<App command="status" />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("STUB:Status");
    });
  });

  it("offers to set up a repo, then dispatches once initialized", async () => {
    mockConfigExists.mockReturnValue(true);
    mockIsLoggedIn.mockReturnValue(true);
    mockIsGitRepo.mockResolvedValue(false);
    mockInitRepo.mockResolvedValue(undefined);

    const { lastFrame, stdin } = render(<App command="status" />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("isn't a git project yet");
    });
    await settle();
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("STUB:Status");
    });
    expect(mockInitRepo).toHaveBeenCalled();
  });

  it("cancels when the user declines setting up a repo", async () => {
    mockConfigExists.mockReturnValue(true);
    mockIsLoggedIn.mockReturnValue(true);
    mockIsGitRepo.mockResolvedValue(false);

    const { lastFrame, stdin } = render(<App command="status" />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("isn't a git project yet");
    });
    await settle();
    await pressKey(stdin, "n");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Cancelled.");
    });
    expect(mockInitRepo).not.toHaveBeenCalled();
  });
});
