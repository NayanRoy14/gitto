import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { pressKey } from "../testSupport/ink.js";

const mockListBranches = vi.fn();
const mockRebaseBranch = vi.fn();
vi.mock("../lib/git.js", () => ({
  listBranches: () => mockListBranches(),
  rebaseBranch: (...args: unknown[]) => mockRebaseBranch(...args),
}));

import { Rebase } from "./Rebase.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Rebase", () => {
  it("says there's nothing to replay onto with only one branch", async () => {
    mockListBranches.mockResolvedValue({ current: "feature", others: [] });

    const { lastFrame } = render(<Rebase />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("nothing to replay onto");
    });
  });

  it("rebases onto the branch picked from the list", async () => {
    mockListBranches.mockResolvedValue({ current: "feature", others: ["main"] });
    mockRebaseBranch.mockResolvedValue('Replayed your changes on top of "main".');

    const { lastFrame, stdin } = render(<Rebase />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Replay your changes on top of which line?");
    });
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Replayed your changes on top of "main".');
    });
    expect(mockRebaseBranch).toHaveBeenCalledWith("main");
  });
});
