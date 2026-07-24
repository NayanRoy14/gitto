import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { pressKey, settle } from "../testSupport/ink.js";

const mockListBranches = vi.fn();
const mockDeleteBranch = vi.fn();
vi.mock("../lib/git.js", async () => {
  const actual = await vi.importActual<typeof import("../lib/git.js")>("../lib/git.js");
  return {
    ...actual,
    listBranches: () => mockListBranches(),
    deleteBranch: (...args: unknown[]) => mockDeleteBranch(...args),
  };
});

import { Trash } from "./Trash.js";
import { UnmergedBranchError } from "../lib/git.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Trash", () => {
  it("says there's nothing to trash with only one branch", async () => {
    mockListBranches.mockResolvedValue({ current: "main", others: [] });

    const { lastFrame } = render(<Trash />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("nothing to trash");
    });
  });

  it("deletes the picked branch after confirmation", async () => {
    mockListBranches.mockResolvedValue({ current: "main", others: ["feature"] });
    mockDeleteBranch.mockResolvedValue('Trashed "feature".');

    const { lastFrame, stdin } = render(<Trash />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Trash which line?");
    });
    await settle();
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Trash "feature"? This can\'t be undone.');
    });
    await settle();
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Trashed "feature".');
    });
    expect(mockDeleteBranch).toHaveBeenCalledWith("feature", false);
  });

  it("does not delete when the user declines the confirmation", async () => {
    mockListBranches.mockResolvedValue({ current: "main", others: ["feature"] });

    const { lastFrame, stdin } = render(<Trash />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Trash which line?");
    });
    await settle();
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Trash "feature"? This can\'t be undone.');
    });
    await settle();
    await pressKey(stdin, "n");

    expect(mockDeleteBranch).not.toHaveBeenCalled();
  });

  it("offers to force-delete an unmerged branch", async () => {
    mockListBranches.mockResolvedValue({ current: "main", others: ["feature"] });
    mockDeleteBranch.mockRejectedValueOnce(new UnmergedBranchError("feature"));
    mockDeleteBranch.mockResolvedValueOnce('Trashed "feature".');

    const { lastFrame, stdin } = render(<Trash />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Trash which line?");
    });
    await settle();
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Trash "feature"? This can\'t be undone.');
    });
    await settle();
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Trash it anyway?");
    });
    await settle();
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Trashed "feature".');
    });
    expect(mockDeleteBranch).toHaveBeenNthCalledWith(1, "feature", false);
    expect(mockDeleteBranch).toHaveBeenNthCalledWith(2, "feature", true);
  });
});
