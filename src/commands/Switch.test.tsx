import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { pressKey } from "../testSupport/ink.js";

const mockListBranches = vi.fn();
const mockSwitchBranch = vi.fn();
vi.mock("../lib/git.js", () => ({
  listBranches: () => mockListBranches(),
  switchBranch: (...args: unknown[]) => mockSwitchBranch(...args),
}));

import { Switch } from "./Switch.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Switch", () => {
  it("says there's nothing to switch to with only one branch", async () => {
    mockListBranches.mockResolvedValue({ current: "main", others: [] });

    const { lastFrame } = render(<Switch />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("nothing to switch to");
    });
  });

  it("switches to the branch picked from the list", async () => {
    mockListBranches.mockResolvedValue({ current: "main", others: ["feature", "other"] });
    mockSwitchBranch.mockResolvedValue('Switched to "feature".');

    const { lastFrame, stdin } = render(<Switch />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Switch to which line?");
    });
    await pressKey(stdin, "\r");

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Switched to "feature".');
    });
    expect(mockSwitchBranch).toHaveBeenCalledWith("feature");
  });
});
