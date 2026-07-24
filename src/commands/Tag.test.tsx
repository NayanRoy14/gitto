import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { pressKey, settle, typeText } from "../testSupport/ink.js";

const mockCreateTag = vi.fn();
const mockPushTag = vi.fn();
const mockGetRepoState = vi.fn();
vi.mock("../lib/git.js", () => ({
  createTag: (...args: unknown[]) => mockCreateTag(...args),
  pushTag: (...args: unknown[]) => mockPushTag(...args),
  getRepoState: () => mockGetRepoState(),
}));

const mockIsLoggedIn = vi.fn();
vi.mock("../lib/auth.js", () => ({
  isLoggedIn: () => mockIsLoggedIn(),
}));

import { Tag } from "./Tag.js";

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

describe("Tag", () => {
  it("tags and shows done without offering to push when disconnected", async () => {
    mockCreateTag.mockResolvedValue(undefined);
    mockGetRepoState.mockResolvedValue(repoState({ hasRemote: false }));
    mockIsLoggedIn.mockReturnValue(false);

    const { lastFrame, stdin } = render(<Tag />);
    await settle();

    expect(lastFrame()).toContain("Name for this tag:");
    await typeText(stdin, "v1.0.0");
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Message for this tag:");
    });
    await settle();
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Tagged this point as "v1.0.0".');
    });
    expect(mockCreateTag).toHaveBeenCalledWith("v1.0.0", "v1.0.0");
    expect(mockPushTag).not.toHaveBeenCalled();
  });

  it("offers to push the tag when connected and logged in", async () => {
    mockCreateTag.mockResolvedValue(undefined);
    mockGetRepoState.mockResolvedValue(repoState({ hasRemote: true }));
    mockIsLoggedIn.mockReturnValue(true);
    mockPushTag.mockResolvedValue('Uploaded tag "v1.0.0" to GitHub.');

    const { lastFrame, stdin } = render(<Tag />);
    await settle();

    await typeText(stdin, "v1.0.0");
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Message for this tag:");
    });
    await settle();
    await typeText(stdin, "release notes");
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Upload this tag to GitHub now?");
    });
    expect(mockCreateTag).toHaveBeenCalledWith("v1.0.0", "release notes");
    await settle();
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Uploaded tag "v1.0.0" to GitHub.');
    });
    expect(mockPushTag).toHaveBeenCalledWith("v1.0.0");
  });

  it("shows an error when creating the tag fails", async () => {
    mockCreateTag.mockRejectedValue(new Error("A tag with that name already exists."));

    const { lastFrame, stdin } = render(<Tag />);
    await settle();

    await typeText(stdin, "v1.0.0");
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Message for this tag:");
    });
    await settle();
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("A tag with that name already exists.");
    });
  });

  it("ignores an empty tag name", async () => {
    const { lastFrame, stdin } = render(<Tag />);
    await settle();
    await pressKey(stdin, "\r");

    expect(lastFrame()).toContain("Name for this tag:");
    expect(mockCreateTag).not.toHaveBeenCalled();
  });
});
