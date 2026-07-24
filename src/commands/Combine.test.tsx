import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { pressKey } from "../testSupport/ink.js";

const mockListBranches = vi.fn();
const mockMergeBranch = vi.fn();
vi.mock("../lib/git.js", () => ({
  listBranches: () => mockListBranches(),
  mergeBranch: (...args: unknown[]) => mockMergeBranch(...args),
}));

import { Combine } from "./Combine.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Combine", () => {
  it("says there's nothing to combine with only one branch", async () => {
    mockListBranches.mockResolvedValue({ current: "main", others: [] });

    const { lastFrame } = render(<Combine />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("nothing to combine");
    });
  });

  it("combines the branch picked from the list", async () => {
    mockListBranches.mockResolvedValue({ current: "main", others: ["feature"] });
    mockMergeBranch.mockResolvedValue('Combined "feature" into your current line.');

    const { lastFrame, stdin } = render(<Combine />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Combine which line into your current one?");
    });
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Combined "feature" into your current line.');
    });
    expect(mockMergeBranch).toHaveBeenCalledWith("feature");
  });
});
