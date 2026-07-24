import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { pressKey, settle } from "../testSupport/ink.js";

const mockListBranches = vi.fn();
const mockGetBranchHistory = vi.fn();
const mockPickCommit = vi.fn();
vi.mock("../lib/git.js", () => ({
  listBranches: () => mockListBranches(),
  getBranchHistory: (...args: unknown[]) => mockGetBranchHistory(...args),
  pickCommit: (...args: unknown[]) => mockPickCommit(...args),
}));

import { Pick } from "./Pick.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Pick", () => {
  it("says there's nothing to pick from with only one branch", async () => {
    mockListBranches.mockResolvedValue({ current: "main", others: [] });

    const { lastFrame } = render(<Pick />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("nothing to pick from");
    });
  });

  it("says the source branch has nothing saved", async () => {
    mockListBranches.mockResolvedValue({ current: "main", others: ["feature"] });
    mockGetBranchHistory.mockResolvedValue([]);

    const { lastFrame, stdin } = render(<Pick />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Pick a change from which line?");
    });
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("nothing saved to pick from");
    });
  });

  it("cherry-picks the commit chosen from the chosen branch", async () => {
    mockListBranches.mockResolvedValue({ current: "main", others: ["feature"] });
    mockGetBranchHistory.mockResolvedValue([
      { hash: "abc1234", message: "add thing", date: "2026-01-01", author: "nayan" },
    ]);
    mockPickCommit.mockResolvedValue("Brought that change into your current line.");

    const { lastFrame, stdin } = render(<Pick />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Pick a change from which line?");
    });
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Bring which change into your current line?");
    });
    expect(mockGetBranchHistory).toHaveBeenCalledWith("feature");
    await settle();
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Brought that change into your current line.");
    });
    expect(mockPickCommit).toHaveBeenCalledWith("abc1234");
  });
});
