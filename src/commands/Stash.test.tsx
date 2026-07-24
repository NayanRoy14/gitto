import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";

const mockGetStatus = vi.fn();
const mockHasStash = vi.fn();
const mockStashChanges = vi.fn();
const mockRestoreStash = vi.fn();
vi.mock("../lib/git.js", () => ({
  getStatus: () => mockGetStatus(),
  hasStash: () => mockHasStash(),
  stashChanges: () => mockStashChanges(),
  restoreStash: () => mockRestoreStash(),
}));

import { Stash } from "./Stash.js";

beforeEach(() => {
  vi.clearAllMocks();
});

function status(changedFiles: number) {
  return {
    branch: "main",
    changedFiles,
    readyToUpload: 0,
    upToDate: changedFiles === 0,
    connectedToGitHub: false,
  };
}

describe("Stash", () => {
  it("stashes away changes when there are any", async () => {
    mockGetStatus.mockResolvedValue(status(2));
    mockStashChanges.mockResolvedValue("Stashed your changes away for later.");

    const { lastFrame } = render(<Stash />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Stashed your changes away for later.");
    });
    expect(mockRestoreStash).not.toHaveBeenCalled();
  });

  it("restores a stash when there are no pending changes", async () => {
    mockGetStatus.mockResolvedValue(status(0));
    mockHasStash.mockResolvedValue(true);
    mockRestoreStash.mockResolvedValue("Brought back your stashed changes.");

    const { lastFrame } = render(<Stash />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Brought back your stashed changes.");
    });
    expect(mockStashChanges).not.toHaveBeenCalled();
  });

  it("says there's nothing to do when neither applies", async () => {
    mockGetStatus.mockResolvedValue(status(0));
    mockHasStash.mockResolvedValue(false);

    const { lastFrame } = render(<Stash />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Nothing to stash away and nothing stashed to bring back.");
    });
  });
});
